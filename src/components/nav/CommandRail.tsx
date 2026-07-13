'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Logo } from '@/components/ui/Logo'

const PATH_LABELS: Record<string, string> = {
  // Admin
  '/admin':                    'Dashboard',
  '/admin/employees':          'Mitarbeiter',
  '/admin/schedule':           'Dienstplanung',
  '/admin/calendar':           'Kalender',
  '/admin/vacation-requests':  'Urlaubsanträge',
  '/admin/vacation-plan':      'Jahresurlaubsplan',
  '/admin/tasks':              'Aufgaben',
  '/admin/substitutions':      'Vertretungen',
  '/admin/time-tracking':      'Zeiterfassung',
  '/admin/workforce-score':    'Workforce Score',
  '/admin/workforce-insights': 'Workforce Insights',
  '/admin/fairness-engine':    'Fairness Engine',
  '/admin/personnel-risk':     'Personalrisiko',
  '/admin/controlling':        'KI-Controlling',
  '/admin/reports':            'Berichte',
  '/admin/onboarding':         'Standort-Onboarding',
  '/admin/assistant':          'OKUN Assistent',
  '/admin/payroll':            'Lohnabrechnung',
  '/admin/surcharges':         'Zuschlags-Engine',
  // Employee
  '/employee':                 'Mein Tag',
  '/employee/schedule':        'Mein Dienstplan',
  '/employee/time-tracking':   'Zeiterfassung',
  '/employee/vacation':        'Urlaub',
  '/employee/profile':         'Mein Profil',
  '/employee/substitutions':   'Vertretungen',
  // Company
  '/company':                  'Unternehmensübersicht',
  '/company/locations':        'Standorte',
  '/company/bereiche':         'Bereiche',
  '/company/employees':        'Mitarbeiter',
  '/company/schedule':         'Alle Dienstpläne',
  '/company/vacation-plan':    'Jahresurlaubsplanung',
  '/company/substitutions':    'Vertretungen',
  '/company/workforce-score':  'Workforce Score',
  '/company/workforce-insights':'Workforce Insights',
  '/company/fairness-engine':  'Fairness Engine',
  '/company/personnel-risk':   'Personalrisiko',
  '/company/controlling':      'KI-Controlling',
  '/company/reports':          'Berichte',
  '/company/settings':         'Einstellungen',
  '/company/onboarding':       'KI-Onboarding',
  '/company/support':          'Support',
  // OKUN
  '/okun':                     'Systemübersicht',
  '/okun/customers':           'Kunden',
  '/okun/support':             'Support',
  '/okun/bugs':                'Bug-Management',
  '/okun/test-accounts':       'Testzugänge',
  '/okun/invitations':         'Einladungen',
  // Account
  '/account':                  'Mein Konto',
}

function resolveLabel(pathname: string): string {
  // Longest-prefix match
  let best = ''
  for (const key of Object.keys(PATH_LABELS)) {
    if ((pathname === key || pathname.startsWith(key + '/')) && key.length > best.length) {
      best = key
    }
  }
  return PATH_LABELS[best] ?? 'OKUN Workforce'
}

export function CommandRail() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [time, setTime] = useState('')
  const [label, setLabel] = useState(resolveLabel(pathname))

  // Tick clock
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  // Crossfade label on navigation
  useEffect(() => {
    setLabel(resolveLabel(pathname))
  }, [pathname])

  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 h-11 flex items-center px-4 gap-3 select-none"
      style={{
        background: 'rgba(249,250,251,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {/* Brand icon */}
      <Logo variant="icon" iconSize={22} className="flex-shrink-0 opacity-90" />

      {/* Divider */}
      <div className="w-px h-4 bg-black/10 flex-shrink-0" />

      {/* Current section */}
      <span
        className="text-[13px] font-semibold text-navy/75 tracking-tight transition-all duration-300"
        key={label}
        style={{ animation: 'label-in 0.2s ease-out forwards' }}
      >
        {label}
      </span>

      <div className="flex-1" />

      {/* Right: time + user initial */}
      <div className="flex items-center gap-2.5">
        {time && (
          <span className="text-[12px] font-medium text-gray-400 tabular-nums">{time}</span>
        )}
        {user?.name && (
          <>
            <div className="w-px h-3.5 bg-black/10" />
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #26C6C6 0%, #0E6B6F 100%)' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
