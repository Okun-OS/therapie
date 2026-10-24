import webpush from 'web-push'
import { prisma } from './prisma'
import { sendeAnGeraete } from './push-geraet'

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'

const configured = Boolean(vapidPublicKey && vapidPrivateKey)
if (configured) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey!, vapidPrivateKey!)
}

export async function sendPushToEmployee(employeeId: string, payload: { title: string; body: string; url?: string }): Promise<void> {
  // §139 Zwei Wege, ein Aufruf. Die App aus dem Store bekommt die Nachricht
  // nativ (APNs/FCM) — die erreicht das Telefon auch, wenn die App zu ist.
  // Der Browser bekommt sie wie bisher. Kein Aufrufer muss das unterscheiden.
  await sendeAnGeraete(employeeId, {
    titel: payload.title, text: payload.body, url: payload.url,
  }).catch(() => 0)

  const subs = await prisma.pushSubscription.findMany({ where: { employeeId } })
  if (subs.length === 0) return

  if (!configured) {
    console.log(`[push:dev] an ${employeeId} – "${payload.title}": ${payload.body}`)
    return
  }

  await Promise.all(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        )
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number } | undefined)?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    }),
  )
}
