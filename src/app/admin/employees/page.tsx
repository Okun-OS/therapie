'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import {
  pruefeTagesmuster, musterText, moeglicheArbeitstage, type Tagesmuster,
} from '@/lib/tagesmuster'
import { FeatureIntro } from '@/components/onboarding/FeatureIntro'
import { EmployeeCreationChat } from '@/components/employees/EmployeeCreationChat'
import { EmployeeCreationForm } from '@/components/employees/EmployeeCreationForm'
import { ZugangVerwalten } from '@/components/employees/ZugangVerwalten'
import { EmptyState } from '@/components/ui/EmptyState'
import { Users, Plus, Search, Clock, TrendingUp, Palmtree, ChevronRight, MessageCircle, Sparkles, ListChecks, AlertTriangle, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import type { Employee, OvertimeRequest, Absence } from '@/lib/types'
import type { EmployeeDraft } from '@/lib/employee-draft'
import { Personalakte } from '@/components/employees/Personalakte'
import { LohnStammdaten } from '@/components/employees/LohnStammdaten'

interface EmployeeHumanContext {
  strengths: string[]
  lifeCircumstances: string[]
  preferredGroups: string[]
  preferredActivities: string[]
  shiftPreferences: string[]
  agreements: string | null
}

/*
 * §200 Kinder-Abholzeiten, Wochenend-Vereinbarung, maximale Folgetage je
 * Person und die dauerhafte Planungsnotiz sind hier entfernt.
 *
 * Sie stammen aus der Zeit vor den Regelpaketen. Nachgesehen, wohin sie
 * flossen: in keinen Rechenkern und in kein Regelpaket — nur als Freitext
 * („besonderheiten"), den der Rechendienst nicht liest, und in den Kontext
 * des KI-Chats. Eine Leitung, die „Abholung Mo 15:30" eintrug, durfte also
 * annehmen, der Plan richte sich danach. Er tat es nie. Was ein Betrieb
 * wirklich braucht, steht heute im Regelpaket des Standorts.
 *
 * GEBLIEBEN, und warum: die Schichtvorliebe liest das Regelpaket der Kita
 * (`vorlieben_aus_stammdaten`, §181), die Planstunden der Rechendienst
 * (§171), die Zuschlagsregelung die Lohnabrechnung. Die Spalten der
 * entfernten Felder stehen noch in der Datenbank — sie zu löschen ist ein
 * eigener Schritt, der Produktionsdaten berührt.
 */
interface PlanningProfile {
  shiftPreference: string
  /** §171 leer = Vertragsstunden aus den Stammdaten */
  planungsStundenSoll: number | null
  surchargeMode: string
  /** §225 Wie sich die Wochenstunden auf die Tage verteilen */
  tagesmuster?: Array<{ stunden: number; tage: number }> | null
}

export default function AdminEmployees() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const locationId = user?.locationId

  const [search, setSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [editChatEmployee, setEditChatEmployee] = useState<Employee | null>(null)
  const [editChatDraft, setEditChatDraft] = useState<EmployeeDraft | null>(null)
  const [editFormEmployee, setEditFormEmployee] = useState<Employee | null>(null)
  const [editFormDraft, setEditFormDraft] = useState<EmployeeDraft | null>(null)
  const [humanContext, setHumanContext] = useState<EmployeeHumanContext | null>(null)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [planningProfile, setPlanningProfile] = useState<PlanningProfile | null>(null)
  const [planningProfileOpen, setPlanningProfileOpen] = useState(false)
  const [planningProfileSaving, setPlanningProfileSaving] = useState(false)
  const [planningProfileDraft, setPlanningProfileDraft] = useState<PlanningProfile | null>(null)

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setAllEmployees(d.employees))
  }, [])

  useEffect(() => {
    if (!selectedEmployee) {
      setOvertimeRequests([])
      setAbsences([])
      return
    }
    fetch(`/api/overtime-requests?employeeId=${selectedEmployee.id}`)
      .then(r => r.json()).then(d => setOvertimeRequests(d.requests ?? []))
      .catch(() => setOvertimeRequests([]))
    fetch(`/api/absences?employeeId=${selectedEmployee.id}`)
      .then(r => r.json()).then(d => setAbsences(d.absences ?? []))
      .catch(() => setAbsences([]))
  }, [selectedEmployee])

  function employeeToDraft(emp: Employee, ctx: EmployeeHumanContext | null): EmployeeDraft {
    return {
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      birthDate: emp.birthDate,
      roleType: emp.roleType,
      employmentType: emp.employmentType,
      weeklyHours: emp.weeklyHours,
      workDaysPerWeek: emp.workDaysPerWeek,
      workDays: emp.workDays,
      dailyTargetHours: emp.dailyTargetHours,
      fixedOffDays: emp.fixedOffDays,
      gruppe: emp.gruppe,
      bereich: emp.bereich,
      multiGroupCapable: emp.multiGroupCapable,
      fixedLocations: emp.fixedLocations,
      qualifications: emp.qualifications,
      allowedTasks: emp.allowedTasks,
      besonderheiten: ctx?.lifeCircumstances,
      absprachen: ctx?.agreements ?? undefined,
    }
  }

  useEffect(() => {
    if (!selectedEmployee) {
      setHumanContext(null)
      setPlanningProfile(null)
      setPlanningProfileOpen(false)
      setPlanningProfileDraft(null)
      return
    }
    fetch(`/api/employee-human-context?employeeId=${selectedEmployee.id}`)
      .then(res => res.json())
      .then(data => setHumanContext(data.contexts?.[0] ?? null))
      .catch(() => setHumanContext(null))
    fetch(`/api/employees/${selectedEmployee.id}/planning-profile`)
      .then(r => r.json())
      .then(d => setPlanningProfile(d.profile ?? null))
      .catch(() => setPlanningProfile(null))
  }, [selectedEmployee])

  async function parseEmployeeResponse(res: Response): Promise<Employee> {
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.employee) {
      throw new Error(data?.error || 'Mitarbeiter konnte nicht gespeichert werden')
    }
    return data.employee as Employee
  }

  function patchFieldsFromDraft(draft: EmployeeDraft) {
    return {
      ...(draft.name !== undefined && { name: draft.name }),
      ...(draft.email !== undefined && { email: draft.email }),
      ...(draft.phone !== undefined && { phone: draft.phone }),
      ...(draft.birthDate !== undefined && { birthDate: draft.birthDate }),
      ...(draft.roleType !== undefined && { roleType: draft.roleType, position: draft.roleType }),
      ...(draft.employmentType !== undefined && { employmentType: draft.employmentType }),
      ...(draft.weeklyHours !== undefined && { weeklyHours: draft.weeklyHours }),
      ...(draft.workDaysPerWeek !== undefined && { workDaysPerWeek: draft.workDaysPerWeek }),
      ...(draft.workDays !== undefined && { workDays: draft.workDays }),
      ...(draft.dailyTargetHours !== undefined && { dailyTargetHours: draft.dailyTargetHours }),
      ...(draft.fixedOffDays !== undefined && { fixedOffDays: draft.fixedOffDays }),
      ...(draft.gruppe !== undefined && { gruppe: draft.gruppe }),
      ...(draft.bereich !== undefined && { bereich: draft.bereich }),
      ...(draft.multiGroupCapable !== undefined && { multiGroupCapable: draft.multiGroupCapable }),
      ...(draft.fixedLocations !== undefined && { fixedLocations: draft.fixedLocations }),
      ...(draft.qualifications !== undefined && { qualifications: draft.qualifications }),
      ...(draft.allowedTasks !== undefined && { allowedTasks: draft.allowedTasks }),
      ...(draft.contractVacationDays !== undefined && { vacationDaysTotal: draft.contractVacationDays }),
      ...(draft.hoursBalanceOffset !== undefined && { hoursBalance: draft.hoursBalanceOffset }),
    }
  }

  async function saveHumanContextFromDraft(employeeId: string, draft: EmployeeDraft) {
    if (!((draft.besonderheiten && draft.besonderheiten.length > 0) || draft.absprachen)) return
    try {
      await fetch('/api/employee-human-context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          lifeCircumstances: draft.besonderheiten,
          agreements: draft.absprachen,
        }),
      })
    } catch {
      // Mitarbeiter ist bereits angelegt; die Besonderheiten können später im Profil ergänzt werden.
    }
  }

  // Legt den Mitarbeiter schon während des Gesprächs an (sobald Name + E-Mail
  // bekannt sind) statt erst beim finalen Speichern – ohne Einladung, da die
  // E-Mail-Adresse im Gespräch noch korrigiert werden könnte.
  const handleDraftSync = async (draft: EmployeeDraft, existingId: string | null): Promise<string | null> => {
    if (!draft.name?.trim() || !draft.email?.trim()) return existingId
    if (!existingId) {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          position: draft.roleType || 'Mitarbeiter',
          weeklyHours: draft.weeklyHours || 38,
          workDaysPerWeek: draft.workDaysPerWeek,
          workDays: draft.workDays,
          dailyTargetHours: draft.dailyTargetHours,
          fixedOffDays: draft.fixedOffDays,
          locationId,
          phone: draft.phone,
          birthDate: draft.birthDate,
          roleType: draft.roleType,
          employmentType: draft.employmentType,
          gruppe: draft.gruppe,
          bereich: draft.bereich,
          multiGroupCapable: draft.multiGroupCapable,
          fixedLocations: draft.fixedLocations,
          qualifications: draft.qualifications,
          allowedTasks: draft.allowedTasks,
          sendInvitation: false,
        }),
      })
      if (!res.ok) return null
      const { employee } = await res.json()
      setAllEmployees(prev => [...prev, employee])
      return employee.id as string
    }
    const res = await fetch(`/api/employees/${existingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchFieldsFromDraft(draft)),
    })
    if (!res.ok) return existingId
    const { employee } = await res.json()
    setAllEmployees(prev => prev.map(e => e.id === employee.id ? employee : e))
    return employee.id as string
  }

  // Finalisiert den Mitarbeiter: wurde er bereits inkrementell angelegt (employeeId
  // gesetzt), wird nur noch aktualisiert und die Einladung nachträglich versendet;
  // ansonsten (Fallback, z.B. alles in einer einzigen Nachricht genannt) legt
  // addEmployeeWithInvitation ihn komplett neu an.
  const handleSaveFromChat = async (draft: EmployeeDraft, employeeId: string | null) => {
    if (!draft.name?.trim() || !draft.email?.trim()) {
      throw new Error('Name und E-Mail werden benötigt, um den Mitarbeiter zu speichern')
    }

    let employee: Employee
    let emailSent: boolean

    if (employeeId) {
      employee = await parseEmployeeResponse(await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchFieldsFromDraft(draft)),
      }))
      setAllEmployees(prev => prev.map(e => e.id === employee.id ? employee : e))
      const inviteResult = await fetch(`/api/employees/${employeeId}/invite`, { method: 'POST' }).then(r => r.json())
      emailSent = !!inviteResult.emailSent
    } else {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          position: draft.roleType || 'Mitarbeiter',
          weeklyHours: draft.weeklyHours || 38,
          workDaysPerWeek: draft.workDaysPerWeek,
          workDays: draft.workDays,
          dailyTargetHours: draft.dailyTargetHours,
          fixedOffDays: draft.fixedOffDays,
          locationId,
          phone: draft.phone,
          birthDate: draft.birthDate,
          roleType: draft.roleType,
          employmentType: draft.employmentType,
          gruppe: draft.gruppe,
          bereich: draft.bereich,
          multiGroupCapable: draft.multiGroupCapable,
          fixedLocations: draft.fixedLocations,
          qualifications: draft.qualifications,
          allowedTasks: draft.allowedTasks,
          contractVacationDays: draft.contractVacationDays,
          hoursBalanceOffset: draft.hoursBalanceOffset,
          preApprovedVacations: draft.preApprovedVacations,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.employee) {
        throw new Error(data?.error || 'Mitarbeiter konnte nicht angelegt werden')
      }
      employee = data.employee
      emailSent = !!data.emailSent
      setAllEmployees(prev => [...prev, employee])
    }

    await saveHumanContextFromDraft(employee.id, draft)

    if (emailSent) {
      showToast('Mitarbeiter gespeichert · Einladung versendet', 'success')
    } else {
      showToast('Mitarbeiter gespeichert, Einladung konnte aber nicht versendet werden', 'error')
    }
  }

  const handleUpdateFromChat = async (draft: EmployeeDraft) => {
    if (!editChatEmployee) return
    const updated = await parseEmployeeResponse(await fetch(`/api/employees/${editChatEmployee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchFieldsFromDraft(draft)),
    }))
    setAllEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))
    await saveHumanContextFromDraft(editChatEmployee.id, draft)
    showToast('Profil aktualisiert', 'success')
    setEditChatEmployee(null)
    setSelectedEmployee(prev => prev && prev.id === editChatEmployee.id ? { ...prev, ...draft } as Employee : prev)
  }

  const handleUpdateFromForm = async (draft: EmployeeDraft) => {
    if (!editFormEmployee) return
    const antwort = await fetch(`/api/employees/${editFormEmployee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchFieldsFromDraft(draft)),
    })
    const kopie = antwort.clone()
    const updated = await parseEmployeeResponse(antwort)
    setAllEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))
    await saveHumanContextFromDraft(editFormEmployee.id, draft)
    // §200 Eine geänderte Adresse lädt neu ein — das soll die Leitung lesen,
    // nicht nur „aktualisiert".
    const { zugang } = await kopie.json().catch(() => ({})) as { zugang?: { email: string; emailSent: boolean } }
    if (zugang) {
      showToast(zugang.emailSent
        ? `Profil aktualisiert · Einladung an ${zugang.email} versendet`
        : 'Profil aktualisiert, aber die Einladung an die neue Adresse konnte nicht versendet werden',
      zugang.emailSent ? 'success' : 'error')
    } else {
      showToast('Profil aktualisiert', 'success')
    }
    setEditFormEmployee(null)
    setSelectedEmployee(prev => prev && prev.id === editFormEmployee.id ? { ...prev, ...draft } as Employee : prev)
  }

  const employees = allEmployees.filter(
    e => e.locationId === locationId && e.role === 'employee'
  ).filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase())
  )

  const getBalanceColor = (h: number) => h > 0 ? 'text-green-600' : h < 0 ? 'text-red-500' : 'text-gray-500'

  if (!locationId) {
    return (
      <>
        
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Dein Account ist noch keinem Standort zugeordnet"
            description="Ein OKUN-Administrator muss deinen Account einmalig einem Standort zuordnen, bevor du hier Mitarbeiter anlegen kannst. Bitte wende dich an die OKUN-Plattformverwaltung."
          />
        </div>
      </>
    )
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-4">
        <FeatureIntro
          featureKey="admin-employees-time-tracking"
          text="Hier sehen Sie alle Arbeitszeiten Ihrer Mitarbeiter. Am Monatsende können Sie die Zeiterfassung prüfen und freigeben."
        />

        {/* Search + Add */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              icon={Search}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Mitarbeiter suchen..."
            />
          </div>
          <div className="relative">
            <Button size="md" onClick={() => setAddMenuOpen(!addMenuOpen)} className="gap-2 whitespace-nowrap">
              <Plus size={16} />
              <span className="hidden sm:inline">Mitarbeiter</span>
            </Button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                <div className="absolute right-0 top-12 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <button
                    onClick={() => { setAddMenuOpen(false); setChatOpen(true) }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <Sparkles size={16} className="text-brand mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold text-navy">Per KI-Chat anlegen</span>
                      <span className="block text-xs text-gray-500">Geführt, ideal für einzelne Mitarbeiter</span>
                    </span>
                  </button>
                  <button
                    onClick={() => { setAddMenuOpen(false); setFormOpen(true) }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-100"
                  >
                    <ListChecks size={16} className="text-brand mt-0.5 flex-shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold text-navy">Klassisches Formular</span>
                      <span className="block text-xs text-gray-500">Schnell, ideal für mehrere Mitarbeiter</span>
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-xl font-bold text-navy">{employees.length}</p>
            <p className="text-xs text-gray-500">Gesamt</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-xl font-bold text-green-600">
              {employees.filter(e => e.hoursBalance >= 0).length}
            </p>
            <p className="text-xs text-gray-500">Positives Konto</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-xl font-bold text-amber-600">
              {employees.reduce((s, e) => s + e.vacationDaysTotal - e.vacationDaysUsed, 0)}
            </p>
            <p className="text-xs text-gray-500">Resturlaub gesamt</p>
          </div>
        </div>

        {/* Employee List */}
        <div className="space-y-3">
          {employees.map(emp => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployee(emp)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
            >
              <Avatar name={emp.name} avatarUrl={emp.avatarUrl} size="lg" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-navy">{emp.name}</p>
                  <Badge variant="default">{emp.position}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{emp.email}</p>
                <div className="flex gap-4 mt-2 flex-wrap">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={11} />
                    {emp.weeklyHours}h/Woche
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${getBalanceColor(emp.hoursBalance)}`}>
                    <TrendingUp size={11} />
                    {emp.hoursBalance >= 0 ? '+' : ''}{emp.hoursBalance}h Konto
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Palmtree size={11} />
                    {emp.vacationDaysTotal - emp.vacationDaysUsed} Urlaub
                  </div>
                </div>
              </div>

              <ChevronRight size={16} className="text-gray-300 group-hover:text-brand transition-colors flex-shrink-0" />
            </div>
          ))}

          {employees.length === 0 && (
            <EmptyState icon={Users} title="Keine Mitarbeiter gefunden" />
          )}
        </div>
      </div>

      {/* Employee Detail / Edit Modal */}
      <Modal
        open={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title="Mitarbeiter-Details"
      >
        {selectedEmployee && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selectedEmployee.name} avatarUrl={selectedEmployee.avatarUrl} size="xl" />
              <div>
                <p className="text-xl font-bold text-navy">{selectedEmployee.name}</p>
                <p className="text-gray-500 text-sm">{selectedEmployee.position}</p>
              </div>
            </div>

            {/* §200 Adresse tauschen und neu einladen */}
            <ZugangVerwalten
              key={selectedEmployee.id}
              employeeId={selectedEmployee.id}
              onEmailGeaendert={email => {
                setAllEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, email } : e))
                setSelectedEmployee(prev => prev ? { ...prev, email } : prev)
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Stundenkonto', value: `${selectedEmployee.hoursBalance >= 0 ? '+' : ''}${selectedEmployee.hoursBalance}h`, color: getBalanceColor(selectedEmployee.hoursBalance) },
                { label: 'Wochenstunden', value: `${selectedEmployee.weeklyHours}h`, color: 'text-navy' },
                { label: 'Resturlaub', value: `${selectedEmployee.vacationDaysTotal - selectedEmployee.vacationDaysUsed} Tage`, color: 'text-navy' },
                { label: 'Dabei seit', value: new Date(selectedEmployee.joinedAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), color: 'text-navy' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-base font-bold ${color} mt-0.5`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const year = new Date().getFullYear()
                const overtimeMinutes = overtimeRequests
                  .filter(o => (o.status === 'approved' || o.status === 'partial') && o.date.startsWith(`${year}`))
                  .reduce((s, o) => s + (o.approvedMinutes ?? 0), 0)
                const yearAbsences = absences.filter(a => a.startDate.startsWith(`${year}`))
                const sickDays = yearAbsences.filter(a => a.type === 'krankheit').reduce((s, a) => s + a.days, 0)
                const otherDays = yearAbsences.filter(a => a.type !== 'krankheit').reduce((s, a) => s + a.days, 0)
                return [
                  { label: 'Überstunden', value: `${Math.round(overtimeMinutes / 6) / 10}h` },
                  { label: 'Krankheitstage', value: `${sickDays}` },
                  { label: 'Fehlzeiten', value: `${otherDays}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-base font-bold text-navy mt-0.5">{value}</p>
                  </div>
                ))
              })()}
            </div>

            {/* §102 Lohn-Stammdaten — Grundlage jeder Abrechnung */}
            <LohnStammdaten employeeId={selectedEmployee.id} />

            {/* §100 Personalakte: Vertrag, Zeugnisse, Bescheinigungen, Krankmeldungen */}
            <div className="border border-gray-100 rounded-xl p-3">
              <Personalakte ownerId={selectedEmployee.id} verwalten />
            </div>

            {selectedEmployee.preferences && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">Präferenzen</p>
                <p className="text-sm text-blue-700">
                  {selectedEmployee.preferences.preferredShifts.length > 0 && `Bevorzugt: ${selectedEmployee.preferences.preferredShifts.map(s => s === 'early' ? 'Früh' : s === 'late' ? 'Spät' : 'Mitte').join(', ')} · `}
                  {selectedEmployee.preferences.noEarlyAfterLate && 'Kein Früh nach Spät'}
                </p>
                {selectedEmployee.preferences.notes && (
                  <p className="text-xs text-blue-600 mt-1 italic">{selectedEmployee.preferences.notes}</p>
                )}
              </div>
            )}

            {(selectedEmployee.gruppe || selectedEmployee.bereich || selectedEmployee.roleType || (selectedEmployee.qualifications?.length ?? 0) > 0) && (
              <div className="bg-amber-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-amber-700">Arbeitsbereich &amp; Qualifikation</p>
                {(selectedEmployee.gruppe || selectedEmployee.bereich) && (
                  <p className="text-sm text-amber-700">
                    {selectedEmployee.gruppe && <><span className="font-medium">Gruppe:</span> {selectedEmployee.gruppe} · </>}
                    {selectedEmployee.bereich && <><span className="font-medium">Bereich:</span> {selectedEmployee.bereich}</>}
                  </p>
                )}
                {selectedEmployee.roleType && (
                  <p className="text-sm text-amber-700"><span className="font-medium">Rolle:</span> {selectedEmployee.roleType}</p>
                )}
                {(selectedEmployee.qualifications?.length ?? 0) > 0 && (
                  <p className="text-sm text-amber-700"><span className="font-medium">Qualifikationen:</span> {selectedEmployee.qualifications!.join(', ')}</p>
                )}
              </div>
            )}

            {humanContext && (humanContext.strengths.length > 0 || humanContext.lifeCircumstances.length > 0 || humanContext.preferredGroups.length > 0 || humanContext.preferredActivities.length > 0 || humanContext.shiftPreferences.length > 0 || humanContext.agreements) && (
              <div className="bg-purple-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-purple-700">Persönliches (freiwillig angegeben)</p>
                {humanContext.strengths.length > 0 && (
                  <p className="text-sm text-purple-700"><span className="font-medium">Stärken:</span> {humanContext.strengths.join(', ')}</p>
                )}
                {humanContext.lifeCircumstances.length > 0 && (
                  <p className="text-sm text-purple-700"><span className="font-medium">Lebenssituation:</span> {humanContext.lifeCircumstances.join(', ')}</p>
                )}
                {humanContext.preferredGroups.length > 0 && (
                  <p className="text-sm text-purple-700"><span className="font-medium">Bevorzugte Gruppen:</span> {humanContext.preferredGroups.join(', ')}</p>
                )}
                {humanContext.preferredActivities.length > 0 && (
                  <p className="text-sm text-purple-700"><span className="font-medium">Bevorzugte Tätigkeiten:</span> {humanContext.preferredActivities.join(', ')}</p>
                )}
                {humanContext.shiftPreferences.length > 0 && (
                  <p className="text-sm text-purple-700"><span className="font-medium">Schicht-Vorlieben:</span> {humanContext.shiftPreferences.join(', ')}</p>
                )}
                {humanContext.agreements && (
                  <p className="text-xs text-purple-600 italic">{humanContext.agreements}</p>
                )}
              </div>
            )}

            {/* Planungsprofil (Schicht 2) */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setPlanningProfileOpen(o => !o)
                  if (!planningProfileDraft) {
                    setPlanningProfileDraft(planningProfile ?? {
                      shiftPreference: 'keine',
                      planungsStundenSoll: null,
                      surchargeMode: 'unternehmensregel',
                    })
                  }
                }}
              >
                <span className="text-xs font-semibold text-gray-700">Planungsprofil (automatisch aktiv)</span>
                <ChevronRight size={14} className={`text-gray-400 transition-transform ${planningProfileOpen ? 'rotate-90' : ''}`} />
              </button>

              {planningProfileOpen && planningProfileDraft && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100">
                  {/* Schicht-Präferenz */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Schicht-Präferenz</label>
                    <select
                      value={planningProfileDraft.shiftPreference}
                      onChange={e => setPlanningProfileDraft(d => d ? { ...d, shiftPreference: e.target.value } : d)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="keine">Keine Präferenz</option>
                      <option value="frueh">Frühschicht bevorzugt</option>
                      <option value="spaet">Spätschicht bevorzugt</option>
                      <option value="nacht">Nachtschicht bevorzugt</option>
                    </select>
                  </div>

                  {/* §171 Planstunden */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Planstunden pro Woche (leer = Vertragsstunden)
                    </label>
                    <input
                      type="number"
                      min={0} max={60} step={0.5}
                      value={planningProfileDraft.planungsStundenSoll ?? ''}
                      onChange={e => setPlanningProfileDraft(d => d ? {
                        ...d,
                        planungsStundenSoll: e.target.value === '' ? null : Number(e.target.value),
                      } : d)}
                      placeholder="Vertragsstunden"
                      data-test="planstunden"
                      className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Für alle, deren Vertragszeit nicht ihre Planzeit ist — eine Leitung
                      mit 40 Vertrags- und 0 Planstunden zum Beispiel. Leitungszeit
                      gehört nicht in den Dienstplan.
                    </p>
                  </div>

                  {/*
                    §225 Das Tagesmuster — bis hierher gab es dafür KEIN
                    Eingabefeld.

                    Das Regelpaket der Kita sagt ausdrücklich: „Die Muster
                    kommen aus den Stammdaten. Wer keines hinterlegt hat, wird
                    wie bisher frei verplant." Genau das ist passiert — eine
                    35-Stunden-Kraft bekam 7:30–15:00, dann 7:00–15:30, dann
                    8:00–13:00. Die Woche stimmte, der Plan war unbrauchbar.
                    Das Feld gab es in der Datenbank und in der Prüfung, nur
                    nirgends eine Stelle, an der man es ausfüllen konnte.

                    Angeklickt statt getippt, und trotzdem frei: beliebige
                    Dienstlängen in Viertelstunden, bis zu vier verschiedene
                    nebeneinander. „Einmal sechs, dreimal acht, ein fester
                    freier Tag" lässt sich damit genauso abbilden wie
                    „fünfmal sieben".
                  */}
                  <Tagesmusterfeld
                    muster={planningProfileDraft.tagesmuster ?? null}
                    setzen={m => setPlanningProfileDraft(d => d ? { ...d, tagesmuster: m } : d)}
                    sollStunden={planningProfileDraft.planungsStundenSoll
                      ?? selectedEmployee?.weeklyHours ?? null}
                    moeglicheTage={moeglicheArbeitstage(
                      selectedEmployee?.workDaysPerWeek,
                      selectedEmployee?.fixedOffDays,
                    )}
                  />

                  {/* Zuschlagsregelung */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Zuschlagsregelung</label>
                    <select
                      value={planningProfileDraft.surchargeMode}
                      onChange={e => setPlanningProfileDraft(d => d ? { ...d, surchargeMode: e.target.value } : d)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value="unternehmensregel">Unternehmensweite Regelung gilt</option>
                      <option value="abweichungen">Gilt mit Abweichungen</option>
                      <option value="individuell">Individuelle Regelung</option>
                    </select>
                  </div>

                  <button
                    disabled={planningProfileSaving}
                    onClick={async () => {
                      if (!selectedEmployee || !planningProfileDraft) return
                      setPlanningProfileSaving(true)
                      const res = await fetch(`/api/employees/${selectedEmployee.id}/planning-profile`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(planningProfileDraft),
                      })
                      if (res.ok) {
                        const d = await res.json()
                        setPlanningProfile(d.profile)
                        showToast('Planungsprofil gespeichert', 'success')
                      } else {
                        showToast('Fehler beim Speichern', 'error')
                      }
                      setPlanningProfileSaving(false)
                    }}
                    className="w-full text-xs bg-blue-600 text-white rounded-lg py-1.5 disabled:opacity-50"
                  >
                    {planningProfileSaving ? 'Speichert…' : 'Planungsprofil speichern'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                className="gap-2 border border-gray-200"
                onClick={() => { setEditChatDraft(employeeToDraft(selectedEmployee, humanContext)); setEditChatEmployee(selectedEmployee); setSelectedEmployee(null) }}
              >
                <MessageCircle size={16} />
                Per KI-Chat
              </Button>
              <Button
                variant="ghost"
                className="gap-2 border border-gray-200"
                onClick={() => { setEditFormDraft(employeeToDraft(selectedEmployee, humanContext)); setEditFormEmployee(selectedEmployee); setSelectedEmployee(null) }}
              >
                <ListChecks size={16} />
                Klassisch bearbeiten
              </Button>
            </div>

            <Button variant="ghost" className="w-full border border-gray-200" onClick={() => setSelectedEmployee(null)}>
              Schließen
            </Button>
          </div>
        )}
      </Modal>

      <EmployeeCreationChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onSave={handleSaveFromChat}
        onDraftSync={handleDraftSync}
      />

      <EmployeeCreationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={draft => handleSaveFromChat(draft, null)}
      />

      <EmployeeCreationChat
        key={editChatEmployee?.id ?? 'none'}
        open={!!editChatEmployee}
        onClose={() => { setEditChatEmployee(null); setEditChatDraft(null) }}
        onSave={handleUpdateFromChat}
        initialDraft={editChatDraft ?? undefined}
        employeeName={editChatEmployee?.name}
      />

      <EmployeeCreationForm
        key={editFormEmployee?.id ?? 'none-edit'}
        open={!!editFormEmployee}
        onClose={() => { setEditFormEmployee(null); setEditFormDraft(null) }}
        onSave={handleUpdateFromForm}
        initialDraft={editFormDraft ?? undefined}
        employeeName={editFormEmployee?.name}
      />
    </>
  )
}

/**
 * §225 Das Tagesmuster eintragen — angeklickt, nicht getippt.
 *
 * WARUM NICHT EINFACH EIN TEXTFELD
 * „Dreimal acht und einmal sechs" ist für einen Menschen eindeutig und für
 * ein Programm nicht. Jede Schreibweise, die jemand sich ausdenkt, müsste
 * geraten werden — und ein falsch geratenes Muster erzeugt keinen schlechten
 * Plan, sondern gar keinen (CP-SAT INFEASIBLE, siehe `tagesmuster.ts`).
 *
 * WARUM NICHT EINFACH EINE AUSWAHL „5 × 7" / „5 × 8"
 * Weil die Wirklichkeit nicht aus zwei Fällen besteht. Eine 30-Stunden-Kraft
 * mit einem Sechsstundentag, drei Achtstundentagen und einem festen freien
 * Tag muss sich genauso eintragen lassen wie „fünfmal sieben".
 *
 * Deshalb Zeilen: je Zeile eine Dienstlänge und wie oft sie vorkommt, beides
 * aus einer Liste gewählt. Darunter steht, was dabei herauskommt, und ob es
 * zu den Stunden und den freien Tagen passt — mit genau der Prüfung, die
 * nachher auch der Server anwendet.
 */
function Tagesmusterfeld({ muster, setzen, sollStunden, moeglicheTage }: {
  muster: Tagesmuster | null
  setzen: (m: Tagesmuster | null) => void
  sollStunden: number | null
  moeglicheTage: number
}) {
  const zeilen = muster ?? []
  const pruefung = pruefeTagesmuster(
    zeilen.length > 0 ? zeilen : null, sollStunden, moeglicheTage)

  // Viertelstunden von 1 bis 12 — die Grenzen aus `tagesmuster.ts`.
  const laengen: number[] = []
  for (let h = 1; h <= 12; h += 0.25) laengen.push(Math.round(h * 100) / 100)

  const aendern = (i: number, feld: 'stunden' | 'tage', wert: number) => {
    const neu = zeilen.map((z, k) => k === i ? { ...z, [feld]: wert } : z)
    setzen(neu)
  }

  /*
   * „Gleichmäßig verteilen" rechnet aus den Stunden und den verfügbaren
   * Tagen das naheliegende Muster: 35 Stunden auf 5 Tage sind fünfmal
   * sieben. Es ist ein Vorschlag und keine Festlegung — wer es anders
   * braucht, ändert die Zeilen danach.
   */
  function gleichmaessig() {
    if (!sollStunden || moeglicheTage <= 0) return
    const proTag = Math.round((sollStunden / moeglicheTage) * 4) / 4
    setzen([{ stunden: proTag, tage: moeglicheTage }])
  }

  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">
        Tagesmuster — wie sich die Wochenstunden verteilen
      </label>

      {zeilen.length === 0 ? (
        <p className="text-[11px] text-gray-400 mb-2">
          Kein festes Muster: Der Dienstplan verteilt die Stunden frei über die
          Woche. Für Verträge mit festen Tageslängen hier eintragen.
        </p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {zeilen.map((z, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={z.tage}
                onChange={e => aendern(i, 'tage', Number(e.target.value))}
                data-test="muster-tage"
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(t => (
                  <option key={t} value={t}>{t} ×</option>
                ))}
              </select>
              <select
                value={z.stunden}
                onChange={e => aendern(i, 'stunden', Number(e.target.value))}
                data-test="muster-stunden"
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              >
                {laengen.map(h => (
                  <option key={h} value={h}>
                    {String(h).replace('.', ',')} Std.
                  </option>
                ))}
              </select>
              <button
                onClick={() => setzen(zeilen.filter((_, k) => k !== i))}
                aria-label="Zeile entfernen"
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {zeilen.length < 4 && (
          <button
            onClick={() => setzen([...zeilen, { stunden: 8, tage: 1 }])}
            data-test="muster-zeile-dazu"
            className="text-[11px] font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            + Dienstlänge
          </button>
        )}
        {sollStunden && moeglicheTage > 0 && (
          <button
            onClick={gleichmaessig}
            className="text-[11px] font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Gleichmäßig verteilen
          </button>
        )}
        {zeilen.length > 0 && (
          <button
            onClick={() => setzen(null)}
            className="text-[11px] font-medium px-2 py-1 rounded-lg text-gray-400 hover:text-gray-600"
          >
            Muster entfernen
          </button>
        )}
      </div>

      {/*
        Die Rückmeldung kommt aus derselben Funktion, die nachher auf dem
        Server entscheidet. Zwei Prüfungen mit eigenen Grenzen laufen
        auseinander — und dann lehnt die Maske etwas ab, was gespeichert
        würde, oder schlimmer: umgekehrt.
      */}
      {zeilen.length > 0 && (
        <p className={`text-[11px] mt-1.5 ${pruefung.fehler ? 'text-red-600' : 'text-green-700'}`}>
          {pruefung.fehler
            ?? `${musterText(pruefung.muster)} — ${String(pruefung.wochenstunden).replace('.', ',')} `
              + `Std. auf ${pruefung.arbeitstage} Tagen.`}
        </p>
      )}
    </div>
  )
}
