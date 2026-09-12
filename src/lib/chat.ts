/**
 * §129/§131 Nachrichten im Betrieb.
 *
 * Bisher gab es nur Benachrichtigungen in eine Richtung und Support-Tickets an
 * OKUN. Wer einer Kollegin schreiben wollte, hat das Programm verlassen und
 * WhatsApp genommen — mit Dienstplänen, Krankmeldungen und Namen auf privaten
 * Telefonen. Genau das soll dieses Modul überflüssig machen.
 *
 * §131 DER TEILNEHMER IST DAS BENUTZERKONTO, nicht der Mitarbeiterdatensatz.
 *
 * Die erste Fassung hing am Mitarbeiter — und fiel im Betrieb sofort um: eine
 * Standortleitung und erst recht eine Geschäftsführung haben ein Konto, aber
 * nicht zwingend einen Mitarbeiterdatensatz. Beide bekamen „Dieser Zugang ist
 * keinem Mitarbeiter zugeordnet" zu sehen und konnten niemanden anschreiben —
 * ausgerechnet die zwei Rollen, die am meisten zu kommunizieren haben.
 *
 * Die Mitarbeiterkennung wird trotzdem mitgeschrieben, wo es eine gibt: nur
 * über sie findet eine Löschung nach Art.17 DSGVO die Nachrichten wieder.
 *
 * Die weiteren Entscheidungen, die alles andere bestimmen:
 *
 *   WER WEN ERREICHT. Jeder erreicht jeden an seinem Standort, dazu die
 *   Unternehmensebene. Nicht das ganze Unternehmen quer über alle Häuser: in
 *   einem Betrieb mit acht Standorten hat der Kollege aus dem anderen Ort
 *   nichts mit einem zu tun, und eine Suchliste über alle wäre selbst schon
 *   eine Preisgabe. Leitung und Unternehmen erreichen ihren Bereich — dieselbe
 *   Grenze wie überall sonst (`scope.ts`).
 *
 *   MITLESEN IST NICHT VERWALTEN. Standortleitung und Unternehmen eröffnen
 *   Gruppen, setzen Mitglieder und schließen sie wieder. Lesen können sie nur,
 *   was in Gruppen steht, in denen sie selbst Mitglied sind — und ein Beitritt
 *   hinterlässt einen sichtbaren Hinweis im Verlauf. Ein Vorgesetzter, der
 *   unbemerkt mitliest, wäre keine Funktion, sondern ein Vertrauensbruch.
 *
 *   DIREKTCHATS SIND UNANTASTBAR. Ein Gespräch zwischen zwei Personen ist für
 *   niemanden sonst einsehbar — auch nicht für OKUN. Plattformzugänge bleiben
 *   deshalb ganz draußen: sie gehören zu keinem Kunden.
 */

import { prisma } from './prisma'
import type { SessionPayload } from './session'
import { resolveCustomerId } from './session'
import { allowedLocationScope } from './scope'

/** Wie lang eine Nachricht sein darf. */
export const MAX_ZEICHEN = 4000

/** Absender von Systemhinweisen im Verlauf. */
export const SYSTEM = 'system'

export interface ChatPerson {
  /** Die Kennung, mit der gearbeitet wird: das Benutzerkonto */
  userId: string
  name: string
  /** employee | admin | company — bestimmt nur, was daneben steht */
  rolle: string
  rollenText: string
  standort?: string | null
  employeeId?: string | null
  position?: string | null
}

export interface RaumListe {
  id: string
  art: 'direkt' | 'gruppe'
  /** Anzeigename: bei Direktchats der Name des Gegenübers */
  titel: string
  beschreibung?: string | null
  archiviert: boolean
  mitgliederAnzahl: number
  darfVerwalten: boolean
  letzteNachricht?: { text: string; absenderName: string; createdAt: string; art: string } | null
  ungelesen: number
  letzteAktivitaet: string
}

export const ROLLEN_TEXT: Record<string, string> = {
  employee: 'Mitarbeiter',
  admin: 'Standortleitung',
  company: 'Unternehmen',
  okun: 'OKUN',
}

/**
 * Die Kennung der Sitzung im Chat.
 *
 * Immer vorhanden — jede angemeldete Sitzung hat ein Konto. Nur
 * Plattformzugänge von OKUN bleiben draußen: sie gehören zu keinem Kunden und
 * haben in keinem Kundengespräch etwas zu suchen.
 */
export function eigeneKennung(session: SessionPayload): string | null {
  if (session.role === 'okun') return null
  return session.userId ?? null
}

/**
 * Wen diese Sitzung anschreiben darf.
 *
 * Konten, keine Mitarbeiterdatensätze: geschrieben wird an jemanden, der sich
 * anmelden und antworten kann. Ein Mitarbeiter ohne Zugang bekäme eine
 * Nachricht in ein Postfach, das nie jemand öffnet — schlimmer als gar keine,
 * weil der Absender glaubt, sie sei angekommen.
 */
export async function erreichbarePartner(session: SessionPayload): Promise<ChatPerson[]> {
  const ich = eigeneKennung(session)
  if (!ich) return []

  const customerId = await resolveCustomerId(session)
  if (!customerId) return []

  const scope = await allowedLocationScope(session)
  const standorte = scope.kind === 'all' ? null : scope.ids

  // Die Unternehmensebene ist immer dabei — sie sitzt an keinem Standort,
  // gehört aber zu allen. Sonst könnte ein Mitarbeiter seiner eigenen
  // Geschäftsführung nicht antworten.
  const konten = await prisma.user.findMany({
    where: {
      customerId,
      id: { not: ich },
      role: { in: ['employee', 'admin', 'company'] },
      ...(standorte
        ? { OR: [{ locationId: { in: standorte } }, { role: 'company' }] }
        : {}),
    },
    select: {
      id: true, name: true, role: true, employeeId: true, locationId: true,
    },
    orderBy: { name: 'asc' },
  })
  if (konten.length === 0) return []

  const [orte, personen] = await Promise.all([
    prisma.location.findMany({
      where: { id: { in: konten.map(k => k.locationId).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    }),
    prisma.employee.findMany({
      where: { id: { in: konten.map(k => k.employeeId).filter(Boolean) as string[] } },
      select: { id: true, position: true, active: true, datenGesperrtAm: true },
    }),
  ])
  const ortName = new Map(orte.map(o => [o.id, o.name]))
  const person = new Map(personen.map(p => [p.id, p]))

  return konten
    // Wer ausgeschieden oder gesperrt ist, taucht nicht mehr auf.
    .filter(k => {
      if (!k.employeeId) return true
      const p = person.get(k.employeeId)
      return !p || (p.active && !p.datenGesperrtAm)
    })
    .map(k => ({
      userId: k.id,
      name: k.name,
      rolle: k.role,
      rollenText: ROLLEN_TEXT[k.role] ?? k.role,
      standort: k.locationId ? ortName.get(k.locationId) ?? null : null,
      employeeId: k.employeeId,
      position: k.employeeId ? person.get(k.employeeId)?.position ?? null : null,
    }))
}

/** Darf diese Sitzung diesem Konto schreiben? */
export async function darfSchreibenAn(
  session: SessionPayload, userId: string,
): Promise<boolean> {
  const partner = await erreichbarePartner(session)
  return partner.some(p => p.userId === userId)
}

/** Der eindeutige Schlüssel eines Direktchats — unabhängig davon, wer anfängt. */
export function direktSchluessel(a: string, b: string): string {
  return [a, b].sort().join('|')
}

/**
 * Darf diese Sitzung die Gruppe verwalten?
 *
 * Absichtlich getrennt vom Mitlesen: Verwalten heißt Mitglieder setzen, den
 * Namen ändern und schließen. Für den Inhalt braucht es eine Mitgliedschaft.
 * Direktchats verwaltet niemand.
 */
export async function darfVerwalten(
  session: SessionPayload,
  raum: { art: string; locationId: string | null; customerId: string },
): Promise<boolean> {
  if (raum.art !== 'gruppe') return false
  if (!['admin', 'company'].includes(session.role)) return false
  const customerId = await resolveCustomerId(session)
  if (!customerId || customerId !== raum.customerId) return false
  if (!raum.locationId) return session.role === 'company'
  const scope = await allowedLocationScope(session)
  return scope.kind === 'all' || scope.ids.includes(raum.locationId)
}

export type ZugriffsGrund = 'ok' | 'unbekannt' | 'keinMitglied' | 'keinZugang'

export interface RaumDaten {
  id: string
  art: string
  locationId: string | null
  customerId: string
  name: string | null
  beschreibung: string | null
  archiviertAm: Date | null
}

/**
 * Zugriff auf einen Raum prüfen — die eine Stelle, an der das entschieden wird.
 *
 * Der Unterschied zwischen „gibt es nicht" und „du bist kein Mitglied" ist nach
 * außen absichtlich unsichtbar: beides wird als 404 beantwortet. Sonst ließe
 * sich durch Ausprobieren herausfinden, welche Gespräche es gibt.
 */
export async function raumZugriff(session: SessionPayload, raumId: string): Promise<{
  grund: ZugriffsGrund
  raum?: RaumDaten
  mitglied?: { id: string; rolle: string; gelesenBis: Date | null }
}> {
  const ich = eigeneKennung(session)
  if (!ich) return { grund: 'keinZugang' }

  const raum = await prisma.chatRaum.findUnique({ where: { id: raumId } })
  if (!raum) return { grund: 'unbekannt' }

  const mitglied = await prisma.chatMitglied.findUnique({
    where: { raumId_userId: { raumId, userId: ich } },
    select: { id: true, rolle: true, gelesenBis: true },
  })
  if (!mitglied) return { grund: 'keinMitglied', raum }

  return { grund: 'ok', raum, mitglied }
}

/** Ein Systemhinweis im Verlauf — damit Beitritte und Abgänge sichtbar sind. */
export async function systemHinweis(raumId: string, text: string): Promise<void> {
  await prisma.chatNachricht.create({
    data: { raumId, userId: SYSTEM, absenderName: 'System', text, art: 'system' },
  })
}

/**
 * Ungelesene je Raum — in einer Abfrage statt einer pro Raum.
 *
 * Jeder Raum hat seinen eigenen Lesestand, also lässt sich das nicht in einem
 * Datenbank-Zähler ausdrücken. Geholt wird deshalb alles ab dem ÄLTESTEN
 * Lesestand und danach hier verglichen — eine Abfrage, egal wie viele Räume.
 */
async function ungeleseneJeRaum(
  ich: string,
  mitgliedschaften: { raumId: string; gelesenBis: Date | null }[],
): Promise<Map<string, number>> {
  const ergebnis = new Map<string, number>(mitgliedschaften.map(m => [m.raumId, 0]))
  if (mitgliedschaften.length === 0) return ergebnis

  const staende = new Map(mitgliedschaften.map(m => [m.raumId, m.gelesenBis]))
  const nieGelesen = mitgliedschaften.some(m => !m.gelesenBis)
  const aeltester = nieGelesen
    ? undefined
    : new Date(Math.min(...mitgliedschaften.map(m => m.gelesenBis!.getTime())))

  const neue = await prisma.chatNachricht.findMany({
    where: {
      raumId: { in: mitgliedschaften.map(m => m.raumId) },
      userId: { not: ich },
      art: 'text',
      ...(aeltester ? { createdAt: { gt: aeltester } } : {}),
    },
    select: { raumId: true, createdAt: true },
  })

  for (const n of neue) {
    const stand = staende.get(n.raumId)
    if (stand && n.createdAt <= stand) continue
    ergebnis.set(n.raumId, (ergebnis.get(n.raumId) ?? 0) + 1)
  }
  return ergebnis
}

/** Die Räume einer Person, fertig für die Liste. */
export async function raeumeFuer(session: SessionPayload): Promise<RaumListe[]> {
  const ich = eigeneKennung(session)
  if (!ich) return []

  const mitgliedschaften = await prisma.chatMitglied.findMany({
    where: { userId: ich },
    select: { raumId: true, gelesenBis: true },
  })
  if (mitgliedschaften.length === 0) return []
  const raumIds = mitgliedschaften.map(m => m.raumId)

  const [raeume, mitglieder, letzte] = await Promise.all([
    prisma.chatRaum.findMany({
      where: { id: { in: raumIds } },
      orderBy: { letzteAktivitaet: 'desc' },
    }),
    prisma.chatMitglied.findMany({
      where: { raumId: { in: raumIds } },
      select: { raumId: true, userId: true },
    }),
    prisma.chatNachricht.findMany({
      where: { raumId: { in: raumIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['raumId'],
      select: { raumId: true, text: true, absenderName: true, createdAt: true, art: true },
    }),
  ])

  // Die Namen der Gegenüber in einem Zug — sonst eine Abfrage je Raum.
  const fremdeIds = Array.from(new Set(
    mitglieder.filter(m => m.userId !== ich).map(m => m.userId),
  ))
  const namen = new Map(
    (await prisma.user.findMany({
      where: { id: { in: fremdeIds } }, select: { id: true, name: true },
    })).map(u => [u.id, u.name]),
  )

  const letzteJeRaum = new Map(letzte.map(n => [n.raumId, n]))
  const ungelesen = await ungeleseneJeRaum(ich, mitgliedschaften)

  return Promise.all(raeume.map(async raum => {
    const imRaum = mitglieder.filter(m => m.raumId === raum.id)
    const gegenueber = raum.art === 'direkt'
      ? imRaum.find(m => m.userId !== ich)?.userId
      : undefined
    const n = letzteJeRaum.get(raum.id)
    return {
      id: raum.id,
      art: raum.art as 'direkt' | 'gruppe',
      titel: raum.art === 'direkt'
        ? (gegenueber ? namen.get(gegenueber) ?? 'Ehemalige Kollegin' : 'Gespräch')
        : raum.name ?? 'Gruppe',
      beschreibung: raum.beschreibung,
      archiviert: !!raum.archiviertAm,
      mitgliederAnzahl: imRaum.length,
      darfVerwalten: await darfVerwalten(session, raum),
      letzteNachricht: n
        ? { text: n.text, absenderName: n.absenderName, createdAt: n.createdAt.toISOString(), art: n.art }
        : null,
      ungelesen: ungelesen.get(raum.id) ?? 0,
      letzteAktivitaet: raum.letzteAktivitaet.toISOString(),
    }
  }))
}

/** Wie viele ungelesene Nachrichten insgesamt — für das Abzeichen im Kopf. */
export async function ungeleseneGesamt(session: SessionPayload): Promise<number> {
  const ich = eigeneKennung(session)
  if (!ich) return 0
  const mitgliedschaften = await prisma.chatMitglied.findMany({
    where: { userId: ich },
    select: { raumId: true, gelesenBis: true },
  })
  const jeRaum = await ungeleseneJeRaum(ich, mitgliedschaften)
  return Array.from(jeRaum.values()).reduce((s, n) => s + n, 0)
}
