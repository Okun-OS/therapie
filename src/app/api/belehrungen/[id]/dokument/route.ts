import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { dateiInhalt } from '@/lib/file-storage'

export const dynamic = 'force-dynamic'

/**
 * §150 Das Dokument einer Belehrung — und der Vermerk, dass es geöffnet wurde.
 *
 * WARUM DER VERMERK HIER ENTSTEHT UND NICHT IM BROWSER
 * Weil ein Browser alles behaupten kann. Der einzige Zeitpunkt, den ein Server
 * wirklich kennt, ist der, zu dem er die Datei ausgeliefert hat. Genau der
 * steht im Beleg — nicht eine Meldung der Oberfläche, sie sei angezeigt
 * worden.
 *
 * WAS DAS EHRLICHERWEISE BELEGT
 * Dass das Dokument abgerufen wurde. Ob jemand es gelesen hat, weiß niemand —
 * auf Papier genauso wenig. Zusammen mit dem Zeitpunkt der Bestätigung ergibt
 * sich aber ein Bild: Liegt zwischen Öffnen und Klick keine Sekunde, sieht man
 * das im Beleg, und der Betrieb kann nachfassen.
 *
 * WER HERANKOMMT
 * Wer die Runde bekommen hat, und der Betrieb. Sonst niemand — auch nicht über
 * /api/files, denn die Datei gehört keiner Person und keinem Standort und
 * fällt dort in die Ablehnung.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const b = await prisma.belehrung.findFirst({
    where: { id: params.id, customerId },
    select: { id: true, dateiId: true, status: true },
  })
  if (!b?.dateiId) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  if (session.role === 'employee') {
    if (b.status === 'entwurf') {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    const beleg = await prisma.belehrungBestaetigung.findFirst({
      where: { belehrungId: params.id, employeeId: session.employeeId ?? '' },
      select: { id: true, angesehenAm: true },
    })
    if (!beleg) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    // Nur das ERSTE Öffnen wird festgehalten. Wer das Dokument im November
    // noch einmal nachschlägt, soll damit nicht seinen eigenen Beleg vom
    // April überschreiben.
    if (!beleg.angesehenAm) {
      await prisma.belehrungBestaetigung.update({
        where: { id: beleg.id }, data: { angesehenAm: new Date() },
      }).catch(() => undefined)
    }
  }

  const inhalt = await dateiInhalt(b.dateiId)
  if (!inhalt) return NextResponse.json({ error: 'Inhalt nicht verfügbar' }, { status: 404 })

  const anzeigbar = inhalt.mimeType === 'application/pdf'
    || inhalt.mimeType.startsWith('image/')
  return new NextResponse(new Uint8Array(inhalt.inhalt), {
    headers: {
      'Content-Type': inhalt.mimeType,
      'Content-Length': String(inhalt.inhalt.length),
      'Content-Disposition':
        `${anzeigbar ? 'inline' : 'attachment'}; filename="${inhalt.dateiname}"`,
      // Nicht zwischenspeichern: Sonst holt das zweite Öffnen die Datei aus
      // dem Browser und der Server erführe nie davon.
      'Cache-Control': 'private, no-store',
    },
  })
}
