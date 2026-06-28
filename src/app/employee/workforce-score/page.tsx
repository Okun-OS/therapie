'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/lib/auth-context'
import {
  LEVEL_LABEL, LEVEL_THRESHOLD, SCORE_REASON_LABEL, SCORE_POINTS,
  type WorkforceLevel,
} from '@/lib/workforce-score-constants'
import { Trophy, Gift, Sparkles } from 'lucide-react'

interface ScoreSummary {
  points: number
  level: WorkforceLevel
  nextLevel: WorkforceLevel | null
}

interface BonusConfig {
  level: WorkforceLevel
  bonusText: string | null
}

const LEVEL_COLOR: Record<WorkforceLevel, string> = {
  bronze: 'from-amber-700 to-amber-500',
  silber: 'from-gray-400 to-gray-300',
  gold: 'from-yellow-500 to-yellow-300',
  platin: 'from-slate-400 to-slate-200',
  diamant: 'from-cyan-400 to-blue-300',
}

export default function EmployeeWorkforceScore() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<ScoreSummary | null>(null)
  const [bonusConfigs, setBonusConfigs] = useState<BonusConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.employeeId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/workforce-score/me?employeeId=${user.employeeId}`).then(res => res.json()),
      fetch('/api/workforce-score/bonus-config').then(res => res.json()),
    ])
      .then(([meData, bonusData]) => {
        setSummary(meData.summary ?? null)
        setBonusConfigs(bonusData.configs ?? [])
      })
      .finally(() => setLoading(false))
  }, [user?.employeeId])

  const myBonus = bonusConfigs.find(c => c.level === summary?.level)
  const nextThreshold = summary?.nextLevel ? LEVEL_THRESHOLD[summary.nextLevel] : null
  const pointsToNext = nextThreshold !== null && summary ? Math.max(nextThreshold - summary.points, 0) : null
  const currentThreshold = summary ? LEVEL_THRESHOLD[summary.level] : 0
  const progress = nextThreshold !== null && summary
    ? Math.min(100, Math.round(((summary.points - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100

  return (
    <>
      <Header title="Mein Level" subtitle="Dein Workforce Score" />
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">Wird geladen...</div>
        ) : summary ? (
          <>
            <Card className={`bg-gradient-to-br ${LEVEL_COLOR[summary.level]} border-0 text-center`} padding="lg">
              <Trophy size={40} className="mx-auto text-white/90 mb-2" />
              <p className="text-white/80 text-sm font-medium">Aktuelles Level</p>
              <p className="text-white text-3xl font-bold mb-1">{LEVEL_LABEL[summary.level]}</p>
              <p className="text-white/80 text-sm">{summary.points} Punkte</p>
            </Card>

            {summary.nextLevel && (
              <Card padding="sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-navy">Nächstes Level: {LEVEL_LABEL[summary.nextLevel]}</p>
                  <p className="text-xs text-gray-400">noch {pointsToNext} Punkte</p>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </Card>
            )}

            {myBonus?.bonusText && (
              <Card padding="sm" className="bg-brand/10 border-brand/30">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center flex-shrink-0">
                    <Gift size={18} className="text-navy" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">Bonus für {LEVEL_LABEL[summary.level]}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{myBonus.bonusText}</p>
                  </div>
                </div>
              </Card>
            )}

            <Card padding="sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-brand-dark" />
                <p className="text-sm font-semibold text-navy">So sammelst du Punkte</p>
              </div>
              <div className="space-y-2">
                {Object.entries(SCORE_REASON_LABEL).map(([type, label]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold text-navy">+{SCORE_POINTS[type as keyof typeof SCORE_POINTS]}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-12">Keine Daten verfügbar</p>
        )}
      </div>
    </>
  )
}
