import { prisma } from './prisma'
import { sendEmail } from './email'
import { sendPushToEmployee } from './push'
import { EMPLOYEES } from './mock-data'

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
    },
  })

  const employee = EMPLOYEES.find(e => e.id === employeeId)

  await Promise.all([
    sendPushToEmployee(employeeId, { title: opts.title, body: opts.body, url: opts.url }),
    employee ? sendEmail(employee.email, opts.title, opts.body) : Promise.resolve(),
  ])
}
