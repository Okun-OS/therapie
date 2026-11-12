/**
 * Einmalige Ankündigung an alle aktiven Mitarbeiter.
 * Ausführen mit:  npx tsx scripts/announce-changelog.ts
 * (DATABASE_URL, VAPID_* und SMTP_* müssen gesetzt sein)
 */
import { PrismaClient } from '@prisma/client'
import webpush from 'web-push'
import nodemailer from 'nodemailer'

const prisma = new PrismaClient()

const TITLE = '🆕 Neue Features in deinem Dienstplan'

const BODY = `Frisch verfügbar:
• Team-Ansicht: Sieh jetzt den Dienstplan aller Kollegen direkt in deiner App (Tab "Team")
• Dienstplan-Status: Entwurf & Veröffentlichen — du wirst benachrichtigt, sobald der Plan final ist
• Stundenkonto: Die Planung berücksichtigt jetzt gezielt Über- und Minusstunden
Schau mal rein! 👋`

const URL = '/employee/schedule'

// ── WebPush setup ───────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:info@okun.io',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

// ── Mailer setup ────────────────────────────────────────────────────────────
const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null

async function sendPush(employeeId: string): Promise<number> {
  const subs = await prisma.pushSubscription.findMany({ where: { employeeId } })
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: TITLE, body: BODY, url: URL }),
      )
      sent++
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
      }
    }
  }
  return sent
}

async function sendMail(email: string): Promise<void> {
  if (!mailer || !email) return
  await mailer.sendMail({
    from: process.env.SMTP_FROM ?? 'OKUN Workforce <noreply@okun.io>',
    to: email,
    subject: TITLE,
    text: BODY,
  }).catch(() => {})
}

async function main() {
  const employees = await prisma.employee.findMany({
    where: { active: true, role: 'employee' },
    select: { id: true, name: true, email: true },
  })

  console.log(`Sende an ${employees.length} Mitarbeiter…\n`)

  let notifOk = 0, pushOk = 0, mailOk = 0

  for (const emp of employees) {
    // DB-Notification (Glocken-Inbox)
    try {
      await prisma.notification.create({
        data: { employeeId: emp.id, type: 'announcement', title: TITLE, body: BODY },
      })
      notifOk++
    } catch { /* ignorieren */ }

    // WebPush
    const pushed = await sendPush(emp.id)
    pushOk += pushed

    // E-Mail
    if (emp.email) {
      await sendMail(emp.email)
      mailOk++
    }

    console.log(`  ✓ ${emp.name} (push: ${pushed > 0 ? 'ja' : 'nein'}, mail: ${emp.email ? 'ja' : 'nein'})`)
  }

  console.log(`\nFertig: ${notifOk}× Inbox, ${pushOk}× Push, ${mailOk}× Mail`)
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
