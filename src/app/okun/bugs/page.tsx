'use client'

import { useState, useEffect } from 'react'
import { Bug, RefreshCw, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'

interface BugReport {
  id: string
  ticketId: string
  status: string
  priority: string
  severity: string
  userName: string | null
  userRole: string | null
  customerName: string | null
  title: string
  description: string | null
  page: string | null
  browser: string | null
  os: string | null
  screenSize: string | null
  lastActions: string | null
  consoleErrors: string | null
  adminNotes: string | null
  createdAt: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Neu', color: 'bg-red-100 text-red-700' },
  in_progress: { label: 'In Bearbeitung', color: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Gelöst', color: 'bg-green-100 text-green-700' },
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Niedrig', color: 'text-gray-500' },
  normal: { label: 'Normal', color: 'text-blue-600' },
  high: { label: 'Hoch', color: 'text-red-600' },
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Kleiner Fehler',
  normal: 'Mittlerer Fehler',
  high: 'Kritischer Fehler',
}

export default function BugsPage() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('open')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, { status: string; adminNotes: string }>>({})

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/bug-reports?status=${filterStatus === 'all' ? '' : filterStatus}`)
    const data = await res.json()
    setReports(data.reports ?? [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [filterStatus])

  async function update(id: string) {
    const e = editing[id]
    if (!e) return
    await fetch('/api/bug-reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: e.status, adminNotes: e.adminNotes }),
    })
    await load()
    setExpanded(null)
  }

  function startEdit(r: BugReport) {
    setEditing(prev => ({
      ...prev,
      [r.id]: { status: r.status, adminNotes: r.adminNotes ?? '' },
    }))
    setExpanded(r.id)
  }

  const statusCounts = {
    open: reports.filter(r => r.status === 'open').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-5">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'open', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', label: 'Neue Bugs' },
            { key: 'in_progress', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'In Bearbeitung' },
            { key: 'resolved', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'Gelöst' },
          ].map(({ key, icon: Icon, color, bg, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`rounded-2xl p-4 text-left transition-all border-2 ${filterStatus === key ? 'border-teal-400' : 'border-transparent'} ${bg}`}
            >
              <Icon size={20} className={`${color} mb-1`} />
              <p className="text-2xl font-bold text-navy">{statusCounts[key as keyof typeof statusCounts]}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          {['open', 'in_progress', 'resolved', 'all'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'open' ? 'Neu' : s === 'in_progress' ? 'In Bearbeitung' : s === 'resolved' ? 'Gelöst' : 'Alle'}
            </button>
          ))}
          <button onClick={load} className="ml-auto p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <Bug size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Keine Einträge gefunden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(r => {
              const st = STATUS_LABELS[r.status] ?? STATUS_LABELS['open']
              const pr = PRIORITY_LABELS[r.priority] ?? PRIORITY_LABELS['normal']
              const isExpanded = expanded === r.id
              const edit = editing[r.id]
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div
                    className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => isExpanded ? setExpanded(null) : startEdit(r)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-gray-400">{r.ticketId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.color}`}>{st.label}</span>
                        <span className={`text-xs font-medium ${pr.color}`}>{pr.label}</span>
                        {r.severity === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">KRITISCH</span>}
                      </div>
                      <p className="text-sm font-semibold text-navy truncate">{r.title}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {r.userName && <span className="text-xs text-gray-400">{r.userName} ({r.userRole})</span>}
                        {r.customerName && <span className="text-xs text-gray-400">· {r.customerName}</span>}
                        {r.page && <span className="text-xs text-gray-400">· {r.page}</span>}
                        <span className="text-xs text-gray-400">· {new Date(r.createdAt).toLocaleDateString('de-DE')}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-gray-400 shrink-0 mt-0.5" />}
                  </div>

                  {isExpanded && edit && (
                    <div className="border-t border-gray-100 p-4 space-y-4">
                      {/* Technical info */}
                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                        {r.browser && <div><span className="font-medium">Browser:</span> {r.browser}</div>}
                        {r.os && <div><span className="font-medium">OS:</span> {r.os}</div>}
                        {r.screenSize && <div className="col-span-2"><span className="font-medium">Bildschirm:</span> {r.screenSize}</div>}
                        {r.page && <div className="col-span-2"><span className="font-medium">Seite:</span> {r.page}</div>}
                      </div>

                      {r.description && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">Beschreibung</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-3">{r.description}</p>
                        </div>
                      )}

                      {r.lastActions && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">Letzte Aktionen</p>
                          <pre className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap font-mono">{r.lastActions}</pre>
                        </div>
                      )}

                      {/* Admin controls */}
                      <div className="space-y-3 pt-2 border-t border-gray-100">
                        <div className="flex gap-2">
                          {['open', 'in_progress', 'resolved'].map(s => (
                            <button
                              key={s}
                              onClick={() => setEditing(prev => ({ ...prev, [r.id]: { ...edit, status: s } }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                edit.status === s ? 'bg-navy text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {STATUS_LABELS[s]?.label}
                            </button>
                          ))}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            <MessageSquare size={10} className="inline mr-1" />Bearbeitungsnotiz
                          </label>
                          <textarea
                            value={edit.adminNotes}
                            onChange={e => setEditing(prev => ({ ...prev, [r.id]: { ...edit, adminNotes: e.target.value } }))}
                            rows={2}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                            placeholder="Interne Notiz..."
                          />
                        </div>
                        <button
                          onClick={() => update(r.id)}
                          className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
