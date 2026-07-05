'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ArrowRight, Sparkles, Users, Calendar, CalendarDays, Clock, Palmtree, LayoutDashboard, MessageCircle, Brain, UserPlus } from 'lucide-react'
import type { Role } from '@/lib/types'

interface TourStep {
  icon: React.ElementType
  title: string
  body: string
  href?: string
  cta?: string
  iconColor: string
}

const ADMIN_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen bei OKUN Workforce',
    body: 'Diese kurze Tour zeigt dir die wichtigsten Funktionen auf einen Blick. Du kannst sie jederzeit überspringen.',
    iconColor: 'text-violet-500',
  },
  {
    icon: MessageCircle,
    title: 'Schritt 1: Standort einrichten',
    body: 'Starte mit dem KI-Onboarding: beschreibe deinen Standort, Schichten und Regeln in natürlicher Sprache — kein Formular, kein Handbuch.',
    href: '/admin/onboarding',
    cta: 'Zum Onboarding',
    iconColor: 'text-indigo-500',
  },
  {
    icon: Users,
    title: 'Schritt 2: Mitarbeiter anlegen',
    body: 'Lege Mitarbeiter per KI-Dialog oder klassischem Formular an. Die KI erkennt Arbeitszeiten, Qualifikationen und Besonderheiten automatisch.',
    href: '/admin/employees',
    cta: 'Zu den Mitarbeitern',
    iconColor: 'text-teal-600',
  },
  {
    icon: Calendar,
    title: 'Schritt 3: Dienstplan erstellen',
    body: 'Die KI erstellt auf Basis deiner Einrichtungsdaten automatisch einen optimierten Dienstplan. Du kannst ihn per Chat anpassen.',
    href: '/admin/schedule',
    cta: 'Zum Dienstplan',
    iconColor: 'text-teal-600',
  },
  {
    icon: CalendarDays,
    title: 'Neu: Kalenderansicht',
    body: 'Die Kalenderansicht zeigt alle geplanten Dienste als Monats- oder Wochenkalender — ideal für eine schnelle Übersicht.',
    href: '/admin/calendar',
    cta: 'Zum Kalender',
    iconColor: 'text-blue-500',
  },
  {
    icon: Sparkles,
    title: 'OKUN Assistent',
    body: 'Der OKUN Assistent hat Vollzugriff auf alle Daten und kann direkt Änderungen vornehmen — Dienstplan, Mitarbeiter, Urlaubsanträge und mehr.',
    href: '/admin/assistant',
    cta: 'Zum Assistenten',
    iconColor: 'text-violet-500',
  },
  {
    icon: Brain,
    title: 'KI-Controlling & Insights',
    body: 'Das Controlling-Dashboard zeigt Personalrisiken, Fairness-Scores, Überstunden-Trends und gibt proaktive Handlungsempfehlungen.',
    href: '/admin/controlling',
    cta: 'Zum Controlling',
    iconColor: 'text-rose-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Alles bereit!',
    body: 'Du kennst jetzt die wichtigsten Funktionen. Dein Dashboard zeigt immer aktuelle Warnungen und offene Aufgaben. Viel Erfolg!',
    href: '/admin',
    cta: 'Zum Dashboard',
    iconColor: 'text-teal-600',
  },
]

const EMPLOYEE_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen bei OKUN Workforce',
    body: 'Hier findest du alles, was du für deinen Arbeitsalltag brauchst. Diese kurze Tour zeigt dir die wichtigsten Seiten.',
    iconColor: 'text-violet-500',
  },
  {
    icon: Calendar,
    title: 'Dein Dienstplan',
    body: 'Sieh deinen Dienstplan für die aktuelle Woche — mit allen geplanten Schichten, Aufgaben und Gruppe.',
    href: '/employee/schedule',
    cta: 'Zum Dienstplan',
    iconColor: 'text-teal-600',
  },
  {
    icon: Clock,
    title: 'Zeiterfassung',
    body: 'Starte und stoppe deine Arbeitszeit, erfasse Pausen und stelle Anträge auf Überstunden.',
    href: '/employee/time-tracking',
    cta: 'Zur Zeiterfassung',
    iconColor: 'text-blue-500',
  },
  {
    icon: Palmtree,
    title: 'Urlaub beantragen',
    body: 'Beantrage Urlaub direkt in der App. Du siehst sofort, wer in deiner Gruppe gleichzeitig Urlaub hat.',
    href: '/employee/vacation',
    cta: 'Zum Urlaub',
    iconColor: 'text-emerald-500',
  },
  {
    icon: UserPlus,
    title: 'Vertretungen',
    body: 'Suche Vertretungen für Schichten oder biete dich selbst als Vertretung an.',
    href: '/employee/substitutions',
    cta: 'Zu den Vertretungen',
    iconColor: 'text-amber-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Alles bereit!',
    body: 'Du bist startklar. Dein Dashboard zeigt immer deine nächsten Schichten und offene Aufgaben. Viel Erfolg!',
    href: '/employee',
    cta: 'Zum Dashboard',
    iconColor: 'text-teal-600',
  },
]

const COMPANY_STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen bei OKUN Workforce',
    body: 'Als Geschäftsführung hast du einen Überblick über alle Standorte. Diese Tour zeigt dir die wichtigsten Funktionen.',
    iconColor: 'text-violet-500',
  },
  {
    icon: MessageCircle,
    title: 'Unternehmens-Onboarding',
    body: 'Richte dein Unternehmen ein: Unternehmensname, Standorte, Rollen und unternehmensweite Regeln — per KI-Dialog.',
    href: '/company/onboarding',
    cta: 'Zum Onboarding',
    iconColor: 'text-indigo-500',
  },
  {
    icon: Calendar,
    title: 'Standortübergreifende Dienstpläne',
    body: 'Sieh und vergleiche Dienstpläne aller Standorte — als Überblick für die Geschäftsführung.',
    href: '/company/schedule',
    cta: 'Zu den Dienstplänen',
    iconColor: 'text-teal-600',
  },
  {
    icon: LayoutDashboard,
    title: 'Alles bereit!',
    body: 'Dein Unternehmens-Dashboard zeigt dir immer die wichtigsten Kennzahlen. Viel Erfolg!',
    href: '/company',
    cta: 'Zum Dashboard',
    iconColor: 'text-teal-600',
  },
]

function getSteps(role: Role): TourStep[] {
  if (role === 'admin') return ADMIN_STEPS
  if (role === 'employee') return EMPLOYEE_STEPS
  if (role === 'company') return COMPANY_STEPS
  return []
}

function tourKey(role: Role) {
  return `okun_tour_done_v2:${role}`
}

interface Props {
  role: Role
}

export function SystemTour({ role }: Props) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const router = useRouter()
  const steps = getSteps(role)

  useEffect(() => {
    if (steps.length === 0) return
    const done = localStorage.getItem(tourKey(role))
    if (!done) setVisible(true)
  }, [role, steps.length])

  function dismiss() {
    localStorage.setItem(tourKey(role), '1')
    setVisible(false)
  }

  function next() {
    if (step < steps.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function goAndClose(href?: string) {
    dismiss()
    if (href) router.push(href)
  }

  if (!visible || steps.length === 0) return null

  const current = steps[step]
  const Icon = current.icon
  const isLast = step === steps.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-teal-500 transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 ${current.iconColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-2">{current.title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">{current.body}</p>

          {/* Steps dots */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${i === step ? 'w-5 h-2 bg-teal-600' : 'w-2 h-2 bg-gray-200'}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!isLast && (
              <button
                onClick={dismiss}
                className="flex-1 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors font-medium"
              >
                Überspringen
              </button>
            )}
            <button
              onClick={current.href && !isLast ? () => goAndClose(current.href) : isLast ? () => goAndClose(current.href) : next}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium"
            >
              {current.cta ?? (isLast ? 'Los geht\'s!' : 'Weiter')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {!isLast && current.href && (
            <button
              onClick={next}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-2 py-1"
            >
              Weiter ohne öffnen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
