import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!resend) {
    console.log(`[email:dev] an ${to} – "${subject}"\n${text}`)
    return
  }
  await resend.emails.send({
    from: 'OKUN Workforce <onboarding@resend.dev>',
    to,
    subject,
    text,
  })
}
