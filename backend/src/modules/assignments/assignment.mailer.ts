import { prisma } from '@config/prisma';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { mailService } from '@services/mail.service';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function compose(lead: LeadLine, assigneeName: string, assignedByName: string) {
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
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
      <p><strong>${esc(assigneeName)}</strong>, a lead has been assigned to you by ${esc(assignedByName)}.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="border:1px solid #e2e8f0;background:#f8fafc"><strong>${esc(k)}</strong></td>` +
              `<td style="border:1px solid #e2e8f0">${esc(v)}</td></tr>`,
          )
          .join('')}
      </table>
      <p><a href="${esc(url)}" style="background:#4f46e5;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none">Open the lead</a></p>
      <p style="color:#64748b;font-size:12px">Sent by ${esc(env.APP_NAME)}. You are copied because you are a member of the team.</p>
    </div>`;

  return { subject: `Lead assigned to ${assigneeName}: ${title}`, text, html };
}

export function notifyAssignments(leadIds: string[], assignToId: string, assignedById: string): void {
  void (async () => {
    try {
      if (!leadIds.length) return;

      const [assignee, assignedBy, others, leads] = await Promise.all([
        prisma.user.findUnique({ where: { id: assignToId }, select: { firstName: true, lastName: true, email: true } }),
        prisma.user.findUnique({ where: { id: assignedById }, select: { firstName: true, lastName: true } }),
        prisma.user.findMany({
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
        const { subject, text, html } = compose(lead, assigneeName, assignedByName);
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
