import type { Location, Employee, Shift, ScheduleEntry, TimeLog, VacationRequest, SwapRequest, WishSubmission, VacationPlanPreference, SchoolHoliday, ShiftType, WishImportance, VacationRules, VacationPlanEntry, Customer, LicensePlan, TestAccount, Invitation, SupportAccessLogEntry, Role, OrgSettings, OvertimeRequest, Absence, HoursAccountSummary, MonthlyClosing } from './types'

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
  { id: 'emp1', name: 'Maria Schmidt', email: 'employee@demo.de', role: 'employee', locationId: 'loc1', weeklyHours: 38, position: 'Erzieherin', hoursBalance: 4.5, vacationDaysTotal: 30, vacationDaysUsed: 8, active: true, joinedAt: '2021-03-01', hasChildren: true, preferences: { preferredShifts: ['early', 'mid'], unavailableDays: [0, 6], noEarlyAfterLate: true, notes: 'Bevorzugt Frühschichten' } },
  { id: 'emp2', name: 'Klaus Becker', email: 'k.becker@demo.de', role: 'employee', locationId: 'loc1', weeklyHours: 32, position: 'Erzieher', hoursBalance: -2.0, vacationDaysTotal: 30, vacationDaysUsed: 12, active: true, joinedAt: '2019-09-15', hasChildren: false, preferences: { preferredShifts: ['late'], unavailableDays: [1], noEarlyAfterLate: true } },
  { id: 'emp3', name: 'Sarah Hofmann', email: 's.hofmann@demo.de', role: 'employee', locationId: 'loc1', weeklyHours: 20, position: 'Kinderpflegerin', hoursBalance: 1.0, vacationDaysTotal: 24, vacationDaysUsed: 5, active: true, joinedAt: '2022-01-10', hasChildren: false },
  { id: 'emp4', name: 'Jan Peters', email: 'j.peters@demo.de', role: 'employee', locationId: 'loc1', weeklyHours: 38, position: 'Erzieher', hoursBalance: 0.0, vacationDaysTotal: 30, vacationDaysUsed: 15, active: true, joinedAt: '2018-06-20', hasChildren: true },
  // Admin of loc1
  { id: 'adm1', name: 'Thomas Müller', email: 'admin@demo.de', role: 'admin', locationId: 'loc1', weeklyHours: 40, position: 'Teamleitung', hoursBalance: 2.0, vacationDaysTotal: 30, vacationDaysUsed: 10, active: true, joinedAt: '2017-01-01', hasChildren: false },
  // Kita Regenbogen (loc2)
  { id: 'emp5', name: 'Anna Weber', email: 'a.weber@demo.de', role: 'employee', locationId: 'loc2', weeklyHours: 38, position: 'Erzieherin', hoursBalance: 3.0, vacationDaysTotal: 30, vacationDaysUsed: 7, active: true, joinedAt: '2020-08-01', hasChildren: true },
  { id: 'emp6', name: 'Peter Wagner', email: 'p.wagner@demo.de', role: 'employee', locationId: 'loc2', weeklyHours: 32, position: 'Erzieher', hoursBalance: -1.5, vacationDaysTotal: 30, vacationDaysUsed: 20, active: true, joinedAt: '2016-04-01', hasChildren: false },
  { id: 'emp7', name: 'Lisa Fischer', email: 'l.fischer@demo.de', role: 'employee', locationId: 'loc2', weeklyHours: 25, position: 'Kinderpflegerin', hoursBalance: 0.5, vacationDaysTotal: 24, vacationDaysUsed: 3, active: true, joinedAt: '2023-02-15', hasChildren: false },
  { id: 'adm2', name: 'Sandra Wolf', email: 's.wolf@demo.de', role: 'admin', locationId: 'loc2', weeklyHours: 40, position: 'Teamleitung', hoursBalance: 1.0, vacationDaysTotal: 30, vacationDaysUsed: 9, active: true, joinedAt: '2018-03-01', hasChildren: false },
  // Kita Sternchen (loc3)
  { id: 'emp8', name: 'Michael Bauer', email: 'm.bauer@demo.de', role: 'employee', locationId: 'loc3', weeklyHours: 38, position: 'Erzieher', hoursBalance: 2.5, vacationDaysTotal: 30, vacationDaysUsed: 11, active: true, joinedAt: '2019-11-01', hasChildren: true },
  { id: 'emp9', name: 'Julia Koch', email: 'j.koch@demo.de', role: 'employee', locationId: 'loc3', weeklyHours: 38, position: 'Erzieherin', hoursBalance: -0.5, vacationDaysTotal: 30, vacationDaysUsed: 14, active: true, joinedAt: '2020-02-01', hasChildren: false },
  { id: 'emp10', name: 'Stefan Schäfer', email: 's.schaefer@demo.de', role: 'employee', locationId: 'loc3', weeklyHours: 20, position: 'Kinderpfleger', hoursBalance: 0.0, vacationDaysTotal: 24, vacationDaysUsed: 2, active: true, joinedAt: '2023-09-01', hasChildren: false },
  { id: 'adm3', name: 'Nina Braun', email: 'n.braun@demo.de', role: 'admin', locationId: 'loc3', weeklyHours: 40, position: 'Teamleitung', hoursBalance: 0.5, vacationDaysTotal: 30, vacationDaysUsed: 6, active: true, joinedAt: '2019-06-01', hasChildren: false },
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

export const TIME_LOGS: TimeLog[] = [
  // ── Maria Schmidt (emp1) – Feb 2026 ────────────────────────────────────────
  { id: 'tl1',  employeeId: 'emp1', date: '2026-02-02', clockIn: '06:02', clockOut: '14:05', totalMinutes: 483, locationId: 'loc1' },
  { id: 'tl2',  employeeId: 'emp1', date: '2026-02-04', clockIn: '09:01', clockOut: '17:03', totalMinutes: 482, locationId: 'loc1' },
  { id: 'tl3',  employeeId: 'emp1', date: '2026-02-05', clockIn: '05:59', clockOut: '14:00', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl4',  employeeId: 'emp1', date: '2026-02-09', clockIn: '06:03', clockOut: '14:02', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl5',  employeeId: 'emp1', date: '2026-02-11', clockIn: '09:00', clockOut: '17:05', totalMinutes: 485, locationId: 'loc1' },
  { id: 'tl6',  employeeId: 'emp1', date: '2026-02-12', clockIn: '06:00', clockOut: '14:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl7',  employeeId: 'emp1', date: '2026-02-16', clockIn: '06:01', clockOut: '14:04', totalMinutes: 483, locationId: 'loc1' },
  { id: 'tl8',  employeeId: 'emp1', date: '2026-02-18', clockIn: '09:02', clockOut: '17:00', totalMinutes: 478, locationId: 'loc1' },
  { id: 'tl9',  employeeId: 'emp1', date: '2026-02-19', clockIn: '06:00', clockOut: '14:01', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl10', employeeId: 'emp1', date: '2026-02-23', clockIn: '06:02', clockOut: '14:03', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl11', employeeId: 'emp1', date: '2026-02-25', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl12', employeeId: 'emp1', date: '2026-02-26', clockIn: '06:01', clockOut: '14:00', totalMinutes: 479, locationId: 'loc1' },
  // ── Maria Schmidt (emp1) – Mär 2026 ────────────────────────────────────────
  { id: 'tl13', employeeId: 'emp1', date: '2026-03-02', clockIn: '06:00', clockOut: '14:05', totalMinutes: 485, locationId: 'loc1' },
  { id: 'tl14', employeeId: 'emp1', date: '2026-03-04', clockIn: '09:01', clockOut: '17:02', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl15', employeeId: 'emp1', date: '2026-03-05', clockIn: '06:02', clockOut: '14:00', totalMinutes: 478, locationId: 'loc1' },
  { id: 'tl16', employeeId: 'emp1', date: '2026-03-09', clockIn: '06:03', clockOut: '14:04', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl17', employeeId: 'emp1', date: '2026-03-11', clockIn: '09:00', clockOut: '17:03', totalMinutes: 483, locationId: 'loc1' },
  { id: 'tl18', employeeId: 'emp1', date: '2026-03-12', clockIn: '06:00', clockOut: '14:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl19', employeeId: 'emp1', date: '2026-03-16', clockIn: '06:01', clockOut: '14:02', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl20', employeeId: 'emp1', date: '2026-03-18', clockIn: '09:01', clockOut: '17:00', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl21', employeeId: 'emp1', date: '2026-03-19', clockIn: '06:00', clockOut: '14:01', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl22', employeeId: 'emp1', date: '2026-03-23', clockIn: '06:02', clockOut: '14:03', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl23', employeeId: 'emp1', date: '2026-03-25', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl24', employeeId: 'emp1', date: '2026-03-26', clockIn: '06:01', clockOut: '14:00', totalMinutes: 479, locationId: 'loc1' },
  // ── Maria Schmidt (emp1) – Apr 2026 ────────────────────────────────────────
  { id: 'tl25', employeeId: 'emp1', date: '2026-04-14', clockIn: '06:02', clockOut: '14:05', totalMinutes: 483, locationId: 'loc1' },
  { id: 'tl26', employeeId: 'emp1', date: '2026-04-15', clockIn: '08:58', clockOut: '17:03', totalMinutes: 485, locationId: 'loc1' },
  { id: 'tl27', employeeId: 'emp1', date: '2026-04-16', clockIn: '06:01', clockOut: '14:00', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl28', employeeId: 'emp1', date: '2026-04-22', clockIn: '06:00', clockOut: '14:08', totalMinutes: 488, locationId: 'loc1' },
  { id: 'tl29', employeeId: 'emp1', date: '2026-04-23', clockIn: '09:02', clockOut: '17:00', totalMinutes: 478, locationId: 'loc1' },
  { id: 'tl30', employeeId: 'emp1', date: '2026-04-24', clockIn: '06:00', clockOut: '14:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl31', employeeId: 'emp1', date: '2026-04-28', clockIn: '06:03', clockOut: '14:02', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl32', employeeId: 'emp1', date: '2026-04-29', clockIn: '09:01', clockOut: '17:05', totalMinutes: 484, locationId: 'loc1' },
  // ── Klaus Becker (emp2) – Feb/Mär/Apr 2026 ─────────────────────────────────
  { id: 'tl33', employeeId: 'emp2', date: '2026-02-03', clockIn: '13:58', clockOut: '22:05', totalMinutes: 487, locationId: 'loc1' },
  { id: 'tl34', employeeId: 'emp2', date: '2026-02-05', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl35', employeeId: 'emp2', date: '2026-02-10', clockIn: '14:01', clockOut: '22:03', totalMinutes: 482, locationId: 'loc1' },
  { id: 'tl36', employeeId: 'emp2', date: '2026-02-12', clockIn: '13:59', clockOut: '22:00', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl37', employeeId: 'emp2', date: '2026-02-17', clockIn: '14:00', clockOut: '22:05', totalMinutes: 485, locationId: 'loc1' },
  { id: 'tl38', employeeId: 'emp2', date: '2026-02-19', clockIn: '14:02', clockOut: '22:00', totalMinutes: 478, locationId: 'loc1' },
  { id: 'tl39', employeeId: 'emp2', date: '2026-03-03', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl40', employeeId: 'emp2', date: '2026-03-05', clockIn: '14:01', clockOut: '22:03', totalMinutes: 482, locationId: 'loc1' },
  { id: 'tl41', employeeId: 'emp2', date: '2026-03-10', clockIn: '14:00', clockOut: '22:05', totalMinutes: 485, locationId: 'loc1' },
  { id: 'tl42', employeeId: 'emp2', date: '2026-03-12', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl43', employeeId: 'emp2', date: '2026-03-17', clockIn: '13:58', clockOut: '22:02', totalMinutes: 484, locationId: 'loc1' },
  { id: 'tl44', employeeId: 'emp2', date: '2026-03-19', clockIn: '14:01', clockOut: '22:00', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl45', employeeId: 'emp2', date: '2026-04-28', clockIn: '13:58', clockOut: '22:05', totalMinutes: 487, locationId: 'loc1' },
  { id: 'tl46', employeeId: 'emp2', date: '2026-04-29', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
  // ── Sarah Hofmann (emp3) – Feb/Mär/Apr 2026 ────────────────────────────────
  { id: 'tl47', employeeId: 'emp3', date: '2026-02-04', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl48', employeeId: 'emp3', date: '2026-02-06', clockIn: '09:01', clockOut: '17:00', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl49', employeeId: 'emp3', date: '2026-02-11', clockIn: '09:02', clockOut: '17:00', totalMinutes: 478, locationId: 'loc1' },
  { id: 'tl50', employeeId: 'emp3', date: '2026-02-13', clockIn: '09:00', clockOut: '17:02', totalMinutes: 482, locationId: 'loc1' },
  { id: 'tl51', employeeId: 'emp3', date: '2026-02-18', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl52', employeeId: 'emp3', date: '2026-02-20', clockIn: '09:01', clockOut: '17:01', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl53', employeeId: 'emp3', date: '2026-03-04', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl54', employeeId: 'emp3', date: '2026-03-06', clockIn: '09:01', clockOut: '17:03', totalMinutes: 482, locationId: 'loc1' },
  { id: 'tl55', employeeId: 'emp3', date: '2026-03-11', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl56', employeeId: 'emp3', date: '2026-03-13', clockIn: '09:02', clockOut: '17:00', totalMinutes: 478, locationId: 'loc1' },
  { id: 'tl57', employeeId: 'emp3', date: '2026-03-18', clockIn: '09:00', clockOut: '17:01', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl58', employeeId: 'emp3', date: '2026-03-20', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl59', employeeId: 'emp3', date: '2026-04-28', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl60', employeeId: 'emp3', date: '2026-04-30', clockIn: '09:01', clockOut: '17:02', totalMinutes: 481, locationId: 'loc1' },
  // ── Jan Peters (emp4) – Feb/Mär/Apr 2026 ───────────────────────────────────
  { id: 'tl61', employeeId: 'emp4', date: '2026-02-02', clockIn: '06:01', clockOut: '14:00', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl62', employeeId: 'emp4', date: '2026-02-04', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl63', employeeId: 'emp4', date: '2026-02-09', clockIn: '06:00', clockOut: '14:02', totalMinutes: 482, locationId: 'loc1' },
  { id: 'tl64', employeeId: 'emp4', date: '2026-02-11', clockIn: '13:59', clockOut: '22:00', totalMinutes: 481, locationId: 'loc1' },
  { id: 'tl65', employeeId: 'emp4', date: '2026-02-16', clockIn: '06:02', clockOut: '14:00', totalMinutes: 478, locationId: 'loc1' },
  { id: 'tl66', employeeId: 'emp4', date: '2026-02-18', clockIn: '14:01', clockOut: '22:03', totalMinutes: 482, locationId: 'loc1' },
  { id: 'tl67', employeeId: 'emp4', date: '2026-03-02', clockIn: '06:01', clockOut: '14:00', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl68', employeeId: 'emp4', date: '2026-03-04', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl69', employeeId: 'emp4', date: '2026-03-09', clockIn: '06:00', clockOut: '14:03', totalMinutes: 483, locationId: 'loc1' },
  { id: 'tl70', employeeId: 'emp4', date: '2026-03-11', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl71', employeeId: 'emp4', date: '2026-03-16', clockIn: '06:02', clockOut: '14:01', totalMinutes: 479, locationId: 'loc1' },
  { id: 'tl72', employeeId: 'emp4', date: '2026-03-18', clockIn: '14:00', clockOut: '22:02', totalMinutes: 482, locationId: 'loc1' },
  { id: 'tl73', employeeId: 'emp4', date: '2026-04-28', clockIn: '06:01', clockOut: '14:01', totalMinutes: 480, locationId: 'loc1' },
  { id: 'tl74', employeeId: 'emp4', date: '2026-04-30', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc1' },
  // ── Anna Weber (emp5, loc2) – Mär/Apr 2026 ─────────────────────────────────
  { id: 'tl75', employeeId: 'emp5', date: '2026-03-02', clockIn: '06:31', clockOut: '14:30', totalMinutes: 479, locationId: 'loc2' },
  { id: 'tl76', employeeId: 'emp5', date: '2026-03-04', clockIn: '06:30', clockOut: '14:31', totalMinutes: 481, locationId: 'loc2' },
  { id: 'tl77', employeeId: 'emp5', date: '2026-03-09', clockIn: '06:30', clockOut: '14:30', totalMinutes: 480, locationId: 'loc2' },
  { id: 'tl78', employeeId: 'emp5', date: '2026-03-11', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc2' },
  { id: 'tl79', employeeId: 'emp5', date: '2026-03-16', clockIn: '06:30', clockOut: '14:30', totalMinutes: 480, locationId: 'loc2' },
  { id: 'tl80', employeeId: 'emp5', date: '2026-04-07', clockIn: '06:30', clockOut: '14:30', totalMinutes: 480, locationId: 'loc2' },
  { id: 'tl81', employeeId: 'emp5', date: '2026-04-09', clockIn: '06:31', clockOut: '14:29', totalMinutes: 478, locationId: 'loc2' },
  // ── Peter Wagner (emp6, loc2) – Mär/Apr 2026 ───────────────────────────────
  { id: 'tl82', employeeId: 'emp6', date: '2026-03-03', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc2' },
  { id: 'tl83', employeeId: 'emp6', date: '2026-03-05', clockIn: '14:01', clockOut: '22:02', totalMinutes: 481, locationId: 'loc2' },
  { id: 'tl84', employeeId: 'emp6', date: '2026-03-10', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc2' },
  { id: 'tl85', employeeId: 'emp6', date: '2026-03-12', clockIn: '13:59', clockOut: '22:01', totalMinutes: 482, locationId: 'loc2' },
  { id: 'tl86', employeeId: 'emp6', date: '2026-04-07', clockIn: '14:00', clockOut: '22:00', totalMinutes: 480, locationId: 'loc2' },
  { id: 'tl87', employeeId: 'emp6', date: '2026-04-09', clockIn: '14:01', clockOut: '22:03', totalMinutes: 482, locationId: 'loc2' },
  // ── Michael Bauer (emp8, loc3) – Mär/Apr 2026 ──────────────────────────────
  { id: 'tl88', employeeId: 'emp8', date: '2026-03-02', clockIn: '06:01', clockOut: '14:00', totalMinutes: 479, locationId: 'loc3' },
  { id: 'tl89', employeeId: 'emp8', date: '2026-03-04', clockIn: '06:00', clockOut: '14:01', totalMinutes: 481, locationId: 'loc3' },
  { id: 'tl90', employeeId: 'emp8', date: '2026-03-09', clockIn: '06:02', clockOut: '14:00', totalMinutes: 478, locationId: 'loc3' },
  { id: 'tl91', employeeId: 'emp8', date: '2026-03-11', clockIn: '06:00', clockOut: '14:00', totalMinutes: 480, locationId: 'loc3' },
  { id: 'tl92', employeeId: 'emp8', date: '2026-04-06', clockIn: '06:00', clockOut: '14:00', totalMinutes: 480, locationId: 'loc3' },
  { id: 'tl93', employeeId: 'emp8', date: '2026-04-08', clockIn: '06:01', clockOut: '14:03', totalMinutes: 482, locationId: 'loc3' },
  // ── Julia Koch (emp9, loc3) – Mär/Apr 2026 ─────────────────────────────────
  { id: 'tl94', employeeId: 'emp9', date: '2026-03-03', clockIn: '09:00', clockOut: '17:00', totalMinutes: 480, locationId: 'loc3' },
  { id: 'tl95', employeeId: 'emp9', date: '2026-03-05', clockIn: '06:00', clockOut: '14:00', totalMinutes: 480, locationId: 'loc3' },
  { id: 'tl96', employeeId: 'emp9', date: '2026-03-10', clockIn: '09:01', clockOut: '17:02', totalMinutes: 481, locationId: 'loc3' },
  { id: 'tl97', employeeId: 'emp9', date: '2026-03-12', clockIn: '06:01', clockOut: '14:00', totalMinutes: 479, locationId: 'loc3' },
  { id: 'tl98', employeeId: 'emp9', date: '2026-04-07', clockIn: '09:00', clockOut: '17:01', totalMinutes: 481, locationId: 'loc3' },
  { id: 'tl99', employeeId: 'emp9', date: '2026-04-09', clockIn: '06:00', clockOut: '14:00', totalMinutes: 480, locationId: 'loc3' },
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

// Automatically close out pending requests whose period has already ended without
// an admin response, so they don't sit as "Ausstehend" forever.
function autoProcessPastDueVacationRequests() {
  const today = new Date().toISOString().split('T')[0]
  for (const v of VACATION_REQUESTS) {
    if (v.status === 'pending' && v.endDate < today) {
      v.status = 'approved'
      v.respondedAt = today
      v.respondedBy = 'System (automatisch)'
    }
  }
}
autoProcessPastDueVacationRequests()

export function setVacationRequestStatus(id: string, status: 'approved' | 'denied', respondedBy: string) {
  const idx = VACATION_REQUESTS.findIndex(v => v.id === id)
  if (idx === -1) return
  VACATION_REQUESTS[idx] = {
    ...VACATION_REQUESTS[idx],
    status,
    respondedAt: new Date().toISOString().split('T')[0],
    respondedBy,
  }
}

let vacationRequestSeq = 1000

export function addVacationRequest(input: {
  employeeId: string
  employeeName: string
  locationId: string
  locationName: string
  startDate: string
  endDate: string
  days: number
  reason?: string
}): VacationRequest {
  const request: VacationRequest = {
    id: `vr-new-${vacationRequestSeq++}`,
    ...input,
    status: 'pending',
    submittedAt: new Date().toISOString().split('T')[0],
  }
  VACATION_REQUESTS.push(request)
  return request
}

let wishSubmissionSeq = 1000

export function addWishSubmission(input: {
  employeeId: string
  employeeName: string
  locationId: string
  date: string
  preferredShiftType: ShiftType
  reason?: string
  importance: WishImportance
}): WishSubmission {
  const wish: WishSubmission = {
    id: `wish-new-${wishSubmissionSeq++}`,
    ...input,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  }
  WISH_SUBMISSIONS.push(wish)
  return wish
}

export function setShiftMinStaff(shiftId: string, minStaff: number) {
  const shift = SHIFTS.find(s => s.id === shiftId)
  if (shift) shift.minStaff = minStaff
}

export function updateLocation(id: string, updates: Partial<Location>) {
  const idx = LOCATIONS.findIndex(l => l.id === id)
  if (idx === -1) return
  LOCATIONS[idx] = { ...LOCATIONS[idx], ...updates }
}

let locationSeq = 1000

export function addLocation(input: { name: string; address: string; city: string }): Location {
  const location: Location = {
    id: `loc-new-${locationSeq++}`,
    name: input.name,
    address: input.address,
    city: input.city,
    employeeCount: 0,
    adminId: '',
    active: true,
  }
  LOCATIONS.push(location)
  return location
}

export function updateEmployee(id: string, updates: Partial<Employee>) {
  const idx = EMPLOYEES.findIndex(e => e.id === id)
  if (idx === -1) return
  EMPLOYEES[idx] = { ...EMPLOYEES[idx], ...updates }
}

// ─── Aufgabenverwaltung (Einrichtungsleitung) ───────────────────────────────

export const TASK_CATALOG: string[] = ['Medikamentenausgabe', 'Dokumentation', 'Elternkommunikation', 'Schlüsseldienst', 'Reinigungsdienst']

export function addTaskType(name: string) {
  if (!TASK_CATALOG.includes(name)) TASK_CATALOG.push(name)
}

export function removeTaskType(name: string) {
  const idx = TASK_CATALOG.indexOf(name)
  if (idx !== -1) TASK_CATALOG.splice(idx, 1)
  EMPLOYEES.forEach(e => {
    if (e.allowedTasks?.includes(name)) updateEmployee(e.id, { allowedTasks: e.allowedTasks.filter(t => t !== name) })
  })
}

/** Geschäftsführung: Einrichtungsleitung wechseln – die bisherige Leitung wird
 * wieder Mitarbeiter, die neu ernannte Person wird Einrichtungsleitung. */
export function reassignLocationAdmin(locationId: string, newAdminEmployeeId: string) {
  const location = LOCATIONS.find(l => l.id === locationId)
  if (!location) return
  const previousAdmin = EMPLOYEES.find(e => e.id === location.adminId)
  if (previousAdmin) updateEmployee(previousAdmin.id, { role: 'employee' })
  updateEmployee(newAdminEmployeeId, { role: 'admin' })
  updateLocation(locationId, { adminId: newAdminEmployeeId })
}

let employeeSeq = 1000

export function addEmployee(input: {
  name: string
  email: string
  position: string
  weeklyHours: number
  locationId: string
  phone?: string
  birthDate?: string
  roleType?: string
  employmentType?: string
  gruppe?: string
  bereich?: string
  multiGroupCapable?: boolean
  fixedLocations?: string
  qualifications?: string[]
  allowedTasks?: string[]
}): Employee {
  const employee: Employee = {
    id: `emp-new-${employeeSeq++}`,
    name: input.name,
    email: input.email,
    role: 'employee',
    locationId: input.locationId,
    weeklyHours: input.weeklyHours,
    position: input.position,
    hoursBalance: 0,
    vacationDaysTotal: 30,
    vacationDaysUsed: 0,
    active: true,
    joinedAt: new Date().toISOString().split('T')[0],
    phone: input.phone,
    birthDate: input.birthDate,
    roleType: input.roleType,
    employmentType: input.employmentType,
    gruppe: input.gruppe,
    bereich: input.bereich,
    multiGroupCapable: input.multiGroupCapable,
    fixedLocations: input.fixedLocations,
    qualifications: input.qualifications,
    allowedTasks: input.allowedTasks,
  }
  EMPLOYEES.push(employee)
  return employee
}

let scheduleEntrySeq = 1000

/** Persists an AI-generated schedule ({ employeeId: { date: shiftId } }) into the
 *  shared SCHEDULE_ENTRIES array so all roles (employee, admin, company) see it. */
export function saveScheduleForWeek(
  locationId: string,
  weekDates: string[],
  assignments: Record<string, Record<string, string>>,
  reasons?: Record<string, string>,
) {
  for (let i = SCHEDULE_ENTRIES.length - 1; i >= 0; i--) {
    const e = SCHEDULE_ENTRIES[i]
    if (e.locationId === locationId && weekDates.includes(e.date)) {
      SCHEDULE_ENTRIES.splice(i, 1)
    }
  }
  for (const [employeeId, byDate] of Object.entries(assignments)) {
    for (const [date, shiftId] of Object.entries(byDate)) {
      SCHEDULE_ENTRIES.push({
        id: `se-gen-${scheduleEntrySeq++}`,
        employeeId,
        shiftId,
        date,
        locationId,
        status: 'confirmed',
        reason: reasons?.[`${employeeId}|${date}`],
      })
    }
  }
}

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

export function getVacationRequestsByEmployee(employeeId: string): VacationRequest[] {
  return VACATION_REQUESTS.filter(v => v.employeeId === employeeId)
}

export function getTimeLogsByMonth(employeeId: string, year: number, month: number): TimeLog[] {
  return TIME_LOGS.filter(t => {
    if (t.employeeId !== employeeId) return false
    const d = new Date(t.date + 'T00:00:00')
    return d.getFullYear() === year && d.getMonth() + 1 === month
  }).sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Vacation Planning ────────────────────────────────────────────────────────

export const VACATION_PREFERENCES: VacationPlanPreference[] = [
  { employeeId: 'emp1', hasChildren: true,  preferredMonths: [7, 8], preferredPeriod: 'Sommerferien Juli/August', notes: 'Kinder schulpflichtig – brauche Schulferienzeit', priority: 'high' },
  { employeeId: 'emp2', hasChildren: false, preferredMonths: [6, 9], preferredPeriod: 'Juni oder September', notes: 'Lieber außerhalb der Hauptsaison reisen', priority: 'medium' },
  { employeeId: 'emp3', hasChildren: false, preferredMonths: [5, 6], preferredPeriod: 'Mai oder Juni', notes: 'Frühling bevorzugt', priority: 'medium' },
  { employeeId: 'emp4', hasChildren: true,  preferredMonths: [7, 8], preferredPeriod: 'Sommerferien', notes: 'Schulpflichtige Kinder – Sommerferien nötig', priority: 'high' },
  { employeeId: 'emp5', hasChildren: true,  preferredMonths: [7],    preferredPeriod: 'Juli', notes: 'Zwei Kinder im Grundschulalter', priority: 'high' },
  { employeeId: 'emp6', hasChildren: false, preferredMonths: [6, 9], preferredPeriod: 'Juni / September', notes: 'Flexibel, außerhalb der Ferienzeit bevorzugt', priority: 'low' },
  { employeeId: 'emp7', hasChildren: false, preferredMonths: [8, 9], preferredPeriod: 'August oder September', notes: '', priority: 'low' },
  { employeeId: 'emp8', hasChildren: true,  preferredMonths: [7],    preferredPeriod: 'Juli', notes: 'Sohn im Kindergartenalter, Sommer bevorzugt', priority: 'high' },
  { employeeId: 'emp9', hasChildren: false, preferredMonths: [6, 7], preferredPeriod: 'Juni oder Juli', notes: '', priority: 'medium' },
  { employeeId: 'emp10', hasChildren: false, preferredMonths: [8],   preferredPeriod: 'August', notes: 'Neu eingetreten, sehr flexibel', priority: 'low' },
]

export const SCHOOL_HOLIDAYS_2026: SchoolHoliday[] = [
  // Berlin
  { name: 'Winterferien', startDate: '2026-02-02', endDate: '2026-02-06', state: 'Berlin' },
  { name: 'Osterferien',  startDate: '2026-03-30', endDate: '2026-04-11', state: 'Berlin' },
  { name: 'Pfingstferien', startDate: '2026-05-22', endDate: '2026-05-23', state: 'Berlin' },
  { name: 'Sommerferien', startDate: '2026-06-22', endDate: '2026-08-01', state: 'Berlin' },
  { name: 'Herbstferien', startDate: '2026-10-05', endDate: '2026-10-16', state: 'Berlin' },
  { name: 'Weihnachtsferien', startDate: '2026-12-21', endDate: '2027-01-02', state: 'Berlin' },
  // Bayern
  { name: 'Winterferien', startDate: '2026-02-12', endDate: '2026-02-20', state: 'Bayern' },
  { name: 'Osterferien',  startDate: '2026-04-06', endDate: '2026-04-18', state: 'Bayern' },
  { name: 'Pfingstferien', startDate: '2026-05-22', endDate: '2026-06-05', state: 'Bayern' },
  { name: 'Sommerferien', startDate: '2026-07-27', endDate: '2026-09-07', state: 'Bayern' },
  { name: 'Herbstferien', startDate: '2026-10-30', endDate: '2026-11-07', state: 'Bayern' },
  { name: 'Weihnachtsferien', startDate: '2026-12-23', endDate: '2027-01-08', state: 'Bayern' },
  // Hamburg
  { name: 'Winterferien', startDate: '2026-01-30', endDate: '2026-02-04', state: 'Hamburg' },
  { name: 'Osterferien',  startDate: '2026-03-23', endDate: '2026-04-01', state: 'Hamburg' },
  { name: 'Pfingstferien', startDate: '2026-05-22', endDate: '2026-05-29', state: 'Hamburg' },
  { name: 'Sommerferien', startDate: '2026-07-16', endDate: '2026-08-26', state: 'Hamburg' },
  { name: 'Herbstferien', startDate: '2026-10-05', endDate: '2026-10-16', state: 'Hamburg' },
  { name: 'Weihnachtsferien', startDate: '2026-12-18', endDate: '2027-01-01', state: 'Hamburg' },
]

// Persisted across planning runs (Schritt 1 "Urlaubsregeln erfassen" + Ergänzung
// "persistente Feiertags-/Sonderzeit-Regeln") so they don't need to be re-entered each year.
const VACATION_RULES: Record<string, VacationRules> = {}

export function getVacationRules(locationId: string): VacationRules | null {
  return VACATION_RULES[locationId] ?? null
}

export function setVacationRules(locationId: string, rules: VacationRules) {
  VACATION_RULES[locationId] = rules
}

// Schritt 6 "Freigabe": turns a generated annual plan into real, already-approved
// vacation requests, so they show up for employees and are respected by future schedule generation.
export function publishVacationPlan(locationId: string, locationName: string, entries: VacationPlanEntry[]): VacationRequest[] {
  const created: VacationRequest[] = []
  for (const entry of entries) {
    for (const slot of entry.slots) {
      const request: VacationRequest = {
        id: `vr-plan-${vacationRequestSeq++}`,
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        locationId,
        locationName,
        startDate: slot.startDate,
        endDate: slot.endDate,
        days: slot.days,
        reason: entry.note,
        status: 'approved',
        submittedAt: new Date().toISOString().split('T')[0],
        respondedAt: new Date().toISOString().split('T')[0],
        respondedBy: 'KI-Jahresurlaubsplanung',
      }
      VACATION_REQUESTS.push(request)
      created.push(request)
    }
  }
  return created
}

// ─── OKUN Plattformverwaltung ─────────────────────────────────────────────────

export const CUSTOMERS: Customer[] = [
  { id: 'cust1', name: 'BrightCare GmbH', contactName: 'BrightCare GmbH', contactEmail: 'company@demo.de', status: 'active', plan: 'professional', seatsLicensed: 20, seatsUsed: 14, locationsCount: 3, createdAt: '2015-01-01', renewalDate: '2027-01-01' },
  { id: 'cust2', name: 'Pflegeverbund Nord eG', contactName: 'Henrike Voss', contactEmail: 'h.voss@pflegeverbund-nord.de', status: 'trial', plan: 'starter', seatsLicensed: 10, seatsUsed: 6, locationsCount: 1, createdAt: '2026-05-30', renewalDate: '2026-06-30', notes: 'Testphase – Entscheidung erwartet bis Ende Juni' },
  { id: 'cust3', name: 'Lebenshilfe Rheinland', contactName: 'Markus Engel', contactEmail: 'm.engel@lebenshilfe-rheinland.de', status: 'active', plan: 'enterprise', seatsLicensed: 80, seatsUsed: 62, locationsCount: 9, createdAt: '2023-09-12', renewalDate: '2026-09-12' },
  { id: 'cust4', name: 'Kinderhaus Wolke 7', contactName: 'Petra Lindemann', contactEmail: 'p.lindemann@kinderhaus-wolke7.de', status: 'suspended', plan: 'starter', seatsLicensed: 8, seatsUsed: 0, locationsCount: 1, createdAt: '2024-02-20', notes: 'Zahlung überfällig seit 45 Tagen – Zugang gesperrt' },
]

let customerSeq = 1000

export function addCustomer(input: { name: string; contactName: string; contactEmail: string; plan: LicensePlan; seatsLicensed: number }): Customer {
  const customer: Customer = {
    id: `cust-new-${customerSeq++}`,
    name: input.name,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    status: 'trial',
    plan: input.plan,
    seatsLicensed: input.seatsLicensed,
    seatsUsed: 0,
    locationsCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
  }
  CUSTOMERS.push(customer)
  return customer
}

export function updateCustomer(id: string, updates: Partial<Customer>) {
  const idx = CUSTOMERS.findIndex(c => c.id === id)
  if (idx === -1) return
  CUSTOMERS[idx] = { ...CUSTOMERS[idx], ...updates }
}

export const TEST_ACCOUNTS: TestAccount[] = [
  { id: 'ta1', customerName: 'Pflegeverbund Nord eG', contactEmail: 'h.voss@pflegeverbund-nord.de', createdAt: '2026-05-30', expiresAt: '2026-06-30', converted: false },
  { id: 'ta2', customerName: 'Tagespflege Sonnenhof', contactEmail: 'info@tagespflege-sonnenhof.de', createdAt: '2026-04-10', expiresAt: '2026-05-10', converted: false },
]

let testAccountSeq = 1000

export function addTestAccount(input: { customerName: string; contactEmail: string; durationDays: number }): TestAccount {
  const now = new Date()
  const expires = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000)
  const account: TestAccount = {
    id: `ta-new-${testAccountSeq++}`,
    customerName: input.customerName,
    contactEmail: input.contactEmail,
    createdAt: now.toISOString().split('T')[0],
    expiresAt: expires.toISOString().split('T')[0],
    converted: false,
  }
  TEST_ACCOUNTS.push(account)
  return account
}

export function updateTestAccount(id: string, updates: Partial<TestAccount>) {
  const idx = TEST_ACCOUNTS.findIndex(t => t.id === id)
  if (idx === -1) return
  TEST_ACCOUNTS[idx] = { ...TEST_ACCOUNTS[idx], ...updates }
}

export const INVITATIONS: Invitation[] = [
  { id: 'inv1', email: 'leitung@kinderhaus-wolke7.de', role: 'company', customerName: 'Kinderhaus Wolke 7', status: 'pending', sentAt: '2026-06-20' },
  { id: 'inv2', email: 'm.engel@lebenshilfe-rheinland.de', role: 'company', customerName: 'Lebenshilfe Rheinland', status: 'accepted', sentAt: '2023-09-10' },
]

let invitationSeq = 1000

export function addInvitation(input: { email: string; role: Role; customerName?: string }): Invitation {
  const invitation: Invitation = {
    id: `inv-new-${invitationSeq++}`,
    email: input.email,
    role: input.role,
    customerName: input.customerName,
    status: 'pending',
    sentAt: new Date().toISOString().split('T')[0],
  }
  INVITATIONS.push(invitation)
  return invitation
}

export const SUPPORT_LOG: SupportAccessLogEntry[] = [
  { id: 'sup1', customerName: 'Pflegeverbund Nord eG', requestedBy: 'Lea Okun', reason: 'Hilfe bei Einrichtung der Dienstplanung während der Testphase', grantedAt: '2026-06-02', revokedAt: '2026-06-02' },
  { id: 'sup2', customerName: 'Lebenshilfe Rheinland', requestedBy: 'Lea Okun', reason: 'Support-Ticket #4821: Urlaubsplan ließ sich nicht veröffentlichen', grantedAt: '2026-06-18' },
]

let supportLogSeq = 1000

export function addSupportAccess(input: { customerName: string; requestedBy: string; reason: string }): SupportAccessLogEntry {
  const entry: SupportAccessLogEntry = {
    id: `sup-new-${supportLogSeq++}`,
    customerName: input.customerName,
    requestedBy: input.requestedBy,
    reason: input.reason,
    grantedAt: new Date().toISOString().split('T')[0],
  }
  SUPPORT_LOG.push(entry)
  return entry
}

export function revokeSupportAccess(id: string) {
  const idx = SUPPORT_LOG.findIndex(s => s.id === id)
  if (idx === -1) return
  SUPPORT_LOG[idx] = { ...SUPPORT_LOG[idx], revokedAt: new Date().toISOString().split('T')[0] }
}

// ─── Organisationsweite Einstellungen (Geschäftsführung) ──────────────────────

export const ORG_SETTINGS: OrgSettings = {
  organizationName: 'BrightCare GmbH',
  defaultWeeklyHours: 38,
  defaultVacationDaysPerYear: 30,
  autoApproveVacationUnderDays: 0,
  notificationEmail: 'company@demo.de',
}

export function updateOrgSettings(updates: Partial<OrgSettings>) {
  Object.assign(ORG_SETTINGS, updates)
}

// ─── Zeiterfassung: Pausen, Überstunden, Abwesenheiten, Stundenkonto ──────────

let timeLogSeq = 1000

export function getActiveTimeLog(employeeId: string): TimeLog | undefined {
  return TIME_LOGS.find(t => t.employeeId === employeeId && !t.clockOut)
}

export function addTimeLog(input: { employeeId: string; date: string; clockIn: string; locationId: string }): TimeLog {
  const log: TimeLog = { id: `tl-new-${timeLogSeq++}`, ...input }
  TIME_LOGS.push(log)
  return log
}

export function updateTimeLog(id: string, updates: Partial<TimeLog>) {
  const idx = TIME_LOGS.findIndex(t => t.id === id)
  if (idx === -1) return
  TIME_LOGS[idx] = { ...TIME_LOGS[idx], ...updates }
}

export function startBreak(employeeId: string) {
  const log = getActiveTimeLog(employeeId)
  if (!log) return
  updateTimeLog(log.id, { breakStart: new Date().toTimeString().slice(0, 5) })
}

export function endBreak(employeeId: string) {
  const log = getActiveTimeLog(employeeId)
  if (!log || !log.breakStart) return
  const [bh, bm] = log.breakStart.split(':').map(Number)
  const now = new Date()
  const minutes = Math.max(0, (now.getHours() * 60 + now.getMinutes()) - (bh * 60 + bm))
  updateTimeLog(log.id, { breakMinutes: (log.breakMinutes ?? 0) + minutes, breakStart: undefined })
}

function standardDailyMinutes(employeeId: string): number {
  const emp = getEmployeeById(employeeId)
  return emp ? (emp.weeklyHours / 5) * 60 : 480
}

function workdaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

export const OVERTIME_REQUESTS: OvertimeRequest[] = []
let overtimeRequestSeq = 1000

export function addOvertimeRequest(input: {
  employeeId: string
  employeeName: string
  locationId: string
  date: string
  timeLogId: string
  overtimeMinutes: number
  reason: string
  comment?: string
}): OvertimeRequest {
  const request: OvertimeRequest = {
    id: `ot-new-${overtimeRequestSeq++}`,
    ...input,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  }
  OVERTIME_REQUESTS.push(request)
  return request
}

export function respondToOvertimeRequest(
  id: string,
  status: 'approved' | 'denied' | 'partial',
  respondedBy: string,
  approvedMinutes?: number,
  adminComment?: string
) {
  const idx = OVERTIME_REQUESTS.findIndex(o => o.id === id)
  if (idx === -1) return
  OVERTIME_REQUESTS[idx] = {
    ...OVERTIME_REQUESTS[idx],
    status,
    approvedMinutes: status === 'denied' ? 0 : (approvedMinutes ?? OVERTIME_REQUESTS[idx].overtimeMinutes),
    adminComment,
    respondedAt: new Date().toISOString(),
    respondedBy,
  }
}

export function getOvertimeRequestsByLocation(locationId: string): OvertimeRequest[] {
  return OVERTIME_REQUESTS.filter(o => o.locationId === locationId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function getOvertimeRequestsByEmployee(employeeId: string): OvertimeRequest[] {
  return OVERTIME_REQUESTS.filter(o => o.employeeId === employeeId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export const ABSENCES: Absence[] = []
let absenceSeq = 1000

export function addAbsence(input: {
  employeeId: string
  employeeName: string
  locationId: string
  type: Absence['type']
  startDate: string
  endDate: string
  days: number
  note?: string
  proofProvided: boolean
}): Absence {
  const absence: Absence = {
    id: `abs-new-${absenceSeq++}`,
    ...input,
    verificationStatus: 'offen',
    submittedAt: new Date().toISOString(),
  }
  ABSENCES.push(absence)
  return absence
}

export function updateAbsence(id: string, updates: Partial<Absence>) {
  const idx = ABSENCES.findIndex(a => a.id === id)
  if (idx === -1) return
  ABSENCES[idx] = { ...ABSENCES[idx], ...updates }
}

export function getAbsencesByLocation(locationId: string): Absence[] {
  return ABSENCES.filter(a => a.locationId === locationId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function getAbsencesByEmployee(employeeId: string): Absence[] {
  return ABSENCES.filter(a => a.employeeId === employeeId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function getHoursAccountSummary(employeeId: string, year: number, month: number): HoursAccountSummary {
  const logs = getTimeLogsByMonth(employeeId, year, month)
  const istMinutes = logs.reduce((s, t) => s + (t.totalMinutes ?? 0) - (t.breakMinutes ?? 0), 0)
  const breakMinutes = logs.reduce((s, t) => s + (t.breakMinutes ?? 0), 0)
  const sollMinutes = workdaysInMonth(year, month) * standardDailyMinutes(employeeId)

  const overtimeMinutes = OVERTIME_REQUESTS
    .filter(o => o.employeeId === employeeId && (o.status === 'approved' || o.status === 'partial') && o.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
    .reduce((s, o) => s + (o.approvedMinutes ?? 0), 0)
  const undertimeMinutes = Math.max(0, sollMinutes - istMinutes)

  const absences = ABSENCES.filter(a => a.employeeId === employeeId && a.startDate.startsWith(`${year}-${String(month).padStart(2, '0')}`))
  const sickDays = absences.filter(a => a.type === 'krankheit').reduce((s, a) => s + a.days, 0)
  const otherAbsenceDays = absences.filter(a => a.type !== 'krankheit').reduce((s, a) => s + a.days, 0)
  const vacationDays = VACATION_REQUESTS
    .filter(v => v.employeeId === employeeId && v.status === 'approved' && v.startDate.startsWith(`${year}-${String(month).padStart(2, '0')}`))
    .reduce((s, v) => s + v.days, 0)

  return { employeeId, year, month, sollMinutes, istMinutes, breakMinutes, overtimeMinutes, undertimeMinutes, vacationDays, sickDays, otherAbsenceDays }
}

export const MONTHLY_CLOSINGS: MonthlyClosing[] = []
let monthlyClosingSeq = 1000

export function getOrCreateMonthlyClosing(employeeId: string, year: number, month: number): MonthlyClosing {
  const existing = MONTHLY_CLOSINGS.find(m => m.employeeId === employeeId && m.year === year && m.month === month)
  if (existing) return existing

  const emp = getEmployeeById(employeeId)
  const summary = getHoursAccountSummary(employeeId, year, month)
  const arbeitstage = getTimeLogsByMonth(employeeId, year, month).length
  const approvalsCount = OVERTIME_REQUESTS.filter(
    o => o.employeeId === employeeId && o.status !== 'pending' && o.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)
  ).length

  const closing: MonthlyClosing = {
    id: `mc-new-${monthlyClosingSeq++}`,
    employeeId,
    employeeName: emp?.name ?? employeeId,
    locationId: emp?.locationId ?? '',
    year,
    month,
    status: 'offen',
    arbeitstage,
    sollMinutes: summary.sollMinutes,
    istMinutes: summary.istMinutes,
    breakMinutes: summary.breakMinutes,
    overtimeMinutes: summary.overtimeMinutes,
    undertimeMinutes: summary.undertimeMinutes,
    vacationDays: summary.vacationDays,
    sickDays: summary.sickDays,
    otherAbsenceDays: summary.otherAbsenceDays,
    approvalsCount,
    comments: [],
  }
  MONTHLY_CLOSINGS.push(closing)
  return closing
}

export function addMonthlyClosingComment(id: string, author: string, text: string) {
  const closing = MONTHLY_CLOSINGS.find(m => m.id === id)
  if (!closing) return
  closing.comments.push({ author, text, at: new Date().toISOString() })
  closing.status = closing.status === 'offen' ? 'geprueft' : closing.status
  closing.reviewedBy = author
  closing.reviewedAt = new Date().toISOString()
}

export function correctMonthlyClosingTimeLog(
  closingId: string,
  timeLogId: string,
  updates: Partial<Pick<TimeLog, 'clockIn' | 'clockOut' | 'breakMinutes' | 'note'>>,
  correctedBy: string
) {
  const closing = MONTHLY_CLOSINGS.find(m => m.id === closingId)
  const log = TIME_LOGS.find(t => t.id === timeLogId)
  if (!closing || !log) return

  if (updates.clockIn !== undefined) log.clockIn = updates.clockIn
  if (updates.clockOut !== undefined) log.clockOut = updates.clockOut
  if (updates.breakMinutes !== undefined) log.breakMinutes = updates.breakMinutes
  if (updates.note !== undefined) log.note = updates.note
  if (log.clockOut) {
    const [inH, inM] = log.clockIn.split(':').map(Number)
    const [outH, outM] = log.clockOut.split(':').map(Number)
    log.totalMinutes = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM))
  }

  const summary = getHoursAccountSummary(closing.employeeId, closing.year, closing.month)
  closing.sollMinutes = summary.sollMinutes
  closing.istMinutes = summary.istMinutes
  closing.breakMinutes = summary.breakMinutes
  closing.undertimeMinutes = summary.undertimeMinutes
  closing.comments.push({ author: correctedBy, text: `Korrektur am ${formatDateGerman(log.date)}: ${formatTimeLogChange(log)}`, at: new Date().toISOString() })
  closing.status = closing.status === 'offen' ? 'geprueft' : closing.status
  closing.reviewedBy = correctedBy
  closing.reviewedAt = new Date().toISOString()
}

function formatDateGerman(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

function formatTimeLogChange(log: TimeLog): string {
  return `${log.clockIn}–${log.clockOut ?? '?'} Uhr${log.breakMinutes ? `, ${log.breakMinutes} Min. Pause` : ''}`
}

export function releaseMonthlyClosing(id: string, releasedBy: string) {
  const closing = MONTHLY_CLOSINGS.find(m => m.id === id)
  if (!closing || closing.status === 'freigegeben') return
  closing.status = 'freigegeben'
  closing.releasedBy = releasedBy
  closing.releasedAt = new Date().toISOString()

  // Erst mit der Freigabe fließt der tatsächlich erfasste Saldo des Monats
  // (Ist minus Soll, abzüglich genehmigter Überstunden) in das offizielle
  // Stundenkonto des Mitarbeiters ein – das vereinheitlicht die Zeiterfassung
  // (Monatsabschluss) mit dem überall sonst angezeigten hoursBalance.
  const emp = EMPLOYEES.find(e => e.id === closing.employeeId)
  if (emp) {
    const netMinutes = (closing.istMinutes + closing.overtimeMinutes) - closing.sollMinutes
    emp.hoursBalance = Math.round((emp.hoursBalance + netMinutes / 60) * 10) / 10
  }
}

export function getMonthlyClosingsByLocation(locationId: string): MonthlyClosing[] {
  return MONTHLY_CLOSINGS.filter(m => m.locationId === locationId).sort((a, b) => b.year - a.year || b.month - a.month)
}

export function getMonthlyClosingsByEmployee(employeeId: string): MonthlyClosing[] {
  return MONTHLY_CLOSINGS.filter(m => m.employeeId === employeeId).sort((a, b) => b.year - a.year || b.month - a.month)
}
