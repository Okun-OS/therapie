import { describe, it, expect } from 'vitest'
import { direktHochladen } from '../datei-direkt'

/**
 * §260 Der direkte Weg in den Objektspeicher.
 *
 * Geprüft wird vor allem die Stelle, an der dieser Weg ABBRICHT. Dass ein
 * Erfolgsfall gelingt, sagt wenig: Die Fälle, die in §252/§255 Runden gekostet
 * haben, sind die, in denen etwas schiefgeht — und dann muss entweder der alte
 * Weg übernehmen oder eine Meldung stehen, mit der ein Mensch etwas anfangen
 * kann. Was nicht passieren darf: dass eine Datei zweimal hochgeht, oder dass
 * eine Abweisung als „Speicher aus" durchgeht und der alte Weg sie ein zweites
 * Mal durch die mobile Verbindung schiebt.
 */

interface Ruf { url: string; methode: string; koepfe: Record<string, string>; rumpf: unknown }

/** Ein Ersatz für `fetch`, der die Aufrufe mitschreibt. */
function stubFetch(antworten: Array<{ status: number; koerper?: unknown } | 'wirft'>) {
  const rufe: Ruf[] = []
  let i = 0
  const holen = (async (url: string | URL, init?: RequestInit) => {
    const a = antworten[i++]
    rufe.push({
      url: String(url),
      methode: init?.method ?? 'GET',
      koepfe: (init?.headers ?? {}) as Record<string, string>,
      rumpf: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    })
    if (a === undefined) throw new Error(`unerwarteter Aufruf ${i}: ${url}`)
    if (a === 'wirft') throw new Error('Netz weg')
    return {
      ok: a.status >= 200 && a.status < 300,
      status: a.status,
      json: async () => a.koerper ?? {},
    } as Response
  }) as unknown as typeof fetch
  return { holen, rufe }
}

const DATEI = () => new File(['x'.repeat(40)], 'Foto.jpg', { type: 'image/jpeg' })

const PFADE = { adressePfad: '/api/chat/r1/datei/adresse', vermerkPfad: '/api/chat/r1/datei' }

const PLATZ = {
  speicher: 'an',
  adresse: 'https://konto.eu.r2.cloudflarestorage.com/okun-dateien/chat/r1/2026-10-29/ab.jpg?X-Amz-Signature=…',
  schluessel: 'chat/r1/2026-10-29/ab.jpg',
  typ: 'image/jpeg',
  dateiname: 'Foto.jpg',
}

describe('direktHochladen', () => {
  it('erfragt den Platz, legt die Datei ab und meldet sie — in dieser Reihenfolge', async () => {
    const { holen, rufe } = stubFetch([
      { status: 200, koerper: PLATZ },
      { status: 200 },
      { status: 200, koerper: { nachricht: { id: 'n1' } } },
    ])
    const erg = await direktHochladen({
      ...PFADE, datei: DATEI(), zusatz: { text: 'Guck mal' }, holen,
    })

    expect(erg).toEqual({ art: 'ok', antwort: { nachricht: { id: 'n1' } } })
    expect(rufe.map(r => `${r.methode} ${r.url}`)).toEqual([
      'POST /api/chat/r1/datei/adresse',
      `PUT ${PLATZ.adresse}`,
      'POST /api/chat/r1/datei',
    ])
  })

  it('legt die Datei mit GENAU dem Typ ab, der in der Adresse steht', async () => {
    // Der Typ ist mitsigniert. Ein anderer ergibt eine Absage von Cloudflare,
    // die den Grund nicht nennt — und das war der teuerste Fehler in §256–§258.
    const { holen, rufe } = stubFetch([
      { status: 200, koerper: { ...PLATZ, typ: 'image/heic' } },
      { status: 200 },
      { status: 200, koerper: {} },
    ])
    await direktHochladen({ ...PFADE, datei: DATEI(), holen })
    expect(rufe[1].koepfe['content-type']).toBe('image/heic')
    // Und derselbe Typ wird gemeldet — nicht der, den der Browser behauptet.
    expect((rufe[2].rumpf as { mimeType: string }).mimeType).toBe('image/heic')
  })

  it('meldet den Schlüssel und den geprüften Namen, nicht den rohen', async () => {
    const { holen, rufe } = stubFetch([
      { status: 200, koerper: { ...PLATZ, dateiname: 'Foto_1.jpg' } },
      { status: 200 },
      { status: 200, koerper: {} },
    ])
    await direktHochladen({ ...PFADE, datei: DATEI(), zusatz: { text: 'Hallo' }, holen })
    expect(rufe[2].rumpf).toEqual({
      objektSchluessel: 'chat/r1/2026-10-29/ab.jpg',
      dateiname: 'Foto_1.jpg',
      mimeType: 'image/jpeg',
      text: 'Hallo',
    })
  })

  /*
   * Ohne diese Gegenprobe wäre der ganze Rückfall nichts wert: Ist kein
   * Speicher eingerichtet, DARF hier nichts abgelegt werden.
   */
  it('ohne Objektspeicher wird nichts abgelegt — der alte Weg übernimmt', async () => {
    const { holen, rufe } = stubFetch([{ status: 200, koerper: { speicher: 'aus' } }])
    const erg = await direktHochladen({ ...PFADE, datei: DATEI(), holen })
    expect(erg).toEqual({ art: 'kein-speicher' })
    expect(rufe).toHaveLength(1)
  })

  it('und auch dann, wenn die Anfrage nach dem Platz gar nicht durchkommt', async () => {
    const { holen, rufe } = stubFetch(['wirft'])
    expect(await direktHochladen({ ...PFADE, datei: DATEI(), holen }))
      .toEqual({ art: 'kein-speicher' })
    expect(rufe).toHaveLength(1)
  })

  it('scheitert das Ablegen, übernimmt der alte Weg — und es wird nichts vermerkt', async () => {
    const { holen, rufe } = stubFetch([
      { status: 200, koerper: PLATZ },
      { status: 403 },
    ])
    expect(await direktHochladen({ ...PFADE, datei: DATEI(), holen }))
      .toEqual({ art: 'kein-speicher' })
    // Ein Vermerk auf ein Objekt, das nicht liegt, wäre ein Anhang, den
    // niemand öffnen kann.
    expect(rufe).toHaveLength(2)
  })

  /*
   * Die andere Seite derselben Münze: Eine Abweisung DARF NICHT als
   * „kein Speicher" durchgehen. Sonst schiebt der alte Weg dieselbe Datei
   * noch einmal durch die Verbindung, um am Ende dieselbe Meldung zu zeigen.
   */
  it('weist die Anwendung die Datei ab, wird sie nicht abgelegt', async () => {
    const { holen, rufe } = stubFetch([
      { status: 400, koerper: { error: 'Die Datei ist 31.0 MB groß.' } },
    ])
    expect(await direktHochladen({ ...PFADE, datei: DATEI(), holen }))
      .toEqual({ art: 'abgewiesen', fehler: 'Die Datei ist 31.0 MB groß.' })
    expect(rufe).toHaveLength(1)
  })

  it('eine Abweisung beim Vermerken wird weitergegeben, nicht verschluckt', async () => {
    const { holen } = stubFetch([
      { status: 200, koerper: PLATZ },
      { status: 200 },
      { status: 400, koerper: { error: 'Der Inhalt passt nicht zum Namen.' } },
    ])
    expect(await direktHochladen({ ...PFADE, datei: DATEI(), holen }))
      .toEqual({ art: 'abgewiesen', fehler: 'Der Inhalt passt nicht zum Namen.' })
  })

  it('und ohne Begründung steht wenigstens die Nummer in der Meldung', async () => {
    const { holen } = stubFetch([
      { status: 200, koerper: PLATZ },
      { status: 200 },
      { status: 502 },
    ])
    const erg = await direktHochladen({ ...PFADE, datei: DATEI(), holen })
    expect(erg.art).toBe('abgewiesen')
    expect((erg as { fehler: string }).fehler).toContain('502')
  })

  /*
   * Der unangenehmste Fall: Die Datei liegt, die Bestätigung fehlt. Hier den
   * alten Weg zu nehmen hieße, sie ein zweites Mal hochzuladen.
   */
  it('liegt die Datei schon und nur die Bestätigung fehlt, wird NICHT neu hochgeladen', async () => {
    const { holen } = stubFetch([
      { status: 200, koerper: PLATZ },
      { status: 200 },
      'wirft',
    ])
    const erg = await direktHochladen({ ...PFADE, datei: DATEI(), holen })
    expect(erg.art).toBe('abgewiesen')
    expect((erg as { fehler: string }).fehler).toContain('neu laden')
  })

  it('eine unvollständige Antwort auf die Platzanfrage gilt als „kein Speicher"', async () => {
    for (const koerper of [
      { speicher: 'an' },
      { speicher: 'an', adresse: 'https://x' },
      { speicher: 'an', adresse: 'https://x', schluessel: 'k' },
      {},
    ]) {
      const { holen, rufe } = stubFetch([{ status: 200, koerper }])
      expect(await direktHochladen({ ...PFADE, datei: DATEI(), holen }))
        .toEqual({ art: 'kein-speicher' })
      expect(rufe).toHaveLength(1)
    }
  })
})
