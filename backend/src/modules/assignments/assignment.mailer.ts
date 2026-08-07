import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { mailService } from '@services/mail.service';
import { emailShell } from '@services/emailLayout';

interface LeadLine {
  id: string;
  company: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  country: string | null;
  shellSpace: string | null;
}

function leadTitle(l: LeadLine): string {
  return l.company || [l.firstName, l.lastName].filter(Boolean).join(' ') || 'Untitled lead';
}

const NEWLINE = String.fromCharCode(10);

export function compose(lead: LeadLine, assigneeName: string, assignedByName: string, copied: boolean) {
  const title = leadTitle(lead);
  const url = `${env.APP_BASE_URL.replace(/\/$/, '')}/leads/${lead.id}`;
  const rows: Array<[string, string]> = [
    ['Company', lead.company || '—'],
    ['Contact', [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'],
    ['Email', lead.email || '—'],
    ['Mobile', lead.mobile || '—'],
    ['Country', lead.country || '—'],
    ['Shell space', lead.shellSpace || '—'],
  ];

  const text = [
    `${assigneeName}, a lead has been assigned to you by ${assignedByName}.`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `Open the lead: ${url}`,
    '',
    `Sent by ${env.APP_NAME}.${copied ? ' Your team is copied on this assignment.' : ''}`,
  ].join(NEWLINE);

  const html = emailShell({
    eyebrow: 'New lead assigned',
    title,
    intro: `Hi ${assigneeName} — this lead is now yours, assigned by ${assignedByName}.`,
    preheader: `${title} — assigned by ${assignedByName}`,
    rows,
    cta: { label: 'Open the lead', url },
    footerNote: copied ? 'Your team is copied on this assignment.' : undefined,
  });

  return { subject: `Lead assigned to ${assigneeName}: ${title}`, text, html };
}

export function notifyAssignments(leadIds: string[], assignToId: string, assignedById: string): void {
  void (async () => {
    try {
      if (!leadIds.length) return;

      // Only a real hand-off copies the team. Taking a lead yourself — adding one
      // from the Add Lead page, for instance — notifies nobody else.
      const isSelfAssignment = assignToId === assignedById;

      const [assignee, assignedBy, others, leads] = await Promise.all([
        prisma.user.findUnique({ where: { id: assignToId }, select: { firstName: true, lastName: true, email: true } }),
        prisma.user.findUnique({ where: { id: assignedById }, select: { firstName: true, lastName: true } }),
        isSelfAssignment
          ? Promise.resolve([] as Array<{ email: string }>)
          : prisma.user.findMany({
            where: { deletedAt: null, status: 'ACTIVE', id: { not: assignToId } },
            select: { email: true },
          }),
        prisma.lead.findMany({
          where: { id: { in: leadIds } },
          select: {
            id: true, company: true, firstName: true, lastName: true,
            email: true, mobile: true, country: true, shellSpace: true,
          },
        }),
      ]);

      if (!assignee?.email) {
        logger.warn(`[assignment-mail] assignee ${assignToId} has no email — skipped ${leadIds.length} lead(s)`);
        return;
      }

      const assigneeName = `${assignee.firstName} ${assignee.lastName}`.trim();
      const assignedByName = assignedBy ? `${assignedBy.firstName} ${assignedBy.lastName}`.trim() : 'a manager';
      const cc = others.map((u) => u.email).filter(Boolean);

      let sent = 0;
      for (const lead of leads) {
        const { subject, text, html } = compose(lead, assigneeName, assignedByName, cc.length > 0);
        const res = await mailService.send({
          to: assignee.email, cc, subject, text, html,
          kind: 'ASSIGNMENT', entityId: lead.id,
        });
        if (res.ok) sent += 1;
      }
      logger.info(`[assignment-mail] ${sent}/${leads.length} email(s) dispatched to ${assignee.email} (cc ${cc.length})`);
    } catch (err) {
      logger.error(`[assignment-mail] failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();
}
