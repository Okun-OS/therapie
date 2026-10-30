import { prisma } from './prisma'
import { fehltZurKarriereseite } from './recruiting'

/**
 * §148 Die Karriereseite — was ein Fremder ohne Anmeldung zu sehen bekommt.
 *
 * WARUM DAS AN EINER STELLE STEHT
 * Dieselben Daten werden an drei Türen gebraucht: von der Seite selbst, von
 * der Schnittstelle, die der Prüflauf abfragt, und vom XML-Feed für die
 * Stellenbörsen. Drei Abfragen wären drei Gelegenheiten, versehentlich einen
 * Entwurf mit auszuliefern.
 *
 * DIE EINZIGE REGEL, DIE HIER ZÄHLT
 * Nach draußen geht ausschließlich, was jemand ausdrücklich veröffentlicht
 * hat: die Seite eingeschaltet (`karriereAktiv`) UND die Anzeige auf
 * `veroeffentlicht`. Alles andere existiert für diese Datei nicht — kein
 * Entwurf, keine geschlossene Stelle, kein Betrieb, der die Seite nie
 * eingeschaltet hat. Deshalb gibt es hier auch keinen Parameter, mit dem sich
 * das umgehen ließe.
 */

export interface KarriereSeite {
  betrieb: string
  ueberschrift: string
  text: string | null
  impressum: string
  datenschutz: string | null
  adresse: { strasse: string | null; plz: string | null; ort: string | null }
  stellen: KarriereStelle[]
}

export interface KarriereStelle {
  id: string
  titel: string
  slug: string
  ort: string | null
  plz: string | null
  umfang: string
  stundenProWoche: number | null
  befristung: string
  befristetBis: string | null
  beginn: string | null
  beschreibung: string
  aufgaben: string[]
  profil: string[]
  wirBieten: string[]
  verguetungVon: number | null
  verguetungBis: number | null
  verguetungZeit: string
  veroeffentlichtAm: Date | null
}

const STELLEN_FELDER = {
  id: true, titel: true, slug: true, ort: true, plz: true, umfang: true,
  stundenProWoche: true, befristung: true, befristetBis: true, beginn: true,
  beschreibung: true, aufgaben: true, profil: true, wirBieten: true,
  verguetungVon: true, verguetungBis: true, verguetungZeit: true,
  veroeffentlichtAm: true,
} as const

/**
 * Die Seite eines Betriebs holen — oder `null`, wenn es sie nach außen nicht
 * gibt.
 *
 * `null` deckt bewusst zwei Fälle ab: Die Adresse kennt niemand, oder die
 * Seite ist ausgeschaltet. Von außen soll man den Unterschied nicht sehen —
 * sonst ließe sich durchprobieren, welche Betriebe es gibt.
 */
export async function karriereSeite(slug: string): Promise<KarriereSeite | null> {
  const sauber = String(slug ?? '').trim().toLowerCase()
  if (!sauber || sauber.length > 80) return null

  const e = await prisma.orgSettings.findUnique({
    where: { karriereSlug: sauber },
    select: {
      customerId: true, organizationName: true, karriereAktiv: true,
      karriereUeberschrift: true, karriereText: true, karriereImpressum: true,
      karriereDatenschutz: true, strasse: true, plz: true, ort: true,
    },
  })
  if (!e || !e.karriereAktiv) return null
  // Ein Betrieb kann die Seite eingeschaltet und das Impressum danach wieder
  // gelöscht haben. Dann geht sie aus, nicht ohne Impressum online.
  if (fehltZurKarriereseite({ karriereSlug: sauber, karriereImpressum: e.karriereImpressum })
    .length > 0) return null

  const stellen = await prisma.stelle.findMany({
    where: { customerId: e.customerId, status: 'veroeffentlicht' },
    orderBy: [{ veroeffentlichtAm: 'desc' }, { titel: 'asc' }],
    select: STELLEN_FELDER,
  })

  return {
    betrieb: e.organizationName,
    ueberschrift: e.karriereUeberschrift?.trim()
      || `Arbeiten bei ${e.organizationName}`,
    text: e.karriereText,
    impressum: e.karriereImpressum!,
    datenschutz: e.karriereDatenschutz,
    adresse: { strasse: e.strasse, plz: e.plz, ort: e.ort },
    stellen,
  }
}

/**
 * Eine einzelne Anzeige nachschlagen — für die Detailseite und für die
 * eingehende Bewerbung.
 *
 * Auch hier läuft alles über `karriereSeite()`: Wer über die Adresse einer
 * geschlossenen Stelle eine Bewerbung abschicken will, findet sie nicht.
 */
export async function karriereStelle(
  seitenSlug: string, stellenSlug: string,
): Promise<{ seite: KarriereSeite; stelle: KarriereStelle } | null> {
  const seite = await karriereSeite(seitenSlug)
  if (!seite) return null
  const stelle = seite.stellen.find(s => s.slug === stellenSlug)
  return stelle ? { seite, stelle } : null
}

/** Die Kundennummer hinter einer Karriereadresse — nur für den Eingang. */
export async function karriereKunde(slug: string): Promise<string | null> {
  const sauber = String(slug ?? '').trim().toLowerCase()
  if (!sauber) return null
  const e = await prisma.orgSettings.findUnique({
    where: { karriereSlug: sauber },
    select: { customerId: true, karriereAktiv: true, karriereImpressum: true },
  })
  if (!e || !e.karriereAktiv || !e.karriereImpressum?.trim()) return null
  return e.customerId
}
