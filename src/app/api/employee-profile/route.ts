import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = requireRole(req)
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const profiles = await prisma.employeeProfile.findMany({
    where: employeeId ? { employeeId } : undefined,
  })
  return NextResponse.json({ profiles })
}

export async function PATCH(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const { employeeId, isSpringer, qualifications, groupId } = await req.json()
  if (!employeeId) return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })

  const profile = await prisma.employeeProfile.upsert({
    where: { employeeId },
    update: {
      ...(isSpringer !== undefined && { isSpringer }),
      ...(qualifications !== undefined && { qualifications }),
      ...(groupId !== undefined && { groupId }),
    },
    create: {
      employeeId,
      isSpringer: isSpringer ?? false,
      qualifications: qualifications ?? [],
      groupId: groupId ?? null,
    },
  })

  return NextResponse.json({ profile })
}
