'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { FeatureIntro } from '@/components/onboarding/FeatureIntro'
import { SubstitutionChat } from '@/components/substitutions/SubstitutionChat'
import type { SubstitutionDraft } from '@/lib/substitution-draft'
import { ESCALATION_LABEL, PRIORITY_LABEL, type SubstitutionPriority } from '@/lib/substitution-constants'
import { formatDate } from '@/lib/utils'
import { UserPlus, MessageCircle, Calendar, Clock, TrendingUp, ChevronUp, CheckCircle2, XCircle, Hourglass } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface Candidate {
  id: string
  employeeId: string
  employeeName: string
  matchScore: number
  matchReasons: string[]
  escalationStage: string
  responseStatus: 'pending' | 'accepted' | 'declined' | 'expired'
}

interface SubRequest {
  id: string
  locationId: string
  date: string
  startTime: string
  endTime: string
  qualification: string | null
  priority: SubstitutionPriority
  status: 'open' | 'filled' | 'cancelled' | 'expired'
  escalationStage: 'group' | 'location' | 'organization' | 'springerpool'
  note: string | null
  createdAt: string
  filledByEmployeeId: string | null
  candidates: Candidate[]
}

const PRIORITY_BADGE: Record<SubstitutionPriority, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
}

const STATUS_BADGE: Record<SubRequest['status'], 'default' | 'success' | 'warning' | 'danger'> = {
  open: 'warning',
  filled: 'success',
  cancelled: 'danger',
  expired: 'danger',
}

const STATUS_LABEL: Record<SubRequest['status'], string> = {
  open: 'Offen',
  filled: 'Besetzt',
  cancelled: 'Storniert',
  expired: 'Abgelaufen',
}

const RESPONSE_LABEL: Record<Candidate['responseStatus'], string> = {
  pending: 'Wartet auf Antwort',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
}

export default function AdminSubstitutions() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const locationId = user?.locationId || 'loc1'

  const [requests, setRequests] = useState<SubRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [escalatingId, setEscalatingId] = useState<string | null>(null)

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/substitutions?locationId=${locationId}`)
      const data = await res.json()
      setRequests(data.requests ?? [])
    } catch {
      showToast('Anfragen konnten nicht geladen werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId])

  const handleCreateFromChat = async (draft: SubstitutionDraft) => {
    if (!draft.date || !draft.startTime || !draft.endTime) {
      showToast('Anfrage konnte nicht erstellt werden', 'error')
      return
    }
    try {
      const res = await fetch('/api/substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          date: draft.date,
          startTime: draft.startTime,
          endTime: draft.endTime,
          qualification: draft.qualification || undefined,
          priority: (draft.priority ?? 'normal') as SubstitutionPriority,
          note: draft.note || undefined,
          createdBy: user?.id ?? 'adm1',
        }),
      })
      if (!res.ok) throw new Error()
      showToast('Vertretungsanfrage erstellt und Kandidaten benachrichtigt', 'success')
      loadRequests()
    } catch {
      showToast('Anfrage konnte nicht erstellt werden', 'error')
    }
  }

  const handleEscalate = async (id: string) => {
    setEscalatingId(id)
    try {
      const res = await fetch(`/api/substitutions/${id}/escalate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast('Auf die nächste Eskalationsstufe ausgeweitet', 'success')
      loadRequests()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Eskalation fehlgeschlagen', 'error')
    } finally {
      setEscalatingId(null)
    }
  }

  const open = requests.filter(r => r.status === 'open')
  const filled = requests.filter(r => r.status === 'filled')

  return (
    <>
      <Header title="Vertretungsmanagement" subtitle={`${open.length} offene Anfragen`} />
      <div className="p-4 sm:p-6 space-y-4">
        <FeatureIntro
          featureKey="admin-substitutions"
          text="Hier können Sie kurzfristig offene Dienste veröffentlichen. Alle geeigneten Mitarbeiter erhalten automatisch eine Push-Nachricht und können den Dienst übernehmen."
        />

        <div className="flex gap-3">
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{open.length}</p>
              <p className="text-xs text-amber-700 font-medium">Offen</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{filled.length}</p>
              <p className="text-xs text-green-700 font-medium">Besetzt</p>
            </div>
          </div>
          <Button onClick={() => setChatOpen(true)} className="gap-2 self-stretch">
            <MessageCircle size={16} />
            Ausfall melden
          </Button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-sm text-gray-400">Wird geladen...</div>
          ) : requests.length === 0 ? (
            <EmptyState icon={UserPlus} title="Noch keine Vertretungsanfragen" />
          ) : (
            requests.map(req => (
              <Card key={req.id} padding="sm">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      <p className="text-sm font-semibold text-navy">{formatDate(req.date)}</p>
                      <Clock size={14} className="text-gray-400 ml-1" />
                      <p className="text-sm text-gray-600">{req.startTime} – {req.endTime}</p>
                    </div>
                    {req.qualification && <p className="text-xs text-gray-400 mt-1">Qualifikation: {req.qualification}</p>}
                    {req.note && <p className="text-xs text-gray-400 mt-1 italic">{req.note}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={PRIORITY_BADGE[req.priority]}>{PRIORITY_LABEL[req.priority]}</Badge>
                    <Badge variant={STATUS_BADGE[req.status]}>{STATUS_LABEL[req.status]}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                  <TrendingUp size={12} />
                  Eskalationsstufe: <span className="font-medium text-navy">{ESCALATION_LABEL[req.escalationStage]}</span>
                  {req.status === 'open' && req.escalationStage !== 'springerpool' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 ml-auto border border-gray-200"
                      loading={escalatingId === req.id}
                      onClick={() => handleEscalate(req.id)}
                    >
                      <ChevronUp size={12} />
                      Eskalieren
                    </Button>
                  )}
                </div>

                {req.candidates.length > 0 && (
                  <div className="space-y-1.5">
                    {req.candidates.map(c => (
                      <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {c.responseStatus === 'accepted' && <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />}
                            {c.responseStatus === 'declined' && <XCircle size={14} className="text-red-400 flex-shrink-0" />}
                            {c.responseStatus === 'pending' && <Hourglass size={14} className="text-amber-400 flex-shrink-0" />}
                            {c.responseStatus === 'expired' && <Hourglass size={14} className="text-gray-300 flex-shrink-0" />}
                            <span className="text-sm text-navy font-medium truncate">{c.employeeName}</span>
                            <span className="text-xs text-gray-400">{c.matchScore}%</span>
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0">{RESPONSE_LABEL[c.responseStatus]}</span>
                        </div>
                        {c.matchReasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
                            {c.matchReasons.map((reason, i) => (
                              <span key={i} className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      <SubstitutionChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onSave={handleCreateFromChat}
      />
    </>
  )
}
