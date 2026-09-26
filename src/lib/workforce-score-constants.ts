export type WorkforceLevel = 'bronze' | 'silber' | 'gold' | 'platin' | 'diamant'

export const LEVEL_ORDER: WorkforceLevel[] = ['bronze', 'silber', 'gold', 'platin', 'diamant']

export const LEVEL_LABEL: Record<WorkforceLevel, string> = {
  bronze: 'Bronze',
  silber: 'Silber',
  gold: 'Gold',
  platin: 'Platin',
  diamant: 'Diamant',
}

export const LEVEL_THRESHOLD: Record<WorkforceLevel, number> = {
  bronze: 0,
  silber: 150,
  gold: 400,
  platin: 800,
  diamant: 1500,
}

export function getLevelForPoints(points: number): WorkforceLevel {
  let level: WorkforceLevel = 'bronze'
  for (const candidate of LEVEL_ORDER) {
    if (points >= LEVEL_THRESHOLD[candidate]) level = candidate
  }
  return level
}

export function getNextLevel(level: WorkforceLevel): WorkforceLevel | null {
  const idx = LEVEL_ORDER.indexOf(level)
  return LEVEL_ORDER[idx + 1] ?? null
}

export type ScoreEventType =
  | 'punctual_clock_in'
  | 'punctual_clock_out'
  | 'substitution_accepted'
  | 'substitution_accepted_short_notice'
  | 'overtime_stayed'

export const SCORE_POINTS: Record<ScoreEventType, number> = {
  punctual_clock_in: 5,
  punctual_clock_out: 5,
  substitution_accepted: 30,
  substitution_accepted_short_notice: 50,
  overtime_stayed: 10,
}

export const SCORE_REASON_LABEL: Record<ScoreEventType, string> = {
  punctual_clock_in: 'Pünktlich eingestempelt',
  punctual_clock_out: 'Pünktlich ausgestempelt',
  substitution_accepted: 'Vertretung übernommen',
  substitution_accepted_short_notice: 'Kurzfristig eingesprungen',
  overtime_stayed: 'Länger geblieben',
}

export const PUNCTUALITY_TOLERANCE_MINUTES = 10
export const SHORT_NOTICE_HOURS = 48
export const OVERTIME_MIN_MINUTES = 20
export const OVERTIME_MAX_DAILY_POINTS = 20
