import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const APP_ORIGIN = process.env.APP_URL?.replace(/\/+$/, '') || 'http://localhost:3000'

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
    .map(p => `<p style="margin:0 0 16px;color:#1A1D1F;font-size:15px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')

  const cta = options.ctaUrl
    ? `<a href="${options.ctaUrl}" style="display:inline-block;margin:8px 0 8px;padding:12px 28px;background:#26C6C6;color:#1A1D1F;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">${escapeHtml(options.ctaLabel ?? 'Öffnen')}</a>`
    : ''

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#E8ECEF;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(26,29,31,0.08);max-width:100%;">
            <tr>
              <td style="background:#1A1D1F;padding:28px 32px;">
                <!--
                  §180 Das echte Logo, nicht nachgebauter Text.

                  Hier stand die Wortmarke als HTML — in der Schrift, die das
                  Mailprogramm gerade zur Hand hatte, mit eigener Sperrung und
                  eigener Strichstärke. In einer E-Mail ist das besonders
                  heikel: kein Mailprogramm lädt Webschriften, „OKUN Workforce"
                  kam also bei jedem Empfänger anders an.

                  Die Negativfassung liegt als Bild vor, weil der Kopf dunkel
                  ist. Das alt-Attribut trägt den Namen, falls Bilder
                  blockiert sind —
                  dann steht dort wenigstens „OKUN Workforce" statt nichts.
                -->
                <img
                  src="${APP_ORIGIN}/brand/logo-horizontal-negativ.png"
                  width="170" height="60" alt="OKUN Workforce"
                  style="display:block;width:170px;height:60px;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${paragraphs}
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="background:#E8ECEF;padding:16px 32px;color:#565D61;font-size:12px;">
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
