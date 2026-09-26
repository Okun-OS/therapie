/**
 * §130 Krankenschein und Fehlzeit.
 *
 * Bisher lagen beide nebeneinander und wussten nichts voneinander: die
 * Arbeitsunfähigkeitsbescheinigung als Datei in der Personalakte, die Fehlzeit
 * als Eintrag im Kalender. Wer wissen wollte, ob für die Krankheit vom 2. bis
 * 6. März ein Nachweis vorliegt, musste zwei Listen nebeneinanderlegen und die
 * Daten von Hand vergleichen. Genau dabei wird etwas übersehen — und übersehen
 * heißt hier: die Entgeltfortzahlung läuft ohne Nachweis weiter.
 *
 * Drei Dinge macht diese Datei:
 *
 *   ZUORDNEN. Eine Bescheinigung gehört zu einer Fehlzeit. Beim Hochladen wird
 *   sie automatisch zugeordnet, wenn genau eine passt — und nur dann. Bei
 *   mehreren wird gefragt, statt zu raten: eine falsch zugeordnete
 *   Bescheinigung ist schlimmer als eine fehlende, weil sie eine Lücke
 *   zudeckt.
 *
 *   PFLICHT KENNEN. §5 Abs.1 EntgFG: spätestens ab dem vierten Kalendertag.
 *   Der Arbeitgeber darf sie früher verlangen — das steht im Arbeitsvertrag und
 *   ist deshalb einstellbar, nicht einprogrammiert.
 *
 *   LÜCKEN ZEIGEN. Eine Krankheit über drei Wochen mit einer Bescheinigung über
 *   eine Woche ist der häufigste Fall: die Folgebescheinigung fehlt. Das lässt
 *   sich ausrechnen, statt darauf zu warten, dass es jemandem auffällt.
 *
 * Was hier NICHT passiert: die elektronische AU (eAU) bei der Krankenkasse
 * abrufen. Das läuft über ein zertifiziertes Verfahren, das wir nicht haben —
 * dasselbe Thema wie beim Meldewesen. Bis dahin reicht der Mitarbeiter seine
 * Bescheinigung ein, so wie er es heute auch tut.
 */

import { prisma } from './prisma'

/** Ab dem wievielten Kalendertag die Bescheinigung verlangt wird (§5 EntgFG). */
export const NACHWEIS_AB_TAG_STANDARD = 4

/**
 * Fehlzeiten, für die überhaupt ein Nachweis in Frage kommt.
 *
 * Beide Schreibweisen: die Oberfläche schreibt „krankheit", ältere Datensätze
 * und die Lohnrechnung kennen daneben „krank". Wer hier nur eine der beiden
 * berücksichtigt, übersieht die Hälfte der Fälle — und zwar still.
 */
export const NACHWEISPFLICHTIGE_ARTEN = ['krankheit', 'krank']

export interface Zeitraum {
  startDate: string
  endDate: string
}

/** Tage zwischen zwei Datumsangaben, beide eingeschlossen. */
export function kalendertage(von: string, bis: string): number {
  const a = Date.parse(`${von}T00:00:00Z`)
  const b = Date.parse(`${bis}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86400000) + 1
}

/** Einen Tag weiter. */
export function naechsterTag(datum: string): string {
  const d = new Date(`${datum}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Überschneiden sich zwei Zeiträume? */
export function ueberschneidet(a: Zeitraum, b: Zeitraum): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

export interface Nachweispflicht {
  pflichtig: boolean
  /** Ab diesem Tag muss die Bescheinigung vorliegen */
  spaetestensAm: string | null
  begruendung: string
}

/**
 * Braucht diese Fehlzeit eine Bescheinigung — und ab wann?
 *
 * Gerechnet wird in KALENDERTAGEN, nicht in Arbeitstagen: §5 EntgFG stellt auf
 * die Dauer der Arbeitsunfähigkeit ab, nicht auf den Dienstplan. Wer Freitag
 * krank wird und Montag noch krank ist, ist am vierten Kalendertag — auch wenn
 * er am Wochenende ohnehin frei gehabt hätte.
 */
export function nachweispflicht(
  abwesenheit: { type: string } & Zeitraum,
  abTag: number = NACHWEIS_AB_TAG_STANDARD,
): Nachweispflicht {
  if (!NACHWEISPFLICHTIGE_ARTEN.includes(abwesenheit.type)) {
    return {
      pflichtig: false, spaetestensAm: null,
      begruendung: 'Für diese Art von Abwesenheit ist keine Bescheinigung vorgesehen.',
    }
  }

  const dauer = kalendertage(abwesenheit.startDate, abwesenheit.endDate)

  // Verlangt der Betrieb sie ab dem ersten Tag, gilt das immer — auch bei
  // eintägiger Krankheit. Das ist nach §5 Abs.1 Satz 3 EntgFG zulässig.
  if (abTag <= 1) {
    return {
      pflichtig: true, spaetestensAm: abwesenheit.startDate,
      begruendung: 'Der Betrieb verlangt die Bescheinigung ab dem ersten Tag '
        + '(§5 Abs.1 Satz 3 EntgFG).',
    }
  }

  if (dauer < abTag) {
    return {
      pflichtig: false, spaetestensAm: null,
      begruendung: `Die Abwesenheit dauert ${dauer} ${dauer === 1 ? 'Tag' : 'Kalendertage'} `
        + `— eine Bescheinigung wird erst ab dem ${abTag}. Kalendertag verlangt.`,
    }
  }

  const stichtag = new Date(`${abwesenheit.startDate}T00:00:00Z`)
  stichtag.setUTCDate(stichtag.getUTCDate() + abTag - 1)
  return {
    pflichtig: true,
    spaetestensAm: stichtag.toISOString().slice(0, 10),
    begruendung: `Die Arbeitsunfähigkeit dauert länger als ${abTag - 1} Kalendertage. `
      + `Die Bescheinigung muss spätestens am ${abTag}. Tag vorliegen (§5 Abs.1 EntgFG).`,
  }
}

export interface Luecke {
  von: string
  bis: string
  tage: number
}

/**
 * Welche Tage der Fehlzeit durch keine Bescheinigung gedeckt sind.
 *
 * Bescheinigungen ohne Gültigkeitsdatum zählen nicht mit. Das ist Absicht: eine
 * Datei, von der niemand weiß, für welchen Zeitraum sie gilt, deckt nichts ab.
 * Sie erscheint in der Oberfläche mit dem Hinweis, dass der Zeitraum fehlt.
 */
export function luecken(
  abwesenheit: Zeitraum,
  nachweise: { gueltigVon?: string | null; gueltigBis?: string | null }[],
): Luecke[] {
  const gedeckt = nachweise
    .filter(n => n.gueltigVon && n.gueltigBis)
    .map(n => ({ von: n.gueltigVon!, bis: n.gueltigBis! }))
    .sort((a, b) => a.von.localeCompare(b.von))

  const offen: Luecke[] = []
  let zeiger = abwesenheit.startDate

  for (const g of gedeckt) {
    if (g.bis < zeiger) continue            // liegt ganz vor dem offenen Rest
    if (g.von > abwesenheit.endDate) break  // beginnt erst nach der Fehlzeit
    if (g.von > zeiger) {
      const bis = vorherigerTag(g.von)
      offen.push({ von: zeiger, bis, tage: kalendertage(zeiger, bis) })
    }
    zeiger = naechsterTag(g.bis)
    if (zeiger > abwesenheit.endDate) break
  }

  if (zeiger <= abwesenheit.endDate) {
    offen.push({
      von: zeiger, bis: abwesenheit.endDate,
      tage: kalendertage(zeiger, abwesenheit.endDate),
    })
  }
  return offen.filter(l => l.tage > 0)
}

function vorherigerTag(datum: string): string {
  const d = new Date(`${datum}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export type Deckung = 'vollstaendig' | 'teilweise' | 'keine' | 'nicht_noetig'

export interface NachweisLage {
  pflicht: Nachweispflicht
  anzahlNachweise: number
  /** Nachweise ohne Gültigkeitszeitraum — sie decken nichts ab */
  ohneZeitraum: number
  luecken: Luecke[]
  deckung: Deckung
  /** Ein Satz, der in der Oberfläche steht */
  text: string
}

/** Die Lage zu einer Fehlzeit in einem Satz. */
export function nachweisLage(
  abwesenheit: { type: string } & Zeitraum,
  nachweise: { gueltigVon?: string | null; gueltigBis?: string | null }[],
  abTag: number = NACHWEIS_AB_TAG_STANDARD,
): NachweisLage {
  const pflicht = nachweispflicht(abwesenheit, abTag)
  const ohneZeitraum = nachweise.filter(n => !n.gueltigVon || !n.gueltigBis).length
  const offen = luecken(abwesenheit, nachweise)

  let deckung: Deckung
  if (nachweise.length === 0) deckung = pflicht.pflichtig ? 'keine' : 'nicht_noetig'
  else if (offen.length === 0) deckung = 'vollstaendig'
  else deckung = 'teilweise'

  let text: string
  if (deckung === 'vollstaendig') {
    text = nachweise.length === 1
      ? 'Die Bescheinigung deckt die gesamte Fehlzeit ab.'
      : `${nachweise.length} Bescheinigungen decken die gesamte Fehlzeit ab.`
  } else if (deckung === 'teilweise') {
    const l = offen[0]
    text = offen.length === 1
      ? `Für ${l.von.split('-').reverse().join('.')} bis `
        + `${l.bis.split('-').reverse().join('.')} fehlt noch eine Bescheinigung `
        + `(${l.tage} ${l.tage === 1 ? 'Tag' : 'Tage'}) — in der Regel die Folgebescheinigung.`
      : `${offen.length} Zeiträume der Fehlzeit sind nicht durch eine Bescheinigung gedeckt.`
  } else if (deckung === 'keine') {
    text = `Es liegt keine Bescheinigung vor. ${pflicht.begruendung}`
  } else {
    text = pflicht.begruendung
  }
  if (ohneZeitraum > 0) {
    text += ` ${ohneZeitraum} ${ohneZeitraum === 1 ? 'Datei trägt' : 'Dateien tragen'} `
      + 'keinen Gültigkeitszeitraum und kann deshalb nicht angerechnet werden.'
  }

  return { pflicht, anzahlNachweise: nachweise.length, ohneZeitraum, luecken: offen, deckung, text }
}

// ── Verbindung zur Datenbank ───────────────────────────────────────────────

/** Die Nachweise einer Fehlzeit. */
export async function nachweiseZu(absenceId: string) {
  return prisma.storedFile.findMany({
    where: { absenceId, deletedAt: null },
    orderBy: { gueltigVon: 'asc' },
    select: {
      id: true, dateiname: true, mimeType: true, groesse: true, kategorie: true,
      gueltigVon: true, gueltigBis: true, notiz: true,
      hochgeladenVonName: true, createdAt: true,
    },
  })
}

/**
 * Fehlzeiten, zu denen eine Bescheinigung passen könnte.
 *
 * Passend heißt: gleiche Person, nachweispflichtige Art, und der
 * Gültigkeitszeitraum überschneidet sich. Fehlt der Zeitraum, werden die
 * Fehlzeiten der letzten Wochen angeboten — dann muss ein Mensch entscheiden.
 */
export async function passendeAbwesenheiten(
  employeeId: string,
  gueltigVon?: string | null,
  gueltigBis?: string | null,
  heute: string = new Date().toISOString().slice(0, 10),
) {
  const alle = await prisma.absence.findMany({
    where: { employeeId, type: { in: NACHWEISPFLICHTIGE_ARTEN } },
    orderBy: { startDate: 'desc' },
    take: 50,
  })

  if (gueltigVon && gueltigBis) {
    return alle.filter(a => ueberschneidet(a, { startDate: gueltigVon, endDate: gueltigBis }))
  }

  // Ohne Zeitraum: was in den letzten acht Wochen lag oder noch läuft.
  const grenze = new Date(`${heute}T00:00:00Z`)
  grenze.setUTCDate(grenze.getUTCDate() - 56)
  const seit = grenze.toISOString().slice(0, 10)
  return alle.filter(a => a.endDate >= seit)
}

/**
 * „Nachweis vorhanden" neu bestimmen.
 *
 * Nicht setzen, sondern ableiten: Das Kennzeichen wurde bisher von Hand
 * gepflegt und stimmte deshalb irgendwann nicht mehr. Jetzt ist es das
 * Ergebnis daraus, ob Dateien verknüpft sind — und wird bei jeder Änderung neu
 * bestimmt.
 */
export async function nachweisKennzeichenAktualisieren(absenceId: string): Promise<boolean> {
  const anzahl = await prisma.storedFile.count({ where: { absenceId, deletedAt: null } })
  await prisma.absence.update({
    where: { id: absenceId },
    data: { proofProvided: anzahl > 0 },
  }).catch(() => undefined)
  return anzahl > 0
}

/** Eine Datei einer Fehlzeit zuordnen — oder die Zuordnung lösen. */
export async function verknuepfen(dateiId: string, absenceId: string | null) {
  const vorher = await prisma.storedFile.findUnique({
    where: { id: dateiId }, select: { absenceId: true },
  })
  await prisma.storedFile.update({ where: { id: dateiId }, data: { absenceId } })

  // Beide Seiten nachziehen: die alte Fehlzeit verliert vielleicht ihren
  // letzten Nachweis, die neue bekommt ihren ersten.
  if (vorher?.absenceId && vorher.absenceId !== absenceId) {
    await nachweisKennzeichenAktualisieren(vorher.absenceId)
  }
  if (absenceId) await nachweisKennzeichenAktualisieren(absenceId)
}

/**
 * Beim Hochladen automatisch zuordnen — aber nur, wenn es eindeutig ist.
 *
 * Passt genau eine Fehlzeit, wird verbunden. Passen mehrere, wird gefragt: eine
 * falsch zugeordnete Bescheinigung ist schlimmer als eine nicht zugeordnete,
 * weil sie eine Lücke zudeckt, die niemand mehr sieht.
 */
export async function automatischZuordnen(
  dateiId: string,
  employeeId: string,
  gueltigVon?: string | null,
  gueltigBis?: string | null,
): Promise<{ zugeordnet: string | null; vorschlaege: { id: string; startDate: string; endDate: string; type: string }[] }> {
  const kandidaten = await passendeAbwesenheiten(employeeId, gueltigVon, gueltigBis)
  const knapp = kandidaten.map(a => ({
    id: a.id, startDate: a.startDate, endDate: a.endDate, type: a.type,
  }))

  if (gueltigVon && gueltigBis && kandidaten.length === 1) {
    await verknuepfen(dateiId, kandidaten[0].id)
    return { zugeordnet: kandidaten[0].id, vorschlaege: knapp }
  }
  return { zugeordnet: null, vorschlaege: knapp }
}
