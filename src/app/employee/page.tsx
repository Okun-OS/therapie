'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Stempeluhr } from '@/components/employee/Stempeluhr'
import {
  Stethoscope, Palmtree, MessageSquare, Repeat, ChevronRight,
  CalendarDays, Receipt,
} from 'lucide-react'
import type { ScheduleEntry, Shift } from '@/lib/types'
import {
  fehltagAm, type Fehlzeiteintrag, type Urlaubseintrag,
} from '@/lib/fehltag'

/**
 * §137 „Heute" — die Startseite der Mitarbeiter-App.
 *
 * Vorher war das ein Schreibtisch-Dashboard im Telefonformat: Kacheln mit
 * Wochenstunden, Resturlaub, Punkten, Schnellzugriffen. Alles interessant,
 * nichts davon der Grund, warum jemand um zehn vor sechs das Telefon aus der
 * Tasche holt.
 *
 * Dieser Grund ist EIN Handgriff: einstempeln. Er steht jetzt oben, groß, ohne
 * Scrollen. Darunter nur noch das, was heute wirklich ansteht — und was auf
 * eine Antwort wartet.
 *
 * Zahlen zum Nachschlagen (Stundenkonto, Resturlaub, Punkte) sind nicht
 * verschwunden, sie stehen unter „Ich". Eine Startseite, die alles zeigt,
 * zeigt nichts.
 */

interface Ungelesen { ungelesen: number }

export default function Heute() {
  const { user } = useAuth()
  const [eintraege, setEintraege] = useState<ScheduleEntry[]>([])
  const [dienste, setDienste] = useState<Shift[]>([])
  const [ungelesen, setUngelesen] = useState(0)
  const [anfragen, setAnfragen] = useState(0)
  const [fehlzeiten, setFehlzeiten] = useState<Fehlzeiteintrag[]>([])
  const [urlaube, setUrlaube] = useState<Urlaubseintrag[]>([])

  useEffect(() => {
    fetch('/api/shifts').then(r => r.json()).then(d => setDienste(d.shifts ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/schedule-entries?employeeId=${user.employeeId}`)
      .then(r => r.json()).then(d => setEintraege(d.entries ?? [])).catch(() => {})
    fetch('/api/chat/ungelesen')
      .then(r => r.json()).then((d: Ungelesen) => setUngelesen(d.ungelesen ?? 0)).catch(() => {})
    fetch(`/api/substitutions/incoming?employeeId=${user.employeeId}`)
      .then(r => r.json())
      .then(d => setAnfragen((d.requests ?? []).filter(
        (x: { responseStatus?: string }) => x.responseStatus === 'pending').length))
      .catch(() => {})
    /*
     * §287 Ob heute überhaupt gearbeitet wird.
     *
     * Die Startseite kannte Krankmeldung und Urlaub nicht. Wer sich abends
     * krankgemeldet hatte, las am nächsten Morgen ganz oben „Heute
     * Frühdienst 8 · 06:00–14:30" und darunter einen Knopf „Einstempeln" —
     * die prominenteste Stelle der App behauptete das Gegenteil dessen, was
     * er selbst gemeldet hatte.
     */
    fetch(`/api/absences?employeeId=${user.employeeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setFehlzeiten(d?.absences ?? [])).catch(() => {})
    fetch(`/api/vacation-requests?employeeId=${user.employeeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setUrlaube(d?.requests ?? [])).catch(() => {})
  }, [user?.employeeId])

  const heute = new Date()
  const heuteStr = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}`
    + `-${String(heute.getDate()).padStart(2, '0')}`

  const meine = eintraege.filter(e => e.employeeId === user?.employeeId)
  const heutiger = meine.find(e => e.date === heuteStr)
  const dienstVon = (id: string) => dienste.find(s => s.id === id)
  const heutigerDienst = heutiger ? dienstVon(heutiger.shiftId) : null

  const naechste = meine
    .filter(e => e.date > heuteStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  const stunde = heute.getHours()
  const gruss = stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Guten Tag' : 'Guten Abend'
  const vorname = (user?.name ?? '').split(' ')[0]

  const wochentag = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })

  // §287 Was heute statt des Dienstes gilt — dieselbe Entscheidung wie im Plan.
  const fehltag = fehltagAm(heuteStr, { fehlzeiten, urlaube })
  const langesDatum = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE',
      { weekday: 'long', day: '2-digit', month: '2-digit' })

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
      <p className="text-navy font-bold text-xl">
        {gruss}{vorname ? `, ${vorname}` : ''}
      </p>

      {/*
        §287 Steht für heute eine Krankmeldung oder ein Urlaub, sagt das die
        Seite — vor der Uhr und nicht irgendwo darunter.

        Die Uhr bleibt trotzdem da, und zwar ohne Dienst: Wer sich krank
        gemeldet hat und doch kommt, soll stempeln können (dann fragt die Uhr
        nach dem Grund, §203). Ein Knopf, der an diesem Tag „Frühdienst 8"
        behauptet, wäre die Unwahrheit — ein fehlender Knopf aber eine
        verlorene Arbeitsstunde.
      */}
      {fehltag && (
        <div className={`rounded-2xl p-4 flex items-start gap-3 ${
          fehltag.art === 'krank' ? 'bg-red-50 border border-red-100'
            : fehltag.art === 'urlaub' ? 'bg-teal-50 border border-teal-100'
              : 'bg-gray-50 border border-gray-200'}`}>
          {fehltag.art === 'urlaub'
            ? <Palmtree size={20} className="text-teal-700 shrink-0 mt-0.5" />
            : <Stethoscope size={20} className={`shrink-0 mt-0.5 ${
              fehltag.art === 'krank' ? 'text-red-600' : 'text-gray-500'}`} />}
          <div className="min-w-0">
            <p className={`font-bold text-sm ${
              fehltag.art === 'krank' ? 'text-red-800'
                : fehltag.art === 'urlaub' ? 'text-teal-900' : 'text-navy'}`}>
              {fehltag.text}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {/*
                `langesDatum` endet schon auf einen Punkt („Mittwoch, 11.11.").
                Noch einen anzuhängen ergibt „15.11..".
              */}
              {fehltag.von === fehltag.bis
                ? `Für heute, ${langesDatum(fehltag.von)}`
                : `${langesDatum(fehltag.von)} bis ${langesDatum(fehltag.bis)}`}
              {heutigerDienst
                ? ` — ${heutigerDienst.name} · ${heutigerDienst.startTime}–${heutigerDienst.endTime} entfällt.`
                : ''}
            </p>
          </div>
        </div>
      )}

      <Stempeluhr
        dienst={!fehltag && heutigerDienst
          ? { name: heutigerDienst.name, von: heutigerDienst.startTime, bis: heutigerDienst.endTime }
          : null}
      />

      {/* Was auf eine Antwort wartet — nur wenn es etwas gibt. */}
      {(ungelesen > 0 || anfragen > 0) && (
        <div className="space-y-2">
          {anfragen > 0 && (
            <Karte
              href="/employee/substitutions"
              icon={<Repeat size={18} className="text-amber-600" />}
              titel={anfragen === 1 ? 'Eine Anfrage zum Einspringen' : `${anfragen} Anfragen zum Einspringen`}
              text="Jemand fällt aus — kannst du?"
              dringend
            />
          )}
          {ungelesen > 0 && (
            <Karte
              href="/employee/nachrichten"
              icon={<MessageSquare size={18} className="text-teal-600" />}
              titel={ungelesen === 1 ? 'Eine neue Nachricht' : `${ungelesen} neue Nachrichten`}
              text="Im Postfach"
            />
          )}
        </div>
      )}

      {/* Zwei Handgriffe, die man unterwegs braucht */}
      <div className="grid grid-cols-2 gap-2.5">
        <Schnell
          href="/employee/krank"
          icon={<Stethoscope size={20} className="text-purple-600" />}
          titel="Krankmelden"
        />
        <Schnell
          href="/employee/vacation"
          icon={<Palmtree size={20} className="text-teal-600" />}
          titel="Urlaub beantragen"
        />
      </div>

      {/* Die nächsten Dienste */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <p className="text-sm font-semibold text-navy">Nächste Dienste</p>
          <Link href="/employee/schedule" className="text-xs font-semibold text-teal-700">
            Ganzer Plan
          </Link>
        </div>
        {naechste.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 pb-4">
            Für die nächsten Tage ist nichts eingeplant.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {naechste.map(e => {
              const d = dienstVon(e.shiftId)
              /*
               * §287 Ein Dienst, der in eine Krankmeldung oder einen Urlaub
               * fällt, steht hier als das, was er ist. Vorher kündigte diese
               * Liste dem Krankgeschriebenen seinen Freitagsdienst an, als
               * wäre nichts.
               */
              const faelltAus = fehltagAm(e.date, { fehlzeiten, urlaube })
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <CalendarDays size={16} className={`shrink-0 ${
                    faelltAus ? 'text-red-300' : 'text-gray-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${
                      faelltAus ? 'text-gray-400 line-through' : 'text-navy'}`}>
                      {wochentag(e.date)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {d ? `${d.name} · ${d.startTime}–${d.endTime}` : 'Dienst'}
                    </p>
                    {faelltAus && (
                      <p className="text-xs text-red-600 font-medium">
                        Entfällt — {faelltAus.text.toLowerCase()}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Link
        href="/employee/lohn"
        className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3.5"
      >
        <Receipt size={18} className="text-gray-400 shrink-0" />
        <span className="text-sm font-medium text-navy flex-1">Meine Lohnabrechnungen</span>
        <ChevronRight size={16} className="text-gray-300" />
      </Link>
    </div>
  )
}

function Karte({ href, icon, titel, text, dringend }: {
  href: string; icon: React.ReactNode; titel: string; text: string; dringend?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${
        dringend ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy">{titel}</span>
        <span className="block text-xs text-gray-500">{text}</span>
      </span>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </Link>
  )
}

function Schnell({ href, icon, titel }: { href: string; icon: React.ReactNode; titel: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-start gap-2 bg-white rounded-2xl border border-gray-100 p-4
                 active:scale-[0.98] transition-transform"
    >
      {icon}
      <span className="text-sm font-semibold text-navy leading-tight">{titel}</span>
    </Link>
  )
}
