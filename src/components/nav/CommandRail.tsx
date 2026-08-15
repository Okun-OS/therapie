'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Logo } from '@/components/ui/Logo'
import { Bell, Search, ChevronDown, LogOut, User as UserIcon, Megaphone, Send, X } from 'lucide-react'
import Link from 'next/link'
import { getDockItems } from './navData'
import { SearchModal } from './SearchModal'

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
  '/admin/onboarding':                  'Standort-Onboarding',
  '/admin/employee-requests':           'Dienstwünsche & Anträge',
  '/admin/setup':                       'Standort einrichten',
  '/admin/settings/planning-policy':    'Planungsrichtlinien',
  '/admin/assistant':                   'OKUN Assistent',
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

const ROLE_LABELS: Record<string, string> = {
  admin:    'Standortleitung',
  company:  'Geschäftsführung',
  employee: 'Mitarbeiter',
  okun:     'OKUN Admin',
}

function resolveLabel(pathname: string): string {
  let best = ''
  for (const key of Object.keys(PATH_LABELS)) {
    if ((pathname === key || pathname.startsWith(key + '/')) && key.length > best.length) {
      best = key
    }
  }
  return PATH_LABELS[best] ?? 'OKUN Workforce'
}

interface NotifItem {
  id: string
  title: string
  body: string
  read: boolean
}

export function CommandRail() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const router = useRouter()

  const [label, setLabel] = useState(resolveLabel(pathname))
  const [date, setDate] = useState('')
  const [notifications, setNotifications] = useState<NotifItem[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number } | null>(null)

  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Label crossfade + date stamp on navigation
  useEffect(() => {
    setLabel(resolveLabel(pathname))
    setDate(new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }))
  }, [pathname])

  // Initial date
  useEffect(() => {
    setDate(new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }))
  }, [])

  // Load notifications
  useEffect(() => {
    if (!user) return
    fetch(`/api/notifications?employeeId=${user.id}`)
      .then(r => r.json())
      .then(d => setNotifications(Array.isArray(d.notifications) ? d.notifications : []))
      .catch(() => {})
  }, [user])

  // Click-outside to close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const unread = notifications.filter(n => !n.read).length

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {})
  }

  const sendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return
    setBroadcastSending(true)
    setBroadcastResult(null)
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: broadcastTitle.trim(), body: broadcastBody.trim(), url: '/employee/schedule' }),
      })
      const data = await res.json()
      setBroadcastResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 })
      setBroadcastTitle('')
      setBroadcastBody('')
    } catch {
      setBroadcastResult({ sent: 0, failed: 1 })
    } finally {
      setBroadcastSending(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const items = user ? getDockItems(user.role) : []

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-30 h-[70px] flex items-center px-4 gap-2 select-none"
        style={{
          background: 'rgba(249,250,251,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
        }}
      >
        {/* ── Left: Logo + page label ────────────────── */}
        <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
          <Logo variant="wordmark" tagline iconSize={52} className="flex-shrink-0 hidden sm:block" />
          <Logo variant="icon" iconSize={32} className="flex-shrink-0 sm:hidden opacity-95" />
          <div className="w-px h-5 bg-black/10 flex-shrink-0" />
          <div className="flex flex-col justify-center min-w-0">
            <span
              className="text-[12px] font-semibold text-navy/80 tracking-tight leading-tight truncate"
              key={label}
              style={{ animation: 'label-in 0.2s ease-out forwards' }}
            >
              {label}
            </span>
            {date && (
              <span className="text-[10px] text-gray-400 leading-tight">{date}</span>
            )}
          </div>
        </div>

        {/* ── Center: Search (desktop only) ──────────── */}
        <div className="hidden md:flex flex-1 justify-center px-6">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full max-w-[280px] flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-all hover:bg-black/[0.06]"
            style={{
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.07)',
            }}
          >
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <span className="text-[12px] text-gray-400 flex-1 whitespace-nowrap">Seite suchen…</span>
            <kbd className="text-[10px] text-gray-300 font-mono hidden lg:block bg-black/[0.04] px-1 rounded">⌘K</kbd>
          </button>
        </div>

        {/* Spacer on mobile */}
        <div className="flex-1 md:hidden" />

        {/* ── Right: actions ──────────────────────────── */}
        <div className="flex items-center gap-0.5 flex-shrink-0">

          {/* Mobile search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/[0.05] transition-colors"
            aria-label="Suche"
          >
            <Search size={16} className="text-gray-500" />
          </button>

          {/* Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/[0.05] transition-colors"
              aria-label="Benachrichtigungen"
            >
              <Bell size={16} className="text-gray-500" />
              {unread > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full ring-[1.5px] ring-gray-50"
                  style={{ background: '#ef4444' }}
                />
              )}
            </button>

            {notifOpen && (
              <div
                className="absolute right-0 top-[calc(100%+6px)] w-80 rounded-2xl overflow-hidden shadow-xl"
                style={{
                  background: 'rgba(255,255,255,0.98)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  backdropFilter: 'blur(20px)',
                  animation: 'modal-in 0.2s ease-out forwards',
                  zIndex: 100,
                }}
              >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-navy text-[13px]">Benachrichtigungen</p>
                  <div className="flex items-center gap-2">
                    {unread > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(38,198,198,0.15)', color: '#0E6B6F' }}>
                        {unread} neu
                      </span>
                    )}
                    {(user?.role === 'admin' || user?.role === 'company') && (
                      <button
                        onClick={() => { setBroadcastOpen(o => !o); setBroadcastResult(null) }}
                        title="Ankündigung an alle Mitarbeiter senden"
                        className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-navy px-2 py-0.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        <Megaphone size={12} />
                        Senden
                      </button>
                    )}
                  </div>
                </div>

                {broadcastOpen && (user?.role === 'admin' || user?.role === 'company') && (
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Ankündigung an alle Mitarbeiter</p>
                      <button onClick={() => setBroadcastOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={12} />
                      </button>
                    </div>
                    <input
                      value={broadcastTitle}
                      onChange={e => setBroadcastTitle(e.target.value)}
                      placeholder="Titel"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy/20 bg-white"
                    />
                    <textarea
                      value={broadcastBody}
                      onChange={e => setBroadcastBody(e.target.value)}
                      placeholder="Nachricht…"
                      rows={2}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-navy/20 bg-white"
                    />
                    {broadcastResult && (
                      <p className={`text-[11px] font-medium ${broadcastResult.failed > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {broadcastResult.failed > 0
                          ? `${broadcastResult.sent} gesendet, ${broadcastResult.failed} fehlgeschlagen`
                          : `${broadcastResult.sent} Mitarbeiter benachrichtigt`}
                      </p>
                    )}
                    <button
                      onClick={sendBroadcast}
                      disabled={broadcastSending || !broadcastTitle.trim() || !broadcastBody.trim()}
                      className="w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold py-1.5 rounded-lg bg-navy text-white hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {broadcastSending ? <span className="animate-pulse">Senden…</span> : <><Send size={11} /> An alle senden</>}
                    </button>
                  </div>
                )}
                <div className="divide-y divide-gray-50/80 max-h-72 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-4 py-6 text-sm text-gray-400 text-center">Keine Benachrichtigungen</p>
                  )}
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={`px-4 py-3 flex gap-2.5 items-start transition-colors cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-brand/[0.04]' : ''}`}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: !n.read ? '#26C6C6' : 'transparent' }}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 truncate">{n.title}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5">{n.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg hover:bg-black/[0.05] transition-colors"
              aria-label="Benutzerprofil"
            >
              <div
                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold text-navy flex-shrink-0"
                style={!user?.avatarUrl ? { background: 'linear-gradient(135deg, #26C6C6 0%, #0E6B6F 100%)' } : undefined}
              >
                {user?.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={user.avatarUrl} alt={user?.name ?? ''} className="w-full h-full object-cover" />
                  : (user?.name?.charAt(0)?.toUpperCase() ?? '?')
                }
              </div>
              <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
                <span className="text-[12px] font-semibold text-navy truncate max-w-[96px]">{user?.name}</span>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</span>
              </div>
              <ChevronDown size={12} className="text-gray-400 hidden sm:block ml-0.5" />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 top-[calc(100%+6px)] w-52 rounded-2xl overflow-hidden shadow-xl"
                style={{
                  background: 'rgba(255,255,255,0.98)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  backdropFilter: 'blur(20px)',
                  animation: 'modal-in 0.2s ease-out forwards',
                  zIndex: 100,
                }}
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[13px] font-semibold text-navy truncate">{user?.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                </div>
                <Link
                  href="/account"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <UserIcon size={14} />
                  Mein Konto
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100"
                >
                  <LogOut size={14} />
                  Abmelden
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {searchOpen && <SearchModal items={items} onClose={() => setSearchOpen(false)} />}
    </>
  )
}
