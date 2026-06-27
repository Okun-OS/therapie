'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { LEVEL_LABEL, LEVEL_ORDER, type WorkforceLevel } from '@/lib/workforce-score-constants'
import { Trophy, Medal } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface LeaderboardEntry {
  employeeId: string
  employeeName: string
  points: number
  level: WorkforceLevel
}

interface BonusConfig {
  level: WorkforceLevel
  bonusText: string | null
}

const LEVEL_BADGE: Record<WorkforceLevel, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  bronze: 'default',
  silber: 'info',
  gold: 'warning',
  platin: 'purple',
  diamant: 'success',
}

export default function AdminWorkforceScore() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [bonusConfigs, setBonusConfigs] = useState<BonusConfig[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingLevel, setSavingLevel] = useState<WorkforceLevel | null>(null)

  const load = async () => {
    if (!user?.locationId) return
    setLoading(true)
    try {
      const [lbRes, bonusRes] = await Promise.all([
        fetch(`/api/workforce-score/leaderboard?locationId=${user.locationId}`).then(r => r.json()),
        fetch('/api/workforce-score/bonus-config').then(r => r.json()),
      ])
      setLeaderboard(lbRes.leaderboard ?? [])
      const configs: BonusConfig[] = bonusRes.configs ?? []
      setBonusConfigs(configs)
      setDrafts(Object.fromEntries(configs.map(c => [c.level, c.bonusText ?? ''])))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.locationId])

  const handleSaveBonus = async (level: WorkforceLevel) => {
    setSavingLevel(level)
    try {
      const res = await fetch('/api/workforce-score/bonus-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, bonusText: drafts[level] ?? '' }),
      })
      if (!res.ok) throw new Error()
      showToast('Bonus-Text gespeichert', 'success')
      load()
    } catch {
      showToast('Speichern fehlgeschlagen', 'error')
    } finally {
      setSavingLevel(null)
    }
  }

  return (
    <>
      <Header title="Workforce Score" subtitle="Ranking deines Standorts" />
      <div className="p-4 sm:p-6 space-y-5">
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-brand-dark" />
            <p className="text-sm font-semibold text-navy">Rangliste</p>
          </div>
          {loading ? (
            <div className="text-center py-8 text-sm text-gray-400">Wird geladen...</div>
          ) : leaderboard.length === 0 ? (
            <EmptyState icon={Trophy} title="Noch keine Punkte vergeben" />
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => (
                <div key={entry.employeeId} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-navy flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="flex-1 text-sm font-medium text-navy truncate">{entry.employeeName}</p>
                  <Badge variant={LEVEL_BADGE[entry.level]}>{LEVEL_LABEL[entry.level]}</Badge>
                  <p className="text-sm font-bold text-navy w-12 text-right">{entry.points}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="sm">
          <div className="flex items-center gap-2 mb-3">
            <Medal size={16} className="text-brand-dark" />
            <p className="text-sm font-semibold text-navy">Bonus-Texte pro Level</p>
          </div>
          <p className="text-xs text-gray-400 mb-3">Rein informativ – kein automatischer Auszahlungsbezug.</p>
          <div className="space-y-3">
            {LEVEL_ORDER.map(level => (
              <div key={level} className="flex items-start gap-2">
                <span className="text-xs font-semibold text-navy w-16 pt-2 flex-shrink-0">{LEVEL_LABEL[level]}</span>
                <Input
                  type="text"
                  value={drafts[level] ?? ''}
                  onChange={e => setDrafts(prev => ({ ...prev, [level]: e.target.value }))}
                  placeholder="z. B. Gutschein, Tankgutschein, ..."
                  containerClassName="flex-1"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="border border-gray-200"
                  loading={savingLevel === level}
                  onClick={() => handleSaveBonus(level)}
                >
                  Speichern
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
