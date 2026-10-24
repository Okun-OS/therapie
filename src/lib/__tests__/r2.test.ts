import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { downloadAdresse, r2Eingerichtet } from '../r2'

/**
 * §210 Die ausgestellte Download-Adresse.
 *
 * WAS DIESE TESTS KÖNNEN UND WAS NICHT
 * Sie können nicht beweisen, dass Cloudflare die Signatur annimmt — dafür
 * braucht es echte Zugangsdaten und einen echten Bucket. Das wird einmal von
 * Hand gegen den laufenden Speicher geprüft, und zwar bevor etwas
 * ausgeliefert wird.
 *
 * Was sie sehr wohl können: jeden Fehler fangen, der die Signatur still
 * falsch macht. Und davon gibt es hier viele — ein nicht kodiertes Zeichen,
 * eine falsche Reihenfolge der Parameter, ein durchgerutschter Zeitstempel.
 * Alle melden sich bei Cloudflare mit derselben Auskunft:
 * „SignatureDoesNotMatch", ohne Hinweis worauf.
 */

const SICHERN = { ...process.env }

beforeEach(() => {
  process.env.R2_KONTO_ID = 'abc123'
  process.env.R2_BUCKET = 'okun-programm'
  process.env.R2_SCHLUESSEL = 'AKIAIOSFODNN7EXAMPLE'
  process.env.R2_GEHEIMNIS = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
})
afterEach(() => { process.env = { ...SICHERN } })

const JETZT = new Date('2026-01-21T14:30:00.000Z')

describe('§210 Ist der Speicher eingerichtet?', () => {
  it('erkennt vollständige Zugangsdaten', () => {
    expect(r2Eingerichtet()).toBe(true)
  })

  it('gilt NICHT als eingerichtet, wenn eine Angabe fehlt', () => {
    // Halb eingerichtet ist nicht eingerichtet: Sonst stellte die Anlage
    // Adressen aus, die beim Kunden ins Leere führen.
    for (const k of ['R2_KONTO_ID', 'R2_BUCKET', 'R2_SCHLUESSEL', 'R2_GEHEIMNIS']) {
      const sichern = process.env[k]
      delete process.env[k]
      expect(r2Eingerichtet()).toBe(false)
      process.env[k] = sichern
    }
  })

  it('stellt ohne Zugangsdaten keine Adresse aus', () => {
    delete process.env.R2_GEHEIMNIS
    expect(downloadAdresse('egal.exe')).toBeNull()
  })
})

describe('§210 Die ausgestellte Adresse', () => {
  const adresse = () => downloadAdresse('OKUN-Workforce-0.2.0-win-x64.exe', 900, JETZT)!

  it('zeigt auf den richtigen Speicher und die richtige Datei', () => {
    const u = new URL(adresse())
    expect(u.host).toBe('abc123.r2.cloudflarestorage.com')
    expect(u.pathname).toBe('/okun-programm/OKUN-Workforce-0.2.0-win-x64.exe')
  })

  it('trägt alle Angaben, die das Verfahren verlangt', () => {
    const p = new URL(adresse()).searchParams
    expect(p.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(p.get('X-Amz-Date')).toBe('20260121T143000Z')
    expect(p.get('X-Amz-Expires')).toBe('900')
    expect(p.get('X-Amz-SignedHeaders')).toBe('host')
    expect(p.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('nennt den Geltungsbereich mit Region „auto"', () => {
    // R2 kennt keine Regionen wie AWS; verlangt wird trotzdem eine, und zwar
    // genau diese. Steht dort etwas anderes, wird abgelehnt.
    expect(new URL(adresse()).searchParams.get('X-Amz-Credential'))
      .toBe('AKIAIOSFODNN7EXAMPLE/20260121/auto/s3/aws4_request')
  })

  it('verrät das Geheimnis nicht', () => {
    expect(adresse()).not.toContain('wJalrXUtnFEMI')
  })

  it('ist bei gleicher Zeit immer dieselbe', () => {
    // Nicht aus Bequemlichkeit: Wäre etwas Zufälliges in der Signatur, ließe
    // sich hier gar nichts prüfen.
    expect(adresse()).toBe(adresse())
  })
})

describe('§210 Was die Signatur still kaputt machen würde', () => {
  const sig = (u: string) => new URL(u).searchParams.get('X-Amz-Signature')

  it('ändert sich mit der Datei', () => {
    expect(sig(downloadAdresse('a.exe', 900, JETZT)!))
      .not.toBe(sig(downloadAdresse('b.exe', 900, JETZT)!))
  })

  it('ändert sich mit der Gültigkeitsdauer', () => {
    expect(sig(downloadAdresse('a.exe', 900, JETZT)!))
      .not.toBe(sig(downloadAdresse('a.exe', 300, JETZT)!))
  })

  it('ändert sich mit der Zeit', () => {
    const spaeter = new Date(JETZT.getTime() + 60_000)
    expect(sig(downloadAdresse('a.exe', 900, JETZT)!))
      .not.toBe(sig(downloadAdresse('a.exe', 900, spaeter)!))
  })

  it('ändert sich mit dem Geheimnis', () => {
    const eine = sig(downloadAdresse('a.exe', 900, JETZT)!)
    process.env.R2_GEHEIMNIS = 'ein-anderes-geheimnis'
    expect(sig(downloadAdresse('a.exe', 900, JETZT)!)).not.toBe(eine)
  })

  it('ändert sich mit dem Bucket', () => {
    const eine = sig(downloadAdresse('a.exe', 900, JETZT)!)
    process.env.R2_BUCKET = 'ein-anderer-bucket'
    expect(sig(downloadAdresse('a.exe', 900, JETZT)!)).not.toBe(eine)
  })

  it('kodiert Zeichen, die AWS anders behandelt als JavaScript', () => {
    /*
     * `encodeURIComponent` lässt ! ' ( ) * stehen, AWS nicht. Ein Dateiname
     * mit Klammer ergäbe sonst eine Signatur über einen anderen Pfad als den
     * angefragten — und die Antwort wäre „SignatureDoesNotMatch" ohne jeden
     * Hinweis worauf.
     */
    const u = new URL(downloadAdresse("OKUN (2).exe", 900, JETZT)!)
    expect(u.pathname).toContain('%28')
    expect(u.pathname).toContain('%29')
    expect(u.pathname).not.toContain('(')
  })

  it('lässt die Schrägstriche im Pfad stehen', () => {
    // Ein kodierter Schrägstrich wäre ein Dateiname mit „/" im Namen —
    // etwas ganz anderes als ein Verzeichnis.
    expect(new URL(downloadAdresse('a.exe', 900, JETZT)!).pathname)
      .toBe('/okun-programm/a.exe')
  })

  it('sortiert die Parameter — die Reihenfolge ist Teil der Signatur', () => {
    const roh = downloadAdresse('a.exe', 900, JETZT)!
    const namen = roh.split('?')[1].split('&')
      .map(t => t.split('=')[0])
      .filter(n => n !== 'X-Amz-Signature')
    expect(namen).toEqual([...namen].sort())
  })
})
