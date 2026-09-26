'use client'

// §103 Mitarbeiter auf Unternehmensebene.
//
// Der Ablauf ist jetzt: hier anlegen — mit allem, was das Unternehmen über die
// Person weiß, einschließlich der Lohn-Stammdaten — und dabei einem Standort
// zuordnen. Am Standort werden danach nur noch die Dinge geändert, die den
// Dienstplan betreffen: Gruppe, Bereich, feste freie Tage, Qualifikationen.
//
// Grund für die Trennung: Steuerklasse, Bankverbindung und Vertrag sind Sache
// des Unternehmens. Wer in welcher Gruppe steht, weiß nur die Leitung vor Ort.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/lib/toast-context'
import { LohnStammdaten } from '@/components/employees/LohnStammdaten'
import { Personalakte } from '@/components/employees/Personalakte'
import { Users, Plus, Search, MapPin, Loader2, Check, ArrowRightLeft } from 'lucide-react'
import type { Employee, Location } from '@/lib/types'

export default function CompanyEmployees() {
  const { showToast } = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [suche, setSuche] = useState('')
  const [standortFilter, setStandortFilter] = useState('')
  const [laden, setLaden] = useState(true)
  const [offen, setOffen] = useState<Employee | null>(null)
  const [anlegen, setAnlegen] = useState(false)

  const laden_ = useCallback(async () => {
    setLaden(true)
    const [e, l] = await Promise.all([
      fetch('/api/employees').then(r => r.json()).catch(() => ({})),
      fetch('/api/locations').then(r => r.json()).catch(() => ({})),
    ])
    setEmployees(e.employees ?? [])
    setLocations(l.locations ?? [])
    setLaden(false)
  }, [])
  useEffect(() => { laden_() }, [laden_])

  const standortName = useMemo(
    () => new Map(locations.map(l => [l.id, l.name])),
    [locations],
  )

  const gefiltert = employees.filter(e => {
    const passtSuche = !suche || e.name.toLowerCase().includes(suche.toLowerCase())
      || e.email.toLowerCase().includes(suche.toLowerCase())
    const passtStandort = !standortFilter || e.locationId === standortFilter
    return passtSuche && passtStandort
  })

  const ohneStandort = employees.filter(e => !e.locationId)

  const standortZuordnen = async (employeeId: string, locationId: string) => {
    const res = await fetch(`/api/employees/${employeeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId }),
    })
    if (!res.ok) { showToast('Zuordnung fehlgeschlagen', 'error'); return }
    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, locationId } : e))
    setOffen(prev => prev && prev.id === employeeId ? { ...prev, locationId } : prev)
    showToast(`Zugeordnet zu ${standortName.get(locationId) ?? 'Standort'}`, 'success')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Mitarbeiter</h1>
          <p className="text-sm text-gray-500">
            Alle Mitarbeiter des Unternehmens. Hier anlegen, hier die Lohn-Stammdaten
            pflegen, hier einem Standort zuordnen.
          </p>
        </div>
        <Button onClick={() => setAnlegen(true)} className="gap-1.5">
          <Plus size={15} />Mitarbeiter anlegen
        </Button>
      </div>

      {ohneStandort.length > 0 && (
        <Card padding="md" className="border-amber-200 bg-amber-50/50">
          <p className="text-sm font-semibold text-amber-800">
            {ohneStandort.length} Mitarbeiter ohne Standort
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Ohne Standort erscheinen sie in keinem Dienstplan. Person öffnen und zuordnen.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          containerClassName="flex-1 min-w-[12rem]"
          value={suche}
          onChange={e => setSuche(e.target.value)}
          placeholder="Name oder E-Mail suchen"
          icon={Search}
        />
        <select
          value={standortFilter}
          onChange={e => setStandortFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Alle Standorte</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {laden ? (
        <p className="text-sm text-gray-400">Wird geladen…</p>
      ) : gefiltert.length === 0 ? (
        <EmptyState icon={Users} title="Keine Mitarbeiter gefunden" />
      ) : (
        <Card padding="none">
          <div className="divide-y divide-gray-50">
            {gefiltert.map(e => (
              <button
                key={e.id}
                onClick={() => setOffen(e)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <Avatar name={e.name} avatarUrl={e.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{e.name}</p>
                  <p className="text-xs text-gray-400 truncate">{e.position} · {e.weeklyHours} Std./Woche</p>
                </div>
                <span className={`text-xs flex items-center gap-1 flex-shrink-0 ${e.locationId ? 'text-gray-500' : 'text-amber-600 font-medium'}`}>
                  <MapPin size={12} />
                  {e.locationId ? (standortName.get(e.locationId) ?? 'Standort') : 'ohne Standort'}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Detail: Stammdaten, Lohn, Akte, Standortzuordnung */}
      <Modal open={!!offen} onClose={() => setOffen(null)} title={offen?.name ?? ''} size="lg">
        {offen && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={offen.name} avatarUrl={offen.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-navy">{offen.name}</p>
                <p className="text-sm text-gray-500">{offen.email}</p>
              </div>
            </div>

            {/* Standortzuordnung */}
            <div className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <ArrowRightLeft size={14} className="text-gray-400" />
                <p className="text-sm font-semibold text-navy">Standort</p>
              </div>
              <p className="text-[11px] text-gray-400 mb-2">
                Am Standort werden danach nur noch dienstplanbezogene Angaben gepflegt —
                Gruppe, Bereich, feste freie Tage, Qualifikationen.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {locations.map(l => (
                  <button
                    key={l.id}
                    onClick={() => standortZuordnen(offen.id, l.id)}
                    className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                      offen.locationId === l.id
                        ? 'border-navy bg-navy text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {offen.locationId === l.id && <Check size={11} className="inline mr-1" />}
                    {l.name}
                  </button>
                ))}
              </div>
            </div>

            <LohnStammdaten employeeId={offen.id} />

            <div className="border border-gray-100 rounded-xl p-3">
              <Personalakte ownerId={offen.id} verwalten />
            </div>
          </div>
        )}
      </Modal>

      <AnlegenDialog
        offen={anlegen}
        locations={locations}
        onClose={() => setAnlegen(false)}
        onAngelegt={(neu) => { setEmployees(prev => [...prev, neu]); setAnlegen(false); setOffen(neu) }}
      />
    </div>
  )
}

// ── Anlegen ─────────────────────────────────────────────────────────────────
function AnlegenDialog({
  offen, locations, onClose, onAngelegt,
}: {
  offen: boolean
  locations: Location[]
  onClose: () => void
  onAngelegt: (e: Employee) => void
}) {
  const { showToast } = useToast()
  const [daten, setDaten] = useState({
    name: '', email: '', position: '', weeklyHours: 40,
    workDaysPerWeek: 5, locationId: '', vacationDaysTotal: 30,
  })
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    if (offen && locations.length === 1) {
      setDaten(d => ({ ...d, locationId: locations[0].id }))
    }
  }, [offen, locations])

  const anlegen = async () => {
    if (!daten.name.trim() || !daten.email.trim() || !daten.position.trim()) {
      showToast('Name, E-Mail und Funktion sind erforderlich', 'error'); return
    }
    if (!daten.locationId) { showToast('Bitte einen Standort wählen', 'error'); return }
    setSpeichert(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...daten, roleType: daten.position }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.employee) { showToast(d.error ?? 'Anlegen fehlgeschlagen', 'error'); return }
      showToast('Mitarbeiter angelegt — jetzt die Lohn-Stammdaten ergänzen', 'success')
      onAngelegt(d.employee)
      setDaten({ name: '', email: '', position: '', weeklyHours: 40, workDaysPerWeek: 5, locationId: '', vacationDaysTotal: 30 })
    } catch { showToast('Anlegen fehlgeschlagen', 'error') }
    finally { setSpeichert(false) }
  }

  return (
    <Modal open={offen} onClose={onClose} title="Mitarbeiter anlegen" size="md">
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Zuerst die Grunddaten. Lohn-Stammdaten und Personalakte kommen im
          nächsten Schritt dazu.
        </p>
        <Input label="Name" value={daten.name} onChange={e => setDaten(d => ({ ...d, name: e.target.value }))} placeholder="Vor- und Nachname" />
        <Input label="E-Mail" type="email" value={daten.email} onChange={e => setDaten(d => ({ ...d, email: e.target.value }))} placeholder="name@unternehmen.de" />
        <Input label="Funktion" value={daten.position} onChange={e => setDaten(d => ({ ...d, position: e.target.value }))} placeholder="z.B. Erzieherin, Pflegefachkraft" />
        <div className="grid grid-cols-3 gap-2">
          <Input label="Std./Woche" type="number" value={daten.weeklyHours} onChange={e => setDaten(d => ({ ...d, weeklyHours: Number(e.target.value) }))} />
          <Input label="Arbeitstage" type="number" value={daten.workDaysPerWeek} onChange={e => setDaten(d => ({ ...d, workDaysPerWeek: Number(e.target.value) }))} />
          <Input label="Urlaubstage" type="number" value={daten.vacationDaysTotal} onChange={e => setDaten(d => ({ ...d, vacationDaysTotal: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">Standort</label>
          <select
            value={daten.locationId}
            onChange={e => setDaten(d => ({ ...d, locationId: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="">— Standort wählen —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <Button onClick={anlegen} disabled={speichert} className="w-full gap-1.5">
          {speichert ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Anlegen und Einladung senden
        </Button>
      </div>
    </Modal>
  )
}
