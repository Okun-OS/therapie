'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { UserPlus, AlertTriangle, CheckCircle2, Clock, XCircle, Building2, ChevronDown, ChevronUp } from 'lucide-react'
import { ESCALATION_LABEL, PRIORITY_LABEL } from '@/lib/substitution-constants'
import type { EscalationStage, SubstitutionPriority } from '@/lib/substitution-constants'

interface Candidate {
  id: string
  employeeName: string
  matchScore: number
  responseStatus: string
  escalationStage: string
}

interface SubstitutionRequest {
  id: string
  locationId: string
  date: string
  startTime: string
  endTime: string
  qualification?: string
  priority: string
  status: string
  escalationStage: string
  note?: string
  createdBy: string
  createdAt: string
  filledByEmployeeId?: string
  candidates: Candidate[]
}

interface LocationInfo {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: 'Offen', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  filled: { label: 'Besetzt', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  cancelled: { label: 'Storniert', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: XCircle },
  expired: { label: 'Abgelaufen', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
    </div>
  )
}

function RequestRow({ req, locationName }: { req: SubstitutionRequest; locationName: string }) {
  const [expanded, setExpanded] = useState(false)
  const status = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.open
  const StatusIcon = status.icon
  const acceptedCandidate = req.candidates.find(c => c.responseStatus === 'accepted')
  const pendingCount = req.candidates.filter(c => c.responseStatus === 'pending').length

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg border ${status.color}`}>
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-lg border ${PRIORITY_COLOR[req.priority] ?? ''}`}>
            {PRIORITY_LABEL[req.priority as SubstitutionPriority] ?? req.priority}
          </span>
          <span className="text-sm font-medium text-gray-800">{formatDate(req.date)}</span>
          <span className="text-sm text-gray-500">{req.startTime}–{req.endTime}</span>
          {req.qualification && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">{req.qualification}</span>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <Building2 className="w-3 h-3" />
            {locationName}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          <span>Eskalationsstufe: <strong>{ESCALATION_LABEL[req.escalationStage as EscalationStage] ?? req.escalationStage}</strong></span>
          {pendingCount > 0 && <span>{pendingCount} Kandidat(en) kontaktiert</span>}
          {acceptedCandidate && <span className="text-green-600">Besetzt durch {acceptedCandidate.employeeName}</span>}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50 space-y-3">
          {req.note && (
            <p className="text-sm text-gray-600"><span className="font-medium">Notiz:</span> {req.note}</p>
          )}
          <p className="text-xs text-gray-400">Erstellt von {req.createdBy} · {new Date(req.createdAt).toLocaleDateString('de-DE')}</p>

          {req.candidates.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Kandidaten</p>
              <div className="space-y-1.5">
                {req.candidates.map(c => (
                  <div key={c.id} className="flex items-center gap-3 text-sm bg-white rounded-xl px-3 py-2 border border-gray-100">
                    <span className="font-medium text-gray-800 flex-1">{c.employeeName}</span>
                    <span className="text-xs text-gray-400">Match {c.matchScore}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${
                      c.responseStatus === 'accepted' ? 'bg-green-100 text-green-700' :
                      c.responseStatus === 'declined' ? 'bg-red-100 text-red-700' :
                      c.responseStatus === 'expired' ? 'bg-gray-100 text-gray-500' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {c.responseStatus === 'accepted' ? 'Zugesagt' :
                       c.responseStatus === 'declined' ? 'Abgelehnt' :
                       c.responseStatus === 'expired' ? 'Abgelaufen' : 'Ausstehend'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Noch keine Kandidaten kontaktiert.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CompanySubstitutionsPage() {
  const [requests, setRequests] = useState<SubstitutionRequest[]>([])
  const [locations, setLocations] = useState<LocationInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/substitutions')
      .then(r => r.json())
      .then(d => {
        setRequests(d.requests ?? [])
        if (d.locations) setLocations(d.locations)
      })
      .finally(() => setLoading(false))
  }, [])

  const locationName = (id: string) => locations.find(l => l.id === id)?.name ?? id

  const filtered = statusFilter === 'all' ? requests : requests.filter(r => r.status === statusFilter)

  const open = requests.filter(r => r.status === 'open').length
  const urgent = requests.filter(r => r.status === 'open' && r.priority === 'urgent').length
  const filled = requests.filter(r => r.status === 'filled').length
  const org = requests.filter(r => r.status === 'open' && r.escalationStage === 'organization').length

  // Group by location
  const byLocation = filtered.reduce<Record<string, SubstitutionRequest[]>>((acc, r) => {
    if (!acc[r.locationId]) acc[r.locationId] = []
    acc[r.locationId].push(r)
    return acc
  }, {})

  return (
    <>
      

      <div className="p-4 sm:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value={open} label="Offen" color="bg-amber-50 border-amber-100 text-amber-800" />
          <StatCard value={urgent} label="Dringend" color="bg-red-50 border-red-100 text-red-800" />
          <StatCard value={filled} label="Besetzt" color="bg-green-50 border-green-100 text-green-800" />
          <StatCard value={org} label="Org.-eskaliert" color="bg-violet-50 border-violet-100 text-violet-800" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'Alle' },
            { key: 'open', label: 'Offen' },
            { key: 'filled', label: 'Besetzt' },
            { key: 'cancelled', label: 'Storniert' },
            { key: 'expired', label: 'Abgelaufen' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.key
                  ? 'bg-navy text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-navy border-t-brand rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Keine Vertretungsanfragen"
            description={statusFilter === 'all' ? 'Es gibt noch keine Vertretungsanfragen in Ihrem Unternehmen.' : 'Keine Anfragen mit diesem Status.'}
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(byLocation).map(([locId, reqs]) => (
              <Card key={locId} className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-4 h-4 text-navy" />
                  <h3 className="font-semibold text-navy">{locationName(locId)}</h3>
                  <span className="ml-auto text-xs text-gray-400">{reqs.length} Anfrage(n)</span>
                </div>
                <div className="space-y-2">
                  {reqs.map(req => (
                    <RequestRow key={req.id} req={req} locationName={locationName(req.locationId)} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
