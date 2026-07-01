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
    description: 'Listet alle Mitarbeiter des Standorts mit vollständigen Profildaten (Stunden, Gruppen, Rollen, Qualifikationen, Arbeitszeiten, Besonderheiten usw.) auf.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', description: 'Optionaler Namensfilter (Teilstring)' },
      },
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
      return {
        count: filtered.length,
        employees: filtered.map(e => ({
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
        })),
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

## Stil

- Antworte auf Deutsch
- Kurz und direkt – keine Schachtelsätze
- Bestätigungen nach Aktionen: 1–2 Sätze reichen
- Bei Fehlern: erkläre was nicht funktioniert hat und was als Alternative möglich ist`
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
