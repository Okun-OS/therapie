'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { Palmtree, Plus, Calendar, CheckCircle, XCircle, Clock, CalendarClock } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'
import { countWorkdays } from '@/lib/workdays'
import { urlaubskonto } from '@/lib/urlaubskonto'
import { einreihen } from '@/lib/warteschlange'
import { schlangeGeaendert } from '@/components/offline/Warteschlange'
import type { Employee, Location, VacationRequest } from '@/lib/types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const PRIORITY_LABEL: Record<string, string> = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' }

export default function EmployeeVacation() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [submitted, setSubmitted] = useState(false)
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const [VACATION_REQUESTS, setVACATION_REQUESTS] = useState<VacationRequest[]>([])

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
  }, [])

  // §253 Die Urlaubsseite braucht nur die eigene Person, nicht die ganze
  // Belegschaft — und sie kann erst fragen, wenn die Kennung da ist.
  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/employees?employeeId=${user.employeeId}`)
      .then(r => r.json()).then(d => setEMPLOYEES(d.employees ?? []))
      .catch(() => {})
  }, [user?.employeeId])

  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/vacation-requests?employeeId=${user.employeeId}`).then(r => r.json()).then(d => setVACATION_REQUESTS(d.requests))
  }, [user?.employeeId])

  const employee = EMPLOYEES.find(e => e.id === user?.employeeId)
  const location = LOCATIONS.find(l => l.id === employee?.locationId)
  const myRequests = VACATION_REQUESTS.filter(v => v.employeeId === user?.employeeId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  /**
   * §231 Die Frist statt der Wunschmonate.
   *
   * Hier stand eine zweite Maske: bevorzugte Monate, ein Freitextzeitraum, eine
   * selbst gesetzte Priorität und eine Notiz. Gefragt wurde: „Ist es doppelt
   * gemoppelt, wenn wir Urlaubsanträge haben und dann Wünsche für den Urlaub?"
   *
   * Der Befund war schärfer als die Frage. Sagen drei Leute „Juli", weiß die
   * Leitung nicht, ob sie kollidieren — und genau das zu sehen ist der Zweck
   * der Jahresplanung. Dazu bewertete jede Person ihre eigenen Wünsche selbst;
   * als Rangfolge bei Streit taugt das nicht.
   *
   * Jetzt gibt es einen Weg: den Antrag, mit Datum. Und eine Frist, bis zu der
   * alle Anträge für das kommende Jahr da sein sollen — damit nicht der
   * schnellste Antrag den besten Zeitraum bekommt, sondern gemeinsam geplant
   * wird.
   */
  const [frist, setFrist] = useState<{ datum: string; jahr: number | null } | null>(null)

  useEffect(() => {
    if (!employee?.locationId) return
    fetch(`/api/vacation-rules?locationId=${employee.locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setFrist(d?.rules?.antragsfrist
        ? { datum: d.rules.antragsfrist, jahr: d.rules.antragsfristJahr ?? null }
        : null))
      .catch(() => undefined)
  }, [employee?.locationId])

  // Eine Frist aus dem letzten Jahr ist keine offene Frist.
  const fristOffen = !!frist && frist.datum >= new Date().toISOString().slice(0, 10)

  /*
   * §235 Eine Rechnung für beide Masken.
   *
   * Hier stand dieselbe Arithmetik ein zweites Mal — und im Profil daneben
   * eine dritte, die anders rechnete. Gemeldet: „Bei Bild 1 und 2 stimmen die
   * Urlaubstage nicht überein." Jetzt kommt beides aus `urlaubskonto.ts`.
   */
  const konto = urlaubskonto(employee ?? {}, myRequests)
  const vacationTotal = konto.gesamt
  const vacationUsed = konto.genommen
  const pendingDays = konto.beantragt
  const approvedDays = konto.genehmigt
  const vacationRemaining = konto.verfuegbar

  const requestDays = form.startDate && form.endDate
    ? countWorkdays(form.startDate, form.endDate, employee, location?.state)
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (!employee?.locationId) {
      showToast('Dein Account ist keinem Standort zugeordnet', 'error')
      return
    }

    const daten = {
      employeeId: employee.id,
      employeeName: employee.name,
      locationId: employee.locationId,
      locationName: location?.name || '',
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason || undefined,
    }

    let res: Response
    try {
      res = await fetch('/api/vacation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten),
      })
      // §138 503 heißt: nicht erreichbar — keine Ablehnung.
      if (res.status === 503) throw new Error('offline')
    } catch {
      // Ohne Netz wird der Antrag gemerkt und nachgereicht. Er taucht erst in
      // der Liste auf, wenn er wirklich beim Server ist — ein Antrag, der nur
      // auf dem eigenen Telefon steht, ist kein Antrag.
      const { ok } = einreihen('urlaub', '/api/vacation-requests', daten)
      showToast(ok
        ? 'Kein Netz — der Antrag ist gemerkt und geht raus, sobald wieder Empfang da ist.'
        : 'Kein Netz — und der Antrag ließ sich nicht merken. Bitte später noch einmal.',
        ok ? 'success' : 'error')
      if (ok) {
        schlangeGeaendert()
        setModal(false)
        setForm({ startDate: '', endDate: '', reason: '' })
      }
      return
    }

    if (!res.ok) {
      showToast('Antrag konnte nicht eingereicht werden', 'error')
      return
    }
    const { request } = await res.json()

    setVACATION_REQUESTS(prev => [request, ...prev])
    setSubmitted(true)
    setModal(false)
    setForm({ startDate: '', endDate: '', reason: '' })
    setTimeout(() => setSubmitted(false), 3000)
  }

  const statusConfig = {
    approved: { label: 'Genehmigt', icon: CheckCircle, color: 'text-green-500', badge: 'success' as const },
    denied: { label: 'Abgelehnt', icon: XCircle, color: 'text-red-500', badge: 'danger' as const },
    pending: { label: 'Ausstehend', icon: Clock, color: 'text-amber-500', badge: 'warning' as const },
  }

  return (
    <>
      
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

        {/*
          §231 Die Frist zur Jahresplanung.

          Keine zweite Maske mehr, nur der Hinweis — und der Knopf führt
          dorthin, wo der Urlaub wirklich beantragt wird.
        */}
        {frist && (
          <Card>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                fristOffen ? 'bg-amber-100' : 'bg-gray-100'}`}>
                <CalendarClock size={18} className={fristOffen ? 'text-amber-600' : 'text-gray-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy">
                  {fristOffen
                    ? `Urlaub für ${frist.jahr ?? 'das kommende Jahr'}: bitte bis ${formatDate(frist.datum)} beantragen`
                    : `Die Frist für ${frist.jahr ?? 'die Jahresplanung'} ist am ${formatDate(frist.datum)} abgelaufen`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fristOffen
                    ? 'Alles, was bis dahin eingereicht ist, wird gemeinsam geplant — nicht '
                      + 'nach Reihenfolge des Eingangs. Danach gilt: wer zuerst kommt.'
                    : 'Anträge gehen weiter, werden aber einzeln entschieden.'}
                </p>
                {fristOffen && (
                  <Button size="sm" onClick={() => setModal(true)} className="gap-1 mt-3">
                    <Plus size={14} />Urlaub beantragen
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

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
              <div className="text-center">
                <EmptyState icon={Palmtree} title="Noch keine Urlaubsanträge" />
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
            <Input
              label="Von"
              type="date"
              required
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            />
            <Input
              label="Bis"
              type="date"
              required
              value={form.endDate}
              min={form.startDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            />
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

          <Textarea
            label="Grund (optional)"
            value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            rows={3}
            placeholder="z.B. Familienurlaub, Hochzeit..."
          />

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
