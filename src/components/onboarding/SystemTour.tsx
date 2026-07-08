'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  X, ArrowRight, ArrowLeft, Sparkles, Users, Calendar, CalendarDays, Clock,
  Palmtree, LayoutDashboard, MessageCircle, Brain, UserPlus, Euro,
  CheckCircle, Settings, ClipboardList, BarChart3, MapPin,
} from 'lucide-react'
import type { Role } from '@/lib/types'

// ── Tour state persisted in localStorage ────────────────────────────────────

const STATE_KEY = 'okun_tour_v3'
const DONE_KEY = (role: Role) => `okun_tour_done_v3:${role}`

interface TourState {
  role: Role
  step: number
  active: boolean
}

function loadState(): TourState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveState(s: TourState) {
  localStorage.setItem(STATE_KEY, JSON.stringify(s))
}

function clearState() {
  localStorage.removeItem(STATE_KEY)
}

// ── Step definitions ─────────────────────────────────────────────────────────

interface TourStep {
  icon: React.ElementType
  title: string
  body: string
  tip?: string
  path: string           // navigate here when this step starts
  iconColor: string
}

const ADMIN_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen bei OKUN Workforce',
    body: 'Diese Tour führt dich durch alle wichtigen Bereiche der Anwendung. Du kannst sie jederzeit unterbrechen und später fortsetzen — sie merkt sich genau, wo du aufgehört hast.',
    tip: 'Die Tour bleibt aktiv, auch wenn du Funktionen ausprobierst.',
    path: '/admin',
    iconColor: 'text-violet-500',
  },
  {
    icon: MessageCircle,
    title: 'Schritt 1: KI-Onboarding',
    body: 'Hier richtest du deinen Standort ein — Schichten, Gruppen, Regeln und Arbeitszeiten. Erzähl der KI einfach in natürlicher Sprache, wie euer Standort funktioniert.',
    tip: 'Das Onboarding ist die Basis für alle automatischen Funktionen. Je mehr du hier angibst, desto besser arbeitet die KI.',
    path: '/admin/onboarding',
    iconColor: 'text-indigo-500',
  },
  {
    icon: Users,
    title: 'Schritt 2: Mitarbeiter',
    body: 'Lege Mitarbeiter per KI-Dialog oder klassischem Formular an. Die KI erkennt Qualifikationen, Besonderheiten, Arbeitsmodelle und Verfügbarkeiten automatisch.',
    tip: 'Du kannst bestehende Mitarbeiter jederzeit bearbeiten — entweder im Formular oder per KI-Chat.',
    path: '/admin/employees',
    iconColor: 'text-teal-600',
  },
  {
    icon: Calendar,
    title: 'Schritt 3: Dienstplan',
    body: 'Die KI erstellt auf Basis deiner Onboarding-Daten automatisch einen optimierten Dienstplan. Anschließend kannst du ihn per Chat-Dialog verfeinern oder manuell anpassen.',
    tip: 'Klicke auf „KI-Planung starten" und beschreibe besondere Ereignisse oder Wünsche für diese Woche.',
    path: '/admin/schedule',
    iconColor: 'text-teal-600',
  },
  {
    icon: CalendarDays,
    title: 'Schritt 4: Kalender',
    body: 'Der Kalender zeigt alle geplanten Dienste als Monats- oder Wochenansicht. Du siehst auf einen Blick, wer wann arbeitet, und kannst Tage auswählen für eine Detailansicht.',
    tip: 'Klicke auf einen Tag, um alle Mitarbeiter und Schichten dieses Tages zu sehen.',
    path: '/admin/calendar',
    iconColor: 'text-blue-500',
  },
  {
    icon: Clock,
    title: 'Schritt 5: Zeiterfassung',
    body: 'Hier siehst du alle Überstundenanträge, Abwesenheiten und Monatsabschlüsse deiner Mitarbeiter. Du kannst Einträge korrigieren, Überstunden genehmigen und Monate freigeben.',
    tip: 'Der Monatsabschluss erzeugt rechtssichere Nachweise, die du als PDF drucken und genehmigen kannst.',
    path: '/admin/time-tracking',
    iconColor: 'text-orange-500',
  },
  {
    icon: Euro,
    title: 'Schritt 6: Zuschlags-Engine',
    body: 'Berechne automatisch Nacht-, Sonntags-, Feiertags- und Samstagszuschläge für alle Mitarbeiter. Konfiguriere Regeln oder nutze die vordefinierten gesetzlichen Vorgaben.',
    tip: 'Der DATEV-Export im CSV-Format kann direkt in deine Lohnbuchhaltungssoftware importiert werden.',
    path: '/admin/surcharges',
    iconColor: 'text-emerald-500',
  },
  {
    icon: Euro,
    title: 'Schritt 7: Lohnabrechnung',
    body: 'Erstelle vollständige Lohnabrechnungen für alle Mitarbeiter — mit Lohnsteuer, Sozialversicherungsbeiträgen und Zuschlägen. Alle Berechnungen erfolgen deterministisch nach deutschem Recht.',
    tip: 'Der DATEV-Export im CSV-Format kann direkt in deine Buchhaltungssoftware importiert werden.',
    path: '/admin/payroll',
    iconColor: 'text-emerald-600',
  },
  {
    icon: Palmtree,
    title: 'Schritt 8: Urlaubsanträge',
    body: 'Genehmige oder lehne Urlaubsanträge deiner Mitarbeiter ab. Die KI gibt dir eine Empfehlung basierend auf Besetzung, Fairness und persönlichen Faktoren.',
    tip: 'Mitarbeiter sehen ihre Anträge und den Status in Echtzeit in der Mitarbeiter-App.',
    path: '/admin/vacation-requests',
    iconColor: 'text-green-500',
  },
  {
    icon: Sparkles,
    title: 'Schritt 9: OKUN Assistent',
    body: 'Der OKUN Assistent hat Vollzugriff auf alle Daten und kann direkt Änderungen vornehmen — Dienstplan anpassen, Mitarbeiter bearbeiten, Urlaubsanträge prüfen und mehr.',
    tip: 'Schreibe einfach, was du tun möchtest — in natürlicher Sprache.',
    path: '/admin/assistant',
    iconColor: 'text-violet-500',
  },
  {
    icon: Brain,
    title: 'Schritt 10: KI-Controlling',
    body: 'Das Controlling-Dashboard zeigt Personalrisiken, Fairness-Scores, Überstunden-Trends und gibt proaktive Handlungsempfehlungen — bevor Probleme entstehen.',
    tip: 'Die Frühwarnfunktion informiert dich automatisch bei kritischen Situationen.',
    path: '/admin/controlling',
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
    body: 'Diese Tour zeigt dir alle wichtigen Bereiche auf einen Blick. Du kannst jederzeit unterbrechen und die Tour läuft genau dort weiter, wo du aufgehört hast.',
    path: '/employee',
    iconColor: 'text-violet-500',
  },
  {
    icon: Calendar,
    title: 'Schritt 1: Dein Dienstplan',
    body: 'Sieh deinen Dienstplan für die aktuelle Woche. Wechsle zwischen Tages-, Wochen- und Monatsansicht. Die Monatsansicht zeigt dir alle Dienste, Urlaube und Abwesenheiten im Überblick.',
    tip: 'Im Tab „Wunschdienste" kannst du Wünsche für bestimmte Tage oder Schichten einreichen.',
    path: '/employee/schedule',
    iconColor: 'text-teal-600',
  },
  {
    icon: Clock,
    title: 'Schritt 2: Zeiterfassung',
    body: 'Starte und stoppe deine Arbeitszeit per Knopfdruck. Du siehst dein Stundenkonto immer aktuell — inklusive Überstunden und Minusstunden.',
    tip: 'Wenn du Pausen machst, denke daran, sie zu erfassen. Das ist wichtig für deinen Monatsnachweis.',
    path: '/employee/time-tracking',
    iconColor: 'text-blue-500',
  },
  {
    icon: Palmtree,
    title: 'Schritt 3: Urlaub beantragen',
    body: 'Beantrage Urlaub direkt in der App. Du siehst sofort, wer in deiner Gruppe gleichzeitig Urlaub hat und wie viele Urlaubstage dir noch zustehen.',
    tip: 'Du erhältst eine Benachrichtigung, sobald dein Antrag genehmigt oder abgelehnt wurde.',
    path: '/employee/vacation',
    iconColor: 'text-emerald-500',
  },
  {
    icon: UserPlus,
    title: 'Schritt 4: Vertretungen',
    body: 'Suche Vertretungen für deine Schichten oder biete dich selbst als Vertretung an. Das System schlägt automatisch passende Kollegen vor.',
    path: '/employee/substitutions',
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
    body: 'Richte dein Unternehmen ein: Unternehmensname, Standorte, Rollenmodell und unternehmensweite Regeln — alles per KI-Dialog in natürlicher Sprache.',
    tip: 'Das Rollenmodell (z.B. Gruppenleitung, Fachkraft, Hilfskraft) gilt für alle Standorte.',
    path: '/company/onboarding',
    iconColor: 'text-indigo-500',
  },
  {
    icon: MapPin,
    title: 'Schritt 2: Standorte',
    body: 'Verwalte alle Standorte deines Unternehmens. Für jeden Standort kann die Standortleitung ihr eigenes KI-Onboarding durchführen.',
    path: '/company/locations',
    iconColor: 'text-blue-500',
  },
  {
    icon: Calendar,
    title: 'Schritt 3: Standortübergreifende Dienstpläne',
    body: 'Sieh alle Dienstpläne aller Standorte auf einen Blick — inklusive Unterbesetzungswarnung und Mitarbeiter ohne Einteilung.',
    path: '/company/schedule',
    iconColor: 'text-teal-600',
  },
  {
    icon: BarChart3,
    title: 'Schritt 4: Workforce Insights',
    body: 'Analysiere Personalkosten, Überstunden-Trends, Krankheitsquoten und Besetzungsqualität über alle Standorte hinweg.',
    path: '/company/workforce-insights',
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

function getSteps(role: Role): TourStep[] {
  if (role === 'admin') return ADMIN_STEPS
  if (role === 'employee') return EMPLOYEE_STEPS
  if (role === 'company') return COMPANY_STEPS
  return []
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props { role: Role }

export function SystemTour({ role }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setStateLocal] = useState<TourState | null>(null)
  const [minimized, setMinimized] = useState(false)

  const steps = getSteps(role)

  // Load persisted state on mount
  useEffect(() => {
    const done = localStorage.getItem(DONE_KEY(role))
    if (done) return
    const saved = loadState()
    if (saved && saved.role === role && saved.active) {
      setStateLocal(saved)
    } else if (!saved) {
      // First time: start the tour
      const initial: TourState = { role, step: 0, active: true }
      saveState(initial)
      setStateLocal(initial)
    }
  }, [role])

  const updateState = useCallback((s: TourState) => {
    saveState(s)
    setStateLocal(s)
  }, [])

  function dismiss() {
    localStorage.setItem(DONE_KEY(role), '1')
    clearState()
    setStateLocal(null)
  }

  function next() {
    if (!state) return
    const nextStep = state.step + 1
    if (nextStep >= steps.length) {
      dismiss()
      return
    }
    const newState = { ...state, step: nextStep }
    updateState(newState)
    const target = steps[nextStep].path
    if (target && pathname !== target) {
      router.push(target)
    }
  }

  function prev() {
    if (!state || state.step === 0) return
    const prevStep = state.step - 1
    const newState = { ...state, step: prevStep }
    updateState(newState)
    const target = steps[prevStep].path
    if (target && pathname !== target) {
      router.push(target)
    }
  }

  function goTo(stepIdx: number) {
    if (!state) return
    const newState = { ...state, step: stepIdx }
    updateState(newState)
    const target = steps[stepIdx].path
    if (target && pathname !== target) {
      router.push(target)
    }
  }

  if (!state || !state.active || steps.length === 0) return null

  const current = steps[state.step]
  if (!current) return null

  const isLast = state.step === steps.length - 1
  const isFirst = state.step === 0
  const Icon = current.icon
  const progress = ((state.step + 1) / steps.length) * 100

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-20 z-50 flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-2xl px-3 py-2 text-sm font-medium text-navy hover:shadow-xl transition-all"
      >
        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
        Tour läuft ({state.step + 1}/{steps.length})
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-teal-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 shrink-0 ${current.iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400 font-medium">{state.step + 1} / {steps.length}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(true)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors text-xs"
                  title="Minimieren"
                >
                  −
                </button>
                <button
                  onClick={dismiss}
                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                  title="Tour beenden"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
                className={`rounded-full transition-all ${i === state.step ? 'w-4 h-2 bg-teal-600' : 'w-2 h-2 ' + (i < state.step ? 'bg-teal-300' : 'bg-gray-200')}`}
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
              {isLast ? (
                <><CheckCircle className="w-3.5 h-3.5" /> Abgeschlossen!</>
              ) : (
                <>Weiter <ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>
          {!isLast && (
            <button onClick={dismiss} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-2 py-0.5">
              Tour beenden
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
