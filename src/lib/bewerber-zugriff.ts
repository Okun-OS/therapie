import { allowedLocationScope } from './scope'
import type { SessionPayload } from './session'

/**
 * §148 Auf welche Bewerbungen eine Sitzung sehen darf — an einer Stelle.
 *
 * Es gilt dieselbe Regel wie bei allem anderen (§81): Die Unternehmensebene
 * sieht alles ihres Betriebs, die Standortleitung ihren Standort. Dazu kommt
 * der Fall, den es nur hier gibt — die Bewerbung ohne Standort. Das ist die
 * Initiativbewerbung und die unternehmensweite Ausschreibung; beide gehen
 * jeden im Haus etwas an, der einstellt.
 *
 * Diese Funktion steht getrennt von den Schnittstellen, weil sie in mehreren
 * gebraucht wird. Eine Zugriffsregel, die zweimal dasteht, ist eine Regel, die
 * beim nächsten Umbau nur an einer Stelle geändert wird.
 */
export async function bewerbungsFilter(
  session: SessionPayload, customerId: string,
): Promise<Record<string, unknown>> {
  const scope = await allowedLocationScope(session)
  if (scope.kind === 'all') return { customerId }
  return {
    customerId,
    OR: [{ locationId: { in: scope.ids } }, { locationId: null }],
  }
}
