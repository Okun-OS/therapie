import type { Location, Employee, Shift, ScheduleEntry, TimeLog, VacationRequest, SwapRequest, WishSubmission } from './types'

export const LOCATIONS: Location[] = [
  { id: 'loc1', name: 'Kita Sonnenschein', address: 'Berliner Str. 12', city: 'Berlin', employeeCount: 8, adminId: 'adm1', active: true },
  { id: 'loc2', name: 'Kita Regenbogen', address: 'Münchener Str. 45', city: 'München', employeeCount: 7, adminId: 'adm2', active: true },
  { id: 'loc3', name: 'Kita Sternchen', address: 'Hamburger Allee 8', city: 'Hamburg', employeeCount: 6, adminId: 'adm3', active: true },
]

export const SHIFTS: Shift[] = [
  { id: 's1', name: 'Frühdienst', type: 'early', startTime: '06:00', endTime: '14:00', color: '#1D4ED8', bgColor: '#DBEAFE', minStaff: 2, locationId: 'loc1' },
  { id: 's2', name: 'Spätdienst', type: 'late', startTime: '14:00', endTime: '22:00', color: '#C2410C', bgColor: '#FFEDD5', minStaff: 2, locationId: 'loc1' },
  { id: 's3', name: 'Mitteldienst', type: 'mid', startTime: '09:00', endTime: '17:00', color: '#15803D', bgColor: '#DCFCE7', minStaff: 1, locationId: 'loc1' },
  { id: 's4', name: 'Frühdienst', type: 'early', startTime: '06:30', endTime: '14:30', color: '#1D4ED8', bgColor: '#DBEAFE', minStaff: 2, locationId: 'loc2' },
  { id: 's5', name: 'Spätdienst', type: 'late', startTime: '14:00', endTime: '22:00', color: '#C2410C', bgColor: '#FFEDD5', minStaff: 2, locationId: 'loc2' },
  { id: 's6', name: 'Mitteldienst', type: 'mid', startTime: '09:00', endTime: '17:00', color: '#15803D', bgColor: '#DCFCE7', minStaff: 1, locationId: 'loc2' },
  { id: 's7', name: 'Frühdienst', type: 'early', startTime: '06:00', endTime: '14:00', color: '#1D4ED8', bgColor: '#DBEAFE', minStaff: 2, locationId: 'loc3' },
  { id: 's8', name: 'Spätdienst', type: 'late', startTime: '14:00', endTime: '22:00', color: '#C2410C', bgColor: '#FFEDD5', minStaff: 2, locationId: 'loc3' },
]

export const EMPLOYEES: Employee[] = [
  // Kita Sonnenschein (loc1)
  { id: 'emp1', name: 'Maria Schmidt', email: 'employee@demo.de', role: 'employee', locationId: 'loc1', weeklyHours: 38, position: 'Erzieherin', hoursBalance: 4.5, vacationDaysTotal: 30, vacationDaysUsed: 8, active: true, joinedAt: '2021-03-01', preferences: { preferredShifts: ['early', 'mid'], unavailableDays: [0, 6], noEarlyAfterLate: true, notes: 'Bevorzugt Frühschichten' } },
  { id: 'emp2', name: 'Klaus Becker', email: 'k.becker@demo.de', role: 'employee', locationId: 'loc1', weeklyHours: 32, position: 'Erzieher', hoursBalance: -2.0, vacationDaysTotal: 30, vacationDaysUsed: 12, active: true, joinedAt: '2019-09-15', preferences: { preferredShifts: ['late'], unavailableDays: [1], noEarlyAfterLate: true } },
  { id: 'emp3', name: 'Sarah Hofmann', email: 's.hofmann@demo.de', role: 'employee', locationId: 'loc1', weeklyHours: 20, position: 'Kinderpflegerin', hoursBalance: 1.0, vacationDaysTotal: 24, vacationDaysUsed: 5, active: true, joinedAt: '2022-01-10' },
  { id: 'emp4', name: 'Jan Peters', email: 'j.peters@demo.de', role: 'employee', locationId: 'loc1', weeklyHours: 38, position: 'Erzieher', hoursBalance: 0.0, vacationDaysTotal: 30, vacationDaysUsed: 15, active: true, joinedAt: '2018-06-20' },
  // Admin of loc1
  { id: 'adm1', name: 'Thomas Müller', email: 'admin@demo.de', role: 'admin', locationId: 'loc1', weeklyHours: 40, position: 'Teamleitung', hoursBalance: 2.0, vacationDaysTotal: 30, vacationDaysUsed: 10, active: true, joinedAt: '2017-01-01' },
  // Kita Regenbogen (loc2)
  { id: 'emp5', name: 'Anna Weber', email: 'a.weber@demo.de', role: 'employee', locationId: 'loc2', weeklyHours: 38, position: 'Erzieherin', hoursBalance: 3.0, vacationDaysTotal: 30, vacationDaysUsed: 7, active: true, joinedAt: '2020-08-01' },
  { id: 'emp6', name: 'Peter Wagner', email: 'p.wagner@demo.de', role: 'employee', locationId: 'loc2', weeklyHours: 32, position: 'Erzieher', hoursBalance: -1.5, vacationDaysTotal: 30, vacationDaysUsed: 20, active: true, joinedAt: '2016-04-01' },
  { id: 'emp7', name: 'Lisa Fischer', email: 'l.fischer@demo.de', role: 'employee', locationId: 'loc2', weeklyHours: 25, position: 'Kinderpflegerin', hoursBalance: 0.5, vacationDaysTotal: 24, vacationDaysUsed: 3, active: true, joinedAt: '2023-02-15' },
  { id: 'adm2', name: 'Sandra Wolf', email: 's.wolf@demo.de', role: 'admin', locationId: 'loc2', weeklyHours: 40, position: 'Teamleitung', hoursBalance: 1.0, vacationDaysTotal: 30, vacationDaysUsed: 9, active: true, joinedAt: '2018-03-01' },
  // Kita Sternchen (loc3)
  { id: 'emp8', name: 'Michael Bauer', email: 'm.bauer@demo.de', role: 'employee', locationId: 'loc3', weeklyHours: 38, position: 'Erzieher', hoursBalance: 2.5, vacationDaysTotal: 30, vacationDaysUsed: 11, active: true, joinedAt: '2019-11-01' },
  { id: 'emp9', name: 'Julia Koch', email: 'j.koch@demo.de', role: 'employee', locationId: 'loc3', weeklyHours: 38, position: 'Erzieherin', hoursBalance: -0.5, vacationDaysTotal: 30, vacationDaysUsed: 14, active: true, joinedAt: '2020-02-01' },
  { id: 'emp10', name: 'Stefan Schäfer', email: 's.schaefer@demo.de', role: 'employee', locationId: 'loc3', weeklyHours: 20, position: 'Kinderpfleger', hoursBalance: 0.0, vacationDaysTotal: 24, vacationDaysUsed: 2, active: true, joinedAt: '2023-09-01' },
  { id: 'adm3', name: 'Nina Braun', email: 'n.braun@demo.de', role: 'admin', locationId: 'loc3', weeklyHours: 40, position: 'Teamleitung', hoursBalance: 0.5, vacationDaysTotal: 30, vacationDaysUsed: 6, active: true, joinedAt: '2019-06-01' },
  // Company user
  { id: 'cmp1', name: 'BrightCare GmbH', email: 'company@demo.de', role: 'company', locationId: undefined, weeklyHours: 40, position: 'Geschäftsführung', hoursBalance: 0, vacationDaysTotal: 30, vacationDaysUsed: 0, active: true, joinedAt: '2015-01-01' },
]

// Current week: Apr 28 - May 4, 2026 (Mon-Sun)
export const SCHEDULE_ENTRIES: ScheduleEntry[] = [
  // Maria Schmidt (emp1) - current week
  { id: 'se1', employeeId: 'emp1', shiftId: 's1', date: '2026-04-28', locationId: 'loc1', status: 'confirmed' },
  { id: 'se2', employeeId: 'emp1', shiftId: 's3', date: '2026-04-29', locationId: 'loc1', status: 'confirmed' },
  { id: 'se3', employeeId: 'emp1', shiftId: 's1', date: '2026-04-30', locationId: 'loc1', status: 'confirmed' },
  { id: 'se4', employeeId: 'emp1', shiftId: 's1', date: '2026-05-02', locationId: 'loc1', status: 'confirmed' },
  // Klaus Becker (emp2)
  { id: 'se5', employeeId: 'emp2', shiftId: 's2', date: '2026-04-28', locationId: 'loc1', status: 'confirmed' },
  { id: 'se6', employeeId: 'emp2', shiftId: 's2', date: '2026-04-29', locationId: 'loc1', status: 'confirmed' },
  { id: 'se7', employeeId: 'emp2', shiftId: 's1', date: '2026-05-01', locationId: 'loc1', status: 'confirmed' },
  { id: 'se8', employeeId: 'emp2', shiftId: 's2', date: '2026-05-03', locationId: 'loc1', status: 'confirmed' },
  // Sarah Hofmann (emp3)
  { id: 'se9', employeeId: 'emp3', shiftId: 's3', date: '2026-04-28', locationId: 'loc1', status: 'confirmed' },
  { id: 'se10', employeeId: 'emp3', shiftId: 's3', date: '2026-04-30', locationId: 'loc1', status: 'confirmed' },
  // Jan Peters (emp4)
  { id: 'se11', employeeId: 'emp4', shiftId: 's1', date: '2026-04-28', locationId: 'loc1', status: 'confirmed' },
  { id: 'se12', employeeId: 'emp4', shiftId: 's2', date: '2026-04-30', locationId: 'loc1', status: 'confirmed' },
  { id: 'se13', employeeId: 'emp4', shiftId: 's1', date: '2026-05-01', locationId: 'loc1', status: 'confirmed' },
  { id: 'se14', employeeId: 'emp4', shiftId: 's2', date: '2026-05-02', locationId: 'loc1', status: 'confirmed' },
  // Next week entries for Maria
  { id: 'se15', employeeId: 'emp1', shiftId: 's1', date: '2026-05-05', locationId: 'loc1', status: 'planned' },
  { id: 'se16', employeeId: 'emp1', shiftId: 's3', date: '2026-05-06', locationId: 'loc1', status: 'planned' },
  { id: 'se17', employeeId: 'emp1', shiftId: 's1', date: '2026-05-07', locationId: 'loc1', status: 'planned' },
  { id: 'se18', employeeId: 'emp1', shiftId: 's1', date: '2026-05-08', locationId: 'loc1', status: 'planned' },
  { id: 'se19', employeeId: 'emp1', shiftId: 's3', date: '2026-05-09', locationId: 'loc1', status: 'planned' },
]

// Time logs for Maria Schmidt (last 2 weeks)
export const TIME_LOGS: TimeLog[] = [
  { id: 'tl1', employeeId: 'emp1', date: '2026-04-14', clockIn: '06:02', clockOut: '14:05', totalMinutes: 483, locationId: 'loc1' },
  { id: 'tl2', employeeId: 'emp1', date: '2026-04-15', clockIn: '08:58', clockOut: '17:03', totalMinutes: 485, locationId: 'loc1' },
  { id: 'tl3', employeeId: 'emp1', date: '2026-04-16', clockIn: '06:01', clockOut: '14:00', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl4', employeeId: 'emp1', date: '2026-04-22', clockIn: '06:00', clockOut: '14:08', totalMinutes: 488, locationId: 'loc1' },
  { id: 'tl5', employeeId: 'emp1', date: '2026-04-23', clockIn: '09:02', clockOut: '17:00', totalMinutes: 478, locationId: 'loc1' },
  { id: 'tl6', employeeId: 'emp1', date: '2026-04-24', clockIn: '06:00', clockOut: '14:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl7', employeeId: 'emp1', date: '2026-04-28', clockIn: '06:03', clockOut: '14:02', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl8', employeeId: 'emp1', date: '2026-04-29', clockIn: '09:01', clockOut: '17:05', totalMinutes: 484, locationId: 'loc1' },
  // Klaus
  { id: 'tl9', employeeId: 'emp2', date: '2026-04-28', clockIn: '13:58', clockOut: '22:05', totalMinutes: 487, locationId: 'loc1' },
  { id: 'tl10', employeeId: 'emp2', date: '2026-04-29', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
]

export const VACATION_REQUESTS: VacationRequest[] = [
  { id: 'vr1', employeeId: 'emp1', employeeName: 'Maria Schmidt', locationId: 'loc1', locationName: 'Kita Sonnenschein', startDate: '2026-05-20', endDate: '2026-05-29', days: 10, reason: 'Familienurlaub', status: 'pending', submittedAt: '2026-04-15' },
  { id: 'vr2', employeeId: 'emp2', employeeName: 'Klaus Becker', locationId: 'loc1', locationName: 'Kita Sonnenschein', startDate: '2026-06-01', endDate: '2026-06-14', days: 14, reason: 'Erholung', status: 'approved', submittedAt: '2026-04-10', respondedAt: '2026-04-12', respondedBy: 'Thomas Müller' },
  { id: 'vr3', employeeId: 'emp3', employeeName: 'Sarah Hofmann', locationId: 'loc1', locationName: 'Kita Sonnenschein', startDate: '2026-05-04', endDate: '2026-05-08', days: 5, reason: 'Arzttermine', status: 'denied', submittedAt: '2026-04-20', respondedAt: '2026-04-22', respondedBy: 'Thomas Müller' },
  { id: 'vr4', employeeId: 'emp4', employeeName: 'Jan Peters', locationId: 'loc1', locationName: 'Kita Sonnenschein', startDate: '2026-07-14', endDate: '2026-07-25', days: 12, reason: 'Sommerurlaub', status: 'pending', submittedAt: '2026-04-25' },
  { id: 'vr5', employeeId: 'emp5', employeeName: 'Anna Weber', locationId: 'loc2', locationName: 'Kita Regenbogen', startDate: '2026-05-11', endDate: '2026-05-15', days: 5, reason: 'Familienfeier', status: 'approved', submittedAt: '2026-04-18', respondedAt: '2026-04-19', respondedBy: 'Sandra Wolf' },
  { id: 'vr6', employeeId: 'emp6', employeeName: 'Peter Wagner', locationId: 'loc2', locationName: 'Kita Regenbogen', startDate: '2026-06-15', endDate: '2026-06-26', days: 12, reason: 'Urlaub', status: 'pending', submittedAt: '2026-04-24' },
  { id: 'vr7', employeeId: 'emp8', employeeName: 'Michael Bauer', locationId: 'loc3', locationName: 'Kita Sternchen', startDate: '2026-05-18', endDate: '2026-05-22', days: 5, reason: 'Umzug', status: 'pending', submittedAt: '2026-04-26' },
]

export function getEmployeeById(id: string): Employee | undefined {
  return EMPLOYEES.find(e => e.id === id)
}

export function getLocationById(id: string): Location | undefined {
  return LOCATIONS.find(l => l.id === id)
}

export function getShiftById(id: string): Shift | undefined {
  return SHIFTS.find(s => s.id === id)
}

export function getEmployeesByLocation(locationId: string): Employee[] {
  return EMPLOYEES.filter(e => e.locationId === locationId && e.active)
}

export function getScheduleByEmployee(employeeId: string): ScheduleEntry[] {
  return SCHEDULE_ENTRIES.filter(s => s.employeeId === employeeId)
}

export function getScheduleByLocationAndWeek(locationId: string, weekStart: string): ScheduleEntry[] {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return SCHEDULE_ENTRIES.filter(s => {
    const d = new Date(s.date + 'T00:00:00')
    return s.locationId === locationId && d >= start && d <= end
  })
}

export function getTimeLogsByEmployee(employeeId: string): TimeLog[] {
  return TIME_LOGS.filter(t => t.employeeId === employeeId).sort((a, b) => b.date.localeCompare(a.date))
}

export function getVacationRequestsByLocation(locationId: string): VacationRequest[] {
  return VACATION_REQUESTS.filter(v => v.locationId === locationId)
}

// ─── Historical Schedule (last 4 weeks = Apr 7–26) for fairness calculation ──

export const HISTORICAL_ENTRIES: ScheduleEntry[] = [
  // Week Apr 7–11 ---------------------------------------------------------
  // Maria: 3× Früh, 1× Mitte
  { id: 'h1', employeeId: 'emp1', shiftId: 's1', date: '2026-04-07', locationId: 'loc1', status: 'confirmed' },
  { id: 'h2', employeeId: 'emp1', shiftId: 's1', date: '2026-04-08', locationId: 'loc1', status: 'confirmed' },
  { id: 'h3', employeeId: 'emp1', shiftId: 's3', date: '2026-04-09', locationId: 'loc1', status: 'confirmed' },
  { id: 'h4', employeeId: 'emp1', shiftId: 's1', date: '2026-04-11', locationId: 'loc1', status: 'confirmed' },
  // Klaus: 3× Spät
  { id: 'h5', employeeId: 'emp2', shiftId: 's2', date: '2026-04-07', locationId: 'loc1', status: 'confirmed' },
  { id: 'h6', employeeId: 'emp2', shiftId: 's2', date: '2026-04-09', locationId: 'loc1', status: 'confirmed' },
  { id: 'h7', employeeId: 'emp2', shiftId: 's2', date: '2026-04-11', locationId: 'loc1', status: 'confirmed' },
  // Jan: 2× Früh, 2× Spät
  { id: 'h8', employeeId: 'emp4', shiftId: 's1', date: '2026-04-07', locationId: 'loc1', status: 'confirmed' },
  { id: 'h9', employeeId: 'emp4', shiftId: 's2', date: '2026-04-08', locationId: 'loc1', status: 'confirmed' },
  { id: 'h10', employeeId: 'emp4', shiftId: 's1', date: '2026-04-10', locationId: 'loc1', status: 'confirmed' },
  { id: 'h11', employeeId: 'emp4', shiftId: 's2', date: '2026-04-11', locationId: 'loc1', status: 'confirmed' },

  // Week Apr 14–18 --------------------------------------------------------
  // Maria: 3× Früh (Freitag Früh!)
  { id: 'h12', employeeId: 'emp1', shiftId: 's1', date: '2026-04-14', locationId: 'loc1', status: 'confirmed' },
  { id: 'h13', employeeId: 'emp1', shiftId: 's3', date: '2026-04-15', locationId: 'loc1', status: 'confirmed' },
  { id: 'h14', employeeId: 'emp1', shiftId: 's1', date: '2026-04-16', locationId: 'loc1', status: 'confirmed' },
  { id: 'h15', employeeId: 'emp1', shiftId: 's1', date: '2026-04-18', locationId: 'loc1', status: 'confirmed' }, // Freitag
  // Klaus: Freitag Spät (2nd time)
  { id: 'h16', employeeId: 'emp2', shiftId: 's2', date: '2026-04-14', locationId: 'loc1', status: 'confirmed' },
  { id: 'h17', employeeId: 'emp2', shiftId: 's2', date: '2026-04-16', locationId: 'loc1', status: 'confirmed' },
  { id: 'h18', employeeId: 'emp2', shiftId: 's2', date: '2026-04-18', locationId: 'loc1', status: 'confirmed' }, // Freitag Spät
  // Jan: Montag Früh
  { id: 'h19', employeeId: 'emp4', shiftId: 's1', date: '2026-04-14', locationId: 'loc1', status: 'confirmed' }, // Montag
  { id: 'h20', employeeId: 'emp4', shiftId: 's2', date: '2026-04-17', locationId: 'loc1', status: 'confirmed' },
  { id: 'h21', employeeId: 'emp4', shiftId: 's1', date: '2026-04-18', locationId: 'loc1', status: 'confirmed' },

  // Week Apr 21–25 --------------------------------------------------------
  // Maria: 2× Früh, Freitag Früh (3rd Friday!)
  { id: 'h22', employeeId: 'emp1', shiftId: 's1', date: '2026-04-21', locationId: 'loc1', status: 'confirmed' },
  { id: 'h23', employeeId: 'emp1', shiftId: 's3', date: '2026-04-22', locationId: 'loc1', status: 'confirmed' },
  { id: 'h24', employeeId: 'emp1', shiftId: 's1', date: '2026-04-23', locationId: 'loc1', status: 'confirmed' },
  { id: 'h25', employeeId: 'emp1', shiftId: 's1', date: '2026-04-25', locationId: 'loc1', status: 'confirmed' }, // Freitag Früh (3rd!)
  // Klaus: Freitag Spät (3rd time – unfair!)
  { id: 'h26', employeeId: 'emp2', shiftId: 's1', date: '2026-04-21', locationId: 'loc1', status: 'confirmed' },
  { id: 'h27', employeeId: 'emp2', shiftId: 's2', date: '2026-04-23', locationId: 'loc1', status: 'confirmed' },
  { id: 'h28', employeeId: 'emp2', shiftId: 's2', date: '2026-04-25', locationId: 'loc1', status: 'confirmed' }, // Freitag Spät (3rd!)
  // Jan: 3× Früh (Montag Früh × 3!)
  { id: 'h29', employeeId: 'emp4', shiftId: 's1', date: '2026-04-21', locationId: 'loc1', status: 'confirmed' }, // Montag
  { id: 'h30', employeeId: 'emp4', shiftId: 's1', date: '2026-04-22', locationId: 'loc1', status: 'confirmed' },
  { id: 'h31', employeeId: 'emp4', shiftId: 's2', date: '2026-04-24', locationId: 'loc1', status: 'confirmed' },
  { id: 'h32', employeeId: 'emp4', shiftId: 's1', date: '2026-04-25', locationId: 'loc1', status: 'confirmed' },
]

// ─── Swap Requests ───────────────────────────────────────────────────────────

export const SWAP_REQUESTS: SwapRequest[] = [
  {
    id: 'swap1',
    requesterId: 'emp1',
    requesterName: 'Maria Schmidt',
    requesterDate: '2026-04-28',
    requesterShiftId: 's1',
    targetEmployeeId: 'emp2',
    targetEmployeeName: 'Klaus Becker',
    targetDate: '2026-04-28',
    targetShiftId: 's2',
    message: 'Hallo Klaus, könntest du am Dienstag tauschen? Ich muss zum Arzt.',
    status: 'pending',
    submittedAt: '2026-04-26T09:15:00',
    locationId: 'loc1',
  },
  {
    id: 'swap2',
    requesterId: 'emp3',
    requesterName: 'Sarah Hofmann',
    requesterDate: '2026-04-30',
    requesterShiftId: 's3',
    targetEmployeeId: 'emp4',
    targetEmployeeName: 'Jan Peters',
    targetDate: '2026-05-01',
    targetShiftId: 's1',
    message: 'Jan, kannst du den Donnerstag übernehmen? Ich tausche gerne deinen Freitag.',
    status: 'accepted',
    submittedAt: '2026-04-25T14:30:00',
    respondedAt: '2026-04-25T17:05:00',
    locationId: 'loc1',
  },
  {
    id: 'swap3',
    requesterId: 'emp4',
    requesterName: 'Jan Peters',
    requesterDate: '2026-05-02',
    requesterShiftId: 's2',
    targetEmployeeId: 'emp2',
    targetEmployeeName: 'Klaus Becker',
    targetDate: '2026-05-03',
    targetShiftId: 's2',
    message: 'Samstag käme für mich besser.',
    status: 'declined',
    submittedAt: '2026-04-24T10:00:00',
    respondedAt: '2026-04-24T18:20:00',
    locationId: 'loc1',
  },
]

// ─── Wish Submissions (Dienstwünsche) ────────────────────────────────────────

export const WISH_SUBMISSIONS: WishSubmission[] = [
  // Maria: Frühdienst Fr 01.05 – fulfilled (submitted first)
  {
    id: 'w1',
    employeeId: 'emp1',
    employeeName: 'Maria Schmidt',
    locationId: 'loc1',
    date: '2026-05-01',
    preferredShiftType: 'early',
    reason: 'Kinderarzttermin nachmittags',
    importance: 'important',
    submittedAt: '2026-04-23T08:10:00',
    status: 'fulfilled',
  },
  // Jan: ALSO wants Frühdienst Fr 01.05 – conflict with Maria
  {
    id: 'w2',
    employeeId: 'emp4',
    employeeName: 'Jan Peters',
    locationId: 'loc1',
    date: '2026-05-01',
    preferredShiftType: 'early',
    reason: 'Wäre schön',
    importance: 'normal',
    submittedAt: '2026-04-24T11:30:00', // submitted later than Maria
    status: 'not_fulfilled',
    conflictInfo: {
      conflictedWith: ['Maria Schmidt'],
      reason: 'Maria Schmidt hat denselben Wunsch früher eingereicht (23.04.) und hat in den letzten 4 Wochen weniger Frühschichten gehabt als du.',
      winnerId: 'emp1',
    },
  },
  // Klaus: kein Spätdienst Mo 28.04 – fulfilled
  {
    id: 'w3',
    employeeId: 'emp2',
    employeeName: 'Klaus Becker',
    locationId: 'loc1',
    date: '2026-04-28',
    preferredShiftType: 'late',
    reason: 'Morgentermin kann ich nicht',
    importance: 'important',
    submittedAt: '2026-04-22T09:00:00',
    status: 'fulfilled',
  },
  // Sarah: freier Tag Mi 29.04 – not fulfilled (Unterbesetzung)
  {
    id: 'w4',
    employeeId: 'emp3',
    employeeName: 'Sarah Hofmann',
    locationId: 'loc1',
    date: '2026-04-29',
    preferredShiftType: 'mid',
    reason: 'Würde gerne frei haben',
    importance: 'normal',
    submittedAt: '2026-04-23T15:00:00',
    status: 'not_fulfilled',
    conflictInfo: {
      conflictedWith: [],
      reason: 'An diesem Tag besteht Unterbesetzung im Mitteldienst. Dein Wunsch konnte nicht berücksichtigt werden.',
      winnerId: '',
    },
  },
  // Maria: Frühdienst Mo 05.05 – pending
  {
    id: 'w5',
    employeeId: 'emp1',
    employeeName: 'Maria Schmidt',
    locationId: 'loc1',
    date: '2026-05-05',
    preferredShiftType: 'early',
    reason: 'Frühdienst bevorzugt',
    importance: 'normal',
    submittedAt: '2026-04-26T10:00:00',
    status: 'pending',
  },
]

export function getSwapRequestsByEmployee(employeeId: string): SwapRequest[] {
  return SWAP_REQUESTS.filter(s => s.requesterId === employeeId || s.targetEmployeeId === employeeId)
}

export function getWishSubmissionsByEmployee(employeeId: string): WishSubmission[] {
  return WISH_SUBMISSIONS.filter(w => w.employeeId === employeeId)
}

export function getWishSubmissionsByLocation(locationId: string): WishSubmission[] {
  return WISH_SUBMISSIONS.filter(w => w.locationId === locationId)
}

export function getAllEntriesForFairness(locationId: string): ScheduleEntry[] {
  return [...HISTORICAL_ENTRIES, ...SCHEDULE_ENTRIES].filter(e => e.locationId === locationId)
}
