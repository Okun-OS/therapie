'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { X, ArrowRight, ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react'
import type { Role } from '@/lib/types'

// ── Persistence ──────────────────────────────────────────────────────────────

const STATE_KEY = 'okun_tour_v5'
const DONE_KEY = (role: Role) => `okun_tour_done_v5:${role}`

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
  emoji: string
  title: string
  body: string
  tip?: string
  path: string
  // Optional CSS selector for a dock slot to spotlight
  spotlightSelector?: string
}

// ── Admin steps ───────────────────────────────────────────────────────────────

const ADMIN_STEPS: TourStep[] = [
  {
    emoji: '✨',
    title: 'Willkommen bei OKUN Workforce',
    body: 'Diese Tour erklärt die neue Navigation. Du kannst sie jederzeit minimieren — sie läuft nach Seitenwechseln genau dort weiter, wo du aufgehört hast.',
    path: '/admin',
  },
  {
    emoji: '🧭',
    title: 'Das Floating Dock',
    body: 'Deine gesamte Navigation befindet sich im Dock am unteren Bildschirmrand. Tippe auf ein Symbol, um direkt dorthin zu gelangen — oder öffne ein Mega-Panel mit weiteren Unterseiten.',
    tip: 'Auf dem Desktop reagieren die Icons magnetisch auf deine Mausbewegung.',
    path: '/admin',
    spotlightSelector: '[data-tour="dock-bar"]',
  },
  {
    emoji: '📋',
    title: 'Mega-Panels',
    body: 'Symbole mit Unterseiten öffnen ein Mega-Panel — ein dunkles Menü mit allen Bereichen. Tippe nochmal auf dasselbe Symbol, um es zu schließen.',
    tip: 'Im Mega-Panel siehst du alle Seiten eines Bereichs auf einen Blick.',
    path: '/admin',
    spotlightSelector: '[data-tour="dock-bar"]',
  },
  {
    emoji: '🔍',
    title: 'Globale Suche (⌘K)',
    body: 'Das Suchsymbol im Dock öffnet die globale Suche. Finde Mitarbeiter, Seiten und Funktionen blitzschnell — per Tastatur (⌘K / Strg+K) oder durch Tippen.',
    tip: 'Die Suche zeigt kontextuelle Ergebnisse passend zu deiner Rolle.',
    path: '/admin',
    spotlightSelector: '[data-dock-slot="search"]',
  },
  {
    emoji: '🏠',
    title: 'Dashboard: Dein Überblick',
    body: 'Das Dashboard zeigt offene Urlaubsanträge, aktuelle Warnungen und anstehende Aufgaben. Hier startest du deinen Arbeitstag.',
    path: '/admin',
  },
  {
    emoji: '👥',
    title: 'Mitarbeiter verwalten',
    body: 'Lege Mitarbeiter per KI-Dialog oder klassischem Formular an. Qualifikationen, Arbeitsmodell und Besonderheiten werden direkt erfasst.',
    path: '/admin/employees',
  },
  {
    emoji: '📅',
    title: 'Dienstplanung',
    body: 'Die KI erstellt automatisch einen optimierten Dienstplan auf Basis deiner Standort-Einstellungen. Verfeinere ihn per Chat oder passe Schichten manuell an.',
    tip: 'Klicke auf „KI-Planung starten" und beschreibe besondere Ereignisse.',
    path: '/admin/schedule',
  },
  {
    emoji: '⏱️',
    title: 'Zeiterfassung',
    body: 'Genehmige Überstunden, prüfe Abwesenheiten und führe Monatsabschlüsse durch. Alle Einträge sind rechtssicher dokumentiert.',
    path: '/admin/time-tracking',
  },
  {
    emoji: '🤖',
    title: 'OKUN Assistent',
    body: 'Der KI-Assistent beantwortet Fragen, hilft bei Entscheidungen und analysiert deine Daten in Echtzeit — direkt im Chat.',
    tip: 'Probiere: „Wer hat nächste Woche Urlaub?" oder „Zeig mir Überstunden im Juli".',
    path: '/admin/assistant',
    spotlightSelector: '[data-dock-slot="assistent"]',
  },
  {
    emoji: '🎉',
    title: 'Tour abgeschlossen!',
    body: 'Du kennst jetzt die neue Navigation. Dein Dashboard warnt dich proaktiv bei kritischen Situationen. Viel Erfolg!',
    tip: 'Die Tour lässt sich unter Einstellungen → Produkttour jederzeit neu starten.',
    path: '/admin',
  },
]

// ── Employee steps ────────────────────────────────────────────────────────────

const EMPLOYEE_STEPS: TourStep[] = [
  {
    emoji: '✨',
    title: 'Willkommen bei OKUN Workforce',
    body: 'Diese Tour zeigt dir alle wichtigen Bereiche. Du kannst sie jederzeit minimieren und später fortsetzen — auch nach einem Seitenwechsel.',
    path: '/employee',
  },
  {
    emoji: '🧭',
    title: 'Das Floating Dock',
    body: 'Deine Navigation befindet sich im Dock am unteren Bildschirmrand. Tippe auf ein Symbol für die jeweilige Seite. Symbole mit Pfeil öffnen ein Untermenü (Mega-Panel).',
    path: '/employee',
    spotlightSelector: '[data-tour="dock-bar"]',
  },
  {
    emoji: '🔍',
    title: 'Globale Suche',
    body: 'Das Suchsymbol im Dock öffnet die Schnellsuche. Navigiere blitzschnell zu jeder Seite — auch per ⌘K / Strg+K auf der Tastatur.',
    path: '/employee',
    spotlightSelector: '[data-dock-slot="search"]',
  },
  {
    emoji: '📅',
    title: 'Dein Dienstplan',
    body: 'Sieh deinen Dienstplan für die aktuelle Woche. Wechsle zwischen Tages-, Wochen- und Monatsansicht. Im Tab „Wunschdienste" kannst du Wünsche einreichen.',
    path: '/employee/schedule',
  },
  {
    emoji: '⏱️',
    title: 'Zeiterfassung',
    body: 'Starte und stoppe deine Arbeitszeit per Knopfdruck. Du siehst dein Stundenkonto immer aktuell — inklusive Überstunden und Minusstunden.',
    tip: 'Denk daran, auch Pausen zu erfassen. Das ist wichtig für deinen Monatsnachweis.',
    path: '/employee/time-tracking',
  },
  {
    emoji: '🌴',
    title: 'Urlaub beantragen',
    body: 'Beantrage Urlaub direkt in der App. Du siehst sofort, wer gleichzeitig Urlaub hat und wie viele Urlaubstage dir noch zustehen.',
    tip: 'Du erhältst eine Benachrichtigung, sobald dein Antrag genehmigt oder abgelehnt wurde.',
    path: '/employee/vacation',
  },
  {
    emoji: '🎉',
    title: 'Tour abgeschlossen!',
    body: 'Du bist startklar! Dein Dashboard zeigt immer deine nächsten Schichten, offene Anträge und aktuelle Benachrichtigungen.',
    path: '/employee',
  },
]

// ── Company steps ─────────────────────────────────────────────────────────────

const COMPANY_STEPS: TourStep[] = [
  {
    emoji: '✨',
    title: 'Willkommen bei OKUN Workforce',
    body: 'Als Geschäftsführung hast du einen Überblick über alle Standorte. Diese Tour zeigt dir die wichtigsten Funktionen auf Unternehmensebene.',
    path: '/company',
  },
  {
    emoji: '🧭',
    title: 'Das Floating Dock',
    body: 'Deine Navigation befindet sich im Dock am unteren Bildschirmrand. Symbole mit Pfeil öffnen ein Mega-Panel mit allen Unterseiten des jeweiligen Bereichs.',
    path: '/company',
    spotlightSelector: '[data-tour="dock-bar"]',
  },
  {
    emoji: '🔍',
    title: 'Globale Suche',
    body: 'Das Suchsymbol öffnet die standortübergreifende Suche. Finde Mitarbeiter, Standorte und Berichte in Sekundenschnelle.',
    path: '/company',
    spotlightSelector: '[data-dock-slot="search"]',
  },
  {
    emoji: '💬',
    title: 'Unternehmens-Onboarding',
    body: 'Richte dein Unternehmen ein: Name, Standorte, Rollenmodell und unternehmensweite Regeln — alles per KI-Dialog. Das Rollenmodell gilt für alle Standorte.',
    tip: 'Nach dem Unternehmens-Onboarding richtet jede Standortleitung ihren Standort separat ein.',
    path: '/company/onboarding',
  },
  {
    emoji: '📍',
    title: 'Standorte',
    body: 'Verwalte alle Standorte deines Unternehmens. Für jeden Standort führt die Standortleitung ihr eigenes KI-Onboarding durch.',
    path: '/company/locations',
  },
  {
    emoji: '📊',
    title: 'Workforce Insights',
    body: 'Analysiere Personalkosten, Überstunden-Trends, Krankheitsquoten und Besetzungsqualität über alle Standorte hinweg.',
    path: '/company/workforce-insights',
  },
  {
    emoji: '🎉',
    title: 'Tour abgeschlossen!',
    body: 'Dein Dashboard zeigt immer die wichtigsten Kennzahlen und standortübergreifende Warnungen. Viel Erfolg!',
    tip: 'Die Tour lässt sich unter Einstellungen → Produkttour jederzeit neu starten.',
    path: '/company',
  },
]

// ── OKUN steps ────────────────────────────────────────────────────────────────

const OKUN_STEPS: TourStep[] = [
  {
    emoji: '✨',
    title: 'Willkommen im OKUN Adminbereich',
    body: 'Als OKUN-Administrator hast du Zugriff auf alle Mandanten und Plattformfunktionen. Diese Tour zeigt dir die wichtigsten Bereiche.',
    path: '/okun',
  },
  {
    emoji: '🧭',
    title: 'Das Floating Dock',
    body: 'Die Navigation erfolgt über das Dock am unteren Bildschirmrand. Tippe auf ein Symbol für eine Direktseite oder öffne ein Mega-Panel für Unterseiten.',
    path: '/okun',
    spotlightSelector: '[data-tour="dock-bar"]',
  },
  {
    emoji: '🏢',
    title: 'Kunden & Organisationen',
    body: 'Verwalte alle Unternehmen auf der Plattform: Mandanten anlegen, Lizenzen zuweisen, Zugänge reparieren und Konten konfigurieren.',
    path: '/okun/customers',
  },
  {
    emoji: '🐛',
    title: 'Bug-Management',
    body: 'Bearbeite Fehlerberichte von Nutzern. Jeder Bericht enthält technische Details, Seiteninformationen und Konsolenfehler für eine schnelle Diagnose.',
    path: '/okun/bugs',
  },
  {
    emoji: '🎉',
    title: 'Tour abgeschlossen!',
    body: 'Du kennst jetzt alle wichtigen Plattformfunktionen. Viel Erfolg bei der Verwaltung!',
    path: '/okun',
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
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        borderRadius: 20,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 9998,
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        border: '2px solid rgba(38,198,198,0.7)',
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
  const prevPathname = useRef<string | null>(null)
  useEffect(() => {
    if (!state?.active) return
    if (prevPathname.current === pathname) return
    prevPathname.current = pathname

    for (let i = state.step + 1; i < steps.length; i++) {
      if (steps[i].path === pathname) {
        const next: TourState = { ...state, step: i }
        saveState(next)
        setStateLocal(next)
        break
      }
    }
  }, [pathname, state, steps])

  // Update spotlight rect
  useEffect(() => {
    if (!state?.active) { setSpotlightRect(null); return }
    const current = steps[state.step]
    if (!current?.spotlightSelector) { setSpotlightRect(null); return }

    const find = () => {
      const el = document.querySelector<HTMLElement>(current.spotlightSelector!)
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
    return () => { clearTimeout(t1); clearTimeout(t2) }
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
  const progress = ((state.step + 1) / steps.length) * 100

  // Panel is always anchored above the dock, centered
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 'max(112px, calc(96px + env(safe-area-inset-bottom, 0px)))',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(92vw, 320px)',
    zIndex: 9999,
    animation: 'modal-in 0.3s cubic-bezier(.34,1.4,.64,1) both',
  }

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 'max(112px, calc(96px + env(safe-area-inset-bottom, 0px)))',
          right: '1rem',
          zIndex: 9999,
        }}
        className="flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-2xl px-3 py-2 text-sm font-medium text-navy hover:shadow-xl transition-all"
      >
        <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
        Tour ({state.step + 1}/{steps.length})
      </button>
    )
  }

  return (
    <>
      {spotlightRect && <Spotlight rect={spotlightRect} />}

      <div style={panelStyle}>
        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: 'rgba(20,23,25,0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(38,198,198,0.25)',
          }}
        >
          {/* Progress bar */}
          <div className="h-0.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#26C6C6,#0E9F9F)' }}
            />
          </div>

          {/* Header */}
          <div className="px-4 pt-3.5 pb-0 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl leading-none flex-shrink-0">{current.emoji}</span>
              <span className="text-white/40 text-[11px] font-semibold tabular-nums">
                {state.step + 1}&thinsp;/&thinsp;{steps.length}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setMinimized(true)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-white/35 hover:text-white/70 hover:bg-white/10 transition-colors text-lg leading-none"
                title="Minimieren"
              >−</button>
              <button
                onClick={restart}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-white/35 hover:text-white/70 hover:bg-white/10 transition-colors"
                title="Neu starten"
              ><RefreshCw className="w-3 h-3" /></button>
              <button
                onClick={dismiss}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-white/35 hover:text-white/70 hover:bg-white/10 transition-colors"
                title="Tour beenden"
              ><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4 pt-2.5">
            <h3 className="text-sm font-bold text-white/95 mb-1.5">{current.title}</h3>
            <p className="text-xs text-white/55 leading-relaxed mb-2">{current.body}</p>
            {current.tip && (
              <div
                className="rounded-xl px-3 py-2 mb-3"
                style={{ background: 'rgba(38,198,198,0.1)', border: '1px solid rgba(38,198,198,0.2)' }}
              >
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(38,198,198,0.9)' }}>
                  💡 {current.tip}
                </p>
              </div>
            )}

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1 mb-3 flex-wrap">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === state.step ? 16 : 6,
                    height: 6,
                    background: i === state.step
                      ? '#26C6C6'
                      : i < state.step
                      ? 'rgba(38,198,198,0.4)'
                      : 'rgba(255,255,255,0.15)',
                  }}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <ArrowLeft className="w-3 h-3" /> Zurück
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-xl font-semibold transition-all"
                style={{ background: isLast ? 'rgba(38,198,198,0.2)' : '#26C6C6', color: isLast ? '#26C6C6' : '#1A1D1F', border: isLast ? '1px solid rgba(38,198,198,0.4)' : 'none' }}
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
                className="w-full text-center text-[11px] mt-2 py-0.5 transition-colors"
                style={{ color: 'rgba(255,255,255,0.25)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
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

