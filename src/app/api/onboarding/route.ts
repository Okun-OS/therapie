import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [organization, locations] = await Promise.all([
    prisma.organizationOnboarding.findUnique({ where: { id: 'singleton' } }),
    prisma.locationOnboarding.findMany(),
  ])
  return NextResponse.json({ organization, locations })
}
