import { NextRequest, NextResponse } from 'next/server'
import { listCustomers, addCustomer } from '@/lib/entities'

export const dynamic = 'force-dynamic'

export async function GET() {
  const customers = await listCustomers()
  return NextResponse.json({ customers })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, contactName, contactEmail, plan, seatsLicensed } = body

  if (!name?.trim() || !contactName?.trim() || !contactEmail?.trim() || !plan || !seatsLicensed) {
    return NextResponse.json({ error: 'name, contactName, contactEmail, plan und seatsLicensed sind erforderlich' }, { status: 400 })
  }

  const customer = await addCustomer({ name, contactName, contactEmail, plan, seatsLicensed })
  return NextResponse.json({ customer })
}
