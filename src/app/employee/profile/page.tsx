'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth-context'
import {
  SCHEDULE_ENTRIES, getShiftById,
  getOvertimeRequestsByEmployee, getAbsencesByEmployee, getMonthlyClosingsByEmployee, getOrCreateMonthlyClosing,
} from '@/lib/mock-data'
import { HumanContextChat } from '@/components/profile/HumanContextChat'
import { User, MapPin, Clock, Sun, Moon, Briefcase, Save, Bell, Shield, AlertCircle, Heart, Lock, Sparkles, X, Trash2, ListChecks, FileText, History, Calendar, Copy, Check } from 'lucide-react'
import { formatDate, toDateString } from '@/lib/utils'
import type { Employee, Location } from '@/lib/types'

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const CLOSING_STATUS_LABEL: Record<string, string> = { offen: 'Offen', geprueft: 'Geprüft', freigegeben: 'Freigegeben' }

function TagInputSection({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string
  items: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  placeholder: string
}) {
  const [value, setValue] = useState('')
  const handleAdd = () => {
    const v = value.trim()
    if (!v) return
    onAdd(v)
    setValue('')
  }
  return (
    <div>
      <p className="text-sm font-semibold text-navy mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap mb-2">
        {items.map(item => (
          <span
            key={item}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 bg-purple-50 border-purple-300 text-purple-700"
          >
            {item}
            <button onClick={() => onRemove(item)} aria-label={`${item} entfernen`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-xs text-gray-400">Noch keine Angabe – am einfachsten über den KI-Assistenten</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <Button onClick={handleAdd} size="md" variant="secondary">Hinzufügen</Button>
      </div>
    </div>
  )
}

export default function EmployeeProfile() {
  const { user } = useAuth()
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [allLocations, setAllLocations] = useState<Location[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setAllEmployees(d.employees))
    fetch('/api/locations').then(r => r.json()).then(d => setAllLocations(d.locations))
  }, [])

  const employee = allEmployees.find(e => e.id === user?.id)
  const location = allLocations.find(l => l.id === employee?.locationId)

  const currentYear = new Date().getFullYear()
  const todayStr = toDateString(new Date())

  useEffect(() => {
    if (!employee) return
    for (let i = 0; i < 3; i++) {
      const d = new Date(currentYear, new Date().getMonth() - i, 1)
      getOrCreateMonthlyClosing(employee.id, d.getFullYear(), d.getMonth() + 1, employee)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id])

  const overtimeMinutesThisYear = employee
    ? getOvertimeRequestsByEmployee(employee.id)
        .filter(o => (o.status === 'approved' || o.status === 'partial') && o.date.startsWith(`${currentYear}`))
        .reduce((sum, o) => sum + (o.approvedMinutes ?? 0), 0)
    : 0
  const absencesThisYear = employee ? getAbsencesByEmployee(employee.id).filter(a => a.startDate.startsWith(`${currentYear}`)) : []
  const sickDaysThisYear = absencesThisYear.filter(a => a.type === 'krankheit').reduce((s, a) => s + a.days, 0)
  const otherAbsenceDaysThisYear = absencesThisYear.filter(a => a.type !== 'krankheit').reduce((s, a) => s + a.days, 0)
  const monthlyClosings = employee ? getMonthlyClosingsByEmployee(employee.id).slice(0, 3) : []
  const shiftHistory = employee
    ? SCHEDULE_ENTRIES
        .filter(e => e.employeeId === employee.id && e.date <= todayStr)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6)
    : []

  const initialPrefs = {
    preferEarly: employee?.preferences?.preferredShifts?.includes('early') ?? true,
    preferLate: employee?.preferences?.preferredShifts?.includes('late') ?? false,
    preferMid: employee?.preferences?.preferredShifts?.includes('mid') ?? true,
    noEarlyAfterLate: employee?.preferences?.noEarlyAfterLate ?? true,
    unavailableDays: employee?.preferences?.unavailableDays ?? [0, 6],
    maxConsecutive: employee?.preferences?.maxConsecutiveDays ?? 5,
    notes: employee?.preferences?.notes ?? '',
  }

  const [prefs, setPrefs] = useState(initialPrefs)
  const [savedPrefs, setSavedPrefs] = useState(initialPrefs)
  const [saved, setSaved] = useState(false)

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs)

  const initialHumanContext = { strengths: [] as string[], lifeCircumstances: [] as string[], preferredGroups: [] as string[], preferredActivities: [] as string[], shiftPreferences: [] as string[], agreements: '' }
  const [humanContext, setHumanContext] = useState(initialHumanContext)
  const [savedHumanContext, setSavedHumanContext] = useState(initialHumanContext)
  const [humanContextSaved, setHumanContextSaved] = useState(false)
  const [humanContextLoaded, setHumanContextLoaded] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const isHumanContextDirty = JSON.stringify(humanContext) !== JSON.stringify(savedHumanContext)

  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false)
  const [calendarSyncToken, setCalendarSyncToken] = useState<string | null>(null)
  const [calendarSyncLoading, setCalendarSyncLoading] = useState(false)
  const [calendarLinkCopied, setCalendarLinkCopied] = useState(false)

  useEffect(() => {
    if (!employee) return
    fetch(`/api/calendar-sync?employeeId=${employee.id}`)
      .then(res => res.json())
      .then(data => {
        setCalendarSyncEnabled(data.enabled ?? false)
        setCalendarSyncToken(data.token ?? null)
      })
      .catch(() => {})
  }, [employee?.id])

  const toggleCalendarSync = async () => {
    if (!employee) return
    setCalendarSyncLoading(true)
    try {
      const res = await fetch('/api/calendar-sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, enabled: !calendarSyncEnabled }),
      })
      const data = await res.json()
      setCalendarSyncEnabled(data.enabled ?? false)
      setCalendarSyncToken(data.token ?? null)
    } finally {
      setCalendarSyncLoading(false)
    }
  }

  const calendarFeedUrl = calendarSyncToken && typeof window !== 'undefined'
    ? `${window.location.origin}/api/calendar-feed/${calendarSyncToken}`
    : ''

  useEffect(() => {
    if (!employee) return
    fetch(`/api/employee-human-context?employeeId=${employee.id}`)
      .then(res => res.json())
      .then(data => {
        const ctx = data.contexts?.[0]
        const loaded = {
          strengths: ctx?.strengths ?? [],
          lifeCircumstances: ctx?.lifeCircumstances ?? [],
          preferredGroups: ctx?.preferredGroups ?? [],
          preferredActivities: ctx?.preferredActivities ?? [],
          shiftPreferences: ctx?.shiftPreferences ?? [],
          agreements: ctx?.agreements ?? '',
        }
        setHumanContext(loaded)
        setSavedHumanContext(loaded)
        setHumanContextLoaded(true)
      })
      .catch(() => setHumanContextLoaded(true))
  }, [employee?.id])

  const addTag = (field: 'strengths' | 'lifeCircumstances' | 'preferredGroups' | 'preferredActivities' | 'shiftPreferences', value: string) => {
    setHumanContext(p => (p[field].includes(value) ? p : { ...p, [field]: [...p[field], value] }))
  }

  const removeTag = (field: 'strengths' | 'lifeCircumstances' | 'preferredGroups' | 'preferredActivities' | 'shiftPreferences', value: string) => {
    setHumanContext(p => ({ ...p, [field]: p[field].filter(v => v !== value) }))
  }

  const handleSaveHumanContext = async () => {
    if (!employee) return
    await fetch('/api/employee-human-context', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: employee.id, ...humanContext }),
    })
    setSavedHumanContext(humanContext)
    setHumanContextSaved(true)
    setTimeout(() => setHumanContextSaved(false), 2000)
  }

  const handleClearHumanContext = async () => {
    if (!employee) return
    const cleared = { strengths: [], lifeCircumstances: [], preferredGroups: [], preferredActivities: [], shiftPreferences: [], agreements: '' }
    await fetch('/api/employee-human-context', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: employee.id, ...cleared, agreements: null }),
    })
    setHumanContext(cleared)
    setSavedHumanContext(cleared)
  }

  const toggleDay = (day: number) => {
    setPrefs(p => ({
      ...p,
      unavailableDays: p.unavailableDays.includes(day)
        ? p.unavailableDays.filter(d => d !== day)
        : [...p.unavailableDays, day],
    }))
  }

  const handleSave = async () => {
    if (employee) {
      const updated = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            preferredShifts: [
              ...(prefs.preferEarly ? ['early' as const] : []),
              ...(prefs.preferLate ? ['late' as const] : []),
              ...(prefs.preferMid ? ['mid' as const] : []),
            ],
            unavailableDays: prefs.unavailableDays,
            maxConsecutiveDays: prefs.maxConsecutive,
            noEarlyAfterLate: prefs.noEarlyAfterLate,
            notes: prefs.notes,
          },
        }),
      }).then(r => r.json()).then(d => d.employee)
      setAllEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))
    }
    setSavedPrefs(prefs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!employee) return null

  return (
    <>
      <Header title="Mein Profil" />
      <div className="p-4 sm:p-6 space-y-5">

        {/* Profile Card */}
        <Card padding="lg">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-navy flex items-center justify-center font-bold text-brand text-2xl flex-shrink-0">
              {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-navy">{employee.name}</h2>
              <p className="text-gray-500 text-sm">{employee.position}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin size={12} />
                  {location?.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock size={12} />
                  {employee.weeklyHours}h / Woche
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-navy">{employee.vacationDaysTotal - employee.vacationDaysUsed}</p>
              <p className="text-xs text-gray-500">Resturlaub</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${employee.hoursBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {employee.hoursBalance >= 0 ? '+' : ''}{employee.hoursBalance}h
              </p>
              <p className="text-xs text-gray-500">Stundenkonto</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-navy">{employee.weeklyHours}h</p>
              <p className="text-xs text-gray-500">Wochenstunden</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-navy">{Math.round(overtimeMinutesThisYear / 6) / 10}h</p>
              <p className="text-xs text-gray-500">Überstunden {currentYear}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-navy">{sickDaysThisYear}</p>
              <p className="text-xs text-gray-500">Krankheitstage {currentYear}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-navy">{otherAbsenceDaysThisYear}</p>
              <p className="text-xs text-gray-500">Fehlzeiten {currentYear}</p>
            </div>
          </div>
        </Card>

        {/* Monatsübersichten */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-navy" />
              <CardTitle>Monatsübersichten</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-2">
            {monthlyClosings.map(closing => (
              <div key={closing.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-navy">{MONTH_NAMES[closing.month - 1]} {closing.year}</p>
                  <p className="text-xs text-gray-500">{closing.arbeitstage} Arbeitstage</p>
                </div>
                <Badge variant={closing.status === 'freigegeben' ? 'success' : closing.status === 'geprueft' ? 'info' : 'warning'}>
                  {CLOSING_STATUS_LABEL[closing.status]}
                </Badge>
              </div>
            ))}
            {monthlyClosings.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Noch keine Monatsübersichten vorhanden</p>}
          </div>
        </Card>

        {/* Diensthistorie */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History size={16} className="text-navy" />
              <CardTitle>Diensthistorie</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-2">
            {shiftHistory.map(entry => {
              const shift = getShiftById(entry.shiftId)
              return (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <p className="text-sm text-navy">{formatDate(entry.date)}</p>
                  {shift && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ color: shift.color, backgroundColor: shift.bgColor }}>
                      {shift.name}
                    </span>
                  )}
                </div>
              )
            })}
            {shiftHistory.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Noch keine vergangenen Dienste</p>}
          </div>
        </Card>

        {/* Eigene Aufgaben */}
        {(employee.allowedTasks?.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-navy" />
                <CardTitle>Meine Aufgaben</CardTitle>
              </div>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {employee.allowedTasks!.map(task => (
                <span key={task} className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50 border-2 border-purple-300 text-purple-700">
                  {task}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Shift Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Dienstpräferenzen</CardTitle>
            <Badge variant="info">wird bei KI berücksichtigt</Badge>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-navy mb-2">Bevorzugte Dienste</p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { key: 'preferEarly', label: 'Frühdienst', icon: Sun, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                  { key: 'preferLate', label: 'Spätdienst', icon: Moon, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
                  { key: 'preferMid', label: 'Mitteldienst', icon: Briefcase, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                ].map(({ key, label, icon: Icon, color, bg }) => (
                  <button
                    key={key}
                    onClick={() => setPrefs(p => ({ ...p, [key]: !p[key as keyof typeof prefs] }))}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${prefs[key as keyof typeof prefs] ? `${bg} border-current ${color}` : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-navy mb-2">Nicht verfügbar an</p>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-xl text-sm font-semibold border-2 transition-all ${prefs.unavailableDays.includes(idx) ? 'bg-navy border-navy text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Dunkel = nicht verfügbar</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-navy mb-2">Einschränkungen</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={prefs.noEarlyAfterLate}
                      onChange={e => setPrefs(p => ({ ...p, noEarlyAfterLate: e.target.checked }))}
                    />
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${prefs.noEarlyAfterLate ? 'bg-brand border-brand-dark' : 'border-gray-300'}`}>
                      {prefs.noEarlyAfterLate && <svg className="w-3 h-3 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <span className="text-sm text-navy">Kein Frühdienst nach Spätdienst</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Maximale Folgetage</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={prefs.maxConsecutive}
                  onChange={e => setPrefs(p => ({ ...p, maxConsecutive: Number(e.target.value) }))}
                  className="flex-1 accent-brand"
                />
                <span className="text-sm font-bold text-navy w-12 text-center">{prefs.maxConsecutive} Tage</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Sonstige Notizen</label>
              <textarea
                value={prefs.notes}
                onChange={e => setPrefs(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="z.B. Nur jede zweite Woche Frühdienst, keine langen Blöcke..."
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>

            {isDirty && !saved && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <AlertCircle size={14} />
                Ungespeicherte Änderungen
              </div>
            )}

            <Button onClick={handleSave} size="lg" className={`w-full gap-2 transition-all ${saved ? 'bg-green-500 hover:bg-green-600' : ''}`}>
              <Save size={18} />
              {saved ? 'Gespeichert!' : 'Präferenzen speichern'}
            </Button>
          </div>
        </Card>

        {/* Human Context (Module 8: Menschliche Dienstplanung) */}
        <Card>
          <CardHeader>
            <CardTitle>Persönliches</CardTitle>
            <Badge variant="purple">freiwillig</Badge>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
              <Lock size={14} className="flex-shrink-0 mt-0.5 text-gray-400" />
              <span>
                Diese Angaben sind freiwillig, jederzeit änderbar oder löschbar und nur für die Leitung sichtbar.
                Sie helfen der KI, faire und menschlichere Dienstpläne zu erstellen – die KI entscheidet aber
                niemals ausschließlich aufgrund dieser persönlichen Informationen.
              </span>
            </div>

            <Button
              onClick={() => setChatOpen(true)}
              size="lg"
              className="w-full gap-2"
            >
              <Sparkles size={18} />
              Im Gespräch mit der KI erzählen
            </Button>
            <p className="text-xs text-gray-400 -mt-2">
              Am einfachsten erzählst du der KI im Chat frei, was sie wissen soll. Sie versteht deine Antworten
              und trägt sie automatisch ein. Hier siehst du, was bereits erfasst ist, und kannst es bei Bedarf
              direkt korrigieren.
            </p>

            <TagInputSection
              label="Stärken"
              items={humanContext.strengths}
              onAdd={v => addTag('strengths', v)}
              onRemove={v => removeTag('strengths', v)}
              placeholder="z.B. Elternkommunikation, Dokumentation…"
            />

            <TagInputSection
              label="Lebenssituation"
              items={humanContext.lifeCircumstances}
              onAdd={v => addTag('lifeCircumstances', v)}
              onRemove={v => removeTag('lifeCircumstances', v)}
              placeholder="z.B. Alleinerziehend, lange Anfahrt…"
            />

            <TagInputSection
              label="Bevorzugte Gruppen / Bereiche"
              items={humanContext.preferredGroups}
              onAdd={v => addTag('preferredGroups', v)}
              onRemove={v => removeTag('preferredGroups', v)}
              placeholder="z.B. Krippe, Gruppe Sonnenblume…"
            />

            <TagInputSection
              label="Bevorzugte Tätigkeiten"
              items={humanContext.preferredActivities}
              onAdd={v => addTag('preferredActivities', v)}
              onRemove={v => removeTag('preferredActivities', v)}
              placeholder="z.B. Dokumentation, Elternarbeit…"
            />

            <TagInputSection
              label="Schicht-Vorlieben"
              items={humanContext.shiftPreferences}
              onAdd={v => addTag('shiftPreferences', v)}
              onRemove={v => removeTag('shiftPreferences', v)}
              placeholder="z.B. Lieber Frühdienst, wenig Wochenenddienste…"
            />

            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Besondere Absprachen</label>
              <textarea
                value={humanContext.agreements}
                onChange={e => setHumanContext(p => ({ ...p, agreements: e.target.value }))}
                rows={3}
                placeholder="z.B. individuelle Absprachen mit der Leitung..."
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>

            {isHumanContextDirty && !humanContextSaved && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <AlertCircle size={14} />
                Ungespeicherte Änderungen
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveHumanContext}
                size="lg"
                variant="secondary"
                disabled={!humanContextLoaded}
                className={`flex-1 gap-2 transition-all ${humanContextSaved ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
              >
                <Heart size={18} />
                {humanContextSaved ? 'Gespeichert!' : 'Persönliches speichern'}
              </Button>
              <Button
                onClick={handleClearHumanContext}
                size="lg"
                variant="ghost"
                disabled={!humanContextLoaded}
                className="gap-2 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={18} />
                Alle löschen
              </Button>
            </div>
          </div>
        </Card>

        <HumanContextChat
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          employeeId={employee.id}
          onContextUpdate={ctx => {
            const next = {
              strengths: ctx.strengths,
              lifeCircumstances: ctx.lifeCircumstances,
              preferredGroups: ctx.preferredGroups,
              preferredActivities: ctx.preferredActivities,
              shiftPreferences: ctx.shiftPreferences,
              agreements: ctx.agreements ?? '',
            }
            setHumanContext(next)
            setSavedHumanContext(next)
          }}
        />

        {/* Security */}
        <Card>
          <CardTitle className="mb-4">Sicherheit & Benachrichtigungen</CardTitle>
          <div className="space-y-3">
            {[
              { icon: Shield, label: 'Passwort ändern', desc: 'Zuletzt geändert vor 30 Tagen' },
              { icon: Bell, label: 'Push-Benachrichtigungen', desc: 'Dienstplan, Urlaub, Schichterinnerung' },
            ].map(({ icon: Icon, label, desc }) => (
              <button key={label} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Icon size={16} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Google-Kalender-Synchronisation */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>Google-Kalender-Synchronisation</CardTitle>
            <button
              onClick={toggleCalendarSync}
              disabled={calendarSyncLoading}
              aria-label="Google-Kalender-Synchronisation umschalten"
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${calendarSyncEnabled ? 'bg-brand' : 'bg-gray-200'} disabled:opacity-50`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${calendarSyncEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Dein Dienstplan wird automatisch mit deinem Google- oder Apple-Kalender synchronisiert, sofern aktiviert. Jede Änderung am Plan erscheint dort automatisch – ein manuelles Übernehmen ist nicht nötig.
          </p>
          {calendarSyncEnabled && calendarFeedUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 truncate flex-1">{calendarFeedUrl}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(calendarFeedUrl)
                    setCalendarLinkCopied(true)
                    setTimeout(() => setCalendarLinkCopied(false), 2000)
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
                  aria-label="Link kopieren"
                >
                  {calendarLinkCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Diesen Link einmalig in Google Kalender unter „Über URL hinzufügen&ldquo; oder in Apple Kalender unter „Kalender abonnieren&ldquo; einfügen.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
