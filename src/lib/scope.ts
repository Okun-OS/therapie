import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { resolveCustomerId, resolveLocationId } from './session'
import type { SessionPayload } from './session'

// §81: single source of truth for "which locations may this session see?".
// okun → whole platform; company → all locations of their customer;
// admin/employee → exactly their own location. Every list endpoint must
// constrain by this — an unscoped "list all" fallback is a data leak that
// also made foreign shifts show up at freshly created locations.
export type LocationScope =
  | { kind: 'all' }
  | { kind: 'locations'; ids: string[] }

export async function allowedLocationScope(session: SessionPayload): Promise<LocationScope> {
  if (session.role === 'okun') return { kind: 'all' }
  if (session.role === 'company') {
    const customerId = await resolveCustomerId(session)
    if (!customerId) return { kind: 'locations', ids: [] }
    const locs = await prisma.location.findMany({ where: { customerId }, select: { id: true } })
    return { kind: 'locations', ids: locs.map(l => l.id) }
  }
  const own = await resolveLocationId(session)
  return { kind: 'locations', ids: own ? [own] : [] }
}

/**
 * Resolve the location filter for a list query.
 * Returns either a Prisma-ready filter, or a NextResponse (403) to return.
 *  - undefined  → no filter (okun without explicit locationId)
 *  - string[]   → restrict to these ids
 */
export async function locationFilter(
  session: SessionPayload,
  requested?: string | null,
): Promise<string[] | undefined | NextResponse> {
  const scope = await allowedLocationScope(session)
  if (scope.kind === 'all') return requested ? [requested] : undefined
  if (requested) {
    if (!scope.ids.includes(requested)) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Standort' }, { status: 403 })
    }
    return [requested]
  }
  return scope.ids
}

/** Verify the session may access data of a specific employee. */
export async function assertEmployeeAccess(
  session: SessionPayload,
  employeeId: string,
): Promise<NextResponse | null> {
  if (session.role === 'okun') return null
  if (session.employeeId === employeeId) return null
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { locationId: true },
  })
  if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  const scope = await allowedLocationScope(session)
  if (scope.kind === 'all') return null
  if (!employee.locationId || !scope.ids.includes(employee.locationId)) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }
  return null
}
