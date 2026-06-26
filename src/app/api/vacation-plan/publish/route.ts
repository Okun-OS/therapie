import { NextRequest, NextResponse } from 'next/server'
import { notifyEmployee } from '@/lib/notify'
import { formatDate } from '@/lib/utils'
import type { VacationRequest } from '@/lib/types'

interface PublishRequest {
  requests: VacationRequest[]
}

export async function POST(req: NextRequest) {
  let body: PublishRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { requests } = body
  if (!Array.isArray(requests)) {
    return NextResponse.json({ error: 'requests sind erforderlich' }, { status: 400 })
  }

  await Promise.all(
    requests.map(r =>
      notifyEmployee(r.employeeId, {
        type: 'vacation_plan_published',
        title: 'Urlaubsplan freigegeben',
        body: `Dein Urlaub vom ${formatDate(r.startDate)} bis ${formatDate(r.endDate)} wurde im Rahmen der Jahresurlaubsplanung genehmigt.`,
        requestId: r.id,
        url: '/employee/vacation',
      }),
    ),
  )

  return NextResponse.json({ notified: requests.length })
}
