import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { locationFilter } from '@/lib/scope'
import { logAudit } from '@/lib/audit'
import {
  ZAHLLAUF_STAENDE, naechsteStaende, standErlaubt, abrechnungsstandFuer,
} from '@/lib/zahllauf'

export const dynamic = 'force-dynamic'

/**
 * §218 Zahlungsläufe: nachsehen, die Datei noch einmal holen, den Stand pflegen.
 *
 * WARUM DER STAND VON HAND GEPFLEGT WIRD
 * Weil die Anlage keine Bankverbindung hat. Sie erzeugt eine Datei; ob und
 * wann ein Mensch sie eingereicht hat, weiß nur er. Diese Schnittstelle ist
 * die Stelle, an der er es sagt — und damit die Grundlage dafür, dass
 * derselbe Monat nicht ein zweites Mal gezahlt wird.
 *
 * Mit einer EBICS-Anbindung wandert genau dieser Schritt vom Menschen zur
 * Anlage: Dann trägt die Übertragung den Stand ein und die Rückmeldung der
 * Bank den nächsten. Die Zustände bleiben dieselben — deshalb stehen sie
 * schon jetzt vollständig da.
 *
 * WER WAS DARF
 * Lesen darf, wer auch den Export darf, eingeschränkt auf seine Standorte.
 * Den Stand ändern darf nur die Unternehmensebene: „Ich habe das bei der Bank
 * eingereicht" ist eine Aussage über Geld, keine Standortangelegenheit.
 */

const FELDER = {
  id: true, customerId: true, locationId: true, jahr: true, monat: true,
  kennung: true, status: true, statusAm: true, anzahl: true, summe: true,
  ausfuehrung: true, erzeugtVon: true, erzeugtVonName: true, notiz: true,
  createdAt: true, updatedAt: true,
} as const

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ laeufe: [] })

  const p = req.nextUrl.searchParams
  const erlaubt = await locationFilter(session, p.get('locationId'))
  if (erlaubt instanceof NextResponse) return erlaubt

  /*
   * §218 Ein Lauf OHNE Standort ist der Lauf des ganzen Unternehmens.
   *
   * Deshalb lässt sich die Sichtbarkeit hier nicht mit demselben Filter
   * erschlagen wie bei Abrechnungen: `locationId IN (...)` schließt NULL aus
   * und hätte der Unternehmensebene ausgerechnet ihre eigenen Läufe
   * verborgen. Die Regel lautet: Die Unternehmensebene sieht alles ihres
   * Mandanten, eine Standortleitung nur Läufe ihrer Standorte — ein
   * unternehmensweiter gehört ihr nicht.
   */
  const nurEigeneStandorte = session.role === 'admin'

  const id = p.get('id')
  if (id) {
    const lauf = await prisma.zahllauf.findFirst({
      where: { id, customerId },
      select: { ...FELDER, datei: p.get('datei') === '1' },
    })
    if (!lauf) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    // Ein Lauf ohne Standort gilt für alles, worauf der Erzeuger Zugriff
    // hatte — den darf eine Standortleitung nicht herunterladen.
    if (nurEigeneStandorte
        && (!lauf.locationId || !(erlaubt ?? []).includes(lauf.locationId))) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Lauf' }, { status: 403 })
    }

    if (p.get('datei') === '1') {
      const datei = (lauf as { datei?: Buffer | null }).datei
      if (!datei) return NextResponse.json({ error: 'Keine Datei gespeichert' }, { status: 404 })
      await logAudit({
        userId: session.userId, userEmail: session.email, userRole: session.role,
        action: 'export', entityType: 'Zahllauf', entityId: lauf.kennung,
        customerId, details: { art: 'sepa', wiederholung: true, stand: lauf.status },
      })
      return new NextResponse(Buffer.from(datei), {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition':
            `attachment; filename="SEPA-Gehalt-${lauf.jahr}-${String(lauf.monat).padStart(2, '0')}.xml"`,
          'Cache-Control': 'private, no-store',
          'X-Okun-Kennung': lauf.kennung,
          'X-Okun-Wiederholung': '1',
        },
      })
    }
    return NextResponse.json({
      lauf, naechste: naechsteStaende(lauf.status), staende: ZAHLLAUF_STAENDE,
    })
  }

  const jahr = Number(p.get('jahr'))
  const monat = Number(p.get('monat'))
  const laeufe = await prisma.zahllauf.findMany({
    where: {
      customerId,
      ...(jahr ? { jahr } : {}),
      ...(monat ? { monat } : {}),
      ...(nurEigeneStandorte ? { locationId: { in: erlaubt ?? [] } } : {}),
    },
    orderBy: [{ jahr: 'desc' }, { monat: 'desc' }, { createdAt: 'desc' }],
    select: FELDER,
  })
  return NextResponse.json({ laeufe, staende: ZAHLLAUF_STAENDE })
}

/**
 * Den Stand eines Laufs fortschreiben.
 *
 * Die zwei Übergänge, die wirklich etwas bewegen:
 *
 * **eingereicht** setzt die enthaltenen Abrechnungen auf „bezahlt". Ab da
 * geraten sie in keinen zweiten Lauf mehr — das ist der eigentliche Schutz
 * vor der doppelten Gehaltszahlung, und er wirkt in der Anlage, nicht erst
 * bei der Bank.
 *
 * **abgelehnt** nimmt das zurück. Eine abgelehnte Datei ist keine Zahlung,
 * und die Abrechnungen müssen wieder zahlbar werden.
 */
export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  const neu = String(body.status ?? '')
  if (!id || !neu) {
    return NextResponse.json({ error: 'id und status fehlen' }, { status: 400 })
  }

  const lauf = await prisma.zahllauf.findFirst({
    where: { id, customerId }, select: FELDER,
  })
  if (!lauf) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  if (!standErlaubt(lauf.status, neu)) {
    return NextResponse.json(
      {
        error: naechsteStaende(lauf.status).length === 0
          ? `Dieser Lauf ist abgeschlossen (${ZAHLLAUF_STAENDE[lauf.status as keyof typeof ZAHLLAUF_STAENDE] ?? lauf.status}). `
            + 'Was bei der Bank geschehen ist, nimmt die Software nicht zurück.'
          : `Der Wechsel von „${lauf.status}“ nach „${neu}“ ist nicht vorgesehen.`,
        moeglich: naechsteStaende(lauf.status),
      },
      { status: 400 },
    )
  }

  const aktualisiert = await prisma.zahllauf.update({
    where: { id },
    data: {
      status: neu, statusAm: new Date(),
      ...(body.notiz !== undefined
        ? { notiz: String(body.notiz ?? '').slice(0, 1000).trim() || null }
        : {}),
    },
    select: FELDER,
  })

  // Was der neue Stand für die enthaltenen Abrechnungen bedeutet.
  const abrechnungsstand = abrechnungsstandFuer(neu)
  let bewegt = 0
  if (abrechnungsstand) {
    bewegt = (await prisma.payrollEntry.updateMany({
      where: { zahllaufId: id, customerId },
      data: { status: abrechnungsstand },
    })).count
  }
  // Ein verworfener Lauf gibt die Abrechnungen ganz frei.
  if (neu === 'verworfen') {
    await prisma.payrollEntry.updateMany({
      where: { zahllaufId: id }, data: { zahllaufId: null },
    })
  }

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'update', entityType: 'Zahllauf', entityId: lauf.kennung,
    customerId,
    details: {
      von: lauf.status, nach: neu, summe: lauf.summe, anzahl: lauf.anzahl,
      abrechnungen: bewegt,
    },
  })

  return NextResponse.json({
    lauf: aktualisiert, naechste: naechsteStaende(neu), abrechnungen: bewegt,
  })
}
