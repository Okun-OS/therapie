import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.notification.update({ where: { id: params.id }, data: { read: true } })
  return NextResponse.json({ ok: true })
}
