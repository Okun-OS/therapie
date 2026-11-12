import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/session'
import { uploadAdresse, downloadAdresse, loeschAdresse, r2Eingerichtet } from '@/lib/r2'

export const dynamic = 'force-dynamic'

/**
 * §258 Nimmt Cloudflare unsere Unterschrift an?
 *
 * WARUM ES DIESEN WEG GIBT
 * Die Signatur nach AWS' Verfahren Version 4 lässt sich örtlich nicht prüfen.
 * Jeder Fehler darin — ein nicht kodiertes Zeichen, eine falsche Reihenfolge
 * der Köpfe, ein durchgerutschter Zeitstempel, die falsche Adresse für einen
 * EU-Eimer — meldet sich bei Cloudflare mit DERSELBEN Auskunft:
 * „SignatureDoesNotMatch", ohne Hinweis worauf.
 *
 * `r2.test.ts` fängt davon, was sich rechnerisch fangen lässt. Ob der Speicher
 * die Unterschrift wirklich annimmt, sagt nur der Speicher.
 *
 * WARUM ES EIN KNOPF IST UND KEIN TEST IM BAU
 * Weil die Zugangsdaten nur im Betrieb liegen und dort auch bleiben sollen.
 * Wer sie einrichtet, drückt einmal hier und weiß Bescheid — statt eine Datei
 * im Chat hochzuladen und aus einer 500 zu raten.
 *
 * WAS GEPRÜFT WIRD
 * Der vollständige Weg, den später jedes Foto nimmt: ablegen, zurückholen,
 * Inhalt vergleichen, aufräumen. Nur abzulegen würde nichts beweisen — eine
 * Datei, die danach niemand lesen kann, ist keine abgelegte Datei.
 *
 * WAS DABEI NICHT ANGEFASST WIRD
 * Ein eigener Pfad `selbsttest/` und eine Datei mit Zeitstempel im Namen. Es
 * wird nichts überschrieben, nichts gelesen, was anderen gehört, und am Ende
 * bleibt nichts liegen.
 */

interface Schritt {
  name: string
  ok: boolean
  dauerMs: number
  hinweis?: string
}

/** Cloudflares Fehlertext ist XML. Daraus den Code herausziehen. */
function fehlercode(text: string): string {
  const m = text.match(/<Code>([^<]+)<\/Code>/)
  return m ? m[1] : text.slice(0, 120).replace(/\s+/g, ' ')
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['okun'])
  if (session instanceof NextResponse) return session

  // §259 Geprüft wird der DATEI-Speicher, nicht der für die Programmdateien.
  if (!r2Eingerichtet('dateien')) {
    return NextResponse.json({
      ok: false,
      schritte: [],
      zusammenfassung: 'Der Objektspeicher ist nicht eingerichtet — es fehlen '
        + 'eine oder mehrere der Angaben: R2_DATEIEN_BUCKET, '
        + 'R2_DATEIEN_SCHLUESSEL, R2_DATEIEN_GEHEIMNIS, R2_DATEIEN_BEREICH '
        + '(und R2_KONTO_ID, die mit dem Programmspeicher geteilt wird).',
    })
  }

  const pfad = `selbsttest/${Date.now()}.txt`
  const inhalt = `OKUN Selbsttest ${new Date().toISOString()}`
  const schritte: Schritt[] = []

  async function messen(name: string, tun: () => Promise<string | null>) {
    const start = Date.now()
    try {
      const hinweis = await tun()
      schritte.push({ name, ok: hinweis === null, dauerMs: Date.now() - start, ...(hinweis ? { hinweis } : {}) })
      return hinweis === null
    } catch (fehler) {
      schritte.push({
        name, ok: false, dauerMs: Date.now() - start,
        hinweis: fehler instanceof Error ? fehler.message.slice(0, 160) : 'unbekannt',
      })
      return false
    }
  }

  // ── 1. Ablegen ───────────────────────────────────────────────────────────
  const konnteAblegen = await messen('Ablegen', async () => {
    const adresse = uploadAdresse(pfad, 'text/plain')
    if (!adresse) return 'Keine Adresse — der Speicher ist nicht eingerichtet.'
    const r = await fetch(adresse, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: inhalt,
    })
    if (!r.ok) return `HTTP ${r.status}: ${fehlercode(await r.text())}`
    return null
  })

  // ── 2. Zurückholen und vergleichen ──────────────────────────────────────
  if (konnteAblegen) {
    await messen('Zurückholen', async () => {
      const adresse = downloadAdresse(pfad, 120, new Date(), 'dateien')
      if (!adresse) return 'Keine Adresse.'
      const r = await fetch(adresse)
      if (!r.ok) return `HTTP ${r.status}: ${fehlercode(await r.text())}`
      const zurueck = await r.text()
      /*
       * Der Vergleich ist der Kern. Ein `PUT`, das mit 200 antwortet, und ein
       * `GET`, das irgendetwas zurückgibt, beweisen zusammen noch nichts —
       * erst dass es DASSELBE ist.
       */
      if (zurueck !== inhalt) {
        return `Der Inhalt kam verändert zurück (${zurueck.length} statt ${inhalt.length} Zeichen).`
      }
      return null
    })
  }

  /*
   * ── 3. Mit Anzeigenamen zurückholen ──────────────────────────────────────
   *
   * §260 Ein eigener Schritt, weil es eine eigene Signatur ist.
   *
   * Im Speicher heißt eine Datei `chat/<raum>/2026-10-29/9f3c…b1.jpg`. Damit
   * sie beim Herunterladen trotzdem „Foto.jpg" heißt, wird
   * `response-content-disposition` in die Adresse geschrieben — und damit
   * mitsigniert. Das ist der einzige Parameter im ganzen Verfahren, der
   * kleingeschrieben ist; die Sortierung geschieht nach Bytefolge, und wenn
   * die durcheinandergeht, lautet die Antwort „SignatureDoesNotMatch".
   *
   * Örtlich prüfbar ist davon nur, dass wir richtig sortieren. Ob Cloudflare
   * die Unterschrift annimmt, sagt allein Cloudflare — deshalb steht es hier
   * und nicht in `r2.test.ts`.
   */
  if (konnteAblegen) {
    await messen('Name beim Herunterladen', async () => {
      const adresse = downloadAdresse(pfad, 120, new Date(), 'dateien', 'Selbsttest Ö.txt')
      if (!adresse) return 'Keine Adresse.'
      const r = await fetch(adresse)
      if (!r.ok) return `HTTP ${r.status}: ${fehlercode(await r.text())}`
      const kopf = r.headers.get('content-disposition') ?? ''
      /*
       * Der Vergleich ist auch hier der Kern: Eine Antwort mit 200 beweist
       * nur, dass die Signatur gepasst hat. Ob der Speicher den Namen
       * tatsächlich setzt, steht im Kopf.
       */
      if (!kopf.includes('Selbsttest')) {
        return `Der Speicher hat den Namen nicht gesetzt (content-disposition: ${kopf || 'fehlt'}).`
      }
      return null
    })
  }

  // ── 4. Aufräumen ────────────────────────────────────────────────────────
  if (konnteAblegen) {
    await messen('Aufräumen', async () => {
      const adresse = loeschAdresse(pfad, 120)
      if (!adresse) return 'Keine Adresse.'
      const r = await fetch(adresse, { method: 'DELETE' })
      // S3 antwortet beim Löschen mit 204 — und auch dann mit Erfolg, wenn es
      // nichts zu löschen gab.
      if (!r.ok && r.status !== 204) return `HTTP ${r.status}: ${fehlercode(await r.text())}`
      return null
    })
  }

  const ok = schritte.length > 0 && schritte.every(s => s.ok)
  return NextResponse.json({
    ok,
    schritte,
    zusammenfassung: ok
      ? 'Der Objektspeicher nimmt unsere Unterschrift an. Ablegen, Zurückholen '
        + 'und Aufräumen haben funktioniert, und der Inhalt kam unverändert zurück.'
      : 'Mindestens ein Schritt ist gescheitert — die Einzelheiten stehen oben. '
        + '„SignatureDoesNotMatch" deutet meist auf eine falsche Angabe bei '
        + 'Schlüssel, Geheimnis oder Rechtsraum; „NoSuchBucket" auf einen '
        + 'falschen Eimernamen oder einen fehlenden Rechtsraum.',
  })
}
