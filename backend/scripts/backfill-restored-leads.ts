/**
 * Re-applies the historical -> lead field mapping to leads that were converted
 * before the mapping carried every field across. Idempotent: it only fills fields
 * that are currently empty, and only from the historical row that produced the lead.
 *
 *   npx tsx scripts/backfill-restored-leads.ts          # report only
 *   npx tsx scripts/backfill-restored-leads.ts --apply  # write the changes
 */
import { prisma } from '@config/prisma';
import { carryOverRemarks, splitName } from '@modules/historical/historical.service';

const apply = process.argv.includes('--apply');

(async () => {
  const leads = await prisma.lead.findMany({
    where: { source: 'HISTORICAL', deletedAt: null },
    select: {
      id: true, company: true, title: true, firstName: true, lastName: true,
      altEmail: true, altMobile: true, industry: true, shellSpace: true,
      remarks: true, eventName: true, createDate: true,
    },
  });

  let changed = 0;
  for (const lead of leads) {
    const src = await prisma.historicalLead.findFirst({ where: { restoredLeadId: lead.id } });
    if (!src) {
      console.log(`SKIP  ${lead.company} — no source historical row`);
      continue;
    }

    const { title, firstName, lastName } = splitName(src.name);
    const data: Record<string, unknown> = {};
    const fill = (key: string, current: unknown, next: unknown) => {
      if ((current === null || current === undefined || current === '') && next) data[key] = next;
    };

    // The old mapping put the whole name in firstName. Names must be re-split as a
    // unit — filling only the empty lastName would duplicate the surname.
    if (src.name && lead.firstName === src.name.trim().replace(/\s+/g, ' ')) {
      if (title) data.title = title;
      data.firstName = firstName;
      data.lastName = lastName;
    } else {
      fill('title', lead.title, title);
      fill('firstName', lead.firstName, firstName);
      fill('lastName', lead.lastName, lastName);
    }
    fill('altEmail', lead.altEmail, src.altEmail);
    fill('altMobile', lead.altMobile, src.altMobile);
    fill('industry', lead.industry, src.industry);
    fill('shellSpace', lead.shellSpace, src.spaceSqm);
    fill('remarks', lead.remarks, carryOverRemarks(src));
    fill('eventName', lead.eventName, src.eventName);
    fill('createDate', lead.createDate, src.dateOfConfirmation);

    if (!Object.keys(data).length) {
      console.log(`OK    ${lead.company} — nothing missing`);
      continue;
    }

    changed += 1;
    console.log(`${apply ? 'FIX  ' : 'WOULD'} ${lead.company} -> ${Object.keys(data).join(', ')}`);
    if (apply) await prisma.lead.update({ where: { id: lead.id }, data });
  }

  console.log(`\n${changed} lead(s) ${apply ? 'updated' : 'would be updated'}${apply ? '' : ' — re-run with --apply'}`);
  await prisma.$disconnect();
  process.exit(0);
})();
