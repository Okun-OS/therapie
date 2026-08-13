import { NextRequest, NextResponse } from 'next/server'
import { requireRole, resolveCustomerId } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  const employeeId = req.nextUrl.searchParams.get('employeeId')
  const year  = Number(req.nextUrl.searchParams.get('year'))
  const month = Number(req.nextUrl.searchParams.get('month'))

  if (!employeeId || !year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'employeeId, year, month sind erforderlich' }, { status: 400 })
  }

  // Verify ownership (non-okun roles may only see own employees)
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 })
  if (session.role !== 'okun') {
    const customerId = await resolveCustomerId(session)
    if (employee.customerId !== customerId) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  // Build YYYY-MM-DD range for the month
  const monthStr = String(month).padStart(2, '0')
  const from = `${year}-${monthStr}-01`
  const daysInMonth = new Date(year, month, 0).getDate()
  const to = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`

  const [timeLogs, closing, scheduleEntries, shifts] = await Promise.all([
    prisma.timeLog.findMany({
      where: { employeeId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    }),
    prisma.monthlyClosing.findUnique({ where: { employeeId_year_month: { employeeId, year, month } } }),
    prisma.scheduleEntry.findMany({
      where: { employeeId, date: { gte: from, lte: to }, status: 'confirmed' },
    }),
    prisma.shift.findMany({ where: { locationId: employee.locationId ?? '' } }),
  ])

  const shiftMap = new Map(shifts.map(s => [s.id, s]))

  // Daily hours target from employee contract
  const weeklyHours = employee.weeklyHours ?? 0
  const workDaysPerWeek = employee.workDaysPerWeek ?? 5
  const dailySollHours = workDaysPerWeek > 0 ? weeklyHours / workDaysPerWeek : 0

  // Fixed off-days (0=Sun, 1=Mon…6=Sat)
  const fixedOffDays: number[] = Array.isArray(employee.fixedOffDays)
    ? (employee.fixedOffDays as unknown as number[])
    : []

  // Build per-day records
  const days: {
    date: string
    weekday: string
    isWorkday: boolean
    sollHours: number
    clockIn: string | null
    clockOut: string | null
    breakMinutes: number
    totalMinutes: number
    istHours: number
    differenceMinutes: number
    note: string | null
  }[] = []

  const WEEKDAY_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

  let runningBalanceMinutes = 0

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`
    const dow = new Date(year, month - 1, d).getDay() // 0=Sun
    const weekdayLabel = WEEKDAY_DE[dow]
    const isWorkday = !fixedOffDays.includes(dow) && dow !== 0 && !(dow === 6 && workDaysPerWeek <= 5)

    const log = timeLogs.find(l => l.date === dateStr)
    const schedEntry = scheduleEntries.find(e => e.date === dateStr)

    const sollHours = isWorkday ? dailySollHours : 0
    const sollMinutes = Math.round(sollHours * 60)

    const totalMinutes = log?.totalMinutes ?? 0
    const breakMinutes = log?.breakMinutes ?? 0
    const istHours = totalMinutes > 0 ? (totalMinutes - breakMinutes) / 60 : 0
    const istMinutes = Math.round(istHours * 60)

    const differenceMinutes = istMinutes - sollMinutes
    runningBalanceMinutes += differenceMinutes

    // Note: shift name if scheduled but not clocked in, or manual note
    let note = log?.note ?? null
    if (!note && schedEntry) {
      const shift = shiftMap.get(schedEntry.shiftId)
      if (shift) note = shift.name
    }

    days.push({
      date: dateStr,
      weekday: weekdayLabel,
      isWorkday,
      sollHours,
      clockIn: log?.clockIn ?? null,
      clockOut: log?.clockOut ?? null,
      breakMinutes,
      totalMinutes,
      istHours,
      differenceMinutes,
      note,
    })
  }

  const totalSollMinutes = closing?.sollMinutes ?? days.reduce((s, d) => s + Math.round(d.sollHours * 60), 0)
  const totalIstMinutes  = closing?.istMinutes  ?? days.reduce((s, d) => s + Math.round(d.istHours  * 60), 0)

  return NextResponse.json({
    employee: {
      id: employee.id,
      name: employee.name,
      position: employee.position,
      weeklyHours,
      workDaysPerWeek,
    },
    year,
    month,
    closing: closing ? {
      status: closing.status,
      vacationDays: closing.vacationDays,
      sickDays: closing.sickDays,
    } : null,
    totalSollMinutes,
    totalIstMinutes,
    totalDiffMinutes: totalIstMinutes - totalSollMinutes,
    days,
  })
}
