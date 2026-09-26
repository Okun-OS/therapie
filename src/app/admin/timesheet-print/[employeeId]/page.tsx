'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Printer, CheckCircle, XCircle } from 'lucide-react'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

interface TimeLog {
  id: string
  date: string
  clockIn: string
  clockOut: string | null
  totalMinutes: number | null
  breakMinutes: number | null
}

interface Employee {
  id: string
  name: string
  email: string
  role: string
  locationId?: string
  weeklyHours?: number
}

interface Location {
  id: string
  name: string
  address?: string
  city?: string
}

interface TimesheetApproval {
  id?: string
  status: string
  approvedBy?: string
  approvedAt?: string
  notes?: string
}

function fmt(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}

function dateLabel(d: string): string {
  const dt = new Date(d)
  return dt.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function TimesheetPrintPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const employeeId = params.employeeId as string
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1

  const [logs, setLogs] = useState<TimeLog[]>([])
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [location, setLocation] = useState<Location | null>(null)
  const [approval, setApproval] = useState<TimesheetApproval | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
      const dateTo = `${year}-${String(month).padStart(2, '0')}-31`
      const [logsRes, empRes, approvalRes] = await Promise.all([
        fetch(`/api/time-logs?employeeId=${employeeId}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
        fetch(`/api/employees/${employeeId}`),
        fetch(`/api/timesheet-approval?employeeId=${employeeId}&year=${year}&month=${month}`),
      ])
      if (logsRes.ok) { const d = await logsRes.json(); setLogs(d.logs ?? []) }
      if (empRes.ok) {
        const d = await empRes.json()
        setEmployee(d.employee ?? null)
        if (d.employee?.locationId) {
          const locRes = await fetch(`/api/locations/${d.employee.locationId}`)
          if (locRes.ok) { const ld = await locRes.json(); setLocation(ld.location ?? null) }
        }
      }
      if (approvalRes.ok) {
        const d = await approvalRes.json()
        setApproval(d.approvals?.[0] ?? null)
      }
      setLoading(false)
    }
    load()
  }, [employeeId, year, month])

  async function handleApprove() {
    if (!employee) return
    setApproving(true)
    await fetch('/api/timesheet-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        employeeName: employee.name,
        year,
        month,
        status: 'approved',
      }),
    })
    setApproval({ status: 'approved', approvedAt: new Date().toISOString() })
    setApproving(false)
  }

  async function handleReject() {
    if (!employee) return
    setApproving(true)
    await fetch('/api/timesheet-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        employeeName: employee.name,
        year,
        month,
        status: 'rejected',
        rejectionReason,
      }),
    })
    setApproval({ status: 'rejected', notes: rejectionReason })
    setApproving(false)
    setShowRejectModal(false)
  }

  const totalWorked = logs.reduce((s, l) => s + (l.totalMinutes ?? 0), 0)
  const totalBreaks = logs.reduce((s, l) => s + (l.breakMinutes ?? 0), 0)
  const workingDays = logs.filter(l => l.totalMinutes && l.totalMinutes > 0).length
  const weeklyHours = employee?.weeklyHours ?? 40
  const expectedMinutes = Math.round(workingDays * (weeklyHours / 5) * 60)
  const overtime = totalWorked - expectedMinutes

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print controls - hidden when printing */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-navy text-white text-sm font-medium hover:opacity-90"
          >
            <Printer size={16} /> Als PDF speichern / Drucken
          </button>
          <span className="text-sm text-gray-500">Browser-Druckdialog → &bdquo;Als PDF speichern&ldquo;</span>
        </div>

        <div className="flex items-center gap-3">
          {approval?.status === 'approved' ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">Genehmigt</span>
            </div>
          ) : approval?.status === 'rejected' ? (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <XCircle size={16} />
              <span className="text-sm font-medium">Abgelehnt</span>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50"
              >
                <XCircle size={16} /> Ablehnen
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                <CheckCircle size={16} /> {approving ? 'Wird genehmigt…' : 'Genehmigen'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Printable content */}
      <div className="max-w-4xl mx-auto p-8 bg-white shadow-sm my-4 print:shadow-none print:my-0 print:max-w-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-900">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Arbeitszeitnachweis</h1>
            <p className="text-lg text-gray-700 mt-1">{MONTH_NAMES[month - 1]} {year}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            {location && (
              <>
                <p className="font-semibold text-gray-900">{location.name}</p>
                {location.address && <p>{location.address}</p>}
                {location.city && <p>{location.city}</p>}
              </>
            )}
          </div>
        </div>

        {/* Employee info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mitarbeiter</p>
            <p className="text-base font-semibold text-gray-900">{employee?.name}</p>
            <p className="text-sm text-gray-600">{employee?.email}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Abrechnungsperiode</p>
            <p className="text-base font-semibold text-gray-900">{MONTH_NAMES[month - 1]} {year}</p>
            <p className="text-sm text-gray-600">Arbeitstage: {workingDays} · Wochensoll: {weeklyHours} h</p>
          </div>
        </div>

        {/* Time logs table */}
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Datum</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700">Beginn</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700">Ende</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700">Pause</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Nettozeit</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 text-gray-700">{dateLabel(log.date)}</td>
                <td className="px-3 py-2 text-center font-mono text-gray-700">{log.clockIn}</td>
                <td className="px-3 py-2 text-center font-mono text-gray-700">{log.clockOut ?? '–'}</td>
                <td className="px-3 py-2 text-center text-gray-600">{fmt(log.breakMinutes ?? 0)}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(log.totalMinutes ?? 0)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">Keine Zeiteinträge für diesen Monat</td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t-2 border-gray-900">
            <tr className="font-semibold">
              <td className="px-3 py-2 text-gray-900">Gesamt</td>
              <td colSpan={3} className="px-3 py-2 text-gray-700 text-sm">Pausenzeit: {fmt(totalBreaks)}</td>
              <td className="px-3 py-2 text-right text-gray-900">{fmt(totalWorked)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Soll-Zeit', value: fmt(expectedMinutes) },
            { label: 'Ist-Zeit', value: fmt(totalWorked) },
            { label: 'Überstunden', value: fmt(overtime) },
            { label: 'Pause gesamt', value: fmt(totalBreaks) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-gray-900 font-mono">{value}</p>
            </div>
          ))}
        </div>

        {/* Approval section */}
        <div className="border-t-2 border-gray-300 pt-6">
          {approval?.status === 'approved' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
                <CheckCircle size={16} /> Genehmigt
              </div>
              {approval.approvedAt && (
                <p className="text-sm text-green-600">
                  Genehmigt am {new Date(approval.approvedAt).toLocaleDateString('de-DE')} um {new Date(approval.approvedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </p>
              )}
            </div>
          ) : approval?.status === 'rejected' ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 text-red-700 font-semibold mb-1">
                <XCircle size={16} /> Abgelehnt
              </div>
              {approval.notes && <p className="text-sm text-red-600">Grund: {approval.notes}</p>}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic mb-4">Noch nicht genehmigt</div>
          )}

          <div className="grid grid-cols-2 gap-8 mt-8">
            <div>
              <div className="border-b border-gray-400 mb-1 h-8" />
              <p className="text-xs text-gray-600">Unterschrift Mitarbeiter</p>
              <p className="text-xs text-gray-400 mt-1">{employee?.name}</p>
            </div>
            <div>
              <div className="border-b border-gray-400 mb-1 h-8" />
              <p className="text-xs text-gray-600">Unterschrift Vorgesetzter</p>
              {location && <p className="text-xs text-gray-400 mt-1">{location.name}</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
          Erstellt mit OKUN Workforce · Revisionssicherer Arbeitszeitnachweis · {new Date().toLocaleDateString('de-DE')}
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 mb-3">Nachweis ablehnen</h3>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Begründung (optional)…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Abbrechen</button>
              <button onClick={handleReject} disabled={approving} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                Ablehnen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
