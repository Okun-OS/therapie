/**
 * §128 Löschen — und das, was dabei nicht gelöscht werden darf.
 *
 * Ein Löschknopf, der einfach alles entfernt, ist kein Datenschutz, sondern ein
 * Haftungsfall. Lohnunterlagen müssen sechs Jahre bleiben, Buchungsbelege zehn,
 * Arbeitszeitnachweise zwei. Wer sie auf Zuruf löscht, kann bei der nächsten
 * Betriebsprüfung nichts vorlegen — und dem Mitarbeiter fehlt später der
 * Nachweis seiner eigenen Beiträge.
 *
 * Deshalb arbeitet dieser Ablauf in drei Stufen, je Datenart entschieden im
 * Katalog (`dsgvo-katalog.ts`):
 *
 *   LÖSCHEN         Alles ohne Aufbewahrungspflicht verschwindet sofort und
 *                   endgültig: Wünsche, Nachrichten, Punkte, der Zugang.
 *
 *   ANONYMISIEREN   Der Dienstplan bleibt dem Betrieb erhalten, aber ohne
 *                   Namen. Dazu bekommen die Einträge eine Zufallskennung, die
 *                   NIRGENDS gespeichert wird — die Verbindung zur Person ist
 *                   damit zerstört und nicht wiederherstellbar. Genau das
 *                   unterscheidet Anonymisierung von Pseudonymisierung.
 *
 *   SPERREN         Lohn, Zeiten, Fehlzeiten und Personalakte bleiben, werden
 *                   aber nach Art.18 DSGVO gesperrt: sie dürfen nur noch für
 *                   den Zweck verwendet werden, für den das Gesetz sie
 *                   verlangt. Läuft die Frist ab, entfernt derselbe Ablauf sie
 *                   endgültig — dafür ist `aufraeumen()` da.
 *
 * Zwei Schutzmaßnahmen sind bewusst eingebaut:
 *
 *   Ohne Austrittsdatum läuft gar nichts. Solange jemand beschäftigt ist, gibt
 *   es keinen Grund, seine Daten zu entfernen — und jeder Versuch wäre ein
 *   Versehen.
 *
 *   Jede Löschung hinterlässt einen Bericht (`Loeschvorgang`). Er enthält keine
 *   Personendaten, nur Zahlen und Begründungen. Ohne ihn lässt sich später
 *   weder belegen, dass gelöscht wurde, noch warum etwas bleiben musste.
 */

import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { DATENARTEN, aufbewahrungBis, type Behandlung, type Datenart } from './dsgvo-katalog'

type DB = Prisma.TransactionClient

/** Was über die Person bekannt sein muss, um sie überall zu finden. */
interface Kontext {
  employeeId: string
  email: string
  /** Benutzerkonten der Person — manche Tabellen hängen am Konto, nicht am Mitarbeiter */
  userIds: string[]
  /** Zufallskennung für die Anonymisierung; wird nirgends gespeichert */
  pseudonym: string
}

interface Zugriff {
  zaehlen(db: DB, k: Kontext): Promise<number>
  loeschen(db: DB, k: Kontext): Promise<number>
  anonymisieren?(db: DB, k: Kontext): Promise<number>
}

const zahl = (r: { count: number }) => r.count

/**
 * Je Tabelle: wie man die Daten der Person findet, zählt, löscht.
 *
 * Bewusst ausgeschrieben statt über Prisma-Metadaten geraten: jede Tabelle
 * hängt anders an der Person, und bei dreien muss beim Anonymisieren mehr
 * geschehen als nur die Kennung zu tauschen.
 */
const ZUGRIFF: Record<string, Zugriff> = {
  PayrollEntry: {
    zaehlen: (db, k) => db.payrollEntry.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.payrollEntry.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  PayrollBonus: {
    zaehlen: (db, k) => db.payrollBonus.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.payrollBonus.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  PayrollCorrection: {
    zaehlen: (db, k) => db.payrollCorrection.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.payrollCorrection.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  EmployeePayrollProfile: {
    zaehlen: (db, k) => db.employeePayrollProfile.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.employeePayrollProfile.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  SurchargeWageConfig: {
    zaehlen: (db, k) => db.surchargeWageConfig.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.surchargeWageConfig.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  TimeLog: {
    zaehlen: (db, k) => db.timeLog.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.timeLog.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  TimeClockEntry: {
    zaehlen: (db, k) => db.timeClockEntry.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.timeClockEntry.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  MonthlyClosing: {
    zaehlen: (db, k) => db.monthlyClosing.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.monthlyClosing.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  TimesheetApproval: {
    zaehlen: (db, k) => db.timesheetApproval.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.timesheetApproval.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  OvertimeRequest: {
    zaehlen: (db, k) => db.overtimeRequest.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.overtimeRequest.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  Absence: {
    zaehlen: (db, k) => db.absence.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.absence.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  VacationRequest: {
    zaehlen: (db, k) => db.vacationRequest.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.vacationRequest.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  StoredFile: {
    zaehlen: (db, k) => db.storedFile.count({ where: { ownerType: 'employee', ownerId: k.employeeId } }),
    // Hart löschen, nicht nur markieren: eine Datei, die als gelöscht gilt und
    // trotzdem im Speicher liegt, ist nicht gelöscht.
    loeschen: (db, k) => db.storedFile.deleteMany({
      where: { ownerType: 'employee', ownerId: k.employeeId },
    }).then(zahl),
  },
  ScheduleEntry: {
    zaehlen: (db, k) => db.scheduleEntry.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.scheduleEntry.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
    // Notiz und Grund können freien Text über die Person enthalten — sie gehen
    // mit, sonst bliebe der Name im Klartext in einem „anonymen" Eintrag stehen.
    anonymisieren: (db, k) => db.scheduleEntry.updateMany({
      where: { employeeId: k.employeeId },
      data: { employeeId: k.pseudonym, note: null, reason: null },
    }).then(zahl),
  },
  PlanChange: {
    zaehlen: (db, k) => db.planChange.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.planChange.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
    anonymisieren: (db, k) => db.planChange.updateMany({
      where: { employeeId: k.employeeId },
      data: { employeeId: k.pseudonym, reason: null },
    }).then(zahl),
  },
  ChatNachricht: {
    zaehlen: (db, k) => db.chatNachricht.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.chatNachricht.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  ChatMitglied: {
    zaehlen: (db, k) => db.chatMitglied.count({ where: { employeeId: k.employeeId } }),
    /**
     * Erst die Gespräche zu zweit ganz weg, dann die restlichen
     * Mitgliedschaften.
     *
     * Ein Direktchat, aus dem eine der beiden Personen gelöscht ist, wäre ein
     * einseitiger Verlauf, der ausschließlich von ihr handelt — mit ihrem
     * Namen in jeder Zeile der Gegenseite. Der bleibt nicht stehen. In Gruppen
     * ist es umgekehrt: dort gehören die übrigen Beiträge anderen Menschen und
     * werden nicht angerührt.
     */
    loeschen: async (db, k) => {
      const direkte = await db.chatMitglied.findMany({
        where: { employeeId: k.employeeId, raum: { art: 'direkt' } },
        select: { raumId: true },
      })
      const raumIds = direkte.map(d => d.raumId)
      if (raumIds.length > 0) {
        await db.chatNachricht.deleteMany({ where: { raumId: { in: raumIds } } })
        await db.chatMitglied.deleteMany({ where: { raumId: { in: raumIds } } })
        await db.chatRaum.deleteMany({ where: { id: { in: raumIds } } })
      }
      const rest = await db.chatMitglied.deleteMany({ where: { employeeId: k.employeeId } })
      return raumIds.length + rest.count
    },
  },
  ScoreEvent: {
    zaehlen: (db, k) => db.scoreEvent.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.scoreEvent.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  Notification: {
    zaehlen: (db, k) => db.notification.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.notification.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  PushSubscription: {
    zaehlen: (db, k) => db.pushSubscription.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.pushSubscription.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  EmployeeRequest: {
    zaehlen: (db, k) => db.employeeRequest.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.employeeRequest.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  WishSubmission: {
    zaehlen: (db, k) => db.wishSubmission.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.wishSubmission.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  VacationPlanPreference: {
    zaehlen: (db, k) => db.vacationPlanPreference.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.vacationPlanPreference.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  EmployeePlanningProfile: {
    zaehlen: (db, k) => db.employeePlanningProfile.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.employeePlanningProfile.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  EmployeeHumanContext: {
    zaehlen: (db, k) => db.employeeHumanContext.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.employeeHumanContext.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  EmployeeProfile: {
    zaehlen: (db, k) => db.employeeProfile.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.employeeProfile.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  SubstitutionCandidate: {
    zaehlen: (db, k) => db.substitutionCandidate.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.substitutionCandidate.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  User: {
    zaehlen: (db, k) => db.user.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.user.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  InvitationToken: {
    zaehlen: (db, k) => db.invitationToken.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.invitationToken.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  EmployeeCalendarSync: {
    zaehlen: (db, k) => db.employeeCalendarSync.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.employeeCalendarSync.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
  // Hängt an der E-Mail-Adresse, nicht am Mitarbeiter.
  PasswordResetToken: {
    zaehlen: (db, k) => db.passwordResetToken.count({ where: { email: k.email } }),
    loeschen: (db, k) => db.passwordResetToken.deleteMany({ where: { email: k.email } }).then(zahl),
  },
  // Hängt am Benutzerkonto.
  SmsTotpCode: {
    zaehlen: (db, k) => k.userIds.length ? db.smsTotpCode.count({ where: { userId: { in: k.userIds } } }) : Promise.resolve(0),
    loeschen: (db, k) => k.userIds.length
      ? db.smsTotpCode.deleteMany({ where: { userId: { in: k.userIds } } }).then(zahl)
      : Promise.resolve(0),
  },
  AuditLog: {
    zaehlen: (db, k) => db.auditLog.count({ where: auditWo(k) }),
    loeschen: (db, k) => db.auditLog.deleteMany({ where: auditWo(k) }).then(zahl),
  },
  SupportAccessLog: {
    zaehlen: (db, k) => db.supportAccessLog.count({ where: { resource: { contains: k.employeeId } } }),
    loeschen: (db, k) => db.supportAccessLog.deleteMany({
      where: { resource: { contains: k.employeeId } },
    }).then(zahl),
  },
  Loeschvorgang: {
    zaehlen: (db, k) => db.loeschvorgang.count({ where: { employeeId: k.employeeId } }),
    loeschen: (db, k) => db.loeschvorgang.deleteMany({ where: { employeeId: k.employeeId } }).then(zahl),
  },
}

/**
 * Tabellen aus dem Katalog, für die es hier keinen Zugriff gibt.
 *
 * Das ist der gefährlichste stille Fehler dieses Ablaufs: eine Datenart steht
 * im Katalog, wird in der Auskunft aufgeführt — und beim Löschen übersprungen,
 * weil niemand eine Abfrage dafür geschrieben hat. Der Test hält die Liste
 * leer.
 */
export function modelleOhneZugriff(): string[] {
  const fehlend = new Set<string>()
  for (const art of DATENARTEN) {
    for (const modell of art.modelle) {
      if (!ZUGRIFF[modell]) fehlend.add(modell)
    }
  }
  return Array.from(fehlend).sort()
}

/** Datenarten, die anonymisiert werden, aber keine Anonymisierung können. */
export function anonymisierungOhneVerfahren(): string[] {
  const fehlend: string[] = []
  for (const art of DATENARTEN.filter(a => a.behandlung === 'anonymisieren')) {
    for (const modell of art.modelle) {
      if (!ZUGRIFF[modell]?.anonymisieren) fehlend.push(`${art.id}/${modell}`)
    }
  }
  return fehlend
}

/** Im Protokoll steht die Person entweder als Handelnde oder als Betroffene. */
function auditWo(k: Kontext): Prisma.AuditLogWhereInput {
  const oder: Prisma.AuditLogWhereInput[] = [{ entityId: k.employeeId }]
  if (k.userIds.length) oder.push({ userId: { in: k.userIds } })
  return { OR: oder }
}

// ── Vorschau ───────────────────────────────────────────────────────────────

export interface DatenartBefund {
  id: string
  bezeichnung: string
  beschreibung: string
  behandlung: Behandlung
  anzahl: number
  fristJahre: number
  grundlage?: string
  begruendung: string
  aufbewahrungBis: string | null
  /** Darf zum Stichtag tatsächlich entfernt werden */
  frei: boolean
}

export interface LoeschPruefung {
  employeeId: string
  name: string
  ausgetretenAm: string | null
  gesperrtSeit: string | null
  befunde: DatenartBefund[]
  /** Was einer Löschung entgegensteht — leer heißt: kann ausgeführt werden */
  hindernisse: string[]
  /** Ab wann restlos alles entfernt werden darf */
  restlosAb: string | null
  /** Datensätze insgesamt, aufgeteilt nach dem, was geschieht */
  summe: { geloescht: number; anonymisiert: number; gesperrt: number }
}

async function kontextLaden(employeeId: string): Promise<Kontext | null> {
  const mitarbeiter = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, email: true },
  })
  if (!mitarbeiter) return null
  const konten = await prisma.user.findMany({
    where: { employeeId }, select: { id: true },
  })
  return {
    employeeId,
    email: mitarbeiter.email,
    userIds: konten.map(u => u.id),
    pseudonym: `anonym-${randomBytes(9).toString('hex')}`,
  }
}

async function anzahlJeArt(k: Kontext, art: Datenart): Promise<number> {
  let summe = 0
  for (const modell of art.modelle) {
    const zugriff = ZUGRIFF[modell]
    if (!zugriff) continue
    summe += await zugriff.zaehlen(prisma, k)
  }
  return summe
}

/**
 * Was würde geschehen — ohne dass etwas geschieht.
 *
 * Diese Vorschau ist nicht nur eine Bequemlichkeit. Eine Löschung lässt sich
 * nicht zurücknehmen; wer sie auslöst, muss vorher gesehen haben, was bleibt
 * und warum.
 */
export async function loeschPruefung(
  employeeId: string,
  stichtag: Date = new Date(),
): Promise<LoeschPruefung | null> {
  const mitarbeiter = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!mitarbeiter) return null
  const k = await kontextLaden(employeeId)
  if (!k) return null

  const profil = await prisma.employeePayrollProfile.findUnique({ where: { employeeId } })
  const austritt = profil?.austrittsdatum ? new Date(profil.austrittsdatum) : null

  const befunde: DatenartBefund[] = []
  const summe = { geloescht: 0, anonymisiert: 0, gesperrt: 0 }
  let spaetestesEnde: string | null = null

  for (const art of DATENARTEN) {
    const anzahl = await anzahlJeArt(k, art)
    const ende = austritt ? aufbewahrungBis(austritt, art.fristJahre) : null
    const frei = art.fristJahre === 0 ? true : !!ende && stichtag.toISOString().slice(0, 10) > ende

    if (art.fristJahre > 0 && (!ende || !frei)) {
      if (!spaetestesEnde || (ende && ende > spaetestesEnde)) spaetestesEnde = ende
    }

    befunde.push({
      id: art.id,
      bezeichnung: art.bezeichnung,
      beschreibung: art.beschreibung,
      behandlung: art.behandlung,
      anzahl,
      fristJahre: art.fristJahre,
      grundlage: art.grundlage,
      begruendung: art.begruendung,
      aufbewahrungBis: ende,
      frei,
    })

    if (frei && art.behandlung !== 'anonymisieren') summe.geloescht += anzahl
    else if (art.behandlung === 'anonymisieren') summe.anonymisiert += anzahl
    else summe.gesperrt += anzahl
  }

  const hindernisse: string[] = []
  if (!austritt) {
    hindernisse.push(
      'Es ist kein Austrittsdatum hinterlegt. Ohne Austritt beginnt keine '
      + 'Aufbewahrungsfrist, und es gibt keinen Grund, Daten zu entfernen. '
      + 'Tragen Sie das Austrittsdatum in den Lohnstammdaten ein.',
    )
  }
  if (mitarbeiter.active) {
    hindernisse.push(
      'Der Mitarbeiter ist noch als aktiv geführt. Setzen Sie ihn zuerst auf '
      + 'inaktiv — sonst wird jemand gelöscht, der noch beschäftigt ist.',
    )
  }

  return {
    employeeId,
    name: mitarbeiter.name,
    ausgetretenAm: profil?.austrittsdatum ?? null,
    gesperrtSeit: mitarbeiter.datenGesperrtAm
      ? mitarbeiter.datenGesperrtAm.toISOString().slice(0, 10) : null,
    befunde,
    hindernisse,
    restlosAb: spaetestesEnde,
    summe,
  }
}

// ── Ausführung ─────────────────────────────────────────────────────────────

export type Ergebnisart = 'geloescht' | 'anonymisiert' | 'gesperrt' | 'nichts'

export interface LoeschZeile {
  id: string
  bezeichnung: string
  behandlung: Behandlung
  ergebnis: Ergebnisart
  anzahl: number
  begruendung: string
  aufbewahrungBis: string | null
}

export interface Loeschbericht {
  employeeId: string
  name: string
  ausgefuehrtAm: string
  ausgefuehrtVon: string
  art: 'loeschung' | 'aufraeumen'
  ausgetretenAm: string | null
  zeilen: LoeschZeile[]
  /** Der Mitarbeiterdatensatz selbst */
  person: Ergebnisart
  restlosAb: string | null
}

interface AusfuehrenOptionen {
  angestossenVon: string
  angestossenVonName?: string | null
  art?: 'loeschung' | 'aufraeumen'
  stichtag?: Date
}

/** Felder, die nach dem Austritt niemand mehr braucht. */
async function stammdatenKuerzen(db: DB, employeeId: string) {
  await db.employee.update({
    where: { id: employeeId },
    // Prisma.DbNull, nicht null: bei einem Json-Feld hieße `null` „nicht
    // anfassen" — die Vorlieben wären stehen geblieben.
    data: {
      phone: null, avatarUrl: null, active: false,
      preferences: Prisma.DbNull,
      qualifications: [], allowedTasks: [],
    },
  })
  // Anschrift und Bankverbindung: die Abrechnungen sind längst erzeugt und
  // liegen als Beleg in der Akte. Für die Aufbewahrung werden sie nicht mehr
  // gebraucht — also gehen sie.
  await db.employeePayrollProfile.updateMany({
    where: { employeeId },
    data: {
      strasse: null, plz: null, ort: null,
      iban: null, bic: null, kontoinhaber: null,
      notiz: null,
    },
  })
}

/**
 * Die Löschung ausführen.
 *
 * Alles in einer Transaktion: eine halb gelöschte Person wäre schlimmer als
 * eine ungelöschte — man wüsste nicht mehr, was noch fehlt.
 */
export async function loeschungAusfuehren(
  employeeId: string,
  optionen: AusfuehrenOptionen,
): Promise<Loeschbericht> {
  const stichtag = optionen.stichtag ?? new Date()
  const pruefung = await loeschPruefung(employeeId, stichtag)
  if (!pruefung) throw new Error('Mitarbeiter nicht gefunden')
  if (pruefung.hindernisse.length > 0) {
    throw new Error(pruefung.hindernisse.join(' '))
  }

  const k = await kontextLaden(employeeId)
  if (!k) throw new Error('Mitarbeiter nicht gefunden')

  const kunde = await prisma.employee.findUnique({
    where: { id: employeeId }, select: { customerId: true },
  })

  const zeilen: LoeschZeile[] = []
  let bleibtEtwas = false

  await prisma.$transaction(async db => {
    for (const art of DATENARTEN) {
      const befund = pruefung.befunde.find(b => b.id === art.id)!
      let ergebnis: Ergebnisart = 'nichts'
      let anzahl = 0

      if (art.behandlung === 'anonymisieren') {
        for (const modell of art.modelle) {
          const zugriff = ZUGRIFF[modell]
          if (!zugriff) continue
          anzahl += zugriff.anonymisieren
            ? await zugriff.anonymisieren(db, k)
            : await zugriff.loeschen(db, k)
        }
        ergebnis = anzahl > 0 ? 'anonymisiert' : 'nichts'
      } else if (befund.frei) {
        for (const modell of art.modelle) {
          const zugriff = ZUGRIFF[modell]
          if (!zugriff) continue
          anzahl += await zugriff.loeschen(db, k)
        }
        ergebnis = anzahl > 0 ? 'geloescht' : 'nichts'
      } else {
        anzahl = befund.anzahl
        ergebnis = 'gesperrt'
        if (anzahl > 0) bleibtEtwas = true
      }

      zeilen.push({
        id: art.id,
        bezeichnung: art.bezeichnung,
        behandlung: art.behandlung,
        ergebnis,
        anzahl,
        begruendung: art.begruendung,
        aufbewahrungBis: befund.aufbewahrungBis,
      })
    }

    if (bleibtEtwas) {
      await stammdatenKuerzen(db, employeeId)
      await db.employee.update({
        where: { id: employeeId },
        data: {
          datenGesperrtAm: stichtag,
          datenGesperrtGrund:
            'Gelöscht am ' + stichtag.toISOString().slice(0, 10) + '. '
            + 'Lohn-, Zeit- und Steuerunterlagen bleiben bis zum Ablauf der '
            + 'gesetzlichen Aufbewahrungsfristen gesperrt aufbewahrt '
            + '(Art.18 DSGVO).',
        },
      })
    }
  }, { timeout: 60_000 })

  const bericht: Loeschbericht = {
    employeeId,
    name: pruefung.name,
    ausgefuehrtAm: stichtag.toISOString(),
    ausgefuehrtVon: optionen.angestossenVonName ?? optionen.angestossenVon,
    art: optionen.art ?? 'loeschung',
    ausgetretenAm: pruefung.ausgetretenAm,
    zeilen,
    person: bleibtEtwas ? 'gesperrt' : 'geloescht',
    restlosAb: pruefung.restlosAb,
  }

  // Der Nachweis wird NACH der Transaktion geschrieben: räumt der Lauf die
  // abgelaufenen Protokolle mit ab, würde er sich sonst selbst mitnehmen.
  await prisma.loeschvorgang.create({
    data: {
      employeeId,
      customerId: kunde?.customerId ?? null,
      personName: pruefung.name,
      art: bericht.art,
      angestossenVon: optionen.angestossenVon,
      angestossenVonName: optionen.angestossenVonName ?? null,
      bericht: bericht as unknown as Prisma.InputJsonValue,
    },
  })

  // Bleibt nichts mehr, kann auch der Mitarbeiterdatensatz gehen. Der Nachweis
  // trägt nur noch Name und Zahlen — das ist die Rechenschaft, die Art.5 Abs.2
  // DSGVO verlangt, und ohne sie stünde am Ende gar nichts mehr.
  if (!bleibtEtwas) {
    await prisma.employee.delete({ where: { id: employeeId } }).catch(() => undefined)
  }

  return bericht
}

/**
 * Abgelaufene Fristen aufräumen.
 *
 * Aufbewahren ist eine Pflicht, keine Erlaubnis: läuft die Frist ab, muss
 * gelöscht werden. Diese Funktion sucht alle gesperrten Personen, bei denen
 * inzwischen etwas frei geworden ist, und räumt es weg.
 *
 * Gedacht als jährlicher Lauf. Sie tut nichts, was nicht schon vorher
 * feststand — deshalb ist sie gefahrlos wiederholbar.
 */
export async function aufraeumen(
  angestossenVon: string,
  stichtag: Date = new Date(),
): Promise<Loeschbericht[]> {
  const gesperrte = await prisma.employee.findMany({
    where: { datenGesperrtAm: { not: null } },
    select: { id: true },
  })

  const berichte: Loeschbericht[] = []
  for (const { id } of gesperrte) {
    const pruefung = await loeschPruefung(id, stichtag)
    if (!pruefung) continue
    // Nur anfassen, wenn etwas frei geworden ist, das noch da ist.
    const etwasFrei = pruefung.befunde.some(
      b => b.frei && b.anzahl > 0 && b.behandlung === 'sperren',
    )
    if (!etwasFrei) continue
    berichte.push(await loeschungAusfuehren(id, {
      angestossenVon,
      angestossenVonName: 'Automatischer Jahreslauf',
      art: 'aufraeumen',
      stichtag,
    }))
  }
  return berichte
}
