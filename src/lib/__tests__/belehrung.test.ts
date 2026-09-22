import { describe, it, expect } from 'vitest'
import {
  fehltZumVerteilen, darfAendern, warumNichtAendern, pruefsumme, kurzeSumme,
  guete, darfBestaetigen, stand, naechsteRunde, rundenTitel, geraetKurz,
  STANDARDTEXT, KNAPP_SEKUNDEN, NACH_VERTEILEN_AENDERBAR,
} from '../belehrung'

/**
 * §150 Was hier geprüft wird, ist die Belastbarkeit des Nachweises: dass eine
 * verteilte Belehrung sich nicht mehr umschreiben lässt, dass der
 * Fingerabdruck wirklich auf die Fassung zeigt, und dass ein Klick ohne
 * geöffnetes Dokument als das erkannt wird, was er ist.
 */

describe('Was vor dem Verteilen fehlt', () => {
  const voll = {
    titel: 'Hygienebelehrung', dateiId: 'datei1',
    bestaetigungstext: STANDARDTEXT,
  }

  it('lässt eine vollständige Belehrung durch', () => {
    expect(fehltZumVerteilen(voll)).toEqual([])
  })

  it('verlangt ein Dokument', () => {
    const fehlt = fehltZumVerteilen({ ...voll, dateiId: null })
    expect(fehlt.length).toBe(1)
    expect(fehlt[0]).toMatch(/leeres Blatt/)
  })

  it('verlangt einen Titel', () => {
    expect(fehltZumVerteilen({ ...voll, titel: '  ' }).length).toBe(1)
  })

  it('verlangt einen ausformulierten Bestätigungssatz', () => {
    expect(fehltZumVerteilen({ ...voll, bestaetigungstext: 'ok' }).length).toBe(1)
    expect(fehltZumVerteilen({ ...voll, bestaetigungstext: '' }).length).toBe(1)
  })

  it('nennt jeden fehlenden Punkt einzeln', () => {
    expect(fehltZumVerteilen({}).length).toBe(3)
  })

  it('gibt einen Standardsatz vor, der beide Teile nennt', () => {
    expect(STANDARDTEXT).toMatch(/gelesen/)
    expect(STANDARDTEXT).toMatch(/verstanden/)
  })
})

describe('Eine verteilte Belehrung ist festgeschrieben', () => {
  it('lässt im Entwurf alles ändern', () => {
    for (const feld of ['titel', 'dateiId', 'bestaetigungstext', 'fristBis']) {
      expect(darfAendern('entwurf', feld), feld).toBe(true)
    }
  })

  it('lässt nach dem Verteilen den Inhalt NICHT mehr ändern', () => {
    expect(darfAendern('verteilt', 'dateiId')).toBe(false)
    expect(darfAendern('verteilt', 'bestaetigungstext')).toBe(false)
    expect(darfAendern('verteilt', 'titel')).toBe(false)
    expect(darfAendern('verteilt', 'oeffnenNoetig')).toBe(false)
  })

  it('lässt nach dem Verteilen die Frist ändern — verlängern hilft', () => {
    expect(darfAendern('verteilt', 'fristBis')).toBe(true)
    expect(NACH_VERTEILEN_AENDERBAR).toContain('fristBis')
  })

  it('lässt an einer geschlossenen Runde gar nichts mehr ändern', () => {
    for (const feld of NACH_VERTEILEN_AENDERBAR) {
      expect(darfAendern('geschlossen', feld), feld).toBe(false)
    }
  })

  it('erklärt beides verständlich', () => {
    expect(warumNichtAendern('verteilt', 'dateiId')).toMatch(/wertlos/)
    expect(warumNichtAendern('geschlossen', 'fristBis')).toMatch(/neue\s+Runde/)
  })
})

describe('Der Fingerabdruck des Dokuments', () => {
  it('ist für denselben Inhalt derselbe', () => {
    expect(pruefsumme(Buffer.from('Belehrung A')))
      .toBe(pruefsumme(Buffer.from('Belehrung A')))
  })

  it('ändert sich bei jedem geänderten Zeichen', () => {
    expect(pruefsumme(Buffer.from('Belehrung A')))
      .not.toBe(pruefsumme(Buffer.from('Belehrung B')))
  })

  it('ist ein SHA-256 in Hexadezimalschreibweise', () => {
    expect(pruefsumme(Buffer.from('x'))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('lässt sich für die Anzeige kürzen', () => {
    const voll = pruefsumme(Buffer.from('x'))
    const kurz = kurzeSumme(voll)!
    expect(kurz.startsWith(voll.slice(0, 8))).toBe(true)
    expect(kurz.endsWith(voll.slice(-4))).toBe(true)
    expect(kurzeSumme(null)).toBeNull()
  })
})

describe('Wie belastbar ein Beleg ist', () => {
  const t = (s: string) => new Date(s)

  it('nennt einen fehlenden Beleg fehlend', () => {
    expect(guete({ personName: 'A' }).stufe).toBe('fehlt')
  })

  it('erkennt eine Bestätigung ohne geöffnetes Dokument', () => {
    const g = guete({ personName: 'A', bestaetigtAm: t('2026-09-22T10:00:00Z') })
    expect(g.stufe).toBe('knapp')
    expect(g.text).toMatch(/ohne das Dokument/)
  })

  it('erkennt einen Klick unmittelbar nach dem Öffnen', () => {
    const g = guete({
      personName: 'A',
      angesehenAm: t('2026-09-22T10:00:00Z'),
      bestaetigtAm: t('2026-09-22T10:00:02Z'),
    })
    expect(g.stufe).toBe('knapp')
    expect(g.text).toMatch(/2 Sekunden/)
  })

  it('nennt einen ordentlichen Beleg belegt', () => {
    expect(guete({
      personName: 'A',
      angesehenAm: t('2026-09-22T10:00:00Z'),
      bestaetigtAm: t('2026-09-22T10:04:00Z'),
    }).stufe).toBe('belegt')
  })

  it('zieht die Grenze genau bei der vereinbarten Zeit', () => {
    const am = t('2026-09-22T10:00:00Z')
    const genau = new Date(am.getTime() + KNAPP_SEKUNDEN * 1000)
    expect(guete({ personName: 'A', angesehenAm: am, bestaetigtAm: genau }).stufe)
      .toBe('belegt')
    const knapp = new Date(am.getTime() + (KNAPP_SEKUNDEN - 1) * 1000)
    expect(guete({ personName: 'A', angesehenAm: am, bestaetigtAm: knapp }).stufe)
      .toBe('knapp')
  })
})

describe('Wer wann bestätigen darf', () => {
  const verteilt = { status: 'verteilt', oeffnenNoetig: true }

  it('lässt nach dem Öffnen bestätigen', () => {
    expect(darfBestaetigen(verteilt, { angesehenAm: new Date() }).ok).toBe(true)
  })

  it('lässt ohne geöffnetes Dokument nicht bestätigen', () => {
    const r = darfBestaetigen(verteilt, {})
    expect(r.ok).toBe(false)
    expect(r.grund).toMatch(/öffne zuerst/)
  })

  it('lässt es doch, wenn der Betrieb darauf verzichtet', () => {
    expect(darfBestaetigen({ status: 'verteilt', oeffnenNoetig: false }, {}).ok)
      .toBe(true)
  })

  it('lässt nicht zweimal bestätigen', () => {
    const r = darfBestaetigen(verteilt, {
      angesehenAm: new Date(), bestaetigtAm: new Date(),
    })
    expect(r.ok).toBe(false)
    expect(r.grund).toMatch(/schon bestätigt/)
  })

  it('lässt an einem Entwurf niemanden bestätigen', () => {
    expect(darfBestaetigen({ status: 'entwurf', oeffnenNoetig: false }, {}).ok)
      .toBe(false)
  })

  it('lässt an einer geschlossenen Runde niemanden mehr bestätigen', () => {
    const r = darfBestaetigen({ status: 'geschlossen', oeffnenNoetig: false }, {})
    expect(r.ok).toBe(false)
    expect(r.grund).toMatch(/abgeschlossen/)
  })
})

describe('Der Stand einer Runde', () => {
  it('beantwortet die Frage „wer fehlt noch?"', () => {
    const s = stand([
      { personName: 'A', bestaetigtAm: new Date(), angesehenAm: new Date(Date.now() - 60_000) },
      { personName: 'B', bestaetigtAm: new Date() },
      { personName: 'C' },
      { personName: 'D' },
    ])
    expect(s.gesamt).toBe(4)
    expect(s.bestaetigt).toBe(2)
    expect(s.offen).toBe(2)
    expect(s.knapp).toBe(1)
    expect(s.anteil).toBe(50)
  })

  it('kommt mit einer leeren Runde klar', () => {
    expect(stand([])).toMatchObject({ gesamt: 0, bestaetigt: 0, anteil: 0 })
  })
})

describe('Die nächste Runde', () => {
  it('rechnet vom Verteilen und nicht von heute', () => {
    expect(naechsteRunde(new Date('2026-01-15T00:00:00Z'), 'monatlich')!
      .toISOString().slice(0, 10)).toBe('2026-02-15')
  })

  it('springt nicht über das Monatsende hinaus', () => {
    expect(naechsteRunde(new Date('2026-01-31T00:00:00Z'), 'monatlich')!
      .toISOString().slice(0, 10)).toBe('2026-02-28')
  })

  it('kennt die anderen Takte', () => {
    expect(naechsteRunde(new Date('2026-01-15T00:00:00Z'), 'quartal')!
      .toISOString().slice(0, 10)).toBe('2026-04-15')
    expect(naechsteRunde(new Date('2026-01-15T00:00:00Z'), 'jaehrlich')!
      .toISOString().slice(0, 10)).toBe('2027-01-15')
  })

  it('gibt nichts zurück, wenn nichts wiederholt wird', () => {
    expect(naechsteRunde(new Date(), null)).toBeNull()
    expect(naechsteRunde(new Date(), 'gelegentlich')).toBeNull()
  })

  it('hängt den Monat an den Titel — und nicht zweimal', () => {
    const erste = rundenTitel('Hygienebelehrung', new Date('2026-03-01T00:00:00Z'))
    expect(erste).toBe('Hygienebelehrung (März 2026)')
    const zweite = rundenTitel(erste, new Date('2026-04-01T00:00:00Z'))
    expect(zweite).toBe('Hygienebelehrung (April 2026)')
  })
})

describe('Womit bestätigt wurde', () => {
  it('erkennt App und System, ohne einen Fingerabdruck zu bilden', () => {
    expect(geraetKurz('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) OkunWorkforce'))
      .toBe('App, iOS')
    expect(geraetKurz('Mozilla/5.0 (Windows NT 10.0) Chrome/120'))
      .toBe('Browser, Windows')
  })

  it('kommt ohne Angabe aus', () => {
    expect(geraetKurz(null)).toBeNull()
  })
})
