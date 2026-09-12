'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { X, ArrowRight, ArrowLeft, CheckCircle, RefreshCw, Zap } from 'lucide-react'
import type { Role } from '@/lib/types'

// ── Persistence ──────────────────────────────────────────────────────────────

const STATE_KEY = 'okun_tour_v6'
const DONE_KEY = (role: Role) => `okun_tour_done_v6:${role}`

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

// ── CSS keyframes injected once ───────────────────────────────────────────────

const TOUR_KEYFRAMES = `
  @keyframes tour-beacon {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    60% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes tour-card-in {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }
  @keyframes tour-welcome-in {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
`

// ── Step definitions ─────────────────────────────────────────────────────────

interface QuickAction {
  label: string
  path: string
}

interface TourStep {
  emoji: string
  title: string
  body: string
  tip?: string
  path: string
  spotlightSelector?: string
  isWelcome?: boolean
  tryCta?: string
  tryPath?: string
  quickActions?: QuickAction[]
}

// ── Confetti Canvas ───────────────────────────────────────────────────────────

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = (canvas.width = window.innerWidth)
    const H = (canvas.height = window.innerHeight)
    const COLORS = ['#26C6C6', '#0E9F9F', '#FFD700', '#FF6B6B', '#78DFE5', '#A8E6CF', '#FFA500', '#C5A3FF']

    type Piece = {
      x: number; y: number; vx: number; vy: number
      angle: number; va: number; w: number; h: number; color: string
    }

    const pieces: Piece[] = Array.from({ length: 130 }, () => ({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.35,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      angle: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.16,
      w: Math.random() * 10 + 4,
      h: Math.random() * 5 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))

    let frame: number
    const startTime = performance.now()

    function draw(now: number) {
      const elapsed = now - startTime
      if (elapsed > 3800) { ctx!.clearRect(0, 0, W, H); return }
      ctx!.clearRect(0, 0, W, H)
      ctx!.globalAlpha = elapsed > 2800 ? Math.max(0, 1 - (elapsed - 2800) / 1000) : 1
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.angle += p.va
        ctx!.save()
        ctx!.translate(p.x, p.y); ctx!.rotate(p.angle)
        ctx!.fillStyle = p.color
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx!.restore()
      })
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 99990 }}
    />
  )
}

// ── Spotlight ─────────────────────────────────────────────────────────────────

function Spotlight({ rect, beacon }: { rect: DOMRect; beacon?: boolean }) {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: rect.top - 8, left: rect.left - 8,
          width: rect.width + 16, height: rect.height + 16,
          borderRadius: 20,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.52), 0 0 0 4px rgba(0,168,156,0.3)',
          border: '2px solid #00A89C',
          pointerEvents: 'none',
          zIndex: 9998,
          transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
      {beacon && (
        <div
          style={{
            position: 'fixed',
            top: rect.top + rect.height / 2 - 8,
            left: rect.left + rect.width / 2 - 8,
            width: 16, height: 16,
            borderRadius: '50%',
            background: '#00A89C',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'tour-beacon 1.5s ease-in-out infinite',
          }}
        />
      )}
    </>
  )
}

// ── Admin steps (8 steps, matching DOCX v2.0) ─────────────────────────────────

const ADMIN_STEPS: TourStep[] = [
  {
    emoji: '✨',
    title: 'Herzlich willkommen!',
    body: 'Du verwaltest jetzt deinen Standort digital – Dienstplanung, Zeiterfassung und KI-Analyse an einem Ort.\n\nIn den nächsten 5 Minuten richten wir gemeinsam alles ein.',
    path: '/admin',
    isWelcome: true,
  },
  {
    emoji: '🏠',
    title: 'Dein Dashboard',
    body: 'Dein täglicher Überblick.\n\nAktive Mitarbeitende, Anwesenheit heute, offene Urlaubsanträge, Wochenstunden – alles auf einen Blick, immer aktuell.',
    tip: 'Kritischer Schritt: Ohne Standort-Beschreibung kennt die KI deinen Standort nicht.',
    path: '/admin',
    spotlightSelector: '[data-tour="kpi-tiles"]',
  },
  {
    emoji: '⚙️',
    title: 'Standort der KI erklären',
    body: 'Das ist der wichtigste Schritt.\n\nBeschreibe deinen Standort: Wie viele Gruppen, welche Schichten, welche Regeln? Die KI liest das und plant automatisch danach.',
    path: '/admin/onboarding',
    spotlightSelector: '[data-tour="onboarding-main"]',
    tryCta: 'Beschreibung eingeben',
    tryPath: '/admin/onboarding',
  },
  {
    emoji: '👥',
    title: 'Team anlegen',
    body: 'Trage jetzt deine Mitarbeitenden ein.\n\nWochenstunden, Gruppe, Bereich – die KI braucht diese Daten für die Planung.',
    path: '/admin/employees',
    spotlightSelector: '[data-tour="add-employee"]',
    tryCta: 'Probier es aus: Mitarbeiter hinzufügen',
    tryPath: '/admin/employees',
  },
  {
    emoji: '🤖',
    title: 'Ersten KI-Dienstplan erstellen',
    body: 'Jetzt das Herzstück von OKUN.\n\nDie KI liest deine Standortbeschreibung + alle Mitarbeitenden und erstellt sofort einen vollständigen, fairen Wochenplan. Du kannst danach jeden Eintrag manuell anpassen.',
    path: '/admin/schedule',
    spotlightSelector: '[data-tour="create-plan"]',
    tryCta: 'Plan jetzt erstellen',
    tryPath: '/admin/schedule',
  },
  {
    emoji: '⚖️',
    title: 'Fairness Engine',
    body: 'OKUN plant nicht nur schnell – es plant fair.\n\nWer hatte schon Frühdienst? Wer viele Wochenenddienste? Die Engine gleicht das automatisch aus – und zeigt dir sofort wer einen Score-Alarm hat.',
    path: '/admin/auswertungen',
    spotlightSelector: '[data-tour="fairness-score"]',
  },
  {
    emoji: '💬',
    title: 'OKUN Assistent',
    body: 'Neu: Dein KI-Kollege mit Vollzugriff.\n\nStelle direkte Fragen oder gib Befehle – der Assistent handelt sofort im System.',
    tip: 'Demo-Frage ausprobieren: „Wer hat diese Woche die meisten Stunden?"',
    path: '/admin/assistant',
    spotlightSelector: '[data-dock-slot="assistent"]',
    tryCta: 'Demo-Frage abschicken',
    tryPath: '/admin/assistant',
  },
  {
    emoji: '🎉',
    title: 'Alles eingerichtet!',
    body: 'Du kennst jetzt alle wichtigen Funktionen. Dein Dashboard warnt dich proaktiv bei kritischen Situationen. Viel Erfolg!',
    path: '/admin',
    quickActions: [
      { label: 'Dienstplan öffnen', path: '/admin/schedule' },
      { label: 'Team anzeigen', path: '/admin/employees' },
      { label: 'Assistent fragen', path: '/admin/assistant' },
    ],
  },
]

// ── Employee steps (6 steps) ──────────────────────────────────────────────────

const EMPLOYEE_STEPS: TourStep[] = [
  {
    emoji: '✨',
    title: 'Herzlich willkommen!',
    body: 'OKUN hilft dir, deinen Arbeitsalltag einfach im Blick zu behalten:\ndeine Dienste, Stunden und deinen Urlaub.\n\nAlles in einer App – in unter 4 Minuten erklärt.',
    path: '/employee',
    isWelcome: true,
  },
  {
    emoji: '📅',
    title: 'Mein Tag – dein täglicher Start',
    body: 'Hier startest du jeden Tag.\n\nOben siehst du deinen heutigen Dienst. Der „Einstempeln"-Button startet deine Zeiterfassung – drück ihn wenn du anfängst, „Ausstempeln" wenn du gehst.\n\nDie vier Kacheln zeigen: Stundenkonto, geplante Stunden, Resturlaub und offene Anträge.',
    path: '/employee',
    spotlightSelector: '[data-tour="stamp-button"]',
  },
  {
    emoji: '📋',
    title: 'Mein Dienstplan',
    body: 'Hier siehst du alle deine Dienste.\n\nWechsle zwischen Tag-, Wochen- und Monatsansicht. Der heutige Tag ist immer hervorgehoben.\n\nJede Schicht zeigt: Uhrzeit, Diensttyp und Icons für Zeiterfassung, Details und Dienst-Tausch.',
    path: '/employee/schedule',
    spotlightSelector: '[data-tour="schedule-week"]',
  },
  {
    emoji: '🔄',
    title: 'Tauschbörse & Dienstwünsche',
    body: '🔄 Tauschbörse: Du kannst eine Schicht direkt mit Kolleg·innen tauschen – ganz ohne Leitungsumweg.\n\n💭 Wünsche: Trage ein, welche Dienste du nicht möchtest. Die KI berücksichtigt das bei der Planung.',
    path: '/employee/schedule',
    spotlightSelector: '[data-tour="schedule-tabs"]',
    tryCta: 'Probier es aus: Tausch starten',
    tryPath: '/employee/schedule',
  },
  {
    emoji: '🌴',
    title: 'Urlaub & Zeiterfassung',
    body: 'Urlaub: Sieh deinen Resturlaub und stelle Anträge direkt in der App. Der Status kommt in Echtzeit.\n\nZeiterfassung: Große Uhr mit Start/Stopp. Dein Stundenkonto wird automatisch geführt – du siehst Überstunden und Minusstunden sofort.',
    path: '/employee/vacation',
    spotlightSelector: '[data-tour="vacation-banner"]',
    tryCta: 'Antrag stellen testen',
    tryPath: '/employee/vacation',
  },
  {
    emoji: '🎉',
    title: 'Du kennst dich aus!',
    body: 'Du bist startklar! Dein Dashboard zeigt immer deine nächsten Schichten, offene Anträge und aktuelle Benachrichtigungen.',
    path: '/employee',
    quickActions: [
      { label: 'Einstempeln', path: '/employee' },
      { label: 'Dienstplan', path: '/employee/schedule' },
      { label: 'Urlaub beantragen', path: '/employee/vacation' },
    ],
  },
]

// ── Company steps (8 steps, Sie-form) ────────────────────────────────────────

const COMPANY_STEPS: TourStep[] = [
  {
    emoji: '✨',
    title: 'Herzlich willkommen!',
    body: 'Sie haben OKUN Workforce für Ihr gesamtes Unternehmen eingerichtet. Von hier aus behalten Sie alle Standorte, Mitarbeitenden und KI-Analysen im Blick.\n\nIn wenigen Minuten richten wir gemeinsam die wichtigsten Bereiche ein.',
    path: '/company',
    isWelcome: true,
  },
  {
    emoji: '🏢',
    title: 'Unternehmensübersicht',
    body: 'Ihr Unternehmens-Cockpit auf einen Blick.\n\nDie vier Kacheln zeigen: Mitarbeitende gesamt, aktive Standorte, offene Urlaubsanträge und erfasste Stunden aller Standorte.\n\nDas Diagramm vergleicht alle Standorte direkt miteinander – sehen Sie sofort wo Handlungsbedarf besteht.',
    path: '/company',
    spotlightSelector: '[data-tour="kpi-tiles"]',
  },
  {
    emoji: '📅',
    title: 'Dienstpläne & Vertretungen',
    body: 'Alle Standortpläne auf einen Blick.\n\nDie Übersicht zeigt pro Standort und Wochentag wie viele Schichten besetzt sind. „Vollständig besetzt" (grün) = kein Handlungsbedarf.\n\nVertretungen zeigt alle offenen Ausfälle – inklusive „Org.-eskaliert".',
    path: '/company/schedule',
    spotlightSelector: '[data-tour="schedule-overview"]',
  },
  {
    emoji: '🗓️',
    title: 'Jahresurlaubsplanung mit Schulferienkalender',
    body: 'Unternehmensweite Urlaubsplanung – endlich beherrschbar.\n\nOKUN integriert den Schulferienkalender automatisch. Sie sehen sofort welche Schulferien anstehen und ob bei Ihren Standorten Urlaubskonflikte drohen.',
    tip: 'Filtern Sie nach Standort oder betrachten Sie alle auf einmal.',
    path: '/company/vacation-plan',
    spotlightSelector: '[data-tour="vacation-plan"]',
  },
  {
    emoji: '💰',
    title: 'Finanzen: Lohnabrechnung & Zuschlags-Engine',
    body: 'Zwei neue Features – in Kürze verfügbar.\n\nLohnabrechnung: Gehaltsabrechnungen aller Standorte an einem Ort. Zuschlags-Engine: Automatische Berechnung von Zuschlägen, Prämien und Sonderzahlungen.\n\nSie sehen sie als Erste.',
    path: '/company/controlling',
    spotlightSelector: '[data-tour="finance-preview"]',
  },
  {
    emoji: '📊',
    title: 'KI-Controlling: Ihr Management-Cockpit',
    body: 'Das mächtigste Feature der Geschäftsführungs-Ebene.\n\nDer Lagebericht fasst die aktuelle Personalsituation zusammen: Auslastung, Krankenquote, Fairness-Score, Vertretungsquote, Dienstplanstabilität – 15 Kennzahlen auf einer Seite.',
    tip: 'Am Seitenende: eingebetteter KI-Assistent für direkte Fragen – jetzt eine Demo-Frage stellen.',
    path: '/company/controlling',
    spotlightSelector: '[data-tour="controlling-kpis"]',
    tryCta: 'Demo-Frage abschicken',
    tryPath: '/company/controlling',
  },
  {
    emoji: '🎉',
    title: 'Ihr Unternehmen ist startklar!',
    body: 'Sie kennen jetzt alle wichtigen Funktionen. Ihr Dashboard zeigt immer die wichtigsten Kennzahlen und standortübergreifende Warnungen. Viel Erfolg!',
    path: '/company',
    quickActions: [
      { label: 'KI-Controlling', path: '/company/controlling' },
      { label: 'Alle Dienstpläne', path: '/company/schedule' },
      { label: 'Einstellungen', path: '/company/settings' },
    ],
  },
]

// ── OKUN steps ────────────────────────────────────────────────────────────────

const OKUN_STEPS: TourStep[] = [
  {
    emoji: '✨',
    title: 'Willkommen im OKUN Adminbereich!',
    body: 'Als OKUN-Administrator hast du Zugriff auf alle Mandanten und Plattformfunktionen.\n\nDiese kurze Tour zeigt dir die wichtigsten Bereiche.',
    path: '/okun',
    isWelcome: true,
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
    quickActions: [
      { label: 'Kunden', path: '/okun/customers' },
      { label: 'Bug-Reports', path: '/okun/bugs' },
      { label: 'Support', path: '/okun/support' },
    ],
  },
]

function getSteps(role: Role): TourStep[] {
  if (role === 'admin') return ADMIN_STEPS
  if (role === 'employee') return EMPLOYEE_STEPS
  if (role === 'company') return COMPANY_STEPS
  if (role === 'okun') return OKUN_STEPS
  return []
}

// ── Component ────────────────────────────────────────────────────────────────

export function SystemTour({ role }: { role: Role }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setStateLocal] = useState<TourState | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

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

  // Confetti on welcome step and last step
  useEffect(() => {
    if (!state?.active) return
    const current = steps[state.step]
    if (current?.isWelcome || state.step === steps.length - 1) {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 4000)
      return () => clearTimeout(t)
    }
    setShowConfetti(false)
  }, [state?.step, state?.active, steps])

  const updateState = useCallback((s: TourState) => {
    saveState(s)
    setStateLocal(s)
  }, [])

  function dismiss() {
    localStorage.setItem(DONE_KEY(role), '1')
    clearState()
    setStateLocal(null)
    setSpotlightRect(null)
    setShowConfetti(false)
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

  function tryIt(tryPath: string) {
    if (pathname !== tryPath) router.push(tryPath)
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

  // ── Minimized pill ────────────────────────────────────────────────────────

  if (minimized) {
    return (
      <>
        <style>{TOUR_KEYFRAMES}</style>
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
      </>
    )
  }

  // ── Fullscreen welcome modal ──────────────────────────────────────────────

  if (current.isWelcome) {
    return (
      <>
        <style>{TOUR_KEYFRAMES}</style>
        {showConfetti && <ConfettiCanvas />}
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,12,0.88)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }} />
          {/* Ambient glow */}
          <div style={{
            position: 'absolute', width: 900, height: 500,
            background: 'radial-gradient(ellipse at center, rgba(38,198,198,0.14) 0%, transparent 65%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }} />
          {/* Card */}
          <div
            style={{
              position: 'relative',
              background: 'rgba(18,21,24,0.97)',
              border: '1px solid rgba(38,198,198,0.28)',
              borderRadius: 28,
              padding: '48px 40px 36px',
              maxWidth: 480,
              width: '90vw',
              textAlign: 'center',
              boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(38,198,198,0.08)',
              animation: 'tour-welcome-in 0.4s cubic-bezier(.34,1.2,.64,1) both',
            }}
          >
            <div style={{ fontSize: 58, marginBottom: 16, lineHeight: 1 }}>{current.emoji}</div>
            <h2 style={{ color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 14, letterSpacing: '-0.4px' }}>
              {current.title}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.65, marginBottom: 32, whiteSpace: 'pre-line' }}>
              {current.body}
            </p>
            <button
              onClick={next}
              style={{
                width: '100%', padding: '14px 24px',
                background: '#26C6C6', color: '#1A1D1F',
                borderRadius: 16, border: 'none',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
                marginBottom: 12, letterSpacing: '-0.2px',
              }}
            >
              Los geht&apos;s →
            </button>
            <button
              onClick={dismiss}
              style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              Überspringen
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Shared panel position (above dock, centered) ──────────────────────────

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 'max(112px, calc(96px + env(safe-area-inset-bottom, 0px)))',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(92vw, 340px)',
    zIndex: 9999,
    animation: 'tour-card-in 0.28s cubic-bezier(.34,1.2,.64,1) both',
  }

  // ── Final step with confetti + quick actions ──────────────────────────────

  if (isLast && current.quickActions) {
    return (
      <>
        <style>{TOUR_KEYFRAMES}</style>
        {showConfetti && <ConfettiCanvas />}
        <div style={panelStyle}>
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(18,21,24,0.97)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(38,198,198,0.3)',
            }}
          >
            <div className="h-0.5" style={{ background: 'linear-gradient(90deg,#26C6C6,#0E9F9F)' }} />
            <div className="px-4 pt-4 pb-4 text-center">
              <div style={{ fontSize: 40, marginBottom: 8, lineHeight: 1 }}>{current.emoji}</div>
              <h3 className="text-sm font-bold text-white/95 mb-1.5">{current.title}</h3>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{current.body}</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {current.quickActions.map(a => (
                  <button
                    key={a.path}
                    onClick={() => { router.push(a.path); dismiss() }}
                    style={{
                      padding: '8px 4px',
                      background: 'rgba(38,198,198,0.1)',
                      border: '1px solid rgba(38,198,198,0.22)',
                      borderRadius: 12,
                      color: '#26C6C6',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      lineHeight: 1.3,
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <button
                onClick={dismiss}
                style={{
                  width: '100%', padding: '10px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Tour abschließen
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Standard step panel ───────────────────────────────────────────────────

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid transparent', transition: 'opacity 0.15s',
  }

  return (
    <>
      <style>{TOUR_KEYFRAMES}</style>
      {spotlightRect && <Spotlight rect={spotlightRect} beacon />}

      <div style={panelStyle}>
        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: 'rgba(18,21,24,0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(38,198,198,0.22)',
          }}
        >
          {/* Progress bar */}
          <div className="h-0.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#26C6C6,#0E9F9F)' }}
            />
          </div>

          {/* Breadcrumb chips + controls */}
          <div className="px-3 pt-2.5 pb-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => i <= state.step ? goTo(i) : undefined}
                  style={{
                    width: 22, height: 22,
                    borderRadius: '50%',
                    background: i === state.step
                      ? '#26C6C6'
                      : i < state.step
                      ? 'rgba(38,198,198,0.35)'
                      : 'rgba(255,255,255,0.1)',
                    color: i === state.step
                      ? '#1A1D1F'
                      : i < state.step
                      ? 'rgba(38,198,198,0.9)'
                      : 'rgba(255,255,255,0.28)',
                    border: i === state.step ? '2px solid #26C6C6' : 'none',
                    fontSize: 10, fontWeight: 700,
                    cursor: i <= state.step ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => setMinimized(true)}
                title="Minimieren"
                style={{ ...btnBase, padding: '4px 6px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, lineHeight: 1 }}
              >−</button>
              <button
                onClick={restart}
                title="Neu starten"
                style={{ ...btnBase, padding: '4px 6px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)' }}
              ><RefreshCw className="w-3 h-3" /></button>
              <button
                onClick={dismiss}
                title="Tour beenden"
                style={{ ...btnBase, padding: '4px 6px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)' }}
              ><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4 pt-2.5">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{current.emoji}</span>
              <h3 className="text-sm font-bold text-white/95 leading-snug">{current.title}</h3>
            </div>

            <p
              className="text-xs leading-relaxed mb-2"
              style={{ color: 'rgba(255,255,255,0.52)', whiteSpace: 'pre-line' }}
            >
              {current.body}
            </p>

            {current.tip && (
              <div
                className="rounded-xl px-3 py-2 mb-2.5"
                style={{ background: 'rgba(38,198,198,0.09)', border: '1px solid rgba(38,198,198,0.18)' }}
              >
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(38,198,198,0.88)' }}>
                  💡 {current.tip}
                </p>
              </div>
            )}

            {/* Primary action: Probier es aus (if any) */}
            {current.tryCta && current.tryPath && (
              <button
                onClick={() => tryIt(current.tryPath!)}
                style={{
                  ...btnBase,
                  width: '100%',
                  marginBottom: 6,
                  background: 'rgba(38,198,198,0.12)',
                  border: '1px solid rgba(38,198,198,0.28)',
                  color: '#26C6C6',
                  fontSize: 11,
                }}
              >
                <Zap className="w-3 h-3 flex-shrink-0" />
                {current.tryCta}
              </button>
            )}

            {/* Navigation */}
            <div className="flex gap-1.5">
              {!isFirst && (
                <button
                  onClick={prev}
                  style={{
                    ...btnBase,
                    flexShrink: 0,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 11,
                  }}
                >
                  <ArrowLeft className="w-3 h-3" /> Zurück
                </button>
              )}
              <button
                onClick={next}
                style={{
                  ...btnBase,
                  flex: 1,
                  background: '#26C6C6',
                  color: '#1A1D1F',
                  fontSize: 12,
                }}
              >
                Weiter <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!isLast && (
              <button
                onClick={dismiss}
                className="w-full text-center text-[11px] mt-2 py-0.5 transition-colors bg-transparent border-none cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.2)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
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
