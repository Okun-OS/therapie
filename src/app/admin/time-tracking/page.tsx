'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import {
  getOvertimeRequestsByLocation, respondToOvertimeRequest,
  getAbsencesByLocation, updateAbsence, getMonthlyClosingsByLocation,
  getOrCreateMonthlyClosing, addMonthlyClosingComment,
  getTimeLogsByMonth, correctMonthlyClosingTimeLog,
} from '@/lib/mock-data'
import type { OvertimeRequest, Absence, AbsenceType, MonthlyClosing, TimeLog, Employee } from '@/lib/types'
import {
  AlertCircle, CheckCircle, XCircle, Clock, Stethoscope, FileText, ChevronDown, ChevronUp,
  MessageSquare, ShieldCheck, ShieldX, Pencil,
} from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  krankheit: 'Krankheit',
  fortbildung: 'Fortbildung',
  sonstige: 'Sonstige Abwesenheit',
  entschuldigt: 'Entschuldigte Fehlzeit',
  unentschuldigt: 'Unentschuldigte Fehlzeit',
}

const CLOSING_STATUS_LABEL: Record<string, { label: string; variant: 'warning' | 'success' | 'info' }> = {
  offen: { label: 'Offen', variant: 'warning' },
  geprueft: { label: 'Geprüft', variant: 'info' },
  freigegeben: { label: 'Freigegeben', variant: 'success' },
}

type Tab = 'overtime' | 'absences' | 'closings'

export default function AdminTimeTracking() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const locationId = user?.locationId || 'loc1'

  const [, forceRender] = useState(0)
  const refresh = () => forceRender(n => n + 1)

  const [tab, setTab] = useState<Tab>('overtime')

  const overtimeRequests = getOvertimeRequestsByLocation(locationId)
  const pendingOvertimeCount = overtimeRequests.filter(o => o.status === 'pending').length

  const absences = getAbsencesByLocation(locationId)
  const openAbsenceCount = absences.filter(a => a.verificationStatus === 'offen').length

  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setAllEmployees(d.employees))
  }, [])
  const employees = allEmployees.filter(e => e.locationId === locationId && (e.role === 'employee' || e.role === 'admin'))
  const now = new Date()
  for (const emp of employees) {
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      getOrCreateMonthlyClosing(emp.id, d.getFullYear(), d.getMonth() + 1, emp)
    }
  }
  const closings = getMonthlyClosingsByLocation(locationId)

  const [selectedOvertime, setSelectedOvertime] = useState<OvertimeRequest | null>(null)
  const [approvedMinutes, setApprovedMinutes] = useState(0)
  const [adminComment, setAdminComment] = useState('')

  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null)

  const [expandedClosing, setExpandedClosing] = useState<string | null>(null)
  const [closingComment, setClosingComment] = useState('')
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null)
  const [editingClosingId, setEditingClosingId] = useState<string | null>(null)
  const [editClockIn, setEditClockIn] = useState('')
  const [editClockOut, setEditClockOut] = useState('')
  const [editBreakMinutes, setEditBreakMinutes] = useState(0)

  const openOvertimeModal = (req: OvertimeRequest) => {
    setSelectedOvertime(req)
    setApprovedMinutes(req.overtimeMinutes)
    setAdminComment('')
  }

  const handleRespondOvertime = (status: 'approved' | 'denied' | 'partial') => {
    if (!selectedOvertime || !user) return
    respondToOvertimeRequest(
      selectedOvertime.id,
      status,
      user.name,
      status === 'partial' ? approvedMinutes : undefined,
      adminComment.trim() || undefined
    )
    setSelectedOvertime(null)
    showToast(
      status === 'approved' ? 'Überstunden genehmigt' : status === 'denied' ? 'Überstunden abgelehnt' : 'Überstunden teilweise genehmigt',
      status === 'denied' ? 'info' : 'success'
    )
    refresh()
  }

  const handleVerifyAbsence = (status: 'geprueft' | 'abgelehnt', type?: AbsenceType) => {
    if (!selectedAbsence || !user) return
    updateAbsence(selectedAbsence.id, {
      verificationStatus: status,
      type: type ?? selectedAbsence.type,
      verifiedBy: user.name,
      verifiedAt: new Date().toISOString(),
    })
    setSelectedAbsence(null)
    showToast('Abwesenheit aktualisiert', 'success')
    refresh()
  }

  const handleAddClosingComment = (closing: MonthlyClosing) => {
    if (!closingComment.trim() || !user) return
    addMonthlyClosingComment(closing.id, user.name, closingComment.trim())
    setClosingComment('')
    showToast('Kommentar hinzugefügt', 'success')
    refresh()
  }

  const handleReleaseClosing = async (closing: MonthlyClosing) => {
    if (!user) return
    await fetch('/api/time-tracking/release-closing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closingId: closing.id, releasedBy: user.name }),
    })
    showToast('Monatsabschluss freigegeben – Stundenkonto wurde aktualisiert', 'success')
    refresh()
  }

  const openEditLog = (log: TimeLog, closingId: string) => {
    setEditingLog(log)
    setEditingClosingId(closingId)
    setEditClockIn(log.clockIn)
    setEditClockOut(log.clockOut ?? '')
    setEditBreakMinutes(log.breakMinutes ?? 0)
  }

  const handleSaveCorrection = () => {
    if (!editingLog || !editingClosingId || !user) return
    correctMonthlyClosingTimeLog(
      editingClosingId,
      editingLog.id,
      { clockIn: editClockIn, clockOut: editClockOut || undefined, breakMinutes: editBreakMinutes },
      user.name
    )
    setEditingLog(null)
    setEditingClosingId(null)
    showToast('Korrektur gespeichert', 'success')
    refresh()
  }

  return (
    <>
      <Header title="Zeiterfassung" subtitle="Überstunden, Abwesenheiten und Monatsabschluss prüfen" />
      <div className="p-4 sm:p-6 space-y-4">

        {/* Tab bar */}
        <div className="flex bg-white border border-gray-100 rounded-2xl p-1">
          {([
            { key: 'overtime', label: 'Überstunden', badge: pendingOvertimeCount },
            { key: 'absences', label: 'Abwesenheiten', badge: openAbsenceCount },
            { key: 'closings', label: 'Monatsabschluss', badge: 0 },
          ] as const).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${tab === key ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {label}
              {badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === key ? 'bg-brand text-navy' : 'bg-red-100 text-red-600'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ÜBERSTUNDEN ──────────────────────────────────────── */}
        {tab === 'overtime' && (
          <Card>
            <CardHeader>
              <CardTitle>Überstundenanträge</CardTitle>
              <Badge variant="default">{overtimeRequests.length}</Badge>
            </CardHeader>
            <div className="space-y-2">
              {overtimeRequests.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Keine Überstundenanträge</p>
              ) : (
                overtimeRequests.map(req => {
                  const statusCfg = {
                    pending: { label: 'Ausstehend', variant: 'warning' as const },
                    approved: { label: 'Genehmigt', variant: 'success' as const },
                    denied: { label: 'Abgelehnt', variant: 'danger' as const },
                    partial: { label: 'Teilweise genehmigt', variant: 'info' as const },
                  }[req.status]
                  return (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => req.status === 'pending' && openOvertimeModal(req)}
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <AlertCircle size={16} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy">{req.employeeName} · {formatDate(req.date)}</p>
                        <p className="text-xs text-gray-500">+{formatTime(req.overtimeMinutes)} · {req.reason}</p>
                        {req.comment && <p className="text-xs text-gray-400 italic">{req.comment}</p>}
                      </div>
                      <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        )}

        {/* ── ABWESENHEITEN ────────────────────────────────────── */}
        {tab === 'absences' && (
          <Card>
            <CardHeader>
              <CardTitle>Krankheiten und Abwesenheiten</CardTitle>
              <Badge variant="default">{absences.length}</Badge>
            </CardHeader>
            <div className="space-y-2">
              {absences.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Keine Meldungen</p>
              ) : (
                absences.map(absence => {
                  const statusCfg = {
                    offen: { label: 'Offen', variant: 'warning' as const },
                    geprueft: { label: 'Geprüft', variant: 'success' as const },
                    abgelehnt: { label: 'Abgelehnt', variant: 'danger' as const },
                  }[absence.verificationStatus]
                  return (
                    <div
                      key={absence.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => setSelectedAbsence(absence)}
                    >
                      <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Stethoscope size={16} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy">{absence.employeeName} · {ABSENCE_TYPE_LABEL[absence.type]}</p>
                        <p className="text-xs text-gray-500">{formatDate(absence.startDate)} – {formatDate(absence.endDate)} ({absence.days} Tage){absence.proofProvided ? ' · Nachweis vorhanden' : ''}</p>
                      </div>
                      <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        )}

        {/* ── MONATSABSCHLUSS ──────────────────────────────────── */}
        {tab === 'closings' && (
          <Card>
            <CardHeader>
              <CardTitle>Monatsabschluss</CardTitle>
              <Badge variant="default">{closings.length}</Badge>
            </CardHeader>
            <div className="space-y-2">
              {closings.map(closing => {
                const key = closing.id
                const isOpen = expandedClosing === key
                const status = CLOSING_STATUS_LABEL[closing.status]
                return (
                  <div key={closing.id} className="rounded-xl bg-gray-50 overflow-hidden">
                    <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedClosing(isOpen ? null : key)}>
                      <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                        <FileText size={16} className="text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy">{closing.employeeName} · {MONTH_NAMES[closing.month - 1]} {closing.year}</p>
                        <p className="text-xs text-gray-500">{closing.arbeitstage} Arbeitstage · {closing.approvalsCount} Genehmigungen</p>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <p>Soll: <span className="font-semibold text-navy">{formatTime(closing.sollMinutes)}</span></p>
                          <p>Ist: <span className="font-semibold text-navy">{formatTime(closing.istMinutes)}</span></p>
                          <p>Pausen: <span className="font-semibold text-navy">{formatTime(closing.breakMinutes)}</span></p>
                          <p>Überstunden: <span className="font-semibold text-navy">{formatTime(closing.overtimeMinutes)}</span></p>
                          <p>Minusstunden: <span className="font-semibold text-navy">{formatTime(closing.undertimeMinutes)}</span></p>
                          <p>Urlaub: <span className="font-semibold text-navy">{closing.vacationDays} Tage</span></p>
                          <p>Krankheit: <span className="font-semibold text-navy">{closing.sickDays} Tage</span></p>
                          <p>Fehlzeiten: <span className="font-semibold text-navy">{closing.otherAbsenceDays} Tage</span></p>
                        </div>
                        <div className="space-y-1 pt-1 border-t border-gray-200">
                          <p className="text-xs font-semibold text-navy pt-2">Gebuchte Zeiten</p>
                          {getTimeLogsByMonth(closing.employeeId, closing.year, closing.month).map(log => (
                            <div key={log.id} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="flex-1">{formatDate(log.date)} · {log.clockIn}–{log.clockOut ?? '–'} Uhr{log.breakMinutes ? ` · ${log.breakMinutes} Min. Pause` : ''}</span>
                              {closing.status !== 'freigegeben' && (
                                <button onClick={() => openEditLog(log, closing.id)} className="text-gray-400 hover:text-navy">
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {closing.comments.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-gray-200">
                            {closing.comments.map((c, i) => (
                              <p key={i} className="text-xs text-gray-500"><span className="font-semibold text-navy">{c.author}:</span> {c.text}</p>
                            ))}
                          </div>
                        )}
                        {closing.status !== 'freigegeben' && (
                          <>
                            <div className="relative">
                              <MessageSquare size={13} className="absolute left-3 top-2.5 text-gray-400" />
                              <input
                                value={closingComment}
                                onChange={e => setClosingComment(e.target.value)}
                                placeholder="Kommentar ergänzen..."
                                className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" className="flex-1 border border-gray-200" onClick={() => handleAddClosingComment(closing)}>Kommentar speichern</Button>
                              <Button size="sm" variant="success" className="flex-1 gap-1.5" onClick={() => handleReleaseClosing(closing)}>
                                <CheckCircle size={13} />
                                Freigeben
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Überstunden-Genehmigung */}
      <Modal open={!!selectedOvertime} onClose={() => setSelectedOvertime(null)} title="Überstundenantrag prüfen">
        {selectedOvertime && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-lg font-bold text-navy">{selectedOvertime.employeeName}</p>
              <p className="text-gray-600 text-sm mt-1">{formatDate(selectedOvertime.date)} · +{formatTime(selectedOvertime.overtimeMinutes)}</p>
              <p className="text-gray-500 text-sm">{selectedOvertime.reason}</p>
              {selectedOvertime.comment && <p className="text-sm text-gray-600 mt-2 italic">&bdquo;{selectedOvertime.comment}&ldquo;</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Genehmigte Minuten (bei Teilgenehmigung)</label>
              <input
                type="number"
                min={0}
                max={selectedOvertime.overtimeMinutes}
                value={approvedMinutes}
                onChange={e => setApprovedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Kommentar (optional)</label>
              <textarea
                value={adminComment}
                onChange={e => setAdminComment(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1 gap-1.5" onClick={() => handleRespondOvertime('denied')}>
                <XCircle size={15} />
                Ablehnen
              </Button>
              <Button variant="ghost" className="flex-1 border border-gray-200 gap-1.5" onClick={() => handleRespondOvertime('partial')}>
                <Clock size={15} />
                Teilweise
              </Button>
              <Button variant="success" className="flex-1 gap-1.5" onClick={() => handleRespondOvertime('approved')}>
                <CheckCircle size={15} />
                Genehmigen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Abwesenheit prüfen */}
      <Modal open={!!selectedAbsence} onClose={() => setSelectedAbsence(null)} title="Abwesenheit prüfen">
        {selectedAbsence && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-lg font-bold text-navy">{selectedAbsence.employeeName}</p>
              <p className="text-gray-600 text-sm mt-1">{ABSENCE_TYPE_LABEL[selectedAbsence.type]}</p>
              <p className="text-gray-500 text-sm">{formatDate(selectedAbsence.startDate)} – {formatDate(selectedAbsence.endDate)} ({selectedAbsence.days} Tage)</p>
              {selectedAbsence.note && <p className="text-sm text-gray-600 mt-2 italic">&bdquo;{selectedAbsence.note}&ldquo;</p>}
              <p className="text-xs text-gray-400 mt-2">{selectedAbsence.proofProvided ? 'Nachweis liegt vor' : 'Kein Nachweis hinterlegt'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Art ändern</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ABSENCE_TYPE_LABEL) as AbsenceType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedAbsence({ ...selectedAbsence, type })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${selectedAbsence.type === type ? 'bg-brand border-brand-dark text-navy' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {ABSENCE_TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1 gap-1.5" onClick={() => handleVerifyAbsence('abgelehnt', selectedAbsence.type)}>
                <ShieldX size={15} />
                Ablehnen
              </Button>
              <Button variant="success" className="flex-1 gap-1.5" onClick={() => handleVerifyAbsence('geprueft', selectedAbsence.type)}>
                <ShieldCheck size={15} />
                Geprüft
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Zeitkorrektur (Monatsabschluss) */}
      <Modal open={!!editingLog} onClose={() => { setEditingLog(null); setEditingClosingId(null) }} title="Zeit korrigieren">
        {editingLog && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{formatDate(editingLog.date)}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-navy mb-1.5">Kommt</label>
                <input
                  type="time"
                  value={editClockIn}
                  onChange={e => setEditClockIn(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy mb-1.5">Geht</label>
                <input
                  type="time"
                  value={editClockOut}
                  onChange={e => setEditClockOut(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Pause (Minuten)</label>
              <input
                type="number"
                min={0}
                value={editBreakMinutes}
                onChange={e => setEditBreakMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <Button variant="success" className="w-full gap-1.5" onClick={handleSaveCorrection}>
              <CheckCircle size={15} />
              Korrektur speichern
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
