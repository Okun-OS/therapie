'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { FeatureIntro } from '@/components/onboarding/FeatureIntro'
import { EmployeeCreationChat } from '@/components/employees/EmployeeCreationChat'
import { EmployeeCreationForm } from '@/components/employees/EmployeeCreationForm'
import { EmptyState } from '@/components/ui/EmptyState'
import { Users, Plus, Search, Clock, TrendingUp, Palmtree, ChevronRight, MessageCircle, Sparkles, ListChecks, AlertTriangle } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import type { Employee, OvertimeRequest, Absence } from '@/lib/types'
import type { EmployeeDraft } from '@/lib/employee-draft'

interface EmployeeHumanContext {
  strengths: string[]
  lifeCircumstances: string[]
  preferredGroups: string[]
  preferredActivities: string[]
  shiftPreferences: string[]
  agreements: string | null
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
      return
    }
    fetch(`/api/employee-human-context?employeeId=${selectedEmployee.id}`)
      .then(res => res.json())
      .then(data => setHumanContext(data.contexts?.[0] ?? null))
      .catch(() => setHumanContext(null))
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
    const updated = await parseEmployeeResponse(await fetch(`/api/employees/${editFormEmployee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchFieldsFromDraft(draft)),
    }))
    setAllEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))
    await saveHumanContextFromDraft(editFormEmployee.id, draft)
    showToast('Profil aktualisiert', 'success')
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
        <Header title="Mitarbeiter" subtitle="Kein Standort zugeordnet" />
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
      <Header title="Mitarbeiter" subtitle={`${employees.length} aktive Mitarbeiter`} />
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
