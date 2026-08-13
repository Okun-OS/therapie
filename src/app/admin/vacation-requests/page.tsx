'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { CheckCircle, XCircle, Clock, Palmtree, Calendar, Sparkles, Loader2, AlertTriangle } from 'lucide-react'
import { formatDate, sanitizeAiText } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import type { VacationRequest, RequestStatus, VacationRecommendation, VacationRules, Employee } from '@/lib/types'

const STANCE_CONFIG: Record<VacationRecommendation['stance'], { label: string; color: string; bg: string }> = {
  empfehlung_genehmigen: { label: 'Empfehlung: Genehmigen', color: 'text-green-700', bg: 'bg-green-50 border-green-100' },
  empfehlung_pruefen: { label: 'Empfehlung: Prüfen', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
  empfehlung_ablehnen: { label: 'Empfehlung: Ablehnen', color: 'text-red-700', bg: 'bg-red-50 border-red-100' },
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}

export default function AdminVacationRequests() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const locationId = user?.locationId

  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')
  const [selected, setSelected] = useState<VacationRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [recommendation, setRecommendation] = useState<VacationRecommendation | null>(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [vacationRules, setVacationRulesState] = useState<VacationRules | null>(null)

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
  }, [])

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/vacation-requests?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => setRequests(((d.requests ?? []) as VacationRequest[]).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))))
  }, [locationId])

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/vacation-rules?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => setVacationRulesState(d.rules ?? null))
      .catch(() => setVacationRulesState(null))
  }, [locationId])

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pending = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const denied = requests.filter(r => r.status === 'denied')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selected || selected.status !== 'pending') {
      setRecommendation(null)
      return
    }
    const emp = EMPLOYEES.find(e => e.id === selected.employeeId)
    const rules = vacationRules
    const overlapping = requests
      .filter(r => r.id !== selected.id && r.status === 'approved' && r.locationId === selected.locationId)
      .filter(r => rangesOverlap(selected.startDate, selected.endDate, r.startDate, r.endDate))
      .map(r => ({ employeeName: r.employeeName, startDate: r.startDate, endDate: r.endDate }))

    setRecommendationLoading(true)
    setRecommendation(null)
    fetch('/api/ai/vacation-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facilityDescription: rules?.facilityDescription,
        customRules: rules?.customRules,
        maxConcurrent: rules?.maxConcurrent,
        request: {
          employeeName: selected.employeeName,
          startDate: selected.startDate,
          endDate: selected.endDate,
          days: selected.days,
          reason: selected.reason,
          remainingDays: emp ? emp.vacationDaysTotal - emp.vacationDaysUsed : 0,
        },
        overlapping,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.stance && data.reasoning) {
          setRecommendation({ stance: data.stance, reasoning: sanitizeAiText(data.reasoning) })
        }
      })
      .catch(() => {})
      .finally(() => setRecommendationLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, locationId, requests, vacationRules])

  const handleApprove = async (id: string) => {
    const req = requests.find(r => r.id === id)
    const updated = await fetch(`/api/vacation-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', respondedBy: user?.name || 'Admin' }),
    }).then(r => r.json()).then(d => d.request)
    setRequests(prev => prev.map(r => r.id === id ? updated : r))
    setSelected(null)
    showToast('Urlaubsantrag genehmigt', 'success')
    if (req) {
      fetch('/api/vacation-requests/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: req.employeeId, requestId: req.id, status: 'approved', startDate: req.startDate, endDate: req.endDate }),
      }).catch(() => {})
    }
  }

  const handleDeny = async (id: string) => {
    const req = requests.find(r => r.id === id)
    const updated = await fetch(`/api/vacation-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'denied', respondedBy: user?.name || 'Admin' }),
    }).then(r => r.json()).then(d => d.request)
    setRequests(prev => prev.map(r => r.id === id ? updated : r))
    setSelected(null)
    setRejectNote('')
    showToast('Urlaubsantrag abgelehnt', 'info')
    if (req) {
      fetch('/api/vacation-requests/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: req.employeeId, requestId: req.id, status: 'denied', startDate: req.startDate, endDate: req.endDate, reason: rejectNote || undefined }),
      }).catch(() => {})
    }
  }

  const statusConfig = {
    approved: { label: 'Genehmigt', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', badge: 'success' as const },
    denied: { label: 'Abgelehnt', icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', badge: 'danger' as const },
    pending: { label: 'Ausstehend', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'warning' as const },
  }

  if (!locationId) {
    return (
      <>
        
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor hier Urlaubsanträge angezeigt werden können. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
            <p className="text-xs text-amber-700 font-medium">Offen</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{approved.length}</p>
            <p className="text-xs text-green-700 font-medium">Genehmigt</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{denied.length}</p>
            <p className="text-xs text-red-700 font-medium">Abgelehnt</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl border border-gray-100 p-1.5">
          {[
            { key: 'all', label: 'Alle', count: requests.length },
            { key: 'pending', label: 'Offen', count: pending.length },
            { key: 'approved', label: 'Genehmigt', count: approved.length },
            { key: 'denied', label: 'Abgelehnt', count: denied.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${filter === key ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {label}
              <span className={`text-[10px] px-1.5 rounded-full ${filter === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Request List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState icon={Palmtree} title="Keine Anträge" />
          ) : (
            filtered.map(req => {
              const cfg = statusConfig[req.status]
              const Icon = cfg.icon
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-4 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelected(req)}
                >
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} className={cfg.color} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-navy">{req.employeeName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar size={12} className="text-gray-400" />
                          <p className="text-xs text-gray-500">{formatDate(req.startDate)} – {formatDate(req.endDate)}</p>
                          <span className="text-xs text-gray-400">({req.days} Tage)</span>
                        </div>
                        {req.reason && <p className="text-xs text-gray-400 mt-1 italic">{req.reason}</p>}
                      </div>
                      <Badge variant={cfg.badge}>{cfg.label}</Badge>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={e => { e.stopPropagation(); handleApprove(req.id) }}
                          className="gap-1"
                        >
                          <CheckCircle size={14} />
                          Genehmigen
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={e => { e.stopPropagation(); setSelected(req) }}
                          className="gap-1"
                        >
                          <XCircle size={14} />
                          Ablehnen
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Detail / Deny Modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setRejectNote('') }} title="Urlaubsantrag">
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-lg font-bold text-navy">{selected.employeeName}</p>
              <p className="text-gray-600 text-sm mt-1">{formatDate(selected.startDate)} bis {formatDate(selected.endDate)}</p>
              <p className="text-gray-500 text-sm">{selected.days} Arbeitstage</p>
              {selected.reason && <p className="text-sm text-gray-600 mt-2 italic">&bdquo;{selected.reason}&ldquo;</p>}
              <p className="text-xs text-gray-400 mt-2">Eingereicht: {formatDate(selected.submittedAt)}</p>
            </div>

            {selected.status === 'pending' && (
              <>
                {recommendationLoading ? (
                  <div className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> KI prüft den Antrag…
                  </div>
                ) : recommendation ? (
                  <div className={`rounded-xl border p-3 ${STANCE_CONFIG[recommendation.stance].bg}`}>
                    <p className={`text-xs font-bold flex items-center gap-1.5 ${STANCE_CONFIG[recommendation.stance].color}`}>
                      <Sparkles size={12} />{STANCE_CONFIG[recommendation.stance].label}
                    </p>
                    <p className={`text-sm mt-1 ${STANCE_CONFIG[recommendation.stance].color}`}>{recommendation.reasoning}</p>
                  </div>
                ) : null}

                <div>
                  <Textarea
                    label="Ablehnungsgrund (optional)"
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    rows={2}
                    placeholder="z.B. Zu viele gleichzeitige Abwesenheiten..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1 gap-2" onClick={() => handleDeny(selected.id)}>
                    <XCircle size={16} />
                    Ablehnen
                  </Button>
                  <Button variant="success" className="flex-1 gap-2" onClick={() => handleApprove(selected.id)}>
                    <CheckCircle size={16} />
                    Genehmigen
                  </Button>
                </div>
              </>
            )}

            {selected.status !== 'pending' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <Badge variant={selected.status === 'approved' ? 'success' : 'danger'}>
                    {selected.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
                  </Badge>
                </div>
                {selected.respondedBy && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Von:</span>
                    <span className="text-navy font-medium">{selected.respondedBy}</span>
                  </div>
                )}
                <Button variant="ghost" className="w-full border border-gray-200" onClick={() => setSelected(null)}>Schließen</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
