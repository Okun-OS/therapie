import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { locationFilter } from '@/lib/scope'
import { einrichtungNachholen } from '@/lib/paket-einrichtung'
import type { SessionPayload } from '@/lib/session'

/**
 * §202 Was vor jedem Planungslauf gilt — an EINER Stelle.
 *
 * Es gibt zwei Wege, einen Lauf zu starten: `/api/planning/runs` und
 * `/api/ai/solve-schedule`. Die Prüfungen standen nur im ersten. Der
 * Dienstplan-Knopf nimmt aber den zweiten — dort fehlten sowohl die
 * Standortgrenze (§112: eine fremde Leitung konnte rechnen lassen) als auch
 * die Sperre bis zur Freischaltung (§127). Die Sperre griff im Alltag also
 * nicht; nachgewiesen war sie nur am Weg, den niemand benutzt.
 *
 * Gibt `null` zurück, wenn geplant werden darf, sonst die Antwort.
 */
export async function pruefePlanungsstart(session: SessionPayload, locationId: string): Promise<NextResponse | null> {
  // §112 Nur am eigenen Standort.
  const erlaubt = await locationFilter(session, locationId)
  if (erlaubt instanceof NextResponse) return erlaubt

  // §127 Die Dienstplanung wird je Kunde von Hand gebaut. Bis das Regelpaket
  // steht, bleibt sie gesperrt — ein Kunde, der ungebaute Dienstplanung
  // ausprobiert, bekommt einen schlechten Plan und ein falsches Bild vom
  // Produkt. Genau das ist im August passiert.
  const standort = await prisma.location.findUnique({
    where: { id: locationId },
    select: { name: true, dienstplanungFrei: true, dienstplanungHinweis: true, rulePackId: true },
  })
  if (!standort) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  if (!standort.dienstplanungFrei && session.role !== 'okun') {
    return NextResponse.json({
      error: standort.dienstplanungHinweis
        || `Die Dienstplanung für „${standort.name}" ist noch nicht freigeschaltet. `
          + 'Sie wird von OKUN für Ihren Betrieb eingerichtet — melden Sie sich bei uns, '
          + 'sobald Sie loslegen möchten.',
      gesperrt: true,
    }, { status: 423 })
  }

  // §202 Die Dienstzeiten kommen mit dem Regelpaket. Fehlen sie, werden sie
  // jetzt aus dem Paket angelegt; erst wenn es keine mitbringt, wird gesperrt.
  // Der Kunde legt sie nicht selbst an — die Einrichtung dafür gibt es nicht mehr.
  const dienste = await einrichtungNachholen(locationId)
  if (dienste === 0) {
    return NextResponse.json({
      error: standort.rulePackId
        ? 'Für diesen Standort gibt es noch keine Dienstzeiten, und sein Regelpaket bringt '
          + 'keine mit. OKUN ergänzt sie im Paket — bitte bei OKUN melden.'
        : 'Für diesen Standort ist die Dienstplanung noch nicht eingerichtet. '
          + 'Das übernimmt OKUN — bitte bei OKUN melden.',
      code: 'NO_SHIFTS',
    }, { status: 422 })
  }
  return null
}
