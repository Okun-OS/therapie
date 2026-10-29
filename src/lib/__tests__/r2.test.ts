import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { downloadAdresse, uploadAdresse, loeschAdresse, r2Eingerichtet } from '../r2'

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
  // Der Programmspeicher (§210) — Windows-Aktualisierungen.
  process.env.R2_KONTO_ID = 'abc123'
  process.env.R2_BUCKET = 'okun-programm'
  process.env.R2_SCHLUESSEL = 'AKIAIOSFODNN7EXAMPLE'
  process.env.R2_GEHEIMNIS = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
  // §259 Der Dateispeicher — Anhänge und Bescheinigungen, eigener Eimer,
  // eigener Schlüssel, eigener Rechtsraum.
  process.env.R2_DATEIEN_BUCKET = 'okun-dateien'
  process.env.R2_DATEIEN_SCHLUESSEL = 'AKIAIOSFODNN7DATEIEN'
  process.env.R2_DATEIEN_GEHEIMNIS = 'ganzAndererSchluesselFuerDieDateien12345'
  process.env.R2_DATEIEN_BEREICH = 'eu'
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

/**
 * §256 Der Rechtsraum des Eimers.
 *
 * Für Personaldaten ist das keine Kür: Hier liegen
 * Arbeitsunfähigkeitsbescheinigungen, also Gesundheitsdaten nach Art. 9
 * DSGVO. Ein auf `eu` festgelegter Eimer ist NUR über eine eigene Adresse
 * erreichbar — über die allgemeine antwortet Cloudflare mit
 * „SignatureDoesNotMatch", und diese Meldung hat mit der Ursache nichts zu
 * tun.
 */
describe('§256 Der Rechtsraum', () => {
  it('ohne Festlegung die allgemeine Adresse', () => {
    delete process.env.R2_BEREICH
    const a = downloadAdresse('latest.yml', 300, JETZT)
    expect(a).toContain('abc123.r2.cloudflarestorage.com')
    expect(a).not.toContain('.eu.')
  })

  it('mit `eu` die Adresse der Europäischen Union', () => {
    process.env.R2_BEREICH = 'eu'
    expect(downloadAdresse('latest.yml', 300, JETZT))
      .toContain('abc123.eu.r2.cloudflarestorage.com')
  })

  it('Groß- und Kleinschreibung und Leerraum stören nicht', () => {
    process.env.R2_BEREICH = '  EU  '
    expect(downloadAdresse('latest.yml', 300, JETZT))
      .toContain('abc123.eu.r2.cloudflarestorage.com')
  })

  /*
   * Die Gegenprobe: Ein leerer Wert darf nicht zu `abc123..r2…` führen —
   * dieser Punkt zu viel wäre ein Wirtsname, den es nicht gibt, und der
   * Fehler sähe wieder aus wie ein Signaturfehler.
   */
  it('ein leerer Wert zählt wie keiner', () => {
    process.env.R2_BEREICH = '   '
    const a = downloadAdresse('latest.yml', 300, JETZT)
    expect(a).toContain('abc123.r2.cloudflarestorage.com')
    expect(a).not.toContain('..')
  })

  it('und die Signatur ändert sich mit der Adresse', () => {
    // Der Wirtsname geht in die Signatur ein. Täte er es nicht, wäre die
    // Umstellung wirkungslos und der Fehler bliebe unerklärlich.
    delete process.env.R2_BEREICH
    const ohne = downloadAdresse('latest.yml', 300, JETZT)
    process.env.R2_BEREICH = 'eu'
    const mit = downloadAdresse('latest.yml', 300, JETZT)
    const sig = (a: string | null) => new URL(a!).searchParams.get('X-Amz-Signature')
    expect(sig(ohne)).not.toBe(sig(mit))
  })
})

/**
 * §257 Die Adressen zum Schreiben.
 *
 * Sie sind der Kern des Umzugs: Mit ihnen lädt das Telefon DIREKT zum
 * Speicher, und die Anwendung sieht die Datei nie. Was hier falsch ist,
 * meldet sich bei Cloudflare als „SignatureDoesNotMatch" — ohne Hinweis
 * worauf. Genau deshalb steht es hier.
 */
describe('§257 Hochladen und Löschen', () => {
  it('stellt eine Adresse zum Hochladen aus', () => {
    const a = uploadAdresse('chat/raum1/foto.jpg', 'image/jpeg', 300, JETZT)
    // §259 In den DATEI-Eimer, im EU-Rechtsraum.
    expect(a).toContain('abc123.eu.r2.cloudflarestorage.com')
    expect(a).toContain('/okun-dateien/chat/raum1/foto.jpg')
    expect(a).toContain('X-Amz-Signature=')
  })

  /*
   * Der Typ wird mitsigniert. Ohne ihn könnte jemand mit einer Adresse für
   * ein Bild eine ausführbare Datei ablegen.
   */
  it('und signiert den Dateityp mit', () => {
    const a = new URL(uploadAdresse('x.jpg', 'image/jpeg', 300, JETZT)!)
    expect(a.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host')
  })

  it('ein anderer Typ ergibt eine andere Signatur', () => {
    const sig = (t: string) =>
      new URL(uploadAdresse('x.jpg', t, 300, JETZT)!).searchParams.get('X-Amz-Signature')
    expect(sig('image/jpeg')).not.toBe(sig('application/pdf'))
  })

  /*
   * Die Gegenprobe zum Lesen: Dieselbe Datei, dieselbe Zeit, andere Methode —
   * das MUSS eine andere Signatur ergeben. Täte es das nicht, wäre eine
   * Leseadresse zugleich eine Schreibadresse.
   */
  it('Lesen und Schreiben sind nicht dieselbe Adresse', () => {
    const lesen = new URL(downloadAdresse('x.jpg', 300, JETZT, 'dateien')!)
    const schreiben = new URL(uploadAdresse('x.jpg', 'image/jpeg', 300, JETZT)!)
    expect(lesen.searchParams.get('X-Amz-Signature'))
      .not.toBe(schreiben.searchParams.get('X-Amz-Signature'))
    expect(lesen.searchParams.get('X-Amz-SignedHeaders')).toBe('host')
  })

  it('löschen geht auch — für die Leiche nach einem halben Upload', () => {
    const a = loeschAdresse('chat/raum1/foto.jpg', 300, JETZT)
    expect(a).toContain('X-Amz-Signature=')
    expect(new URL(a!).searchParams.get('X-Amz-SignedHeaders')).toBe('host')
    expect(new URL(a!).searchParams.get('X-Amz-Signature'))
      .not.toBe(new URL(downloadAdresse('chat/raum1/foto.jpg', 300, JETZT, 'dateien')!)
        .searchParams.get('X-Amz-Signature'))
  })

  it('ohne eingerichteten Speicher gibt es keine Adresse', () => {
    delete process.env.R2_DATEIEN_SCHLUESSEL
    expect(uploadAdresse('x.jpg', 'image/jpeg', 300, JETZT)).toBeNull()
    expect(loeschAdresse('x.jpg', 300, JETZT)).toBeNull()
  })

  it('und ohne Rechtsraum zeigt sie auf die allgemeine Adresse', () => {
    delete process.env.R2_DATEIEN_BEREICH
    expect(uploadAdresse('x.jpg', 'image/jpeg', 300, JETZT))
      .toContain('abc123.r2.cloudflarestorage.com')
  })

  it('die Gültigkeit steht in der Adresse und ist kurz', () => {
    // Eine Schreibadresse ist ein Schreibrecht. Landet sie in einem
    // Protokoll, soll sie dort nichts mehr wert sein.
    expect(new URL(uploadAdresse('x.jpg', 'image/jpeg', undefined, JETZT)!)
      .searchParams.get('X-Amz-Expires')).toBe('300')
  })
})

/**
 * §259 Zwei Speicher, die nichts voneinander wissen.
 *
 * DER FEHLER, DER FAST PASSIERT WÄRE
 * Beim Einrichten des Dateispeichers wäre `R2_BUCKET` überschrieben worden.
 * Die Variable zeigt aber auf `okun-programm`, von dem sich das
 * Windows-Programm seine Aktualisierungen holt (§210) — die
 * Selbstaktualisierung wäre still kaputtgegangen. Still, weil sie niemand
 * täglich benutzt: Es wäre erst aufgefallen, wenn jemand eine neue Fassung
 * gebraucht hätte.
 *
 * Gefunden hat das der Eigentümer, nicht ich.
 */
describe('§259 Programm- und Dateispeicher sind getrennt', () => {
  it('die Programmdateien liegen weiter im Programmeimer', () => {
    const a = downloadAdresse('latest.yml', 300, JETZT)
    expect(a).toContain('/okun-programm/latest.yml')
    expect(a).toContain('abc123.r2.cloudflarestorage.com')
    expect(a).not.toContain('.eu.')
  })

  it('und die Anhänge im Dateieimer, in der EU', () => {
    const a = downloadAdresse('chat/x.jpg', 300, JETZT, 'dateien')
    expect(a).toContain('/okun-dateien/chat/x.jpg')
    expect(a).toContain('abc123.eu.r2.cloudflarestorage.com')
  })

  /*
   * Die Gegenprobe, die den eigentlichen Schaden ausschließt: Fehlt der
   * Dateispeicher, darf NICHT stillschweigend der Programmeimer einspringen.
   * Dann lägen Krankenscheine neben den Programmdateien — und zwar ohne
   * Rechtsraum.
   */
  it('fehlt der Dateispeicher, springt NICHT der Programmeimer ein', () => {
    delete process.env.R2_DATEIEN_BUCKET
    expect(r2Eingerichtet('dateien')).toBe(false)
    expect(uploadAdresse('x.jpg', 'image/jpeg', 300, JETZT)).toBeNull()
    // Und umgekehrt bleibt der Programmspeicher davon unberührt.
    expect(r2Eingerichtet('programm')).toBe(true)
    expect(downloadAdresse('latest.yml', 300, JETZT)).toContain('/okun-programm/')
  })

  it('und umgekehrt genauso', () => {
    delete process.env.R2_BUCKET
    expect(r2Eingerichtet('programm')).toBe(false)
    expect(r2Eingerichtet('dateien')).toBe(true)
  })

  it('die Schlüssel sind verschieden — eine Adresse öffnet nicht beide', () => {
    const sig = (a: string | null) => new URL(a!).searchParams.get('X-Amz-Signature')
    expect(sig(downloadAdresse('x', 300, JETZT)))
      .not.toBe(sig(downloadAdresse('x', 300, JETZT, 'dateien')))
  })

  it('die Kontonummer darf geteilt werden — es ist ein Konto', () => {
    delete process.env.R2_DATEIEN_KONTO_ID
    expect(downloadAdresse('x', 300, JETZT, 'dateien')).toContain('abc123.eu.')
  })

  it('lässt sich aber auch eigens setzen', () => {
    process.env.R2_DATEIEN_KONTO_ID = 'xyz789'
    expect(downloadAdresse('x', 300, JETZT, 'dateien')).toContain('xyz789.eu.')
    expect(downloadAdresse('latest.yml', 300, JETZT)).toContain('abc123.')
  })
})
