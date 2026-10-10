import { pruefeTagesmuster, type Tagesmuster } from '@/lib/tagesmuster'

/**
 * §183 Die Belegschaft beim Einrichten anlegen.
 *
 * WARUM DAS EIN EIGENER SCHRITT IST
 * Ein Regelpaket wird für einen Betrieb von Hand programmiert. Bis dahin
 * stand danach eine leere Mitarbeiterliste, und der Kunde tippte achtzehn
 * Menschen einzeln ein, bevor er den ersten Plan rechnen konnte. Dabei liegen
 * genau diese achtzehn Zeilen schon vor uns: Wer ein Regelwerk aufnimmt,
 * bekommt die Belegschaft mitgeliefert — Namen, Stunden, Gruppen, Tagesmuster.
 * Sie noch einmal abtippen zu lassen, ist eine vermeidbare Fehlerquelle an der
 * empfindlichsten Stelle.
 *
 * WAS HIER ANGELEGT WIRD UND WAS NICHT
 * Nur, was die PLANUNG braucht: Name, Stunden, Tage je Woche, Gruppe,
 * Funktion, Tagesmuster, feste freie Tage, Schichtvorliebe. Keine
 * Geburtsdaten, keine Steuermerkmale, keine Kontoverbindung. Das trägt der
 * Betrieb später selbst ein — zusammen mit der E-Mail-Adresse, aus der dann
 * die Einladung wird.
 *
 * DIE ADRESSE, DIE NOCH KEINE IST
 * Ein Mitarbeiterdatensatz braucht eine eindeutige E-Mail-Adresse. Beim
 * Anlegen gibt es sie noch nicht. Erfundene Adressen auf einer echten Domain
 * wären gefährlich: Eine Einladung ginge an einen Fremden. Deshalb bekommt
 * jeder eine Platzhalteradresse auf `.invalid` — eine Endung, die es im
 * Internet nicht gibt und nie geben wird (RFC 2606). Dorthin kann nichts
 * zugestellt werden, auch nicht versehentlich.
 *
 * ALLES ODER NICHTS
 * Ist eine Zeile fehlerhaft, wird keine einzige angelegt. Eine halb
 * eingelesene Belegschaft ist schlimmer als keine: Niemand sieht ihr an,
 * welche Hälfte fehlt, und der zweite Versuch legt die erste Hälfte doppelt
 * an.
 */

export interface BelegschaftZeile {
  name: string
  stunden: number
  tageProWoche: number
  gruppe: string | null
  funktion: string
  muster: Tagesmuster | null
  freieTage: string[]
  vorliebe: 'frueh' | 'spaet' | 'nacht' | null
  /** Die Zeilennummer in der Eingabe — damit ein Fehler auffindbar ist. */
  zeile: number
}

export interface BelegschaftFehler {
  zeile: number
  text: string
  /** Die rohe Zeile, damit man sie in der Eingabe wiederfindet. */
  roh: string
}

export interface BelegschaftErgebnis {
  zeilen: BelegschaftZeile[]
  fehler: BelegschaftFehler[]
}

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
const VORLIEBEN = ['frueh', 'spaet', 'nacht'] as const

/** Die Spalten in der Reihenfolge, in der sie erwartet werden. */
export const SPALTEN = [
  'Name', 'Stunden', 'Tage/Woche', 'Gruppe', 'Funktion', 'Muster', 'Frei', 'Vorliebe',
] as const

/**
 * Eine Platzhalteradresse, an die nie etwas zugestellt werden kann.
 *
 * `.invalid` ist von der IETF reserviert und wird im Internet garantiert nicht
 * aufgelöst (RFC 2606). Eine erfundene Adresse auf einer echten Domain wäre
 * das Gegenteil: Dort sitzt vielleicht jemand, und der bekäme eine Einladung
 * in die Personalakte eines fremden Betriebs.
 */
export function platzhalterAdresse(name: string, locationId: string): string {
  const teil = name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
  return `${teil}@${locationId}.noch-ohne-adresse.invalid`
}

/** Hat diese Person noch keine echte Adresse — und damit keinen Zugang? */
export function istPlatzhalter(email: string | null | undefined): boolean {
  return !!email && email.endsWith('.noch-ohne-adresse.invalid')
}

/**
 * „3x8+1x6" → `[{stunden: 8, tage: 3}, {stunden: 6, tage: 1}]`.
 *
 * Diese Schreibweise steht so in den Regelwerken, die wir bekommen. Sie wird
 * hier gelesen und sofort gegen die Stundenzahl geprüft — denn genau dieses
 * Auseinanderlaufen hat im September einen ganzen Standort planlos gemacht.
 */
function musterLesen(roh: string): { muster: unknown[] | null; fehler: string | null } {
  const text = roh.trim()
  if (!text) return { muster: null, fehler: null }
  const teile: unknown[] = []
  for (const stueck of text.split('+')) {
    const treffer = stueck.trim().match(/^(\d+)\s*[x×*]\s*(\d+(?:[.,]\d+)?)$/i)
    if (!treffer) {
      return {
        muster: null,
        fehler: `„${stueck.trim()}" ist kein Tagesmuster. Erwartet wird etwa „5x8" `
          + 'oder „3x8+1x6" — Anzahl mal Stunden.',
      }
    }
    teile.push({
      tage: Number(treffer[1]),
      stunden: Number(treffer[2].replace(',', '.')),
    })
  }
  return { muster: teile, fehler: null }
}

function zahlLesen(roh: string): number | null {
  const n = Number(roh.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Eine Belegschaftsliste einlesen und prüfen.
 *
 * Eine Zeile je Mensch, Felder durch Semikolon oder Tabulator getrennt:
 *
 *     Name; Stunden; Tage/Woche; Gruppe; Funktion; Muster; Frei; Vorliebe
 *     Marin Berg; 40; 5; Gruppe 1; Erzieher; 5x8
 *     Heike Stein; 30; 4; Gruppe 5; Erzieher; 3x8+1x6; Fr
 *     Franke Leitner; 40; 5; ; Leitung
 *
 * Leerzeilen und Zeilen, die mit `#` beginnen, werden übergangen; eine
 * Kopfzeile mit „Name" ebenfalls.
 */
export function lesen(
  eingabe: string,
  bekannteGruppen: string[] = [],
  /**
   * Die Wochentage, an denen der Betrieb überhaupt geöffnet ist — „Mo" bis
   * „Fr" bei einer Kita, alle sieben in der Pflege.
   *
   * Ohne diese Angabe ließe sich „fünf Arbeitstage, freitags frei" eintragen:
   * rechnerisch sechs Tage, in einem Montag-bis-Freitag-Betrieb unmöglich. Der
   * Rechendienst fände dafür später keinen Plan, und niemand wüsste, warum.
   */
  betriebstage: string[] = [],
): BelegschaftErgebnis {
  const zeilen: BelegschaftZeile[] = []
  const fehler: BelegschaftFehler[] = []
  const gesehen = new Map<string, number>()
  const gruppenKlein = new Map(bekannteGruppen.map(g => [g.toLowerCase(), g]))

  const rohzeilen = eingabe.split(/\r?\n/)
  for (let i = 0; i < rohzeilen.length; i++) {
    const roh = rohzeilen[i]
    const nummer = i + 1
    const text = roh.trim()
    if (!text || text.startsWith('#')) continue

    const felder = text.split(/[;\t]/).map(f => f.trim())
    // Eine Kopfzeile erkennen wir am ersten Feld — sie wird übergangen, damit
    // niemand sie vor dem Einfügen löschen muss.
    if (felder[0].toLowerCase() === 'name') continue

    const melde = (t: string) => fehler.push({ zeile: nummer, text: t, roh: text })

    const [name, stundenRoh, tageRoh, gruppeRoh, funktionRoh, musterRoh, freiRoh, vorliebeRoh]
      = [...felder, '', '', '', '', '', '', '', '']

    if (!name) { melde('Ohne Namen geht es nicht.'); continue }
    if (name.length > 100) { melde('Der Name ist zu lang.'); continue }

    const schonDa = gesehen.get(name.toLowerCase())
    if (schonDa !== undefined) {
      melde(`„${name}" steht schon in Zeile ${schonDa}. Zwei Menschen mit demselben `
        + 'Namen brauchen einen Zusatz, sonst trifft keine Regel die richtige.')
      continue
    }
    gesehen.set(name.toLowerCase(), nummer)

    // Eine leere Stundenzahl ist ein vergessenes Feld, keine Null. Wer
    // wirklich null Stunden meint, schreibt sie hin.
    if (!stundenRoh.trim()) {
      melde('Die Wochenstunden fehlen.')
      continue
    }
    const stunden = zahlLesen(stundenRoh)
    if (stunden === null || stunden < 0 || stunden > 60) {
      melde(`„${stundenRoh}" sind keine gültigen Wochenstunden (0 bis 60).`)
      continue
    }

    /*
     * §183 „Tage/Woche" ist die Zahl der Tage, an denen diese Person
     * ARBEITET — nicht die Spannweite der Arbeitswoche.
     *
     * Die erste Fassung meinte beides zugleich, und das fiel sofort über die
     * eigenen Füße: Bei „4 Tage, frei am Freitag" zog sie den freien Tag noch
     * einmal ab und kam auf drei. Eine Spalte, die man auf zwei Arten lesen
     * kann, ist in einer Eingabemaske ein Fehler — jemand liest sie falsch,
     * und zwar der, der es nicht nachprüfen kann.
     *
     * Also: Wer vier Tage arbeitet und freitags frei hat, schreibt „4" und
     * „Fr". Beides zusammen muss in eine Woche passen, und das Tagesmuster
     * muss genau diese vier Tage belegen.
     */
    const tageProWoche = tageRoh.trim() ? zahlLesen(tageRoh) : 5
    if (tageProWoche === null || !Number.isInteger(tageProWoche)
        || tageProWoche < 1 || tageProWoche > 7) {
      melde(`„${tageRoh}" sind keine gültigen Arbeitstage je Woche (1 bis 7).`)
      continue
    }

    const funktion = funktionRoh.trim() || 'Mitarbeiter'

    let gruppe: string | null = null
    if (gruppeRoh.trim()) {
      const treffer = gruppenKlein.get(gruppeRoh.trim().toLowerCase())
      if (bekannteGruppen.length > 0 && !treffer) {
        melde(`Die Gruppe „${gruppeRoh.trim()}" gibt es an diesem Standort nicht. `
          + `Vorhanden sind: ${bekannteGruppen.join(', ') || '(keine)'}.`)
        continue
      }
      gruppe = treffer ?? gruppeRoh.trim()
    }

    const freieTage: string[] = []
    let freiKaputt = false
    for (const stueck of freiRoh.split(/[,\s]+/).filter(Boolean)) {
      const tag = WOCHENTAGE.find(w => w.toLowerCase() === stueck.slice(0, 2).toLowerCase())
      if (!tag) {
        melde(`„${stueck}" ist kein Wochentag. Erlaubt sind: ${WOCHENTAGE.join(', ')}.`)
        freiKaputt = true
        break
      }
      if (!freieTage.includes(tag)) freieTage.push(tag)
    }
    if (freiKaputt) continue

    const wocheHat = betriebstage.length > 0 ? betriebstage.length : 7
    if (tageProWoche + freieTage.length > wocheHat) {
      melde(`${tageProWoche} Arbeitstage und ${freieTage.length} feste freie Tage `
        + `passen nicht in eine Woche mit ${wocheHat} Betriebstagen`
        + `${betriebstage.length > 0 ? ` (${betriebstage.join(', ')})` : ''}.`)
      continue
    }
    const ausserhalb = freieTage.filter(
      tg => betriebstage.length > 0 && !betriebstage.includes(tg),
    )
    if (ausserhalb.length > 0) {
      melde(`An ${ausserhalb.join(', ')} hat der Betrieb ohnehin zu — ein fester `
        + 'freier Tag dort sagt nichts aus.')
      continue
    }

    const gelesen = musterLesen(musterRoh)
    if (gelesen.fehler) { melde(gelesen.fehler); continue }

    // §181 Hier schlägt die Prüfung zu, an der alles hängt: Muster und
    // Stundenzahl müssen zusammenpassen, sonst findet der Rechendienst später
    // für den ganzen Standort keinen Plan.
    const geprueft = pruefeTagesmuster(gelesen.muster, stunden, tageProWoche)
    if (geprueft.fehler) { melde(geprueft.fehler); continue }

    // Und das Muster muss GENAU die angegebenen Arbeitstage belegen, nicht
    // weniger. „Fünf Tage, Muster 4×8" wäre sonst still ein Vier-Tage-Vertrag.
    if (geprueft.muster && geprueft.arbeitstage !== tageProWoche) {
      melde(`Das Muster belegt ${geprueft.arbeitstage} Arbeitstage, angegeben sind `
        + `${tageProWoche}.`)
      continue
    }

    let vorliebe: BelegschaftZeile['vorliebe'] = null
    if (vorliebeRoh.trim()) {
      const v = vorliebeRoh.trim().toLowerCase().replace('ü', 'ue')
      const treffer = VORLIEBEN.find(x => x === v || x.startsWith(v.slice(0, 4)))
      if (!treffer) {
        melde(`„${vorliebeRoh.trim()}" ist keine Schichtvorliebe. `
          + `Erlaubt sind: ${VORLIEBEN.join(', ')}.`)
        continue
      }
      vorliebe = treffer
    }

    zeilen.push({
      name, stunden, tageProWoche, gruppe, funktion,
      muster: geprueft.muster, freieTage, vorliebe, zeile: nummer,
    })
  }

  if (zeilen.length === 0 && fehler.length === 0) {
    fehler.push({ zeile: 0, text: 'Die Liste ist leer.', roh: '' })
  }

  return { zeilen, fehler }
}
