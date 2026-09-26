'use client'

import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/lib/toast-context'
import { LifeBuoy, Send, Lock, ChevronDown, AlertTriangle, MessageSquare } from 'lucide-react'

interface TicketMessage {
  id: string
  body: string
  authorName: string
  authorRole: string
  internal: boolean
  createdAt: string
}

interface Ticket {
  id: string
  ticketId: string
  status: string
  priority: string
  category: string | null
  title: string
  description: string | null
  userName: string
  userRole: string
  customerName: string | null
  locationId: string | null
  currentPage: string | null
  browser: string | null
  os: string | null
  screenSize: string | null
  consoleErrors: string | null
  lastActions: string | null
  assignedTo: string | null
  adminNotes: string | null
  createdAt: string
  resolvedAt: string | null
  closedAt: string | null
  messages: TicketMessage[]
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  in_review: 'In Prüfung',
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  waiting: 'Rückfrage',
  resolved: 'Gelöst',
  closed: 'Geschlossen',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_review: 'bg-purple-100 text-purple-700',
  open: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-amber-100 text-amber-700',
  waiting: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-gray-100 text-gray-600',
  low: 'bg-blue-50 text-blue-500',
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Kritisch',
  high: 'Hoch',
  normal: 'Normal',
  low: 'Niedrig',
}

const FILTER_TABS = [
  { key: '', label: 'Alle' },
  { key: 'new', label: 'Neu' },
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'waiting', label: 'Rückfrage' },
  { key: 'resolved', label: 'Gelöst' },
  { key: 'closed', label: 'Geschlossen' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'gerade eben'
  if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} Min.`
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std.`
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export default function OkunSupportPage() {
  const { showToast } = useToast()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchTickets = async (s?: string) => {
    const params = new URLSearchParams()
    if (s) params.set('status', s)
    const data = await fetch(`/api/support-tickets?${params}`).then(r => r.json())
    setTickets(data.tickets ?? [])
  }

  useEffect(() => { fetchTickets(filter) }, [filter])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.messages.length])

  const selectTicket = (t: Ticket) => {
    setSelected(t)
    setAdminNotes(t.adminNotes ?? '')
    setReply('')
    setInternal(false)
    setShowNotes(false)
  }

  const sendReply = async () => {
    if (!selected || !reply.trim()) return
    setSendingReply(true)
    try {
      const res = await fetch(`/api/support-tickets/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim(), internal }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const updated = { ...selected, messages: [...selected.messages, data.message], status: selected.status === 'new' || selected.status === 'open' ? 'in_progress' : selected.status }
      setSelected(updated)
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
      setReply('')
      showToast(internal ? 'Interne Notiz gespeichert' : 'Antwort gesendet', 'success')
    } catch {
      showToast('Fehler beim Senden', 'error')
    } finally {
      setSendingReply(false)
    }
  }

  const updateStatus = async (status: string) => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, status }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSelected(data.ticket)
      setTickets(prev => prev.map(t => t.id === data.ticket.id ? data.ticket : t))
      showToast(`Status: ${STATUS_LABELS[status] ?? status}`, 'success')
    } catch {
      showToast('Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveNotes = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, adminNotes }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSelected(data.ticket)
      setTickets(prev => prev.map(t => t.id === data.ticket.id ? data.ticket : t))
      showToast('Notizen gespeichert', 'success')
    } catch {
      showToast('Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      

      <div className="flex h-[calc(100vh-130px)] overflow-hidden">
        {/* Left: Ticket list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col bg-white">
          {/* Filter tabs */}
          <div className="flex gap-1 p-3 border-b border-gray-100 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Ticket cards */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {tickets.length === 0 && (
              <div className="text-center py-12 px-4">
                <LifeBuoy size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Keine Tickets gefunden</p>
              </div>
            )}
            {tickets.map(t => (
              <button
                key={t.id}
                onClick={() => selectTicket(t)}
                className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                  selected?.id === t.id ? 'bg-teal-50 border-l-2 border-teal-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400">{t.ticketId}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 truncate mb-1">{t.title}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                    {PRIORITY_LABELS[t.priority] ?? t.priority}
                  </span>
                  <span className="text-xs text-gray-400 truncate">{t.customerName ?? t.userName}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{fmtDateShort(t.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Ticket detail */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Ticket auswählen</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            {/* Ticket header */}
            <div className="bg-white border-b border-gray-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">{selected.ticketId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selected.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[selected.status] ?? selected.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[selected.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                      {PRIORITY_LABELS[selected.priority] ?? selected.priority}
                    </span>
                    {selected.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{selected.category}</span>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">{selected.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selected.userName} ({selected.userRole})
                    {selected.customerName && ` · ${selected.customerName}`}
                    {' · '}{fmtDate(selected.createdAt)}
                  </p>
                </div>
                {/* Status actions */}
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                  {selected.status !== 'in_review' && (
                    <button onClick={() => updateStatus('in_review')} disabled={saving} className="text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50">
                      In Prüfung
                    </button>
                  )}
                  {selected.status !== 'waiting' && (
                    <button onClick={() => updateStatus('waiting')} disabled={saving} className="text-xs px-2.5 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50">
                      Rückfrage
                    </button>
                  )}
                  {selected.status !== 'resolved' && (
                    <button onClick={() => updateStatus('resolved')} disabled={saving} className="text-xs px-2.5 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50">
                      Gelöst
                    </button>
                  )}
                  {selected.status !== 'closed' && (
                    <button onClick={() => updateStatus('closed')} disabled={saving} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                      Schließen
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Metadata */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Technische Details</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {selected.currentPage && <><span className="text-gray-400">Seite</span><span className="text-gray-700 font-mono truncate">{selected.currentPage}</span></>}
                  {selected.browser && <><span className="text-gray-400">Browser</span><span className="text-gray-700">{selected.browser}</span></>}
                  {selected.os && <><span className="text-gray-400">OS</span><span className="text-gray-700">{selected.os}</span></>}
                  {selected.screenSize && <><span className="text-gray-400">Auflösung</span><span className="text-gray-700">{selected.screenSize}</span></>}
                </div>
                {selected.description && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mb-1">Beschreibung</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
                  </div>
                )}
                {selected.consoleErrors && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><AlertTriangle size={12} className="text-orange-500" /> Konsolenfehler</p>
                    <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">{selected.consoleErrors}</pre>
                  </div>
                )}
                {selected.lastActions && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mb-1">Letzte Aktionen</p>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">{selected.lastActions}</p>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="space-y-2">
                {selected.messages.map(m => (
                  <div key={m.id} className={`rounded-xl p-3 ${m.internal ? 'bg-yellow-50 border border-yellow-100' : 'bg-white border border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {m.internal && <Lock size={11} className="text-yellow-600" />}
                      <span className="text-xs font-semibold text-gray-700">{m.authorName}</span>
                      <span className="text-xs text-gray-400">{m.authorRole}</span>
                      {m.internal && <span className="text-xs text-yellow-600 font-medium">· Interne Notiz</span>}
                      <span className="text-xs text-gray-400 ml-auto">{fmtDate(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Admin notes (collapsible) */}
              <div className="bg-white rounded-xl border border-gray-100">
                <button
                  onClick={() => setShowNotes(v => !v)}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                >
                  <span className="flex items-center gap-2"><Lock size={14} className="text-gray-400" /> Admin-Notizen</span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
                </button>
                {showNotes && (
                  <div className="p-3 pt-0 space-y-2">
                    <Textarea
                      value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)}
                      placeholder="Interne Notizen (nur für OKUN-Team sichtbar)…"
                      rows={3}
                    />
                    <Button size="sm" onClick={saveNotes} disabled={saving}>Speichern</Button>
                  </div>
                )}
              </div>
            </div>

            {/* Reply box */}
            <div className="bg-white border-t border-gray-100 p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium text-gray-600">Antwort</span>
                <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={e => setInternal(e.target.checked)}
                    className="w-3.5 h-3.5 rounded"
                  />
                  <Lock size={12} className="text-yellow-600" />
                  <span className="text-xs text-yellow-700 font-medium">Interne Notiz</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder={internal ? 'Interne Notiz (nicht für Kunden sichtbar)…' : 'Antwort an den Nutzer…'}
                  rows={2}
                  className={`flex-1 ${internal ? 'bg-yellow-50 border-yellow-200' : ''}`}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                />
                <Button onClick={sendReply} disabled={sendingReply || !reply.trim()} className="self-end gap-1.5">
                  <Send size={14} />
                  {internal ? 'Notiz' : 'Senden'}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">⌘+Enter zum Senden</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
