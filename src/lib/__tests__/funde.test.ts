import { describe, it, expect } from 'vitest'
import {
  bewerten, istHeikel, topf, brauchtFreigabe, startStatus,
  HEIKLE_BEREICHE, neueKennung,
} from '../funde'

/**
 * §133 Die Bewertung einer Meldung ist der Kern des Ganzen: Sie entscheidet,
 * ob aus einem Fund eine Behebung werden kann oder nur eine Rückfrage. Deshalb
 * steht hier, was „vollständig" heißt — und dass eine unvollständige Meldung
 * trotzdem angenommen wird.
 */

const vollerFehler = {
  art: 'fehler',
  bereich: 'nachrichten',
  title: 'Gruppe lässt sich nicht eröffnen',
  schritte: 'Als Leitung auf Nachrichten, dann Gruppe eröffnen, Namen eingetragen.',
  description: 'Nach dem Klick passiert nichts, die Maske bleibt offen.',
  erwartet: 'Die Gruppe sollte angelegt werden und sich öffnen.',
  haeufigkeit: 'immer',
}

describe('Wann eine Meldung reicht', () => {
  it('nimmt eine vollständige Fehlermeldung an', () => {
    const b = bewerten(vollerFehler)
    expect(b.stufe).toBe('gruen')
    expect(b.fehlt).toEqual([])
    expect(b.text).toBe('Damit kann ich arbeiten.')
  })

  it('vermisst die Erwartung — das wichtigste Feld', () => {
    // Ohne sie ist nicht zu klären, ob etwas kaputt ist oder nur anders als
    // gedacht. Genau daran haengt, ob es ein Fehler oder ein Wunsch ist.
    const b = bewerten({ ...vollerFehler, erwartet: '' })
    expect(b.stufe).toBe('gelb')
    expect(b.fehlt.join(' ')).toContain('erwartet')
  })

  it('vermisst die Schritte', () => {
    expect(bewerten({ ...vollerFehler, schritte: '' }).fehlt.join(' '))
      .toContain('getan')
  })

  it('vermisst die Häufigkeit', () => {
    expect(bewerten({ ...vollerFehler, haeufigkeit: undefined }).fehlt.join(' '))
      .toContain('manchmal')
  })

  it('lässt ein einzelnes Wort nicht als Beschreibung durchgehen', () => {
    expect(bewerten({ ...vollerFehler, description: 'kaputt' }).stufe).toBe('gelb')
  })

  it('nennt bei einer einzigen Lücke genau diese', () => {
    const b = bewerten({ ...vollerFehler, haeufigkeit: undefined })
    expect(b.fehlt).toHaveLength(1)
    expect(b.text).toContain('Eine Angabe fehlt noch')
  })

  it('verlangt einen Bereich', () => {
    expect(bewerten({ ...vollerFehler, bereich: 'sonstiges' }).stufe).toBe('gelb')
  })
})

describe('Ein Verbesserungsvorschlag wird anders gemessen', () => {
  const vorschlag = {
    art: 'verbesserung',
    bereich: 'dienstplan',
    title: 'Woche wechseln braucht zu viele Klicks',
    description: 'Man muss jedes Mal über den Kalender gehen.',
    erwartet: 'Pfeile direkt über der Tabelle wären schneller.',
  }

  it('nimmt ihn ohne Schritte und ohne Häufigkeit an', () => {
    // Bei einer Verbesserung gibt es nichts nachzustellen — es geht um den
    // Zielzustand, nicht um den Weg dorthin.
    expect(bewerten(vorschlag).stufe).toBe('gruen')
  })

  it('verlangt aber, wie es stattdessen sein soll', () => {
    const b = bewerten({ ...vorschlag, erwartet: '' })
    expect(b.stufe).toBe('gelb')
    expect(b.fehlt.join(' ')).toContain('stattdessen')
  })

  it('verlangt auch, was heute daran stört', () => {
    expect(bewerten({ ...vorschlag, description: '' }).fehlt.join(' ')).toContain('stört')
  })
})

describe('Freigabe', () => {
  it('verlangt sie für Verbesserungen und Wünsche', () => {
    expect(brauchtFreigabe('verbesserung')).toBe(true)
    expect(brauchtFreigabe('wunsch')).toBe(true)
  })

  it('verlangt sie nicht für Fehler und Fragen', () => {
    expect(brauchtFreigabe('fehler')).toBe(false)
    expect(brauchtFreigabe('frage')).toBe(false)
  })

  it('startet einen Vorschlag im Wartezustand', () => {
    expect(startStatus('verbesserung')).toBe('wartet_freigabe')
    expect(startStatus('wunsch')).toBe('wartet_freigabe')
  })

  it('startet einen Fehler direkt als offen', () => {
    expect(startStatus('fehler')).toBe('open')
  })
})

describe('Was Geld oder Recht berührt', () => {
  it('erkennt die heiklen Bereiche am Bereich allein', () => {
    expect(istHeikel('lohn')).toBe(true)
    expect(istHeikel('zeit')).toBe(true)
    expect(istHeikel('datenschutz')).toBe(true)
    expect(istHeikel('anmeldung')).toBe(true)
  })

  it('lässt harmlose Bereiche harmlos', () => {
    expect(istHeikel('nachrichten')).toBe(false)
    expect(istHeikel('dienstplan')).toBe(false)
  })

  it('lässt sich ankreuzen, aber nicht wegkreuzen', () => {
    // Wer unsicher ist, soll ankreuzen duerfen. Wer es vergisst, wird vom
    // Bereich aufgefangen — und niemand kann einen Lohnfehler harmlos machen.
    expect(istHeikel('nachrichten', true)).toBe(true)
    expect(istHeikel('lohn', false)).toBe(true)
  })

  it('führt Lohn und Datenschutz in der Liste', () => {
    expect(HEIKLE_BEREICHE).toContain('lohn')
    expect(HEIKLE_BEREICHE).toContain('datenschutz')
  })
})

describe('In welchen Topf ein Fund gehört', () => {
  it('legt einen sauberen, harmlosen Fehler zum Selbsterledigen', () => {
    expect(topf({ art: 'fehler', bereich: 'nachrichten', meldeQualitaet: 'gruen' }))
      .toBe('selbst')
  })

  it('legt alles rund um Geld und Recht zum Bestätigen', () => {
    expect(topf({ art: 'fehler', bereich: 'lohn', meldeQualitaet: 'gruen' }))
      .toBe('vorschlag')
  })

  it('legt einen unvollständigen Fund zur Rückfrage', () => {
    expect(topf({ art: 'fehler', bereich: 'nachrichten', meldeQualitaet: 'gelb' }))
      .toBe('rueckfrage')
  })

  it('legt eine Verbesserung zur Freigabe — auch wenn sie vollständig ist', () => {
    expect(topf({ art: 'verbesserung', bereich: 'dienstplan', meldeQualitaet: 'gruen' }))
      .toBe('freigabe')
  })

  it('lässt eine freigegebene Verbesserung weiterlaufen', () => {
    expect(topf({
      art: 'verbesserung', bereich: 'dienstplan',
      meldeQualitaet: 'gruen', freigabe: 'freigegeben',
    })).toBe('selbst')
  })

  it('hält eine freigegebene Verbesserung am Lohn trotzdem zurück', () => {
    // Die Freigabe sagt "bauen wir". Sie sagt nicht "bau es ungeprüft".
    expect(topf({
      art: 'verbesserung', bereich: 'lohn',
      meldeQualitaet: 'gruen', freigabe: 'freigegeben',
    })).toBe('vorschlag')
  })
})

describe('Kennungen', () => {
  it('zeigt die Art schon am Anfang', () => {
    expect(neueKennung('fehler')).toMatch(/^F-/)
    expect(neueKennung('verbesserung')).toMatch(/^V-/)
    expect(neueKennung('wunsch')).toMatch(/^W-/)
  })

  it('vergibt keine zwei gleichen', () => {
    const viele = new Set(Array.from({ length: 200 }, () => neueKennung('fehler')))
    expect(viele.size).toBe(200)
  })
})
