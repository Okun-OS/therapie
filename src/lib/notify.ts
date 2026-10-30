import { prisma } from './prisma'
import { sendEmail } from './email'
import { sendPushToEmployee } from './push'
import { getEmployeeById } from './entities'

export async function notifyEmployee(
  employeeId: string,
  opts: { type: string; title: string; body: string; requestId?: string; url?: string },
): Promise<void> {
  await prisma.notification.create({
    data: {
      employeeId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      requestId: opts.requestId,
      // §239 Die Adresse wurde bisher NUR an die Push-Meldung weitergereicht
      // und nicht gespeichert. In der Glocke stand deshalb ein Text ohne Ziel.
      url: opts.url ?? null,
    },
  })

  const employee = await getEmployeeById(employeeId)

  await Promise.all([
    sendPushToEmployee(employeeId, { title: opts.title, body: opts.body, url: opts.url }),
    employee ? sendEmail(employee.email, opts.title, opts.body) : Promise.resolve(),
  ])
}
