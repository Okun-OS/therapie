import type {
  PlanningRuleModel,
  GenerierterPlan,
  PlanEintrag,
  PlanDecision,
  SchichtDefinition,
  PlanungsMitarbeiter,
  SchichtTyp,
} from '@/lib/company-model-types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shiftDurationHours(s: SchichtDefinition): number {
  const [sh, sm] = s.von.split(':').map(Number)
  const [eh, em] = s.bis.split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  return (mins <= 0 ? mins + 24 * 60 : mins) / 60
}

function restHoursBetween(
  lastDate: string,
  lastEnd: string,
  lastIsOvernight: boolean,
  nextDate: string,
  nextStart: string,
): number {
  const [lh, lm] = lastEnd.split(':').map(Number)
  const [nh, nm] = nextStart.split(':').map(Number)
  const endMs = new Date(lastDate).setHours(lh, lm) + (lastIsOvernight ? 86400000 : 0)
  const startMs = new Date(nextDate).setHours(nh, nm)
  return (startMs - endMs) / 3600000
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const dow = d.getDay() || 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - dow + 1)
  return mon.toISOString().slice(0, 10)
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function belastungsScore(emp: PlanungsMitarbeiter, schichtTyp: SchichtTyp): number {
  const h = emp.belastungsHistorie
  if (!h) return 0
  if (schichtTyp === 'nacht') return h.nachtSchichten
  if (schichtTyp === 'spaet') return h.spaetDienste
  return 0
}

// ─── Algorithmic solver ───────────────────────────────────────────────────────

const SHIFT_PRIORITY: Record<string, number> = {
  nacht: 0, frueh: 1, spaet: 2, mittel: 3,
  bereitschaft: 4, rufbereitschaft: 5, sonderdienst: 6,
}

interface EmpState {
  weekHours: Record<string, number>
  consecDays: number
  lastWorkDate: string | null
  lastShiftEnd: string | null
  lastShiftIsOvernight: boolean
  shiftTypeCounts: Record<string, number>
  weekendShifts: number
  totalShifts: number
}

function algorithmicSolve(ruleModel: PlanningRuleModel): GenerierterPlan {
  const { zeitraum, mitarbeiter, schichten, einheiten, harteRegeln, fairness } = ruleModel

  // Extract constraint values from structured hard rules
  const maxWeeklyHours = harteRegeln.find(r => r.typ === 'max_wochenstunden')?.wert ?? 40
  const minRestHours   = harteRegeln.find(r => r.typ === 'min_ruhezeit')?.wert ?? 11
  const maxConsecDays  = harteRegeln.find(r => r.typ === 'max_folgetage')?.wert ?? 5

  // Per-employee running state
  const state: Record<string, EmpState> = {}
  for (const emp of mitarbeiter) {
    state[emp.id] = {
      weekHours: {},
      consecDays: 0,
      lastWorkDate: null,
      lastShiftEnd: null,
      lastShiftIsOvernight: false,
      shiftTypeCounts: {},
      weekendShifts: 0,
      totalShifts: 0,
    }
  }

  const eintraege: PlanEintrag[] = []
  const decisions: PlanDecision[] = []

  const sortedSchichten = [...schichten].sort(
    (a, b) => (SHIFT_PRIORITY[a.typ] ?? 9) - (SHIFT_PRIORITY[b.typ] ?? 9),
  )

  for (const day of zeitraum.arbeitstage) {
    const dow = new Date(day).getDay()
    const isWeekend = dow === 0 || dow === 6
    const wk = weekKey(day)

    // Build wish lookup for today
    type Wish = { schichtId: string; typ: 'wunsch' | 'wunschfrei' }
    const wishMap = new Map<string, Wish>()
    for (const emp of mitarbeiter) {
      const w = emp.wuensche.find(w => w.datum === day)
      if (w) wishMap.set(emp.id, { schichtId: w.schichtId, typ: w.typ })
    }

    const assignedToday = new Set<string>()

    for (const schicht of sortedSchichten) {
      const minStaff   = schicht.minBesetzungGesamt ?? 1
      const shiftHours = shiftDurationHours(schicht)

      const eligible = mitarbeiter.filter(emp => {
        // Hard: vacation / absence / wunschfrei
        if (emp.urlaubAn.includes(day))          return false
        if (emp.nichtVerfuegbarAn.includes(day)) return false
        const wish = wishMap.get(emp.id)
        if (wish?.typ === 'wunschfrei')          return false
        // Hard: already assigned today
        if (assignedToday.has(emp.id))           return false
        const st = state[emp.id]
        // Hard: max weekly hours
        if ((st.weekHours[wk] ?? 0) + shiftHours > maxWeeklyHours + 0.01) return false
        // Hard: min rest between consecutive shifts
        if (st.lastWorkDate && st.lastShiftEnd) {
          const rest = restHoursBetween(
            st.lastWorkDate, st.lastShiftEnd, st.lastShiftIsOvernight,
            day, schicht.von,
          )
          if (rest < minRestHours) return false
        }
        // Hard: max consecutive work days
        if (st.consecDays >= maxConsecDays) return false
        return true
      })

      // Sort by: explicit shift wish > fairness (fewest of this type) > weekend count > total shifts
      eligible.sort((a, b) => {
        const aw = wishMap.get(a.id)
        const bw = wishMap.get(b.id)
        const aScore = aw?.typ === 'wunsch' && aw.schichtId === schicht.id ? -2
                     : aw?.typ === 'wunsch' ? -1 : 0
        const bScore = bw?.typ === 'wunsch' && bw.schichtId === schicht.id ? -2
                     : bw?.typ === 'wunsch' ? -1 : 0
        if (aScore !== bScore) return aScore - bScore

        const diff = (state[a.id].shiftTypeCounts[schicht.typ] ?? 0)
                   - (state[b.id].shiftTypeCounts[schicht.typ] ?? 0)
        if (diff !== 0) return diff

        // Soft: prefer employee with lower recent-history load for this shift type
        const bsDiff = belastungsScore(a, schicht.typ as SchichtTyp)
                     - belastungsScore(b, schicht.typ as SchichtTyp)
        if (bsDiff !== 0) return bsDiff

        if (isWeekend && fairness.wochenendArbeit !== false) {
          const wd = state[a.id].weekendShifts - state[b.id].weekendShifts
          if (wd !== 0) return wd
        }

        return state[a.id].totalShifts - state[b.id].totalShifts
      })

      let assigned = 0
      for (const emp of eligible) {
        if (assigned >= minStaff) break
        const st = state[emp.id]
        const usedHours = st.weekHours[wk] ?? 0
        const target    = emp.wochenstundenSoll ?? 40
        // Allow slight overage only if we still need to fill min staffing
        if (usedHours >= target + shiftHours && assigned >= minStaff) continue

        // Determine unit: use employee's primary unit if available
        const einheitId = emp.einheiten?.[0]
          ?? (einheiten.length > 0 ? einheiten[0].id : undefined)

        eintraege.push({
          mitarbeiterId: emp.id,
          datum: day,
          schichtId: schicht.id,
          einheitId,
          istVertretung: false,
        })

        // Update running state
        st.weekHours[wk]                       = usedHours + shiftHours
        st.consecDays                          = st.lastWorkDate === prevDay(day) ? st.consecDays + 1 : 1
        st.lastWorkDate                        = day
        st.lastShiftEnd                        = schicht.bis
        st.lastShiftIsOvernight                = schicht.uebernacht ?? false
        st.shiftTypeCounts[schicht.typ]        = (st.shiftTypeCounts[schicht.typ] ?? 0) + 1
        if (isWeekend) st.weekendShifts++
        st.totalShifts++
        assignedToday.add(emp.id)
        assigned++
      }

      if (assigned < minStaff) {
        decisions.push({
          typ: 'unterbesetzung',
          beschreibung: `Schicht „${schicht.name}" am ${day}: nur ${assigned} von ${minStaff} Stellen besetzt`,
          betroffenesDatum: day,
        })
      }
    }

    // Reset consecutive-days counter for employees not working today
    for (const emp of mitarbeiter) {
      if (!assignedToday.has(emp.id)) {
        state[emp.id].consecDays = 0
      }
    }
  }

  return {
    eintraege,
    decisions,
    metadaten: {
      erstelltAm: new Date().toISOString(),
      solver: 'algorithmic-v1',
      regelmodellVersion: '1.0',
    },
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function solvePlan(ruleModel: PlanningRuleModel): Promise<GenerierterPlan> {
  return algorithmicSolve(ruleModel)
}
