import { describe, it, expect } from 'vitest'
import {
  ibanGueltig, sepaZeichen, sepaXml, datevCsv, datevZeilenAusAbrechnung,
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

  it('maskiert Anführungszeichen in Namen', () => {
    const csv = datevCsv({ jahr: 2026, monat: 9, mandantName: 'A"B' }, [])
    expect(csv).toContain('"A""B"')
  })

  it('nutzt Windows-Zeilenenden', () => {
    const csv = datevCsv({ jahr: 2026, monat: 9, mandantName: 'X' }, [])
    expect(csv).toContain('\r\n')
  })
})
