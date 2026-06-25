import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const contexts = await prisma.employeeHumanContext.findMany({
    where: employeeId ? { employeeId } : undefined,
  })
  return NextResponse.json({ contexts })
}

export async function PATCH(req: NextRequest) {
  const { employeeId, strengths, lifeCircumstances, preferredGroups, agreements } = await req.json()
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId ist erforderlich' }, { status: 400 })
  }

  const context = await prisma.employeeHumanContext.upsert({
    where: { employeeId },
    update: {
      ...(strengths !== undefined && { strengths }),
      ...(lifeCircumstances !== undefined && { lifeCircumstances }),
      ...(preferredGroups !== undefined && { preferredGroups }),
      ...(agreements !== undefined && { agreements }),
    },
    create: {
      employeeId,
      strengths: strengths ?? [],
      lifeCircumstances: lifeCircumstances ?? [],
      preferredGroups: preferredGroups ?? [],
      agreements: agreements ?? null,
    },
  })
  return NextResponse.json({ context })
}
