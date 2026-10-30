import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  siegelErzeugen, siegelPruefen, siegelNoetig,
  GUELTIG_MINUTEN, VERTRAULICHE_KATEGORIEN,
} from '../lohnsiegel'

/**
 * §201 Das Siegel vor der Lohnabrechnung.
 *
 * WARUM DAS HIER STEHT UND NICHT NUR IM NACHWEIS
 * Der Nachweis gegen das laufende System (`pruefungen/m-lohnsiegel.mjs`) kann
 * zeigen, dass ohne Passwort keine Datei kommt. Was er NICHT zeigen kann, ist
 * das Verstreichen der Viertelstunde — dafür müsste er fünfzehn Minuten lang
 * warten, und eine Prüfung, die so lange steht, läuft niemand mehr.
 *
 * Hier geht es, weil die Uhrzeit ein Übergabewert ist. Genau deshalb ist sie
 * einer: damit das Ablaufen prüfbar bleibt.
 */

const SICHERN = { ...process.env }

beforeEach(() => { process.env.SESSION_SECRET = 'test-geheimnis-fuer-das-siegel' })
afterEach(() => { process.env = { ...SICHERN } })

const JETZT = 1_700_000_000_000
const MINUTE = 60 * 1000

describe('§201 Wer gefragt wird', () => {
  it('fragt den Mitarbeiter vor der Lohnabrechnung', () => {
    expect(siegelNoetig('employee', 'lohnabrechnung')).toBe(true)
  })

  it('fragt ihn NICHT vor seinem Arbeitsvertrag', () => {
    // Die Gegenprobe zur Sperre: Wäre sie zu weit geraten, läge die ganze
    // Personalakte hinter dem Passwort — und der erste Krankenschein, den
    // jemand hochladen will, scheitert an einer Sperre, die ihn nicht meint.
    expect(siegelNoetig('employee', 'vertrag')).toBe(false)
    expect(siegelNoetig('employee', 'krankenschein')).toBe(false)
    expect(siegelNoetig('employee', 'bewerbung')).toBe(false)
  })

  it('fragt die Leitung gar nicht', () => {
    // Sie hat die Lohnliste aller Beschäftigten ohnehin offen. Ein verriegeltes
    // PDF daneben wäre Schaufenster-Sicherheit.
    for (const rolle of ['admin', 'company', 'okun']) {
      expect(siegelNoetig(rolle, 'lohnabrechnung')).toBe(false)
    }
  })

  it('kennt genau eine vertrauliche Kategorie', () => {
    // Monatsabrechnung und Jahresübersicht liegen beide darunter — wäre das
    // einmal nicht mehr so, fällt es hier auf und nicht beim Kunden.
    expect(VERTRAULICHE_KATEGORIEN).toEqual(['lohnabrechnung'])
  })
})

describe('§201 Das Siegel selbst', () => {
  it('lässt den durch, für den es ausgestellt wurde', () => {
    const marke = siegelErzeugen('nutzer-1', JETZT)
    expect(siegelPruefen(marke, 'nutzer-1', JETZT + MINUTE).gueltig).toBe(true)
  })

  it('gilt NICHT für jemand anderen am selben Gerät', () => {
    /*
     * Das ist der eigentliche Fall, gegen den die Sperre gebaut ist: ein
     * Tablet im Dienstzimmer, auf dem sich nach der Übergabe die nächste
     * Person anmeldet. Ohne diese Prüfung läge das Siegel der Vorgängerin
     * noch im Browser — und die Nachfolgerin käme ohne Passwort an ihre
     * Abrechnung. Die Sperre wäre damit wertlos.
     */
    const marke = siegelErzeugen('nutzer-1', JETZT)
    expect(siegelPruefen(marke, 'nutzer-2', JETZT + MINUTE).gueltig).toBe(false)
  })

  it('läuft nach der Viertelstunde ab', () => {
    const marke = siegelErzeugen('nutzer-1', JETZT)
    const kurzVorher = JETZT + (GUELTIG_MINUTEN - 1) * MINUTE
    const danach = JETZT + (GUELTIG_MINUTEN + 1) * MINUTE

    expect(siegelPruefen(marke, 'nutzer-1', kurzVorher).gueltig).toBe(true)
    expect(siegelPruefen(marke, 'nutzer-1', danach).gueltig).toBe(false)
  })

  it('sagt, wie viel Zeit noch bleibt', () => {
    const marke = siegelErzeugen('nutzer-1', JETZT)
    const stand = siegelPruefen(marke, 'nutzer-1', JETZT + 5 * MINUTE)
    expect(Math.round(stand.restMs / MINUTE)).toBe(GUELTIG_MINUTEN - 5)
  })

  it('gibt bei einem ungültigen Siegel keine Restzeit an', () => {
    expect(siegelPruefen('unsinn', 'nutzer-1', JETZT).restMs).toBe(0)
  })

  it('nimmt kein selbst geschriebenes Siegel an', () => {
    // Ohne Unterschrift wäre das Siegel nur eine Behauptung des Browsers —
    // und die kann jeder aufstellen, der die Entwicklerwerkzeuge öffnet.
    const inhalt = Buffer.from(JSON.stringify({ u: 'nutzer-1', iat: JETZT }))
      .toString('base64url')
    expect(siegelPruefen(`${inhalt}.erfunden`, 'nutzer-1', JETZT).gueltig).toBe(false)
    expect(siegelPruefen(`${inhalt}.`, 'nutzer-1', JETZT).gueltig).toBe(false)
    expect(siegelPruefen(inhalt, 'nutzer-1', JETZT).gueltig).toBe(false)
  })

  it('nimmt kein Siegel an, das mit einem anderen Geheimnis unterschrieben wurde', () => {
    const marke = siegelErzeugen('nutzer-1', JETZT)
    process.env.SESSION_SECRET = 'ein-ganz-anderes-geheimnis'
    expect(siegelPruefen(marke, 'nutzer-1', JETZT).gueltig).toBe(false)
  })

  it('nimmt kein Siegel aus der Zukunft an', () => {
    // Eine vorgestellte Uhr wäre sonst eine Verlängerung: Ein Siegel mit
    // Ausstellzeit in einer Stunde hielte sechzehn Minuten länger.
    const marke = siegelErzeugen('nutzer-1', JETZT + 60 * MINUTE)
    expect(siegelPruefen(marke, 'nutzer-1', JETZT).gueltig).toBe(false)
  })

  it('kommt mit fehlendem und unsinnigem Inhalt zurecht', () => {
    for (const unsinn of [undefined, null, '', 'a.b.c', '....']) {
      expect(siegelPruefen(unsinn, 'nutzer-1', JETZT).gueltig).toBe(false)
    }
  })

  it('ist nicht für jeden gleich', () => {
    // Zwei Siegel zur selben Zeit für verschiedene Leute müssen verschieden
    // aussehen — sonst wäre die Kennung gar nicht drin.
    expect(siegelErzeugen('a', JETZT)).not.toBe(siegelErzeugen('b', JETZT))
  })
})
