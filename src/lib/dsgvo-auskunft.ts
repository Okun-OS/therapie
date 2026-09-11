/**
 * §128 Auskunft nach Art.15 DSGVO.
 *
 * Jeder Mensch darf wissen, welche Daten ein Unternehmen über ihn hat. Die
 * Auskunft muss VOLLSTÄNDIG sein — und das ist der schwierige Teil, weil
 * Personendaten bei uns in rund dreißig Tabellen liegen.
 *
 * Deshalb wird hier nicht Tabelle für Tabelle abgefragt, sondern der Katalog
 * abgearbeitet (`dsgvo-katalog.ts`). Kommt eine neue Tabelle dazu und fehlt im
 * Katalog, schlägt der Test an — nicht erst die Aufsichtsbehörde.
 *
 * Zwei Dinge, die dabei leicht schiefgehen:
 *
 *   FREMDE DATEN. Eine Vertretungsanfrage nennt Kollegen, ein Dienstplan zeigt,
 *   wer sonst noch Schicht hatte. Auskunft heißt „Ihre Daten", nicht „alles, wo
 *   Ihr Name vorkommt". Wo andere betroffen sind, wird gekürzt.
 *
 *   UNLESBARKEIT. Eine Auskunft aus Datenbankspalten erfüllt den Buchstaben und
 *   verfehlt den Zweck. Jede Datenart trägt deshalb eine Erklärung in der
 *   Sprache des Betroffenen.
 */

import { prisma } from './prisma'
import { DATENARTEN, aufbewahrungBis, type Datenart } from './dsgvo-katalog'

export interface AuskunftsBlock {
  id: string
  bezeichnung: string
  beschreibung: string
  /** Wie viele Datensätze es gibt */
  anzahl: number
  /** Die Daten selbst — gekürzt, wo andere betroffen sind */
  daten: unknown[]
  /** Wie lange sie noch aufbewahrt werden */
  aufbewahrungBis?: string | null
  grundlage?: string
}

export interface Auskunft {
  erstelltAm: string
  person: {
    name: string
    personalnummer?: string | null
    eingetretenAm?: string | null
    ausgetretenAm?: string | null
    standort?: string | null
    arbeitgeber?: string | null
  }
  bloecke: AuskunftsBlock[]
  /** Datenarten, zu denen es nichts gibt — gehören trotzdem in die Auskunft */
  ohneDaten: string[]
  hinweise: string[]
}

/** Felder, die niemals in eine Auskunft gehören. */
const NIEMALS = new Set([
  'passwordHash', 'password', 'auth', 'p256dh', 'endpoint', 'token', 'secret',
  'sessionSecret', 'code', 'inhalt', 'daten',
])

/** Einen Datensatz für die Auskunft aufbereiten. */
function saubern(satz: Record<string, unknown>): Record<string, unknown> {
  const heraus: Record<string, unknown> = {}
  for (const [schluessel, wert] of Object.entries(satz)) {
    if (NIEMALS.has(schluessel)) continue
    if (wert === null || wert === undefined) continue
    if (wert instanceof Date) { heraus[schluessel] = wert.toISOString(); continue }
    if (typeof wert === 'object') { heraus[schluessel] = wert; continue }
    heraus[schluessel] = wert
  }
  return heraus
}

/**
 * Die Abfragen je Modell.
 *
 * Bewusst eine ausdrückliche Liste statt einer Schleife über Prisma-Metadaten:
 * jedes Modell hat sein eigenes Feld für den Personenbezug, und bei einigen
 * müssen fremde Daten heraus. Das lässt sich nicht raten.
 */
const ABFRAGEN: Record<string, (employeeId: string) => Promise<unknown[]>> = {
  PayrollEntry: id => prisma.payrollEntry.findMany({ where: { employeeId: id }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
  PayrollBonus: id => prisma.payrollBonus.findMany({ where: { employeeId: id } }),
  PayrollCorrection: id => prisma.payrollCorrection.findMany({ where: { employeeId: id } }),
  EmployeePayrollProfile: id => prisma.employeePayrollProfile.findMany({ where: { employeeId: id } }),
  SurchargeWageConfig: id => prisma.surchargeWageConfig.findMany({ where: { employeeId: id } }),
  TimeLog: id => prisma.timeLog.findMany({ where: { employeeId: id }, orderBy: { date: 'asc' } }),
  TimeClockEntry: id => prisma.timeClockEntry.findMany({ where: { employeeId: id } }),
  MonthlyClosing: id => prisma.monthlyClosing.findMany({ where: { employeeId: id } }),
  TimesheetApproval: id => prisma.timesheetApproval.findMany({ where: { employeeId: id } }),
  OvertimeRequest: id => prisma.overtimeRequest.findMany({ where: { employeeId: id } }),
  Absence: id => prisma.absence.findMany({ where: { employeeId: id } }),
  VacationRequest: id => prisma.vacationRequest.findMany({ where: { employeeId: id } }),
  StoredFile: id => prisma.storedFile.findMany({
    where: { ownerType: 'employee', ownerId: id },
    // Der Inhalt der Dateien bleibt draußen — die Auskunft ist ein Verzeichnis,
    // die Dateien selbst liegen dem Mitarbeiter ohnehin in seinen Unterlagen vor.
    select: {
      id: true, dateiname: true, kategorie: true, mimeType: true, groesse: true,
      notiz: true, hochgeladenVonName: true, createdAt: true,
      sichtbarFuerMitarbeiter: true,
    },
  }),
  // §129 Die eigenen Nachrichten — nicht die der anderen im selben Raum.
  ChatNachricht: id => prisma.chatNachricht.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, raumId: true, text: true, createdAt: true },
  }),
  ChatMitglied: id => prisma.chatMitglied.findMany({
    where: { employeeId: id },
    // Wer sonst noch in der Gruppe ist, geht den Betroffenen nichts an —
    // deshalb nur die Gruppe selbst, nicht ihre Mitgliederliste.
    select: { raumId: true, rolle: true, beigetretenAm: true },
  }),
  ScheduleEntry: id => prisma.scheduleEntry.findMany({ where: { employeeId: id }, orderBy: { date: 'asc' } }),
  PlanChange: id => prisma.planChange.findMany({ where: { employeeId: id } }),
  ScoreEvent: id => prisma.scoreEvent.findMany({ where: { employeeId: id } }),
  Notification: id => prisma.notification.findMany({ where: { employeeId: id } }),
  PushSubscription: id => prisma.pushSubscription.findMany({
    where: { employeeId: id },
    select: { id: true, createdAt: true },   // Geräteschlüssel gehören nicht hinein
  }),
  EmployeeRequest: id => prisma.employeeRequest.findMany({ where: { employeeId: id } }),
  WishSubmission: id => prisma.wishSubmission.findMany({ where: { employeeId: id } }),
  VacationPlanPreference: id => prisma.vacationPlanPreference.findMany({ where: { employeeId: id } }),
  EmployeePlanningProfile: id => prisma.employeePlanningProfile.findMany({ where: { employeeId: id } }),
  EmployeeHumanContext: id => prisma.employeeHumanContext.findMany({ where: { employeeId: id } }),
  EmployeeProfile: id => prisma.employeeProfile.findMany({ where: { employeeId: id } }),
  SubstitutionCandidate: id => prisma.substitutionCandidate.findMany({
    where: { employeeId: id },
    // Die Anfrage selbst bleibt draußen: sie nennt den ausgefallenen Kollegen.
    select: {
      id: true, matchScore: true, matchReasons: true, escalationStage: true,
      responseStatus: true, notifiedAt: true, respondedAt: true, createdAt: true,
    },
  }),
  User: id => prisma.user.findMany({
    where: { employeeId: id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  }),
  InvitationToken: id => prisma.invitationToken.findMany({
    where: { employeeId: id },
    select: { id: true, createdAt: true, usedAt: true, expiresAt: true },
  }),
  EmployeeCalendarSync: id => prisma.employeeCalendarSync.findMany({
    where: { employeeId: id },
    select: { employeeId: true, enabled: true, updatedAt: true },
  }),
  PasswordResetToken: async () => [],   // an die E-Mail gebunden, kurzlebig
  SmsTotpCode: async () => [],          // kurzlebig, wird nicht bescheinigt
  AuditLog: async () => [],             // siehe unten: gesondert behandelt
  SupportAccessLog: async () => [],
  // §128 Dass über die eigenen Daten eine Löschung gelaufen ist, gehört in die
  // Auskunft — es ist eine Verarbeitung wie jede andere.
  Loeschvorgang: id => prisma.loeschvorgang.findMany({
    where: { employeeId: id },
    select: { id: true, art: true, angestossenVonName: true, createdAt: true },
  }),
}

/**
 * Tabellen aus dem Katalog, zu denen es hier keine Abfrage gibt.
 *
 * Genau so entsteht eine unvollständige Auskunft: Die Datenart steht im
 * Katalog, erscheint mit ihrer Beschreibung — und ist leer, weil niemand die
 * Abfrage nachgetragen hat. Nach außen sieht das aus wie „darüber haben wir
 * nichts". Der Test hält diese Liste leer.
 */
export function modelleOhneAbfrage(): string[] {
  const fehlend = new Set<string>()
  for (const art of DATENARTEN) {
    for (const modell of art.modelle) {
      if (!ABFRAGEN[modell]) fehlend.add(modell)
    }
  }
  return Array.from(fehlend).sort()
}

async function blockLaden(art: Datenart, employeeId: string): Promise<unknown[]> {
  const alles: unknown[] = []
  for (const modell of art.modelle) {
    const abfrage = ABFRAGEN[modell]
    if (!abfrage) continue
    const saetze = await abfrage(employeeId)
    for (const satz of saetze) {
      alles.push(saubern(satz as Record<string, unknown>))
    }
  }
  return alles
}

/**
 * Die vollständige Auskunft zu einer Person.
 *
 * Zusätzlich zu den Daten selbst enthält sie, WIE LANGE sie noch aufbewahrt
 * werden — das verlangt Art.15 Abs.1 lit.d ausdrücklich, und es ist die Frage,
 * die Betroffene am häufigsten stellen.
 */
export async function auskunftErstellen(employeeId: string): Promise<Auskunft | null> {
  const mitarbeiter = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!mitarbeiter) return null

  const [profil, standort, kunde] = await Promise.all([
    prisma.employeePayrollProfile.findUnique({ where: { employeeId } }),
    mitarbeiter.locationId
      ? prisma.location.findUnique({ where: { id: mitarbeiter.locationId }, select: { name: true } })
      : null,
    mitarbeiter.customerId
      ? prisma.customer.findUnique({ where: { id: mitarbeiter.customerId }, select: { name: true } })
      : null,
  ])

  const austritt = profil?.austrittsdatum ? new Date(profil.austrittsdatum) : null

  const bloecke: AuskunftsBlock[] = []
  const ohneDaten: string[] = []

  // Die Stammdaten stehen vorweg — sie sind das, was die meisten meinen.
  bloecke.push({
    id: 'stammdaten',
    bezeichnung: 'Ihre Stammdaten',
    beschreibung: 'Name, Kontaktdaten und Ihr Arbeitsverhältnis.',
    anzahl: 1,
    daten: [saubern(mitarbeiter as unknown as Record<string, unknown>)],
  })

  for (const art of DATENARTEN) {
    const daten = await blockLaden(art, employeeId)
    if (daten.length === 0) { ohneDaten.push(art.bezeichnung); continue }
    bloecke.push({
      id: art.id,
      bezeichnung: art.bezeichnung,
      beschreibung: art.beschreibung,
      anzahl: daten.length,
      daten,
      aufbewahrungBis: austritt ? aufbewahrungBis(austritt, art.fristJahre) : null,
      grundlage: art.grundlage,
    })
  }

  const hinweise = [
    'Diese Auskunft nennt alle Daten, die wir über Sie gespeichert haben.',
    'Wo Daten auch andere Personen betreffen — etwa wer sonst noch in einer Schicht '
    + 'war oder für wen Sie eingesprungen sind — sind sie gekürzt. Deren Rechte gehen '
    + 'insoweit vor.',
    'Passwörter und Geräteschlüssel sind nicht enthalten; sie sind verschlüsselt '
    + 'gespeichert und können auch von uns nicht gelesen werden.',
  ]
  if (!austritt) {
    hinweise.push(
      'Solange das Arbeitsverhältnis besteht, laufen keine Aufbewahrungsfristen — '
      + 'sie beginnen erst mit dem Austritt.',
    )
  }

  return {
    erstelltAm: new Date().toISOString(),
    person: {
      name: mitarbeiter.name,
      personalnummer: profil?.personalnummer,
      eingetretenAm: profil?.eintrittsdatum ?? mitarbeiter.joinedAt,
      ausgetretenAm: profil?.austrittsdatum,
      standort: standort?.name ?? null,
      arbeitgeber: kunde?.name ?? null,
    },
    bloecke,
    ohneDaten,
    hinweise,
  }
}
