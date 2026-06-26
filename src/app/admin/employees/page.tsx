'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { FeatureIntro } from '@/components/onboarding/FeatureIntro'
import { EmployeeCreationChat } from '@/components/employees/EmployeeCreationChat'
import { EMPLOYEES, updateEmployee, addEmployee, getOvertimeRequestsByEmployee, getAbsencesByEmployee } from '@/lib/mock-data'
import { Users, Plus, Search, Clock, TrendingUp, Palmtree, Edit, ChevronRight, MessageCircle } from 'lucide-react'
import type { Employee } from '@/lib/types'
import type { EmployeeDraft } from '@/lib/employee-draft'

interface EmployeeHumanContext {
  strengths: string[]
  lifeCircumstances: string[]
  preferredGroups: string[]
  preferredActivities: string[]
  agreements: string | null
}

export default function AdminEmployees() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const locationId = user?.locationId || 'loc1'

  const [search, setSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', position: '', weeklyHours: 38 })
  const [chatOpen, setChatOpen] = useState(false)
  const [editChatEmployee, setEditChatEmployee] = useState<Employee | null>(null)
  const [editChatDraft, setEditChatDraft] = useState<EmployeeDraft | null>(null)
  const [humanContext, setHumanContext] = useState<EmployeeHumanContext | null>(null)

  function employeeToDraft(emp: Employee, ctx: EmployeeHumanContext | null): EmployeeDraft {
    return {
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      birthDate: emp.birthDate,
      roleType: emp.roleType,
      employmentType: emp.employmentType,
      weeklyHours: emp.weeklyHours,
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

  const startEditing = (emp: Employee) => {
    setEditForm({ name: emp.name, email: emp.email, position: emp.position, weeklyHours: emp.weeklyHours })
    setIsEditing(true)
  }

  const saveEdit = () => {
    if (!selectedEmployee) return
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.position.trim()) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error')
      return
    }
    updateEmployee(selectedEmployee.id, editForm)
    showToast('Mitarbeiter aktualisiert', 'success')
    setIsEditing(false)
    setSelectedEmployee(null)
  }

  const handleSaveFromChat = async (draft: EmployeeDraft) => {
    if (!draft.name?.trim() || !draft.email?.trim()) {
      showToast('Name und E-Mail werden benötigt, um den Mitarbeiter zu speichern', 'error')
      return
    }
    const employee = addEmployee({
      name: draft.name,
      email: draft.email,
      position: draft.roleType || 'Mitarbeiter',
      weeklyHours: draft.weeklyHours || 38,
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
    })
    if ((draft.besonderheiten && draft.besonderheiten.length > 0) || draft.absprachen) {
      try {
        await fetch('/api/employee-human-context', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: employee.id,
            lifeCircumstances: draft.besonderheiten,
            agreements: draft.absprachen,
          }),
        })
      } catch {
        // Mitarbeiter ist bereits angelegt; die Besonderheiten können später im Profil ergänzt werden.
      }
    }
    showToast('Mitarbeiter gespeichert', 'success')
  }

  const handleUpdateFromChat = async (draft: EmployeeDraft) => {
    if (!editChatEmployee) return
    updateEmployee(editChatEmployee.id, {
      ...(draft.name && { name: draft.name }),
      ...(draft.email && { email: draft.email }),
      ...(draft.phone !== undefined && { phone: draft.phone }),
      ...(draft.birthDate !== undefined && { birthDate: draft.birthDate }),
      ...(draft.roleType !== undefined && { roleType: draft.roleType, position: draft.roleType }),
      ...(draft.employmentType !== undefined && { employmentType: draft.employmentType }),
      ...(draft.weeklyHours !== undefined && { weeklyHours: draft.weeklyHours }),
      ...(draft.gruppe !== undefined && { gruppe: draft.gruppe }),
      ...(draft.bereich !== undefined && { bereich: draft.bereich }),
      ...(draft.multiGroupCapable !== undefined && { multiGroupCapable: draft.multiGroupCapable }),
      ...(draft.fixedLocations !== undefined && { fixedLocations: draft.fixedLocations }),
      ...(draft.qualifications !== undefined && { qualifications: draft.qualifications }),
      ...(draft.allowedTasks !== undefined && { allowedTasks: draft.allowedTasks }),
    })
    if ((draft.besonderheiten && draft.besonderheiten.length > 0) || draft.absprachen) {
      try {
        await fetch('/api/employee-human-context', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: editChatEmployee.id,
            lifeCircumstances: draft.besonderheiten,
            agreements: draft.absprachen,
          }),
        })
      } catch {
        // Profil ist bereits aktualisiert; die Besonderheiten können später erneut ergänzt werden.
      }
    }
    showToast('Profil aktualisiert', 'success')
    setEditChatEmployee(null)
    setSelectedEmployee(prev => prev && prev.id === editChatEmployee.id ? { ...prev, ...draft } as Employee : prev)
  }

  const employees = EMPLOYEES.filter(
    e => e.locationId === locationId && e.role === 'employee'
  ).filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase())
  )

  const getBalanceColor = (h: number) => h > 0 ? 'text-green-600' : h < 0 ? 'text-red-500' : 'text-gray-500'

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
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Mitarbeiter suchen..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
            />
          </div>
          <Button size="md" onClick={() => setChatOpen(true)} className="gap-2 whitespace-nowrap">
            <Plus size={16} />
            <span className="hidden sm:inline">Mitarbeiter</span>
          </Button>
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
              <div className="w-12 h-12 rounded-2xl bg-navy flex items-center justify-center font-bold text-brand text-sm flex-shrink-0">
                {emp.name.split(' ').map(n => n[0]).join('')}
              </div>

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
            <div className="text-center py-12">
              <Users size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">Keine Mitarbeiter gefunden</p>
            </div>
          )}
        </div>
      </div>

      {/* Employee Detail / Edit Modal */}
      <Modal
        open={!!selectedEmployee}
        onClose={() => { setSelectedEmployee(null); setIsEditing(false) }}
        title={isEditing ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter-Details'}
      >
        {selectedEmployee && !isEditing && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-navy flex items-center justify-center font-bold text-brand text-xl flex-shrink-0">
                {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
              </div>
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
                const overtimeMinutes = getOvertimeRequestsByEmployee(selectedEmployee.id)
                  .filter(o => (o.status === 'approved' || o.status === 'partial') && o.date.startsWith(`${year}`))
                  .reduce((s, o) => s + (o.approvedMinutes ?? 0), 0)
                const absences = getAbsencesByEmployee(selectedEmployee.id).filter(a => a.startDate.startsWith(`${year}`))
                const sickDays = absences.filter(a => a.type === 'krankheit').reduce((s, a) => s + a.days, 0)
                const otherDays = absences.filter(a => a.type !== 'krankheit').reduce((s, a) => s + a.days, 0)
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

            {humanContext && (humanContext.strengths.length > 0 || humanContext.lifeCircumstances.length > 0 || humanContext.preferredGroups.length > 0 || humanContext.preferredActivities.length > 0 || humanContext.agreements) && (
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
                {humanContext.agreements && (
                  <p className="text-xs text-purple-600 italic">{humanContext.agreements}</p>
                )}
              </div>
            )}

            <Button
              variant="ghost"
              className="w-full gap-2 border border-gray-200"
              onClick={() => { setEditChatDraft(employeeToDraft(selectedEmployee, humanContext)); setEditChatEmployee(selectedEmployee); setSelectedEmployee(null) }}
            >
              <MessageCircle size={16} />
              Per KI-Chat aktualisieren
            </Button>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setSelectedEmployee(null)}>
                Schließen
              </Button>
              <Button className="flex-1 gap-2" onClick={() => startEditing(selectedEmployee)}>
                <Edit size={16} />
                Bearbeiten
              </Button>
            </div>
          </div>
        )}

        {selectedEmployee && isEditing && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Name</label>
              <input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">E-Mail</label>
              <input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Position</label>
              <input
                value={editForm.position}
                onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Wochenstunden</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={10} max={60} step={2}
                  value={editForm.weeklyHours}
                  onChange={e => setEditForm(f => ({ ...f, weeklyHours: Number(e.target.value) }))}
                  className="flex-1 accent-brand"
                />
                <span className="font-bold text-navy w-12 text-center">{editForm.weeklyHours}h</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setIsEditing(false)}>
                Abbrechen
              </Button>
              <Button className="flex-1" onClick={saveEdit}>Speichern</Button>
            </div>
          </div>
        )}
      </Modal>

      <EmployeeCreationChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onSave={handleSaveFromChat}
      />

      <EmployeeCreationChat
        key={editChatEmployee?.id ?? 'none'}
        open={!!editChatEmployee}
        onClose={() => { setEditChatEmployee(null); setEditChatDraft(null) }}
        onSave={handleUpdateFromChat}
        initialDraft={editChatDraft ?? undefined}
        employeeName={editChatEmployee?.name}
      />
    </>
  )
}
