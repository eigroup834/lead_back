import { env } from '@config/env';

/**
 * Shared shell for transactional email.
 *
 * Email clients are not browsers: no flexbox, no grid, no web fonts, and Gmail
 * strips <style> blocks. So everything here is nested tables with inline styles,
 * a system font stack, and a VML fallback so the button still renders in Outlook.
 * Keeping it in one place means every message the CRM sends looks like the same
 * product rather than like three different ones.
 */

export const MAIL = {
  brand: '#4f46e5',
  amber: '#b45309',
  ink: '#101426',
  muted: '#6b7280',
  line: '#e6e8f0',
  canvas: '#f4f5f9',
  footer: '#fafbfd',
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
} as const;

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The funnel mark, drawn in table cells — an <img> or SVG would be blocked by default. */
function logoCell(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="26">
      <tr><td style="height:4px;background:#ffffff;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="height:4px;width:18px;background:#c7d2fe;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="height:4px;width:10px;background:#a5b4fc;border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>`;
}

function detailRow(label: string, value: string, last: boolean): string {
  const border = last ? '' : `border-bottom:1px solid ${MAIL.line};`;
  return `
    <tr>
      <td style="${border}padding:11px 0;font-family:${MAIL.font};font-size:13px;color:${MAIL.muted};white-space:nowrap;vertical-align:top;width:120px;">${esc(label)}</td>
      <td style="${border}padding:11px 0;font-family:${MAIL.font};font-size:14px;color:${MAIL.ink};font-weight:500;vertical-align:top;word-break:break-word;">${esc(value)}</td>
    </tr>`;
}

export interface EmailShellInput {
  /** Small coloured label above the headline, e.g. "New lead assigned". */
  eyebrow: string;
  /** The headline — usually the company or lead name. */
  title: string;
  /** One sentence of context under the headline. */
  intro: string;
  /** Label/value pairs, rendered in the order given. */
  rows: Array<[string, string]>;
  /** Optional highlighted callout, used for time-critical detail. */
  highlight?: { label: string; value: string };
  cta?: { label: string; url: string };
  /** Inbox preview line. Falls back to the intro. */
  preheader?: string;
  footerNote?: string;
  /** Accent for the eyebrow and callout. Defaults to brand indigo. */
  accent?: string;
}

export function emailShell(input: EmailShellInput): string {
  const accent = input.accent ?? MAIL.brand;
  const preheader = input.preheader ?? input.intro;

  const highlight = input.highlight
    ? `
          <tr>
            <td style="padding:20px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MAIL.canvas};border-left:3px solid ${accent};border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;font-family:${MAIL.font};">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;color:${MAIL.muted};">${esc(input.highlight.label)}</div>
                    <div style="font-size:18px;font-weight:700;color:${MAIL.ink};padding-top:3px;letter-spacing:-0.2px;">${esc(input.highlight.value)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : '';

  const cta = input.cta
    ? `
          <tr>
            <td style="padding:24px 28px 30px 28px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(input.cta.url)}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="23%" stroke="f" fillcolor="${MAIL.brand}">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:${MAIL.font};font-size:15px;font-weight:600;">${esc(input.cta.label)}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${esc(input.cta.url)}" style="display:inline-block;background:${MAIL.brand};color:#ffffff;font-family:${MAIL.font};font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:10px;">${esc(input.cta.label)}</a>
              <!--<![endif]-->
              <div style="font-family:${MAIL.font};font-size:12px;line-height:18px;color:${MAIL.muted};padding-top:14px;">
                Or paste this into your browser:<br>
                <span style="color:${MAIL.brand};word-break:break-all;">${esc(input.cta.url)}</span>
              </div>
            </td>
          </tr>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${MAIL.canvas};">
  <div style="display:none;font-size:1px;color:${MAIL.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MAIL.canvas};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${MAIL.line};border-radius:14px;overflow:hidden;">

          <tr>
            <td style="background:${MAIL.brand};padding:18px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">${logoCell()}</td>
                  <td style="vertical-align:middle;font-family:${MAIL.font};font-size:15px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">Exhibitor CRM</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 28px 4px 28px;">
              <div style="font-family:${MAIL.font};font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${accent};">${esc(input.eyebrow)}</div>
              <div style="font-family:${MAIL.font};font-size:22px;line-height:30px;font-weight:700;color:${MAIL.ink};padding-top:8px;letter-spacing:-0.4px;">${esc(input.title)}</div>
              <div style="font-family:${MAIL.font};font-size:14px;line-height:22px;color:${MAIL.muted};padding-top:8px;">${esc(input.intro)}</div>
            </td>
          </tr>
${highlight}
          <tr>
            <td style="padding:22px 28px 6px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${MAIL.line};">
                ${input.rows.map(([k, v], i) => detailRow(k, v, i === input.rows.length - 1)).join('')}
              </table>
            </td>
          </tr>
${cta}
          <tr>
            <td style="background:${MAIL.footer};border-top:1px solid ${MAIL.line};padding:16px 28px;font-family:${MAIL.font};font-size:12px;line-height:18px;color:${MAIL.muted};">
              Sent by ${esc(env.APP_NAME)}.${input.footerNote ? ` ${esc(input.footerNote)}` : ''}
              <br>This is an automated message — no reply is needed.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
