import { NextRequest, NextResponse } from 'next/server'
import { listCompanyUsers, setUserBereichIds } from '@/lib/entities'
import { requireRole, resolveCustomerId } from '@/lib/session'

export const dynamic = 'force-dynamic'

/** Returns all company users for this customer, with access flag for this bereich. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ users: [] })

  const users = await listCompanyUsers(customerId)
  return NextResponse.json({
    users: users.map(u => ({ ...u, hasAccess: u.bereichIds.includes(params.id) })),
  })
}

/** Accepts { userIds: string[] } — grants access to exactly these users, revokes from others. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireRole(req, ['company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = await resolveCustomerId(session)
  if (!customerId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })

  const { userIds } = await req.json()
  if (!Array.isArray(userIds)) return NextResponse.json({ error: 'userIds muss ein Array sein' }, { status: 400 })

  const allUsers = await listCompanyUsers(customerId)
  await Promise.all(
    allUsers.map(u => {
      const shouldHave = userIds.includes(u.id)
      const hasNow = u.bereichIds.includes(params.id)
      if (shouldHave === hasNow) return Promise.resolve()
      const newIds = shouldHave
        ? [...u.bereichIds, params.id]
        : u.bereichIds.filter(bid => bid !== params.id)
      return setUserBereichIds(u.id, newIds)
    })
  )

  return NextResponse.json({ ok: true })
}
