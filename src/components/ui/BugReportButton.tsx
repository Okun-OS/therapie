'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bug, X, Send, ChevronDown } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { usePathname } from 'next/navigation'

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Kleiner Fehler' },
  { value: 'normal', label: 'Mittlerer Fehler' },
  { value: 'high', label: 'Kritischer Fehler' },
]

function getBrowserInfo(): { browser: string; os: string; screenSize: string } {
  const ua = navigator.userAgent
  let browser = 'Unbekannt'
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ''}`
  else if (ua.includes('Firefox')) browser = `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ''}`
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ''}`
  else if (ua.includes('Edg')) browser = `Edge ${ua.match(/Edg\/([\d.]+)/)?.[1] ?? ''}`

  let os = 'Unbekannt'
  if (ua.includes('Windows NT')) os = 'Windows'
  else if (ua.includes('Mac OS X')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return {
    browser,
    os,
    screenSize: `${window.screen.width}×${window.screen.height} (viewport: ${window.innerWidth}×${window.innerHeight})`,
  }
}

// Track last actions globally (last 10 clicks/navigations)
const lastActions: string[] = []
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const label = target.closest('button, a')?.textContent?.trim().slice(0, 40)
    if (label) {
      lastActions.push(`[Klick] ${label}`)
      if (lastActions.length > 10) lastActions.shift()
    }
  }, { passive: true, capture: true })
}

export function BugReportButton() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [ticketId, setTicketId] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'normal',
  })

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) return
    setSending(true)
    try {
      const { browser, os, screenSize } = getBrowserInfo()
      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          severity: form.severity,
          userId: user?.id ?? null,
          userName: user?.name ?? null,
          userRole: user?.role ?? null,
          page: pathname,
          browser,
          os,
          screenSize,
          lastActions: lastActions.slice().reverse().join('\n'),
        }),
      })
      const data = await res.json()
      setTicketId(data.ticketId ?? '')
      setDone(true)
    } catch {
      // keep open so user can retry
    } finally {
      setSending(false)
    }
  }, [form, user, pathname])

  function handleClose() {
    setOpen(false)
    setDone(false)
    setForm({ title: '', description: '', severity: 'normal' })
  }

  if (!user) return null

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 lg:bottom-6 z-40 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:shadow-lg transition-all"
        title="Fehler melden"
      >
        <Bug size={16} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bug size={16} className="text-red-500" />
                <span className="font-semibold text-gray-900 text-sm">Fehler melden</span>
              </div>
              <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>

            {done ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Send size={20} className="text-green-600" />
                </div>
                <p className="font-semibold text-gray-900 mb-1">Danke für deine Meldung!</p>
                <p className="text-sm text-gray-500 mb-1">Dein Ticket wurde erstellt.</p>
                <p className="text-xs font-mono bg-gray-100 rounded px-2 py-1 inline-block text-gray-600">{ticketId}</p>
                <div className="mt-4">
                  <button onClick={handleClose} className="px-4 py-2 rounded-xl bg-navy text-white text-sm font-medium hover:opacity-90">
                    Schließen
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Auto-collected info */}
                <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500 space-y-0.5">
                  <p><span className="font-medium">Seite:</span> {pathname}</p>
                  <p><span className="font-medium">Rolle:</span> {user.role}</p>
                  <p><span className="font-medium">Nutzer:</span> {user.name}</p>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Was ist das Problem? *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Kurze Beschreibung des Fehlers"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Details (optional)</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Was hast du erwartet? Was ist passiert? Wie lässt sich der Fehler reproduzieren?"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Schweregrad</label>
                  <div className="relative">
                    <select
                      value={form.severity}
                      onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    >
                      {SEVERITY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!form.title.trim() || sending}
                  className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending ? 'Wird gesendet…' : (
                    <><Send size={14} /> Fehler melden</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
