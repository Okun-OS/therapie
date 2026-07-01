import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, resolveLocationId, resolveCustomerId } from '@/lib/session'
import { getEmployeesByLocation, getEmployeeById, updateEmployee } from '@/lib/entities'
import {
  listShiftsByLocation,
  applyScheduleEdits,
  getPlanningRules,
  upsertPlanningRules,
  listPlanningUnitsByLocation,
  upsertPlanningUnit,
} from '@/lib/schedule-entities'
import { getVacationRequestsByLocation, setVacationRequestStatus } from '@/lib/vacation-entities'
import { getAbsencesByLocation } from '@/lib/time-tracking-entities'

const client = new Anthropic()

// ─── Tool-Definitionen ────────────────────────────────────────────────────────

const TOOLS: Anthropic.Messages.Tool[] = [
  // ── READ ──
  {
    name: 'list_employees',
    description: 'Listet alle Mitarbeiter des Standorts mit vollständigen Profildaten (Stunden, Gruppen, Rollen, Qualifikationen, Arbeitszeiten, Besonderheiten usw.) auf. Enthält außerdem den Dienstplan der nächsten 14 Tage sowie aktive Urlaubs- und Abwesenheitsstatus je Mitarbeiter.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', description: 'Optionaler Namensfilter (Teilstring)' },
      },
    },
  },
  {
    name: 'find_substitutes',
    description: 'Findet geeignete Vertretungskandidaten für einen ausgefallenen Mitarbeiter. Gibt eine nach Verfügbarkeit und Eignung gerankte Liste zurück, mit transparenter Begründung für jeden Kandidaten (frei, verschiebbar, Qualifikation, Wochenstunden).',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Datum für die Vertretung (YYYY-MM-DD)' },
        startTime: { type: 'string', description: 'Startzeit der zu besetzenden Schicht (HH:MM)' },
        endTime: { type: 'string', description: 'Endzeit der zu besetzenden Schicht (HH:MM)' },
        qualification: { type: 'string', description: 'Benötigte Qualifikation (optional)' },
        gruppe: { type: 'string', description: 'Benötigte Gruppe/Bereich (optional)' },
      },
      required: ['date', 'startTime', 'endTime'],
    },
  },
  {
    name: 'get_schedule',
    description: 'Ruft den Dienstplan für einen Datumsbereich ab. Enthält Mitarbeitername, Schichtname und Zeiten.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dateFrom: { type: 'string', description: 'Startdatum YYYY-MM-DD' },
        dateTo: { type: 'string', description: 'Enddatum YYYY-MM-DD (max. 31 Tage)' },
      },
      required: ['dateFrom', 'dateTo'],
    },
  },
  {
    name: 'list_shifts',
    description: 'Listet alle am Standort konfigurierten Schichten auf (Name, Zeiten, Mindestbesetzung, Typ).',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_location_config',
    description: 'Ruft die gesamte Standort-Konfiguration ab: Onboarding-Daten, Planungsregeln und Planungseinheiten (Gruppen, Bereiche, Objekte usw.).',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_organization_config',
    description: 'Ruft die unternehmensweite Konfiguration ab: Unternehmensname, Rollenmodell, Rollen und unternehmensweite Regeln.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_vacation_requests',
    description: 'Listet Urlaubsanträge auf. Optional nach Status und/oder Zeitraum filterbar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['pending', 'approved', 'denied', 'all'], description: 'Statusfilter (Standard: all)' },
        dateFrom: { type: 'string', description: 'Nur Anträge, die in diesem Zeitraum liegen (YYYY-MM-DD)' },
        dateTo: { type: 'string', description: 'Nur Anträge, die in diesem Zeitraum liegen (YYYY-MM-DD)' },
        employeeName: { type: 'string', description: 'Optionaler Namensfilter (Teilstring)' },
      },
    },
  },
  {
    name: 'list_absences',
    description: 'Listet Abwesenheiten (Krankheit, Sonderurlaub usw.) am Standort auf. Optional nach Zeitraum filterbar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dateFrom: { type: 'string', description: 'Startdatum YYYY-MM-DD' },
        dateTo: { type: 'string', description: 'Enddatum YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'list_substitutions',
    description: 'Listet Vertretungsanfragen am Standort auf.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['open', 'filled', 'cancelled', 'all'], description: 'Statusfilter (Standard: all)' },
      },
    },
  },
  {
    name: 'get_employee_details',
    description: 'Ruft vollständige Daten eines einzelnen Mitarbeiters ab, inkl. persönlicher Kontextdaten (HumanContext).',
    input_schema: {
      type: 'object' as const,
      properties: {
        nameOrId: { type: 'string', description: 'Name (Teilstring) oder ID des Mitarbeiters' },
      },
      required: ['nameOrId'],
    },
  },
  // ── WRITE ──
  {
    name: 'assign_shift',
    description: 'Plant einen Mitarbeiter in eine Schicht an einem bestimmten Datum ein. Legt einen neuen Eintrag an oder überschreibt den vorhandenen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeId: { type: 'string', description: 'Mitarbeiter-ID' },
        date: { type: 'string', description: 'Datum YYYY-MM-DD' },
        shiftId: { type: 'string', description: 'Schicht-ID' },
        gruppe: { type: 'string', description: 'Optionale Gruppe/Bereich/Objekt-Zuweisung' },
        funktion: { type: 'string', description: 'Optionale Funktion/Rolle an diesem Tag' },
        startTime: { type: 'string', description: 'Optionale individuelle Startzeit HH:MM' },
        endTime: { type: 'string', description: 'Optionale individuelle Endzeit HH:MM' },
      },
      required: ['employeeId', 'date', 'shiftId'],
    },
  },
  {
    name: 'remove_from_schedule',
    description: 'Entfernt die Schichtzuweisung eines Mitarbeiters an einem Datum (gibt den Tag frei).',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeId: { type: 'string', description: 'Mitarbeiter-ID' },
        date: { type: 'string', description: 'Datum YYYY-MM-DD' },
      },
      required: ['employeeId', 'date'],
    },
  },
  {
    name: 'swap_employees',
    description: 'Tauscht die Schichtzuweisungen zweier Mitarbeiter an einem Datum (oder an verschiedenen Daten).',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeId1: { type: 'string', description: 'ID des ersten Mitarbeiters' },
        date1: { type: 'string', description: 'Datum des ersten Mitarbeiters YYYY-MM-DD' },
        employeeId2: { type: 'string', description: 'ID des zweiten Mitarbeiters' },
        date2: { type: 'string', description: 'Datum des zweiten Mitarbeiters YYYY-MM-DD (Standard = date1)' },
      },
      required: ['employeeId1', 'date1', 'employeeId2'],
    },
  },
  {
    name: 'update_planning_rule',
    description: 'Ändert einen oder mehrere Planungsregel-Werte des Standorts dauerhaft.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxWeeklyHours: { type: 'number', description: 'Maximale Wochenstunden' },
        restHours: { type: 'number', description: 'Mindestruhezeit in Stunden' },
        maxConsecutiveDays: { type: 'number', description: 'Max. aufeinanderfolgende Arbeitstage' },
        fridayLateMax: { type: 'number', description: 'Max. Freitag-Spätdienste pro Monat' },
        mondayEarlyMax: { type: 'number', description: 'Max. Montag-Frühdienste pro Monat' },
        fridayEarlyMax: { type: 'number', description: 'Max. Freitag-Frühdienste pro Monat' },
        weekendMax: { type: 'number', description: 'Max. Wochenenddienste pro Monat' },
      },
    },
  },
  {
    name: 'upsert_planning_unit',
    description: 'Legt eine Planungseinheit (Gruppe, Bereich, Objekt, Tour, Station usw.) an oder aktualisiert sie.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name der Einheit' },
        type: { type: 'string', enum: ['gruppe', 'bereich', 'objekt', 'tour', 'fahrzeug', 'maschine', 'raum', 'station', 'aufgabenblock', 'sonstiges'] },
        description: { type: 'string', description: 'Optionale Beschreibung' },
        capacity: { type: 'number', description: 'Optionale Kapazität/Mindestbesetzung' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'approve_vacation_request',
    description: 'Genehmigt einen Urlaubsantrag und aktualisiert das Urlaubskonto des Mitarbeiters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        requestId: { type: 'string', description: 'ID des Urlaubsantrags' },
      },
      required: ['requestId'],
    },
  },
  {
    name: 'deny_vacation_request',
    description: 'Lehnt einen Urlaubsantrag ab.',
    input_schema: {
      type: 'object' as const,
      properties: {
        requestId: { type: 'string', description: 'ID des Urlaubsantrags' },
      },
      required: ['requestId'],
    },
  },
  {
    name: 'update_employee_field',
    description: 'Aktualisiert ein oder mehrere Felder eines Mitarbeiters (z.B. Gruppe, Stunden, Rolle, Besonderheiten).',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeId: { type: 'string', description: 'Mitarbeiter-ID' },
        gruppe: { type: 'string', description: 'Gruppe/Bereich' },
        bereich: { type: 'string', description: 'Unterbereich' },
        role: { type: 'string', description: 'Rolle/Position' },
        weeklyHours: { type: 'number', description: 'Wochenstunden' },
        workDaysPerWeek: { type: 'number', description: 'Arbeitstage pro Woche' },
        notes: { type: 'string', description: 'Interne Notizen / Persönliche Besonderheiten' },
      },
      required: ['employeeId'],
    },
  },
  {
    name: 'save_location_rule',
    description: 'Speichert eine individuelle Standortregel dauerhaft im Onboarding (wird in Dienstplanung berücksichtigt).',
    input_schema: {
      type: 'object' as const,
      properties: {
        regel: { type: 'string', description: 'Die Regel als Text, z.B. "Vollzeitmitarbeiter beginnen immer um 06:00 Uhr"' },
      },
      required: ['regel'],
    },
  },
]

// ─── Tool-Ausführung ──────────────────────────────────────────────────────────

interface ToolContext {
  locationId: string
  customerId: string
  userEmail: string
}

async function executeToolCall(name: string, input: Record<string, any>, ctx: ToolContext): Promise<any> {
  switch (name) {
    case 'list_employees': {
      const employees = await getEmployeesByLocation(ctx.locationId)
      const filtered = input.filter
        ? employees.filter(e => e.name.toLowerCase().includes((input.filter as string).toLowerCase()))
        : employees

      // Fetch schedule for the next 14 days
      const today = new Date().toISOString().split('T')[0]
      const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const [scheduleEntries, vacationRequests, absences, shifts] = await Promise.all([
        prisma.scheduleEntry.findMany({
          where: { locationId: ctx.locationId, date: { gte: today, lte: in14 } },
        }),
        getVacationRequestsByLocation(ctx.locationId),
        getAbsencesByLocation(ctx.locationId),
        listShiftsByLocation(ctx.locationId),
      ])

      const shiftMap = Object.fromEntries(shifts.map(s => [s.id, { name: s.name, startTime: s.startTime, endTime: s.endTime }]))
      const approvedVacations = vacationRequests.filter(v => v.status === 'approved')
      const activeAbsences = absences.filter(a => a.endDate >= today)

      return {
        count: filtered.length,
        employees: filtered.map(e => {
          // Scheduled dates in next 14 days
          const empSchedule = scheduleEntries
            .filter(s => s.employeeId === e.id)
            .map(s => ({
              date: s.date,
              shiftId: s.shiftId,
              shiftName: shiftMap[s.shiftId]?.name ?? 'Unbekannte Schicht',
              startTime: s.startTime ?? shiftMap[s.shiftId]?.startTime,
              endTime: s.endTime ?? shiftMap[s.shiftId]?.endTime,
              gruppe: s.gruppe,
              funktion: s.funktion,
            }))

          // Vacation: is there an approved vacation covering today or upcoming dates?
          const onVacation = approvedVacations.some(
            v => v.employeeId === e.id && v.startDate <= in14 && v.endDate >= today
          )
          const vacationPeriods = approvedVacations
            .filter(v => v.employeeId === e.id && v.startDate <= in14 && v.endDate >= today)
            .map(v => ({ startDate: v.startDate, endDate: v.endDate }))

          // Absence: is the employee currently absent (sick, etc.)?
          const currentAbsence = activeAbsences.find(
            a => a.employeeId === e.id && a.startDate <= in14 && a.endDate >= today
          )

          return {
            id: e.id,
            name: e.name,
            role: e.role,
            gruppe: e.gruppe,
            bereich: e.bereich,
            weeklyHours: e.weeklyHours,
            workDaysPerWeek: e.workDaysPerWeek,
            workDays: e.workDays,
            dailyTargetHours: e.dailyTargetHours,
            fixedOffDays: e.fixedOffDays,
            employmentType: e.employmentType,
            qualifications: e.qualifications,
            notes: (e as any).notes,
            vacationDaysTotal: e.vacationDaysTotal,
            vacationDaysUsed: e.vacationDaysUsed,
            // Ausfallmanagement context
            scheduledDates: empSchedule,
            onVacation,
            vacationPeriods,
            currentAbsenceType: currentAbsence?.type ?? null,
            currentAbsencePeriod: currentAbsence
              ? { startDate: currentAbsence.startDate, endDate: currentAbsence.endDate }
              : null,
          }
        }),
      }
    }

    case 'get_schedule': {
      const { dateFrom, dateTo } = input as { dateFrom: string; dateTo: string }
      const entries = await prisma.scheduleEntry.findMany({
        where: { locationId: ctx.locationId, date: { gte: dateFrom, lte: dateTo } },
        orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
      })
      const [employees, shifts] = await Promise.all([
        getEmployeesByLocation(ctx.locationId),
        listShiftsByLocation(ctx.locationId),
      ])
      const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]))
      const shiftMap = Object.fromEntries(shifts.map(s => [s.id, { name: s.name, startTime: s.startTime, endTime: s.endTime, type: s.type }]))
      return {
        dateFrom,
        dateTo,
        count: entries.length,
        entries: entries.map(e => ({
          id: e.id,
          employeeId: e.employeeId,
          employeeName: empMap[e.employeeId] ?? 'Unbekannt',
          date: e.date,
          shiftId: e.shiftId,
          shiftName: shiftMap[e.shiftId]?.name ?? 'Unbekannte Schicht',
          startTime: e.startTime ?? shiftMap[e.shiftId]?.startTime,
          endTime: e.endTime ?? shiftMap[e.shiftId]?.endTime,
          gruppe: e.gruppe,
          funktion: e.funktion,
          isSubstitution: e.isSubstitution,
          status: e.status,
        })),
      }
    }

    case 'list_shifts': {
      const shifts = await listShiftsByLocation(ctx.locationId)
      return { count: shifts.length, shifts }
    }

    case 'get_location_config': {
      const [onboarding, planningRules, planningUnits] = await Promise.all([
        prisma.locationOnboarding.findUnique({ where: { locationId: ctx.locationId } }),
        getPlanningRules(ctx.locationId),
        listPlanningUnitsByLocation(ctx.locationId),
      ])
      return { onboarding, planningRules, planningUnits }
    }

    case 'get_organization_config': {
      const onboarding = await prisma.organizationOnboarding.findFirst({
        where: { customerId: ctx.customerId },
      })
      return { onboarding }
    }

    case 'list_vacation_requests': {
      let requests = await getVacationRequestsByLocation(ctx.locationId)
      const { status, dateFrom, dateTo, employeeName } = input as {
        status?: string; dateFrom?: string; dateTo?: string; employeeName?: string
      }
      if (status && status !== 'all') requests = requests.filter(r => r.status === status)
      if (dateFrom) requests = requests.filter(r => r.endDate >= dateFrom)
      if (dateTo) requests = requests.filter(r => r.startDate <= dateTo)
      if (employeeName) requests = requests.filter(r => r.employeeName.toLowerCase().includes(employeeName.toLowerCase()))
      return { count: requests.length, requests }
    }

    case 'list_absences': {
      let absences = await getAbsencesByLocation(ctx.locationId)
      const { dateFrom, dateTo } = input as { dateFrom?: string; dateTo?: string }
      if (dateFrom) absences = absences.filter(a => a.endDate >= dateFrom)
      if (dateTo) absences = absences.filter(a => a.startDate <= dateTo)
      return { count: absences.length, absences }
    }

    case 'list_substitutions': {
      const rows = await prisma.substitutionRequest.findMany({
        where: { locationId: ctx.locationId },
        orderBy: { createdAt: 'desc' },
      })
      const { status } = input as { status?: string }
      const filtered = status && status !== 'all' ? rows.filter(r => r.status === status) : rows
      return { count: filtered.length, substitutions: filtered }
    }

    case 'get_employee_details': {
      const { nameOrId } = input as { nameOrId: string }
      const allEmployees = await getEmployeesByLocation(ctx.locationId)
      const emp = allEmployees.find(
        e => e.id === nameOrId || e.name.toLowerCase().includes(nameOrId.toLowerCase())
      )
      if (!emp) return { error: `Kein Mitarbeiter gefunden: ${nameOrId}` }
      const humanContext = await prisma.employeeHumanContext.findUnique({ where: { employeeId: emp.id } }).catch(() => null)
      return { employee: emp, humanContext }
    }

    case 'assign_shift': {
      const { employeeId, date, shiftId, gruppe, funktion, startTime, endTime } = input as {
        employeeId: string; date: string; shiftId: string
        gruppe?: string; funktion?: string; startTime?: string; endTime?: string
      }
      const results = await applyScheduleEdits(ctx.locationId, [{
        employeeId, date, action: 'assign', shiftId, gruppe, funktion, startTime, endTime,
      }])
      const employees = await getEmployeesByLocation(ctx.locationId)
      const shifts = await listShiftsByLocation(ctx.locationId)
      const empName = employees.find(e => e.id === employeeId)?.name ?? employeeId
      const shiftName = shifts.find(s => s.id === shiftId)?.name ?? shiftId
      return { success: true, message: `${empName} wurde am ${date} in ${shiftName} eingeplant`, entry: results[0] }
    }

    case 'remove_from_schedule': {
      const { employeeId, date } = input as { employeeId: string; date: string }
      await applyScheduleEdits(ctx.locationId, [{ employeeId, date, action: 'remove' }])
      const employees = await getEmployeesByLocation(ctx.locationId)
      const empName = employees.find(e => e.id === employeeId)?.name ?? employeeId
      return { success: true, message: `${empName} wurde am ${date} aus dem Dienstplan entfernt` }
    }

    case 'swap_employees': {
      const { employeeId1, date1, employeeId2, date2 } = input as {
        employeeId1: string; date1: string; employeeId2: string; date2?: string
      }
      const swapDate2 = date2 ?? date1
      const [entry1, entry2] = await Promise.all([
        prisma.scheduleEntry.findFirst({ where: { locationId: ctx.locationId, employeeId: employeeId1, date: date1 } }),
        prisma.scheduleEntry.findFirst({ where: { locationId: ctx.locationId, employeeId: employeeId2, date: swapDate2 } }),
      ])
      if (!entry1 && !entry2) return { error: 'Keine Einträge für beide Mitarbeiter gefunden' }

      const employees = await getEmployeesByLocation(ctx.locationId)
      const emp1Name = employees.find(e => e.id === employeeId1)?.name ?? employeeId1
      const emp2Name = employees.find(e => e.id === employeeId2)?.name ?? employeeId2

      const changes: Parameters<typeof applyScheduleEdits>[1] = []

      if (entry1 && entry2) {
        // Swap both
        changes.push(
          { employeeId: employeeId1, date: date1, action: 'assign', shiftId: entry2.shiftId, gruppe: entry2.gruppe ?? undefined, funktion: entry2.funktion ?? undefined, startTime: entry2.startTime ?? undefined, endTime: entry2.endTime ?? undefined },
          { employeeId: employeeId2, date: swapDate2, action: 'assign', shiftId: entry1.shiftId, gruppe: entry1.gruppe ?? undefined, funktion: entry1.funktion ?? undefined, startTime: entry1.startTime ?? undefined, endTime: entry1.endTime ?? undefined },
        )
      } else if (entry1) {
        // Move entry1 to employee2
        changes.push(
          { employeeId: employeeId1, date: date1, action: 'remove' },
          { employeeId: employeeId2, date: swapDate2, action: 'assign', shiftId: entry1.shiftId, gruppe: entry1.gruppe ?? undefined, funktion: entry1.funktion ?? undefined, startTime: entry1.startTime ?? undefined, endTime: entry1.endTime ?? undefined },
        )
      } else if (entry2) {
        changes.push(
          { employeeId: employeeId2, date: swapDate2, action: 'remove' },
          { employeeId: employeeId1, date: date1, action: 'assign', shiftId: entry2.shiftId, gruppe: entry2.gruppe ?? undefined, funktion: entry2.funktion ?? undefined, startTime: entry2.startTime ?? undefined, endTime: entry2.endTime ?? undefined },
        )
      }

      await applyScheduleEdits(ctx.locationId, changes)
      return { success: true, message: `Schichten von ${emp1Name} und ${emp2Name} wurden getauscht` }
    }

    case 'update_planning_rule': {
      const allowed = ['maxWeeklyHours', 'restHours', 'maxConsecutiveDays', 'fridayLateMax', 'mondayEarlyMax', 'fridayEarlyMax', 'weekendMax']
      const updates: Record<string, any> = {}
      for (const key of allowed) {
        if (input[key] !== undefined) updates[key] = input[key]
      }
      if (Object.keys(updates).length === 0) return { error: 'Keine Regeländerung angegeben' }
      const result = await upsertPlanningRules(ctx.locationId, updates)
      return { success: true, message: 'Planungsregel gespeichert', rules: result }
    }

    case 'upsert_planning_unit': {
      const { name, type, description, capacity } = input as { name: string; type: string; description?: string; capacity?: number }
      const unit = await upsertPlanningUnit(ctx.locationId, { name, type, description, capacity })
      return { success: true, message: `Planungseinheit "${name}" gespeichert`, unit }
    }

    case 'approve_vacation_request': {
      const { requestId } = input as { requestId: string }
      const result = await setVacationRequestStatus(requestId, 'approved', ctx.userEmail)
      if (!result) return { error: `Urlaubsantrag ${requestId} nicht gefunden` }
      return { success: true, message: `Urlaubsantrag von ${result.employeeName} genehmigt (${result.startDate} – ${result.endDate})`, request: result }
    }

    case 'deny_vacation_request': {
      const { requestId } = input as { requestId: string }
      const result = await setVacationRequestStatus(requestId, 'denied', ctx.userEmail)
      if (!result) return { error: `Urlaubsantrag ${requestId} nicht gefunden` }
      return { success: true, message: `Urlaubsantrag von ${result.employeeName} abgelehnt`, request: result }
    }

    case 'update_employee_field': {
      const { employeeId, ...fields } = input as { employeeId: string; [key: string]: any }
      const allowed = ['gruppe', 'bereich', 'role', 'weeklyHours', 'workDaysPerWeek', 'notes']
      const updates: Record<string, any> = {}
      for (const key of allowed) {
        if (fields[key] !== undefined) updates[key] = fields[key]
      }
      if (Object.keys(updates).length === 0) return { error: 'Keine Änderung angegeben' }
      const result = await updateEmployee(employeeId, updates)
      if (!result) return { error: `Mitarbeiter ${employeeId} nicht gefunden` }
      return { success: true, message: `Mitarbeiterdaten von ${result.name} aktualisiert`, employee: result }
    }

    case 'save_location_rule': {
      const { regel } = input as { regel: string }
      const existing = await prisma.locationOnboarding.findUnique({ where: { locationId: ctx.locationId } })
      const currentRules: string[] = (existing?.individuelleRegeln as string[] | null) ?? []
      if (!currentRules.includes(regel)) {
        await prisma.locationOnboarding.upsert({
          where: { locationId: ctx.locationId },
          create: { locationId: ctx.locationId, individuelleRegeln: [...currentRules, regel] },
          update: { individuelleRegeln: [...currentRules, regel] },
        })
      }
      return { success: true, message: `Regel dauerhaft gespeichert: "${regel}"` }
    }

    case 'find_substitutes': {
      const { date, startTime, endTime, qualification, gruppe } = input as {
        date: string; startTime: string; endTime: string; qualification?: string; gruppe?: string
      }

      const [employees, scheduleEntries, vacationRequests, absences, shifts] = await Promise.all([
        getEmployeesByLocation(ctx.locationId),
        prisma.scheduleEntry.findMany({ where: { locationId: ctx.locationId, date } }),
        getVacationRequestsByLocation(ctx.locationId),
        getAbsencesByLocation(ctx.locationId),
        listShiftsByLocation(ctx.locationId),
      ])

      const shiftMap = Object.fromEntries(shifts.map(s => [s.id, { name: s.name, startTime: s.startTime, endTime: s.endTime }]))
      const approvedVacations = vacationRequests.filter(v => v.status === 'approved')

      // Helper: parse HH:MM to minutes since midnight
      const toMinutes = (t: string): number => {
        const [h, m] = t.split(':').map(Number)
        return (h ?? 0) * 60 + (m ?? 0)
      }

      // Helper: calculate shift duration in hours
      const shiftHours = (start: string, end: string): number => {
        const diff = toMinutes(end) - toMinutes(start)
        return (diff < 0 ? diff + 24 * 60 : diff) / 60
      }

      const neededHours = shiftHours(startTime, endTime)

      // Calculate scheduled hours this week for each employee
      const weekStart = new Date(date)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekStartStr = weekStart.toISOString().split('T')[0]
      const weekEndStr = weekEnd.toISOString().split('T')[0]

      const weekEntries = await prisma.scheduleEntry.findMany({
        where: { locationId: ctx.locationId, date: { gte: weekStartStr, lte: weekEndStr } },
      })

      // Calculate already-scheduled hours per employee this week
      const weekHoursMap: Record<string, number> = {}
      for (const entry of weekEntries) {
        const s = shiftMap[entry.shiftId]
        const start = entry.startTime ?? s?.startTime ?? '00:00'
        const end = entry.endTime ?? s?.endTime ?? '00:00'
        const h = shiftHours(start, end)
        weekHoursMap[entry.employeeId] = (weekHoursMap[entry.employeeId] ?? 0) + h
      }

      interface Candidate {
        employeeId: string
        name: string
        availability: 'free' | 'has_shift' | 'unavailable'
        matchReasons: string[]
        warnings: string[]
        qualificationMatch: boolean
        gruppeMatch: boolean
        scheduledShiftThatDay: { shiftName: string; startTime: string; endTime: string } | null
        currentWeekHours: number
        weeklyHoursLimit: number
        wouldExceedLimit: boolean
        score: number
      }

      const candidates: Candidate[] = []

      for (const emp of employees) {
        const matchReasons: string[] = []
        const warnings: string[] = []

        // Check qualification match
        const qualMatch = !qualification || (emp.qualifications ?? []).includes(qualification)
        if (qualification) {
          if (qualMatch) matchReasons.push(`Hat erforderliche Qualifikation: ${qualification}`)
          else warnings.push(`Fehlt Qualifikation: ${qualification}`)
        }

        // Check gruppe match
        const gruppeMatch = !gruppe || emp.gruppe === gruppe
        if (gruppe) {
          if (gruppeMatch) matchReasons.push(`Arbeitet in Gruppe/Bereich: ${gruppe}`)
          else warnings.push(`Andere Gruppe: ${emp.gruppe ?? 'keine'}`)
        }

        // Check absence (sick, special leave, etc.)
        const isAbsent = absences.some(
          a => a.employeeId === emp.id && a.startDate <= date && a.endDate >= date
        )
        if (isAbsent) {
          const abs = absences.find(a => a.employeeId === emp.id && a.startDate <= date && a.endDate >= date)
          candidates.push({
            employeeId: emp.id,
            name: emp.name,
            availability: 'unavailable',
            matchReasons: [],
            warnings: [`Abwesend (${abs?.type ?? 'Abwesenheit'}) bis ${abs?.endDate}`],
            qualificationMatch: qualMatch,
            gruppeMatch,
            scheduledShiftThatDay: null,
            currentWeekHours: weekHoursMap[emp.id] ?? 0,
            weeklyHoursLimit: emp.weeklyHours,
            wouldExceedLimit: false,
            score: -100,
          })
          continue
        }

        // Check vacation
        const onVacation = approvedVacations.some(
          v => v.employeeId === emp.id && v.startDate <= date && v.endDate >= date
        )
        if (onVacation) {
          const vac = approvedVacations.find(v => v.employeeId === emp.id && v.startDate <= date && v.endDate >= date)
          candidates.push({
            employeeId: emp.id,
            name: emp.name,
            availability: 'unavailable',
            matchReasons: [],
            warnings: [`Im genehmigten Urlaub bis ${vac?.endDate}`],
            qualificationMatch: qualMatch,
            gruppeMatch,
            scheduledShiftThatDay: null,
            currentWeekHours: weekHoursMap[emp.id] ?? 0,
            weeklyHoursLimit: emp.weeklyHours,
            wouldExceedLimit: false,
            score: -100,
          })
          continue
        }

        // Check existing shift that day
        const existingEntry = scheduleEntries.find(s => s.employeeId === emp.id)
        let availability: 'free' | 'has_shift' = 'free'
        let scheduledShiftThatDay: Candidate['scheduledShiftThatDay'] = null

        if (existingEntry) {
          availability = 'has_shift'
          const s = shiftMap[existingEntry.shiftId]
          scheduledShiftThatDay = {
            shiftName: s?.name ?? 'Unbekannte Schicht',
            startTime: existingEntry.startTime ?? s?.startTime ?? '',
            endTime: existingEntry.endTime ?? s?.endTime ?? '',
          }
          matchReasons.push(`Hat bereits Dienst (${scheduledShiftThatDay.shiftName} ${scheduledShiftThatDay.startTime}–${scheduledShiftThatDay.endTime}) – Umplanung nötig`)
        } else {
          matchReasons.push('Hat an diesem Tag keinen Dienst – sofort verfügbar')
        }

        // Check weekly hours
        const currentWeekHours = weekHoursMap[emp.id] ?? 0
        const wouldExceedLimit = (currentWeekHours + neededHours) > emp.weeklyHours
        if (wouldExceedLimit) {
          warnings.push(`Würde Wochenstunden überschreiten: ${currentWeekHours.toFixed(1)}h bereits geplant + ${neededHours.toFixed(1)}h = ${(currentWeekHours + neededHours).toFixed(1)}h > ${emp.weeklyHours}h Limit`)
        } else {
          matchReasons.push(`Wochenstunden OK: ${currentWeekHours.toFixed(1)}h + ${neededHours.toFixed(1)}h = ${(currentWeekHours + neededHours).toFixed(1)}h von ${emp.weeklyHours}h`)
        }

        // Fixed off-day check
        const dayName = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][new Date(date).getDay()]
        const isFixedOffDay = (emp.fixedOffDays ?? []).includes(dayName) || (emp.fixedOffDays ?? []).includes(date)
        if (isFixedOffDay) {
          warnings.push(`${dayName} ist ein fester freier Tag für diesen Mitarbeiter`)
        }

        // Score: free > has_shift, qual/gruppe match boosts, exceed penalizes
        let score = 0
        if (availability === 'free') score += 50
        else score += 10
        if (qualMatch && qualification) score += 20
        if (gruppeMatch && gruppe) score += 15
        if (wouldExceedLimit) score -= 30
        if (isFixedOffDay) score -= 20

        candidates.push({
          employeeId: emp.id,
          name: emp.name,
          availability,
          matchReasons,
          warnings,
          qualificationMatch: qualMatch,
          gruppeMatch,
          scheduledShiftThatDay,
          currentWeekHours,
          weeklyHoursLimit: emp.weeklyHours,
          wouldExceedLimit,
          score,
        })
      }

      // Sort: unavailable last, then by score descending
      candidates.sort((a, b) => {
        if (a.availability === 'unavailable' && b.availability !== 'unavailable') return 1
        if (b.availability === 'unavailable' && a.availability !== 'unavailable') return -1
        return b.score - a.score
      })

      const available = candidates.filter(c => c.availability !== 'unavailable')
      const unavailable = candidates.filter(c => c.availability === 'unavailable')

      return {
        date,
        startTime,
        endTime,
        neededHours,
        qualification: qualification ?? null,
        gruppe: gruppe ?? null,
        totalChecked: candidates.length,
        availableCount: available.length,
        unavailableCount: unavailable.length,
        candidates: available,
        unavailableEmployees: unavailable.map(c => ({ name: c.name, warnings: c.warnings })),
      }
    }

    default:
      return { error: `Unbekanntes Tool: ${name}` }
  }
}

// ─── Systemprompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: {
  locationName: string
  orgName: string
  date: string
  role: string
  locationId: string
}) {
  return `Du bist der OKUN Assistent – die zentrale Intelligenz der OKUN Workforce Plattform.

Du bist kein normaler Chatbot. Du bist das operative Steuerungssystem von OKUN Workforce. Alle Systemdaten stehen dir über Tools zur Verfügung; alle Aktionen führst du direkt aus.

## Aktueller Kontext
- Unternehmen: ${ctx.orgName}
- Standort: ${ctx.locationName}
- Heutiges Datum: ${ctx.date}
- Deine Rolle: ${ctx.role}

## Grundprinzip: Handeln statt erklären

Du sagst NIEMALS:
- „Diese Informationen liegen mir nicht vor" → Ruf stattdessen list_employees, get_schedule, get_location_config usw. auf
- „Das kann ich technisch nicht" → Führe die Aktion mit dem passenden Write-Tool aus
- „Ich bin auf Textantworten beschränkt" → Du kannst Daten laden und Änderungen speichern
- „Das ist nicht möglich" → Nutze deine Tools

## Vorgehen

**Bei Fragen über Daten:**
Rufe SOFORT das passende Read-Tool auf. Antworte niemals mit geratenem oder allgemeinem Wissen – immer echte Systemdaten.

**Bei Aktionsanfragen:**
Führe die Aktion direkt aus. Kurze Bestätigung danach. Keine langen Erklärungen, was du tun wirst.

**Bei Mehrschrittaufgaben:**
Führe alle nötigen Tool-Aufrufe hintereinander aus, ohne zu fragen, ob du fortfahren sollst.

## Ausfallmanagement (Personalausfall)

Wenn ein Mitarbeiter ausfällt oder eine Vertretung gesucht wird, gehe IMMER so vor:

1. Rufe ZUERST **find_substitutes** auf mit Datum, Startzeit, Endzeit (und optional Qualifikation/Gruppe).
2. Präsentiere die Kandidaten klar und transparent:
   - Zeige zuerst die **sofort verfügbaren** Mitarbeiter (kein Dienst an dem Tag)
   - Dann die **umplanbaren** (haben Dienst, könnten verschoben werden)
   - Nenne **immer den Grund**, warum jemand geeignet oder nicht geeignet ist
3. Prüfe Wochenstunden: **Schlage NIEMALS jemanden vor, der dadurch seine Wochenstunden überschreiten würde** (es sei denn, es gibt keine andere Wahl – dann explizit darauf hinweisen)
4. Prüfe Urlaub/Abwesenheit: **Schlage NIEMALS jemanden vor, der im genehmigten Urlaub oder abwesend ist**
5. Wenn du eine Schicht umplanst (assign_shift), rufe danach remove_from_schedule für den ursprünglichen Mitarbeiter auf – oder nutze swap_employees für einen Tausch

**Beispiel-Ablauf Ausfallmanagement:**
Nutzer: „Maria ist heute krank, wer kann einspringen? Frühdienst 06:00–14:00"
→ find_substitutes (date=heute, startTime=06:00, endTime=14:00) aufrufen
→ Ergebnis auflisten mit klaren Begründungen
→ Auf Wunsch direkt assign_shift ausführen

## Beispiele

Nutzer: „Wie viele Mitarbeiter haben wir?"
→ list_employees aufrufen → Zahl nennen + Kurzübersicht

Nutzer: „Plan Heike am Donnerstag in den Frühdienst ein"
→ list_employees (Heike finden) → list_shifts (Frühdienst finden) → assign_shift → bestätigen

Nutzer: „Tausche Anna und Tom am Freitag"
→ list_employees (IDs finden) → swap_employees ausführen → bestätigen

Nutzer: „Speichere: Vollzeitmitarbeiter beginnen immer um 06:00 Uhr"
→ save_location_rule aufrufen → bestätigen

Nutzer: „Wer hat diese Woche Urlaub?"
→ list_vacation_requests (status=approved, dateFrom/dateTo diese Woche) → auflisten

Nutzer: „Klaus ist heute krank, wer kann den Spätdienst 14:00–22:00 übernehmen?"
→ find_substitutes (date=heute, startTime=14:00, endTime=22:00) → Kandidaten mit Begründung vorstellen

## Stil

- Antworte auf Deutsch
- Kurz und direkt – keine Schachtelsätze
- Bestätigungen nach Aktionen: 1–2 Sätze reichen
- Bei Fehlern: erkläre was nicht funktioniert hat und was als Alternative möglich ist
- Bei Ausfallmanagement: immer transparent begründen, warum jemand vorgeschlagen oder ausgeschlossen wird`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = requireRole(req, ['admin', 'company', 'okun'])
  if (session instanceof NextResponse) return session

  let body: { messages: Anthropic.Messages.MessageParam[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const locationId = await resolveLocationId(session)
  if (!locationId && session.role !== 'okun') {
    return NextResponse.json({ error: 'Kein Standort diesem Account zugeordnet' }, { status: 400 })
  }

  const customerId = await resolveCustomerId(session)
  const effectiveLocationId = locationId ?? ''
  const effectiveCustomerId = customerId ?? ''

  const [location, orgOnboarding] = await Promise.all([
    effectiveLocationId ? prisma.location.findUnique({ where: { id: effectiveLocationId } }) : Promise.resolve(null),
    effectiveCustomerId ? prisma.organizationOnboarding.findFirst({ where: { customerId: effectiveCustomerId } }) : Promise.resolve(null),
  ])

  const systemPrompt = buildSystemPrompt({
    locationName: location?.name ?? 'Unbekannter Standort',
    orgName: (orgOnboarding?.traegerName as string | null) ?? 'Unbekanntes Unternehmen',
    date: new Date().toISOString().split('T')[0],
    role: session.role,
    locationId: effectiveLocationId,
  })

  const ctx: ToolContext = {
    locationId: effectiveLocationId,
    customerId: effectiveCustomerId,
    userEmail: session.email,
  }

  // Starte mit den übergebenen Nachrichten
  const messages: Anthropic.Messages.MessageParam[] = [...body.messages]
  const actions: { tool: string; summary: string }[] = []

  // Agentischer Loop – max. 12 Iterationen
  let iterations = 0
  let finalReply = ''

  while (iterations < 12) {
    iterations++

    let response: Anthropic.Messages.Message
    try {
      response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: TOOLS,
      })
    } catch (err) {
      console.error('[assistant] Claude API error:', err)
      return NextResponse.json({ error: 'KI-Fehler', details: String(err) }, { status: 500 })
    }

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text') as Anthropic.Messages.TextBlock | undefined
      finalReply = textBlock?.text ?? ''
      messages.push({ role: 'assistant', content: response.content })
      break
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        let result: any
        let isError = false

        try {
          result = await executeToolCall(block.name, block.input as Record<string, any>, ctx)
          actions.push({ tool: block.name, summary: (result as any).message ?? block.name })
        } catch (err) {
          console.error(`[assistant] Tool ${block.name} error:`, err)
          result = { error: String(err) }
          isError = true
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result, null, 2),
          is_error: isError,
        })
      }

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Unerwartetes stop_reason – trotzdem Text zurückgeben
    const textBlock = response.content.find(b => b.type === 'text') as Anthropic.Messages.TextBlock | undefined
    finalReply = textBlock?.text ?? ''
    messages.push({ role: 'assistant', content: response.content })
    break
  }

  return NextResponse.json({ reply: finalReply, actions, messages })
}
