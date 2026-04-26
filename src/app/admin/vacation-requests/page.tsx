'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/lib/auth-context'
import { VACATION_REQUESTS } from '@/lib/mock-data'
import { CheckCircle, XCircle, Clock, Palmtree, Calendar, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { VacationRequest, RequestStatus } from '@/lib/types'

export default function AdminVacationRequests() {
  const { user } = useAuth()
  const locationId = user?.locationId || 'loc1'

  const [requests, setRequests] = useState(
    VACATION_REQUESTS.filter(v => v.locationId === locationId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  )
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')
  const [selected, setSelected] = useState<VacationRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pending = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const denied = requests.filter(r => r.status === 'denied')

  const handleApprove = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved', respondedAt: new Date().toISOString().split('T')[0], respondedBy: user?.name } : r))
    setSelected(null)
  }

  const handleDeny = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'denied', respondedAt: new Date().toISOString().split('T')[0], respondedBy: user?.name } : r))
    setSelected(null)
    setRejectNote('')
  }

  const statusConfig = {
    approved: { label: 'Genehmigt', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', badge: 'success' as const },
    denied: { label: 'Abgelehnt', icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', badge: 'danger' as const },
    pending: { label: 'Ausstehend', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100', badge: 'warning' as const },
  }

  return (
    <>
      <Header title="Urlaubsanträge" subtitle={`${pending.length} offen`} />
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
            <div className="text-center py-12">
              <Palmtree size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">Keine Anträge</p>
            </div>
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
                <div>
                  <label className="block text-sm font-semibold text-navy mb-1.5">Ablehnungsgrund (optional)</label>
                  <div className="relative">
                    <MessageSquare size={14} className="absolute left-3 top-3 text-gray-400" />
                    <textarea
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="z.B. Zu viele gleichzeitige Abwesenheiten..."
                      className="w-full pl-8 pr-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                    />
                  </div>
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
