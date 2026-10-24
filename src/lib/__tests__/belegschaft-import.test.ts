import { describe, it, expect } from 'vitest'
import { lesen, platzhalterAdresse, istPlatzhalter } from '../belegschaft-import'

/**
 * §183 Die Belegschaft einlesen.
 *
 * WAS DIESE PRÜFUNGEN SCHÜTZEN
 * Hier entstehen achtzehn Personalakten auf einmal, aus einer Liste, die
 * jemand abgetippt oder kopiert hat. Jeder Fehler, der hier durchrutscht,
 * steht danach in den Stammdaten und fällt erst beim ersten Dienstplan auf —
 * wenn überhaupt. Eine falsche Stundenzahl macht einen schlechten Plan; ein
 * Tagesmuster, das nicht zur Stundenzahl passt, macht gar keinen.
 *
 * Deshalb wird hier nicht nur geprüft, dass Unsinn abgelehnt wird, sondern
 * ebenso, dass die normale Liste durchgeht. Ein Einleser, der zu viel ablehnt,
 * wird nicht benutzt.
 */

const GRUPPEN = ['Gruppe 1', 'Gruppe 5', 'Gruppe 7']
const MO_BIS_FR = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

describe('Eine Belegschaftsliste einlesen', () => {
  it('liest die übliche Zeile', () => {
    const r = lesen('Marin Berg; 40; 5; Gruppe 1; Erzieher; 5x8', GRUPPEN)
    expect(r.fehler).toEqual([])
    expect(r.zeilen).toHaveLength(1)
    expect(r.zeilen[0]).toMatchObject({
      name: 'Marin Berg', stunden: 40, tageProWoche: 5,
      gruppe: 'Gruppe 1', funktion: 'Erzieher',
      muster: [{ stunden: 8, tage: 5 }], freieTage: [], vorliebe: null,
    })
  })

  it('liest ein gemischtes Muster mit festem freien Tag', () => {
    const r = lesen('Heike Stein; 30; 4; Gruppe 5; Erzieher; 3x8+1x6; Fr', GRUPPEN, MO_BIS_FR)
    expect(r.fehler).toEqual([])
    expect(r.zeilen[0].muster).toEqual([{ stunden: 8, tage: 3 }, { stunden: 6, tage: 1 }])
    expect(r.zeilen[0].freieTage).toEqual(['Fr'])
  })

  it('kommt ohne Gruppe aus — Leitung und Springerin haben keine', () => {
    const r = lesen('Franke Leitner; 40; 5; ; Leitung', GRUPPEN)
    expect(r.fehler).toEqual([])
    expect(r.zeilen[0].gruppe).toBeNull()
    expect(r.zeilen[0].funktion).toBe('Leitung')
  })

  it('kommt ohne Tagesmuster aus — nicht jeder Betrieb hat feste Portionen', () => {
    const r = lesen('Jan Klaus; 40; 5; Gruppe 1; Erzieher', GRUPPEN)
    expect(r.fehler).toEqual([])
    expect(r.zeilen[0].muster).toBeNull()
  })

  it('übergeht Kopfzeile, Leerzeilen und Kommentare', () => {
    const r = lesen([
      '# die Belegschaft, Stand Oktober',
      'Name; Stunden; Tage/Woche; Gruppe; Funktion; Muster',
      '',
      'Marin Berg; 40; 5; Gruppe 1; Erzieher; 5x8',
      '   ',
    ].join('\n'), GRUPPEN)
    expect(r.fehler).toEqual([])
    expect(r.zeilen).toHaveLength(1)
  })

  it('nimmt auch Tabulatoren — so kommt es aus einer Tabelle', () => {
    const r = lesen('Marin Berg\t40\t5\tGruppe 1\tErzieher\t5x8', GRUPPEN)
    expect(r.fehler).toEqual([])
    expect(r.zeilen[0].name).toBe('Marin Berg')
  })

  it('versteht × und * als Malzeichen und Komma als Dezimaltrennung', () => {
    expect(lesen('A B; 30; 4; ; Kraft; 4×7,5', []).fehler).toEqual([])
    expect(lesen('C D; 30; 4; ; Kraft; 4*7.5', []).fehler).toEqual([])
  })

  // ── Der Fehler, der einen Standort planlos machte ────────────────────

  it('lehnt ein Muster ab, das nicht zur Stundenzahl passt', () => {
    const r = lesen('Marin Berg; 40; 5; Gruppe 1; Erzieher; 5x7', GRUPPEN)
    expect(r.zeilen).toEqual([])
    expect(r.fehler[0].text).toContain('35')
    expect(r.fehler[0].text).toContain('40')
  })

  it('lehnt ein Muster ab, das nicht genau die angegebenen Tage belegt', () => {
    // Fünf Arbeitstage angegeben, das Muster belegt vier — das wäre still ein
    // Vier-Tage-Vertrag.
    const r = lesen('Heike Stein; 32; 5; Gruppe 5; Erzieher; 4x8', GRUPPEN)
    expect(r.zeilen).toEqual([])
    expect(r.fehler[0].text).toMatch(/4 Arbeitstage.*5/)
  })

  it('lehnt mehr Arbeits- und freie Tage ab, als der Betrieb geöffnet hat', () => {
    // Fünf Arbeitstage plus ein fester freier Freitag — in einem
    // Montag-bis-Freitag-Betrieb unmöglich.
    const r = lesen('Heike Stein; 40; 5; Gruppe 5; Erzieher; 5x8; Fr', GRUPPEN, MO_BIS_FR)
    expect(r.zeilen).toEqual([])
    expect(r.fehler[0].text).toMatch(/Betriebstage/)
  })

  it('lehnt einen festen freien Tag ab, an dem der Betrieb ohnehin zu hat', () => {
    const r = lesen('Heike Stein; 30; 4; Gruppe 5; Erzieher; 3x8+1x6; Sa', GRUPPEN, MO_BIS_FR)
    expect(r.fehler[0].text).toContain('ohnehin zu')
  })

  // ── Alles andere, was schiefgehen kann ───────────────────────────────

  it('nennt die Zeilennummer und die rohe Zeile', () => {
    const r = lesen('Marin Berg; 40; 5; Gruppe 1; Erzieher; 5x8\nKaputt; viel', GRUPPEN)
    expect(r.fehler[0].zeile).toBe(2)
    expect(r.fehler[0].roh).toBe('Kaputt; viel')
  })

  it('lehnt eine Zeile ohne Namen ab', () => {
    expect(lesen('; 40; 5', []).fehler[0].text).toContain('Namen')
  })

  it('lehnt denselben Namen zweimal ab', () => {
    const r = lesen('Marin Berg; 40\nMarin Berg; 20', [])
    expect(r.fehler[0].text).toContain('Zeile 1')
  })

  it('lehnt unmögliche Stundenzahlen ab', () => {
    for (const std of ['-5', '80', 'viele', '']) {
      expect(lesen(`A B; ${std}; 5`, []).fehler).toHaveLength(1)
    }
  })

  it('lehnt unmögliche Arbeitstage ab', () => {
    for (const tage of ['0', '8', '3,5']) {
      expect(lesen(`A B; 40; ${tage}`, []).fehler).toHaveLength(1)
    }
  })

  it('lehnt eine Gruppe ab, die es am Standort nicht gibt', () => {
    const r = lesen('Marin Berg; 40; 5; Gruppe 99; Erzieher; 5x8', GRUPPEN)
    expect(r.fehler[0].text).toContain('Gruppe 99')
    expect(r.fehler[0].text).toContain('Gruppe 1')
  })

  it('nimmt die Gruppe ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    const r = lesen('Marin Berg; 40; 5; gruppe 1; Erzieher; 5x8', GRUPPEN)
    expect(r.fehler).toEqual([])
    expect(r.zeilen[0].gruppe).toBe('Gruppe 1')
  })

  it('lässt jede Gruppe durch, wenn der Standort noch keine hat', () => {
    const r = lesen('Marin Berg; 40; 5; Station Nord; Pflege; 5x8', [])
    expect(r.fehler).toEqual([])
    expect(r.zeilen[0].gruppe).toBe('Station Nord')
  })

  it('lehnt einen erfundenen Wochentag ab', () => {
    expect(lesen('A B; 40; 5; ; Kraft; 5x8; Fx', []).fehler[0].text).toContain('Wochentag')
  })

  it('lehnt eine erfundene Schichtvorliebe ab', () => {
    expect(lesen('A B; 40; 5; ; Kraft; 5x8; ; mittags', []).fehler[0].text)
      .toContain('Schichtvorliebe')
  })

  it('liest die Schichtvorliebe', () => {
    expect(lesen('A B; 40; 5; ; Kraft; 5x8; ; spaet', []).zeilen[0].vorliebe).toBe('spaet')
    expect(lesen('A B; 40; 5; ; Kraft; 5x8; ; früh', []).zeilen[0].vorliebe).toBe('frueh')
  })

  it('meldet eine leere Liste als Fehler statt stillschweigend nichts zu tun', () => {
    expect(lesen('   \n\n# nur ein Kommentar', []).fehler).toHaveLength(1)
  })

  it('gibt bei einem Fehler in EINER Zeile gar keine Zeilen zurück zum Anlegen', () => {
    // Die Schnittstelle legt nur an, wenn `fehler` leer ist — hier wird
    // festgehalten, dass der Fehler auch wirklich gemeldet wird und nicht
    // nur die eine Zeile verschluckt.
    const r = lesen([
      'Marin Berg; 40; 5; Gruppe 1; Erzieher; 5x8',
      'Heike Stein; 30; 5; Gruppe 5; Erzieher; 5x8',
    ].join('\n'), GRUPPEN)
    expect(r.fehler).toHaveLength(1)
    expect(r.zeilen).toHaveLength(1)
  })
})

describe('Die Adresse, die noch keine ist', () => {
  it('endet auf .invalid — dorthin kann nichts zugestellt werden', () => {
    const a = platzhalterAdresse('Heike Stein', 'standort-1')
    expect(a).toMatch(/\.invalid$/)
    expect(a).toContain('heike.stein')
  })

  it('macht aus Umlauten etwas Zustellbares', () => {
    expect(platzhalterAdresse('Jörg Müßig', 'l1')).toBe('joerg.muessig@l1.noch-ohne-adresse.invalid')
  })

  it('erkennt sich selbst wieder', () => {
    expect(istPlatzhalter(platzhalterAdresse('A B', 'l1'))).toBe(true)
  })

  it('hält eine echte Adresse NICHT für einen Platzhalter', () => {
    for (const echt of [
      'heike.stein@kita-regenbogen.de',
      'info@firma.invalid.de',
      '',
      null,
      undefined,
    ]) {
      expect(istPlatzhalter(echt)).toBe(false)
    }
  })

  it('erzeugt für zwei Standorte verschiedene Adressen', () => {
    expect(platzhalterAdresse('A B', 'l1')).not.toBe(platzhalterAdresse('A B', 'l2'))
  })
})
