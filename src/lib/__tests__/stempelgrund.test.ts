import { describe, it, expect } from 'vitest'
import {
  abweichungBeimGehen, abweichungBeimKommen, dauer, minuten, alsDauer,
  grundTaugt, TOLERANZ_MINUTEN, TOLERANZ_KOMMEN_MINUTEN, ABWEICHUNG_TEXT,
} from '../stempelgrund'

/**
 * §203 Wann nach einem Grund gefragt wird.
 *
 * WARUM DAS EIN TEST IST UND KEIN GEFÜHL
 * Diese Entscheidung bestimmt, wann jemandem ein Pflichtfeld vorgesetzt wird,
 * und sie entscheidet mit darüber, ob aus Mehrarbeit eine bezahlte Überstunde
 * wird. Beide Fehlerrichtungen sind teuer: Wird zu oft gefragt, klickt man
 * weg — und dann ist die Frage auch dort wertlos, wo sie zählt. Wird zu
 * selten gefragt, steht am Monatsende eine Zahl ohne Erklärung.
 */

const DIENST = { von: '08:00', bis: '16:00' } // acht Stunden

describe('§203 Uhrzeiten lesen', () => {
  it('rechnet „HH:MM" in Minuten um', () => {
    expect(minuten('00:00')).toBe(0)
    expect(minuten('08:30')).toBe(510)
    expect(minuten('23:59')).toBe(1439)
  })

  it('lehnt Unsinn ab, statt ihn zu raten', () => {
    for (const w of ['', '8:5', '25:00', '08:60', 'acht', null, undefined]) {
      expect(minuten(w as string)).toBeNull()
    }
  })

  it('zählt den Nachtdienst über Mitternacht richtig', () => {
    // 22:00 bis 06:00 sind acht Stunden, nicht minus sechzehn.
    expect(dauer('22:00', '06:00')).toBe(480)
    expect(dauer('08:00', '16:00')).toBe(480)
  })
})

describe('§203 Wann gefragt wird', () => {
  it('fragt nicht, wenn der Dienst gearbeitet wurde', () => {
    expect(abweichungBeimGehen(DIENST, { von: '08:00', bis: '16:00' })).toBeNull()
  })

  it('fragt nicht bei ein paar Minuten', () => {
    // Wer sieben Minuten früher geht, soll nicht tippen müssen.
    expect(abweichungBeimGehen(DIENST, { von: '08:00', bis: '15:53' })).toBeNull()
    expect(abweichungBeimGehen(DIENST, { von: '08:00', bis: '16:07' })).toBeNull()
  })

  it('fragt ab der Viertelstunde', () => {
    const kurz = abweichungBeimGehen(DIENST, { von: '08:00', bis: '15:45' })
    expect(kurz).toEqual({ art: 'frueher', minuten: 15, plan: DIENST })

    const lang = abweichungBeimGehen(DIENST, { von: '08:00', bis: '16:45' })
    expect(lang).toEqual({ art: 'laenger', minuten: 45, plan: DIENST })
  })

  it('misst die DAUER, nicht die Uhrzeit des Gehens', () => {
    /*
     * Der Fall, an dem die alte Rechnung scheiterte: Sie verglich die Uhrzeit
     * des Ausstempelns mit dem Dienstende. Wer eine Stunde später kam und
     * eine Stunde später ging, bekam eine Überstundenfrage für Zeit, die er
     * nie gearbeitet hat — und hätte sie bestätigt, wäre sie bezahlt worden.
     */
    expect(abweichungBeimGehen(DIENST, { von: '09:00', bis: '17:00' })).toBeNull()
  })

  it('fragt immer, wenn gar kein Dienst geplant war', () => {
    const ohne = abweichungBeimGehen(null, { von: '08:00', bis: '10:30' })
    expect(ohne).toEqual({ art: 'ohne-dienst', minuten: 150 })
  })

  it('fragt auch bei kurzer Zeit ohne Dienst', () => {
    // Hier gibt es keine Toleranz: Ohne Plan ist jede Minute unerklärt.
    expect(abweichungBeimGehen(null, { von: '08:00', bis: '08:05' })?.art)
      .toBe('ohne-dienst')
  })

  it('kommt mit einem unlesbaren Plan zurecht, ohne zu schweigen', () => {
    // Ein kaputter Plan darf nicht dazu führen, dass gar nicht gefragt wird.
    expect(abweichungBeimGehen({ von: 'x', bis: 'y' }, { von: '08:00', bis: '16:00' })?.art)
      .toBe('ohne-dienst')
  })

  it('schweigt, wenn die eigene Zeit unlesbar ist', () => {
    // Daraus lässt sich nichts folgern — eine erfundene Rückfrage wäre
    // schlimmer als keine.
    expect(abweichungBeimGehen(DIENST, { von: '', bis: '16:00' })).toBeNull()
  })

  it('rechnet den Nachtdienst richtig, statt ihn als Abweichung zu melden', () => {
    const nacht = { von: '22:00', bis: '06:00' }
    expect(abweichungBeimGehen(nacht, { von: '22:00', bis: '06:00' })).toBeNull()
    expect(abweichungBeimGehen(nacht, { von: '22:00', bis: '07:00' }))
      .toEqual({ art: 'laenger', minuten: 60, plan: nacht })
  })

  it('lässt die Schwelle verschieben', () => {
    expect(TOLERANZ_MINUTEN).toBe(15)
    expect(abweichungBeimGehen(DIENST, { von: '08:00', bis: '15:55' }, 3)?.art)
      .toBe('frueher')
  })
})

describe('§203 Was als Grund durchgeht', () => {
  it('nimmt ein paar Worte an', () => {
    expect(grundTaugt('Für Melanie eingesprungen')).toBe(true)
  })

  it('lässt Leerzeichen und Einzelzeichen nicht durch', () => {
    // Ein Pflichtfeld, das sich mit einem Punkt abhaken lässt, ist keins.
    for (const w of ['', '  ', '.', 'ok', null, undefined]) {
      expect(grundTaugt(w as string)).toBe(false)
    }
  })
})

describe('§203 Dauer für Menschen', () => {
  it('schreibt Stunden und Minuten', () => {
    expect(alsDauer(45)).toBe('45 min')
    expect(alsDauer(60)).toBe('1 h')
    expect(alsDauer(135)).toBe('2 h 15 min')
  })
})

/**
 * §219 Die Rückfrage beim EINSTEMPELN.
 *
 * Vorher wurde beim Kommen nur gefragt, OB ein Dienst geplant ist. War einer
 * geplant, ließ sich zu jeder Uhrzeit einstempeln — um 23 Uhr genauso wie um
 * 07:15. Wer dann acht Stunden blieb, hatte eine tadellose Dauer und hatte
 * trotzdem nicht den Dienst gearbeitet, der im Plan stand.
 */
describe('§219 Abweichung beim Einstempeln', () => {
  const plan = { von: '07:15', bis: '15:45' }

  it('fragt nicht, wer pünktlich anfängt', () => {
    expect(abweichungBeimKommen(plan, '07:15')).toBeNull()
  })

  it('lässt kleine Abweichungen in Ruhe', () => {
    expect(abweichungBeimKommen(plan, '07:12')).toBeNull()
    expect(abweichungBeimKommen(plan, '07:20')).toBeNull()
  })

  it('fragt beim Einstempeln mitten in der Nacht', () => {
    // Der Fall aus dem Betrieb: geplant 07:15, gestempelt um 23 Uhr. Vorher
    // kam dazu keine einzige Frage.
    const a = abweichungBeimKommen(plan, '23:00')
    expect(a?.art).toBe('kommen-spaet')
    expect(a?.minuten).toBe(945)
  })

  it('erkennt auch das zu frühe Anfangen', () => {
    const a = abweichungBeimKommen(plan, '05:00')
    expect(a?.art).toBe('kommen-frueh')
    expect(a?.minuten).toBe(135)
  })

  it('rechnet über Mitternacht in die nähere Richtung', () => {
    // Ein Dienst um 00:15, gestempelt um 23:50: 25 Minuten zu früh — nicht
    // 23 Stunden und 35 Minuten zu spät.
    const nacht = { von: '00:15', bis: '08:15' }
    const a = abweichungBeimKommen(nacht, '23:50')
    expect(a?.art).toBe('kommen-frueh')
    expect(a?.minuten).toBe(25)
  })

  it('meldet ohne Plan weiterhin „ohne-dienst"', () => {
    expect(abweichungBeimKommen(null, '09:00')?.art).toBe('ohne-dienst')
  })

  it('nimmt die Toleranz genau an der Grenze noch hin', () => {
    const grenze = abweichungBeimKommen(plan, '07:20', TOLERANZ_KOMMEN_MINUTEN)
    expect(grenze).toBeNull()
    expect(abweichungBeimKommen(plan, '07:21', TOLERANZ_KOMMEN_MINUTEN)?.art)
      .toBe('kommen-spaet')
  })

  it('verträgt eine unlesbare Uhrzeit, statt zu raten', () => {
    expect(abweichungBeimKommen(plan, 'kaputt')).toBeNull()
  })
})

describe('§219 Der Wortlaut sagt, worum es geht', () => {
  it('spricht bei zu wenig Stunden von Stunden und nicht vom Gehen', () => {
    // „früher gegangen als geplant" stand auch dann da, wenn jemand erst um
    // 22:30 ging. Verglichen wird die Dauer.
    expect(ABWEICHUNG_TEXT.frueher).toContain('Stunden')
    expect(ABWEICHUNG_TEXT.frueher).not.toContain('gegangen')
  })

  it('hat für jede Abweichungsart einen Text', () => {
    for (const art of ['ohne-dienst', 'kommen-frueh', 'kommen-spaet', 'frueher', 'laenger'] as const) {
      expect(ABWEICHUNG_TEXT[art]?.length, art).toBeGreaterThan(5)
    }
  })
})
