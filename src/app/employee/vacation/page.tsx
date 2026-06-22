'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { EMPLOYEES, VACATION_REQUESTS, addVacationRequest, getLocationById } from '@/lib/mock-data'
import { Palmtree, Plus, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatDate, diffDays } from '@/lib/utils'

export default function EmployeeVacation() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [submitted, setSubmitted] = useState(false)
  const [, forceRefresh] = useState(0)

  const employee = EMPLOYEES.find(e => e.id === user?.id)
  const myRequests = VACATION_REQUESTS.filter(v => v.employeeId === user?.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  const vacationTotal = employee?.vacationDaysTotal || 30
  const vacationUsed = employee?.vacationDaysUsed || 0
  const pendingDays = myRequests
    .filter(r => r.status === 'pending')
    .reduce((s, r) => s + r.days, 0)
  const approvedDays = myRequests
    .filter(r => r.status === 'approved')
    .reduce((s, r) => s + r.days, 0)
  // Tage, die noch frei beantragt werden koennen: Gesamt minus bereits genutzt minus offene Antraege
  const vacationRemaining = vacationTotal - vacationUsed - pendingDays

  const requestDays = form.startDate && form.endDate
    ? diffDays(form.startDate, form.endDate)
    : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.startDate || !form.endDate) {
      showToast('Bitte Von- und Bis-Datum auswählen', 'error')
      return
    }
    if (form.endDate < form.startDate) {
      showToast('Das Bis-Datum darf nicht vor dem Von-Datum liegen', 'error')
      return
    }
    if (requestDays <= 0 || requestDays > vacationRemaining) {
      showToast('Ungültiger Zeitraum oder nicht genug Resturlaub', 'error')
      return
    }
    if (!employee) return

    addVacationRequest({
      employeeId: employee.id,
      employeeName: employee.name,
      locationId: employee.locationId || 'loc1',
      locationName: getLocationById(employee.locationId || 'loc1')?.name || '',
      startDate: form.startDate,
      endDate: form.endDate,
      days: requestDays,
      reason: form.reason || undefined,
    })

    setSubmitted(true)
    setModal(false)
    setForm({ startDate: '', endDate: '', reason: '' })
    forceRefresh(n => n + 1)
    setTimeout(() => setSubmitted(false), 3000)
  }

  const statusConfig = {
    approved: { label: 'Genehmigt', icon: CheckCircle, color: 'text-green-500', badge: 'success' as const },
    denied: { label: 'Abgelehnt', icon: XCircle, color: 'text-red-500', badge: 'danger' as const },
    pending: { label: 'Ausstehend', icon: Clock, color: 'text-amber-500', badge: 'warning' as const },
  }

  return (
    <>
      <Header title="Urlaub & Abwesenheit" />
      <div className="p-4 sm:p-6 space-y-5">

        {submitted && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4 animate-fade-in">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700 font-medium">Urlaubsantrag erfolgreich eingereicht! Die Teamleitung wird ihn prüfen.</p>
          </div>
        )}

        {/* Vacation Balance */}
        <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 border-0" padding="lg">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-emerald-100 text-sm font-medium mb-1">Resturlaub {new Date().getFullYear()}</p>
              <p className="text-5xl font-bold text-white">{vacationRemaining}</p>
              <p className="text-emerald-200 text-sm mt-1">von {vacationTotal} Tagen</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Palmtree size={24} className="text-white" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-emerald-200">
              <span>{vacationUsed} genutzt</span>
              <span>{pendingDays} ausstehend</span>
              <span>{vacationRemaining} frei</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-brand transition-all"
                style={{ width: `${(vacationUsed / vacationTotal) * 100}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-xl font-bold text-green-600">{approvedDays}</p>
            <p className="text-xs text-gray-500">Genehmigt</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-xl font-bold text-amber-600">{pendingDays}</p>
            <p className="text-xs text-gray-500">Ausstehend</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-xl font-bold text-navy">{vacationRemaining}</p>
            <p className="text-xs text-gray-500">Verbleibend</p>
          </div>
        </div>

        {/* Request List */}
        <Card>
          <CardHeader>
            <CardTitle>Meine Anträge</CardTitle>
            <Button size="sm" onClick={() => setModal(true)} className="gap-1">
              <Plus size={14} />
              Antrag stellen
            </Button>
          </CardHeader>

          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="text-center py-10">
                <Palmtree size={36} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-500">Noch keine Urlaubsanträge</p>
                <Button size="sm" className="mt-3" onClick={() => setModal(true)}>
                  Ersten Antrag stellen
                </Button>
              </div>
            ) : (
              myRequests.map(req => {
                const cfg = statusConfig[req.status]
                const Icon = cfg.icon
                return (
                  <div key={req.id} className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${req.status === 'approved' ? 'bg-green-100' : req.status === 'denied' ? 'bg-red-100' : 'bg-amber-100'}`}>
                      <Icon size={20} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-navy">
                            {formatDate(req.startDate)} – {formatDate(req.endDate)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{req.days} Arbeitstage · {req.reason || 'Kein Grund angegeben'}</p>
                          {req.respondedBy && (
                            <p className="text-xs text-gray-400 mt-1">
                              {req.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'} von {req.respondedBy}
                              {req.respondedAt && ` am ${formatDate(req.respondedAt)}`}
                            </p>
                          )}
                        </div>
                        <Badge variant={cfg.badge}>{cfg.label}</Badge>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {/* Request Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Urlaub beantragen">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Von</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Bis</label>
              <input
                type="date"
                required
                value={form.endDate}
                min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {requestDays > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
              <Calendar size={16} className="text-blue-500" />
              <p className="text-sm text-blue-700 font-medium">{requestDays} Tage beantragt · {vacationRemaining - requestDays} würden verbleiben</p>
            </div>
          )}

          {requestDays > vacationRemaining && (
            <div className="bg-red-50 rounded-xl p-3 text-sm text-red-700">
              Nicht genug Resturlaub ({vacationRemaining} Tage verfügbar)
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Grund (optional)</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder="z.B. Familienurlaub, Hochzeit..."
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1 border border-gray-200" onClick={() => setModal(false)}>
              Abbrechen
            </Button>
            <Button type="submit" className="flex-1" disabled={requestDays > vacationRemaining || requestDays === 0}>
              Antrag einreichen
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
