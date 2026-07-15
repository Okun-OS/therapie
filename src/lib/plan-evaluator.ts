import type {
  PlanningRuleModel,
  GenerierterPlan,
  PlanBewertung,
  FreigabeEmpfehlung,
  RegelVerletzung,
} from '@/lib/company-model-types'

function shiftDurationHours(von: string, bis: string): number {
  const [sh, sm] = von.split(':').map(Number)
  const [eh, em] = bis.split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  return (mins <= 0 ? mins + 24 * 60 : mins) / 60
}

function restHoursBetween(
  lastDate: string, lastEnd: string, lastIsOvernight: boolean,
  nextDate: string, nextStart: string,
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

export async function evaluatePlan(
  plan: GenerierterPlan,
  ruleModel: PlanningRuleModel,
): Promise<PlanBewertung> {
  const { mitarbeiter, schichten, harteRegeln, zeitraum } = ruleModel
  const verletzungen: RegelVerletzung[] = []

  const maxWeeklyHours = harteRegeln.find(r => r.typ === 'max_wochenstunden')?.wert ?? 40
  const minRestHours   = harteRegeln.find(r => r.typ === 'min_ruhezeit')?.wert ?? 11
  const maxConsecDays  = harteRegeln.find(r => r.typ === 'max_folgetage')?.wert ?? 5

  // Group entries by employee, sorted by date
  const byEmp = new Map<string, typeof plan.eintraege>()
  for (const e of plan.eintraege) {
    if (!byEmp.has(e.mitarbeiterId)) byEmp.set(e.mitarbeiterId, [])
    byEmp.get(e.mitarbeiterId)!.push(e)
  }
  byEmp.forEach(entries => entries.sort((a, b) => a.datum.localeCompare(b.datum)))

  for (const emp of mitarbeiter) {
    const empEntries = byEmp.get(emp.id) ?? []

    // Vacation / absence violations
    for (const e of empEntries) {
      if (emp.urlaubAn.includes(e.datum)) {
        verletzungen.push({
          schwere: 'kritisch',
          regelId: 'hr-urlaub',
          beschreibung: `${emp.name} hat Urlaub am ${e.datum}, wurde aber eingeplant`,
          betrifft: [emp.id, e.datum],
        })
      }
      if (emp.nichtVerfuegbarAn.includes(e.datum)) {
        verletzungen.push({
          schwere: 'kritisch',
          regelId: 'hr-abwesenheit',
          beschreibung: `${emp.name} ist abwesend am ${e.datum}, wurde aber eingeplant`,
          betrifft: [emp.id, e.datum],
        })
      }
    }

    // Weekly hours
    const weekHours: Record<string, number> = {}
    for (const e of empEntries) {
      const schicht = schichten.find(s => s.id === e.schichtId)
      if (!schicht) continue
      const wk = weekKey(e.datum)
      weekHours[wk] = (weekHours[wk] ?? 0) + shiftDurationHours(schicht.von, schicht.bis)
    }
    for (const [wk, hours] of Object.entries(weekHours)) {
      if (hours > maxWeeklyHours + 0.01) {
        verletzungen.push({
          schwere: 'hoch',
          regelId: 'hr-maxwochenstunden',
          beschreibung: `${emp.name}: ${hours.toFixed(1)}h in Woche ab ${wk} (Limit: ${maxWeeklyHours}h)`,
          betrifft: [emp.id, wk],
        })
      }
    }

    // Rest time between shifts
    for (let i = 1; i < empEntries.length; i++) {
      const prev = empEntries[i - 1]
      const curr = empEntries[i]
      const prevSchicht = schichten.find(s => s.id === prev.schichtId)
      const currSchicht = schichten.find(s => s.id === curr.schichtId)
      if (!prevSchicht || !currSchicht) continue
      const rest = restHoursBetween(
        prev.datum, prevSchicht.bis, prevSchicht.uebernacht ?? false,
        curr.datum, currSchicht.von,
      )
      if (rest < minRestHours - 0.01) {
        verletzungen.push({
          schwere: 'kritisch',
          regelId: 'hr-ruhezeit',
          beschreibung: `${emp.name}: nur ${rest.toFixed(1)}h Ruhezeit zwischen ${prev.datum} und ${curr.datum} (Minimum: ${minRestHours}h)`,
          betrifft: [emp.id, prev.datum, curr.datum],
        })
      }
    }

    // Consecutive work days
    let consec = 1
    for (let i = 1; i < empEntries.length; i++) {
      const prev = new Date(empEntries[i - 1].datum)
      const curr = new Date(empEntries[i].datum)
      if (Math.round((curr.getTime() - prev.getTime()) / 86400000) === 1) {
        consec++
        if (consec > maxConsecDays) {
          verletzungen.push({
            schwere: 'hoch',
            regelId: 'hr-maxfolgetage',
            beschreibung: `${emp.name}: ${consec} aufeinanderfolgende Arbeitstage bis ${empEntries[i].datum} (Limit: ${maxConsecDays})`,
            betrifft: [emp.id, empEntries[i].datum],
          })
        }
      } else {
        consec = 1
      }
    }
  }

  // Staffing coverage per shift per day
  const byDayShift = new Map<string, number>()
  for (const e of plan.eintraege) {
    const key = `${e.datum}|${e.schichtId}`
    byDayShift.set(key, (byDayShift.get(key) ?? 0) + 1)
  }
  for (const day of zeitraum.arbeitstage) {
    for (const schicht of schichten) {
      const actual   = byDayShift.get(`${day}|${schicht.id}`) ?? 0
      const required = schicht.minBesetzungGesamt ?? 1
      if (actual < required) {
        verletzungen.push({
          schwere: actual === 0 ? 'hoch' : 'mittel',
          regelId: 'hr-mindestbesetzung',
          beschreibung: `Schicht „${schicht.name}" am ${day}: ${actual}/${required} Stellen besetzt`,
          betrifft: [day, schicht.id],
        })
      }
    }
  }

  // Wish fulfillment
  let wishesTotal = 0
  let wishesFulfilled = 0
  for (const emp of mitarbeiter) {
    const empEntries = byEmp.get(emp.id) ?? []
    for (const wish of emp.wuensche) {
      if (wish.typ === 'wunschfrei') continue
      wishesTotal++
      if (empEntries.some(e => e.datum === wish.datum && e.schichtId === wish.schichtId)) wishesFulfilled++
    }
  }

  // Scores
  const criticalCount = verletzungen.filter(v => v.schwere === 'kritisch').length
  const highCount     = verletzungen.filter(v => v.schwere === 'hoch').length
  const mittelCount   = verletzungen.filter(v => v.schwere === 'mittel').length

  const regelkonformitaet = Math.max(0, 100 - criticalCount * 25 - highCount * 10 - mittelCount * 5)

  const totalShifts    = plan.eintraege.length
  const totalRequired  = zeitraum.arbeitstage.reduce(
    (sum, _) => sum + schichten.reduce((s, sh) => s + (sh.minBesetzungGesamt ?? 1), 0), 0,
  )
  const abdeckung = totalRequired > 0 ? Math.min(100, Math.round((totalShifts / totalRequired) * 100)) : 100

  const wunscherfuellung = wishesTotal > 0 ? Math.round((wishesFulfilled / wishesTotal) * 100) : 100

  const empShiftCounts = mitarbeiter.map(emp => (byEmp.get(emp.id) ?? []).length)
  const avgShifts      = empShiftCounts.length > 0 ? empShiftCounts.reduce((a, b) => a + b, 0) / empShiftCounts.length : 0
  const maxDeviation   = empShiftCounts.length > 0 ? Math.max(...empShiftCounts.map(c => Math.abs(c - avgShifts))) : 0
  const fairness       = Math.max(0, 100 - Math.round(maxDeviation * 10))

  const gesamtScore = Math.round(
    regelkonformitaet * 0.4 +
    abdeckung         * 0.3 +
    wunscherfuellung  * 0.15 +
    fairness          * 0.15,
  )

  let freigabeEmpfehlung: FreigabeEmpfehlung = 'freigeben'
  if (criticalCount > 0 || (highCount > 0 && gesamtScore < 60)) {
    freigabeEmpfehlung = 'ueberarbeiten'
  } else if (gesamtScore < 80 || highCount > 0) {
    freigabeEmpfehlung = 'optimieren'
  }

  const understaffed = verletzungen.filter(v => v.regelId === 'hr-mindestbesetzung').length
  const zusammenfassung = [
    `${totalShifts} Dienste geplant`,
    understaffed > 0 ? `${understaffed} Unterbesetzungen` : null,
    verletzungen.length > 0 ? `${verletzungen.length} Regelhinweise` : 'Keine Regelverletzungen',
    `Score: ${gesamtScore}/100`,
  ].filter(Boolean).join(' · ')

  return {
    gesamtScore,
    kategorien: {
      regelkonformitaet,
      fairness,
      abdeckung,
      wunscherfuellung,
      qualitaet: Math.round((regelkonformitaet + abdeckung) / 2),
    },
    verletzungen,
    optimierungsVorschlaege: [],
    freigabeEmpfehlung,
    zusammenfassung,
  }
}
