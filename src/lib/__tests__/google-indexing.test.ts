import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { generateKeyPairSync, createVerify } from 'crypto'
import {
  TAGESGRENZE, STAPELGRENZE,
  indexierungEingerichtet, stellenAdresse, istOeffentlich, meldungFuer,
  jwtBauen, melden, meldenViele, kontingentTag, kontingentStand,
  kontingentZuruecksetzen, gedaechtnisLeeren, tokenVergessen,
} from '../google-indexing'

/**
 * §216 Die Meldung an Google.
 *
 * WAS DIESE PRÜFUNGEN KÖNNEN UND WAS NICHT
 * Sie können nicht beweisen, dass Google die Meldung annimmt — dafür braucht
 * es ein echtes Dienstkonto und eine Domain, die in der Search Console auf
 * uns eingetragen ist. Das wird einmal von Hand geprüft.
 *
 * Was sie sehr wohl können: jeden Fehler fangen, der still etwas Falsches
 * meldet. Davon gibt es hier drei Sorten, und alle drei sind unsichtbar, wenn
 * man nicht danach sucht: eine Adresse, die es nicht gibt (404 im Index),
 * eine Meldung, die niemand angefordert hat (verbrauchtes Kontingent aller
 * Mandanten), und eine Signatur, die nicht stimmt (Ablehnung ohne Hinweis
 * worauf).
 */

const SICHERN = { ...process.env }

let schluessel: string
let oeffentlich: string

beforeAll(() => {
  const paar = generateKeyPairSync('rsa', { modulusLength: 2048 })
  schluessel = paar.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  oeffentlich = paar.publicKey.export({ type: 'spki', format: 'pem' }).toString()
})

beforeEach(() => {
  process.env.APP_URL = 'https://okun-workforce.com'
  process.env.GOOGLE_INDEXING_EMAIL = 'indexierung@okun.iam.gserviceaccount.com'
  process.env.GOOGLE_INDEXING_SCHLUESSEL = schluessel
  kontingentZuruecksetzen()
  gedaechtnisLeeren()
  tokenVergessen()
})

afterEach(() => {
  process.env = { ...SICHERN }
  vi.unstubAllGlobals()
})

/** Ein Netz, das jede Anfrage beantwortet — und mitzählt, wie oft. */
function netzStellen(status = 200) {
  const ruf = vi.fn(async (adresse: string) => {
    if (String(adresse).includes('oauth2')) {
      return new Response(
        JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    return new Response('{}', { status })
  })
  vi.stubGlobal('fetch', ruf)
  return ruf
}

describe('§216 Ist die Indexierung eingerichtet?', () => {
  it('erkennt vollständige Zugangsdaten', () => {
    expect(indexierungEingerichtet()).toBe(true)
  })

  it('gilt NICHT als eingerichtet, wenn eine Angabe fehlt', () => {
    for (const k of ['GOOGLE_INDEXING_EMAIL', 'GOOGLE_INDEXING_SCHLUESSEL']) {
      const sichern = process.env[k]
      delete process.env[k]
      expect(indexierungEingerichtet()).toBe(false)
      process.env[k] = sichern
    }
  })

  it('erkennt eine hineinkopierte JSON-Datei als untauglich', () => {
    // Der häufigste Fehler beim Einrichten: Man kopiert die ganze
    // Dienstkonto-Datei in die Variable statt nur den Schlüssel daraus.
    process.env.GOOGLE_INDEXING_SCHLUESSEL = '{"type":"service_account"}'
    expect(indexierungEingerichtet()).toBe(false)
  })

  it('nimmt Zeilenumbrüche auch als \\n geschrieben an', () => {
    process.env.GOOGLE_INDEXING_SCHLUESSEL = schluessel.replace(/\n/g, '\\n')
    expect(indexierungEingerichtet()).toBe(true)
  })

  it('meldet ohne Zugangsdaten gar nichts — und fragt das Netz nicht', () => {
    const netz = netzStellen()
    delete process.env.GOOGLE_INDEXING_SCHLUESSEL
    return melden('https://okun-workforce.com/karriere/a/b', 'URL_UPDATED')
      .then(e => {
        expect(e).toEqual({ ok: false, grund: 'nicht eingerichtet' })
        expect(netz).not.toHaveBeenCalled()
      })
  })
})

describe('§216 Die Adresse der Anzeige', () => {
  it('setzt sie aus Karriereadresse und Stellenadresse zusammen', () => {
    expect(stellenAdresse('kita-sonnenschein', 'erzieherin-fruehdienst'))
      .toBe('https://okun-workforce.com/karriere/kita-sonnenschein/erzieherin-fruehdienst')
  })

  it('verträgt einen Schrägstrich am Ende der Grundadresse', () => {
    // Google prüft die Adresse gegen die Search Console. Ein doppelter
    // Schrägstrich ist für Google eine andere Seite — und zwar eine, die uns
    // nicht gehört.
    expect(stellenAdresse('a', 'b', 'https://okun-workforce.com///'))
      .toBe('https://okun-workforce.com/karriere/a/b')
  })

  it('gibt ohne Grundadresse nichts zurück', () => {
    delete process.env.APP_URL
    expect(stellenAdresse('a', 'b', undefined)).toBeNull()
  })

  /*
   * §238 Die Gegenprobe zur Sperre darüber.
   *
   * Sie darf nicht ALLES abweisen: Steht in `APP_URL` der von Railway
   * erzeugte Name, springt `kanonischeBasis` mit der Betriebsadresse ein, und
   * dann MUSS eine Adresse herauskommen. Ohne diesen Fall wäre „gibt nichts
   * zurück" auch dann grün, wenn die Funktion nie wieder etwas zurückgibt.
   */
  it('aber mit dem erzeugten Railway-Namen die Betriebsadresse', () => {
    process.env.APP_URL = 'https://therapie-production.up.railway.app'
    // Der Rückfall auf die Betriebsadresse gilt nur im Betrieb — im Testlauf
    // bliebe es sonst bei `localhost`, und das wäre richtig so.
    const vorher = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV',
      { value: 'production', configurable: true, writable: true, enumerable: true })
    try {
      expect(stellenAdresse('kita', 'erzieher'))
        .toBe('https://okun-workforce.com/karriere/kita/erzieher')
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV',
        { value: vorher, configurable: true, writable: true, enumerable: true })
    }
  })

  it('und eine eigene Adresse bleibt natürlich die eigene', () => {
    process.env.APP_URL = 'https://okun-workforce.com'
    expect(stellenAdresse('kita', 'erzieher'))
      .toBe('https://okun-workforce.com/karriere/kita/erzieher')
  })

  it('kodiert, was kodiert gehört', () => {
    expect(stellenAdresse('träger', 'stelle nr 2'))
      .toBe('https://okun-workforce.com/karriere/tr%C3%A4ger/stelle%20nr%202')
  })
})

describe('§216 Wann ist eine Anzeige öffentlich?', () => {
  it('nur bei eingeschalteter Seite UND veröffentlichter Anzeige', () => {
    expect(istOeffentlich('veroeffentlicht', true)).toBe(true)
    expect(istOeffentlich('veroeffentlicht', false)).toBe(false)
    expect(istOeffentlich('entwurf', true)).toBe(false)
    expect(istOeffentlich('geschlossen', true)).toBe(false)
    expect(istOeffentlich('entwurf', false)).toBe(false)
  })
})

describe('§216 Was gemeldet wird', () => {
  it('meldet eine neu veröffentlichte Anzeige an', () => {
    expect(meldungFuer(false, true)).toBe('URL_UPDATED')
  })

  it('meldet eine geschlossene Anzeige ab', () => {
    expect(meldungFuer(true, false)).toBe('URL_DELETED')
  })

  it('meldet eine geänderte, weiterhin offene Anzeige erneut an', () => {
    expect(meldungFuer(true, true, true)).toBe('URL_UPDATED')
  })

  it('meldet nichts, wenn eine offene Anzeige unverändert bleibt', () => {
    expect(meldungFuer(true, true, false)).toBeNull()
  })

  it('meldet NICHTS, wenn ein Entwurf bearbeitet wird', () => {
    // Der wichtigste Fall: Wer zehnmal an einem Entwurf schreibt, darf nicht
    // zehn Meldungen aus dem gemeinsamen Tageskontingent verbrauchen.
    expect(meldungFuer(false, false, true)).toBeNull()
  })
})

describe('§216 Das signierte Token', () => {
  const zugang = () => ({ email: 'a@b.iam.gserviceaccount.com', schluessel })
  const JETZT = new Date('2026-10-22T10:00:00.000Z')

  it('besteht aus Kopf, Inhalt und Signatur', () => {
    expect(jwtBauen(zugang(), JETZT).split('.')).toHaveLength(3)
  })

  it('nennt das Verfahren, das Google verlangt', () => {
    const [kopf] = jwtBauen(zugang(), JETZT).split('.')
    expect(JSON.parse(Buffer.from(kopf, 'base64url').toString()))
      .toEqual({ alg: 'RS256', typ: 'JWT' })
  })

  it('trägt Absender, Geltungsbereich und Empfänger', () => {
    const [, inhalt] = jwtBauen(zugang(), JETZT).split('.')
    const d = JSON.parse(Buffer.from(inhalt, 'base64url').toString())
    expect(d.iss).toBe('a@b.iam.gserviceaccount.com')
    expect(d.scope).toBe('https://www.googleapis.com/auth/indexing')
    expect(d.aud).toBe('https://oauth2.googleapis.com/token')
    expect(d.iat).toBe(Math.floor(JETZT.getTime() / 1000))
    // Eine Stunde ist das Höchstmaß, das Google annimmt.
    expect(d.exp - d.iat).toBe(3600)
  })

  it('ist mit dem öffentlichen Schlüssel nachprüfbar', () => {
    // Das ist die Prüfung, die zählt: Eine falsch gebaute Signatur meldet
    // sich bei Google als „invalid_grant" ohne jeden Hinweis worauf.
    const [kopf, inhalt, signatur] = jwtBauen(zugang(), JETZT).split('.')
    const echt = createVerify('RSA-SHA256')
      .update(`${kopf}.${inhalt}`)
      .verify(oeffentlich, Buffer.from(signatur, 'base64url'))
    expect(echt).toBe(true)
  })

  it('ändert sich mit dem Zeitpunkt', () => {
    const spaeter = new Date(JETZT.getTime() + 60_000)
    expect(jwtBauen(zugang(), JETZT)).not.toBe(jwtBauen(zugang(), spaeter))
  })

  it('verrät den privaten Schlüssel nicht', () => {
    expect(jwtBauen(zugang(), JETZT)).not.toContain('PRIVATE KEY')
  })
})

describe('§216 Das Tageskontingent', () => {
  it('rechnet den Tag in pazifischer Zeit, nicht in unserer', () => {
    // Google setzt um Mitternacht pazifischer Zeit zurück. Am 22.10. um
    // 01:00 UTC ist dort noch der 21.
    expect(kontingentTag(new Date('2026-10-22T01:00:00.000Z'))).toBe('2026-10-21')
    expect(kontingentTag(new Date('2026-10-22T08:00:00.000Z'))).toBe('2026-10-22')
  })

  it('zählt jede Meldung mit', async () => {
    netzStellen()
    await melden('https://okun-workforce.com/karriere/a/1', 'URL_UPDATED')
    await melden('https://okun-workforce.com/karriere/a/2', 'URL_UPDATED')
    expect(kontingentStand()).toBe(2)
  })

  it('hört bei der Grenze auf', async () => {
    const netz = netzStellen()
    for (let i = 0; i < TAGESGRENZE; i++) {
      await melden(`https://okun-workforce.com/karriere/a/${i}`, 'URL_UPDATED')
    }
    const rufeVorher = netz.mock.calls.length
    const eine = await melden('https://okun-workforce.com/karriere/a/zuviel', 'URL_UPDATED')

    expect(eine).toEqual({ ok: false, grund: 'kontingent' })
    // Und zwar wirklich: keine weitere Anfrage ins Netz.
    expect(netz.mock.calls.length).toBe(rufeVorher)
  })

  it('fängt am nächsten pazifischen Tag von vorn an', async () => {
    netzStellen()
    const abends = new Date('2026-10-22T20:00:00.000Z')    // 13:00 in Los Angeles
    const morgens = new Date('2026-10-23T20:00:00.000Z')   // ein Tag später
    await melden('https://okun-workforce.com/karriere/a/1', 'URL_UPDATED', abends)
    expect(kontingentStand(abends)).toBe(1)
    expect(kontingentStand(morgens)).toBe(0)
  })
})

describe('§216 Dasselbe nicht zweimal', () => {
  it('verschluckt die zweite gleiche Meldung', async () => {
    netzStellen()
    const url = 'https://okun-workforce.com/karriere/a/b'
    expect(await melden(url, 'URL_UPDATED')).toEqual({ ok: true })
    expect(await melden(url, 'URL_UPDATED')).toEqual({ ok: false, grund: 'doppelt' })
    // Verbraucht wurde nur eine Einheit, nicht zwei.
    expect(kontingentStand()).toBe(1)
  })

  it('lässt die Gegenmeldung aber durch', async () => {
    // Veröffentlichen und gleich wieder schließen ist ungeschickt, aber
    // erlaubt — und die Abmeldung darf nicht am Gedächtnis hängen bleiben.
    netzStellen()
    const url = 'https://okun-workforce.com/karriere/a/b'
    await melden(url, 'URL_UPDATED')
    expect(await melden(url, 'URL_DELETED')).toEqual({ ok: true })
  })

  it('unterscheidet verschiedene Anzeigen', async () => {
    netzStellen()
    await melden('https://okun-workforce.com/karriere/a/1', 'URL_UPDATED')
    expect(await melden('https://okun-workforce.com/karriere/a/2', 'URL_UPDATED'))
      .toEqual({ ok: true })
  })
})

describe('§216 Wenn Google ablehnt', () => {
  it('reicht den Fehler nicht nach oben durch', async () => {
    // Eine Anzeige zu veröffentlichen darf nicht daran scheitern, dass
    // Google gerade nicht mag.
    netzStellen(403)
    const e = await melden('https://okun-workforce.com/karriere/a/b', 'URL_UPDATED')
    expect(e).toEqual({ ok: false, grund: 'abgelehnt', status: 403 })
  })

  it('überlebt ein Netz, das gar nicht antwortet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('kein Netz') }))
    const e = await melden('https://okun-workforce.com/karriere/a/b', 'URL_UPDATED')
    expect(e).toEqual({ ok: false, grund: 'abgelehnt' })
  })
})

describe('§216 Mehrere auf einmal', () => {
  it('meldet jede Adresse einzeln', async () => {
    netzStellen()
    const ergebnis = await meldenViele([
      { url: 'https://okun-workforce.com/karriere/a/1', art: 'URL_UPDATED' },
      { url: 'https://okun-workforce.com/karriere/a/2', art: 'URL_UPDATED' },
    ])
    expect(ergebnis).toEqual({ gemeldet: 2, uebersprungen: 0 })
  })

  it('deckelt, was eine einzelne Handlung auslösen darf', async () => {
    // Ein Betrieb schaltet seine Seite mit hundert Anzeigen ab. Ohne diesen
    // Deckel wäre das halbe Tageskontingent aller Mandanten weg.
    netzStellen()
    const viele = Array.from({ length: STAPELGRENZE + 10 }, (_, i) => ({
      url: `https://okun-workforce.com/karriere/a/${i}`, art: 'URL_DELETED' as const,
    }))
    const ergebnis = await meldenViele(viele)
    expect(ergebnis.gemeldet).toBe(STAPELGRENZE)
    expect(ergebnis.uebersprungen).toBe(10)
  })
})
