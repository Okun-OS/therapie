/**
 * §146 Der Fristenmotor — ein Datum, das abläuft, und jemand muss es vorher
 * wissen.
 *
 * DIE EINSICHT, DIE DAS GANZE MODUL TRÄGT
 * Erste Hilfe, Hygienebelehrung, Führungszeugnis, Masernnachweis,
 * arbeitsmedizinische Vorsorge, Probezeitende, auslaufende Befristung,
 * Rückkehr aus der Elternzeit — das sieht nach acht Themen aus und ist eines:
 * Ein Datum läuft ab, und jemand muss rechtzeitig Bescheid wissen.
 *
 * Deshalb EIN Motor und beliebig viele Einträge. Ein Kunde, der nur ein
 * Führungszeugnis führt, legt einen Eintrag an; ein Pflegeheim legt acht an;
 * ein Industriebetrieb legt ganz andere an. Verlässlich ist das, weil der
 * Mechanismus immer derselbe bleibt — nur die Liste ist anders.
 *
 * WARUM DER STAND GERECHNET UND NICHT GESPEICHERT WIRD
 * Ein gespeicherter Status wäre am nächsten Morgen falsch: Was gestern „läuft
 * bald ab" war, ist heute abgelaufen, ohne dass jemand etwas getan hätte. Der
 * Stand ergibt sich aus dem Datum und dem heutigen Tag — dann kann er nicht
 * veralten. Gespeichert werden nur Tatsachen: wann erfüllt, bis wann gültig,
 * ob befreit.
 *
 * WAS „SPERREN" BEDEUTET
 * Eine Nachweisart kann verlangen, dass jemand ohne gültigen Nachweis nicht
 * eingeplant wird. Das ist kein Vorwurf an die Person, sondern der Grund,
 * warum es die Frist gibt: Wer keine gültige Belehrung nach §43 IfSG hat, darf
 * nicht am Essen arbeiten. Diese Folge steht bei der Art und wird hier nur
 * ausgerechnet — was der Dienstplan damit macht, ist seine Sache.
 */

export type Gattung =
  /** Etwas, das nachgewiesen wird: Schulung, Untersuchung, Zeugnis */
  | 'nachweis'
  /** Etwas aus dem Vertrag: Probezeit, Befristung, Rückkehr */
  | 'vertrag'

export type GiltFuer =
  /** Jede Person im Betrieb */
  | 'alle'
  /** Nur bestimmte Positionen */
  | 'positionen'
  /** Nur wer eine bestimmte Qualifikation hat */
  | 'qualifikationen'
  /** Niemand automatisch — wird von Hand zugewiesen */
  | 'einzeln'

export type Faelligkeit =
  /** Einmal, dann nie wieder */
  | 'einmalig'
  /** Zum Eintritt fällig, danach nicht mehr */
  | 'einstellung'
  /** In festem Abstand wiederkehrend */
  | 'wiederkehrend'
  /** Zum Eintritt UND danach wiederkehrend */
  | 'einstellung_und_wiederkehrend'

export type Folge =
  /** Nur warnen */
  | 'warnen'
  /** Ohne gültigen Nachweis nicht einplanen */
  | 'sperren'

export type Sichtbarkeit =
  /** Die Standortleitung sieht es — sie braucht es für den Plan */
  | 'leitung'
  /** Nur die Unternehmensebene */
  | 'unternehmen'

export interface Nachweisart {
  id: string
  name: string
  gattung: Gattung
  giltFuer: GiltFuer
  giltFuerWerte: string[]
  faelligkeit: Faelligkeit
  /** Bei wiederkehrend: der Abstand in Monaten */
  abstandMonate?: number | null
  /** Wie viele Tage vorher gewarnt wird */
  vorwarnTage: number
  nachweisNoetig: boolean
  sichtbarkeit: Sichtbarkeit
  folge: Folge
  grundlage?: string | null
  aktiv: boolean
}

export interface Person {
  id: string
  position?: string | null
  qualifications?: string[]
  /** Eintritt — Grundlage für „bei Einstellung fällig" */
  joinedAt?: string | null
  active?: boolean
}

export interface Frist {
  id: string
  employeeId: string
  nachweisartId?: string | null
  bezeichnung: string
  gattung: string
  /** Wann zuletzt erfüllt: Schulung besucht, Untersuchung gemacht, unterschrieben */
  erfuelltAm?: Date | string | null
  /** Bis wann es gilt. Das Feld, um das sich alles dreht. */
  faelligAm?: Date | string | null
  /** Wer befreit ist, braucht einen Grund — sonst ist es keine Befreiung, sondern Vergessen */
  befreitAm?: Date | string | null
  befreitGrund?: string | null
  dateiId?: string | null
}

// ── Wer bekommt welche Frist ───────────────────────────────────────────────

/**
 * Gilt diese Art für diese Person?
 *
 * Der Punkt aus dem Betrieb: Brandschutzhelfer braucht nicht jeder. Eine Art,
 * die für alle gilt, wäre schnell eine Liste mit vierzig roten Einträgen, die
 * niemand mehr liest.
 */
export function giltFuerPerson(art: Nachweisart, person: Person): boolean {
  if (!art.aktiv) return false
  if (person.active === false) return false

  switch (art.giltFuer) {
    case 'alle':
      return true
    case 'positionen':
      return !!person.position && art.giltFuerWerte.includes(person.position)
    case 'qualifikationen':
      return (person.qualifications ?? []).some(q => art.giltFuerWerte.includes(q))
    case 'einzeln':
      // Wird von Hand zugewiesen — automatisch entsteht sie nie.
      return false
  }
}

// ── Wann ist es das nächste Mal fällig ─────────────────────────────────────

const MS_TAG = 86_400_000

function alsDatum(wert?: Date | string | null): Date | null {
  if (!wert) return null
  const d = wert instanceof Date ? wert : new Date(wert)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Monate addieren, ohne am Monatsende umzukippen (31.01. + 1 Monat = 28.02.). */
export function plusMonate(d: Date, monate: number): Date {
  const jahr = d.getFullYear()
  const monat = d.getMonth() + monate
  const tag = d.getDate()
  const letzterTag = new Date(Date.UTC(jahr, monat + 1, 0)).getUTCDate()
  return new Date(Date.UTC(jahr, monat, Math.min(tag, letzterTag)))
}

/**
 * Wann läuft es ab?
 *
 * `null` heißt: läuft nicht ab. Das ist kein Fehler — ein Masernnachweis gilt
 * ein Leben lang, eine Fachkraft-Urkunde auch. Er muss nur EINMAL da sein.
 */
export function naechsteFaelligkeit(
  art: Nachweisart,
  erfuelltAm?: Date | string | null,
  eintritt?: string | null,
): Date | null {
  const erfuellt = alsDatum(erfuelltAm)

  if (art.faelligkeit === 'einmalig') return null

  if (art.faelligkeit === 'einstellung') {
    // Fällig zum Eintritt. Ist es erfüllt, ist es erledigt.
    if (erfuellt) return null
    return alsDatum(eintritt)
  }

  const abstand = art.abstandMonate ?? 0
  if (abstand <= 0) return null

  if (erfuellt) return plusMonate(erfuellt, abstand)

  // Noch nie erfüllt: Dann ist es seit dem Eintritt überfällig. Bei
  // „Einstellung und wiederkehrend" sogar ab Tag eins — genau das soll die
  // Liste ja zeigen.
  const start = alsDatum(eintritt)
  if (!start) return null
  return art.faelligkeit === 'einstellung_und_wiederkehrend'
    ? start
    : plusMonate(start, abstand)
}

// ── Der Stand ──────────────────────────────────────────────────────────────

export type Stand =
  /** Gültig, nichts zu tun */
  | 'gueltig'
  /** Läuft innerhalb der Vorwarnzeit ab */
  | 'laeuft_ab'
  /** Das Datum ist vorbei */
  | 'abgelaufen'
  /** Nie erfüllt und kein Datum errechenbar — es fehlt schlicht */
  | 'fehlt'
  /** Bewusst befreit, mit Begründung */
  | 'befreit'

export interface Lage {
  stand: Stand
  faelligAm: Date | null
  /** Negativ, wenn schon vorbei */
  tageBis: number | null
  /** Ein Satz für die Anzeige */
  text: string
}

export const STAND_TEXT: Record<Stand, string> = {
  gueltig: 'Gültig',
  laeuft_ab: 'Läuft ab',
  abgelaufen: 'Abgelaufen',
  fehlt: 'Fehlt',
  befreit: 'Befreit',
}

/**
 * Wie steht es um diese Frist?
 *
 * Gerechnet, nicht gespeichert — siehe oben. `heute` ist ein Parameter, damit
 * sich das prüfen lässt, ohne die Systemuhr zu stellen.
 */
export function lage(
  frist: Frist,
  art: Pick<Nachweisart, 'vorwarnTage'>,
  heute: Date = new Date(),
): Lage {
  if (frist.befreitAm) {
    return {
      stand: 'befreit', faelligAm: null, tageBis: null,
      text: frist.befreitGrund
        ? `Befreit: ${frist.befreitGrund}`
        : 'Befreit',
    }
  }

  const faellig = alsDatum(frist.faelligAm)

  if (!faellig) {
    // Kein Ablaufdatum. Entweder ist es erfüllt und gilt dauerhaft, oder es
    // fehlt noch ganz.
    if (alsDatum(frist.erfuelltAm)) {
      return {
        stand: 'gueltig', faelligAm: null, tageBis: null,
        text: 'Liegt vor, ohne Ablauf',
      }
    }
    return { stand: 'fehlt', faelligAm: null, tageBis: null, text: 'Fehlt noch' }
  }

  const tage = Math.ceil((faellig.getTime() - heute.getTime()) / MS_TAG)

  if (tage < 0) {
    return {
      stand: 'abgelaufen', faelligAm: faellig, tageBis: tage,
      text: `Seit ${Math.abs(tage)} ${Math.abs(tage) === 1 ? 'Tag' : 'Tagen'} abgelaufen`,
    }
  }
  if (tage <= art.vorwarnTage) {
    return {
      stand: 'laeuft_ab', faelligAm: faellig, tageBis: tage,
      text: tage === 0
        ? 'Läuft heute ab'
        : `Läuft in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} ab`,
    }
  }
  return {
    stand: 'gueltig', faelligAm: faellig, tageBis: tage,
    text: `Gültig bis ${faellig.toISOString().slice(0, 10).split('-').reverse().join('.')}`,
  }
}

/** Steht diese Lage einem Einsatz im Dienstplan entgegen? */
export function sperrtEinsatz(l: Lage, art: Pick<Nachweisart, 'folge'>): boolean {
  if (art.folge !== 'sperren') return false
  return l.stand === 'abgelaufen' || l.stand === 'fehlt'
}

// ── Was für eine Person angelegt werden muss ───────────────────────────────

export interface Abgleich {
  /** Arten, für die noch keine Frist existiert */
  anzulegen: Nachweisart[]
  /** Fristen, deren Art nicht mehr für diese Person gilt */
  ueberfluessig: Frist[]
}

/**
 * Welche Fristen sollte diese Person haben — und welche hat sie zu viel?
 *
 * Wird gebraucht, wenn jemand eingestellt wird, die Position wechselt oder der
 * Betrieb seinen Katalog ändert. Überflüssige werden NICHT automatisch
 * gelöscht: In einer abgelaufenen Frist steckt ein Dokument und eine
 * Vorgeschichte. Die Liste sagt nur, was nicht mehr gilt — wegwerfen ist eine
 * Entscheidung, die ein Mensch trifft.
 */
export function abgleichen(
  arten: Nachweisart[],
  person: Person,
  vorhandene: Frist[],
): Abgleich {
  const gilt = arten.filter(a => giltFuerPerson(a, person))
  const habenIds = new Set(vorhandene.map(f => f.nachweisartId).filter(Boolean))

  return {
    anzulegen: gilt.filter(a => !habenIds.has(a.id)),
    // Von Hand angelegte Fristen (ohne Art) bleiben immer — sie hat jemand
    // bewusst gesetzt.
    ueberfluessig: vorhandene.filter(f =>
      f.nachweisartId && !gilt.some(a => a.id === f.nachweisartId)),
  }
}

/**
 * Darf diese Rolle diese Art sehen?
 *
 * Was eine Standortleitung nicht sehen darf, wird AUSGEBLENDET, nicht
 * ausgegraut — ein gesperrter Knopf verrät auch schon, dass es etwas gibt.
 */
export function darfSehen(
  art: Pick<Nachweisart, 'sichtbarkeit'>,
  rolle: string,
): boolean {
  if (rolle === 'company' || rolle === 'okun') return true
  if (rolle === 'admin') return art.sichtbarkeit === 'leitung'
  return false
}

/** Sortierung für die Liste: Was brennt, steht oben. */
export const DRINGLICHKEIT: Record<Stand, number> = {
  abgelaufen: 0,
  fehlt: 1,
  laeuft_ab: 2,
  gueltig: 3,
  befreit: 4,
}
