import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nachweisAusstellen, nachweisGueltig } from '../objekt-nachweis'

/**
 * §261 Der Nachweis über einen ausgegebenen Platz im Objektspeicher.
 *
 * Geprüft wird vor allem, was NICHT gelten darf. Ein Nachweis, der zu weich
 * ist, sieht im Betrieb genauso aus wie ein richtiger — bis jemand eine
 * fremde Datei in seine Akte einträgt.
 */

const SICHERN = { ...process.env }
beforeEach(() => { process.env.SESSION_SECRET = 'geheim-fuer-den-test-1234567890' })
afterEach(() => { process.env = { ...SICHERN } })

const JETZT = new Date('2026-10-29T12:00:00.000Z')
const SPAETER = (sekunden: number) => new Date(JETZT.getTime() + sekunden * 1000)

const K = 'chat/r1/2026-10-29/9f3c.jpg'
const Z = 'chat:r1'

describe('§261 nachweisAusstellen / nachweisGueltig', () => {
  it('ein eigener Nachweis gilt', () => {
    const n = nachweisAusstellen(K, Z, 1800, JETZT)
    expect(nachweisGueltig(K, Z, n, JETZT)).toBe(true)
  })

  it('und zwar bis zum letzten Augenblick', () => {
    const n = nachweisAusstellen(K, Z, 1800, JETZT)
    expect(nachweisGueltig(K, Z, n, SPAETER(1799))).toBe(true)
  })

  it('danach nicht mehr', () => {
    const n = nachweisAusstellen(K, Z, 1800, JETZT)
    expect(nachweisGueltig(K, Z, n, SPAETER(1801))).toBe(false)
  })

  /*
   * Die wichtigste Gegenprobe: Ein Nachweis gilt für GENAU diesen Schlüssel.
   * Ohne das wäre das ganze Verfahren nur Zierde — man bekäme einen Platz
   * redlich und löste ihn auf einer fremden Datei ein.
   */
  it('gilt nicht für einen anderen Schlüssel', () => {
    const n = nachweisAusstellen(K, Z, 1800, JETZT)
    expect(nachweisGueltig('chat/r1/2026-10-29/andere.jpg', Z, n, JETZT)).toBe(false)
  })

  it('und nicht für eine andere Verwendung', () => {
    const n = nachweisAusstellen(K, 'akte:employee:e1:bescheinigung', 1800, JETZT)
    expect(nachweisGueltig(K, 'akte:employee:e2:bescheinigung', n, JETZT)).toBe(false)
    expect(nachweisGueltig(K, 'akte:employee:e1:lohnabrechnung', n, JETZT)).toBe(false)
    expect(nachweisGueltig(K, 'chat:r1', n, JETZT)).toBe(false)
  })

  it('eine verlängerte Ablaufzeit macht ihn ungültig, nicht länger gültig', () => {
    // Der naheliegende Angriff: die Zahl vorn hochdrehen. Sie ist
    // mitunterschrieben.
    const n = nachweisAusstellen(K, Z, 60, JETZT)
    const ablauf = Number(n.split('.')[0])
    const gefaelscht = `${ablauf + 100000}.${n.slice(n.indexOf('.') + 1)}`
    expect(nachweisGueltig(K, Z, gefaelscht, SPAETER(120))).toBe(false)
  })

  it('mit einem anderen Geheimnis gilt er nicht', () => {
    const n = nachweisAusstellen(K, Z, 1800, JETZT)
    process.env.SESSION_SECRET = 'ein-ganz-anderes-geheimnis-0987654321'
    expect(nachweisGueltig(K, Z, n, JETZT)).toBe(false)
  })

  it('Unsinn gilt nicht — in keiner Form', () => {
    for (const n of [
      undefined, null, '', '.', 'abc', 'abc.def', '0.abc', '-1.abc',
      `${Math.floor(JETZT.getTime() / 1000) + 900}.`,
      `${Math.floor(JETZT.getTime() / 1000) + 900}.zuKurz`,
      'NaN.abc', '1e9999.abc',
    ]) {
      expect(nachweisGueltig(K, Z, n as string | undefined, JETZT)).toBe(false)
    }
  })

  it('zwei Nachweise für denselben Platz sind gleich — es ist eine Unterschrift', () => {
    // Keine Zufälligkeit darin: Sonst ließe sich ein Nachweis nicht prüfen,
    // ohne ihn zu speichern.
    expect(nachweisAusstellen(K, Z, 1800, JETZT)).toBe(nachweisAusstellen(K, Z, 1800, JETZT))
  })

  it('verrät das Geheimnis nicht', () => {
    expect(nachweisAusstellen(K, Z, 1800, JETZT)).not.toContain('geheim-fuer-den-test')
  })
})
