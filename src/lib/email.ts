import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface SendEmailOptions {
  ctaLabel?: string
  ctaUrl?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderEmailHtml(text: string, options: SendEmailOptions): string {
  const paragraphs = text
    .split('\n\n')
    .map(p => `<p style="margin:0 0 16px;color:#1A3355;font-size:15px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')

  const cta = options.ctaUrl
    ? `<a href="${options.ctaUrl}" style="display:inline-block;margin:8px 0 8px;padding:12px 28px;background:#F5B800;color:#0B1F3A;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">${escapeHtml(options.ctaLabel ?? 'Öffnen')}</a>`
    : ''

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#E8EEF5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(11,31,58,0.08);max-width:100%;">
            <tr>
              <td style="background:#0B1F3A;padding:28px 32px;">
                <table cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="width:36px;height:36px;background:#F5B800;border-radius:10px;text-align:center;vertical-align:middle;font-size:16px;font-weight:700;color:#0B1F3A;">OW</td>
                    <td style="padding-left:12px;color:#ffffff;font-weight:700;font-size:16px;">OKUN Workforce</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${paragraphs}
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="background:#E8EEF5;padding:16px 32px;color:#7592BD;font-size:12px;">
                © ${new Date().getFullYear()} OKUN Workforce
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendEmail(to: string, subject: string, text: string, options: SendEmailOptions = {}): Promise<void> {
  if (!resend) {
    console.log(`[email:dev] an ${to} – "${subject}"\n${text}${options.ctaUrl ? `\n${options.ctaUrl}` : ''}`)
    return
  }
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'OKUN Workforce <onboarding@resend.dev>',
    to,
    subject,
    text,
    html: renderEmailHtml(text, options),
  })
}
