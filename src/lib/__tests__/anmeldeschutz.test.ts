import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  sperrlage, fensterBeginn, absenderadresse, adresskuerzel,
  FENSTER_MINUTEN, SPERRE_MINUTEN, MAX_JE_KONTO, MAX_JE_ADRESSE,
} from '../anmeldeschutz'

/**
 * §152 Geprüft wird beides: dass die Bremse greift, und dass sie wieder
 * aufgeht. Eine Sperre, die bleibt, ist selbst der Angriff — wer die
 * E-Mail-Adresse einer Leitung kennt, sperrt sie sonst dauerhaft aus.
 */

const jetzt = new Date('2026-09-22T10:00:00Z')
const vorMinuten = (n: number) => new Date(jetzt.getTime() - n * 60_000)

describe('Wann gesperrt wird', () => {
  it('lässt normales Vertippen durch', () => {
    expect(sperrlage({ konto: 3, adresse: 3 }, jetzt).gesperrt).toBe(false)
  })

  it('greift genau an der Kontogrenze', () => {
    expect(sperrlage({ konto: MAX_JE_KONTO - 1, adresse: 0 }, jetzt).gesperrt)
      .toBe(false)
    expect(sperrlage({ konto: MAX_JE_KONTO, adresse: 0 }, jetzt).gesperrt)
      .toBe(true)
  })

  it('greift auch, wenn sich der Angriff über viele Konten verteilt', () => {
    // Das ist der Fall, den ein reiner Kontozähler nie sieht: je Konto
    // harmlos, in der Summe ein Durchprobieren.
    const l = sperrlage({ konto: 1, adresse: MAX_JE_ADRESSE }, jetzt)
    expect(l.gesperrt).toBe(true)
    expect(l.meldung).toMatch(/von dieser Verbindung/i)
  })

  it('sagt beim Konto etwas anderes als bei der Verbindung', () => {
    const konto = sperrlage({ konto: MAX_JE_KONTO, adresse: 0 }, jetzt)
    expect(konto.meldung).toMatch(/Zugang/)
    expect(konto.meldung).toMatch(/Passwort vergessen/)
  })
})

describe('Dass die Sperre wieder aufgeht', () => {
  it('nennt die Wartezeit in Minuten', () => {
    const l = sperrlage(
      { konto: MAX_JE_KONTO, adresse: 0, aeltester: jetzt }, jetzt)
    expect(l.meldung).toMatch(new RegExp(`${SPERRE_MINUTEN} Minuten`))
  })

  it('rutscht mit dem Fenster weiter statt festzuhängen', () => {
    // Der älteste Versuch ist zehn Minuten her — es bleiben fünf.
    const l = sperrlage(
      { konto: MAX_JE_KONTO, adresse: 0, aeltester: vorMinuten(10) }, jetzt)
    expect(l.meldung).toMatch(/5 Minuten/)
  })

  it('nennt nie null Minuten', () => {
    const l = sperrlage(
      { konto: MAX_JE_KONTO, adresse: 0, aeltester: vorMinuten(SPERRE_MINUTEN) },
      jetzt)
    expect(l.meldung).toMatch(/1 Minute\b/)
  })

  it('setzt ein Ende, wann immer gesperrt wird', () => {
    const l = sperrlage({ konto: MAX_JE_KONTO, adresse: 0 }, jetzt)
    expect(l.bis).toBeInstanceOf(Date)
    expect(l.bis!.getTime()).toBeGreaterThan(jetzt.getTime())
    expect(l.bis!.getTime()).toBeLessThanOrEqual(
      jetzt.getTime() + SPERRE_MINUTEN * 60_000)
  })

  it('setzt kein Ende, wenn nicht gesperrt ist', () => {
    expect(sperrlage({ konto: 0, adresse: 0 }, jetzt).bis).toBeUndefined()
  })
})

describe('Das Zählfenster', () => {
  it('reicht genau so weit zurück, wie vereinbart', () => {
    expect(fensterBeginn(jetzt).toISOString())
      .toBe(vorMinuten(FENSTER_MINUTEN).toISOString())
  })
})

describe('Die Absenderadresse', () => {
  const kopf = (werte: Record<string, string>) => ({
    get: (n: string) => werte[n] ?? null,
  })

  it('nimmt den ersten Eintrag hinter dem Vermittler', () => {
    expect(absenderadresse(kopf({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })))
      .toBe('203.0.113.7')
  })

  it('kommt auch mit x-real-ip aus', () => {
    expect(absenderadresse(kopf({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('hat einen Ersatzwert, statt nichts zu zählen', () => {
    expect(absenderadresse(kopf({}))).toBe('unbekannt')
  })
})

describe('Das Adresskürzel', () => {
  const hash = (t: string) => createHash('sha256').update(t).digest('hex')

  it('ist für dieselbe Adresse dasselbe', () => {
    expect(adresskuerzel('203.0.113.7', 'geheim', hash))
      .toBe(adresskuerzel('203.0.113.7', 'geheim', hash))
  })

  it('unterscheidet verschiedene Adressen', () => {
    expect(adresskuerzel('203.0.113.7', 'geheim', hash))
      .not.toBe(adresskuerzel('203.0.113.8', 'geheim', hash))
  })

  it('enthält die Adresse nicht im Klartext', () => {
    expect(adresskuerzel('203.0.113.7', 'geheim', hash)).not.toContain('203.0.113.7')
  })

  it('ändert sich mit dem Geheimnis — sonst ließe es sich zurückrechnen', () => {
    // Der IPv4-Raum ist klein genug, dass ein ungesalzener Hash nichts verbirgt.
    expect(adresskuerzel('203.0.113.7', 'geheim-a', hash))
      .not.toBe(adresskuerzel('203.0.113.7', 'geheim-b', hash))
  })
})
