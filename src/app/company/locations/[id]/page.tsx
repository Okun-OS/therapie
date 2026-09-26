'use client'

// §104 Standort öffnen und alles dazu sehen.
//
// Vorher lagen Dienstplanung, Planungsregeln und die Auswertungen als eigene
// Reiter auf der Unternehmensebene — obwohl sie sich immer auf genau einen
// Standort beziehen. Wer drei Standorte hat, sah dort Zahlen ohne Zuordnung.
//
// Jetzt: ein Standort, eine Seite, und darauf alles Relevante.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import {
  MapPin, Users, CalendarDays, Palmtree, ShieldAlert, RefreshCw,
  ArrowLeft, ChevronRight, Clock, Layers, TrendingUp,
} from 'lucide-react'
import type { Employee, Location, Shift, PlanningUnit } from '@/lib/types'

interface Vertretung { id: string; date: string; startTime: string; endTime: string; status: string }

export default function StandortDetail({ params }: { params: { id: string } }) {
  const standortId = params.id
  const [standort, setStandort] = useState<Location | null>(null)
  const [mitarbeiter, setMitarbeiter] = useState<Employee[]>([])
  const [dienste, setDienste] = useState<Shift[]>([])
  const [einheiten, setEinheiten] = useState<PlanningUnit[]>([])
  const [vertretungen, setVertretungen] = useState<Vertretung[]>([])
  const [regeln, setRegeln] = useState<{ maxWeeklyHours?: number; restHours?: number; maxConsecutiveDays?: number } | null>(null)
  const [laden, setLaden] = useState(true)

  const holen = useCallback(async () => {
    setLaden(true)
    const [l, e, s, u, v, r] = await Promise.all([
      fetch('/api/locations').then(r => r.json()).catch(() => ({})),
      fetch('/api/employees').then(r => r.json()).catch(() => ({})),
      fetch(`/api/shifts?locationId=${standortId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/planning-units?locationId=${standortId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/substitutions?locationId=${standortId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/planning-rules?locationId=${standortId}`).then(r => r.json()).catch(() => ({})),
    ])
    setStandort((l.locations ?? []).find((x: Location) => x.id === standortId) ?? null)
    setMitarbeiter((e.employees ?? []).filter((x: Employee) => x.locationId === standortId))
    setDienste(s.shifts ?? [])
    setEinheiten(u.units ?? [])
    setVertretungen(v.requests ?? [])
    setRegeln(r.rules ?? null)
    setLaden(false)
  }, [standortId])
  useEffect(() => { holen() }, [holen])

  const offeneVertretungen = vertretungen.filter(v => v.status === 'open')
  const etagen = einheiten.filter(u => u.type === 'etage')
  const gruppen = einheiten.filter(u => u.type !== 'etage')
  const ohneGruppe = mitarbeiter.filter(m => !m.gruppe?.trim()).length

  if (laden) return <p className="text-sm text-gray-400">Wird geladen…</p>
  if (!standort) return (
    <div className="space-y-3">
      <Link href="/company/locations" className="text-sm text-brand hover:underline inline-flex items-center gap-1">
        <ArrowLeft size={14} />Zu den Standorten
      </Link>
      <p className="text-sm text-gray-500">Dieser Standort wurde nicht gefunden.</p>
    </div>
  )

  const Kachel = ({ wert, label, warnung }: { wert: string | number; label: string; warnung?: boolean }) => (
    <div className={`rounded-xl p-3 border ${warnung ? 'border-amber-200 bg-amber-50/60' : 'border-gray-100'}`}>
      <p className={`text-2xl font-bold ${warnung ? 'text-amber-700' : 'text-navy'}`}>{wert}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )

  const Bereich = ({ href, icon: Icon, titel, text }: {
    href: string; icon: typeof Users; titel: string; text: string
  }) => (
    <Link href={href}>
      <div className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50 transition-all">
        <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-navy" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy">{titel}</p>
          <p className="text-xs text-gray-400">{text}</p>
        </div>
        <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
      </div>
    </Link>
  )

  return (
    <div className="space-y-4">
      <Link href="/company/locations" className="text-sm text-gray-500 hover:text-navy inline-flex items-center gap-1">
        <ArrowLeft size={14} />Alle Standorte
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{standort.name}</h1>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <MapPin size={13} />{standort.address}, {standort.zip} {standort.city}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={holen} className="gap-1.5">
          <RefreshCw size={13} />Aktualisieren
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kachel wert={mitarbeiter.length} label="Mitarbeiter" />
        <Kachel wert={dienste.length} label="Dienste" warnung={dienste.length === 0} />
        <Kachel wert={gruppen.length > 0 ? gruppen.length : '—'} label={etagen.length > 0 ? `Gruppen in ${etagen.length} Bereichen` : 'Gruppen'} />
        <Kachel wert={offeneVertretungen.length} label="offene Vertretungen" warnung={offeneVertretungen.length > 0} />
      </div>

      {(dienste.length === 0 || (gruppen.length > 0 && ohneGruppe > 0)) && (
        <Card padding="md" className="border-amber-200 bg-amber-50/50">
          <p className="text-sm font-semibold text-amber-800 mb-1">Noch zu erledigen</p>
          <ul className="text-xs text-amber-700 space-y-0.5 list-disc pl-4">
            {dienste.length === 0 && <li>Für diesen Standort sind noch keine Dienste angelegt — ohne sie kann kein Plan entstehen.</li>}
            {gruppen.length > 0 && ohneGruppe > 0 && <li>{ohneGruppe} Mitarbeiter haben noch keine Stammgruppe.</li>}
          </ul>
        </Card>
      )}

      <Card padding="lg">
        <p className="text-sm font-semibold text-navy mb-1">Alles zu diesem Standort</p>
        <p className="text-xs text-gray-400 mb-3">
          Dienstplanung, Urlaub und Auswertungen beziehen sich immer auf einen
          Standort — deshalb liegen sie hier und nicht auf der Unternehmensebene.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Bereich href={`/company/schedule?locationId=${standortId}`} icon={CalendarDays}
            titel="Dienstplan" text="Pläne ansehen und veröffentlichen" />
          <Bereich href={`/company/vacation-plan?locationId=${standortId}`} icon={Palmtree}
            titel="Urlaubsplanung" text="Jahresplanung und Anträge" />
          <Bereich href={`/company/employees?standort=${standortId}`} icon={Users}
            titel={`Mitarbeiter (${mitarbeiter.length})`} text="Stammdaten, Lohn, Personalakte" />
          <Bereich href={`/company/substitutions?locationId=${standortId}`} icon={RefreshCw}
            titel={`Vertretungen${offeneVertretungen.length > 0 ? ` (${offeneVertretungen.length} offen)` : ''}`}
            text="Ausfälle und Einspringen" />
          <Bereich href={`/admin/model?locationId=${standortId}`} icon={ShieldAlert}
            titel="Regeln des Standorts" text="Arbeitszeit, Ruhezeiten, eigene Regeln" />
          <Bereich href={`/admin/workforce-score?locationId=${standortId}`} icon={TrendingUp}
            titel="Auswertungen" text="Score, Fairness, Personalrisiko" />
        </div>
      </Card>

      {regeln && (
        <Card padding="lg">
          <p className="text-sm font-semibold text-navy mb-2 flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />Geltende Basiswerte
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Kachel wert={`${regeln.maxWeeklyHours ?? '—'} h`} label="Max. pro Woche" />
            <Kachel wert={`${regeln.restHours ?? '—'} h`} label="Ruhezeit" />
            <Kachel wert={regeln.maxConsecutiveDays ?? '—'} label="Max. Folgetage" />
          </div>
        </Card>
      )}

      {etagen.length > 0 && (
        <Card padding="lg">
          <p className="text-sm font-semibold text-navy mb-2 flex items-center gap-1.5">
            <Layers size={14} className="text-gray-400" />Struktur
          </p>
          <div className="space-y-2">
            {etagen.map(et => (
              <div key={et.id}>
                <p className="text-[10px] font-bold text-navy/60 uppercase tracking-widest mb-1">{et.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {gruppen.filter(g => g.parentId === et.id).map(g => (
                    <span key={g.id} className="text-xs border border-gray-200 rounded-full px-2.5 py-1 text-gray-600">
                      {g.name}
                      <span className="text-gray-400"> · {mitarbeiter.filter(m =>
                        (m.gruppe ?? '').toLowerCase() === g.name.toLowerCase() ||
                        (m.gruppe ?? '') === g.id).length} Personen</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="lg">
        <p className="text-sm font-semibold text-navy mb-2 flex items-center gap-1.5">
          <Users size={14} className="text-gray-400" />Mitarbeiter an diesem Standort
        </p>
        {mitarbeiter.length === 0 ? (
          <p className="text-xs text-gray-400">
            Noch niemand zugeordnet. Mitarbeiter werden auf der Unternehmensebene angelegt
            und dort einem Standort zugewiesen.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-1.5">
            {mitarbeiter.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-navy truncate">{m.name}</span>
                  <span className="block text-[11px] text-gray-400 truncate">
                    {m.position} · {m.weeklyHours} h{m.gruppe ? ` · ${m.gruppe}` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
