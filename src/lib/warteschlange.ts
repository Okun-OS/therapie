/**
 * §138 Die Warteschlange — was im Funkloch entsteht, geht nicht verloren.
 *
 * Eine Pflegekraft steht im Keller eines Altbaus und will einstempeln. Ohne
 * Netz bekommt sie heute eine Fehlermeldung, und die Zeit ist weg. Wer das
 * zweimal erlebt hat, stempelt gar nicht mehr über die App — und dann stimmt
 * weder die Arbeitszeit noch der Lohn.
 *
 * Deshalb: Was nicht übertragen werden kann, wird gemerkt und später
 * nachgereicht. Mit dem Zeitpunkt, zu dem es WIRKLICH passiert ist — den
 * schickt das Gerät mit (§137).
 *
 * VIER ENTSCHEIDUNGEN, DIE ALLES BESTIMMEN
 *
 *   REIHENFOLGE. Stempel werden in der Reihenfolge nachgereicht, in der sie
 *   entstanden sind, und die Schlange hält beim ersten an, der nicht
 *   durchgeht. Sonst käme „gehen" vor „kommen" an, und der Server lehnte es zu
 *   Recht ab — die Zeit wäre trotzdem verloren.
 *
 *   NUR DAS NÖTIGE. In die Schlange kommt, was ohne Rückfrage gültig bleibt:
 *   Stempel, Krankmeldung, Urlaubsantrag, Nachricht. NICHT hinein kommt, was
 *   eine Antwort braucht — etwa eine Zusage zum Einspringen: Bis die übertragen
 *   wäre, hat vielleicht längst jemand anderes zugesagt, und dann stünden zwei
 *   Leute in derselben Schicht.
 *
 *   AUFGEBEN IST ERLAUBT. Ein Vorgang, den der Server dauerhaft ablehnt (400,
 *   403), wird nicht ewig wiederholt. Er fliegt raus — mit einer Meldung an den
 *   Menschen. Eine Schlange, die sich nie leert, ist schlimmer als keine.
 *
 *   NICHTS VERSCHWINDET STILL. Jeder verworfene Vorgang hinterlässt einen
 *   sichtbaren Hinweis. Bei etwas, das über Lohn entscheidet, ist „ist wohl
 *   nicht durchgegangen" keine zulässige Antwort.
 */

export type VorgangsArt = 'stempeln' | 'krankmeldung' | 'urlaub' | 'nachricht'

export interface Vorgang {
  id: string
  art: VorgangsArt
  pfad: string
  methode: 'POST' | 'PATCH'
  daten: Record<string, unknown>
  /** Wann der Handgriff auf dem Gerät geschah — nicht wann er übertragen wird */
  erzeugtAm: string
  versuche: number
  letzterFehler?: string
}

export const ART_TEXT: Record<VorgangsArt, string> = {
  stempeln: 'Stempel',
  krankmeldung: 'Krankmeldung',
  urlaub: 'Urlaubsantrag',
  nachricht: 'Nachricht',
}

/** Wie oft ein Vorgang wiederholt wird, bevor er als aussichtslos gilt. */
export const MAX_VERSUCHE = 20

const SCHLUESSEL = 'okun_warteschlange'

// ── Speicher ───────────────────────────────────────────────────────────────
//
// Bewusst der einfache Speicher des Browsers: Die Vorgänge sind winzig und
// leben Minuten, nicht Wochen. Jeder Zugriff ist abgesichert — im privaten
// Fenster wirft er, und eine App, die daran abstürzt, ist schlimmer als eine
// ohne Warteschlange.

export function alle(): Vorgang[] {
  if (typeof window === 'undefined') return []
  try {
    const roh = window.localStorage.getItem(SCHLUESSEL)
    if (!roh) return []
    const wert = JSON.parse(roh)
    return Array.isArray(wert) ? wert : []
  } catch { return [] }
}

function schreiben(vorgaenge: Vorgang[]): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(SCHLUESSEL, JSON.stringify(vorgaenge))
    return true
  } catch { return false }
}

/**
 * Einen Vorgang merken.
 *
 * Gibt zurück, ob das gelungen ist. Ein „nein" muss der Aufrufer dem Menschen
 * sagen — sonst glaubt er, sein Stempel sei gemerkt, und er ist es nicht.
 */
export function einreihen(
  art: VorgangsArt,
  pfad: string,
  daten: Record<string, unknown>,
  methode: 'POST' | 'PATCH' = 'POST',
): { ok: boolean; vorgang?: Vorgang } {
  const vorgang: Vorgang = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    art, pfad, methode, daten,
    erzeugtAm: new Date().toISOString(),
    versuche: 0,
  }
  const ok = schreiben([...alle(), vorgang])
  return ok ? { ok, vorgang } : { ok: false }
}

export function entfernen(id: string): void {
  schreiben(alle().filter(v => v.id !== id))
}

export function aktualisieren(id: string, aenderung: Partial<Vorgang>): void {
  schreiben(alle().map(v => v.id === id ? { ...v, ...aenderung } : v))
}

export function leeren(): void {
  schreiben([])
}

// ── Was mit einer Antwort geschieht ────────────────────────────────────────

export type Ausgang =
  /** Angekommen — Vorgang ist erledigt */
  | 'erledigt'
  /** Dauerhaft abgelehnt — Vorgang fliegt raus, der Mensch erfährt es */
  | 'verworfen'
  /** Später noch einmal versuchen */
  | 'wiederholen'

export interface Beurteilung {
  ausgang: Ausgang
  /** Was dem Menschen gesagt wird, wenn etwas verworfen wurde */
  text?: string
}

/**
 * Was bedeutet diese Antwort für den Vorgang?
 *
 * Der schwierige Fall ist 409: Der Server sagt „passt gerade nicht" — etwa
 * „du bist bereits eingestempelt". Nach einem Funkloch ist das der Normalfall,
 * weil der Zustand inzwischen ein anderer ist. Ewig wiederholen hilft nicht;
 * der Vorgang fliegt raus, aber MIT Hinweis, damit jemand nachsieht.
 */
export function beurteilen(
  status: number | null,
  fehlertext?: string,
  versuche = 0,
): Beurteilung {
  // Kein Status heißt: Die Anfrage kam gar nicht an. Netz weg, später noch mal.
  if (status === null) {
    return versuche + 1 >= MAX_VERSUCHE
      ? {
        ausgang: 'verworfen',
        text: 'Konnte auch nach vielen Versuchen nicht übertragen werden. '
          + 'Bitte der Standortleitung Bescheid geben.',
      }
      : { ausgang: 'wiederholen' }
  }

  if (status >= 200 && status < 300) return { ausgang: 'erledigt' }

  if (status === 409) {
    return {
      ausgang: 'verworfen',
      text: fehlertext
        ? `Nicht übernommen: ${fehlertext}`
        : 'Nicht übernommen — der Stand hatte sich inzwischen geändert.',
    }
  }

  // 401: Die Anmeldung ist abgelaufen. Nach dem nächsten Anmelden geht es —
  // also behalten, nicht wegwerfen.
  if (status === 401) return { ausgang: 'wiederholen' }

  if (status >= 400 && status < 500) {
    return {
      ausgang: 'verworfen',
      text: fehlertext ?? 'Wurde abgelehnt und kann nicht nachgereicht werden.',
    }
  }

  // 5xx: Der Server hat ein Problem. Das geht vorbei.
  return versuche + 1 >= MAX_VERSUCHE
    ? { ausgang: 'verworfen', text: 'Der Server nimmt es dauerhaft nicht an.' }
    : { ausgang: 'wiederholen' }
}

// ── Der Zustand der Stempeluhr, solange nichts übertragen ist ──────────────

export interface Uhrzustand { laeuft: boolean; pause: boolean }

/**
 * Was die Stempeluhr anzeigen muss, wenn noch Stempel in der Schlange liegen.
 *
 * Der Server kennt sie noch nicht. Zeigte die App trotzdem seinen Stand, stünde
 * dort „nicht eingestempelt", obwohl die Person längst arbeitet — und sie würde
 * ein zweites Mal drücken.
 */
export function zustandMitWarteschlange(
  serverZustand: Uhrzustand,
  vorgaenge: Vorgang[],
): Uhrzustand {
  let zustand = { ...serverZustand }
  for (const v of vorgaenge) {
    if (v.art !== 'stempeln') continue
    switch (v.daten.aktion) {
      case 'kommen': zustand = { laeuft: true, pause: false }; break
      case 'gehen': zustand = { laeuft: false, pause: false }; break
      case 'pause-start': if (zustand.laeuft) zustand.pause = true; break
      case 'pause-ende': zustand.pause = false; break
    }
  }
  return zustand
}

/** Ein Satz über den Zustand der Schlange — für die Leiste am oberen Rand. */
export function schlangenText(vorgaenge: Vorgang[]): string {
  if (vorgaenge.length === 0) return ''
  if (vorgaenge.length === 1) {
    return `${ART_TEXT[vorgaenge[0].art]} wartet auf die Übertragung.`
  }
  const arten = Array.from(new Set(vorgaenge.map(v => ART_TEXT[v.art])))
  return `${vorgaenge.length} Einträge warten auf die Übertragung (${arten.join(', ')}).`
}
