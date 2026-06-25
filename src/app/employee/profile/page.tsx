'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth-context'
import { EMPLOYEES, LOCATIONS, updateEmployee } from '@/lib/mock-data'
import { User, MapPin, Clock, Sun, Moon, Briefcase, Save, Bell, Shield, AlertCircle, Heart, Lock } from 'lucide-react'

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

const STRENGTH_OPTIONS = [
  'Elternkommunikation', 'Dokumentation', 'U3-Erfahrung', 'Vorschularbeit',
  'Krisensituationen', 'Organisation', 'Einarbeitung neuer Kollegen', 'Verwaltung', 'Leitungsaufgaben',
]

const LIFE_OPTIONS = [
  'Alleinerziehend', 'Kinder', 'Pflege Angehöriger', 'Studium',
  'Lange Anfahrt', 'Gesundheitliche Einschränkungen', 'Sonstige Besonderheiten',
]

export default function EmployeeProfile() {
  const { user } = useAuth()
  const employee = EMPLOYEES.find(e => e.id === user?.id)
  const location = LOCATIONS.find(l => l.id === employee?.locationId)

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

  const initialHumanContext = { strengths: [] as string[], lifeCircumstances: [] as string[], agreements: '' }
  const [humanContext, setHumanContext] = useState(initialHumanContext)
  const [savedHumanContext, setSavedHumanContext] = useState(initialHumanContext)
  const [humanContextSaved, setHumanContextSaved] = useState(false)
  const [humanContextLoaded, setHumanContextLoaded] = useState(false)

  const isHumanContextDirty = JSON.stringify(humanContext) !== JSON.stringify(savedHumanContext)

  useEffect(() => {
    if (!employee) return
    fetch(`/api/employee-human-context?employeeId=${employee.id}`)
      .then(res => res.json())
      .then(data => {
        const ctx = data.contexts?.[0]
        const loaded = {
          strengths: ctx?.strengths ?? [],
          lifeCircumstances: ctx?.lifeCircumstances ?? [],
          agreements: ctx?.agreements ?? '',
        }
        setHumanContext(loaded)
        setSavedHumanContext(loaded)
        setHumanContextLoaded(true)
      })
      .catch(() => setHumanContextLoaded(true))
  }, [employee?.id])

  const toggleStrength = (item: string) => {
    setHumanContext(p => ({
      ...p,
      strengths: p.strengths.includes(item) ? p.strengths.filter(s => s !== item) : [...p.strengths, item],
    }))
  }

  const toggleLifeCircumstance = (item: string) => {
    setHumanContext(p => ({
      ...p,
      lifeCircumstances: p.lifeCircumstances.includes(item) ? p.lifeCircumstances.filter(s => s !== item) : [...p.lifeCircumstances, item],
    }))
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

  const toggleDay = (day: number) => {
    setPrefs(p => ({
      ...p,
      unavailableDays: p.unavailableDays.includes(day)
        ? p.unavailableDays.filter(d => d !== day)
        : [...p.unavailableDays, day],
    }))
  }

  const handleSave = () => {
    if (employee) {
      updateEmployee(employee.id, {
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
      })
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
        </Card>

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
                Sie helfen der KI, faire und menschlichere Dienstpläne zu erstellen.
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold text-navy mb-2">Stärken</p>
              <div className="flex gap-2 flex-wrap">
                {STRENGTH_OPTIONS.map(item => (
                  <button
                    key={item}
                    onClick={() => toggleStrength(item)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${humanContext.strengths.includes(item) ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-navy mb-2">Lebenssituation</p>
              <div className="flex gap-2 flex-wrap">
                {LIFE_OPTIONS.map(item => (
                  <button
                    key={item}
                    onClick={() => toggleLifeCircumstance(item)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${humanContext.lifeCircumstances.includes(item) ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

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

            <Button
              onClick={handleSaveHumanContext}
              size="lg"
              variant="secondary"
              disabled={!humanContextLoaded}
              className={`w-full gap-2 transition-all ${humanContextSaved ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
            >
              <Heart size={18} />
              {humanContextSaved ? 'Gespeichert!' : 'Persönliches speichern'}
            </Button>
          </div>
        </Card>

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
      </div>
    </>
  )
}
