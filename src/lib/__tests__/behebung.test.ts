import { describe, it, expect } from 'vitest'
import {
  beurteileBehebung, pruefstandReicht, UNANTASTBAR,
  DIREKT_MAX_ZEILEN, DIREKT_MAX_DATEIEN, type Vorhaben,
} from '../behebung'

/**
 * §142 Diese Regeln entscheiden, ob ein Programm, das Gehälter rechnet, sich
 * selbst verändern darf. Jede einzelne wird hier nachgerechnet — und die
 * Fälle, in denen NICHT gehandelt wird, gründlicher als die anderen.
 *
 * Der Maßstab dabei: Ein zu streng abgelehnter Fund kostet einen Klick. Ein zu
 * großzügig durchgewinkter kostet im schlimmsten Fall einen falschen Lohn.
 */

const fund = (a: Partial<Vorhaben['fund']> = {}): Vorhaben['fund'] => ({
  art: 'fehler', bereich: 'nachrichten', heikel: false,
  meldeQualitaet: 'gruen', freigabe: null, ...a,
})

const vorhaben = (v: Partial<Vorhaben> = {}): Vorhaben => ({
  fund: fund(),
  klasse: 'anzeige',
  dateien: ['src/components/chat/Nachrichten.tsx'],
  zeilen: 3,
  ...v,
})

describe('Was ohne Rückfrage rausgehen darf', () => {
  it('lässt einen Tippfehler in einer Anzeigedatei durch', () => {
    const u = beurteileBehebung(vorhaben())
    expect(u.ausgang).toBe('direkt')
  })

  it('lässt bis zu drei Dateien und vierzig Zeilen durch', () => {
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/app/a/page.tsx', 'src/app/b/page.tsx', 'src/components/c.tsx'],
      zeilen: DIREKT_MAX_ZEILEN,
    })).ausgang).toBe('direkt')
  })
})

describe('Was gebaut wird, aber warten muss', () => {
  it('sammelt, sobald Verhalten im Spiel ist', () => {
    const u = beurteileBehebung(vorhaben({ klasse: 'logik' }))
    expect(u.ausgang).toBe('sammeln')
    expect(u.grund).toMatch(/Verhalten/)
  })

  it('sammelt eine Datei, die keine reine Anzeige ist', () => {
    // Eine Schnittstelle ist Verhalten, auch wenn der Lauf sie für Anzeige hält.
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/app/api/chat/route.ts'],
    })).ausgang).toBe('sammeln')
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/lib/utils.ts'],
    })).ausgang).toBe('sammeln')
  })

  it('sammelt, wenn es zu viele Dateien sind', () => {
    const viele = Array.from({ length: DIREKT_MAX_DATEIEN + 1 },
      (_, i) => `src/components/x${i}.tsx`)
    expect(beurteileBehebung(vorhaben({ dateien: viele })).ausgang).toBe('sammeln')
  })

  it('sammelt, wenn es zu viele Zeilen sind', () => {
    expect(beurteileBehebung(vorhaben({ zeilen: DIREKT_MAX_ZEILEN + 1 })).ausgang)
      .toBe('sammeln')
  })

  it('sammelt eine Anzeigedatei, die an einer heiklen Stelle liegt', () => {
    // Die Lohnseite ist eine Seite wie jede andere — aber was darauf steht,
    // entscheidet über Geld.
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/app/employee/lohn/page.tsx'],
    })).ausgang).toBe('sammeln')
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/components/employee/Stempeluhr.tsx'],
    })).ausgang).toBe('sammeln')
  })

  it('sammelt einen freigegebenen heiklen Fund, rollt ihn aber nicht aus', () => {
    // Bestätigt wurde die Absicht, nicht der Code.
    const u = beurteileBehebung(vorhaben({
      fund: fund({ bereich: 'lohn', freigabe: 'freigegeben' }),
      dateien: ['src/components/ui/Card.tsx'],
    }))
    expect(u.ausgang).toBe('sammeln')
  })
})

describe('Was gar nicht angefasst wird', () => {
  it('lehnt jede Änderung an den Prüfungen ab', () => {
    // Die wichtigste Regel von allen: Wer seine eigene Prüfung ändern darf,
    // bekommt jede Änderung grün.
    const u = beurteileBehebung(vorhaben({ dateien: ['pruefungen/b-zeit.mjs'] }))
    expect(u.ausgang).toBe('abgelehnt')
    expect(u.grund).toMatch(/Prüfung/)
  })

  it('lehnt jede Änderung an den Modultests ab', () => {
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/lib/__tests__/lohn.test.ts'],
    })).ausgang).toBe('abgelehnt')
  })

  it('lehnt auch ab, wenn nur EINE von mehreren Dateien verboten ist', () => {
    // Der gefährliche Fall: eine harmlose Änderung als Verpackung.
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/components/ui/Card.tsx', 'pruefungen/d-lohn.mjs'],
    })).ausgang).toBe('abgelehnt')
  })

  it('lehnt Datenbank-Wanderungen ab', () => {
    expect(beurteileBehebung(vorhaben({
      dateien: ['prisma/schema.prisma'],
    })).ausgang).toBe('abgelehnt')
    expect(beurteileBehebung(vorhaben({
      dateien: ['prisma/migrations/20260101_x/migration.sql'],
    })).ausgang).toBe('abgelehnt')
  })

  it('lehnt Anmeldung, Rechte, Lohn und Datenschutz ab', () => {
    for (const d of [
      'src/lib/session.ts', 'src/lib/scope.ts', 'src/lib/lohnsteuer.ts',
      'src/lib/dsgvo-loeschung.ts', 'src/lib/payroll-beleg.ts',
    ]) {
      expect(beurteileBehebung(vorhaben({ dateien: [d] })).ausgang).toBe('abgelehnt')
    }
  })

  it('lehnt Änderungen an den eigenen Regeln ab', () => {
    // Sonst schreibt sich der Lauf die Erlaubnis selbst.
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/lib/behebung.ts'],
    })).ausgang).toBe('abgelehnt')
    expect(beurteileBehebung(vorhaben({
      dateien: ['src/lib/funde.ts'],
    })).ausgang).toBe('abgelehnt')
  })

  it('lehnt die native Hülle und den Aufbau ab', () => {
    for (const d of ['ios/App/App/Info.plist', 'package.json', '.github/workflows/x.yml']) {
      expect(beurteileBehebung(vorhaben({ dateien: [d] })).ausgang).toBe('abgelehnt')
    }
  })

  it('lehnt ab, wenn gar keine Datei genannt ist', () => {
    expect(beurteileBehebung(vorhaben({ dateien: [] })).ausgang).toBe('abgelehnt')
  })

  it('lehnt einen heiklen Bereich ohne Freigabe ab', () => {
    const u = beurteileBehebung(vorhaben({ fund: fund({ bereich: 'lohn' }) }))
    expect(u.ausgang).toBe('abgelehnt')
    expect(u.grund).toMatch(/Freigabe/)
  })

  it('lehnt eine Verbesserung ohne Freigabe ab', () => {
    const u = beurteileBehebung(vorhaben({ fund: fund({ art: 'verbesserung' }) }))
    expect(u.ausgang).toBe('abgelehnt')
    expect(u.grund).toMatch(/Freigabe/)
  })

  it('lehnt eine unvollständige Meldung ab', () => {
    const u = beurteileBehebung(vorhaben({ fund: fund({ meldeQualitaet: 'gelb' }) }))
    expect(u.ausgang).toBe('abgelehnt')
    expect(u.grund).toMatch(/Rückfrage/)
  })

  it('nennt bei jeder Ablehnung einen Grund, den ein Mensch versteht', () => {
    for (const d of ['pruefungen/x.mjs', 'prisma/schema.prisma', 'src/lib/session.ts']) {
      const u = beurteileBehebung(vorhaben({ dateien: [d] }))
      expect(u.grund.length).toBeGreaterThan(20)
    }
  })

  it('hat für jedes Verbot eine Begründung hinterlegt', () => {
    for (const u of UNANTASTBAR) expect(u.grund.length).toBeGreaterThan(20)
  })
})

describe('Der Prüfstand', () => {
  const gut = { pruefungen: 730, pruefungenFehler: 0, modultests: 484, modultestsFehler: 0, build: true }

  it('lässt ein vollständig grünes Ergebnis durch', () => {
    expect(pruefstandReicht(gut).ok).toBe(true)
  })

  it('hält an, wenn der Build nicht lief', () => {
    expect(pruefstandReicht({ ...gut, build: false }).ok).toBe(false)
  })

  it('hält bei einer einzigen roten Prüfung an', () => {
    expect(pruefstandReicht({ ...gut, pruefungenFehler: 1 }).ok).toBe(false)
    expect(pruefstandReicht({ ...gut, modultestsFehler: 1 }).ok).toBe(false)
  })

  it('erkennt eine Prüfreihe, die gar nicht gelaufen ist', () => {
    // Null Prüfungen und null Fehler sieht in einer Zusammenfassung aus wie
    // „keine Fehler" — es heißt aber „nichts geprüft".
    const u = pruefstandReicht({ pruefungen: 0, modultests: 0, build: true })
    expect(u.ok).toBe(false)
    expect(u.grund).toMatch(/nichts geprüft/i)
  })

  it('nennt bei jedem Anhalten den Grund', () => {
    for (const p of [
      { ...gut, build: false },
      { ...gut, pruefungenFehler: 2 },
      { pruefungen: 0, modultests: 0, build: true },
    ]) {
      expect(pruefstandReicht(p).grund.length).toBeGreaterThan(10)
    }
  })
})
