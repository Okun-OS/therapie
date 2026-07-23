import { prisma } from '@/lib/prisma'
import { getLocationModel } from '@/lib/company-model-service'
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
  const start = new Date(von)
  const end = new Date(bis)
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (dows.has(d.getDay())) {
      days.push(d.toISOString().slice(0, 10))
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
  ])

  const standort = locationModel

  const planningProfiles = await prisma.employeePlanningProfile.findMany({
    where: { employeeId: { in: employees.map(e => e.id) } },
  })
  const profileByEmp = new Map(planningProfiles.map(p => [p.employeeId, p]))

  // Build einheiten from CompanyModel or DB
  let einheiten: PlanungsEinheit[] = standort?.planungsEinheiten ?? []
  if (einheiten.length === 0) {
    const dbUnits = await prisma.planningUnit.findMany({ where: { locationId }, orderBy: { sortOrder: 'asc' } })
    einheiten = dbUnits.map(u => ({
      id: u.id,
      name: u.name,
      typ: u.type as PlanungsEinheit['typ'],
      mindestbesetzung: u.capacity ?? 1,
      erforderlicheQualifikationen: [],
      aufgaben: [],
    }))
  }

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
    }))
  } else if ((standort?.schichtmodell.schichten ?? []).length > 0) {
    schichten = standort!.schichtmodell.schichten
  }

  // Hard rules from CompanyModel + DB planning rules
  const harteRegeln: HarteRegel[] = standort?.planungsRegeln.hart ?? [
    {
      id: 'hr-maxwochenstunden',
      kategorie: 'arbeitszeit',
      beschreibung: `Maximal ${planningRules?.maxWeeklyHours ?? 40} Stunden pro Woche`,
      typ: 'max_wochenstunden',
      wert: planningRules?.maxWeeklyHours ?? 40,
      einheit: 'stunden',
      quelle: 'gesetz',
    },
    {
      id: 'hr-ruhezeit',
      kategorie: 'ruhezeit',
      beschreibung: `Mindestens ${planningRules?.restHours ?? 11} Stunden Ruhezeit zwischen Diensten`,
      typ: 'min_ruhezeit',
      wert: planningRules?.restHours ?? 11,
      einheit: 'stunden',
      quelle: 'gesetz',
    },
    {
      id: 'hr-maxfolgetage',
      kategorie: 'folgetag',
      beschreibung: `Maximal ${planningRules?.maxConsecutiveDays ?? 5} aufeinanderfolgende Arbeitstage`,
      typ: 'max_folgetage',
      wert: planningRules?.maxConsecutiveDays ?? 5,
      einheit: 'tage',
      quelle: 'gesetz',
    },
  ]

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

  const fairness: FairnessKonfig = standort?.fairnessKonfig ?? {
    wochenendArbeit: false,
    wochenendLimitProMonat: planningRules?.weekendMax ?? 2,
    nachtdienstFair: true,
    schichttypFairness: true,
    belastungsgleichverteilung: true,
  }

  // Build employee data
  const mitarbeiter: PlanungsMitarbeiter[] = employees.map(emp => {
    const urlaubAn = vacationRequests
      .filter(v => v.employeeId === emp.id)
      .flatMap(v => {
        const days: string[] = []
        const s = new Date(v.startDate)
        const e = new Date(v.endDate)
        for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          days.push(d.toISOString().slice(0, 10))
        }
        return days
      })
      .filter(d => arbeitstage.includes(d))

    const nichtVerfuegbar = absences
      .filter(a => a.employeeId === emp.id)
      .flatMap(a => {
        const days: string[] = []
        const s = new Date(a.startDate)
        const e = new Date(a.endDate)
        for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          days.push(d.toISOString().slice(0, 10))
        }
        return days
      })
      .filter(d => arbeitstage.includes(d))

    const empWishes: PlanungsWunsch[] = wishes
      .filter(w => w.employeeId === emp.id)
      .map(w => {
        const matchedShift = schichten.find(
          s => s.name.toLowerCase() === (w.preferredShiftType ?? '').toLowerCase()
            || s.id === w.preferredShiftType,
        )
        return {
          datum: w.date,
          schichtId: matchedShift?.id ?? w.preferredShiftType ?? '',
          typ: (w.importance === 'frei' ? 'wunschfrei' : 'wunsch') as 'wunsch' | 'wunschfrei',
          prioritaet: w.importance === 'high' ? 1 : w.importance === 'normal' ? 2 : 3,
        }
      })

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

    const profile = profileByEmp.get(emp.id)
    const profileText = profile ? [
      profile.shiftPreference !== 'keine' ? `bevorzugt ${profile.shiftPreference}` : null,
      profile.weekendRule ?? null,
      profile.planningNote ?? null,
      (profile.childPickupTimes as {day: string; beforeTime: string}[]).length > 0
        ? `Kinderabholung: ${(profile.childPickupTimes as {day: string; beforeTime: string}[]).map(c => `${c.day} bis ${c.beforeTime}`).join(', ')}`
        : null,
    ].filter(Boolean).join('; ') : null

    return {
      id: emp.id,
      name: emp.name,
      einheiten: empEinheiten,
      verfuegbareSchichtTypen: (emp.workDays?.length ? ['frueh', 'spaet', 'mittel'] : ['frueh', 'spaet', 'nacht', 'mittel']) as SchichtTyp[],
      wochenstundenSoll: emp.weeklyHours,
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
    kontext,
    vorherigeBewertung,
  }
}
