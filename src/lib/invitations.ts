import { prisma } from './prisma'
import { sendEmail } from './email'
import { generateSecureToken } from './secure-token'
import { invitationExpiry, INVITATION_VALID_DAYS } from './invitation-expiry'
import { toEmployee, toCustomer } from './entities'
import { applyExistingClosuresToNewEmployee } from './vacation-entities'
import { istPlatzhalter } from './belegschaft-import'
import type { Role, Employee, Customer } from './types'

export { invitationExpiry }

const ROLE_LABEL: Record<Role, string> = {
  employee: 'Mitarbeiter',
  admin: 'Standortleitung',
  company: 'Geschäftsführung',
  okun: 'OKUN Administrator',
}

export async function sendInvitationEmail(
  origin: string,
  invitation: { token: string; email: string; role: string; name?: string | null; customerName?: string | null },
) {
  const link = `${origin}/register/${invitation.token}`
  const greeting = invitation.name ? `Hallo ${invitation.name},` : 'Hallo,'
  const orgLine = invitation.customerName ? `\nOrganisation: ${invitation.customerName}` : ''
  const roleLabel = ROLE_LABEL[invitation.role as Role] ?? invitation.role

  await sendEmail(
    invitation.email,
    'Ihre Einladung zu OKUN Workforce',
    `${greeting}\n\nSie wurden zu OKUN Workforce eingeladen (Rolle: ${roleLabel}).${orgLine}\n\nRichten Sie Ihr Konto über den folgenden Button ein. Der Link ist ${INVITATION_VALID_DAYS} Tage gültig.\n\nTipp: Öffnen Sie den Link auf Ihrem Smartphone und wählen Sie "Zum Home-Bildschirm hinzufügen" (iPhone) bzw. "App installieren" (Android) – so nutzen Sie OKUN Workforce wie eine native App, inklusive Push-Benachrichtigungen.\n\nIhr OKUN Workforce Team`,
    { ctaUrl: link, ctaLabel: 'Konto einrichten', ablehnungMelden: true },
  )
}

export async function createAndSendInvitation(
  origin: string,
  input: { email: string; role: Role; name?: string; customerName?: string; customerId?: string; employeeId?: string; locationId?: string },
) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!EMAIL_RE.test(input.email?.trim() ?? '')) throw new Error('Ungültige E-Mail-Adresse')

  const invitation = await prisma.invitationToken.create({
    data: {
      token: generateSecureToken(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      name: input.name,
      customerName: input.customerName,
      customerId: input.customerId,
      employeeId: input.employeeId,
      locationId: input.locationId,
      expiresAt: invitationExpiry(),
    },
  })

  // §200 Wie bei den anderen Einladungswegen: Eine Ablehnung des
  // Versanddienstes wird gemeldet, nicht geworfen — die Einladung steht
  // bereits und lässt sich erneut senden.
  let emailSent = true
  try {
    await sendInvitationEmail(origin, invitation)
  } catch {
    emailSent = false
  }
  return { ...invitation, emailSent }
}

export class LocationCustomerMismatchError extends Error {
  constructor() {
    super('Dieser Standort gehört nicht zu deinem Unternehmen.')
  }
}

/** Legt Mitarbeiter und Einladung atomar in einer Transaktion an, damit nie ein
 * Mitarbeiter ohne zugehörige Einladung entsteht (oder umgekehrt). Lebt bewusst in
 * invitations.ts statt entities.ts: entities.ts wird auch von 'use client'-Seiten aus
 * über fairness.ts für reine Lesefunktionen importiert, und der E-Mail-/Krypto-Code
 * hier (Resend, crypto.randomBytes) darf nicht ins Client-Bundle gelangen.
 *
 * expectedCustomerId verhindert, dass ein Mitarbeiter mit fehlendem/falschem
 * customerId entsteht (und dadurch nach dem nächsten mandantenscoped Fetch
 * "verschwindet"): bei Standorten ohne customerId (Altlasten vor #121-126) wird
 * er einmalig auf expectedCustomerId nachgezogen; bei abweichendem customerId
 * wird die Anfrage abgelehnt statt den Standort eines anderen Unternehmens zu
 * verwenden. */
export async function addEmployeeWithInvitation(
  input: {
    name: string
    email: string
    position: string
    weeklyHours: number
    workDaysPerWeek?: number
    workDays?: string[]
    dailyTargetHours?: number
    fixedOffDays?: string[]
    locationId: string
    expectedCustomerId?: string
    phone?: string
    birthDate?: string
    roleType?: string
    employmentType?: string
    gruppe?: string
    bereich?: string
    multiGroupCapable?: boolean
    fixedLocations?: string
    qualifications?: string[]
    allowedTasks?: string[]
    contractVacationDays?: number
    hoursBalanceOffset?: number
    preApprovedVacations?: Array<{ from: string; to: string; note?: string }>
  },
  origin: string,
  options: { sendInvitation?: boolean } = {},
): Promise<{ employee: Employee; emailSent: boolean }> {
  const sendInvitation = options.sendInvitation ?? true

  const { employeeRow, invitation, locationState } = await prisma.$transaction(async tx => {
    const location = await tx.location.findUnique({ where: { id: input.locationId } })
    if (!location) throw new Error('Standort nicht gefunden')
    if (input.expectedCustomerId && location.customerId && location.customerId !== input.expectedCustomerId) {
      throw new LocationCustomerMismatchError()
    }
    const customerId = input.expectedCustomerId ?? location.customerId ?? undefined
    if (input.expectedCustomerId && !location.customerId) {
      await tx.location.update({ where: { id: location.id }, data: { customerId: input.expectedCustomerId } })
    }
    const employeeRow = await tx.employee.create({
      data: {
        customerId,
        name: input.name,
        email: input.email,
        role: 'employee',
        locationId: input.locationId,
        weeklyHours: input.weeklyHours,
        workDaysPerWeek: input.workDaysPerWeek,
        workDays: input.workDays ?? [],
        dailyTargetHours: input.dailyTargetHours,
        fixedOffDays: input.fixedOffDays ?? [],
        position: input.position,
        hoursBalance: input.hoursBalanceOffset ?? 0,
        vacationDaysTotal: input.contractVacationDays ?? 30,
        vacationDaysUsed: 0,
        active: true,
        joinedAt: new Date().toISOString().split('T')[0],
        phone: input.phone,
        birthDate: input.birthDate,
        roleType: input.roleType,
        employmentType: input.employmentType,
        gruppe: input.gruppe,
        bereich: input.bereich,
        multiGroupCapable: input.multiGroupCapable,
        fixedLocations: input.fixedLocations,
        qualifications: input.qualifications ?? [],
        allowedTasks: input.allowedTasks ?? [],
      },
    })
    // Create pre-approved vacation requests
    if (input.preApprovedVacations?.length) {
      const today = new Date().toISOString().split('T')[0]
      for (const v of input.preApprovedVacations) {
        if (!v.from || !v.to) continue
        const fromDate = new Date(v.from)
        const toDate = new Date(v.to)
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) continue
        const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1)
        await tx.vacationRequest.create({
          data: {
            employeeId: employeeRow.id,
            employeeName: input.name,
            locationId: input.locationId,
            locationName: location.name,
            startDate: v.from,
            endDate: v.to,
            days,
            reason: v.note ?? 'Bereits genehmigt (bei Eintritt erfasst)',
            status: 'approved',
            submittedAt: today,
            respondedAt: today,
            respondedBy: 'system',
          },
        })
      }
    }
    if (!sendInvitation) return { employeeRow, invitation: null, locationState: location.state }
    const invitation = await tx.invitationToken.create({
      data: {
        token: generateSecureToken(),
        email: input.email.trim().toLowerCase(),
        role: 'employee',
        name: input.name,
        customerId,
        employeeId: employeeRow.id,
        locationId: input.locationId,
        expiresAt: invitationExpiry(),
      },
    })
    return { employeeRow, invitation, locationState: location.state }
  })

  const employee = toEmployee(employeeRow)
  await applyExistingClosuresToNewEmployee(employee, locationState).catch(() => null)

  if (!invitation) {
    return { employee, emailSent: false }
  }

  let emailSent = true
  try {
    await sendInvitationEmail(origin, invitation)
  } catch {
    emailSent = false
  }

  return { employee, emailSent }
}

/** §200 Abgelehnt mit einem Satz für die Leitung — und dem passenden HTTP-Status. */
export class ZugangKonflikt extends Error {
  constructor(message: string, readonly status: 400 | 409 = 409) { super(message) }
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * §200 E-Mail-Adresse eines Mitarbeiters ändern und den Zugang neu einladen.
 *
 * WAS VORHER PASSIERTE
 * Die Adresse ließ sich in der Bearbeitung zwar ändern, aber nur in der
 * Mitarbeiterzeile. Der alte Einladungslink blieb gültig — an der Adresse,
 * die gerade als falsch erkannt war. Ein bestehendes Konto meldete sich
 * weiter mit der alten Adresse an, und seine Codes per E-Mail (§196) gingen
 * dorthin. Und wer danach eine Einladung an die neue Adresse schickte,
 * bekam beim Annehmen ein ZWEITES Konto für denselben Menschen.
 *
 * WAS JETZT PASSIERT, in einem Zug
 * 1. Alle offenen Einladungen dieses Mitarbeiters laufen sofort ab.
 * 2. Mitarbeiter UND sein Konto bekommen die neue Adresse — es bleibt ein
 *    Konto, mit allem, was daran hängt.
 * 3. Eine frische Einladung geht an die neue Adresse. Beim Annehmen setzt
 *    der Mensch ein neues Passwort für eben dieses Konto.
 * 4. Gab es schon ein Konto, erfährt die ALTE Adresse von der Änderung —
 *    ohne Link. Die Leitung kann so ein Konto umlenken; dann soll es
 *    wenigstens niemand unbemerkt tun können. Ohne Konto wird die alte
 *    Adresse nicht angeschrieben: Sie war meist ein Tippfehler, und dann
 *    gehört das Postfach jemand anderem.
 *
 * Ohne neue Adresse ist es nur Schritt 1 und 3: die Einladung neu senden.
 *
 * Leitungskonten (Standortleitung, Geschäftsführung) werden hier nicht
 * umgestellt. Sonst könnte eine Standortleitung die Anmeldung der
 * Geschäftsführung auf ihre eigene Adresse umlenken.
 */
export async function zugangNeuEinladen(
  employeeId: string,
  neueEmail: string | undefined,
  origin: string,
): Promise<{ email: string; emailSent: boolean; adresseGeaendert: boolean; kontoUmgestellt: boolean }> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) throw new Error('Mitarbeiter nicht gefunden')

  const bisher = employee.email.trim().toLowerCase()
  const email = (neueEmail ?? employee.email).trim().toLowerCase()
  if (!EMAIL_FORMAT.test(email)) throw new ZugangKonflikt('Ungültige E-Mail-Adresse', 400)
  // §183 An einen Platzhalter aus dem Einspielen der Belegschaft wird nicht
  // eingeladen — es käme nichts an, und dastehen würde „versendet".
  if (istPlatzhalter(email)) {
    throw new ZugangKonflikt(
      'Für diese Person ist noch keine E-Mail-Adresse hinterlegt. '
        + 'Tragen Sie zuerst die richtige Adresse ein — danach kann die Einladung raus.',
      400,
    )
  }
  const adresseGeaendert = email !== bisher

  const konten = await prisma.user.findMany({ where: { employeeId }, select: { id: true, role: true, email: true } })
  if (konten.some(k => k.role !== 'employee')) {
    throw new ZugangKonflikt(
      'Zu diesem Mitarbeiter gehört ein Leitungskonto. Dessen Anmeldung ändert nur OKUN.',
    )
  }
  // Zwei Konten für einen Menschen sind genau das, was der alte Weg erzeugen
  // konnte. Beide auf dieselbe Adresse zu setzen geht nicht (die Adresse ist
  // eindeutig), und welches gilt, kann nur jemand entscheiden, der hinsieht.
  if (adresseGeaendert && konten.length > 1) {
    throw new ZugangKonflikt(
      'Zu diesem Mitarbeiter gibt es mehr als ein Konto. Bitte OKUN melden — '
        + 'das muss zuerst zusammengeführt werden.',
    )
  }

  if (adresseGeaendert) {
    const [andererMitarbeiter, anderesKonto] = await Promise.all([
      prisma.employee.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, NOT: { id: employeeId } }, select: { id: true } }),
      prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, NOT: { employeeId } }, select: { id: true } }),
    ])
    if (andererMitarbeiter || anderesKonto) {
      throw new ZugangKonflikt('Diese E-Mail-Adresse ist bereits vergeben.')
    }
  }

  const jetzt = new Date()
  const invitation = await prisma.$transaction(async tx => {
    await tx.invitationToken.updateMany({
      where: { employeeId, usedAt: null, expiresAt: { gt: jetzt } },
      data: { expiresAt: jetzt },
    })
    if (adresseGeaendert) {
      await tx.employee.update({ where: { id: employeeId }, data: { email } })
      for (const konto of konten) {
        await tx.user.update({ where: { id: konto.id }, data: { email } })
      }
    }
    return tx.invitationToken.create({
      data: {
        token: generateSecureToken(),
        email,
        role: 'employee',
        name: employee.name,
        customerId: employee.customerId ?? undefined,
        employeeId,
        locationId: employee.locationId ?? undefined,
        expiresAt: invitationExpiry(),
      },
    })
  })

  let emailSent = true
  try {
    await sendInvitationEmail(origin, invitation)
  } catch {
    emailSent = false
  }

  const kontoUmgestellt = adresseGeaendert && konten.length > 0
  if (kontoUmgestellt) {
    for (const alt of Array.from(new Set(konten.map(k => k.email.trim().toLowerCase())))) {
      await sendEmail(
        alt,
        'Ihre E-Mail-Adresse bei OKUN Workforce wurde geändert',
        `Hallo ${employee.name},\n\nIhre Anmeldung bei OKUN Workforce läuft ab sofort über eine andere E-Mail-Adresse. `
          + `Die Änderung hat Ihre Leitung vorgenommen; an die neue Adresse ging eine Einladung, mit der Sie ein neues Passwort setzen.\n\n`
          + `Wenn Sie davon nichts wissen, wenden Sie sich bitte an Ihre Leitung.\n\nIhr OKUN Workforce Team`,
      ).catch(() => {})
    }
  }

  return { email, emailSent, adresseGeaendert, kontoUmgestellt }
}

/** §200 Wie steht es um den Zugang? Für die Anzeige neben der Adresse. */
export async function zugangsStand(employeeId: string) {
  const [employee, konto, einladung] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { email: true } }),
    prisma.user.findFirst({ where: { employeeId }, select: { id: true } }),
    prisma.invitationToken.findFirst({
      where: { employeeId, usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { email: true, expiresAt: true, createdAt: true },
    }),
  ])
  if (!employee) return null
  return {
    email: employee.email,
    konto: !!konto,
    einladung: einladung ? {
      email: einladung.email,
      versendetAm: einladung.createdAt.toISOString(),
      gueltigBis: einladung.expiresAt.toISOString(),
      abgelaufen: einladung.expiresAt <= new Date(),
    } : null,
  }
}

/** Erlaubt der Leitung, eine ausstehende oder abgelaufene Einladung erneut zu
 * versenden: erzeugt einen frischen Token (alter Link wird damit ungültig)
 * und eine neue Gültigkeitsfrist auf derselben Einladung, statt eine weitere
 * Zeile anzulegen. */
export async function resendInvitation(invitationId: string, origin: string): Promise<{ emailSent: boolean }> {
  const invitation = await prisma.invitationToken.findUnique({ where: { id: invitationId } })
  if (!invitation) throw new Error('Einladung nicht gefunden')
  if (invitation.usedAt) throw new Error('Einladung wurde bereits angenommen')

  const updated = await prisma.invitationToken.update({
    where: { id: invitationId },
    data: { token: generateSecureToken(), expiresAt: invitationExpiry() },
  })

  let emailSent = true
  try {
    await sendInvitationEmail(origin, updated)
  } catch {
    emailSent = false
  }
  return { emailSent }
}

/** Zieht eine noch nicht angenommene Einladung zurück, indem ihre Gültigkeit
 * sofort abläuft – der bereits verschickte Link funktioniert danach nicht mehr. */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const invitation = await prisma.invitationToken.findUnique({ where: { id: invitationId } })
  if (!invitation) throw new Error('Einladung nicht gefunden')
  if (invitation.usedAt) throw new Error('Einladung wurde bereits angenommen')

  await prisma.invitationToken.update({ where: { id: invitationId }, data: { expiresAt: new Date(0) } })
}

/** Legt Kunde und Einladung atomar in einer Transaktion an, damit nie ein Kunde
 * ohne zugehörige Einladung entsteht (oder umgekehrt). Siehe Kommentar bei
 * addEmployeeWithInvitation zur Begründung, warum dies in invitations.ts liegt. */
export async function addCustomerWithInvitation(
  input: { name: string; contactName: string; contactEmail: string; plan: string; seatsLicensed: number },
  origin: string,
): Promise<{ customer: Customer; emailSent: boolean }> {
  const { customerRow, invitation } = await prisma.$transaction(async tx => {
    const customerRow = await tx.customer.create({
      data: {
        name: input.name,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        status: 'trial',
        plan: input.plan,
        seatsLicensed: input.seatsLicensed,
        seatsUsed: 0,
        locationsCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
      },
    })
    const invitation = await tx.invitationToken.create({
      data: {
        token: generateSecureToken(),
        email: input.contactEmail.trim().toLowerCase(),
        role: 'company',
        name: input.contactName,
        customerName: input.name,
        customerId: customerRow.id,
        expiresAt: invitationExpiry(),
      },
    })
    return { customerRow, invitation }
  })

  let emailSent = true
  try {
    await sendInvitationEmail(origin, invitation)
  } catch {
    emailSent = false
  }

  return { customer: toCustomer(customerRow), emailSent }
}
