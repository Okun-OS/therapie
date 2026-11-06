import { describe, it, expect } from 'vitest'
import {
  jahresWerte, bescheinigungsZeilen, zeitraumText, type MonatsWerte,
} from '../jahresabschluss'

/**
 * §125 Der teuerste Fehler beim Jahresabschluss: pauschal versteuerten
 * Arbeitslohn zu bescheinigen. Das Finanzamt besteuert ihn dann ein zweites
 * Mal — beim Mitarbeiter, der nichts davon ahnt.
 */

const monat = (m: number, ueberschreiben: Partial<MonatsWerte> = {}): MonatsWerte => ({
  month: m,
  brutto: 3400, steuerBrutto: 3400, svBrutto: 3400,
  steuerfreieZuschlaege: 0, sonstigeBezuege: 0,
  lohnsteuer: 388.33, kirchensteuer: 0, soli: 0,
  rvAN: 316.2, kvAN: 277.1, pvAN: 81.6, avAN: 44.2,
  rvAG: 316.2, kvAG: 277.1, pvAG: 61.2, avAG: 44.2,
  pauschsteuerAG: 0,
  beschaeftigungsart: 'regulaer',
  svTage: 30,
  insuranceType: 'GKV',
  ...ueberschreiben,
})

describe('Jahreswerte bilden', () => {
  it('summiert ein volles Jahr', () => {
    const w = jahresWerte(2026, Array.from({ length: 12 }, (_, i) => monat(i + 1)))
    expect(w.vonMonat).toBe(1)
    expect(w.bisMonat).toBe(12)
    expect(w.bruttoarbeitslohn).toBeCloseTo(3400 * 12, 2)
    expect(w.lohnsteuer).toBeCloseTo(388.33 * 12, 2)
    expect(w.svTageGesamt).toBe(360)
    expect(w.bescheinigungspflichtig).toBe(true)
  })

  it('erkennt einen unterjährigen Eintritt', () => {
    const w = jahresWerte(2026, [7, 8, 9, 10, 11, 12].map(m => monat(m)))
    expect(w.vonMonat).toBe(7)
    expect(w.bisMonat).toBe(12)
    expect(w.bruttoarbeitslohn).toBeCloseTo(3400 * 6, 2)
  })

  it('meldet Lücken im Beschäftigungszeitraum', () => {
    // Januar bis Mai, dann Lücke, dann Oktober bis Dezember
    const w = jahresWerte(2026, [1, 2, 3, 4, 5, 10, 11, 12].map(m => monat(m)))
    expect(w.monateOhneAbrechnung).toEqual([6, 7, 8, 9])
    expect(w.hinweise.join(' ')).toMatch(/Großbuchstabe U/)
  })

  it('liefert für ein Jahr ohne Abrechnung nichts, aber sagt es', () => {
    const w = jahresWerte(2026, [])
    expect(w.bescheinigungspflichtig).toBe(false)
    expect(w.hinweise.join(' ')).toMatch(/keine Abrechnung/)
  })
})

describe('Steuerfreie Zuschläge gehören nicht in den Bruttoarbeitslohn', () => {
  it('lässt sie aus dem Bruttoarbeitslohn heraus', () => {
    // Gesamtbrutto 3600, davon 200 steuerfrei → Steuerbrutto 3400
    const w = jahresWerte(2026, [
      monat(1, { brutto: 3600, steuerBrutto: 3400, steuerfreieZuschlaege: 200 }),
    ])
    expect(w.bruttoarbeitslohn).toBeCloseTo(3400, 2)
    expect(w.gesamtbrutto).toBeCloseTo(3600, 2)
    expect(w.steuerfreieZuschlaege).toBeCloseTo(200, 2)
  })

  it('sagt das auch auf dem Papier', () => {
    const w = jahresWerte(2026, [
      monat(1, { brutto: 3600, steuerBrutto: 3400, steuerfreieZuschlaege: 200 }),
    ])
    expect(w.hinweise.join(' ')).toMatch(/§3b/)
  })

  it('rechnet Einmalzahlungen in den Bruttoarbeitslohn hinein', () => {
    const w = jahresWerte(2026, [monat(11, { sonstigeBezuege: 3400 })])
    expect(w.bruttoarbeitslohn).toBeCloseTo(3400 + 3400, 2)
    expect(w.sonstigeBezuege).toBeCloseTo(3400, 2)
  })
})

describe('Pauschal versteuerter Arbeitslohn wird NICHT bescheinigt', () => {
  const minijobMonat = (m: number) => monat(m, {
    brutto: 500, steuerBrutto: 500, svBrutto: 500,
    lohnsteuer: 0, rvAN: 18, kvAN: 0, pvAN: 0, avAN: 0,
    rvAG: 75, kvAG: 65, pvAG: 0, avAG: 0,
    pauschsteuerAG: 10, beschaeftigungsart: 'minijob',
  })

  it('lässt einen reinen Minijob ganz heraus', () => {
    const w = jahresWerte(2026, [1, 2, 3].map(minijobMonat))
    expect(w.bruttoarbeitslohn).toBe(0)
    expect(w.lohnsteuer).toBe(0)
    expect(w.pauschalVersteuert).toBeCloseTo(1500, 2)
    expect(w.bescheinigungspflichtig).toBe(false)
  })

  it('erklärt warum', () => {
    const w = jahresWerte(2026, [1].map(minijobMonat))
    expect(w.hinweise.join(' ')).toMatch(/§40a/)
    expect(w.hinweise.join(' ')).toMatch(/NICHT bescheinigt/)
  })

  it('trennt sauber, wenn jemand vom Minijob in ein reguläres Verhältnis wechselt', () => {
    const w = jahresWerte(2026, [
      minijobMonat(1), minijobMonat(2),
      monat(3), monat(4),
    ])
    // Nur die regulären Monate werden bescheinigt
    expect(w.bruttoarbeitslohn).toBeCloseTo(3400 * 2, 2)
    expect(w.lohnsteuer).toBeCloseTo(388.33 * 2, 2)
    expect(w.pauschalVersteuert).toBeCloseTo(1000, 2)
    expect(w.bescheinigungspflichtig).toBe(true)
  })

  it('bescheinigt einen Minijob mit individueller Besteuerung sehr wohl', () => {
    // Kein Pauschsteuerbetrag → wird nach ELStAM besteuert → gehört bescheinigt
    const w = jahresWerte(2026, [monat(1, {
      brutto: 500, steuerBrutto: 500, lohnsteuer: 12,
      beschaeftigungsart: 'minijob', pauschsteuerAG: 0,
    })])
    expect(w.bruttoarbeitslohn).toBeCloseTo(500, 2)
    expect(w.bescheinigungspflichtig).toBe(true)
  })
})

describe('Privat Versicherte', () => {
  it('bekommen einen Hinweis auf den Arbeitgeberzuschuss', () => {
    const w = jahresWerte(2026, [monat(1, { insuranceType: 'PKV' })])
    expect(w.hinweise.join(' ')).toMatch(/Arbeitgeberzuschuss/)
  })
})

describe('Die Zeilen der Bescheinigung', () => {
  it('nennt jeden Wert beim Namen', () => {
    const w = jahresWerte(2026, [monat(1)])
    const namen = bescheinigungsZeilen(w).map(z => z.bezeichnung)
    expect(namen).toContain('Bruttoarbeitslohn einschließlich Sachbezüge')
    expect(namen).toContain('Einbehaltene Lohnsteuer')
    expect(namen).toContain('Arbeitgeberanteil zur gesetzlichen Rentenversicherung')
    expect(namen).toContain('Arbeitnehmerbeiträge zur sozialen Pflegeversicherung')
  })

  it('lässt Zeilen weg, die null sind', () => {
    const w = jahresWerte(2026, [monat(1, { kirchensteuer: 0, soli: 0 })])
    const namen = bescheinigungsZeilen(w).map(z => z.bezeichnung)
    expect(namen).not.toContain('Einbehaltene Kirchensteuer des Arbeitnehmers')
    expect(namen).not.toContain('Einbehaltener Solidaritätszuschlag')
  })
})

describe('Zeitraum als Text', () => {
  it('nennt Anfang und Ende', () => {
    expect(zeitraumText(jahresWerte(2026, [monat(3), monat(4), monat(5)])))
      .toBe('März bis Mai 2026')
  })

  it('nennt einen einzelnen Monat einzeln', () => {
    expect(zeitraumText(jahresWerte(2026, [monat(7)]))).toBe('Juli 2026')
  })

  it('kommt mit einem leeren Jahr zurecht', () => {
    expect(zeitraumText(jahresWerte(2026, []))).toBe('—')
  })
})
