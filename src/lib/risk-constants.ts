export type RiskLevel = 'niedrig' | 'mittel' | 'hoch'

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 60) return 'hoch'
  if (score >= 35) return 'mittel'
  return 'niedrig'
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, { label: string; color: string }> = {
  niedrig: { label: 'Niedrig', color: 'text-green-600 bg-green-100' },
  mittel: { label: 'Mittel', color: 'text-amber-600 bg-amber-100' },
  hoch: { label: 'Hoch', color: 'text-red-600 bg-red-100' },
}
