import type {
  PlanningRuleModel,
  GenerierterPlan,
  PlanBewertung,
  FreigabeEmpfehlung,
  RegelVerletzung,
} from '@/lib/company-model-types'

// §72: NET working hours of one plan entry — individual presence window
// (startzeit/endzeit trims) minus the unpaid break above the threshold.
function entryNetHours(
  entry: { startzeit?: string; endzeit?: string },
  schicht: { von: string; bis: string },
  pausen: { thresholdMinutes: number; deductionMinutes: number },
): number {
  const von = entry.startzeit ?? schicht.von
  const bis = entry.endzeit ?? schicht.bis
  const [sh, sm] = von.split(':').map(Number)
  const [eh, em] = bis.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  if (mins >= pausen.thresholdMinutes) mins -= pausen.deductionMinutes
  return mins / 60
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const dow = d.getDay() || 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - dow + 1)
  return mon.toISOString().slice(0, 10)
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

export function verifyPlan(plan: GenerierterPlan, ruleModel: PlanningRuleModel): PlanBewertung {
  const { mitarbeiter, schichten, harteRegeln, zeitraum } = ruleModel
  const verletzungen: RegelVerletzung[] = []

  if (plan.eintraege.length === 0 && mitarbeiter.length > 0 && zeitraum.arbeitstage.length > 0) {
    return {
      gesamtScore: 0,
      kategorien: { regelkonformitaet: 0, fairness: 0, abdeckung: 0, wunscherfuellung: 0, qualitaet: 0 },
      verletzungen: [{
        schwere: 'kritisch',
        regelId: 'hr-leerplan',
        beschreibung: schichten.length === 0
          ? 'Keine Schichten im Regelmodell — Solver konnte keinen Plan erstellen.'
          : `Kein Mitarbeiter wurde eingeplant (${mitarbeiter.length} verfügbar, ${zeitraum.arbeitstage.length} Arbeitstage).`,
        betrifft: [],
      }],
      optimierungsVorschlaege: [],
      freigabeEmpfehlung: 'ueberarbeiten',
      zusammenfassung: 'Planung fehlgeschlagen: leerer Plan.',
    }
  }

  const maxWeeklyHours = harteRegeln.find(r => r.typ === 'max_wochenstunden')?.wert ?? 40
  const minRestHours   = harteRegeln.find(r => r.typ === 'min_ruhezeit')?.wert ?? 11
  const maxConsecDays  = harteRegeln.find(r => r.typ === 'max_folgetage')?.wert ?? 5
  const pausen = ruleModel.pausenRegeln ?? { thresholdMinutes: 360, deductionMinutes: 30 }

  const byEmp = new Map<string, typeof plan.eintraege>()
  for (const e of plan.eintraege) {
    if (!byEmp.has(e.mitarbeiterId)) byEmp.set(e.mitarbeiterId, [])
    byEmp.get(e.mitarbeiterId)!.push(e)
  }

  for (const emp of mitarbeiter) {
    const entries = (byEmp.get(emp.id) ?? []).sort((a, b) => a.datum.localeCompare(b.datum))

    // Vacation / absence conflicts
    for (const e of entries) {
      if (emp.urlaubAn.includes(e.datum)) {
        verletzungen.push({
          schwere: 'kritisch',
          regelId: 'hr-urlaub',
          beschreibung: `${emp.name} hat Urlaub am ${e.datum}`,
          betrifft: [emp.id, e.datum],
        })
      }
      if (emp.nichtVerfuegbarAn.includes(e.datum)) {
        verletzungen.push({
          schwere: 'kritisch',
          regelId: 'hr-abwesenheit',
          beschreibung: `${emp.name} ist abwesend am ${e.datum}`,
          betrifft: [emp.id, e.datum],
        })
      }
    }

    // Duplicate same-day assignments
    const daySet = new Set<string>()
    for (const e of entries) {
      if (daySet.has(e.datum)) {
        verletzungen.push({
          schwere: 'kritisch',
          regelId: 'hr-doppelbelegung',
          beschreibung: `${emp.name} hat mehrere Dienste am ${e.datum}`,
          betrifft: [emp.id, e.datum],
        })
      }
      daySet.add(e.datum)
    }

    // Weekly hours
    const weekHours: Record<string, number> = {}
    for (const e of entries) {
      const schicht = schichten.find(s => s.id === e.schichtId)
      if (!schicht) continue
      const wk = weekKey(e.datum)
      weekHours[wk] = (weekHours[wk] ?? 0) + entryNetHours(e, schicht, pausen)
    }
    for (const [wk, hours] of Object.entries(weekHours)) {
      if (hours > maxWeeklyHours + 0.01) {
        verletzungen.push({
          schwere: 'hoch',
          regelId: 'hr-maxwochenstunden',
          beschreibung: `${emp.name} überschreitet ${maxWeeklyHours}h Wochenmax in KW ab ${wk} (${hours.toFixed(1)}h)`,
          betrifft: [emp.id, wk],
        })
      }
    }

    // Rest time between consecutive shifts
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1]
      const curr = entries[i]
      const prevS = schichten.find(s => s.id === prev.schichtId)
      const currS = schichten.find(s => s.id === curr.schichtId)
      if (!prevS || !currS) continue
      const rest = restHoursBetween(prev.datum, prevS.bis, prevS.uebernacht ?? false, curr.datum, currS.von)
      if (rest < minRestHours - 0.01) {
        verletzungen.push({
          schwere: 'hoch',
          regelId: 'hr-ruhezeit',
          beschreibung: `${emp.name}: nur ${rest.toFixed(1)}h Ruhe zwischen ${prev.datum} und ${curr.datum} (min. ${minRestHours}h)`,
          betrifft: [emp.id, curr.datum],
        })
      }
    }

    // Max consecutive days — seed from letzteSchichten if available
    const historicDates = new Set((emp.letzteSchichten ?? []).map(ls => ls.datum))
    const firstPlanDay = entries[0]?.datum
    let consecSeed = 0
    if (firstPlanDay) {
      let check = new Date(firstPlanDay)
      check.setDate(check.getDate() - 1)
      while (historicDates.has(check.toISOString().slice(0, 10)) && consecSeed < 60) {
        consecSeed++
        check.setDate(check.getDate() - 1)
      }
    }
    let consec = 1 + consecSeed
    if (entries.length > 0 && consecSeed > 0 && consec > maxConsecDays) {
      verletzungen.push({
        schwere: 'hoch',
        regelId: 'hr-maxfolgetage',
        beschreibung: `${emp.name}: ${consec} aufeinanderfolgende Arbeitstage inkl. Vorzeitraum (max. ${maxConsecDays})`,
        betrifft: [emp.id],
      })
    }
    for (let i = 1; i < entries.length; i++) {
      const prev = new Date(entries[i - 1].datum)
      const curr = new Date(entries[i].datum)
      if (Math.round((curr.getTime() - prev.getTime()) / 86400000) === 1) {
        consec++
        if (consec > maxConsecDays) {
          verletzungen.push({
            schwere: 'hoch',
            regelId: 'hr-maxfolgetage',
            beschreibung: `${emp.name}: ${consec} aufeinanderfolgende Arbeitstage (max. ${maxConsecDays})`,
            betrifft: [emp.id],
          })
        }
      } else {
        consec = 1
      }
    }
  }

  // Qualification check — employee must have all qualifications the shift requires
  for (const e of plan.eintraege) {
    const schicht = schichten.find(s => s.id === e.schichtId)
    const emp = mitarbeiter.find(m => m.id === e.mitarbeiterId)
    if (!schicht || !emp) continue
    const required = schicht.erforderlicheQualifikationen ?? []
    if (required.length === 0) continue
    const empQuals = new Set(emp.qualifikationen ?? [])
    const missing = required.filter(q => !empQuals.has(q))
    if (missing.length > 0) {
      verletzungen.push({
        schwere: 'kritisch',
        regelId: 'hr-qualifikation',
        beschreibung: `${emp.name} fehlt Qualifikation für Schicht „${schicht.name}" am ${e.datum}: ${missing.join(', ')}`,
        betrifft: [emp.id, e.schichtId, e.datum],
      })
    }
  }

  // Staffing coverage
  const byDayShift = new Map<string, number>()
  for (const e of plan.eintraege) {
    const key = `${e.datum}|${e.schichtId}`
    byDayShift.set(key, (byDayShift.get(key) ?? 0) + 1)
  }
  let understaffedSlots = 0
  let totalSlots = 0
  for (const day of zeitraum.arbeitstage) {
    for (const schicht of schichten) {
      const actual   = byDayShift.get(`${day}|${schicht.id}`) ?? 0
      const required = schicht.minBesetzungGesamt ?? 1
      totalSlots++
      if (actual < required) {
        understaffedSlots++
        verletzungen.push({
          schwere: actual === 0 ? 'hoch' : 'mittel',
          regelId: 'hr-mindestbesetzung',
          beschreibung: `Schicht „${schicht.name}" am ${day}: ${actual}/${required} besetzt`,
          betrifft: [day, schicht.id],
        })
      }
    }
  }

  // Wish fulfillment (wunsch = specific shift desired; wunschfrei = day off desired)
  let wishCount = 0
  let wishesMet = 0
  for (const emp of mitarbeiter) {
    const empEntries = byEmp.get(emp.id) ?? []
    for (const w of emp.wuensche) {
      if (w.typ === 'wunsch') {
        wishCount++
        if (empEntries.some(e => e.datum === w.datum && e.schichtId === w.schichtId)) wishesMet++
      } else if (w.typ === 'wunschfrei') {
        // Employee requested the day off — count only if they were actually assigned
        const assignedOnDay = empEntries.some(e => e.datum === w.datum)
        wishCount++
        if (!assignedOnDay) {
          wishesMet++
        } else {
          verletzungen.push({
            schwere: 'niedrig',
            regelId: 'wr-wunschfrei',
            beschreibung: `${emp.name} wünschte frei am ${w.datum}, wurde aber eingeplant`,
            betrifft: [emp.id, w.datum],
          })
        }
      }
    }
  }

  // §96: Die eigenen Regeln des Unternehmens wurden bisher gar nicht geprüft.
  // Genau deshalb konnte ein Plan „100 %" melden, in dem eine Person drei
  // Spätdienste hatte, obwohl die Regel höchstens einen erlaubt. Der Solver
  // erzwingt eine Regel zwar hart — aber nur, wenn sie überhaupt ankam.
  for (const rep of plan.regelReport ?? []) {
    if (!rep.angewendet) {
      verletzungen.push({
        schwere: 'kritisch',
        regelId: `cc-${rep.id ?? rep.name}`,
        beschreibung:
          `Die eigene Regel „${rep.name}" konnte nicht angewendet werden` +
          `${rep.fehler ? ` (${rep.fehler})` : ''} — der Plan hält sie NICHT ein.`,
        betrifft: [],
      })
    }
  }

  // §126: Das Regelpaket des Kunden ist die Dienstplanlogik, für die er bezahlt.
  // Läuft es nicht, ist der Plan wertlos — auch wenn er rechnerisch aufgeht.
  const paket = plan.regelpaket
  if (paket && !paket.angewendet) {
    verletzungen.push({
      schwere: 'kritisch',
      regelId: `paket-${paket.id}`,
      beschreibung:
        `Das Regelpaket „${paket.name}" konnte nicht angewendet werden` +
        `${paket.fehler ? ` (${paket.fehler})` : ''} — der Plan folgt NICHT den ` +
        'für diesen Betrieb programmierten Regeln.',
      betrifft: [],
    })
  }
  // Ein Paket, das läuft und nichts tut, ist genauso schlimm wie eines, das
  // abstürzt — nur unauffälliger.
  if (paket && paket.angewendet && (paket.regeln?.length ?? 0) === 0) {
    verletzungen.push({
      schwere: 'kritisch',
      regelId: `paket-leer-${paket.id}`,
      beschreibung:
        `Das Regelpaket „${paket.name}" lief durch, hat aber keine einzige Regel ` +
        'angewendet. Entweder ist es leer, oder seine Regeln haben niemanden getroffen.',
      betrifft: [],
    })
  }

  // §97: Veralteter Rechendienst — individuelle Regeln können wirkungslos sein,
  // ohne dass ein Fehler auftaucht. Das ist der gefährlichste Zustand überhaupt,
  // weil der Plan völlig unauffällig aussieht.
  for (const d of plan.decisions ?? []) {
    if (d.typ === 'solver_veraltet') {
      verletzungen.push({
        schwere: 'kritisch',
        regelId: 'sv-veraltet',
        beschreibung: d.beschreibung,
        betrifft: [],
      })
    }
  }

  // §96: Abweichungen zwischen Vertrags- und Planstunden benennen. Sie sind
  // nicht automatisch ein Fehler (feste Dienstzeiten gehen selten exakt auf),
  // aber sie gehören in die Bewertung statt unter den Tisch.
  for (const b of plan.stundenbilanz ?? []) {
    const abw = Math.abs(b.abweichungStunden)
    if (abw <= 0.5) continue
    const emp = mitarbeiter.find(m => m.id === b.mitarbeiterId)
    verletzungen.push({
      schwere: abw >= 5 ? 'hoch' : 'niedrig',
      regelId: 'st-abweichung',
      beschreibung:
        `${emp?.name ?? b.mitarbeiterId}: ${b.istStunden} statt ${b.sollStunden} Std. ` +
        `in der Woche ab ${b.woche} (${b.abweichungStunden > 0 ? '+' : ''}${b.abweichungStunden} Std.).`,
      betrifft: [b.mitarbeiterId],
    })
  }

  // §96: Sicherheitsnetz gegen erfundene Dienstzeiten. Ein Eintrag muss die
  // Zeiten seines Dienstes tragen; alles andere ist ein Rechenfehler, der im
  // Plan wie eine echte Schicht aussieht.
  const schichtById = new Map(schichten.map(s => [s.id, s]))
  for (const e of plan.eintraege) {
    const s = schichtById.get(e.schichtId)
    if (!s) continue
    const start = e.startzeit ?? s.von
    const ende = e.endzeit ?? s.bis
    if (start !== s.von || ende !== s.bis) {
      const emp = mitarbeiter.find(m => m.id === e.mitarbeiterId)
      verletzungen.push({
        schwere: 'hoch',
        regelId: 'zt-abweichende-dienstzeit',
        beschreibung:
          `${emp?.name ?? e.mitarbeiterId} am ${e.datum}: ${start}–${ende} weicht von ` +
          `„${s.name}" (${s.von}–${s.bis}) ab. Diese Dienstzeit gibt es nicht.`,
        betrifft: [e.mitarbeiterId, e.datum],
      })
    }
  }

  // Compute scores
  const criticalCount = verletzungen.filter(v => v.schwere === 'kritisch').length
  const highCount     = verletzungen.filter(v => v.schwere === 'hoch').length

  const regelkonformitaet = Math.max(0, 100 - criticalCount * 30 - highCount * 10)
  const abdeckung = totalSlots > 0 ? Math.round((1 - understaffedSlots / totalSlots) * 100) : 100
  const wunscherfuellung  = wishCount > 0 ? Math.round(wishesMet / wishCount * 100) : 100

  // Deterministic fairness: measure weekend-shift range and night/late-shift range across employees
  const fairness = (() => {
    if (mitarbeiter.length < 2) return 100
    const weekendCounts = mitarbeiter.map(emp => {
      const entries = byEmp.get(emp.id) ?? []
      return entries.filter(e => { const d = new Date(e.datum).getDay(); return d === 0 || d === 6 }).length
    })
    const nightShiftIds = new Set(schichten.filter(s => s.typ === 'nacht').map(s => s.id))
    const latShiftIds   = new Set(schichten.filter(s => s.typ === 'spaet').map(s => s.id))
    const nightCounts = mitarbeiter.map(emp => (byEmp.get(emp.id) ?? []).filter(e => nightShiftIds.has(e.schichtId)).length)
    const lateCounts  = mitarbeiter.map(emp => (byEmp.get(emp.id) ?? []).filter(e => latShiftIds.has(e.schichtId)).length)
    const range = (arr: number[]) => arr.length < 2 ? 0 : Math.max(...arr) - Math.min(...arr)
    const weRange    = range(weekendCounts)
    const nightRange = range(nightCounts)
    const lateRange  = range(lateCounts)
    const totalPlanDays = mitarbeiter.reduce((s, emp) => s + (byEmp.get(emp.id) ?? []).length, 0)
    const avgPerEmp = totalPlanDays / mitarbeiter.length || 1
    const penalty = (weRange * 20 + nightRange * 15 + lateRange * 10) / avgPerEmp
    return Math.max(0, Math.min(100, Math.round(100 - penalty)))
  })()

  const qualitaet = Math.round((regelkonformitaet + abdeckung + wunscherfuellung) / 3)
  const gesamtScore = Math.round(
    regelkonformitaet * 0.4 + abdeckung * 0.3 + wunscherfuellung * 0.15 + fairness * 0.15,
  )

  const freigabeEmpfehlung: FreigabeEmpfehlung =
    criticalCount > 0 || (highCount > 0 && gesamtScore < 60) ? 'ueberarbeiten'
    : gesamtScore >= 80 && criticalCount === 0 && highCount === 0 ? 'freigeben'
    : 'optimieren'

  const label = freigabeEmpfehlung === 'freigeben'
    ? 'Freigabe empfohlen'
    : freigabeEmpfehlung === 'optimieren'
    ? 'Optimierung möglich'
    : 'Überarbeitung erforderlich'

  const zusammenfassung =
    `${label} · Score ${gesamtScore}/100 · ${verletzungen.length} Hinweise` +
    ` · Besetzung ${abdeckung}%` +
    (wishCount > 0 ? ` · Wünsche ${wunscherfuellung}%` : '') +
    (plan.metadaten?.solver ? ` · ${plan.metadaten.solver.split(' ')[0]}` : '')

  return {
    gesamtScore,
    kategorien: { regelkonformitaet, fairness, abdeckung, wunscherfuellung, qualitaet },
    verletzungen,
    optimierungsVorschlaege: [],
    freigabeEmpfehlung,
    zusammenfassung,
  }
}
