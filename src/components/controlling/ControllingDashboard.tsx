'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  Sparkles, Users, Clock4, Palmtree, UserPlus, CheckCircle2, AlertTriangle, XCircle,
  Send, MessageCircle, Loader2, Scale, Thermometer, ListChecks,
} from 'lucide-react'
import type { ControllingSnapshot, StatusLevel } from '@/lib/controlling-service'

const STATUS_STYLES: Record<StatusLevel, { icon: typeof CheckCircle2; className: string }> = {
  green: { icon: CheckCircle2, className: 'text-green-600' },
  yellow: { icon: AlertTriangle, className: 'text-amber-600' },
  red: { icon: XCircle, className: 'text-red-600' },
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

export function ControllingDashboard({ fetchUrl }: { fetchUrl: string }) {
  const { user } = useAuth()
  const [data, setData] = useState<ControllingSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(fetchUrl).then(res => res.json()).then(setData).finally(() => setLoading(false))
  }, [fetchUrl])

  const firstName = user?.name?.split(' ')[0] ?? ''

  async function handleAsk() {
    const q = question.trim()
    if (!q || asking) return
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setQuestion('')
    setAsking(true)
    try {
      const url = new URL(fetchUrl, 'http://localhost')
      const res = await fetch('/api/controlling/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          locationId: url.searchParams.get('locationId') ?? undefined,
          scope: url.searchParams.get('scope') ?? undefined,
        }),
      })
      const json = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: json.answer ?? json.error ?? 'Keine Antwort erhalten.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Die Frage konnte nicht beantwortet werden.' }])
    } finally {
      setAsking(false)
    }
  }

  if (loading || !data) {
    return <div className="text-gray-400 text-sm py-10 text-center">Lade Personalsituation…</div>
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-brand/10 shrink-0">
            <Sparkles size={20} className="text-brand" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-navy">
              {firstName ? `Guten Tag ${firstName}.` : 'Guten Tag.'} Hier ist die aktuelle Situation.
            </p>
            <ul className="mt-3 space-y-1.5">
              {data.statusItems.map((item, i) => {
                const Icon = STATUS_STYLES[item.level].icon
                return (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <Icon size={15} className={cn('shrink-0', STATUS_STYLES[item.level].className)} />
                    {item.message}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Mitarbeiter" value={data.employeeCount} icon={Users} />
        <StatCard title="Überstunden-Hotspots" value={data.overtimeHotspots.length} subtitle={data.overtimeHotspots[0]?.employeeName} icon={Clock4} alert={data.overtimeHotspots.length > 0} />
        <StatCard title="Offene Urlaubsanträge" value={data.pendingVacationRequests} icon={Palmtree} alert={data.pendingVacationRequests > 0} />
        <StatCard title="Offene Vertretungen" value={data.openSubstitutionRequests} icon={UserPlus} alert={data.openSubstitutionRequests > 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personalübersicht (heute)</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-400">Anzahl Mitarbeiter</p><p className="font-semibold text-navy">{data.personnelOverview.totalEmployees}</p></div>
          <div><p className="text-gray-400">Aktuell anwesend</p><p className="font-semibold text-navy">{data.personnelOverview.presentToday}</p></div>
          <div><p className="text-gray-400">Krank</p><p className="font-semibold text-navy">{data.personnelOverview.sickToday}</p></div>
          <div><p className="text-gray-400">Urlaub</p><p className="font-semibold text-navy">{data.personnelOverview.onVacationToday}</p></div>
          <div><p className="text-gray-400">Fortbildung</p><p className="font-semibold text-navy">{data.personnelOverview.trainingToday}</p></div>
          <div><p className="text-gray-400">Sonstige Fehlzeiten</p><p className="font-semibold text-navy">{data.personnelOverview.otherAbsenceToday}</p></div>
          <div><p className="text-gray-400">Offene Vertretungen</p><p className="font-semibold text-navy">{data.personnelOverview.openSubstitutions}</p></div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Thermometer size={16} className="text-brand" /> Krankheitsanalyse</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
          <div><p className="text-gray-400">Aktuell krank/abwesend</p><p className="font-semibold text-navy">{data.sickness.currentlyAbsentCount}</p></div>
          <div><p className="text-gray-400">Krankheitstage gesamt</p><p className="font-semibold text-navy">{data.sickness.totalSickDays}</p></div>
          <div><p className="text-gray-400">Sonstige Fehlzeiten (Tage)</p><p className="font-semibold text-navy">{data.sickness.totalOtherAbsenceDays}</p></div>
          <div><p className="text-gray-400">Offene Verifizierungen</p><p className="font-semibold text-navy">{data.sickness.openVerifications}</p></div>
        </div>
        {data.sickness.topSickEmployees.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400">Höchste Krankheitstage</p>
            {data.sickness.topSickEmployees.map(e => (
              <div key={e.employeeId} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{e.employeeName}</span>
                <span className="font-semibold text-navy">{e.sickDays} Tage</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Management-Kennzahlen</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="text-gray-400">Überstunden gesamt</p><p className="font-semibold text-navy">{data.kpis.overtimeHours}h</p></div>
          <div><p className="text-gray-400">Minusstunden gesamt</p><p className="font-semibold text-navy">{data.kpis.undertimeHours}h</p></div>
          <div><p className="text-gray-400">Krankheitsquote</p><p className="font-semibold text-navy">{data.kpis.sicknessRate}%</p></div>
          <div><p className="text-gray-400">Urlaubsquote</p><p className="font-semibold text-navy">{data.kpis.vacationRate}%</p></div>
          <div><p className="text-gray-400">Mitarbeiteranzahl</p><p className="font-semibold text-navy">{data.employeeCount}</p></div>
          <div><p className="text-gray-400">Ø Auslastung</p><p className="font-semibold text-navy">{data.kpis.avgUtilizationRate}%</p></div>
          <div><p className="text-gray-400">Vertretungsquote</p><p className="font-semibold text-navy">{data.kpis.fillRate}%</p></div>
          <div><p className="text-gray-400">Dienstplanstabilität</p><p className="font-semibold text-navy">{data.kpis.scheduleStabilityRate}%</p></div>
          <div><p className="text-gray-400">Wunschdienst-Erfüllung</p><p className="font-semibold text-navy">{data.kpis.wishFulfillmentRate}%</p></div>
          <div><p className="text-gray-400">Fairness-Score</p><p className="font-semibold text-navy">{data.kpis.avgFairnessScore}</p></div>
          <div><p className="text-gray-400">Ø Besetzung</p><p className="font-semibold text-navy">{data.kpis.avgStaffingRate}%</p></div>
          <div><p className="text-gray-400">Ø Zeit bis Besetzung</p><p className="font-semibold text-navy">{data.kpis.avgTimeToFillHours !== null ? `${data.kpis.avgTimeToFillHours}h` : '–'}</p></div>
          <div><p className="text-gray-400">Urlaubs-Genehmigungsquote</p><p className="font-semibold text-navy">{data.kpis.approvalRate}%</p></div>
          <div><p className="text-gray-400">Pünktliche Einstempelungen</p><p className="font-semibold text-navy">{data.kpis.punctualClockInRate}%</p></div>
          <div><p className="text-gray-400">Ø Wochenstunden (Soll)</p><p className="font-semibold text-navy">{data.kpis.avgWeeklyHoursTarget}h</p></div>
          <div><p className="text-gray-400">Unterbesetzte Schichten</p><p className="font-semibold text-navy">{data.kpis.understaffedShiftSlots} / {data.kpis.totalShiftSlots}</p></div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks size={16} className="text-brand" /> Aufgaben der Leitung</CardTitle>
          </CardHeader>
          <ul className="space-y-2">
            {data.tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 size={14} className="text-brand shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Empfehlungen der KI</CardTitle>
          </CardHeader>
          <ul className="space-y-2">
            {data.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <Scale size={14} className="text-brand shrink-0 mt-0.5" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risiken im Blick</CardTitle>
        </CardHeader>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Mitarbeiter mit hohem Burnout-Risiko</span>
            <span className="font-semibold text-navy">{data.highBurnoutRisks.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Mitarbeiter mit hohem Fluktuationsrisiko</span>
            <span className="font-semibold text-navy">{data.highFluctuationRisks.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Mitarbeiter mit Fairness-Auffälligkeiten</span>
            <span className="font-semibold text-navy">{data.fairnessIssueCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Kritische Mindestbesetzungstage (7 Tage)</span>
            <span className="font-semibold text-navy">{data.criticalUnderstaffingDays.length}</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KI-Assistent fragen</CardTitle>
        </CardHeader>
        <p className="text-xs text-gray-400 mb-3">Stelle Fragen zur aktuellen Personalsituation, z. B. „Wer hat aktuell die meisten Überstunden?“ oder „Wo besteht Handlungsbedarf?“</p>
        {messages.length > 0 && (
          <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  m.role === 'user' ? 'bg-brand text-navy' : 'bg-gray-100 text-gray-700'
                )}>
                  {m.role === 'assistant' && <MessageCircle size={12} className="inline mr-1 -mt-0.5" />}
                  {m.text}
                </div>
              </div>
            ))}
            {asking && <div className="text-xs text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> KI denkt nach…</div>}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="Frage an die KI…"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <Button onClick={handleAsk} loading={asking} size="md">
            <Send size={14} />
          </Button>
        </div>
      </Card>
    </div>
  )
}
