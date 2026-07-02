import { prisma } from '@/lib/prisma'
import { getCompanyModel, getStandortModell } from '@/lib/company-model-service'
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

function getWorkdays(von: string, bis: string): string[] {
  const days: string[] = []
  const start = new Date(von)
  const end = new Date(bis)
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
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
  const arbeitstage = getWorkdays(von, bis)

  const [
    companyModel,
    planningRules,
    dbShifts,
    employees,
    vacationRequests,
    absences,
    wishes,
    recentEntries,
  ] = await Promise.all([
    getCompanyModel(customerId),
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
          gte: new Date(new Date(von).getTime() - 14 * 86400000).toISOString().slice(0, 10),
          lt: von,
        },
      },
      orderBy: { date: 'desc' },
    }),
  ])

  const standort = companyModel ? getStandortModell(companyModel, locationId) : null

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

  // Build schichten from CompanyModel or DB shifts
  let schichten: SchichtDefinition[] = standort?.schichtmodell.schichten ?? []
  if (schichten.length === 0) {
    schichten = dbShifts.map(s => ({
      id: s.id,
      name: s.name,
      typ: toSchichtTyp(s.name),
      von: s.startTime,
      bis: s.endTime,
      uebernacht: s.endTime < s.startTime,
      minBesetzungGesamt: s.minStaff,
      aufgaben: [],
    }))
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

    const letzteSchichten = recentEntries
      .filter(e => e.employeeId === emp.id)
      .slice(0, 10)
      .map(e => ({ datum: e.date, schichtId: e.shiftId }))

    const empEinheiten: string[] = []
    if (emp.gruppe) empEinheiten.push(emp.gruppe)
    if (emp.bereich) empEinheiten.push(emp.bereich)
    if (emp.multiGroupCapable && einheiten.length > 0) {
      einheiten.forEach(e => { if (!empEinheiten.includes(e.id)) empEinheiten.push(e.id) })
    }

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
      besonderheiten: emp.fixedLocations ?? undefined,
      letzteSchichten,
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
