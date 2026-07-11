'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  X, ArrowRight, ArrowLeft, Sparkles, Users, Calendar, CalendarDays, Clock,
  Palmtree, LayoutDashboard, MessageCircle, Brain, UserPlus, Euro,
  CheckCircle, BarChart3, MapPin, Bug, RefreshCw,
} from 'lucide-react'
import type { Role } from '@/lib/types'

// ── Persistence ──────────────────────────────────────────────────────────────

const STATE_KEY = 'okun_tour_v4'
const DONE_KEY = (role: Role) => `okun_tour_done_v4:${role}`

interface TourState {
  role: Role
  step: number
  active: boolean
}

function loadState(): TourState | null {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') } catch { return null }
}
function saveState(s: TourState) { localStorage.setItem(STATE_KEY, JSON.stringify(s)) }
function clearState() { localStorage.removeItem(STATE_KEY) }

// ── Step definitions ─────────────────────────────────────────────────────────

interface TourStep {
  icon: React.ElementType
  title: string
  body: string
  tip?: string
  path: string
  selector?: string    // CSS selector for spotlight target
  iconColor: string
}

const ADMIN_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen bei OKUN Workforce',
    body: 'Diese Tour führt dich durch alle wichtigen Bereiche. Du kannst sie jederzeit minimieren und sie läuft genau dort weiter, wo du aufgehört hast — auch nach einem Seitenneuladen.',
    tip: 'Die Tour bleibt aktiv, auch wenn du Funktionen ausprobierst oder Seiten wechselst.',
    path: '/admin',
    iconColor: 'text-violet-500',
  },
  {
    icon: MessageCircle,
    title: 'Schritt 1: KI-Onboarding',
    body: 'Richte deinen Standort ein — Schichten, Gruppen, Regeln und Arbeitszeiten. Erzähl der KI einfach, wie euer Standort funktioniert. Je mehr Angaben, desto besser plant die KI.',
    tip: 'Das Onboarding ist die Basis für alle automatischen Funktionen.',
    path: '/admin/onboarding',
    selector: 'a[href="/admin/onboarding"]',
    iconColor: 'text-indigo-500',
  },
  {
    icon: Users,
    title: 'Schritt 2: Mitarbeiter',
    body: 'Lege Mitarbeiter per KI-Dialog oder klassischem Formular an. Die KI erkennt Qualifikationen, Besonderheiten und Arbeitsmodelle automatisch.',
    tip: 'Bestehende Mitarbeiter kannst du jederzeit per KI-Chat bearbeiten.',
    path: '/admin/employees',
    selector: 'a[href="/admin/employees"]',
    iconColor: 'text-teal-600',
  },
  {
    icon: Calendar,
    title: 'Schritt 3: Dienstplan',
    body: 'Die KI erstellt auf Basis deiner Onboarding-Daten automatisch einen optimierten Dienstplan. Anschließend kannst du ihn per Chat-Dialog verfeinern oder manuell anpassen.',
    tip: 'Klicke auf „KI-Planung starten" und beschreibe besondere Ereignisse oder Wünsche.',
    path: '/admin/schedule',
    selector: 'a[href="/admin/schedule"]',
    iconColor: 'text-teal-600',
  },
  {
    icon: CalendarDays,
    title: 'Schritt 4: Kalender',
    body: 'Der Kalender zeigt alle Dienste als Monats- oder Wochenansicht. Du siehst auf einen Blick, wer wann arbeitet, und kannst Tage für eine Detailansicht auswählen.',
    path: '/admin/calendar',
    selector: 'a[href="/admin/calendar"]',
    iconColor: 'text-blue-500',
  },
  {
    icon: Clock,
    title: 'Schritt 5: Zeiterfassung',
    body: 'Hier siehst du alle Überstundenanträge, Abwesenheiten und Monatsabschlüsse. Du kannst Einträge korrigieren, Überstunden genehmigen und Monate freigeben.',
    tip: 'Der Monatsabschluss erzeugt rechtssichere Nachweise, die du als PDF drucken kannst.',
    path: '/admin/time-tracking',
    selector: 'a[href="/admin/time-tracking"]',
    iconColor: 'text-orange-500',
  },
  {
    icon: Euro,
    title: 'Schritt 6: Zuschlags-Engine',
    body: 'Berechne automatisch Nacht-, Sonntags-, Feiertags- und Samstagszuschläge für alle Mitarbeiter. Konfiguriere Regeln oder nutze die gesetzlichen Vorgaben.',
    tip: 'Der DATEV-Export im CSV-Format kann direkt in deine Lohnbuchhaltungssoftware importiert werden.',
    path: '/admin/surcharges',
    selector: 'a[href="/admin/surcharges"]',
    iconColor: 'text-emerald-500',
  },
  {
    icon: Euro,
    title: 'Schritt 7: Lohnabrechnung',
    body: 'Erstelle vollständige Lohnabrechnungen für alle Mitarbeiter — mit Lohnsteuer, Sozialversicherungsbeiträgen und Zuschlägen. Alle Berechnungen erfolgen nach deutschem Recht.',
    tip: 'Der DATEV-Export kann direkt in deine Buchhaltungssoftware importiert werden.',
    path: '/admin/payroll',
    selector: 'a[href="/admin/payroll"]',
    iconColor: 'text-emerald-600',
  },
  {
    icon: Palmtree,
    title: 'Schritt 8: Urlaubsanträge',
    body: 'Genehmige oder lehne Urlaubsanträge deiner Mitarbeiter ab. Die KI gibt dir eine Empfehlung basierend auf Besetzung, Fairness und persönlichen Faktoren.',
    tip: 'Mitarbeiter sehen ihre Anträge und den Status in Echtzeit in der Mitarbeiter-App.',
    path: '/admin/vacation-requests',
    selector: 'a[href="/admin/vacation-requests"]',
    iconColor: 'text-green-500',
  },
  {
    icon: Brain,
    title: 'Schritt 9: KI-Controlling',
    body: 'Das Controlling-Dashboard zeigt Personalrisiken, Fairness-Scores, Überstunden-Trends und gibt proaktive Handlungsempfehlungen — bevor Probleme entstehen.',
    tip: 'Die Frühwarnfunktion informiert dich automatisch bei kritischen Situationen.',
    path: '/admin/controlling',
    selector: 'a[href="/admin/controlling"]',
    iconColor: 'text-rose-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Tour abgeschlossen!',
    body: 'Du kennst jetzt alle wichtigen Funktionen. Dein Dashboard zeigt immer aktuelle Warnungen, offene Anträge und anstehende Aufgaben.',
    tip: 'Du kannst diese Tour jederzeit erneut starten über Einstellungen → Produkttour.',
    path: '/admin',
    iconColor: 'text-teal-600',
  },
]

const EMPLOYEE_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen bei OKUN Workforce',
    body: 'Diese Tour zeigt dir alle wichtigen Bereiche auf einen Blick. Du kannst sie jederzeit minimieren und später fortsetzen.',
    path: '/employee',
    iconColor: 'text-violet-500',
  },
  {
    icon: Calendar,
    title: 'Schritt 1: Dein Dienstplan',
    body: 'Sieh deinen Dienstplan für die aktuelle Woche. Wechsle zwischen Tages-, Wochen- und Monatsansicht. Im Tab „Wunschdienste" kannst du Wünsche einreichen.',
    path: '/employee/schedule',
    selector: 'a[href="/employee/schedule"]',
    iconColor: 'text-teal-600',
  },
  {
    icon: Clock,
    title: 'Schritt 2: Zeiterfassung',
    body: 'Starte und stoppe deine Arbeitszeit per Knopfdruck. Du siehst dein Stundenkonto immer aktuell — inklusive Überstunden und Minusstunden.',
    tip: 'Denk daran, auch Pausen zu erfassen. Das ist wichtig für deinen Monatsnachweis.',
    path: '/employee/time-tracking',
    selector: 'a[href="/employee/time-tracking"]',
    iconColor: 'text-blue-500',
  },
  {
    icon: Palmtree,
    title: 'Schritt 3: Urlaub beantragen',
    body: 'Beantrage Urlaub direkt in der App. Du siehst sofort, wer gleichzeitig Urlaub hat und wie viele Urlaubstage dir noch zustehen.',
    tip: 'Du erhältst eine Benachrichtigung, sobald dein Antrag genehmigt oder abgelehnt wurde.',
    path: '/employee/vacation',
    selector: 'a[href="/employee/vacation"]',
    iconColor: 'text-emerald-500',
  },
  {
    icon: UserPlus,
    title: 'Schritt 4: Vertretungen',
    body: 'Suche Vertretungen für deine Schichten oder biete dich als Vertretung an. Das System schlägt automatisch passende Kollegen vor.',
    path: '/employee/substitutions',
    selector: 'a[href="/employee/substitutions"]',
    iconColor: 'text-amber-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Tour abgeschlossen!',
    body: 'Du bist startklar! Dein Dashboard zeigt immer deine nächsten Schichten, offene Anträge und aktuelle Benachrichtigungen.',
    tip: 'Du kannst diese Tour jederzeit erneut starten.',
    path: '/employee',
    iconColor: 'text-teal-600',
  },
]

const COMPANY_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen bei OKUN Workforce',
    body: 'Als Geschäftsführung hast du einen Überblick über alle Standorte. Diese Tour zeigt dir die wichtigsten Funktionen auf Unternehmensebene.',
    path: '/company',
    iconColor: 'text-violet-500',
  },
  {
    icon: MessageCircle,
    title: 'Schritt 1: Unternehmens-Onboarding',
    body: 'Richte dein Unternehmen ein: Name, Standorte, Rollenmodell und unternehmensweite Regeln — alles per KI-Dialog. Das Rollenmodell gilt für alle Standorte.',
    tip: 'Nach dem Unternehmens-Onboarding richtet jede Standortleitung ihren Standort separat ein.',
    path: '/company/onboarding',
    selector: 'a[href="/company/onboarding"]',
    iconColor: 'text-indigo-500',
  },
  {
    icon: MapPin,
    title: 'Schritt 2: Standorte',
    body: 'Verwalte alle Standorte deines Unternehmens. Für jeden Standort führt die Standortleitung ihr eigenes KI-Onboarding durch.',
    path: '/company/locations',
    selector: 'a[href="/company/locations"]',
    iconColor: 'text-blue-500',
  },
  {
    icon: Calendar,
    title: 'Schritt 3: Standortübergreifende Dienstpläne',
    body: 'Sieh alle Dienstpläne aller Standorte auf einen Blick — inklusive Unterbesetzungswarnung und Mitarbeiter ohne Einteilung.',
    path: '/company/schedule',
    selector: 'a[href="/company/schedule"]',
    iconColor: 'text-teal-600',
  },
  {
    icon: BarChart3,
    title: 'Schritt 4: Workforce Insights',
    body: 'Analysiere Personalkosten, Überstunden-Trends, Krankheitsquoten und Besetzungsqualität über alle Standorte hinweg.',
    path: '/company/workforce-insights',
    selector: 'a[href="/company/workforce-insights"]',
    iconColor: 'text-rose-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Tour abgeschlossen!',
    body: 'Dein Unternehmens-Dashboard zeigt dir immer die wichtigsten Kennzahlen und standortübergreifende Warnungen. Viel Erfolg!',
    tip: 'Du kannst diese Tour jederzeit erneut starten.',
    path: '/company',
    iconColor: 'text-teal-600',
  },
]

const OKUN_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen im OKUN Adminbereich',
    body: 'Als OKUN-Administrator hast du Zugriff auf alle Mandanten und Plattformfunktionen. Diese Tour zeigt dir die wichtigsten Bereiche.',
    path: '/okun',
    iconColor: 'text-violet-500',
  },
  {
    icon: Users,
    title: 'Schritt 1: Kunden & Organisationen',
    body: 'Verwalte alle Unternehmen auf der Plattform: Mandanten anlegen, Lizenzen zuweisen, Zugänge reparieren und Konten konfigurieren.',
    path: '/okun/customers',
    selector: 'a[href="/okun/customers"]',
    iconColor: 'text-teal-600',
  },
  {
    icon: Bug,
    title: 'Schritt 2: Bug-Management',
    body: 'Bearbeite Fehlerberichte von Nutzern. Jeder Bericht enthält technische Details, Seiteninformationen und Konsolenfehler für eine schnelle Diagnose.',
    path: '/okun/bugs',
    selector: 'a[href="/okun/bugs"]',
    iconColor: 'text-rose-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Tour abgeschlossen!',
    body: 'Du kennst jetzt alle wichtigen Plattformfunktionen. Viel Erfolg bei der Verwaltung!',
    path: '/okun',
    iconColor: 'text-teal-600',
  },
]

function getSteps(role: Role): TourStep[] {
  if (role === 'admin') return ADMIN_STEPS
  if (role === 'employee') return EMPLOYEE_STEPS
  if (role === 'company') return COMPANY_STEPS
  if (role === 'okun') return OKUN_STEPS
  return []
}

// ── Spotlight overlay ─────────────────────────────────────────────────────────

function Spotlight({ rect }: { rect: DOMRect }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: 10,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
        pointerEvents: 'none',
        zIndex: 9998,
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        outline: '2px solid rgba(45,212,191,0.8)',
      }}
    />
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function SystemTour({ role }: { role: Role }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setStateLocal] = useState<TourState | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const prevPathnameRef = useRef<string | null>(null)

  const steps = getSteps(role)

  // Load from localStorage on mount
  useEffect(() => {
    const done = localStorage.getItem(DONE_KEY(role))
    if (done) return
    const saved = loadState()
    if (saved && saved.role === role && saved.active) {
      setStateLocal(saved)
    } else if (!saved || saved.role !== role) {
      const initial: TourState = { role, step: 0, active: true }
      saveState(initial)
      setStateLocal(initial)
    }
  }, [role])

  // URL-following: auto-advance when user navigates to a later step's path
  useEffect(() => {
    if (!state?.active) return
    if (prevPathnameRef.current === pathname) return
    prevPathnameRef.current = pathname

    // Search for matching step ahead of current
    for (let i = state.step + 1; i < steps.length; i++) {
      if (steps[i].path === pathname) {
        const next: TourState = { ...state, step: i }
        saveState(next)
        setStateLocal(next)
        break
      }
    }
  }, [pathname, state, steps])

  // Update spotlight when step or pathname changes
  useEffect(() => {
    if (!state?.active) { setSpotlightRect(null); return }
    const current = steps[state.step]
    if (!current?.selector) { setSpotlightRect(null); return }

    const find = () => {
      const el = document.querySelector(current.selector!)
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) setSpotlightRect(r)
      } else {
        setSpotlightRect(null)
      }
    }

    setSpotlightRect(null)
    find()
    const t1 = setTimeout(find, 300)
    const t2 = setTimeout(find, 800)
    const t3 = setTimeout(find, 1800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [state?.step, pathname, steps, state?.active])

  const updateState = useCallback((s: TourState) => {
    saveState(s)
    setStateLocal(s)
  }, [])

  function dismiss() {
    localStorage.setItem(DONE_KEY(role), '1')
    clearState()
    setStateLocal(null)
    setSpotlightRect(null)
  }

  function next() {
    if (!state) return
    const nextStep = state.step + 1
    if (nextStep >= steps.length) { dismiss(); return }
    const ns: TourState = { ...state, step: nextStep }
    updateState(ns)
    const target = steps[nextStep].path
    if (target && pathname !== target) router.push(target)
  }

  function prev() {
    if (!state || state.step === 0) return
    const ns: TourState = { ...state, step: state.step - 1 }
    updateState(ns)
    const target = steps[ns.step].path
    if (target && pathname !== target) router.push(target)
  }

  function restart() {
    localStorage.removeItem(DONE_KEY(role))
    const initial: TourState = { role, step: 0, active: true }
    saveState(initial)
    setStateLocal(initial)
    setMinimized(false)
    const target = steps[0].path
    if (target && pathname !== target) router.push(target)
  }

  function goTo(i: number) {
    if (!state) return
    const ns: TourState = { ...state, step: i }
    updateState(ns)
    const target = steps[i].path
    if (target && pathname !== target) router.push(target)
  }

  if (!state?.active || steps.length === 0) return null

  const current = steps[state.step]
  if (!current) return null

  const isLast = state.step === steps.length - 1
  const isFirst = state.step === 0
  const Icon = current.icon
  const progress = ((state.step + 1) / steps.length) * 100

  // Position panel: next to spotlight or bottom-right
  const panelStyle: React.CSSProperties = (() => {
    if (spotlightRect) {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800
      const panelW = 296
      const rightSpace = vw - spotlightRect.right
      const leftSpace = spotlightRect.left

      if (rightSpace >= panelW + 24) {
        return {
          position: 'fixed',
          top: Math.max(8, Math.min(spotlightRect.top, vh - 340)),
          left: spotlightRect.right + 16,
          width: panelW,
          zIndex: 9999,
        }
      } else if (leftSpace >= panelW + 24) {
        return {
          position: 'fixed',
          top: Math.max(8, Math.min(spotlightRect.top, vh - 340)),
          right: vw - spotlightRect.left + 16,
          width: panelW,
          zIndex: 9999,
        }
      } else {
        // fallback: above or below
        const above = spotlightRect.top > vh / 2
        return {
          position: 'fixed',
          [above ? 'bottom' : 'top']: above
            ? vh - spotlightRect.top + 12
            : spotlightRect.bottom + 12,
          left: Math.max(8, Math.min(spotlightRect.left, vw - panelW - 8)),
          width: panelW,
          zIndex: 9999,
        }
      }
    }
    return { position: 'fixed', bottom: '5.5rem', right: '1rem', width: 296, zIndex: 9999 }
  })()

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-20 z-[9999] flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-2xl px-3 py-2 text-sm font-medium text-navy hover:shadow-xl transition-all"
      >
        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
        Tour läuft ({state.step + 1}/{steps.length})
      </button>
    )
  }

  return (
    <>
      {/* Spotlight overlay */}
      {spotlightRect && <Spotlight rect={spotlightRect} />}

      {/* Tour panel */}
      <div style={panelStyle}>
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-gray-100">
            <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Header */}
          <div className="px-4 pt-3.5 pb-2 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 shrink-0 ${current.iconColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 font-medium">{state.step + 1} / {steps.length}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMinimized(true)}
                    className="text-gray-400 hover:text-gray-600 px-1 rounded transition-colors text-sm leading-none"
                    title="Minimieren"
                  >−</button>
                  <button
                    onClick={restart}
                    className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                    title="Tour neu starten"
                  ><RefreshCw className="w-3 h-3" /></button>
                  <button
                    onClick={dismiss}
                    className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                    title="Tour beenden"
                  ><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1.5">{current.title}</h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">{current.body}</p>
            {current.tip && (
              <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 mb-3">
                <p className="text-xs text-teal-700 leading-relaxed">💡 {current.tip}</p>
              </div>
            )}

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1 mb-3 flex-wrap">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all ${
                    i === state.step
                      ? 'w-4 h-2 bg-teal-600'
                      : 'w-2 h-2 ' + (i < state.step ? 'bg-teal-300' : 'bg-gray-200')
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Zurück
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-semibold"
              >
                {isLast
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Abgeschlossen!</>
                  : <>Weiter <ArrowRight className="w-3.5 h-3.5" /></>
                }
              </button>
            </div>
            {!isLast && (
              <button
                onClick={dismiss}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-2 py-0.5"
              >
                Tour beenden
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Restart hook (called from settings pages) ─────────────────────────────────

export function restartTour(role: Role) {
  localStorage.removeItem(DONE_KEY(role))
  localStorage.removeItem(STATE_KEY)
}
