import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import {
  verzeichnisFuerKunden, verzeichnisAlsAuftragsverarbeiter, anbieter,
} from '@/lib/dsgvo-verzeichnis'
import { MASSNAHMEN, RUBRIKEN, STAND_TEXT, zusammenfassung } from '@/lib/dsgvo-tom'
import {
  PRUEFUNGEN, SICHERHEIT_TEXT, offeneFragen, befunde,
} from '@/lib/dsgvo-fristenpruefung'

export const dynamic = 'force-dynamic'

/**
 * §152 Das Verarbeitungsverzeichnis (Art. 30 DSGVO) und die Maßnahmen
 * (Art. 32 DSGVO).
 *
 * ZWEI SICHTEN, WEIL ES ZWEI VERZEICHNISSE GIBT
 *   Unternehmensebene → das eigene Verzeichnis nach Abs. 1. Der Kunde ist
 *   Verantwortlicher und muss es führen; wir erzeugen es ihm aus dem, was
 *   ohnehin im Datenkatalog steht.
 *
 *   Plattform (OKUN) → das Verzeichnis nach Abs. 2. Wir sind
 *   Auftragsverarbeiter, und dort stehen andere Dinge: für wen, welche
 *   Verarbeitungen, welche Unterauftragnehmer, welche Drittländer.
 *
 * WARUM DIE STANDORTLEITUNG HIER NICHT HINEINKOMMT
 * Das Verzeichnis ist ein Dokument des Verantwortlichen gegenüber der
 * Aufsichtsbehörde. Es enthält keine Personendaten, aber es gehört auf die
 * Ebene, die dafür geradesteht — und das ist die Geschäftsführung, nicht eine
 * einzelne Einrichtung.
 *
 * WARUM DER ABRUF PROTOKOLLIERT WIRD
 * Weil das Verzeichnis samt Maßnahmenliste die vollständige Landkarte dieses
 * Systems ist. Wer sie abruft, gehört vermerkt — nicht weil der Abruf
 * verdächtig wäre, sondern weil er ein Vorgang ist.
 */

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const massnahmen = {
    rubriken: RUBRIKEN,
    standText: STAND_TEXT,
    eintraege: MASSNAHMEN,
    zusammenfassung: zusammenfassung(),
  }

  // §154 Die Prüfung der Löschfristen liegt bei — sie ist der Teil, den man
  // dem Steuerberater und dem Datenschutzbeauftragten vorlegt.
  const fristen = {
    sicherheitText: SICHERHEIT_TEXT,
    pruefungen: PRUEFUNGEN,
    offeneFragen: offeneFragen(),
    befunde: befunde(),
  }

  if (session.role === 'okun') {
    const v = verzeichnisAlsAuftragsverarbeiter()
    await logAudit({
      userId: session.userId, userEmail: session.email, userRole: session.role,
      action: 'export', entityType: 'Verarbeitungsverzeichnis',
      details: { art: 'auftragsverarbeiter' },
    }).catch(() => undefined)
    return NextResponse.json({
      art: 'auftragsverarbeiter', verzeichnis: v, massnahmen, fristen,
    })
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 403 })
  }

  // Die Angaben des Betriebs stehen in seinen Einstellungen — Anschrift für
  // die Entgeltabrechnung (§108 GewO) ist dieselbe wie die des
  // Verantwortlichen.
  const e = await prisma.orgSettings.findUnique({
    where: { customerId },
    select: {
      organizationName: true, strasse: true, plz: true, ort: true,
      notificationEmail: true,
    },
  })

  const anschrift = [e?.strasse, [e?.plz, e?.ort].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ') || null

  const v = verzeichnisFuerKunden({
    name: e?.organizationName ?? 'Unbenannter Betrieb',
    anschrift,
    kontakt: e?.notificationEmail || null,
  })

  await logAudit({
    userId: session.userId, userEmail: session.email, userRole: session.role,
    action: 'export', entityType: 'Verarbeitungsverzeichnis',
    customerId, details: { art: 'verantwortlicher' },
  }).catch(() => undefined)

  return NextResponse.json({
    art: 'verantwortlicher',
    verzeichnis: v,
    massnahmen,
    fristen,
    // Damit im Dokument steht, wer der Auftragsverarbeiter ist — ohne dass
    // die Oberfläche das wissen muss.
    auftragsverarbeiter: anbieter(),
  })
}
