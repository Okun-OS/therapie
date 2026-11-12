import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { resolveCustomerId, type SessionPayload } from './session'
import { assertEmployeeAccess, allowedLocationScope } from './scope'
import { KATEGORIEN, MITARBEITER_DARF_HOCHLADEN, type Kategorie } from './file-storage'

/**
 * §261 Wer darf was in welche Akte legen — einmal aufgeschrieben.
 *
 * WARUM DAS AUS DER ROUTE HERAUSGEZOGEN WURDE
 * Mit dem direkten Weg in den Objektspeicher (§260) gibt es für ein Hochladen
 * jetzt ZWEI Eingänge: einen, der den Platz ausgibt, und einen, der hinterher
 * vermerkt, dass die Datei dort liegt. Beide müssen dieselbe Frage
 * beantworten, und beide müssen sie GLEICH beantworten.
 *
 * Diese Prüfung ein zweites Mal hinzuschreiben wäre die Art Dublette, die in
 * §229, §232 und §235 dreimal als Fehler aufgefallen ist — nur mit
 * schlimmeren Folgen: Liefen die beiden Abschriften auseinander, entstünde ein
 * Eingang, der etwas durchlässt, was der andere abweist. Bei Krankenscheinen
 * ist das kein Schönheitsfehler, sondern ein Datenschutzvorfall.
 *
 * WAS HIER GEPRÜFT WIRD
 *   — ist die Kategorie überhaupt eine,
 *   — gehört die Akte in den Bereich, den diese Person sehen darf,
 *   — und darf sie in DIESE Kategorie selbst etwas legen.
 *
 * Was hier NICHT geprüft wird: alles an der Datei selbst — Größe, Art,
 * Inhalt. Das steht in `pruefeDatei` und gilt für jeden Weg gleich.
 */

export interface AkteAuftrag {
  ownerType: 'employee' | 'location'
  ownerId: string
  kategorie: Kategorie
  locationId: string | null
  customerId: string
}

export async function akteAuftrag(
  session: SessionPayload,
  felder: {
    ownerType?: string | null
    ownerId?: string | null
    kategorie?: string | null
  },
): Promise<AkteAuftrag | NextResponse> {
  const ownerType = String(felder.ownerType ?? 'employee')
  const ownerId = String(felder.ownerId ?? '')
  const kategorie = String(felder.kategorie ?? 'sonstiges') as Kategorie

  if (!ownerId) return NextResponse.json({ error: 'ownerId fehlt' }, { status: 400 })
  if (!(kategorie in KATEGORIEN)) {
    return NextResponse.json({ error: `Unbekannte Kategorie „${kategorie}“` }, { status: 400 })
  }

  let locationId: string | null = null
  if (ownerType === 'employee') {
    const verweigert = await assertEmployeeAccess(session, ownerId)
    if (verweigert) return verweigert
    const emp = await prisma.employee.findUnique({
      where: { id: ownerId }, select: { locationId: true },
    })
    locationId = emp?.locationId ?? null
  } else if (ownerType === 'location') {
    const scope = await allowedLocationScope(session)
    if (scope.kind !== 'all' && !scope.ids.includes(ownerId)) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Standort' }, { status: 403 })
    }
    locationId = ownerId
  } else {
    return NextResponse.json({ error: 'Unbekannter ownerType' }, { status: 400 })
  }

  // Der Mitarbeiter reicht seine Krankmeldung ein — er legt sich aber keinen
  // Arbeitsvertrag oder eine Lohnabrechnung selbst in die Akte.
  if (session.role === 'employee' && !MITARBEITER_DARF_HOCHLADEN.includes(kategorie)) {
    return NextResponse.json({
      error: `Als Mitarbeiter kannst du nur ${MITARBEITER_DARF_HOCHLADEN.map(k => KATEGORIEN[k]).join(' und ')} einreichen.`,
    }, { status: 403 })
  }

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 })

  return {
    ownerType: ownerType as 'employee' | 'location',
    ownerId, kategorie, locationId, customerId,
  }
}

/**
 * §261 Die Verwendung, über die der Nachweis unterschrieben wird.
 *
 * Sie bindet den ausgegebenen Platz an GENAU diese Akte und diese Kategorie.
 * Ohne sie ließe sich ein redlich erworbener Platz für eine Bescheinigung
 * benutzen, um eine Datei als Lohnabrechnung in eine andere Akte zu legen.
 */
export function akteZweck(auftrag: AkteAuftrag): string {
  return `akte:${auftrag.ownerType}:${auftrag.ownerId}:${auftrag.kategorie}`
}

/** Der Ordner im Speicher. Trennt die Akten und macht Löschfristen möglich. */
export function akteBereich(auftrag: AkteAuftrag): string {
  return `akte/${auftrag.ownerType}/${auftrag.ownerId}`
}
