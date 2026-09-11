/**
 * §129 Nachrichten zwischen Mitarbeitern.
 *
 * Bisher gab es nur Benachrichtigungen in eine Richtung und Support-Tickets an
 * OKUN. Wer einer Kollegin schreiben wollte, hat das Programm verlassen und
 * WhatsApp genommen — mit Dienstplänen, Krankmeldungen und Namen auf privaten
 * Telefonen. Genau das soll dieses Modul überflüssig machen.
 *
 * Die drei Entscheidungen, die alles andere bestimmen:
 *
 *   WER WEN ERREICHT. Jeder erreicht jeden an seinem Standort. Nicht das ganze
 *   Unternehmen: In einem Betrieb mit acht Häusern hat der Kollege aus dem
 *   anderen Ort nichts mit einem zu tun, und eine Suchliste über alle wäre
 *   selbst schon eine Preisgabe. Leitung und Unternehmen erreichen jeden in
 *   ihrem Bereich — dieselbe Grenze wie überall sonst (`scope.ts`).
 *
 *   MITLESEN IST NICHT VERWALTEN. Eine Standortleitung eröffnet Gruppen, setzt
 *   Mitglieder und schließt sie wieder. Lesen kann sie nur, was in Gruppen
 *   steht, in denen sie selbst Mitglied ist — und ein Beitritt hinterlässt
 *   einen sichtbaren Hinweis im Verlauf. Ein Vorgesetzter, der unbemerkt
 *   mitliest, wäre keine Funktion, sondern ein Vertrauensbruch.
 *
 *   DIREKTCHATS SIND UNANTASTBAR. Ein Gespräch zwischen zwei Personen ist für
 *   niemanden sonst einsehbar: nicht für die Leitung, nicht für das
 *   Unternehmen, nicht für OKUN. Deshalb kann eine Sitzung ohne eigene
 *   Mitarbeiterkennung — und das ist jede OKUN-Sitzung — den Chat gar nicht
 *   erst benutzen.
 */

import { prisma } from './prisma'
import type { SessionPayload } from './session'
import { allowedLocationScope } from './scope'

/** Wie lang eine Nachricht sein darf. */
export const MAX_ZEICHEN = 4000

export interface ChatPerson {
  id: string
  name: string
  position?: string | null
  locationId?: string | null
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

/**
 * Die Mitarbeiterkennung der Sitzung — der Ausweis für den Chat.
 *
 * Ohne sie geht nichts. Das trifft bewusst auch OKUN: Plattformzugänge haben
 * keinen Mitarbeiterdatensatz und sollen in keinem Kundenchat stehen.
 */
export function eigeneKennung(session: SessionPayload): string | null {
  return session.employeeId ?? null
}

/** Die Standorte, aus denen diese Sitzung jemanden anschreiben darf. */
async function erreichbareStandorte(session: SessionPayload): Promise<string[] | 'alle'> {
  if (session.role === 'employee') {
    const ich = await prisma.employee.findUnique({
      where: { id: session.employeeId ?? '' },
      select: { locationId: true },
    })
    return ich?.locationId ? [ich.locationId] : []
  }
  const scope = await allowedLocationScope(session)
  return scope.kind === 'all' ? 'alle' : scope.ids
}

/**
 * Wen diese Sitzung anschreiben darf.
 *
 * Inaktive Mitarbeiter sind nicht dabei: Wer nicht mehr da ist, liest auch
 * nicht mehr mit, und eine Nachricht in ein totes Postfach ist schlimmer als
 * gar keine — der Absender glaubt, sie sei angekommen.
 */
export async function erreichbarePartner(session: SessionPayload): Promise<ChatPerson[]> {
  const ich = eigeneKennung(session)
  if (!ich) return []
  const standorte = await erreichbareStandorte(session)
  if (standorte !== 'alle' && standorte.length === 0) return []

  const leute = await prisma.employee.findMany({
    where: {
      active: true,
      id: { not: ich },
      // Wer gesperrt ist, ist ausgeschieden — er taucht nicht mehr auf.
      datenGesperrtAm: null,
      ...(standorte === 'alle' ? {} : { locationId: { in: standorte } }),
    },
    select: { id: true, name: true, position: true, locationId: true },
    orderBy: { name: 'asc' },
  })
  return leute
}

/** Darf diese Sitzung dieser Person schreiben? */
export async function darfSchreibenAn(
  session: SessionPayload, employeeId: string,
): Promise<boolean> {
  const partner = await erreichbarePartner(session)
  return partner.some(p => p.id === employeeId)
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
  raum: { art: string; locationId: string },
): Promise<boolean> {
  if (raum.art !== 'gruppe') return false
  if (!['admin', 'company'].includes(session.role)) return false
  const standorte = await erreichbareStandorte(session)
  return standorte === 'alle' || standorte.includes(raum.locationId)
}

export type ZugriffsGrund = 'ok' | 'unbekannt' | 'keinMitglied' | 'keinZugang'

/**
 * Zugriff auf einen Raum prüfen — die eine Stelle, an der das entschieden wird.
 *
 * Der Unterschied zwischen „gibt es nicht" und „du bist kein Mitglied" ist hier
 * absichtlich unsichtbar nach außen: beides wird als 404 beantwortet. Sonst
 * ließe sich durch Ausprobieren herausfinden, welche Gespräche es gibt.
 */
export async function raumZugriff(session: SessionPayload, raumId: string): Promise<{
  grund: ZugriffsGrund
  raum?: { id: string; art: string; locationId: string; customerId: string; name: string | null
    beschreibung: string | null; archiviertAm: Date | null }
  mitglied?: { id: string; rolle: string; gelesenBis: Date | null }
}> {
  const ich = eigeneKennung(session)
  if (!ich) return { grund: 'keinZugang' }

  const raum = await prisma.chatRaum.findUnique({ where: { id: raumId } })
  if (!raum) return { grund: 'unbekannt' }

  const mitglied = await prisma.chatMitglied.findUnique({
    where: { raumId_employeeId: { raumId, employeeId: ich } },
    select: { id: true, rolle: true, gelesenBis: true },
  })
  if (!mitglied) return { grund: 'keinMitglied', raum }

  return { grund: 'ok', raum, mitglied }
}

/** Ein Systemhinweis im Verlauf — damit Beitritte und Abgänge sichtbar sind. */
export async function systemHinweis(raumId: string, text: string): Promise<void> {
  await prisma.chatNachricht.create({
    data: { raumId, employeeId: 'system', absenderName: 'System', text, art: 'system' },
  })
}

/** Die Räume einer Person, fertig für die Liste. */
export async function raeumeFuer(session: SessionPayload): Promise<RaumListe[]> {
  const ich = eigeneKennung(session)
  if (!ich) return []

  const mitgliedschaften = await prisma.chatMitglied.findMany({
    where: { employeeId: ich },
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
      select: { raumId: true, employeeId: true },
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
    mitglieder.filter(m => m.employeeId !== ich).map(m => m.employeeId),
  ))
  const namen = new Map(
    (await prisma.employee.findMany({
      where: { id: { in: fremdeIds } }, select: { id: true, name: true },
    })).map(e => [e.id, e.name]),
  )

  const letzteJeRaum = new Map(letzte.map(n => [n.raumId, n]))
  const ungelesen = await ungeleseneJeRaum(ich, mitgliedschaften)

  return Promise.all(raeume.map(async raum => {
    const imRaum = mitglieder.filter(m => m.raumId === raum.id)
    const gegenueber = raum.art === 'direkt'
      ? imRaum.find(m => m.employeeId !== ich)?.employeeId
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
      employeeId: { not: ich },
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

/** Wie viele ungelesene Nachrichten insgesamt — für das Abzeichen im Kopf. */
export async function ungeleseneGesamt(session: SessionPayload): Promise<number> {
  const ich = eigeneKennung(session)
  if (!ich) return 0
  const mitgliedschaften = await prisma.chatMitglied.findMany({
    where: { employeeId: ich },
    select: { raumId: true, gelesenBis: true },
  })
  const jeRaum = await ungeleseneJeRaum(ich, mitgliedschaften)
  return Array.from(jeRaum.values()).reduce((s, n) => s + n, 0)
}
