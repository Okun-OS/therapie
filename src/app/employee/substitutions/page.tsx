'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { usePush } from '@/lib/use-push'
import { PRIORITY_LABEL, type SubstitutionPriority } from '@/lib/substitution-constants'
import { formatDate } from '@/lib/utils'
import { Bell, BellRing, Calendar, Clock, CheckCircle2, XCircle, UserPlus, Sparkles } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface IncomingCandidate {
  id: string
  matchScore: number
  matchReasons: string[]
  request: {
    id: string
    date: string
    startTime: string
    endTime: string
    qualification: string | null
    priority: SubstitutionPriority
    note: string | null
  }
}

const PRIORITY_BADGE: Record<SubstitutionPriority, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
}

export default function EmployeeSubstitutions() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { supported, permission, subscribed, subscribe } = usePush(user?.employeeId)

  const [incoming, setIncoming] = useState<IncomingCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  const loadIncoming = async () => {
    if (!user?.employeeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/substitutions/incoming?employeeId=${user.employeeId}`)
      const data = await res.json()
      setIncoming(data.incoming ?? [])
    } catch {
      showToast('Anfragen konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadIncoming()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.employeeId])

  const handleRespond = async (requestId: string, action: 'accept' | 'decline') => {
    if (!user?.employeeId) return
    setRespondingId(requestId)
    try {
      const res = await fetch(`/api/substitutions/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user.employeeId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(action === 'accept' ? 'Vertretung übernommen' : 'Anfrage abgelehnt', action === 'accept' ? 'success' : 'info')
      loadIncoming()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Antwort fehlgeschlagen', 'error')
    } finally {
      setRespondingId(null)
    }
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-4">

        {supported && !subscribed && (
          <Card padding="sm" className="bg-navy-light/5 border-brand/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center flex-shrink-0">
                <Bell size={18} className="text-navy" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy">Push-Benachrichtigungen aktivieren</p>
                <p className="text-xs text-gray-500">Erhalte sofort eine Mitteilung bei neuen Vertretungsanfragen.</p>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await subscribe()
                  showToast(ok ? 'Push-Benachrichtigungen aktiviert' : 'Aktivierung nicht möglich', ok ? 'success' : 'error')
                }}
              >
                Aktivieren
              </Button>
            </div>
          </Card>
        )}

        {subscribed && (
          <div className="flex items-center gap-2 text-xs text-green-600 px-1">
            <BellRing size={14} />
            Push-Benachrichtigungen sind aktiv
          </div>
        )}

        {permission === 'denied' && (
          <p className="text-xs text-gray-400 px-1">Benachrichtigungen wurden im Browser blockiert. Bitte in den Browser-Einstellungen erlauben.</p>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-sm text-gray-400">Wird geladen...</div>
          ) : incoming.length === 0 ? (
            <EmptyState icon={UserPlus} title="Aktuell keine offenen Vertretungsanfragen" />
          ) : (
            incoming.map(c => (
              <Card key={c.id} padding="sm">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      <p className="text-sm font-semibold text-navy">{formatDate(c.request.date)}</p>
                      <Clock size={14} className="text-gray-400 ml-1" />
                      <p className="text-sm text-gray-600">{c.request.startTime} – {c.request.endTime}</p>
                    </div>
                    {c.request.qualification && <p className="text-xs text-gray-400 mt-1">Qualifikation: {c.request.qualification}</p>}
                    {c.request.note && <p className="text-xs text-gray-400 mt-1 italic">{c.request.note}</p>}
                  </div>
                  <Badge variant={PRIORITY_BADGE[c.request.priority]}>{PRIORITY_LABEL[c.request.priority]}</Badge>
                </div>

                {c.matchReasons.length > 0 && (
                  <div className="flex items-start gap-1.5 mb-3 bg-brand/10 rounded-xl px-3 py-2">
                    <Sparkles size={12} className="text-brand-dark mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-navy">{c.matchReasons.join(' · ')}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    className="flex-1 gap-1.5"
                    loading={respondingId === c.request.id}
                    onClick={() => handleRespond(c.request.id, 'accept')}
                  >
                    <CheckCircle2 size={14} />
                    Übernehmen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1.5 border border-gray-200"
                    loading={respondingId === c.request.id}
                    onClick={() => handleRespond(c.request.id, 'decline')}
                  >
                    <XCircle size={14} />
                    Ablehnen
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  )
}
