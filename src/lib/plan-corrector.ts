import type {
  PlanningRuleModel,
  GenerierterPlan,
  PlanBewertung,
  PlanEintrag,
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

/**
 * Mechanically fixes plan violations identified by the evaluator.
 * Never calls AI — all corrections are deterministic code.
 */
export function correctPlan(
  plan: GenerierterPlan,
  bewertung: PlanBewertung,
  ruleModel: PlanningRuleModel,
): GenerierterPlan {
  const { mitarbeiter, schichten, harteRegeln, zeitraum } = ruleModel

  const maxWeeklyHours = harteRegeln.find(r => r.typ === 'max_wochenstunden')?.wert ?? 40
  const minRestHours   = harteRegeln.find(r => r.typ === 'min_ruhezeit')?.wert ?? 11
  const maxConsecDays  = harteRegeln.find(r => r.typ === 'max_folgetage')?.wert ?? 5

  // Work on a mutable copy
  let eintraege: PlanEintrag[] = [...plan.eintraege]

  // ── 1. Remove vacation / absence conflicts ──────────────────────────────────
  const vacationSet = new Set<string>()
  const absenceSet  = new Set<string>()
  for (const emp of mitarbeiter) {
    emp.urlaubAn.forEach(d => vacationSet.add(`${emp.id}|${d}`))
    emp.nichtVerfuegbarAn.forEach(d => absenceSet.add(`${emp.id}|${d}`))
  }
  eintraege = eintraege.filter(e =>
    !vacationSet.has(`${e.mitarbeiterId}|${e.datum}`) &&
    !absenceSet.has(`${e.mitarbeiterId}|${e.datum}`),
  )

  // ── 2. Remove duplicate same-day assignments per employee ───────────────────
  const seenDayEmp = new Set<string>()
  eintraege = eintraege.filter(e => {
    const key = `${e.mitarbeiterId}|${e.datum}`
    if (seenDayEmp.has(key)) return false
    seenDayEmp.add(key)
    return true
  })

  // ── 3. Fix weekly hours violations ─────────────────────────────────────────
  // Sort by date so we drop later assignments first (keep earlier ones)
  eintraege.sort((a, b) => a.datum.localeCompare(b.datum))
  const weekHours: Record<string, Record<string, number>> = {}
  eintraege = eintraege.filter(e => {
    const schicht = schichten.find(s => s.id === e.schichtId)
    if (!schicht) return true
    const h  = shiftDurationHours(schicht.von, schicht.bis)
    const wk = weekKey(e.datum)
    if (!weekHours[e.mitarbeiterId]) weekHours[e.mitarbeiterId] = {}
    const used = weekHours[e.mitarbeiterId][wk] ?? 0
    if (used + h > maxWeeklyHours + 0.01) return false
    weekHours[e.mitarbeiterId][wk] = used + h
    return true
  })

  // ── 4. Fix rest-time violations ─────────────────────────────────────────────
  const byEmp = new Map<string, PlanEintrag[]>()
  for (const e of eintraege) {
    if (!byEmp.has(e.mitarbeiterId)) byEmp.set(e.mitarbeiterId, [])
    byEmp.get(e.mitarbeiterId)!.push(e)
  }
  const toRemove = new Set<number>()
  for (const empId of Array.from(byEmp.keys())) {
    const empEntries = byEmp.get(empId)!
    empEntries.sort((a: PlanEintrag, b: PlanEintrag) => a.datum.localeCompare(b.datum))
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
        // Remove the later entry to preserve the earlier assignment
        const idx = eintraege.indexOf(curr)
        if (idx !== -1) toRemove.add(idx)
      }
    }
  }
  eintraege = eintraege.filter((_, i) => !toRemove.has(i))

  // ── 5. Fix consecutive-days violations ─────────────────────────────────────
  const byEmp2 = new Map<string, PlanEintrag[]>()
  for (const e of eintraege) {
    if (!byEmp2.has(e.mitarbeiterId)) byEmp2.set(e.mitarbeiterId, [])
    byEmp2.get(e.mitarbeiterId)!.push(e)
  }
  const toRemove2 = new Set<PlanEintrag>()
  for (const empId2 of Array.from(byEmp2.keys())) {
    const empEntries = byEmp2.get(empId2)!
    empEntries.sort((a: PlanEintrag, b: PlanEintrag) => a.datum.localeCompare(b.datum))
    let consec = 1
    for (let i = 1; i < empEntries.length; i++) {
      const prev = new Date(empEntries[i - 1].datum)
      const curr = new Date(empEntries[i].datum)
      if (Math.round((curr.getTime() - prev.getTime()) / 86400000) === 1) {
        consec++
        if (consec > maxConsecDays) {
          toRemove2.add(empEntries[i])
          consec = 1 // Fix 5a: reset to 1 (gap day), not 0
        }
      } else {
        consec = 1
      }
    }
  }
  eintraege = eintraege.filter(e => !toRemove2.has(e))

  // ── 6. Fill understaffing if a spare employee is available ─────────────────
  // Fix 4: Use bewertung to prioritize days with critical/high violations.
  // Build day priority from violations that reference a specific date.
  const priorityDays = new Set<string>()
  for (const v of bewertung.verletzungen) {
    if (v.schwere === 'kritisch' || v.schwere === 'hoch') {
      const m = v.beschreibung.match(/\d{4}-\d{2}-\d{2}/)
      if (m) priorityDays.add(m[0])
    }
  }
  const sortedDays = [...zeitraum.arbeitstage].sort((a, b) => {
    const ap = priorityDays.has(a) ? 0 : 1
    const bp = priorityDays.has(b) ? 0 : 1
    return ap - bp || a.localeCompare(b)
  })
  // When coverage score is low, allow slight hour-overage to fill gaps
  const fillMaxHours = (bewertung.kategorien?.abdeckung ?? 100) < 70
    ? maxWeeklyHours + 8
    : maxWeeklyHours

  // Build a set of already-assigned (empId, date) pairs for fast lookup
  const assignedKey = new Set(eintraege.map(e => `${e.mitarbeiterId}|${e.datum}`))
  const currentWeekHours: Record<string, Record<string, number>> = {}
  for (const e of eintraege) {
    const schicht = schichten.find(s => s.id === e.schichtId)
    if (!schicht) continue
    const h  = shiftDurationHours(schicht.von, schicht.bis)
    const wk = weekKey(e.datum)
    if (!currentWeekHours[e.mitarbeiterId]) currentWeekHours[e.mitarbeiterId] = {}
    currentWeekHours[e.mitarbeiterId][wk] = (currentWeekHours[e.mitarbeiterId][wk] ?? 0) + h
  }

  for (const day of sortedDays) {
    const wk = weekKey(day)
    for (const schicht of schichten) {
      const required = schicht.minBesetzungGesamt ?? 1
      const actual   = eintraege.filter(e => e.datum === day && e.schichtId === schicht.id).length
      if (actual >= required) continue

      const needed = required - actual
      let filled   = 0

      for (const emp of mitarbeiter) {
        if (filled >= needed) break
        if (assignedKey.has(`${emp.id}|${day}`)) continue
        if (emp.urlaubAn.includes(day) || emp.nichtVerfuegbarAn.includes(day)) continue
        // Fix 5b: respect wunschfrei wishes when filling understaffing
        if (emp.wuensche.some(w => w.datum === day && w.typ === 'wunschfrei')) continue

        const h    = shiftDurationHours(schicht.von, schicht.bis)
        const used = currentWeekHours[emp.id]?.[wk] ?? 0
        if (used + h > fillMaxHours + 0.01) continue

        // Fix 5a: don't re-add if adding this day would violate maxConsecDays
        const empDates = new Set(eintraege.filter(e => e.mitarbeiterId === emp.id).map(e => e.datum))
        let streak = 1
        const dPrev = new Date(day)
        dPrev.setDate(dPrev.getDate() - 1)
        while (empDates.has(dPrev.toISOString().slice(0, 10))) { streak++; dPrev.setDate(dPrev.getDate() - 1) }
        const dNext = new Date(day)
        dNext.setDate(dNext.getDate() + 1)
        while (empDates.has(dNext.toISOString().slice(0, 10))) { streak++; dNext.setDate(dNext.getDate() + 1) }
        if (streak > maxConsecDays) continue

        eintraege.push({
          mitarbeiterId: emp.id,
          datum: day,
          schichtId: schicht.id,
          einheitId: emp.einheiten?.[0],
          istVertretung: false,
        })
        assignedKey.add(`${emp.id}|${day}`)
        if (!currentWeekHours[emp.id]) currentWeekHours[emp.id] = {}
        currentWeekHours[emp.id][wk] = used + h
        filled++
      }
    }
  }

  return {
    ...plan,
    eintraege,
    metadaten: {
      ...plan.metadaten,
      solver: 'algorithmic-v1+corrector',
    },
  }
}
