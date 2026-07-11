'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/lib/toast-context'
import { LifeBuoy, Shield, ShieldOff, Clock, Plus, ChevronRight, MessageSquare, Lock } from 'lucide-react'

interface Ticket {
  id: string
  ticketId: string
  title: string
  status: string
  priority: string
  createdAt: string
  messages: { id: string }[]
}

interface Grant {
  id: string
  ticketId: string
  scope: string
  expiresAt: string
  createdAt: string
  revokedAt: string | null
  ticket: { ticketId: string; title: string }
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Neu',
  in_progress: 'In Bearbeitung',
  waiting: 'Rückfrage',
  resolved: 'Gelöst',
  closed: 'Geschlossen',
}

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  new: 'info',
  in_progress: 'warning',
  waiting: 'warning',
  resolved: 'success',
  closed: 'danger',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CompanySupportPage() {
  const { showToast } = useToast()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [grants, setGrants] = useState<Grant[]>([])
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)

  // Grant modal state
  const [grantModal, setGrantModal] = useState(false)
  const [grantTicketId, setGrantTicketId] = useState('')
  const [grantScope, setGrantScope] = useState('readonly')
  const [grantHours, setGrantHours] = useState(24)
  const [grantLoading, setGrantLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [ticketsRes, grantsRes] = await Promise.all([
      fetch('/api/support-tickets').then(r => r.ok ? r.json() : { tickets: [] }),
      fetch('/api/support-access-grants').then(r => r.ok ? r.json() : { grants: [] }),
    ])
    setTickets(ticketsRes.tickets ?? [])
    setGrants(grantsRes.grants ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const activeGrantsForTicket = (ticketDbId: string) =>
    grants.filter(g => g.ticketId === ticketDbId && !g.revokedAt && new Date(g.expiresAt) > new Date())

  const handleOpenGrantModal = (ticket: Ticket) => {
    setGrantTicketId(ticket.id)
    setGrantScope('readonly')
    setGrantHours(24)
    setGrantModal(true)
  }

  const handleCreateGrant = async () => {
    setGrantLoading(true)
    const res = await fetch('/api/support-access-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: grantTicketId, scope: grantScope, expiresInHours: grantHours }),
    })
    if (res.ok) {
      showToast('Support-Zugriff erteilt', 'success')
      setGrantModal(false)
      loadData()
    } else {
      const data = await res.json()
      showToast(data.error ?? 'Fehler beim Erteilen', 'error')
    }
    setGrantLoading(false)
  }

  const handleRevoke = async (grantId: string) => {
    const res = await fetch(`/api/support-access-grants/${grantId}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Zugriff widerrufen', 'success')
      loadData()
    } else {
      showToast('Fehler beim Widerrufen', 'error')
    }
  }

  const allActiveGrants = grants.filter(g => !g.revokedAt && new Date(g.expiresAt) > new Date())

  return (
    <>
      <Header title="Support" subtitle="Tickets & Datenzugriff verwalten" />
      <div className="p-4 sm:p-6 space-y-5">

        {/* Active grants overview */}
        {allActiveGrants.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={18} className="text-amber-600" />
              <p className="font-semibold text-navy text-sm">Aktive Support-Zugriffe ({allActiveGrants.length})</p>
            </div>
            <div className="space-y-2">
              {allActiveGrants.map(g => (
                <div key={g.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{g.ticket.title}</p>
                    <p className="text-xs text-gray-500">
                      Ticket {g.ticket.ticketId} · {g.scope === 'readonly' ? 'Lesezugriff' : 'Vollzugriff'} · Läuft ab: {fmtDate(g.expiresAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevoke(g.id)}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <ShieldOff size={14} />
                    Widerrufen
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 mt-3">
              Das OKUN-Support-Team hat derzeit Zugriff auf Ihre Daten. Sie können jeden Zugriff jederzeit widerrufen.
            </p>
          </div>
        )}

        {/* Tickets list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-semibold text-navy text-sm">Meine Support-Anfragen</p>
            <span className="text-xs text-gray-400">{tickets.length} Anfragen</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Lade…</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center">
              <LifeBuoy size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Keine Support-Anfragen vorhanden.</p>
              <p className="text-xs text-gray-400 mt-1">Nutzen Sie den Support-Button in der App, um eine Anfrage zu stellen.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tickets.map(ticket => {
                const activeGrants = activeGrantsForTicket(ticket.id)
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelected(ticket)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-navy/5 flex items-center justify-center shrink-0">
                      <MessageSquare size={15} className="text-navy/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-navy truncate">{ticket.title}</p>
                        {activeGrants.length > 0 && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                            <Shield size={10} />
                            Zugriff aktiv
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {ticket.ticketId} · {fmtDate(ticket.createdAt)} · {ticket.messages.length} Nachricht{ticket.messages.length !== 1 ? 'en' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={STATUS_VARIANT[ticket.status] ?? 'info'}>
                        {STATUS_LABEL[ticket.status] ?? ticket.status}
                      </Badge>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Data access info box */}
        <div className="bg-navy/5 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-navy" />
            <p className="font-semibold text-navy text-sm">Datenschutz & Support-Zugriff</p>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            OKUN-Mitarbeiter haben standardmäßig keinen Zugriff auf Ihre Daten. Wenn Sie Support anfordern, können Sie
            für ein bestimmtes Ticket zeitlich begrenzten Zugriff erteilen. Dieser Zugriff ist jederzeit widerrufbar
            und wird vollständig protokolliert.
          </p>
        </div>

      </div>

      {/* Ticket detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Ticket ${selected.ticketId}` : ''}
        size="lg"
      >
        {selected && (() => {
          const ticketGrants = grants.filter(g => g.ticketId === selected.id)
          const activeGrants = ticketGrants.filter(g => !g.revokedAt && new Date(g.expiresAt) > new Date())

          return (
            <div className="space-y-4">
              <div>
                <p className="font-bold text-navy">{selected.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={STATUS_VARIANT[selected.status] ?? 'info'}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </Badge>
                  <span className="text-xs text-gray-400">{fmtDate(selected.createdAt)}</span>
                </div>
              </div>

              {/* Grant access section */}
              <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-navy" />
                    <p className="text-sm font-semibold text-navy">Support-Zugriff</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 border border-gray-200 text-xs"
                    onClick={() => { setSelected(null); handleOpenGrantModal(selected) }}
                  >
                    <Plus size={12} />
                    Zugriff erteilen
                  </Button>
                </div>

                {activeGrants.length === 0 ? (
                  <p className="text-xs text-gray-400">Kein aktiver Support-Zugriff für dieses Ticket.</p>
                ) : (
                  <div className="space-y-2">
                    {activeGrants.map(g => (
                      <div key={g.id} className="flex items-center gap-3 bg-amber-50 rounded-lg p-2.5">
                        <Clock size={14} className="text-amber-600 shrink-0" />
                        <div className="flex-1 min-w-0 text-xs">
                          <span className="font-semibold text-amber-800">
                            {g.scope === 'readonly' ? 'Lesezugriff' : 'Vollzugriff'}
                          </span>
                          <span className="text-amber-700"> · Läuft ab {fmtDate(g.expiresAt)}</span>
                        </div>
                        <button
                          onClick={() => handleRevoke(g.id)}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          <ShieldOff size={12} />
                          Widerrufen
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {ticketGrants.filter(g => g.revokedAt || new Date(g.expiresAt) <= new Date()).length > 0 && (
                  <p className="text-xs text-gray-400">
                    + {ticketGrants.filter(g => g.revokedAt || new Date(g.expiresAt) <= new Date()).length} abgelaufene/widerrufene Zugriffe
                  </p>
                )}
              </div>

              <Button variant="ghost" className="w-full border border-gray-200" onClick={() => setSelected(null)}>
                Schließen
              </Button>
            </div>
          )
        })()}
      </Modal>

      {/* Grant access modal */}
      <Modal
        open={grantModal}
        onClose={() => setGrantModal(false)}
        title="Support-Zugriff erteilen"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              Sie erteilen dem OKUN-Support-Team temporären Zugriff auf Ihre Daten, um Ihr Anliegen zu bearbeiten.
              Der Zugriff wird vollständig protokolliert und kann jederzeit widerrufen werden.
            </p>
          </div>

          <Select
            label="Zugriffsumfang"
            value={grantScope}
            onChange={e => setGrantScope(e.target.value)}
          >
            <option value="readonly">Lesezugriff (empfohlen)</option>
            <option value="full">Vollzugriff (nur bei Datenproblemen)</option>
          </Select>

          <Select
            label="Gültigkeitsdauer"
            value={grantHours.toString()}
            onChange={e => setGrantHours(Number(e.target.value))}
          >
            <option value="4">4 Stunden</option>
            <option value="24">24 Stunden</option>
            <option value="48">48 Stunden</option>
            <option value="72">72 Stunden</option>
            <option value="168">1 Woche</option>
          </Select>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setGrantModal(false)}>
              Abbrechen
            </Button>
            <Button className="flex-1" onClick={handleCreateGrant} loading={grantLoading}>
              Zugriff erteilen
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
