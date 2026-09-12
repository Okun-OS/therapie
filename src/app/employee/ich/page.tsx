'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import {
  Receipt, Palmtree, Stethoscope, Clock, FolderOpen, User, TrendingUp,
  ChevronRight, LogOut, Shield,
} from 'lucide-react'
import type { Employee } from '@/lib/types'
import { AppEinstellungen } from '@/components/app/AppEinstellungen'

/**
 * §137 „Ich" — alles, was einen selbst betrifft.
 *
 * Die Startseite zeigt, was heute ansteht. Hier steht, was man nachschlägt:
 * Resturlaub, Stundenkonto, Abrechnungen, Unterlagen. Diese Trennung ist der
 * eigentliche Umbau — vorher lag beides auf derselben Seite, und das Wichtige
 * ging im Nützlichen unter.
 *
 * Die zwei Zahlen oben sind die, nach denen im Betrieb am häufigsten gefragt
 * wird: „Wie viel Urlaub habe ich noch?" und „Wie stehen meine Stunden?"
 */

interface Konto { balanceMinutes?: number }

export default function Ich() {
  const { user, logout } = useAuth()
  const [mich, setMich] = useState<Employee | null>(null)
  const [konto, setKonto] = useState<Konto | null>(null)

  useEffect(() => {
    if (!user?.employeeId) return
    fetch('/api/employees')
      .then(r => r.json())
      .then(d => setMich((d.employees ?? []).find((e: Employee) => e.id === user.employeeId) ?? null))
      .catch(() => {})
    fetch(`/api/hours-account?employeeId=${user.employeeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setKonto(d?.account ?? d ?? null))
      .catch(() => {})
  }, [user?.employeeId])

  const resturlaub = mich
    ? (mich.vacationDaysTotal ?? 0) - (mich.vacationDaysUsed ?? 0)
    : null

  const saldo = konto?.balanceMinutes ?? (mich?.hoursBalance != null ? mich.hoursBalance * 60 : null)
  const saldoText = saldo == null
    ? '—'
    : `${saldo >= 0 ? '+' : '−'}${Math.floor(Math.abs(saldo) / 60)}:${String(Math.round(Math.abs(saldo) % 60)).padStart(2, '0')}`

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-navy font-bold text-xl">{user?.name}</h1>
        <p className="text-sm text-gray-500">{mich?.position ?? 'Mitarbeiter'}</p>
      </div>

      {/* Die zwei Zahlen, nach denen am häufigsten gefragt wird */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <Palmtree size={18} className="text-teal-600 mb-2" />
          <p className="text-2xl font-bold text-navy tabular-nums">
            {resturlaub ?? '—'}
          </p>
          <p className="text-xs text-gray-400">Urlaubstage übrig</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <Clock size={18} className="text-navy mb-2" />
          <p className={`text-2xl font-bold tabular-nums ${
            (saldo ?? 0) < 0 ? 'text-amber-700' : 'text-navy'}`}>
            {saldoText}
          </p>
          <p className="text-xs text-gray-400">Stundenkonto</p>
        </div>
      </div>

      <Gruppe>
        <Zeile href="/employee/lohn" icon={<Receipt size={18} className="text-teal-600" />}
          titel="Lohnabrechnungen" text="Ansehen und herunterladen" />
        <Zeile href="/employee/vacation" icon={<Palmtree size={18} className="text-teal-600" />}
          titel="Urlaub" text="Beantragen und Anträge ansehen" />
        <Zeile href="/employee/krank" icon={<Stethoscope size={18} className="text-purple-600" />}
          titel="Krankmelden" text="Meldung und Bescheinigung" />
        <Zeile href="/employee/time-tracking" icon={<Clock size={18} className="text-navy" />}
          titel="Meine Zeiten" text="Buchungen, Überstunden, Monatsabschluss" />
      </Gruppe>

      <Gruppe>
        <Zeile href="/employee/profile" icon={<FolderOpen size={18} className="text-gray-400" />}
          titel="Meine Unterlagen" text="Vertrag, Bescheinigungen, Personalakte" />
        <Zeile href="/employee/profile" icon={<User size={18} className="text-gray-400" />}
          titel="Profil und Einstellungen" text="Kontaktdaten, Kalender, Benachrichtigungen" />
        <Zeile href="/employee/workforce-score" icon={<TrendingUp size={18} className="text-gray-400" />}
          titel="Meine Punkte" text="Workforce Score" />
      </Gruppe>

      {/* §139 Nur in der App: Benachrichtigungen und die Sperre. Beides gehört
          zum Telefon, nicht zum Konto — im Browser rendert es nichts. */}
      <AppEinstellungen />

      <Gruppe>
        {/* §139 Vorher führte das direkt in ein PDF. Die Auskunft ist aber nur
            die eine Hälfte des Rechts — die andere ist die Löschung, und die
            muss in der App erreichbar sein (Art. 17 DSGVO, Apple 5.1.1 v). */}
        <Zeile href="/employee/daten" icon={<Shield size={18} className="text-gray-400" />}
          titel="Meine Daten" text="Auskunft, Mitnehmen und Löschung beantragen" />
        <Zeile href="/funde" icon={<Shield size={18} className="text-gray-400" />}
          titel="Etwas melden" text="Fehler oder Verbesserungsvorschlag" />
      </Gruppe>

      <button
        onClick={() => logout()}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold
                   text-gray-500 py-4"
      >
        <LogOut size={16} /> Abmelden
      </button>
    </div>
  )
}

function Gruppe({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
      {children}
    </div>
  )
}

function Zeile({ href, icon, titel, text, extern }: {
  href: string; icon: React.ReactNode; titel: string; text: string; extern?: boolean
}) {
  const inhalt = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy">{titel}</span>
        <span className="block text-xs text-gray-400">{text}</span>
      </span>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </>
  )
  const klassen = 'flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 w-full text-left'
  return extern
    ? <a href={href} target="_blank" rel="noreferrer" className={klassen}>{inhalt}</a>
    : <Link href={href} className={klassen}>{inhalt}</Link>
}
