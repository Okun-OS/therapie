import { prisma } from '@/lib/prisma'
import { getLocationModel } from '@/lib/company-model-service'
import { compileRuleSet } from '@/lib/rule-compiler'
import type { CanonicalRule, CanonicalRuleSet } from '@/lib/rule-dsl'
import type {
  PlanningRuleModel,
  PlanungsMitarbeiter,
  PlanungsWunsch,
  SchichtTyp,
  HarteRegel,
  WeicheRegel,
  PlanungsEinheit,
  SchichtDefinition,
  FairnessKonfig,
  CustomConstraintEntry,
} from '@/lib/company-model-types'

const DAY_NAME_TO_DOW: Record<string, number> = {
  Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0,
}

const BETRIEBSTYP_ARBEITSTAGE: Record<string, string[]> = {
  mon_fri:      ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
  mon_sat:      ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  '7_tage':     ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  '24_7':       ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  schichtbetrieb: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
}

function getWorkdays(von: string, bis: string, arbeitstage: string[]): string[] {
  const dows = new Set(
    arbeitstage.map(d => DAY_NAME_TO_DOW[d]).filter((n): n is number => n !== undefined),
  )
  const days: string[] = []
  // Parse as local midnight to avoid UTC-offset day-of-week mismatch
  const [sy, sm, sd] = von.split('-').map(Number)
  const [ey, em, ed] = bis.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end   = new Date(ey, em - 1, ed)
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (dows.has(d.getDay())) {
      // Emit as YYYY-MM-DD using local date components to stay consistent
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      days.push(`${y}-${m}-${day}`)
    }
  }
  return days
}

function toSchichtTyp(schichtName: string): SchichtTyp {
  const n = schichtName.toLowerCase()
  if (n.includes('früh') || n.includes('frueh') || n.includes('morgen')) return 'frueh'
  if (n.includes('spät') || n.includes('spaet') || n.includes('abend')) return 'spaet'
  if (n.includes('nacht')) return 'nacht'
  if (n.includes('bereitschaft') && n.includes('ruf')) return 'rufbereitschaft'
  if (n.includes('bereitschaft')) return 'bereitschaft'
  if (n.includes('sonder')) return 'sonderdienst'
  return 'mittel'
}

export async function buildRuleModel(
  locationId: string,
  customerId: string,
  von: string,
  bis: string,
  sessionId: string,
  kontext?: string,
  vorherigeBewertung?: string,
  overtimeDecisions?: Record<string, 'reduce' | 'normal' | 'compensate'>,
  existingSchedule?: Array<{ mitarbeiterId: string; datum: string; schichtId: string }>,
  frozenDates?: string[],
): Promise<PlanningRuleModel> {
  // Fetch the per-location model to resolve which days to plan.
  // Falls back gracefully to defaults when no LocationModel has been generated yet.
  const locationModel = await getLocationModel(locationId)
  const betriebsTyp = locationModel?.betriebsTyp ?? 'mon_fri'
  const modelArbeitstage = locationModel?.schichtmodell?.arbeitstage ?? []
  // Explicit arbeitstage array wins; fall back to betriebsTyp-derived days
  const effectiveArbeitstage = modelArbeitstage.length > 0
    ? modelArbeitstage
    : (BETRIEBSTYP_ARBEITSTAGE[betriebsTyp] ?? ['Mo', 'Di', 'Mi', 'Do', 'Fr'])
  const arbeitstage = getWorkdays(von, bis, effectiveArbeitstage)

  const [
    planningRules,
    dbShifts,
    employees,
    vacationRequests,
    absences,
    wishes,
    recentEntries,
    employeeRequests,
    futureRequests,
    activeCustomConstraints,
  ] = await Promise.all([
    prisma.locationPlanningRules.findUnique({ where: { locationId } }),
    prisma.shift.findMany({ where: { locationId } }),
    prisma.employee.findMany({ where: { locationId, active: true } }),
    prisma.vacationRequest.findMany({
      where: {
        locationId,
        status: 'approved',
        OR: arbeitstage.map(d => ({ startDate: { lte: d }, endDate: { gte: d } })),
      },
    }),
    prisma.absence.findMany({
      where: {
        locationId,
        OR: arbeitstage.map(d => ({ startDate: { lte: d }, endDate: { gte: d } })),
      },
    }),
    prisma.wishSubmission.findMany({
      where: {
        locationId,
        date: { in: arbeitstage },
        status: { in: ['pending', 'approved'] },
      },
    }),
    prisma.scheduleEntry.findMany({
      where: {
        locationId,
        date: {
          gte: new Date(new Date(von).getTime() - 35 * 86400000).toISOString().slice(0, 10),
          lt: von,
        },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.employeeRequest.findMany({
      where: {
        locationId,
        status: 'approved',
        type: { in: ['vacation', 'absence', 'day_off_wish', 'shift_wish'] },
        OR: [
          ...arbeitstage.map(d => ({ date: d })),
          ...arbeitstage.map(d => ({ dateFrom: { lte: d }, dateTo: { gte: d } })),
        ],
      },
    }),
    // §15 rolling horizon: load next period's approved absences as future context
    prisma.employeeRequest.findMany({
      where: {
        locationId,
        status: 'approved',
        type: { in: ['vacation', 'absence'] },
        OR: [
          { dateFrom: { gte: bis } },
          { date: { gt: bis } },
        ],
      },
      take: 50,
    }),
    // §70 custom constraints: active only
    prisma.customConstraint.findMany({
      where: { locationId, status: 'active' },
      select: { id: true, name: true, description: true, code: true },
    }),
  ])

  const standort = locationModel

  const planningProfiles = await prisma.employeePlanningProfile.findMany({
    where: { employeeId: { in: employees.map(e => e.id) } },
  })
  const profileByEmp = new Map(planningProfiles.map(p => [p.employeeId, p]))

  // Build einheiten — DB units take priority (§71: the Etagen/Gruppen editor
  // is the source of truth); CompanyModel einheiten are the legacy fallback.
  const dbUnits = await prisma.planningUnit.findMany({ where: { locationId }, orderBy: { sortOrder: 'asc' } })
  let einheiten: PlanungsEinheit[]
  if (dbUnits.length > 0) {
    einheiten = dbUnits.map(u => ({
      id: u.id,
      name: u.name,
      typ: u.type as PlanungsEinheit['typ'],
      mindestbesetzung: u.minStaff ?? 1,
      erforderlicheQualifikationen: [],
      aufgaben: [],
      etageId: u.parentId ?? undefined,
    }))
  } else {
    einheiten = standort?.planungsEinheiten ?? []
  }

  // §71 Stammgruppen-Auflösung: Employee.gruppe hält Unit-ID oder -Name
  const gruppenUnits = einheiten.filter(e => e.typ === 'gruppe')
  const unitLookup = new Map<string, string>()
  gruppenUnits.forEach(u => {
    unitLookup.set(u.id, u.id)
    unitLookup.set(u.name.toLowerCase(), u.id)
  })

  // Build schichten — DB shifts take priority because the frontend resolves
  // shift display by DB UUID. CompanyModel schichten use AI-generated IDs like
  // "frueh" which never match, so they are used only as a last-resort fallback
  // when no DB shifts exist yet.
  let schichten: SchichtDefinition[] = []
  if (dbShifts.length > 0) {
    schichten = dbShifts.map(s => ({
      id: s.id,               // real DB UUID — frontend uses this
      name: s.name,
      typ: toSchichtTyp(s.name),
      von: s.startTime,
      bis: s.endTime,
      uebernacht: s.endTime < s.startTime,
      minBesetzungGesamt: s.minStaff,
      aufgaben: [],
      erforderlicheQualifikationen: s.requiredQualifications ?? [],
    }))
  } else if ((standort?.schichtmodell.schichten ?? []).length > 0) {
    schichten = standort!.schichtmodell.schichten
  }

  // Hard rules: use stored rules from the location model only when they are
  // non-empty — an empty array silently disables all constraints, so fall back
  // to the Rule Compiler with DB-derived values (or statutory defaults).
  const storedHarteRegeln = standort?.planungsRegeln?.hart ?? []
  let harteRegeln: HarteRegel[]
  if (storedHarteRegeln.length > 0) {
    harteRegeln = storedHarteRegeln
  } else {
    const canonicalFallback: CanonicalRuleSet = {
      locationId,
      rules: [
        {
          id: 'hr-maxwochenstunden',
          type: 'MAX_WEEKLY_HOURS',
          severity: 'HARD',
          description: `Maximal ${planningRules?.maxWeeklyHours ?? 40} Stunden pro Woche`,
          params: { hours: planningRules?.maxWeeklyHours ?? 40 },
          source: 'law',
        } satisfies CanonicalRule,
        {
          id: 'hr-ruhezeit',
          type: 'MIN_REST_PERIOD',
          severity: 'HARD',
          description: `Mindestens ${planningRules?.restHours ?? 11} Stunden Ruhezeit zwischen Diensten`,
          params: { hours: planningRules?.restHours ?? 11 },
          source: 'law',
        } satisfies CanonicalRule,
        {
          id: 'hr-maxfolgetage',
          type: 'MAX_CONSECUTIVE_DAYS',
          severity: 'HARD',
          description: `Maximal ${planningRules?.maxConsecutiveDays ?? 5} aufeinanderfolgende Arbeitstage`,
          params: { hours: planningRules?.maxConsecutiveDays ?? 5 },
          source: 'law',
        } satisfies CanonicalRule,
      ],
    }
    const { hart: compiledHart } = compileRuleSet(canonicalFallback)
    harteRegeln = compiledHart
  }

  const weicheRegeln: WeicheRegel[] = standort?.planungsRegeln.weich ?? [
    {
      id: 'wr-wuensche',
      kategorie: 'wunsch',
      beschreibung: 'Dienstwünsche der Mitarbeiter berücksichtigen',
      gewicht: 0.7,
    },
    {
      id: 'wr-fairness',
      kategorie: 'fairness',
      beschreibung: 'Gleichmäßige Verteilung von Wochenenddiensten',
      gewicht: 0.8,
    },
  ]

  const hasWeekend = effectiveArbeitstage.some(d => d === 'Sa' || d === 'So')
  const baseFairness: FairnessKonfig = standort?.fairnessKonfig ?? {
    wochenendArbeit: false,
    wochenendLimitProMonat: planningRules?.weekendMax ?? 2,
    nachtdienstFair: true,
    schichttypFairness: true,
    belastungsgleichverteilung: true,
  }
  // If arbeitstage includes weekend days, force wochenendArbeit=true so the
  // evaluator doesn't penalise weekend assignments as violations.
  const fairness: FairnessKonfig = hasWeekend
    ? { ...baseFairness, wochenendArbeit: true }
    : baseFairness

  // Build employee data
  const mitarbeiter: PlanungsMitarbeiter[] = employees.map(emp => {
    const empReqs = employeeRequests.filter(r => r.employeeId === emp.id)

    const urlaubAn = [
      ...vacationRequests
        .filter(v => v.employeeId === emp.id)
        .flatMap(v => {
          const days: string[] = []
          const s = new Date(v.startDate)
          const e = new Date(v.endDate)
          for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            days.push(d.toISOString().slice(0, 10))
          }
          return days
        }),
      // EmployeeRequest vacation also blocks the employee
      ...empReqs
        .filter(r => r.type === 'vacation')
        .flatMap(r => {
          if (r.date) return [r.date]
          if (!r.dateFrom || !r.dateTo) return []
          const days: string[] = []
          const s = new Date(r.dateFrom)
          const e = new Date(r.dateTo)
          for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            days.push(d.toISOString().slice(0, 10))
          }
          return days
        }),
    ].filter(d => arbeitstage.includes(d))

    // §72 fixed off-days: 'Di' etc. (or numeric day strings) → block those weekdays
    const fixedOffDows = new Set(
      (emp.fixedOffDays ?? [])
        .map(d => DAY_NAME_TO_DOW[d] ?? (Number.isFinite(Number(d)) ? Number(d) : undefined))
        .filter((n): n is number => n !== undefined),
    )
    const fixedOffDates = fixedOffDows.size > 0
      ? arbeitstage.filter(day => {
          const [y, m, dd] = day.split('-').map(Number)
          return fixedOffDows.has(new Date(y, m - 1, dd).getDay())
        })
      : []

    const nichtVerfuegbar = [
      ...fixedOffDates,
      ...absences
        .filter(a => a.employeeId === emp.id)
        .flatMap(a => {
          const days: string[] = []
          const s = new Date(a.startDate)
          const e = new Date(a.endDate)
          for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            days.push(d.toISOString().slice(0, 10))
          }
          return days
        }),
      // EmployeeRequest absence and approved day-off wishes also block the employee
      ...empReqs
        .filter(r => r.type === 'absence' || r.type === 'day_off_wish')
        .flatMap(r => {
          if (r.date) return [r.date]
          if (!r.dateFrom || !r.dateTo) return []
          const days: string[] = []
          const s = new Date(r.dateFrom)
          const e = new Date(r.dateTo)
          for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            days.push(d.toISOString().slice(0, 10))
          }
          return days
        }),
    ].filter(d => arbeitstage.includes(d))

    // §20/§21: map importance to prioritaet (critical→1 / high→2 / normal→3)
    const importanceToPrioraet = (imp: string): 1 | 2 | 3 =>
      imp === 'critical' || imp === 'urgent' ? 1 : imp === 'high' || imp === 'important' ? 2 : 3

    const explicitWishes: PlanungsWunsch[] = [
      // WishSubmission single-date wishes
      ...wishes
        .filter(w => w.employeeId === emp.id)
        .map(w => {
          const matchedShift = schichten.find(
            s => s.name.toLowerCase() === (w.preferredShiftType ?? '').toLowerCase()
              || s.id === w.preferredShiftType,
          )
          return {
            datum: w.date,
            schichtId: matchedShift?.id ?? w.preferredShiftType ?? '',
            typ: (w.preferredShiftType === 'frei' ? 'wunschfrei' : 'wunsch') as 'wunsch' | 'wunschfrei',
            prioritaet: importanceToPrioraet(w.importance),
            eingereichtAm: w.submittedAt,
          }
        }),
      // §19: EmployeeRequest shift_wish with date ranges → expand into per-day wishes
      ...empReqs
        .filter(r => r.type === 'shift_wish' && r.shiftId)
        .flatMap(r => {
          const daysToExpand: string[] = []
          if (r.date) {
            daysToExpand.push(r.date)
          } else if (r.dateFrom && r.dateTo) {
            const s = new Date(r.dateFrom)
            const e = new Date(r.dateTo)
            for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
              daysToExpand.push(d.toISOString().slice(0, 10))
            }
          }
          return daysToExpand
            .filter(d => arbeitstage.includes(d))
            .map(d => ({
              datum: d,
              schichtId: r.shiftId!,
              typ: 'wunsch' as const,
              prioritaet: importanceToPrioraet(r.priority),
            }))
        }),
    ]

    // Translate persistent shiftPreference into low-priority soft wishes (priority 3)
    // for each planning day, unless the employee already has an explicit wish that day.
    const empProfile = profileByEmp.get(emp.id)
    const persistentPref = empProfile?.shiftPreference ?? 'keine'
    const persistentWishes: PlanungsWunsch[] = []
    if (persistentPref !== 'keine') {
      const prefSchicht = schichten.find(s => s.typ === persistentPref)
      if (prefSchicht) {
        const explicitDays = new Set(explicitWishes.map(w => w.datum))
        for (const day of arbeitstage) {
          if (!explicitDays.has(day)) {
            persistentWishes.push({ datum: day, schichtId: prefSchicht.id, typ: 'wunsch', prioritaet: 3 })
          }
        }
      }
    }

    const empWishes = [...explicitWishes, ...persistentWishes]

    const empRecent = recentEntries.filter(e => e.employeeId === emp.id)

    const letzteSchichten = empRecent
      .slice(0, 10)
      .map(e => ({ datum: e.date, schichtId: e.shiftId }))

    const nachtSchichten = empRecent.filter(e => {
      const s = schichten.find(sh => sh.id === e.shiftId)
      return s?.typ === 'nacht'
    }).length

    const spaetDienste = empRecent.filter(e => {
      const s = schichten.find(sh => sh.id === e.shiftId)
      return s?.typ === 'spaet'
    }).length

    const wochenendDienste = empRecent.filter(e => {
      const dow = new Date(e.date).getDay()
      return dow === 0 || dow === 6
    }).length

    const empEinheiten: string[] = []
    if (emp.gruppe) empEinheiten.push(emp.gruppe)
    if (emp.bereich) empEinheiten.push(emp.bereich)
    if (emp.multiGroupCapable && einheiten.length > 0) {
      einheiten.forEach(e => { if (!empEinheiten.includes(e.id)) empEinheiten.push(e.id) })
    }

    const profileText = empProfile ? [
      empProfile.shiftPreference !== 'keine' ? `bevorzugt ${empProfile.shiftPreference}` : null,
      empProfile.weekendRule ?? null,
      empProfile.planningNote ?? null,
      (empProfile.childPickupTimes as {day: string; beforeTime: string}[]).length > 0
        ? `Kinderabholung: ${(empProfile.childPickupTimes as {day: string; beforeTime: string}[]).map(c => `${c.day} bis ${c.beforeTime}`).join(', ')}`
        : null,
    ].filter(Boolean).join('; ') : null

    const baseWeeklyHours = emp.weeklyHours ?? 0
    const daysPerWeek = emp.workDaysPerWeek ?? 5
    const dailyHours = daysPerWeek > 0 ? baseWeeklyHours / daysPerWeek : 0
    const overtimeDecision = overtimeDecisions?.[emp.id]
    let wochenstundenSoll = baseWeeklyHours
    if (overtimeDecision === 'reduce') {
      wochenstundenSoll = Math.max(0, baseWeeklyHours - dailyHours)
    } else if (overtimeDecision === 'compensate') {
      wochenstundenSoll = baseWeeklyHours + dailyHours
    }

    const stammEinheitId = emp.gruppe
      ? unitLookup.get(emp.gruppe) ?? unitLookup.get(emp.gruppe.toLowerCase())
      : undefined

    return {
      id: emp.id,
      name: emp.name,
      einheiten: empEinheiten,
      stammEinheitId,
      verfuegbareSchichtTypen: (emp.workDays?.length ? ['frueh', 'spaet', 'mittel'] : ['frueh', 'spaet', 'nacht', 'mittel']) as SchichtTyp[],
      wochenstundenSoll,
      arbeitstageProWoche: emp.workDaysPerWeek ?? 5,
      qualifikationen: emp.qualifications,
      nichtVerfuegbarAn: nichtVerfuegbar,
      urlaubAn,
      wuensche: empWishes,
      besonderheiten: [emp.fixedLocations ?? null, profileText].filter(Boolean).join('; ') || undefined,
      letzteSchichten,
      belastungsHistorie: { nachtSchichten, wochenendDienste, spaetDienste },
    }
  })

  // §15 rolling horizon: build future-context hint string for solver
  const futureContextParts: string[] = []
  if (futureRequests && futureRequests.length > 0) {
    const empById = new Map(employees.map(e => [e.id, e.name]))
    for (const r of futureRequests.slice(0, 10)) {
      const empName = empById.get(r.employeeId) ?? r.employeeId
      const from = r.dateFrom ?? r.date ?? '?'
      const to = r.dateTo ?? r.date ?? from
      futureContextParts.push(`${empName} ab ${from}${to !== from ? ` bis ${to}` : ''} ${r.type === 'vacation' ? 'Urlaub' : 'abwesend'}`)
    }
  }
  const rollingHorizon = futureContextParts.length > 0
    ? `Geplante Abwesenheiten nach diesem Zeitraum: ${futureContextParts.join('; ')}.`
    : undefined
  const effectiveKontext = [kontext, rollingHorizon].filter(Boolean).join(' ') || undefined

  const customConstraints: CustomConstraintEntry[] = activeCustomConstraints.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    code: c.code,
  }))

  return {
    sessionId,
    locationId,
    customerId,
    zeitraum: { von, bis, arbeitstage },
    einheiten,
    schichten,
    harteRegeln,
    weicheRegeln,
    fairness,
    mitarbeiter,
    kontext: effectiveKontext,
    vorherigeBewertung,
    existingSchedule,
    frozenDates,
    customConstraints: customConstraints.length > 0 ? customConstraints : undefined,
    pausenRegeln: {
      thresholdMinutes: planningRules?.breakThresholdMinutes ?? 360,
      deductionMinutes: planningRules?.breakDeductionMinutes ?? 30,
    },
  }
}
