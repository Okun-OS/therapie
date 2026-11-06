import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { anbieter } from '@/lib/dsgvo-verzeichnis'

export const dynamic = 'force-dynamic'

/**
 * §177 Das Kontaktformular der Website.
 *
 * DIE EINZIGE ROUTE OHNE ANMELDUNG, DIE ETWAS SCHREIBT
 * Deshalb sind hier drei Dinge anders als überall sonst:
 *
 *   1. ERST ABLEGEN, DANN VERSCHICKEN. Eine E-Mail kann im Spam landen oder
 *      beim Versand scheitern. Eine Anfrage, die niemand beantwortet, weil
 *      sie nie ankam, ist ein verlorener Kunde, von dem man nicht einmal
 *      weiß. Scheitert der Versand, steht sie trotzdem in der Tabelle, und
 *      `zugestellt` ist falsch.
 *
 *   2. EINE BREMSE. Ohne sie trägt der erste Werbebot hundert Zeilen ein.
 *      Drei Anfragen je Stunde und IP-Adresse reichen für jeden echten
 *      Interessenten und für keinen Bot.
 *
 *   3. EIN KÖDERFELD. Ein Eingabefeld, das für Menschen unsichtbar ist und
 *      das Bots trotzdem ausfüllen. Ist es gefüllt, antwortet die Route
 *      freundlich und tut nichts. Das ist wirksamer als ein Bilderrätsel und
 *      belästigt niemanden, der wirklich schreiben will.
 */

const GRENZE_PRO_STUNDE = 3

/** Was jemand mindestens schreiben muss, damit man antworten kann. */
const MAIL_FORM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  // §177 Das Köderfeld. Wer es ausfüllt, ist kein Mensch — bekommt aber
  // dieselbe freundliche Antwort, damit ein Bot nicht lernt, woran es lag.
  if (typeof body.webseite === 'string' && body.webseite.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const text = (wert: unknown, max: number) =>
    typeof wert === 'string' ? wert.trim().slice(0, max) : ''

  const name = text(body.name, 120)
  const email = text(body.email, 160)
  const einrichtung = text(body.einrichtung, 160)
  const telefon = text(body.telefon, 60)
  const nachricht = text(body.nachricht, 4000)

  if (!name) {
    return NextResponse.json({ error: 'Bitte einen Namen angeben.' }, { status: 400 })
  }
  if (!MAIL_FORM.test(email)) {
    return NextResponse.json(
      { error: 'Bitte eine E-Mail-Adresse angeben, unter der wir antworten können.' },
      { status: 400 })
  }
  if (nachricht.length < 10) {
    return NextResponse.json(
      { error: 'Bitte schreiben Sie ein paar Sätze — dann können wir etwas damit anfangen.' },
      { status: 400 })
  }

  // §177 Die Bremse. `x-forwarded-for` ist fälschbar, aber hier reicht es:
  // Es geht nicht um Sicherheit, sondern darum, dass ein Formular nicht
  // versehentlich zum Briefkasten für Werbung wird.
  const herkunft = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  if (herkunft) {
    const seit = new Date(Date.now() - 60 * 60 * 1000)
    const zuletzt = await prisma.kontaktanfrage.count({
      where: { createdAt: { gte: seit }, fehler: herkunft },
    })
    if (zuletzt >= GRENZE_PRO_STUNDE) {
      return NextResponse.json({
        error: 'Es sind gerade mehrere Anfragen von hier eingegangen. '
          + 'Bitte in einer Stunde noch einmal versuchen — oder direkt eine '
          + 'E-Mail schreiben.',
      }, { status: 429 })
    }
  }

  // Zuerst ablegen. Was hier steht, geht nicht mehr verloren.
  const anfrage = await prisma.kontaktanfrage.create({
    data: {
      name, email,
      einrichtung: einrichtung || null,
      telefon: telefon || null,
      nachricht,
      // Die Herkunft dient nur der Bremse und wird beim Versand überschrieben.
      fehler: herkunft || null,
    },
  })

  const ziel = anbieter().kontakt
  if (!ziel) {
    await prisma.kontaktanfrage.update({
      where: { id: anfrage.id },
      data: { fehler: 'Keine Empfängeradresse hinterlegt (OKUN_KONTAKT)' },
    })
    // Für den Absender ist das kein Fehler: Seine Anfrage ist angekommen.
    // Dass sie niemand abholt, ist unser Problem und steht in der Tabelle.
    return NextResponse.json({ ok: true })
  }

  const inhalt = [
    `Von: ${name} <${email}>`,
    einrichtung ? `Einrichtung: ${einrichtung}` : null,
    telefon ? `Telefon: ${telefon}` : null,
    '',
    nachricht,
  ].filter(z => z !== null).join('\n')

  try {
    await sendEmail(ziel, `Anfrage von ${name}`, inhalt)
    await prisma.kontaktanfrage.update({
      where: { id: anfrage.id },
      data: { zugestellt: true, fehler: null },
    })
  } catch (fehler) {
    await prisma.kontaktanfrage.update({
      where: { id: anfrage.id },
      data: {
        zugestellt: false,
        fehler: fehler instanceof Error ? fehler.message.slice(0, 500) : 'Versand fehlgeschlagen',
      },
    })
    // Auch hier: Für den Absender ist alles in Ordnung. Die Anfrage liegt
    // vor; dass die Benachrichtigung klemmt, muss OKUN merken, nicht er.
  }

  return NextResponse.json({ ok: true })
}
