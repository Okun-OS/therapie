import { describe, it, expect } from 'vitest'
import {
  ibanGueltig, sepaZeichen, sepaXml, datevCsv, datevZeilenAusAbrechnung,
  zahlungsKennung, ibanGekuerzt,
} from '../lohn-export'

// §114 Diese Dateien gehen an eine Bank und an einen Steuerberater. Ein Fehler
// fällt dort auf, nicht hier — deshalb wird gerechnet statt vermutet.

describe('IBAN-Prüfsumme', () => {
  it('erkennt gültige deutsche IBANs', () => {
    expect(ibanGueltig('DE89370400440532013000')).toBe(true)
    expect(ibanGueltig('DE02120300000000202051')).toBe(true)
  })

  it('erkennt gültige IBANs mit Leerzeichen und Kleinschreibung', () => {
    expect(ibanGueltig('de89 3704 0044 0532 0130 00')).toBe(true)
  })

  it('lehnt eine IBAN mit falscher Prüfziffer ab', () => {
    expect(ibanGueltig('DE88370400440532013000')).toBe(false)
  })

  it('lehnt eine vertauschte Ziffernfolge ab', () => {
    expect(ibanGueltig('DE89370400440532013100')).toBe(false)
  })

  it('lehnt Unfug ab', () => {
    for (const unfug of ['', 'kein-konto', 'DE89', '1234567890', 'XX00ABCD']) {
      expect(ibanGueltig(unfug)).toBe(false)
    }
  })

  it('erkennt auch ausländische IBANs', () => {
    expect(ibanGueltig('AT611904300234573201')).toBe(true)
    expect(ibanGueltig('CH9300762011623852957')).toBe(true)
  })
})

describe('SEPA-Zeichensatz', () => {
  it('ersetzt Umlaute statt sie zu verlieren', () => {
    expect(sepaZeichen('Jürgen Müller-Groß')).toBe('Juergen Mueller-Gross')
    expect(sepaZeichen('Änderung Öffnung')).toBe('Aenderung Oeffnung')
  })

  it('entfernt Zeichen, die SEPA nicht kennt', () => {
    expect(sepaZeichen('Gehalt #1 @Firma')).not.toMatch(/[#@]/)
  })

  it('behält erlaubte Satzzeichen', () => {
    expect(sepaZeichen('Gehalt 09/2026 (Nachzahlung)')).toBe('Gehalt 09/2026 (Nachzahlung)')
  })
})

describe('SEPA-Datei', () => {
  const auftraggeber = { name: 'Reha-Zentrum Köln GmbH', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' }
  const zahlungen = [
    { name: 'Anna Fischer', iban: 'DE02120300000000202051', bic: 'BYLADEM1001', betrag: 2145.67, verwendungszweck: 'Gehalt September 2026' },
    { name: 'Jürgen Müller', iban: 'AT611904300234573201', betrag: 1899.5, verwendungszweck: 'Gehalt September 2026' },
  ]
  const xml = sepaXml(auftraggeber, zahlungen, '2026-09-30', 'PRUEF-1')

  it('nennt das richtige Format', () => {
    expect(xml).toContain('pain.001.001.03')
  })

  it('zählt die Zahlungen korrekt', () => {
    expect(xml).toContain('<NbOfTxs>2</NbOfTxs>')
  })

  it('bildet die Kontrollsumme exakt — daran scheitern Dateien am häufigsten', () => {
    // 2145.67 + 1899.50 = 4045.17
    expect(xml).toContain('<CtrlSum>4045.17</CtrlSum>')
  })

  it('schreibt Beträge mit zwei Nachkommastellen', () => {
    expect(xml).toContain('<InstdAmt Ccy="EUR">2145.67</InstdAmt>')
    expect(xml).toContain('<InstdAmt Ccy="EUR">1899.50</InstdAmt>')
  })

  it('überträgt IBANs ohne Leerzeichen und in Großschreibung', () => {
    expect(xml).toContain('<IBAN>DE02120300000000202051</IBAN>')
    expect(xml).toContain('<IBAN>DE89370400440532013000</IBAN>')
  })

  it('kommt ohne BIC des Empfängers aus', () => {
    expect(xml).toContain('<Nm>Juergen Mueller</Nm>')
  })

  it('enthält keine Umlaute mehr', () => {
    expect(xml).not.toMatch(/[äöüÄÖÜß]/)
  })

  it('trägt das gewünschte Ausführungsdatum', () => {
    expect(xml).toContain('<ReqdExctnDt>2026-09-30</ReqdExctnDt>')
  })

  it('maskiert Sonderzeichen im XML', () => {
    const heikel = sepaXml({ name: 'Meier & Sohn', iban: auftraggeber.iban },
      [{ name: 'A<B', iban: zahlungen[0].iban, betrag: 1, verwendungszweck: 'x' }], '2026-09-30')
    expect(heikel).not.toMatch(/<Nm>[^<]*[<&][^<]*<\/Nm>/)
  })
})

describe('DATEV-Export', () => {
  const abrechnung = {
    employeeId: 'cmabcdefgh12345678',
    employeeName: 'Anna Fischer',
    personalnummer: '1042',
    brutto: 3400, surchargesTotal: 200,
    regularHours: 151.67, overtimeHours: 8,
    lohnsteuer: 412.33, kirchensteuer: 33, soli: 0,
    rvAN: 316.2, kvAN: 289, pvAN: 79.9, avAN: 44.2,
    netto: 2225.37,
  }

  it('erzeugt für jede Position eine Zeile', () => {
    const zeilen = datevZeilenAusAbrechnung(abrechnung)
    const arten = zeilen.map(z => z.bezeichnung)
    expect(arten).toContain('Grundentgelt')
    expect(arten).toContain('Zuschläge')
    expect(arten).toContain('Lohnsteuer')
    expect(arten).toContain('Auszahlungsbetrag')
  })

  it('trennt Grundentgelt und Zuschläge korrekt', () => {
    const zeilen = datevZeilenAusAbrechnung(abrechnung)
    expect(zeilen.find(z => z.bezeichnung === 'Grundentgelt')?.betrag).toBe(3200)
    expect(zeilen.find(z => z.bezeichnung === 'Zuschläge')?.betrag).toBe(200)
  })

  it('lässt Abzüge weg, die null sind', () => {
    const zeilen = datevZeilenAusAbrechnung(abrechnung)
    expect(zeilen.some(z => z.bezeichnung === 'Solidaritätszuschlag')).toBe(false)
  })

  it('nutzt die interne Kennung, wenn keine Personalnummer da ist', () => {
    const ohne = datevZeilenAusAbrechnung({ ...abrechnung, personalnummer: null })
    expect(ohne[0].personalnummer).toBe('gh12345678'.slice(-8))
    expect(ohne[0].personalnummer).not.toBe('')
  })

  it('schreibt Beträge mit Komma — sonst liest DATEV falsch', () => {
    const csv = datevCsv(
      { jahr: 2026, monat: 9, mandantName: 'Reha', beraternummer: '12345', mandantennummer: '678' },
      datevZeilenAusAbrechnung(abrechnung),
    )
    expect(csv).toContain('"3200,00"')
    expect(csv).not.toContain('"3200.00"')
  })

  it('nennt Berater, Mandant und Zeitraum im Kopf', () => {
    const csv = datevCsv(
      { jahr: 2026, monat: 9, mandantName: 'Reha-Zentrum', beraternummer: '12345', mandantennummer: '678' },
      [],
    )
    expect(csv).toContain('Berater 12345')
    expect(csv).toContain('Mandant 678')
    expect(csv).toContain('09.2026')
  })

  it('führt die Arbeitgeberanteile als eigene Lohnarten', () => {
    const zeilen = datevZeilenAusAbrechnung({
      ...abrechnung, rvAG: 316.2, kvAG: 289, pvAG: 61.2, avAG: 44.2,
    })
    const arten = zeilen.map(z => z.bezeichnung)
    expect(arten).toContain('Rentenversicherung AG')
    expect(arten).toContain('Krankenversicherung AG')
  })

  it('führt beim Minijob die Pauschalen — sonst fehlen dem Berater alle Abgaben', () => {
    const minijob = datevZeilenAusAbrechnung({
      ...abrechnung, brutto: 500, surchargesTotal: 0,
      lohnsteuer: 0, kirchensteuer: 0, soli: 0,
      rvAN: 18, kvAN: 0, pvAN: 0, avAN: 0,
      rvAG: 75, kvAG: 65, pvAG: 0, avAG: 0,
      pauschsteuerAG: 10, netto: 482, auszahlungsbetrag: 482,
      beschaeftigungsart: 'minijob',
    })
    const zeile = (b: string) => minijob.find(z => z.bezeichnung === b)
    expect(zeile('Rentenversicherung AG')?.betrag).toBe(75)
    expect(zeile('Krankenversicherung AG')?.betrag).toBe(65)
    expect(zeile('Pauschsteuer AG (§40a EStG)')?.betrag).toBe(10)
    expect(zeile('Auszahlungsbetrag')?.betrag).toBe(482)
    // Ohne Lohnsteuer darf auch keine Lohnsteuerzeile entstehen
    expect(zeile('Lohnsteuer')).toBeUndefined()
  })

  it('maskiert Anführungszeichen in Namen', () => {
    const csv = datevCsv({ jahr: 2026, monat: 9, mandantName: 'A"B' }, [])
    expect(csv).toContain('"A""B"')
  })

  it('nutzt Windows-Zeilenenden', () => {
    const csv = datevCsv({ jahr: 2026, monat: 9, mandantName: 'X' }, [])
    expect(csv).toContain('\r\n')
  })
})

/**
 * §217 Die Kennung des Zahlungslaufs.
 *
 * Vorher war sie `OKUN-${Date.now()}` — zwei Abrufe desselben Monats ergaben
 * zwei verschiedene Aufträge, und eine Bank nimmt beide an. Diese Prüfungen
 * halten beide Eigenschaften fest, auf die es ankommt: gleicher Lauf gleiche
 * Kennung (sonst zahlt jemand doppelt), geänderter Lauf andere Kennung
 * (sonst wird die berechtigte Korrektur als Dublette abgelehnt).
 */
describe('§217 Kennung des Zahlungslaufs', () => {
  const lauf = { customerId: 'kunde-1', jahr: 2026, monat: 10, locationId: null }
  const zahlungen = [
    { iban: 'DE89370400440532013000', betrag: 1850.42 },
    { iban: 'DE02120300000000202051', betrag: 2200.00 },
  ]

  it('ist bei gleichem Lauf dieselbe — das ist der Schutz vor Doppelzahlung', () => {
    expect(zahlungsKennung(lauf, zahlungen)).toBe(zahlungsKennung(lauf, zahlungen))
  })

  it('hängt nicht an der Reihenfolge der Abrechnungen', () => {
    // Sonst wäre derselbe Lauf je nach Sortierung ein anderer Auftrag.
    expect(zahlungsKennung(lauf, [...zahlungen].reverse()))
      .toBe(zahlungsKennung(lauf, zahlungen))
  })

  it('ändert sich, wenn ein Betrag korrigiert wurde', () => {
    const korrigiert = [{ ...zahlungen[0], betrag: 1900 }, zahlungen[1]]
    expect(zahlungsKennung(lauf, korrigiert)).not.toBe(zahlungsKennung(lauf, zahlungen))
  })

  it('ändert sich, wenn jemand dazukommt', () => {
    const mehr = [...zahlungen, { iban: 'DE12500105170648489890', betrag: 900 }]
    expect(zahlungsKennung(lauf, mehr)).not.toBe(zahlungsKennung(lauf, zahlungen))
  })

  it('ändert sich, wenn ein Empfängerkonto getauscht wurde', () => {
    const getauscht = [{ ...zahlungen[0], iban: 'DE12500105170648489890' }, zahlungen[1]]
    expect(zahlungsKennung(lauf, getauscht)).not.toBe(zahlungsKennung(lauf, zahlungen))
  })

  it('unterscheidet Monat, Mandant und Standortauswahl', () => {
    const eine = zahlungsKennung(lauf, zahlungen)
    expect(zahlungsKennung({ ...lauf, monat: 11 }, zahlungen)).not.toBe(eine)
    expect(zahlungsKennung({ ...lauf, customerId: 'kunde-2' }, zahlungen)).not.toBe(eine)
    expect(zahlungsKennung({ ...lauf, locationId: 'standort-1' }, zahlungen)).not.toBe(eine)
  })

  it('passt in das Feld, das SEPA dafür vorsieht', () => {
    const k = zahlungsKennung(lauf, zahlungen)
    expect(k.length).toBeLessThanOrEqual(35)
    expect(k).toMatch(/^OKUN-202610-[0-9A-F]{10}$/)
  })

  it('steht wirklich in der erzeugten Datei', () => {
    const k = zahlungsKennung(lauf, zahlungen)
    const xml = sepaXml(
      { name: 'Traeger', iban: 'DE89370400440532013000' },
      zahlungen.map(z => ({ ...z, name: 'A', verwendungszweck: 'Gehalt' })),
      '2026-10-28', k,
    )
    expect(xml).toContain(`<MsgId>${k}</MsgId>`)
  })
})

describe('§217 Gekürzte IBAN fürs Protokoll', () => {
  it('zeigt Anfang und Ende, nicht die Mitte', () => {
    expect(ibanGekuerzt('DE89370400440532013000')).toBe('DE89…3000')
  })

  it('verträgt Leerzeichen und Kleinschreibung', () => {
    expect(ibanGekuerzt('de89 3704 0044 0532 0130 00')).toBe('DE89…3000')
  })

  it('gibt ohne IBAN nichts zurück', () => {
    expect(ibanGekuerzt(null)).toBeNull()
    expect(ibanGekuerzt('')).toBeNull()
  })

  it('verrät auch bei einer kurzen Eingabe nicht zu viel', () => {
    // Eine unvollständige Eingabe darf nicht versehentlich vollständig im
    // Protokoll landen.
    expect(ibanGekuerzt('DE8937')).toBe('DE…')
  })

  it('reicht nie die vollständige IBAN durch', () => {
    const voll = 'DE89370400440532013000'
    expect(ibanGekuerzt(voll)).not.toContain('370400440532')
  })
})
