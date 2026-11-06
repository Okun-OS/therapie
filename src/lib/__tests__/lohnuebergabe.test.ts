import { describe, it, expect } from 'vitest'
import {
  uebergabeZeile, uebergabeCsv, uebergabeDateiname, uebergabeMaengel,
} from '../lohnuebergabe'
import type { MonatsGrundlage } from '../payroll-monat'

/**
 * §275 Die Übergabe ans Lohnbüro.
 *
 * Geprüft wird vor allem das, woran der alte Export gescheitert ist: dass
 * eine Zahl auch wirklich eine Zahl ist, dass steuerfrei und steuerpflichtig
 * getrennt dastehen, und dass die Datei in einer deutschen
 * Excel-Installation in die richtigen Spalten fällt.
 */

const GRUNDLAGE = (teil: Partial<MonatsGrundlage> = {}): MonatsGrundlage => ({
  regularHours: 160, overtimeHours: 0, ausfallHours: 0,
  nightHours: 0, saturdayHours: 0, sundayHours: 0, holidayHours: 0,
  vacationDays: 0, sickDays: 0,
  nightSurcharge: 0, saturdaySurcharge: 0, sundaySurcharge: 0,
  holidaySurcharge: 0, overtimeSurcharge: 0, otherSurcharge: 0,
  zuschlagsStundenlohn: 20,
  sonstigeBezuege: 0, sonstigeBezuegeBeitragsfrei: 0,
  bisherSteuerBrutto: 0, bisherBeitragspflichtig: 0,
  bisherigeEinmalzahlungen: 0, eintrittsMonat: 1,
  svTage: 30, beschaeftigt: true,
  ...teil,
})

const ANNA = { name: 'Anna Fischer', personalnummer: '1042' }

describe('§275 Die Zeile', () => {
  it('trägt Personalnummer und Stunden', () => {
    const z = uebergabeZeile(ANNA, GRUNDLAGE({ regularHours: 150, overtimeHours: 10 }))
    expect(z.personalnummer).toBe('1042')
    expect(z.stundenGesamt).toBe(160)
    expect(z.stundenMehrarbeit).toBe(10)
  })

  /*
   * Der Kern: Nacht und Feiertag sind nach §3b begünstigt, Samstag nicht.
   * Ein Export, der das zusammenwirft, zwingt das Lohnbüro, die Trennung aus
   * Zahlen nachzubauen, die es nicht hat.
   */
  it('trennt steuerfrei und steuerpflichtig', () => {
    const z = uebergabeZeile(ANNA, GRUNDLAGE({
      zuschlagsStundenlohn: 20,
      nightHours: 10, nightSurcharge: 50,       // genau 25 % → voll frei
      saturdayHours: 8, saturdaySurcharge: 32,  // Samstag: nie frei
    }))
    expect(z.zuschlaegeGesamt).toBe(82)
    expect(z.zuschlaegeSteuerfrei).toBe(50)
    expect(z.zuschlaegeSteuerpflichtig).toBe(32)
  })

  it('und die beiden Teile ergeben immer den Gesamtbetrag', () => {
    const z = uebergabeZeile(ANNA, GRUNDLAGE({
      zuschlagsStundenlohn: 17.37,
      nightHours: 7, nightSurcharge: 44.44,
      sundayHours: 3, sundaySurcharge: 19.19,
      saturdaySurcharge: 7.77, saturdayHours: 2,
      overtimeSurcharge: 3.33,
    }))
    expect(z.zuschlaegeSteuerfrei + z.zuschlaegeSteuerpflichtig)
      .toBeCloseTo(z.zuschlaegeGesamt, 2)
  })

  /*
   * §276 Je Art getrennt — der Punkt, an dem eine Gesamtsumme für ein
   * Lohnprogramm nicht reicht: „Nachtzuschlag steuerfrei" und
   * „Nachtzuschlag steuerpflichtig" sind zwei verschiedene Lohnarten.
   */
  it('weist die Zuschläge je Art steuerfrei und steuerpflichtig aus', () => {
    const z = uebergabeZeile(ANNA, GRUNDLAGE({
      zuschlagsStundenlohn: 20,
      nightHours: 10, nightSurcharge: 100,       // frei 50, pflichtig 50
      holidayHours: 4, holidaySurcharge: 150,    // frei 100, pflichtig 50
      saturdayHours: 8, saturdaySurcharge: 32,   // Samstag: nie frei
    }))
    expect(z.zuschlagNachtFrei).toBe(50)
    expect(z.zuschlagNachtPflichtig).toBe(50)
    expect(z.zuschlagFeiertagFrei).toBe(100)
    expect(z.zuschlagFeiertagPflichtig).toBe(50)
    expect(z.zuschlagSamstag).toBe(32)
  })

  it('und die Einzelteile ergeben die beiden Summen', () => {
    const z = uebergabeZeile(ANNA, GRUNDLAGE({
      zuschlagsStundenlohn: 18.4,
      nightHours: 12, nightSurcharge: 71.11,
      sundayHours: 6, sundaySurcharge: 60.6,
      holidayHours: 3, holidaySurcharge: 90.9,
      saturdaySurcharge: 20, saturdayHours: 5,
      otherSurcharge: 10,
    }))
    const frei = z.zuschlagNachtFrei + z.zuschlagSonntagFrei + z.zuschlagFeiertagFrei
    const pflichtig = z.zuschlagNachtPflichtig + z.zuschlagSonntagPflichtig
      + z.zuschlagFeiertagPflichtig + z.zuschlagSamstag + z.zuschlagSonstige
    expect(frei).toBeCloseTo(z.zuschlaegeSteuerfrei, 2)
    expect(pflichtig).toBeCloseTo(z.zuschlaegeSteuerpflichtig, 2)
  })

  it('Mehrarbeitszuschlag ist nie steuerfrei', () => {
    const z = uebergabeZeile(ANNA, GRUNDLAGE({
      zuschlagsStundenlohn: 20, overtimeHours: 10, overtimeSurcharge: 50,
    }))
    expect(z.zuschlaegeGesamt).toBe(50)
    expect(z.zuschlaegeSteuerfrei).toBe(0)
  })

  it('ohne Grundlohn gilt alles als steuerpflichtig', () => {
    const z = uebergabeZeile(ANNA, GRUNDLAGE({
      zuschlagsStundenlohn: null, nightHours: 10, nightSurcharge: 50,
    }))
    expect(z.zuschlaegeSteuerfrei).toBe(0)
    expect(z.zuschlaegeSteuerpflichtig).toBe(50)
  })

  it('eine leere Personalnummer ist keine', () => {
    expect(uebergabeZeile({ name: 'X', personalnummer: '   ' }, GRUNDLAGE()).personalnummer).toBeNull()
    expect(uebergabeZeile({ name: 'X' }, GRUNDLAGE()).personalnummer).toBeNull()
  })

  it('Urlaub und Krankheit stehen dabei', () => {
    const z = uebergabeZeile(ANNA, GRUNDLAGE({ vacationDays: 5, sickDays: 2 }))
    expect(z.urlaubstage).toBe(5)
    expect(z.krankheitstage).toBe(2)
  })
})

describe('§275 Die Datei', () => {
  const KOPF = { betrieb: 'Beispielbetrieb GmbH', jahr: 2026, monat: 10 }
  const zeilen = [uebergabeZeile(ANNA, GRUNDLAGE({
    regularHours: 150, overtimeHours: 10,
    nightHours: 10, nightSurcharge: 50,
  }))]

  it('trennt Spalten mit Semikolon und Zahlen mit Komma', () => {
    /*
     * Die Gegenprobe zum alten Export: Der trennte mit Komma UND schrieb
     * Dezimalpunkte. In einer deutschen Excel-Installation fällt so eine
     * Datei in die falschen Spalten.
     */
    const csv = uebergabeCsv(KOPF, zeilen)
    expect(csv).toContain(';')
    expect(csv).toContain('160,00')
    expect(csv).not.toMatch(/\d\.\d\d;/)
  })

  it('jede Zahl steht allein in ihrer Zelle', () => {
    // Der alte Export schrieb „480min / 120.00€" in EINE Zelle.
    const csv = uebergabeCsv(KOPF, zeilen)
    expect(csv).not.toMatch(/min\s*\//)
    expect(csv).not.toContain('€')
  })

  it('beginnt mit der Kennung, die Excel UTF-8 lesen lässt', () => {
    expect(uebergabeCsv(KOPF, zeilen).startsWith('﻿')).toBe(true)
  })

  it('und nutzt Zeilenenden, die Excel als solche erkennt', () => {
    const csv = uebergabeCsv(KOPF, zeilen)
    expect(csv).toContain('\r\n')
    expect(csv.split('\r\n').length).toBe(4)   // Kopf, Überschriften, 1 Zeile, Schluss
  })

  /*
   * Zerlegt wie ein CSV-Leser, nicht wie `split(';')`.
   *
   * Die erste Fassung dieser Prüfung spaltete stumpf am Semikolon — und
   * meldete einen Fehler für einen Namen, in dem ein Semikolon INNERHALB der
   * Anführungszeichen stand. Die Datei war in Ordnung, die Prüfung nicht.
   * Wer so misst, baut irgendwann das Semikolon aus dem Namen heraus, um
   * eine Prüfung zufriedenzustellen, die falsch fragt.
   */
  const felder = (zeile: string): string[] => {
    const aus: string[] = []
    let feld = ''
    let inAnfuehrung = false
    for (let i = 0; i < zeile.length; i++) {
      const c = zeile[i]
      if (inAnfuehrung) {
        if (c === '"' && zeile[i + 1] === '"') { feld += '"'; i++ }
        else if (c === '"') inAnfuehrung = false
        else feld += c
      } else if (c === '"') inAnfuehrung = true
      else if (c === ';') { aus.push(feld); feld = '' }
      else feld += c
    }
    aus.push(feld)
    return aus
  }

  it('hat für jede Überschrift genau einen Wert', () => {
    const [, ueberschriften, erste] = uebergabeCsv(KOPF, zeilen).split('\r\n')
    expect(felder(erste).length).toBe(felder(ueberschriften).length)
  })

  it('nennt Betrieb und Zeitraum', () => {
    const csv = uebergabeCsv(KOPF, zeilen)
    expect(csv).toContain('Beispielbetrieb GmbH')
    expect(csv).toContain('10/2026')
  })

  /*
   * Ein Name mit Anführungszeichen hat schon einmal eine ganze Datei
   * zerlegt — ab dort stand alles eine Spalte verschoben, und das fällt
   * erst im Lohnprogramm auf.
   */
  it('ein Name mit Anführungszeichen und Semikolon zerlegt die Zeile nicht', () => {
    const name = 'Anna "Anni" Fischer; geb. Weiß'
    const boese = [uebergabeZeile({ name, personalnummer: '7' }, GRUNDLAGE())]
    const [, ueberschriften, erste] = uebergabeCsv(KOPF, boese).split('\r\n')

    expect(felder(erste).length).toBe(felder(ueberschriften).length)
    // Und der Name kommt beim Leser wieder unversehrt an.
    expect(felder(erste)[1]).toBe(name)
  })

  it('der Dateiname trägt Betrieb und Monat', () => {
    expect(uebergabeDateiname(KOPF)).toBe('lohnuebergabe-Beispielbetrieb-GmbH-2026-10.csv')
  })

  it('und enthält nichts, was ein Dateisystem stört', () => {
    const name = uebergabeDateiname({ betrieb: 'A/B\\C: "D" *?', jahr: 2026, monat: 1 })
    expect(name).not.toMatch(/[/\\:"*?<>|]/)
    expect(name.endsWith('-2026-01.csv')).toBe(true)
  })
})

describe('§275 Was vorher gesagt wird', () => {
  it('fehlende Personalnummern werden benannt', () => {
    const maengel = uebergabeMaengel([
      uebergabeZeile({ name: 'Ohne Nummer' }, GRUNDLAGE()),
      uebergabeZeile(ANNA, GRUNDLAGE()),
    ])
    expect(maengel).toHaveLength(1)
    expect(maengel[0].art).toBe('personalnummer')
    expect(maengel[0].betroffen).toEqual(['Ohne Nummer'])
  })

  it('ein fehlender Grundlohn nur dann, wenn es überhaupt Zuschläge gibt', () => {
    /*
     * Die Gegenprobe gegen eine Meldung, die immer erscheint: Wer keine
     * Zuschläge hat, braucht auch keinen Grundlohn dafür. Eine Warnung, die
     * jeden betrifft, liest nach zwei Monaten niemand mehr.
     */
    const ohneZuschlag = uebergabeMaengel([
      uebergabeZeile(ANNA, GRUNDLAGE({ zuschlagsStundenlohn: null })),
    ])
    expect(ohneZuschlag.filter(m => m.art === 'grundlohn')).toHaveLength(0)

    const mitZuschlag = uebergabeMaengel([
      uebergabeZeile(ANNA, GRUNDLAGE({
        zuschlagsStundenlohn: null, nightHours: 10, nightSurcharge: 50,
      })),
    ])
    expect(mitZuschlag.filter(m => m.art === 'grundlohn')).toHaveLength(1)
  })

  it('ist alles in Ordnung, wird nichts gemeldet', () => {
    expect(uebergabeMaengel([uebergabeZeile(ANNA, GRUNDLAGE())])).toEqual([])
    expect(uebergabeMaengel([])).toEqual([])
  })
})
