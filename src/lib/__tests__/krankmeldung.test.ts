import { describe, it, expect } from 'vitest'
import {
  kalendertage, ueberschneidet, nachweispflicht, luecken, nachweisLage,
  NACHWEISPFLICHTIGE_ARTEN,
} from '../krankmeldung'

/**
 * §130 Gerechnet wird in Kalendertagen, nicht in Arbeitstagen — §5 EntgFG
 * stellt auf die Dauer der Arbeitsunfähigkeit ab, nicht auf den Dienstplan.
 * Dieser Unterschied ist der häufigste Irrtum bei der Frage „ab wann braucht
 * er einen Schein?", deshalb steht er hier mit Beispielen.
 */

const krank = (startDate: string, endDate: string) => ({ type: 'krankheit', startDate, endDate })

describe('Kalendertage zählen', () => {
  it('zählt beide Enden mit', () => {
    expect(kalendertage('2026-03-02', '2026-03-02')).toBe(1)
    expect(kalendertage('2026-03-02', '2026-03-06')).toBe(5)
  })

  it('rechnet über den Monatswechsel', () => {
    expect(kalendertage('2026-02-26', '2026-03-02')).toBe(5)
  })

  it('rechnet über den Schalttag', () => {
    expect(kalendertage('2028-02-27', '2028-03-01')).toBe(4)
  })

  it('gibt bei verdrehten Daten nichts zurück statt einer negativen Zahl', () => {
    expect(kalendertage('2026-03-06', '2026-03-02')).toBe(0)
  })
})

describe('Überschneidung', () => {
  it('erkennt die Berührung am Rand', () => {
    expect(ueberschneidet(
      { startDate: '2026-03-02', endDate: '2026-03-06' },
      { startDate: '2026-03-06', endDate: '2026-03-10' },
    )).toBe(true)
  })

  it('erkennt den Abstand von einem Tag', () => {
    expect(ueberschneidet(
      { startDate: '2026-03-02', endDate: '2026-03-06' },
      { startDate: '2026-03-07', endDate: '2026-03-10' },
    )).toBe(false)
  })
})

describe('Wann eine Bescheinigung verlangt wird', () => {
  it('verlangt bei drei Tagen keine', () => {
    const p = nachweispflicht(krank('2026-03-02', '2026-03-04'))
    expect(p.pflichtig).toBe(false)
  })

  it('verlangt ab dem vierten Kalendertag eine', () => {
    const p = nachweispflicht(krank('2026-03-02', '2026-03-05'))
    expect(p.pflichtig).toBe(true)
    expect(p.spaetestensAm).toBe('2026-03-05')
    expect(p.begruendung).toContain('EntgFG')
  })

  it('zählt das Wochenende mit — es sind Kalendertage, keine Arbeitstage', () => {
    // Freitag bis Montag: vier Kalendertage, auch wenn nur zwei davon
    // Arbeitstage sind. Genau hier wird sonst falsch gerechnet.
    const p = nachweispflicht(krank('2026-03-06', '2026-03-09'))
    expect(p.pflichtig).toBe(true)
    expect(p.spaetestensAm).toBe('2026-03-09')
  })

  it('folgt einer betrieblichen Regelung ab dem ersten Tag', () => {
    const p = nachweispflicht(krank('2026-03-02', '2026-03-02'), 1)
    expect(p.pflichtig).toBe(true)
    expect(p.spaetestensAm).toBe('2026-03-02')
    expect(p.begruendung).toContain('§5 Abs.1 Satz 3')
  })

  it('verlangt bei Fortbildung nichts', () => {
    expect(nachweispflicht({ type: 'fortbildung', startDate: '2026-03-02', endDate: '2026-03-20' })
      .pflichtig).toBe(false)
  })

  it('kennt beide Schreibweisen für Krankheit', () => {
    // Ältere Datensätze und die Lohnrechnung schreiben „krank", die Oberfläche
    // „krankheit". Wer nur eine kennt, übersieht still die Hälfte.
    expect(NACHWEISPFLICHTIGE_ARTEN).toContain('krankheit')
    expect(NACHWEISPFLICHTIGE_ARTEN).toContain('krank')
  })
})

describe('Lücken in der Abdeckung', () => {
  const zeitraum = { startDate: '2026-03-02', endDate: '2026-03-20' }

  it('sieht keine Lücke, wenn alles gedeckt ist', () => {
    expect(luecken(zeitraum, [{ gueltigVon: '2026-03-02', gueltigBis: '2026-03-20' }]))
      .toEqual([])
  })

  it('setzt Erst- und Folgebescheinigung lückenlos zusammen', () => {
    expect(luecken(zeitraum, [
      { gueltigVon: '2026-03-02', gueltigBis: '2026-03-10' },
      { gueltigVon: '2026-03-11', gueltigBis: '2026-03-20' },
    ])).toEqual([])
  })

  it('findet die fehlende Folgebescheinigung', () => {
    const offen = luecken(zeitraum, [{ gueltigVon: '2026-03-02', gueltigBis: '2026-03-10' }])
    expect(offen).toEqual([{ von: '2026-03-11', bis: '2026-03-20', tage: 10 }])
  })

  it('findet eine Lücke in der Mitte', () => {
    const offen = luecken(zeitraum, [
      { gueltigVon: '2026-03-02', gueltigBis: '2026-03-08' },
      { gueltigVon: '2026-03-12', gueltigBis: '2026-03-20' },
    ])
    expect(offen).toEqual([{ von: '2026-03-09', bis: '2026-03-11', tage: 3 }])
  })

  it('zählt eine Bescheinigung ohne Zeitraum nicht als Deckung', () => {
    // Eine Datei, von der niemand weiß, wofür sie gilt, deckt nichts ab.
    const offen = luecken(zeitraum, [{ gueltigVon: null, gueltigBis: null }])
    expect(offen).toEqual([{ von: '2026-03-02', bis: '2026-03-20', tage: 19 }])
  })

  it('lässt sich von einer überlangen Bescheinigung nicht stören', () => {
    expect(luecken(zeitraum, [{ gueltigVon: '2026-02-20', gueltigBis: '2026-04-01' }]))
      .toEqual([])
  })

  it('ignoriert Bescheinigungen, die ganz woanders liegen', () => {
    const offen = luecken(zeitraum, [{ gueltigVon: '2026-01-05', gueltigBis: '2026-01-09' }])
    expect(offen).toEqual([{ von: '2026-03-02', bis: '2026-03-20', tage: 19 }])
  })

  it('kommt mit unsortierten Bescheinigungen zurecht', () => {
    expect(luecken(zeitraum, [
      { gueltigVon: '2026-03-11', gueltigBis: '2026-03-20' },
      { gueltigVon: '2026-03-02', gueltigBis: '2026-03-10' },
    ])).toEqual([])
  })
})

describe('Die Lage in einem Satz', () => {
  it('sagt, dass alles gedeckt ist', () => {
    const lage = nachweisLage(krank('2026-03-02', '2026-03-10'),
      [{ gueltigVon: '2026-03-02', gueltigBis: '2026-03-10' }])
    expect(lage.deckung).toBe('vollstaendig')
    expect(lage.text).toContain('gesamte Fehlzeit')
  })

  it('nennt den fehlenden Zeitraum mit Datum', () => {
    const lage = nachweisLage(krank('2026-03-02', '2026-03-20'),
      [{ gueltigVon: '2026-03-02', gueltigBis: '2026-03-10' }])
    expect(lage.deckung).toBe('teilweise')
    expect(lage.text).toContain('11.03.2026')
    expect(lage.text).toContain('Folgebescheinigung')
  })

  it('sagt bei fehlender Pflicht, dass keine nötig ist', () => {
    const lage = nachweisLage(krank('2026-03-02', '2026-03-04'), [])
    expect(lage.deckung).toBe('nicht_noetig')
    expect(lage.pflicht.pflichtig).toBe(false)
  })

  it('sagt bei Pflicht und ohne Datei deutlich, dass nichts vorliegt', () => {
    const lage = nachweisLage(krank('2026-03-02', '2026-03-20'), [])
    expect(lage.deckung).toBe('keine')
    expect(lage.text).toContain('keine Bescheinigung')
  })

  it('weist auf Dateien ohne Gültigkeitszeitraum hin', () => {
    const lage = nachweisLage(krank('2026-03-02', '2026-03-20'),
      [{ gueltigVon: null, gueltigBis: null }])
    expect(lage.ohneZeitraum).toBe(1)
    expect(lage.text).toContain('keinen Gültigkeitszeitraum')
  })
})
