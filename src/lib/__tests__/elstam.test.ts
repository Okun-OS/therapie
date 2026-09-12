import { describe, it, expect } from 'vitest'
import {
  elstamStandBewerten, trennzeichenErkennen, spaltenZuordnen, konfessionNormieren,
  zahlLesen, roemischOderZahl, listeLesen, abgleichen,
  type BestandsProfil,
} from '../elstam'

/**
 * §117 Eine falsch gelesene Änderungsliste ändert Steuerklassen. Das kostet
 * echtes Geld und der Arbeitgeber haftet dafür. Deshalb wird hier nicht nur
 * geprüft, dass etwas gelesen wird, sondern auch, dass NICHTS geändert wird,
 * was die Liste nicht sagt.
 */

describe('Alter des ELStAM-Standes', () => {
  it('meldet einen fehlenden Stand', () => {
    const r = elstamStandBewerten(null, 2026, 9)
    expect(r.aktuell).toBe(false)
    expect(r.hinweis).toMatch(/Kein ELStAM-Stand/)
  })

  it('nimmt einen Stand aus dem Abrechnungsmonat an', () => {
    expect(elstamStandBewerten('2026-09-01', 2026, 9).aktuell).toBe(true)
    expect(elstamStandBewerten('2026-09-28', 2026, 9).aktuell).toBe(true)
  })

  it('beanstandet einen Stand von vor dem Abrechnungsmonat', () => {
    const r = elstamStandBewerten('2026-08-31', 2026, 9)
    expect(r.aktuell).toBe(false)
    expect(r.hinweis).toMatch(/31\.08\.2026/)
  })

  it('nimmt einen neueren Stand an — nachgeholt ist besser als gar nicht', () => {
    expect(elstamStandBewerten('2026-10-05', 2026, 9).aktuell).toBe(true)
  })

  it('beanstandet Unfug im Datumsfeld', () => {
    expect(elstamStandBewerten('irgendwann', 2026, 9).aktuell).toBe(false)
  })
})

describe('Datei einlesen', () => {
  it('erkennt das Trennzeichen', () => {
    expect(trennzeichenErkennen('a;b;c;d')).toBe(';')
    expect(trennzeichenErkennen('a,b,c,d')).toBe(',')
    expect(trennzeichenErkennen('a\tb\tc')).toBe('\t')
  })

  it('erkennt Spalten trotz unterschiedlicher Benennung', () => {
    const z = spaltenZuordnen(['Steuer-ID', 'Nachname', 'StKl', 'Kinderfreibeträge', 'Konfession'])
    expect(z[0]).toBe('steuerId')
    expect(z[1]).toBe('name')
    expect(z[2]).toBe('steuerklasse')
    expect(z[3]).toBe('kinderfreibetraege')
    expect(z[4]).toBe('konfession')
  })

  it('liest Steuerklassen römisch wie arabisch', () => {
    expect(roemischOderZahl('III')).toBe(3)
    expect(roemischOderZahl('3')).toBe(3)
    expect(roemischOderZahl('VI')).toBe(6)
    expect(roemischOderZahl('Klasse 1')).toBe(1)
    expect(roemischOderZahl('X')).toBeNull()
  })

  it('liest Beträge in deutscher und englischer Schreibweise', () => {
    expect(zahlLesen('1.234,50')).toBe(1234.5)
    expect(zahlLesen('1234.50')).toBe(1234.5)
    expect(zahlLesen('0,5')).toBe(0.5)
    expect(zahlLesen('')).toBeNull()
  })

  it('erkennt die Konfession auch an den Kürzeln der Liste', () => {
    expect(konfessionNormieren('ev')).toBe('ev')
    expect(konfessionNormieren('evangelisch')).toBe('ev')
    expect(konfessionNormieren('rk')).toBe('rk')
    expect(konfessionNormieren('römisch-katholisch')).toBe('rk')
    expect(konfessionNormieren('--')).toBe('keine')
    expect(konfessionNormieren('vd')).toBe('keine')
    expect(konfessionNormieren('')).toBeNull()
  })

  it('liest eine ganze Liste mit Anführungszeichen', () => {
    const csv = [
      'Steuer-ID;Name;Steuerklasse;Kinderfreibeträge;Konfession;Freibetrag;Gültig ab',
      '12345678901;"Fischer, Anna";III;1,0;ev;0,00;2026-09-01',
      '98765432109;"Krüger, Daniel";I;0;--;1.200,00;2026-09-01',
    ].join('\r\n')
    const { saetze } = listeLesen(csv)
    expect(saetze).toHaveLength(2)
    expect(saetze[0].steuerklasse).toBe(3)
    expect(saetze[0].kinderfreibetraege).toBe(1)
    expect(saetze[0].konfession).toBe('ev')
    expect(saetze[1].konfession).toBe('keine')
    expect(saetze[1].freibetragMonat).toBe(1200)
  })

  it('kommt mit einer Datei mit Byte-Order-Mark zurecht', () => {
    const csv = '﻿Steuer-ID;Steuerklasse\n12345678901;IV'
    expect(listeLesen(csv).saetze[0].steuerklasse).toBe(4)
  })

  it('liefert bei leerem Inhalt nichts statt zu scheitern', () => {
    expect(listeLesen('').saetze).toHaveLength(0)
  })
})

describe('Abgleich mit dem Bestand', () => {
  const bestand: BestandsProfil[] = [
    { employeeId: 'e1', name: 'Anna Fischer', steuerId: '12345678901', personalnummer: '1042',
      steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine', freibetragMonat: null },
    { employeeId: 'e2', name: 'Daniel Krüger', steuerId: null, personalnummer: '2001',
      steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine' },
    { employeeId: 'e3', name: 'Maria Schneider', steuerId: null, personalnummer: null,
      steuerklasse: 4, kinderfreibetraege: 1, konfession: 'rk' },
  ]

  it('ordnet über die Steuer-ID zu und benennt die Änderungen', () => {
    const [a] = abgleichen([{ steuerId: '12345678901', steuerklasse: 3, kinderfreibetraege: 1, konfession: 'ev' }], bestand)
    expect(a.employeeId).toBe('e1')
    expect(a.zuordnung).toBe('steuerId')
    expect(a.aenderungen.map(x => x.feld).sort())
      .toEqual(['kinderfreibetraege', 'konfession', 'steuerklasse'])
    const stkl = a.aenderungen.find(x => x.feld === 'steuerklasse')!
    expect(stkl.bisher).toBe('1')
    expect(stkl.neu).toBe('3')
  })

  it('fällt auf die Personalnummer zurück', () => {
    const [a] = abgleichen([{ personalnummer: '2001', steuerklasse: 5 }], bestand)
    expect(a.employeeId).toBe('e2')
    expect(a.zuordnung).toBe('personalnummer')
  })

  it('ordnet notfalls über den Namen zu, sagt das aber deutlich', () => {
    const [a] = abgleichen([{ name: 'Maria Schneider', steuerklasse: 3 }], bestand)
    expect(a.employeeId).toBe('e3')
    expect(a.zuordnung).toBe('name')
    expect(a.hinweis).toMatch(/Namen zugeordnet/)
  })

  it('ordnet bei Namensgleichheit NICHT zu, sondern fragt', () => {
    const doppelt: BestandsProfil[] = [
      { employeeId: 'x1', name: 'Peter Meier', steuerklasse: 1 },
      { employeeId: 'x2', name: 'Peter Meier', steuerklasse: 3 },
    ]
    const [a] = abgleichen([{ name: 'Peter Meier', steuerklasse: 4 }], doppelt)
    expect(a.employeeId).toBeNull()
    expect(a.hinweis).toMatch(/heißen so/)
  })

  it('meldet einen Satz ohne passenden Mitarbeiter', () => {
    const [a] = abgleichen([{ steuerId: '00000000000', name: 'Fremd', steuerklasse: 1 }], bestand)
    expect(a.employeeId).toBeNull()
    expect(a.zuordnung).toBe('keine')
    expect(a.hinweis).toMatch(/Kein Mitarbeiter gefunden/)
  })

  it('meldet keine Änderung, wenn alles gleich ist', () => {
    const [a] = abgleichen([{ steuerId: '12345678901', steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine' }], bestand)
    expect(a.employeeId).toBe('e1')
    expect(a.aenderungen).toHaveLength(0)
  })

  it('rührt Felder NICHT an, die die Liste nicht nennt', () => {
    // Nur die Steuerklasse steht in der Liste — Konfession und Kinderfreibeträge
    // dürfen dadurch nicht auf "leer" gesetzt werden.
    const mitAllem: BestandsProfil[] = [{
      employeeId: 'e9', name: 'Test', steuerId: '11111111111',
      steuerklasse: 1, kinderfreibetraege: 2, konfession: 'ev', freibetragMonat: 300,
    }]
    const [a] = abgleichen([{ steuerId: '11111111111', steuerklasse: 3 }], mitAllem)
    expect(a.aenderungen).toHaveLength(1)
    expect(a.aenderungen[0].feld).toBe('steuerklasse')
  })

  it('erkennt einen entfallenen Freibetrag, wenn die Liste 0 nennt', () => {
    const mitFreibetrag: BestandsProfil[] = [{
      employeeId: 'e8', name: 'Test', steuerId: '22222222222',
      steuerklasse: 1, freibetragMonat: 300,
    }]
    const [a] = abgleichen([{ steuerId: '22222222222', freibetragMonat: 0 }], mitFreibetrag)
    expect(a.aenderungen).toEqual([
      { feld: 'freibetragMonat', bisher: '300', neu: '0' },
    ])
  })
})

describe('Vom Einlesen bis zur Änderung', () => {
  it('führt eine echte Liste bis zur Änderungsanzeige', () => {
    const csv = [
      'IdNr;Arbeitnehmer;St.Kl.;ZKF;KiSt;Freibetrag mtl.;Faktor',
      '12345678901;Anna Fischer;III;1,0;ev;;',
      '98765432109;Daniel Krüger;IV;0,5;--;250,00;0,842',
    ].join('\n')

    const { saetze, zuordnung } = listeLesen(csv)
    expect(Object.values(zuordnung)).toContain('steuerId')
    expect(Object.values(zuordnung)).toContain('faktor')

    const bestand: BestandsProfil[] = [
      { employeeId: 'a', name: 'Anna Fischer', steuerId: '12345678901', steuerklasse: 1, kinderfreibetraege: 0, konfession: 'keine' },
      { employeeId: 'd', name: 'Daniel Krüger', steuerId: '98765432109', steuerklasse: 4, kinderfreibetraege: 0.5, konfession: 'keine' },
    ]
    const abgleich = abgleichen(saetze, bestand)

    // Anna: Klasse und Kinderfreibetrag und Konfession neu
    expect(abgleich[0].aenderungen).toHaveLength(3)
    // Daniel: Klasse und Kinderfreibetrag unverändert, nur Freibetrag und Faktor neu
    expect(abgleich[1].aenderungen.map(x => x.feld).sort())
      .toEqual(['faktor', 'freibetragMonat'])
  })
})

/**
 * §134 Doppelte Kennzeichen.
 *
 * Gefunden, als mehrere Testprofile versehentlich dieselbe Steuer-ID trugen:
 * Der Abgleich nahm still den zuletzt geladenen Datensatz. In einem echten
 * Betrieb heißt das, dass jemand die Steuerklasse eines Kollegen bekommt —
 * und zwar ohne Warnung, denn die Steuer-ID gilt als das sichere Kennzeichen.
 */
describe('§134 Doppelte Steuer-ID und Personalnummer', () => {
  const satz = { steuerId: '12345678901', name: 'Anna Fischer', steuerklasse: 3 }

  it('ordnet bei doppelter Steuer-ID niemandem zu', () => {
    const [a] = abgleichen([satz], [
      { employeeId: 'a', name: 'Anna Fischer', steuerId: '12345678901' },
      { employeeId: 'b', name: 'Bea Klein', steuerId: '12345678901' },
    ])
    expect(a.employeeId).toBeNull()
    expect(a.zuordnung).toBe('keine')
    expect(a.hinweis).toContain('Steuer-ID')
  })

  it('sagt dazu, dass zuerst die Stammdaten zu bereinigen sind', () => {
    const [a] = abgleichen([satz], [
      { employeeId: 'a', name: 'Anna Fischer', steuerId: '12345678901' },
      { employeeId: 'b', name: 'Bea Klein', steuerId: '12345678901' },
    ])
    expect(a.hinweis).toMatch(/Stammdaten/)
  })

  it('ordnet bei doppelter Personalnummer ebenfalls nicht zu', () => {
    const [a] = abgleichen([{ personalnummer: '1042', steuerklasse: 3 }], [
      { employeeId: 'a', name: 'Anna Fischer', personalnummer: '1042' },
      { employeeId: 'b', name: 'Bea Klein', personalnummer: '1042' },
    ])
    expect(a.employeeId).toBeNull()
    expect(a.hinweis).toContain('Personalnummer')
  })

  it('ordnet bei eindeutiger Steuer-ID weiterhin zu', () => {
    const [a] = abgleichen([satz], [
      { employeeId: 'a', name: 'Anna Fischer', steuerId: '12345678901' },
      { employeeId: 'b', name: 'Bea Klein', steuerId: '99999999999' },
    ])
    expect(a.employeeId).toBe('a')
    expect(a.zuordnung).toBe('steuerId')
  })
})
