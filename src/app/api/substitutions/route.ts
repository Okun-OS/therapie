import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSubstitutionRequest } from '@/lib/substitution-service'

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId')
  const requests = await prisma.substitutionRequest.findMany({
    where: locationId ? { locationId } : undefined,
    include: { candidates: { orderBy: { matchScore: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { locationId, groupId, date, startTime, endTime, qualification, priority, note, createdBy } = body

  if (!locationId || !date || !startTime || !endTime || !createdBy) {
    return NextResponse.json({ error: 'locationId, date, startTime, endTime und createdBy sind erforderlich' }, { status: 400 })
  }

  const request = await createSubstitutionRequest({
    locationId,
    groupId: groupId || undefined,
    date,
    startTime,
    endTime,
    qualification: qualification || undefined,
    priority: priority ?? 'normal',
    note: note || undefined,
    createdBy,
  })

  return NextResponse.json({ request })
}
