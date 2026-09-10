'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  ChevronLeft, ChevronRight, Download, Plus, Calculator,
  CheckCircle, AlertTriangle, Euro, Users, Upload, RotateCcw,
} from 'lucide-react'
import { ElstamImport } from '@/components/payroll/ElstamImport'
import { Aufrollung } from '@/components/payroll/Aufrollung'
import { useToast } from '@/lib/toast-context'
import { calculatePayroll } from '@/lib/payroll-engine'
import type { PayrollInput, PayrollResult } from '@/lib/payroll-engine'

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

type TaxClass = 1 | 2 | 3 | 4 | 5 | 6

interface Employee { id: string; name: string; weeklyHours?: number; locationId?: string }
interface PayrollEntryData {
  id?: string
  employeeId: string
  employeeName: string
  year: number
  month: number
  status: string
  hourlyWage?: number
  monthlyWage?: number
  regularHours: number
  overtimeHours: number
  nightHours: number
  sundayHours: number
  holidayHours: number
  saturdayHours: number
  vacationDays: number
  sickDays: number
  taxClass: TaxClass
  childCount: number
  insuranceType: 'GKV' | 'PKV'
  pkv?: number
  churchTax: boolean
  bundesland?: string
  brutto: number
  netto: number
  lohnsteuer: number
  rvAN: number
  kvAN: number
  pvAN: number
  avAN: number
  totalDeductions: number
  totalAgCost: number
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function EntryModal({
  employees,
  initialEntry,
  year,
  month,
  onSave,
  onClose,
}: {
  employees: Employee[]
  initialEntry?: Partial<PayrollEntryData>
  year: number
  month: number
  onSave: (entry: PayrollEntryData) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<PayrollInput> & { employeeId: string; monthlyWage?: number; hourlyWage?: number }>({
    employeeId: initialEntry?.employeeId ?? '',
    monthlyWage: initialEntry?.monthlyWage,
    hourlyWage: initialEntry?.hourlyWage,
    regularHours: initialEntry?.regularHours ?? 160,
    overtimeHours: initialEntry?.overtimeHours ?? 0,
    nightHours: initialEntry?.nightHours ?? 0,
    sundayHours: initialEntry?.sundayHours ?? 0,
    holidayHours: initialEntry?.holidayHours ?? 0,
    saturdayHours: initialEntry?.saturdayHours ?? 0,
    vacationDays: initialEntry?.vacationDays ?? 0,
    sickDays: initialEntry?.sickDays ?? 0,
    taxClass: (initialEntry?.taxClass as TaxClass) ?? 1,
    childCount: initialEntry?.childCount ?? 0,
    insuranceType: initialEntry?.insuranceType ?? 'GKV',
    churchTax: initialEntry?.churchTax ?? false,
    bundesland: initialEntry?.bundesland ?? '',
  })
  const [result, setResult] = useState<PayrollResult | null>(null)
  const [rechenFehler, setRechenFehler] = useState<string | null>(null)
  const [wageMode, setWageMode] = useState<'monthly' | 'hourly'>(initialEntry?.monthlyWage != null ? 'monthly' : 'hourly')

  function calc() {
    const input: PayrollInput = {
      ...form,
      jahr: year,
      hourlyWage: wageMode === 'hourly' ? form.hourlyWage : undefined,
      monthlyWage: wageMode === 'monthly' ? form.monthlyWage : undefined,
      taxClass: (form.taxClass as TaxClass) ?? 1,
      childCount: form.childCount ?? 0,
      insuranceType: form.insuranceType ?? 'GKV',
      churchTax: form.churchTax ?? false,
      regularHours: form.regularHours ?? 0,
      overtimeHours: form.overtimeHours ?? 0,
      nightHours: form.nightHours ?? 0,
      sundayHours: form.sundayHours ?? 0,
      holidayHours: form.holidayHours ?? 0,
      saturdayHours: form.saturdayHours ?? 0,
      vacationDays: form.vacationDays ?? 0,
      sickDays: form.sickDays ?? 0,
      bundesland: form.bundesland || undefined,
    }
    // Fuer ein Jahr ohne geprueft hinterlegte Rechengroessen bricht der Kern ab.
    // Das gehoert der Leitung gesagt und nicht in der Konsole versteckt.
    try {
      setResult(calculatePayroll(input))
      setRechenFehler(null)
    } catch (fehler) {
      setResult(null)
      setRechenFehler(fehler instanceof Error ? fehler.message : 'Berechnung nicht möglich.')
    }
  }

  function handleSave() {
    if (!result || !form.employeeId) return
    const emp = employees.find(e => e.id === form.employeeId)
    onSave({
      employeeId: form.employeeId,
      employeeName: emp?.name ?? form.employeeId,
      year,
      month,
      status: 'draft',
      hourlyWage: wageMode === 'hourly' ? form.hourlyWage : undefined,
      monthlyWage: wageMode === 'monthly' ? form.monthlyWage : undefined,
      regularHours: form.regularHours ?? 0,
      overtimeHours: form.overtimeHours ?? 0,
      nightHours: form.nightHours ?? 0,
      sundayHours: form.sundayHours ?? 0,
      holidayHours: form.holidayHours ?? 0,
      saturdayHours: form.saturdayHours ?? 0,
      vacationDays: form.vacationDays ?? 0,
      sickDays: form.sickDays ?? 0,
      taxClass: (form.taxClass as TaxClass) ?? 1,
      childCount: form.childCount ?? 0,
      insuranceType: form.insuranceType ?? 'GKV',
      pkv: form.pkvMonthly,
      churchTax: form.churchTax ?? false,
      bundesland: form.bundesland,
      brutto: result.brutto,
      netto: result.netto,
      lohnsteuer: result.lohnsteuerMonthly,
      rvAN: result.rvAN,
      kvAN: result.kvAN,
      pvAN: result.pvAN,
      avAN: result.avAN,
      totalDeductions: result.totalDeductions,
      totalAgCost: result.totalAgCost,
    })
  }

  const field = (k: keyof typeof form, label: string, type = 'number', min?: number) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        min={min}
        value={(form[k] as number | string | undefined) ?? ''}
        onChange={e => setForm(f => ({ ...f, [k]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-navy">Lohnabrechnung erfassen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-6">
          {/* Employee */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mitarbeiter</label>
            <select
              value={form.employeeId}
              onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="">Mitarbeiter wählen…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Wage */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Vergütungsmodell</label>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setWageMode('monthly')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${wageMode === 'monthly' ? 'bg-navy text-white' : 'border border-gray-200 text-gray-600'}`}>Monatsgehalt</button>
              <button onClick={() => setWageMode('hourly')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${wageMode === 'hourly' ? 'bg-navy text-white' : 'border border-gray-200 text-gray-600'}`}>Stundenlohn</button>
            </div>
            {wageMode === 'monthly'
              ? field('monthlyWage', 'Monatsgehalt (€)')
              : field('hourlyWage', 'Stundenlohn (€/h)')}
          </div>

          {/* Hours */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Stunden</p>
            <div className="grid grid-cols-2 gap-3">
              {field('regularHours', 'Regelarbeitszeit (h)')}
              {field('overtimeHours', 'Überstunden (h)')}
              {field('nightHours', 'Nachtstunden (h)')}
              {field('sundayHours', 'Sonntagsstunden (h)')}
              {field('holidayHours', 'Feiertagsstunden (h)')}
              {field('saturdayHours', 'Samstagsstunden (h)')}
              {field('vacationDays', 'Urlaubstage')}
              {field('sickDays', 'Krankentage')}
            </div>
          </div>

          {/* Tax & Insurance */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Steuer & Sozialversicherung</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Steuerklasse</label>
                <select
                  value={form.taxClass}
                  onChange={e => setForm(f => ({ ...f, taxClass: parseInt(e.target.value) as TaxClass }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {[1,2,3,4,5,6].map(k => <option key={k} value={k}>Klasse {k}</option>)}
                </select>
              </div>
              {field('childCount', 'Kinderfreibeträge')}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Krankenversicherung</label>
                <select
                  value={form.insuranceType}
                  onChange={e => setForm(f => ({ ...f, insuranceType: e.target.value as 'GKV' | 'PKV' }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="GKV">GKV</option>
                  <option value="PKV">PKV</option>
                </select>
              </div>
              {form.insuranceType === 'PKV' && field('pkvMonthly', 'PKV-Prämie (€/Monat)')}
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="church"
                  checked={form.churchTax ?? false}
                  onChange={e => setForm(f => ({ ...f, churchTax: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="church" className="text-sm text-gray-700">Kirchensteuerpflichtig</label>
              </div>
              {form.churchTax && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bundesland (für KiSt-Satz)</label>
                  <input
                    value={form.bundesland ?? ''}
                    onChange={e => setForm(f => ({ ...f, bundesland: e.target.value }))}
                    placeholder="z.B. BY, BW, NW…"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Calculate */}
          <button
            onClick={calc}
            className="w-full py-3 rounded-xl bg-teal-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-teal-700 transition-colors"
          >
            <Calculator size={16} /> Berechnen
          </button>

          {rechenFehler && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900">{rechenFehler}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">Ergebnis</p>
              <p className="text-[11px] text-teal-700">{result.grundlage}</p>
              {result.warnings.length > 0 && result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">{w}</p>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2 flex justify-between bg-white rounded-xl p-3">
                  <span className="font-semibold text-navy">Brutto</span>
                  <span className="font-bold text-navy">{fmt(result.brutto)}</span>
                </div>
                <div className="flex justify-between bg-white rounded-xl p-3">
                  <span className="text-gray-600">Lohnsteuer</span>
                  <span className="text-red-600 font-medium">− {fmt(result.lohnsteuerMonthly)}</span>
                </div>
                {result.kirchensteuerMonthly > 0 && (
                  <div className="flex justify-between bg-white rounded-xl p-3">
                    <span className="text-gray-600">Kirchensteuer</span>
                    <span className="text-red-600 font-medium">− {fmt(result.kirchensteuerMonthly)}</span>
                  </div>
                )}
                {result.soliMonthly > 0 && (
                  <div className="flex justify-between bg-white rounded-xl p-3">
                    <span className="text-gray-600">Soli</span>
                    <span className="text-red-600 font-medium">− {fmt(result.soliMonthly)}</span>
                  </div>
                )}
                <div className="flex justify-between bg-white rounded-xl p-3">
                  <span className="text-gray-600">RV-AN</span>
                  <span className="text-red-600 font-medium">− {fmt(result.rvAN)}</span>
                </div>
                <div className="flex justify-between bg-white rounded-xl p-3">
                  <span className="text-gray-600">KV-AN</span>
                  <span className="text-red-600 font-medium">− {fmt(result.kvAN)}</span>
                </div>
                <div className="flex justify-between bg-white rounded-xl p-3">
                  <span className="text-gray-600">PV-AN</span>
                  <span className="text-red-600 font-medium">− {fmt(result.pvAN)}</span>
                </div>
                <div className="flex justify-between bg-white rounded-xl p-3">
                  <span className="text-gray-600">AV-AN</span>
                  <span className="text-red-600 font-medium">− {fmt(result.avAN)}</span>
                </div>
                <div className="col-span-2 flex justify-between bg-teal-100 rounded-xl p-3">
                  <span className="font-bold text-teal-900">Netto</span>
                  <span className="font-bold text-teal-700 text-lg">{fmt(result.netto)}</span>
                </div>
                <div className="col-span-2 flex justify-between bg-gray-100 rounded-xl p-3 text-xs">
                  <span className="text-gray-600">AG-Gesamtkosten</span>
                  <span className="font-semibold text-gray-700">{fmt(result.totalAgCost)}</span>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={!form.employeeId}
                className="w-full py-2.5 rounded-xl bg-navy text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PayrollPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [entries, setEntries] = useState<PayrollEntryData[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [aktion, setAktion] = useState<string | null>(null)
  const [zeigeElstam, setZeigeElstam] = useState(false)
  const [zeigeAufrollung, setZeigeAufrollung] = useState(false)
  const { showToast } = useToast()
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [eRes, empRes] = await Promise.all([
      fetch(`/api/payroll?year=${year}&month=${month}`),
      fetch('/api/employees'),
    ])
    const eData = await eRes.json()
    const empData = await empRes.json()
    setEntries(eData.entries ?? [])
    setEmployees(empData.employees ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function handleSave(entry: PayrollEntryData) {
    await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    setShowModal(false)
    load()
  }

  async function handleApprove(id: string) {
    await fetch('/api/payroll', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'approved', approvedAt: new Date().toISOString() }),
    })
    load()
  }

  function exportCSV() {
    const header = ['Name', 'Monat', 'Jahr', 'Brutto', 'Netto', 'Lohnsteuer', 'RV-AN', 'KV-AN', 'PV-AN', 'AV-AN', 'AG-Gesamtkosten'].join(';')
    const rows = entries.map(e => [
      e.employeeName, MONTH_NAMES[month - 1], year,
      e.brutto.toFixed(2).replace('.', ','),
      e.netto.toFixed(2).replace('.', ','),
      e.lohnsteuer.toFixed(2).replace('.', ','),
      e.rvAN.toFixed(2).replace('.', ','),
      e.kvAN.toFixed(2).replace('.', ','),
      e.pvAN.toFixed(2).replace('.', ','),
      e.avAN.toFixed(2).replace('.', ','),
      e.totalAgCost.toFixed(2).replace('.', ','),
    ].join(';'))
    const csv = [header, ...rows].join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Lohnabrechnung_${year}_${String(month).padStart(2, '0')}.csv`
    a.click()
  }

  // §114 Der frühere DATEV-Export entstand im Browser und enthielt nur Summen —
  // keine Lohnarten, keine Berater- und Mandantennummer, als Personalnummer die
  // interne Kennung. Damit konnte ein Steuerberater nichts anfangen. Jetzt
  // erzeugt der Server die Datei aus den Lohn-Stammdaten.
  async function dateiHolen(art: 'datev' | 'sepa') {
    setAktion(art)
    try {
      const res = await fetch(`/api/payroll/export?art=${art}&year=${year}&month=${month}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        showToast(d.error ?? 'Export fehlgeschlagen', 'error')
        return
      }
      const uebersprungen = Number(res.headers.get('X-Okun-Uebersprungen') ?? 0)
      const blob = await res.blob()
      const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        ?? `${art}-${year}-${month}`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      URL.revokeObjectURL(a.href)
      showToast(
        uebersprungen > 0
          ? `${name} erstellt — ${uebersprungen} ohne gültige Bankverbindung übersprungen`
          : `${name} erstellt`,
        uebersprungen > 0 ? 'error' : 'success',
      )
    } catch {
      showToast('Export fehlgeschlagen', 'error')
    } finally { setAktion(null) }
  }

  // §113 Abrechnungen aus den Lohn-Stammdaten vorbereiten
  async function vorbereiten() {
    setAktion('vorbereiten')
    try {
      const res = await fetch('/api/payroll/vorbereiten', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(d.error ?? 'Vorbereiten fehlgeschlagen', 'error'); return }
      showToast(d.hinweis ?? 'vorbereitet', (d.unvollstaendig?.length ?? 0) > 0 ? 'error' : 'success')
      load()
    } catch { showToast('Vorbereiten fehlgeschlagen', 'error') }
    finally { setAktion(null) }
  }

  // §113 Belege erzeugen und den Mitarbeitern zustellen
  async function belegeZustellen() {
    setAktion('belege')
    try {
      const res = await fetch('/api/payroll/beleg', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(d.error ?? 'Erzeugen fehlgeschlagen', 'error'); return }
      showToast(d.hinweis ?? 'zugestellt', (d.uebersprungen?.length ?? 0) > 0 ? 'error' : 'success')
    } catch { showToast('Erzeugen fehlgeschlagen', 'error') }
    finally { setAktion(null) }
  }

  const totalBrutto = entries.reduce((s, e) => s + e.brutto, 0)
  const totalNetto = entries.reduce((s, e) => s + e.netto, 0)
  const totalAgCost = entries.reduce((s, e) => s + e.totalAgCost, 0)

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-5">

        {/* Month navigator */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-3">
          <button
            onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-500" />
          </button>
          <span className="text-sm font-semibold text-navy">{MONTH_NAMES[month - 1]} {year}</span>
          <button
            onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Gesamt Brutto', value: fmt(totalBrutto), icon: Euro, color: 'text-navy' },
            { label: 'Gesamt Netto', value: fmt(totalNetto), icon: Euro, color: 'text-teal-600' },
            { label: 'AG-Gesamtkosten', value: fmt(totalAgCost), icon: Users, color: 'text-gray-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <div className="p-4">
                <Icon size={16} className={`${color} mb-2`} />
                <p className="text-lg font-bold text-navy">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <Plus size={16} /> Abrechnung erstellen
          </button>
          {entries.length > 0 && (
            <>
              <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Download size={16} /> CSV Export
              </button>
              <button onClick={vorbereiten} disabled={!!aktion} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <Calculator size={16} /> {aktion === 'vorbereiten' ? 'Wird vorbereitet…' : 'Abrechnung vorbereiten'}
              </button>
              <button onClick={belegeZustellen} disabled={!!aktion} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <Users size={16} /> {aktion === 'belege' ? 'Wird zugestellt…' : 'Belege zustellen'}
              </button>
              <button onClick={() => dateiHolen('sepa')} disabled={!!aktion} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <Euro size={16} /> {aktion === 'sepa' ? 'Wird erstellt…' : 'SEPA-Datei'}
              </button>
              <button onClick={() => dateiHolen('datev')} disabled={!!aktion} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <Download size={16} /> {aktion === 'datev' ? 'Wird erstellt…' : 'DATEV-Export'}
              </button>
            </>
          )}
          <button onClick={() => setZeigeElstam(v => !v)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Upload size={16} /> ELStAM einlesen
          </button>
          <button onClick={() => setZeigeAufrollung(v => !v)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <RotateCcw size={16} /> Abrechnungen prüfen
          </button>
        </div>

        {/* §117 Steuerklasse und Freibeträge kommen vom Finanzamt und ändern
            sich laufend. Ohne Abgleich rechnen wir exakt das Falsche. */}
        {zeigeElstam && <ElstamImport onFertig={load} />}

        {/* §119 Rueckwirkende Aenderungen an freigegebenen Monaten sind der
            Normalfall, nicht der Randfall. Ohne Aufrollung bliebe die
            Abrechnung dauerhaft falsch. */}
        {zeigeAufrollung && <Aufrollung jahr={year} onFertig={load} />}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <Euro size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Noch keine Abrechnungen für diesen Monat</p>
              <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">
                Erste Abrechnung erstellen
              </button>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Mitarbeiter</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Brutto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Abzüge</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 text-teal-700">Netto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">AG-Kosten</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id ?? e.employeeId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-navy">{e.employeeName}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(e.brutto)}</td>
                      <td className="px-4 py-3 text-right text-red-500">− {fmt(e.totalDeductions)}</td>
                      <td className="px-4 py-3 text-right font-bold text-teal-700">{fmt(e.netto)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(e.totalAgCost)}</td>
                      <td className="px-4 py-3 text-center">
                        {e.status === 'approved'
                          ? <Badge variant="success" className="gap-1"><CheckCircle size={10} />Genehmigt</Badge>
                          : <Badge variant="warning">Entwurf</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {e.status !== 'approved' && e.id && (
                          <button
                            onClick={() => e.id && handleApprove(e.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors font-medium"
                          >
                            Genehmigen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <p className="text-xs text-gray-400 text-center">
          Berechnungsgrundlage: §32a EStG, SGB IV (Stand 2025). Bitte Angaben jährlich aktualisieren.
          Für Sonderfälle (Minijob, Kurzarbeit, PKV-Sonderfälle) empfehlen wir steuerliche Beratung.
        </p>
      </div>

      {showModal && (
        <EntryModal
          employees={employees}
          year={year}
          month={month}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
