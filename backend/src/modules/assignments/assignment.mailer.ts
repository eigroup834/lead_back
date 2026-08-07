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

const BRAND = '#4f46e5';
const INK = '#101426';
const MUTED = '#6b7280';
const LINE = '#e6e8f0';
const CANVAS = '#f4f5f9';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function detailRow(label: string, value: string, last: boolean) {
  const border = last ? '' : `border-bottom:1px solid ${LINE};`;
  return `
    <tr>
      <td style="${border}padding:11px 0 11px 0;font-family:${FONT};font-size:13px;color:${MUTED};white-space:nowrap;vertical-align:top;width:120px;">${esc(label)}</td>
      <td style="${border}padding:11px 0 11px 0;font-family:${FONT};font-size:14px;color:${INK};font-weight:500;vertical-align:top;word-break:break-word;">${esc(value)}</td>
    </tr>`;
}

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
  ].join('\n');

  // Shown as the inbox preview line, then hidden in the body.
  const preheader = `${title} — assigned by ${assignedByName}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};">
  <div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">

          <!-- brand bar -->
          <tr>
            <td style="background:${BRAND};padding:18px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="26">
                      <tr><td style="height:4px;background:#ffffff;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
                      <tr><td style="height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
                      <tr><td style="height:4px;width:18px;background:#c7d2fe;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
                      <tr><td style="height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
                      <tr><td style="height:4px;width:10px;background:#a5b4fc;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">
                    Exhibitor CRM
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- headline -->
          <tr>
            <td style="padding:30px 28px 4px 28px;">
              <div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND};">
                New lead assigned
              </div>
              <div style="font-family:${FONT};font-size:14px;line-height:22px;color:${MUTED};padding-top:8px;">
                Hello ${esc(assigneeName)}! A new lead has been assigned to you by ${esc(assignedByName)}.
              </div>
            </td>
          </tr>

          <!-- details -->
          <tr>
            <td style="padding:22px 28px 6px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LINE};">
                ${rows.map(([k, v], i) => detailRow(k, v, i === rows.length - 1)).join('')}
              </table>
            </td>
          </tr>

          <!-- call to action -->
          <tr>
            <td style="padding:24px 28px 30px 28px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(url)}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="23%" stroke="f" fillcolor="${BRAND}">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;">Open the lead</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${esc(url)}" style="display:inline-block;background:${BRAND};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:10px;">
                Open the lead
              </a>
              <!--<![endif]-->
              <div style="font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};padding-top:14px;">
                Or paste this into your browser:<br>
                <span style="color:${BRAND};word-break:break-all;">${esc(url)}</span>
              </div>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="background:#fafbfd;border-top:1px solid ${LINE};padding:16px 28px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
              Sent by ${esc(env.APP_NAME)}.${copied ? ' Your team is copied on this assignment.' : ''}
              <br>This is an automated message — no reply is needed.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
