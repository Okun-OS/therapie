// Schulferien-Stammdaten (öffentliche Kalenderdaten, kein Demo-Geschäftsdatum) –
// bewusst als statische Konstante, nicht als DB-Tabelle, siehe mock-data.ts-Historie.
import type { SchoolHoliday } from './types'

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
