import { describe, it, expect } from 'vitest'
import {
  darfWechseln, warumNicht, amZug, lage, darfErinnern, reihenfolge,
  OFFEN, STAENDE, ERINNERUNG_ABSTAND_TAGE,
} from '../anforderung'

/**
 * §149 Der Kern dieses Moduls ist eine einzige Regel: Einreichen darf nur der
 * Mensch, abnehmen nur der Betrieb. Alles andere hier prüft, dass es keinen
 * Weg drum herum gibt.
 */

describe('Wer welchen Schritt gehen darf', () => {
  it('lässt den Menschen einreichen', () => {
    expect(darfWechseln('offen', 'eingereicht', 'mitarbeiter')).toBe(true)
    expect(darfWechseln('rueckfrage', 'eingereicht', 'mitarbeiter')).toBe(true)
  })

  it('lässt den Betrieb NICHT für jemanden einreichen', () => {
    expect(darfWechseln('offen', 'eingereicht', 'betrieb')).toBe(false)
  })

  it('lässt den Menschen sich NICHT selbst abnehmen', () => {
    expect(darfWechseln('eingereicht', 'erledigt', 'mitarbeiter')).toBe(false)
    expect(darfWechseln('offen', 'erledigt', 'mitarbeiter')).toBe(false)
  })

  it('erklärt das auch verständlich', () => {
    expect(warumNicht('eingereicht', 'erledigt', 'mitarbeiter'))
      .toMatch(/entscheidet der Betrieb/)
    expect(warumNicht('offen', 'eingereicht', 'betrieb'))
      .toMatch(/nur die Person selbst/)
  })

  it('lässt den Betrieb abnehmen und nachfragen', () => {
    expect(darfWechseln('eingereicht', 'erledigt', 'betrieb')).toBe(true)
    expect(darfWechseln('eingereicht', 'rueckfrage', 'betrieb')).toBe(true)
  })

  it('lässt den Betrieb auch ohne Einreichung abnehmen', () => {
    // Der Nachweis liegt auf Papier auf dem Tisch — das ist der Alltag.
    expect(darfWechseln('offen', 'erledigt', 'betrieb')).toBe(true)
  })

  it('erlaubt keine Rückfrage zu etwas, das nicht vorliegt', () => {
    expect(darfWechseln('offen', 'rueckfrage', 'betrieb')).toBe(false)
  })

  it('schreibt nichts mehr um, was abgenommen ist', () => {
    for (const nach of Object.keys(STAENDE)) {
      expect(darfWechseln('erledigt', nach, 'betrieb'), nach).toBe(false)
      expect(darfWechseln('erledigt', nach, 'mitarbeiter'), nach).toBe(false)
    }
    expect(warumNicht('erledigt', 'rueckfrage', 'betrieb')).toMatch(/abgenommen/)
  })

  it('lässt nichts wieder auf „offen" zurückfallen', () => {
    expect(darfWechseln('eingereicht', 'offen', 'betrieb')).toBe(false)
    expect(darfWechseln('rueckfrage', 'offen', 'mitarbeiter')).toBe(false)
  })

  it('kennt keinen erfundenen Stand', () => {
    expect(darfWechseln('offen', 'schwebend', 'betrieb')).toBe(false)
    expect(warumNicht('offen', 'schwebend', 'betrieb')).toMatch(/gibt es nicht/)
  })

  it('lässt nur den Betrieb zurückziehen', () => {
    expect(darfWechseln('offen', 'zurueckgezogen', 'betrieb')).toBe(true)
    expect(darfWechseln('offen', 'zurueckgezogen', 'mitarbeiter')).toBe(false)
  })
})

describe('Bei wem der Ball liegt', () => {
  it('benennt es für jeden Stand', () => {
    expect(amZug('offen')).toBe('mitarbeiter')
    expect(amZug('rueckfrage')).toBe('mitarbeiter')
    expect(amZug('eingereicht')).toBe('betrieb')
    expect(amZug('erledigt')).toBeNull()
    expect(amZug('zurueckgezogen')).toBeNull()
  })

  it('zählt genau die drei Stände als offen', () => {
    expect(OFFEN).toEqual(['offen', 'eingereicht', 'rueckfrage'])
  })
})

describe('Die Lage aus beiden Blickwinkeln', () => {
  const heute = new Date('2026-09-22T00:00:00Z')

  it('sagt beiden Seiten etwas anderes zum selben Stand', () => {
    const fuerMich = lage({ status: 'offen' }, 'mitarbeiter', heute)
    const fuerBetrieb = lage({ status: 'offen' }, 'betrieb', heute)
    expect(fuerMich.hinweis).toMatch(/hochladen/)
    expect(fuerBetrieb.hinweis).toMatch(/[Ww]artet/)
    expect(fuerMich.stand).toBe(fuerBetrieb.stand)
  })

  it('rechnet die Tage bis zur Frist', () => {
    expect(lage(
      { status: 'offen', fristBis: '2026-09-29T00:00:00Z' }, 'mitarbeiter', heute,
    ).tageBis).toBe(7)
  })

  it('erkennt eine überschrittene Frist', () => {
    const l = lage(
      { status: 'offen', fristBis: '2026-09-20T00:00:00Z' }, 'mitarbeiter', heute)
    expect(l.ueberfaellig).toBe(true)
    expect(l.tageBis).toBe(-2)
  })

  it('nennt nichts überfällig, was schon erledigt ist', () => {
    expect(lage(
      { status: 'erledigt', fristBis: '2020-01-01T00:00:00Z' }, 'betrieb', heute,
    ).ueberfaellig).toBe(false)
  })

  it('kommt ohne Frist aus', () => {
    const l = lage({ status: 'offen' }, 'mitarbeiter', heute)
    expect(l.tageBis).toBeNull()
    expect(l.ueberfaellig).toBe(false)
  })

  it('fällt bei einem unbekannten Stand auf „offen" zurück', () => {
    expect(lage({ status: 'kaputt' }, 'betrieb', heute).stand).toBe('offen')
  })
})

describe('Erinnern, ohne zu drangsalieren', () => {
  const heute = new Date('2026-09-22T00:00:00Z')

  it('erinnert beim ersten Mal sofort', () => {
    expect(darfErinnern({ status: 'offen' }, heute)).toBe(true)
  })

  it('erinnert nicht am nächsten Tag noch einmal', () => {
    expect(darfErinnern(
      { status: 'offen', erinnertAm: '2026-09-21T00:00:00Z' }, heute,
    )).toBe(false)
  })

  it(`erinnert wieder nach ${ERINNERUNG_ABSTAND_TAGE} Tagen`, () => {
    expect(darfErinnern(
      { status: 'offen', erinnertAm: '2026-09-15T00:00:00Z' }, heute,
    )).toBe(true)
  })

  it('mahnt niemanden, wenn der Betrieb selbst am Zug ist', () => {
    expect(darfErinnern({ status: 'eingereicht' }, heute)).toBe(false)
  })

  it('mahnt nichts Abgeschlossenes', () => {
    expect(darfErinnern({ status: 'erledigt' }, heute)).toBe(false)
    expect(darfErinnern({ status: 'zurueckgezogen' }, heute)).toBe(false)
  })
})

describe('Die Sortierung der Liste', () => {
  it('stellt die Rückfrage nach oben', () => {
    const liste = [
      { status: 'erledigt' }, { status: 'offen' },
      { status: 'rueckfrage' }, { status: 'eingereicht' },
    ]
    expect(liste.sort(reihenfolge).map(x => x.status))
      .toEqual(['rueckfrage', 'offen', 'eingereicht', 'erledigt'])
  })

  it('stellt bei gleichem Stand das Frühere nach vorn', () => {
    const liste = [
      { status: 'offen', fristBis: '2026-12-01T00:00:00Z' },
      { status: 'offen', fristBis: '2026-10-01T00:00:00Z' },
    ]
    expect(liste.sort(reihenfolge)[0].fristBis).toBe('2026-10-01T00:00:00Z')
  })

  it('stellt das ohne Frist ganz nach hinten', () => {
    const liste = [
      { status: 'offen' },
      { status: 'offen', fristBis: '2026-10-01T00:00:00Z' },
    ]
    expect(liste.sort(reihenfolge)[0].fristBis).toBe('2026-10-01T00:00:00Z')
  })
})
