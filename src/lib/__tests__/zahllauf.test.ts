import { describe, it, expect } from 'vitest'
import {
  naechsteStaende, standErlaubt, abrechnungsstandFuer, entscheideLauf,
  naechsterBankarbeitstag, pruefeAusfuehrung,
} from '../zahllauf'

/**
 * §218 Der Zahlungslauf.
 *
 * Hier wird entschieden, ob Gehälter ein zweites Mal überwiesen werden
 * können. Jeder Fall einzeln, und die Gegenproben ausdrücklich: Eine Regel,
 * die nur in eine Richtung geprüft ist, ist keine.
 */

describe('§218 Welcher Stand auf welchen folgt', () => {
  it('führt vom erzeugten Lauf zum eingereichten oder verworfenen', () => {
    expect(naechsteStaende('erzeugt')).toEqual(['eingereicht', 'verworfen'])
  })

  it('kennt nach dem Einreichen nur noch die Antwort der Bank', () => {
    expect(naechsteStaende('eingereicht')).toEqual(['ausgefuehrt', 'abgelehnt'])
  })

  it('lässt einen eingereichten Lauf NICHT verwerfen', () => {
    // Eine eingereichte Datei verwirft man bei der Bank, nicht in der
    // Software. Ein Knopf, der das Gegenteil suggeriert, wäre gefährlich.
    expect(standErlaubt('eingereicht', 'verworfen')).toBe(false)
  })

  it('macht nichts rückgängig, was die Bank getan hat', () => {
    expect(naechsteStaende('ausgefuehrt')).toEqual([])
    expect(naechsteStaende('abgelehnt')).toEqual([])
    expect(naechsteStaende('verworfen')).toEqual([])
  })

  it('springt nicht über das Einreichen hinweg', () => {
    expect(standErlaubt('erzeugt', 'ausgefuehrt')).toBe(false)
  })
})

describe('§218 Was ein Stand für die Abrechnungen bedeutet', () => {
  it('setzt sie mit dem Einreichen auf bezahlt', () => {
    // Nicht erst mit der Ausführung: Dazwischen läge ein Fenster, in dem
    // dieselbe Abrechnung in einen zweiten Lauf geraten könnte.
    expect(abrechnungsstandFuer('eingereicht')).toBe('paid')
  })

  it('gibt sie bei Ablehnung und beim Verwerfen wieder frei', () => {
    expect(abrechnungsstandFuer('abgelehnt')).toBe('approved')
    expect(abrechnungsstandFuer('verworfen')).toBe('approved')
  })

  it('lässt sie beim Erzeugen und beim Ausführen unverändert', () => {
    expect(abrechnungsstandFuer('erzeugt')).toBeNull()
    expect(abrechnungsstandFuer('ausgefuehrt')).toBeNull()
  })
})

describe('§218 Darf aus diesem Inhalt eine Datei entstehen?', () => {
  const K = 'OKUN-202610-ABCDEF0123'

  it('legt ohne vorhandenen Lauf einen neuen an', () => {
    expect(entscheideLauf(K, [])).toEqual({ art: 'neu' })
  })

  it('gibt bei gleichem Inhalt die gespeicherte Datei zurück', () => {
    expect(entscheideLauf(K, [{ kennung: K, status: 'erzeugt' }]))
      .toEqual({ art: 'wiederholung', kennung: K })
  })

  it('löst einen nur erzeugten Lauf mit anderem Inhalt ab', () => {
    // Heruntergeladen heißt nicht eingereicht. Der häufigste Fall ist:
    // Fehler bemerkt, korrigiert, neu heruntergeladen.
    expect(entscheideLauf(K, [{ kennung: 'OKUN-202610-0000000000', status: 'erzeugt' }]))
      .toEqual({ art: 'abloesen', kennung: 'OKUN-202610-0000000000' })
  })

  it('BLOCKIERT, solange ein Lauf bei der Bank eingereicht ist', () => {
    // Der Kern der ganzen Sache: Jetzt ist Geld unterwegs.
    const e = entscheideLauf(K, [{ kennung: 'OKUN-202610-1111111111', status: 'eingereicht' }])
    expect(e.art).toBe('blockiert')
    expect(e.art === 'blockiert' && e.grund).toContain('eingereicht')
  })

  it('blockiert auch dann, wenn daneben ein erzeugter Lauf liegt', () => {
    const e = entscheideLauf(K, [
      { kennung: 'OKUN-202610-2222222222', status: 'erzeugt' },
      { kennung: 'OKUN-202610-1111111111', status: 'eingereicht' },
    ])
    expect(e.art).toBe('blockiert')
  })

  it('lässt nach einer ausgeführten Zahlung eine Nachzahlung zu', () => {
    expect(entscheideLauf(K, [{ kennung: 'OKUN-202610-3333333333', status: 'ausgefuehrt' }]))
      .toEqual({ art: 'neu' })
  })

  it('lässt nach einer Ablehnung eine neue Datei zu', () => {
    expect(entscheideLauf(K, [{ kennung: 'OKUN-202610-4444444444', status: 'abgelehnt' }]))
      .toEqual({ art: 'neu' })
  })

  it('behandelt einen verworfenen Lauf gleicher Kennung als nicht vorhanden', () => {
    // Sonst gäbe eine Wiederholung die Datei eines Laufs aus, den jemand
    // ausdrücklich verworfen hat.
    expect(entscheideLauf(K, [{ kennung: K, status: 'verworfen' }]))
      .toEqual({ art: 'neu' })
  })
})

describe('§218 Das Ausführungsdatum', () => {
  it('hält zwei Tage Vorlauf ein', () => {
    // Montag, 5.10.2026 → Mittwoch, 7.10.
    expect(naechsterBankarbeitstag(new Date('2026-10-05T09:00:00.000Z'), 2, 'Nordrhein-Westfalen'))
      .toBe('2026-10-07')
  })

  it('überspringt das Wochenende', () => {
    // Donnerstag + 2 = Samstag → Montag
    expect(naechsterBankarbeitstag(new Date('2026-10-08T09:00:00.000Z'), 2, 'Nordrhein-Westfalen'))
      .toBe('2026-10-12')
  })

  it('überspringt einen bundesweiten Feiertag', () => {
    // 1. Mai 2026 ist ein Freitag und bundesweit Feiertag → Montag, 4. Mai.
    expect(naechsterBankarbeitstag(new Date('2026-04-29T09:00:00.000Z'), 2, 'Nordrhein-Westfalen'))
      .toBe('2026-05-04')
  })

  it('kennt den Unterschied zwischen den Bundesländern', () => {
    // Fronleichnam, 4.6.2026 (Donnerstag): in Nordrhein-Westfalen ein
    // Feiertag, in Berlin nicht. Genau daran scheitert eine Datei, die mit
    // einem bundesweiten Kalender gerechnet wurde.
    const ab = new Date('2026-06-02T09:00:00.000Z')
    expect(naechsterBankarbeitstag(ab, 2, 'Nordrhein-Westfalen')).toBe('2026-06-05')
    expect(naechsterBankarbeitstag(ab, 2, 'Berlin')).toBe('2026-06-04')
  })

  it('rechnet ohne Bundesland strenger statt lockerer', () => {
    // Die meisten Standorte haben kein Bundesland hinterlegt. Ohne Angabe
    // gilt jeder Tag als Feiertag, der irgendwo in Deutschland einer ist —
    // sonst stünde an Fronleichnam ein Datum in der Datei, das die Bank in
    // Nordrhein-Westfalen zurückweist.
    const ab = new Date('2026-06-02T09:00:00.000Z')
    expect(naechsterBankarbeitstag(ab, 2, null)).toBe('2026-06-05')
  })

  it('kommt ohne Bundesland trotzdem auf einen Werktag', () => {
    const tag = naechsterBankarbeitstag(new Date('2026-10-08T09:00:00.000Z'), 2, null)
    expect(new Date(`${tag}T00:00:00.000Z`).getUTCDay()).not.toBe(0)
    expect(new Date(`${tag}T00:00:00.000Z`).getUTCDay()).not.toBe(6)
  })
})

describe('§218 Ein gewünschtes Datum wird geprüft, nicht verschoben', () => {
  it('nimmt einen gewöhnlichen Werktag an', () => {
    expect(pruefeAusfuehrung('2026-10-07', 'Nordrhein-Westfalen')).toEqual({ ok: true })
  })

  it('lehnt ein Wochenende ab und sagt warum', () => {
    const e = pruefeAusfuehrung('2026-10-10', 'Nordrhein-Westfalen')
    expect(e.ok).toBe(false)
    expect(e.ok === false && e.grund).toContain('Wochenende')
  })

  it('lehnt einen Feiertag ab', () => {
    const e = pruefeAusfuehrung('2026-05-01', 'Nordrhein-Westfalen')
    expect(e.ok).toBe(false)
    expect(e.ok === false && e.grund).toContain('Feiertag')
  })

  it('lehnt ein unbrauchbares Datum ab', () => {
    expect(pruefeAusfuehrung('07.10.2026', 'Nordrhein-Westfalen').ok).toBe(false)
    expect(pruefeAusfuehrung('2026-02-30', 'Nordrhein-Westfalen').ok).toBe(false)
  })

  it('verschiebt nichts stillschweigend', () => {
    // Wer einen Zahltag nennt, soll nicht an einem anderen zahlen. Die
    // Funktion gibt deshalb kein Datum zurück, sondern ein Urteil.
    const e = pruefeAusfuehrung('2026-10-10', 'Nordrhein-Westfalen')
    expect(JSON.stringify(e)).not.toContain('2026-10-12')
  })
})
