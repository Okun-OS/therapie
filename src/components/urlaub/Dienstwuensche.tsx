'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Badge } from '@/components/ui/Badge'

interface EmployeeRequest {
  id: string
  employeeId: string
  locationId: string
  type: string
  status: string
  priority: string
  date?: string
  dateFrom?: string
  dateTo?: string
  shiftId?: string
  reason?: string
  submittedAt: string
  respondedAt?: string
  respondedBy?: string
}

const TYPE_LABELS: Record<string, string> = {
  shift_wish: 'Schichtwunsch',
  day_off_wish: 'Freiwunsch',
  vacation: 'Urlaub',
  absence: 'Abwesenheit',
  overtime_reduce: 'Überstunden abbauen',
  overtime_compensate: 'Minusstunden ausgleichen',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  denied: 'Abgelehnt',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Dringend',
  normal: 'Normal',
  low: 'Niedrig',
}

export function Dienstwuensche() {
  const { user } = useAuth()
  const locationId = user?.locationId
  const [requests, setRequests] = useState<EmployeeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!locationId) return
    setLoading(true)
    const params = new URLSearchParams({ locationId })
    if (filter !== 'all') params.set('status', filter)
    fetch(`/api/employee-requests?${params}`)
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId, filter])

  useEffect(() => { load() }, [load])

  async function respond(id: string, status: 'approved' | 'denied') {
    setActionLoading(id)
    try {
      await fetch(`/api/employee-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      load()
    } catch {
      // ignore
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Mitarbeiter-Anfragen</h1>
          <p className="text-sm text-gray-500 mt-1">
            Schichtwünsche, Freiwünsche und Sonderanfragen Ihrer Mitarbeiter
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
            {pendingCount} ausstehend
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'all', 'approved', 'denied'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Alle' : f === 'pending' ? 'Ausstehend' : f === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Lade Anfragen…</div>
      ) : requests.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center bg-white rounded-2xl border border-gray-100">
          Keine Anfragen vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-navy">
                    {TYPE_LABELS[req.type] ?? req.type}
                  </span>
                  <Badge variant={
                    req.status === 'approved' ? 'success'
                    : req.status === 'denied' ? 'danger'
                    : 'warning'
                  }>
                    {STATUS_LABELS[req.status] ?? req.status}
                  </Badge>
                  {req.priority && req.priority !== 'normal' && (
                    <Badge variant={req.priority === 'urgent' ? 'danger' : 'info'}>
                      {PRIORITY_LABELS[req.priority] ?? req.priority}
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  {req.date && <div>Datum: {req.date}</div>}
                  {req.dateFrom && req.dateTo && <div>Zeitraum: {req.dateFrom} – {req.dateTo}</div>}
                  {req.reason && <div>Grund: {req.reason}</div>}
                  <div className="text-gray-400">
                    Eingereicht: {new Date(req.submittedAt).toLocaleDateString('de-DE')}
                    {req.respondedAt && ` · Bearbeitet: ${new Date(req.respondedAt).toLocaleDateString('de-DE')}`}
                  </div>
                </div>
              </div>

              {req.status === 'pending' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => respond(req.id, 'approved')}
                    disabled={actionLoading === req.id}
                    className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700"
                  >
                    Genehmigen
                  </button>
                  <button
                    onClick={() => respond(req.id, 'denied')}
                    disabled={actionLoading === req.id}
                    className="px-4 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-red-100 border border-red-200"
                  >
                    Ablehnen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

