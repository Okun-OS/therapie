import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import {
  getCompanyModel,
  generateCompanyModelFromOnboarding,
  saveCompanyModel,
} from '@/lib/company-model-service'
import type { CompanyModel } from '@/lib/company-model-types'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const customerId = session.role === 'okun'
    ? req.nextUrl.searchParams.get('customerId') ?? ''
    : await resolveCustomerId(session) ?? ''

  if (!customerId) {
    return NextResponse.json({ error: 'customerId nicht ermittelbar' }, { status: 400 })
  }

  const model = await getCompanyModel(customerId)
  return NextResponse.json({ model })
}

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const body = await req.json()
  const customerId = session.role === 'okun'
    ? body.customerId
    : await resolveCustomerId(session)

  if (!customerId) {
    return NextResponse.json({ error: 'customerId nicht ermittelbar' }, { status: 400 })
  }

  // If model is provided in body, save it directly
  if (body.model) {
    const model = body.model as CompanyModel
    model.customerId = customerId
    await saveCompanyModel(customerId, model)
    return NextResponse.json({ model })
  }

  // Otherwise generate from onboarding data
  const model = await generateCompanyModelFromOnboarding(customerId)
  return NextResponse.json({ model })
}
