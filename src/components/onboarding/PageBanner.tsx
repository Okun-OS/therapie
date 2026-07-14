'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Star, X, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'okun_visited_pages_v1'

function getVisited(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function markVisited(path: string) {
  try {
    const v = getVisited()
    if (!v.includes(path)) localStorage.setItem(STORAGE_KEY, JSON.stringify([...v, path]))
  } catch {}
}

// ── Banner data ───────────────────────────────────────────────────────────────

interface BannerConfig {
  title: string
  text: string
  cta: string
}

// Admin pages — informal "du"
const ADMIN_BANNERS: Record<string, BannerConfig> = {
  '/admin': {
    title: 'Dein Lagebericht',
    text: 'Hier siehst du auf einen Blick: Wer ist heute da, wie viele Stunden wurden diese Woche geleistet, und ob Urlaubsanträge offen sind. Startet jeden Tag hier.',
    cta: 'Verstanden',
  },
  '/admin/employees': {
    title: 'Dein Team im Überblick',
    text: 'Hier verwaltest du alle Mitarbeitenden. Klicke auf eine Person für Details oder nutze „Per KI-Chat" um Daten schnell zu ändern.',
    cta: 'Verstanden',
  },
  '/admin/schedule': {
    title: 'KI plant für dich',
    text: 'Die KI erstellt automatisch faire Dienstpläne basierend auf deinem Standort-Onboarding. Nutze „Plan erstellen" für einen neuen Plan oder „Dienstplan bearbeiten" für manuelle Änderungen.',
    cta: 'Plan erstellen',
  },
  '/admin/time-tracking': {
    title: 'Stunden prüfen & genehmigen',
    text: '3 Tabs: Überstundenanträge genehmigen oder ablehnen, Krankheiten und Abwesenheiten eintragen, und am Monatsende den Monatsabschluss per Mitarbeiter freigeben.',
    cta: 'Alle Tabs ansehen',
  },
  '/admin/workforce-score': {
    title: 'Wer ist im Team top?',
    text: 'Die Rangliste zeigt Mitarbeitende nach ihrem Workforce Score – von Bronze bis Diamant. Der Score steigt durch Pünktlichkeit, Vertretungsbereitschaft und positive Zeiterfassung.',
    cta: 'Rangliste ansehen',
  },
  '/admin/workforce-insights': {
    title: 'Tiefenanalyse deines Teams',
    text: 'Aggregierte KPIs: Pünktlichkeit, Vertretungs-Erfolgsquote, unterbesetzte Schichten, Abwesenheitsquote. Alle Werte werden automatisch aus Zeiterfassung und Dienstplan berechnet.',
    cta: 'Insights entdecken',
  },
  '/admin/fairness-engine': {
    title: 'Faire Verteilung für alle',
    text: 'Die Engine analysiert die letzten 4 Wochen und zeigt Fairness-Warnungen pro Mitarbeiter. Spalten: Frühdienste, Spätdienste, Wochenenddienste, Folgetage. Rot = Grenzwert überschritten.',
    cta: 'Fairness prüfen',
  },
  '/admin/personnel-risk': {
    title: 'Frühwarnsystem für dein Team',
    text: '3 Risikokategorien: Burnout-Risiko (Überstunden + unfaire Verteilung), Fluktuationsrisiko und Unterbesetzungsrisiko (freie Schichten in den nächsten 21 Tagen).',
    cta: 'Risiken ansehen',
  },
  '/admin/controlling': {
    title: 'Dein KI-Lagebericht',
    text: 'Die KI fasst täglich die wichtigsten Ereignisse zusammen – kritische Alerts (rot), Warnungen (orange), positive Meldungen (grün). Darunter: KPIs und die heutige Personalübersicht.',
    cta: 'Lagebericht lesen',
  },
  '/admin/reports': {
    title: 'Daten exportieren',
    text: 'Exportiere Stunden- und Dienstplandaten als PDF oder Excel. Das Balkendiagramm zeigt Stunden pro Monat im Jahresüberblick.',
    cta: 'Bericht exportieren',
  },
  '/admin/assistant': {
    title: 'Dein KI-Kollege mit Vollzugriff',
    text: 'Stelle direkte Fragen oder gib Befehle in natürlicher Sprache. Der Assistent hat Zugriff auf alle Daten und kann direkt handeln: Pläne ändern, Mitarbeiter bearbeiten, Berichte erstellen.',
    cta: 'Demo-Frage stellen',
  },
  '/admin/onboarding': {
    title: 'Das Gehirn der KI',
    text: 'Alles was du hier eingibst, liest die KI bei jeder Dienstplan-Erstellung automatisch. Schichten, Regeln, Sonderzeiten, Personalstruktur – je genauer, desto besser der Plan.',
    cta: 'Beschreibung prüfen',
  },
  '/admin/vacation-requests': {
    title: 'Urlaubsanträge verwalten',
    text: 'Hier siehst du alle eingereichten Urlaubsanträge deiner Mitarbeitenden. Genehmige oder lehne Anträge direkt ab – die Mitarbeitenden werden sofort benachrichtigt.',
    cta: 'Anträge prüfen',
  },
  '/admin/vacation-plan': {
    title: 'Jahresurlaubsplan',
    text: 'Übersicht aller geplanten Urlaubszeiträume für das laufende Jahr – geordnet nach Mitarbeitenden. Erkenne Engpässe frühzeitig und plane entsprechend.',
    cta: 'Jahresplan ansehen',
  },
  '/admin/substitutions': {
    title: 'Vertretungen koordinieren',
    text: 'Verwalte offene Vertretungsanfragen für deinen Standort. Das System eskaliert automatisch wenn kein Ersatz gefunden wird.',
    cta: 'Vertretungen prüfen',
  },
  '/admin/calendar': {
    title: 'Standort-Kalender',
    text: 'Gesamtüberblick aller Schichten, Abwesenheiten und Sondertermine für deinen Standort. Wechsle zwischen Wochen- und Monatsansicht.',
    cta: 'Kalender öffnen',
  },
  '/admin/tasks': {
    title: 'Aufgaben im Überblick',
    text: 'Verwalte To-dos und Aufgaben für dein Team. Erstelle Aufgaben, weise sie Mitarbeitenden zu und verfolge den Fortschritt.',
    cta: 'Aufgaben ansehen',
  },
  '/admin/payroll': {
    title: 'Lohnabrechnung',
    text: 'Verwalte Gehaltsabrechnungen direkt aus den erfassten Stunden. Dieses Feature befindet sich im Aufbau.',
    cta: 'Vorschau ansehen',
  },
  '/admin/surcharges': {
    title: 'Automatische Zuschläge',
    text: 'Berechne Nacht-, Wochenend- und Feiertagszuschläge sowie Prämien automatisch aus den Zeiterfassungsdaten. Demnächst verfügbar.',
    cta: 'Vorschau ansehen',
  },
}

// Company pages — formal "Sie"
const COMPANY_BANNERS: Record<string, BannerConfig> = {
  '/company': {
    title: 'Ihr Unternehmens-Cockpit',
    text: 'Alle Standorte, alle Mitarbeitenden, alle Stunden – auf einer Seite. Der Standortvergleich zeigt auf einen Blick wo Handlungsbedarf besteht.',
    cta: 'Verstanden',
  },
  '/company/locations': {
    title: 'Standorte verwalten',
    text: 'Sehen Sie alle Standorte Ihres Unternehmens mit Status, Mitarbeiterzahl und zuständiger Verwaltung. Fügen Sie neue Standorte hinzu oder öffnen Sie einen Standort für Details.',
    cta: 'Standort hinzufügen',
  },
  '/company/bereiche': {
    title: 'Organisationsstruktur',
    text: 'Gruppieren Sie Standorte in Bereiche (z.B. „Nord", „Süd", „Kitas") und weisen Sie Bereichsleitungen zu. Bereiche ermöglichen Auswertungen auf Bereichsebene.',
    cta: 'Bereich anlegen',
  },
  '/company/onboarding': {
    title: 'KI auf Unternehmensebene',
    text: 'Der globalste Konfigurationsschritt: Unternehmensweite Regeln die für alle Standorte gelten. Status je Standort zeigt ob die KI-Konfiguration vollständig ist.',
    cta: 'KI konfigurieren',
  },
  '/company/employees': {
    title: 'Standortübergreifend suchen',
    text: 'Suchen Sie Mitarbeitende über alle Standorte hinweg. Sehen Sie Profil, Stundenkonto, Resturlaub und Diensthistorie – ohne Standortwechsel.',
    cta: 'Mitarbeiter suchen',
  },
  '/company/schedule': {
    title: 'Besetzung auf einen Blick',
    text: 'Wöchentliche Übersicht aller Standortpläne. „Vollständig besetzt" (grün) = kein Handlungsbedarf. Mitarbeiter ohne Einteilung werden unten gelistet – standortübergreifend.',
    cta: 'Pläne ansehen',
  },
  '/company/vacation-plan': {
    title: 'Schulferien bereits integriert',
    text: 'OKUN integriert den Schulferienkalender automatisch. Sehen Sie welche Ferien anstehen und ob Urlaubskonflikte drohen. Filtern Sie nach Standort oder sehen Sie alle auf einmal.',
    cta: 'Jahresplan ansehen',
  },
  '/company/substitutions': {
    title: 'Ausfälle unternehmensweit',
    text: '„Org.-eskaliert" = ein Standort konnte den Ausfall nicht selbst lösen. Die vier Kacheln oben zeigen: Offen / Dringend / Besetzt / Org.-eskaliert.',
    cta: 'Vertretungen prüfen',
  },
  '/company/workforce-score': {
    title: 'Rangliste & Bonus konfigurieren',
    text: 'Sehen Sie die unternehmensweite Leistungsrangliste (Bronze bis Diamant). Exklusiv auf GF-Ebene: Definieren Sie Bonus-Texte pro Level.',
    cta: 'Bonustexte definieren',
  },
  '/company/workforce-insights': {
    title: 'Performance im Detail',
    text: 'Aggregierte KPIs über alle Standorte: Ø Workforce Score, Pünktlichkeit, Vertretungs-Erfolgsquote, Schicht-Level-Verteilung, Eskalationsstufen.',
    cta: 'Insights erkunden',
  },
  '/company/fairness-engine': {
    title: 'Fairness über alle Standorte',
    text: '4-Wochen-Gedächtnis: Die Engine sieht WER schon zu viele Wochenenddienste hatte und gleicht automatisch aus. Ø Fairness-Score unter 60 = Handlungsbedarf.',
    cta: 'Fairness prüfen',
  },
  '/company/personnel-risk': {
    title: 'Frühwarnsystem Burnout & Fluktuation',
    text: 'Unternehmensweite Risikokategorien: Burnout-Risiko (Überstunden + unfaire Pläne), Fluktuationsrisiko und Unterbesetzungsrisiko für die nächsten 21 Tage.',
    cta: 'Risiken ansehen',
  },
  '/company/controlling': {
    title: 'Ihr Management-Cockpit',
    text: '15 Management-Kennzahlen – von Fairness-Score bis Dienstplanstabilität – auf einer Seite. Am Seitenende: Direktfragen an die KI.',
    cta: 'Cockpit öffnen',
  },
  '/company/reports': {
    title: 'Daten für externe Auswertung',
    text: 'Exportieren Sie Stunden-, Dienstplan- und Kennzahlendaten als PDF oder Excel – für Beirat, Träger, Förderstellen oder interne Jahresberichte.',
    cta: 'Bericht exportieren',
  },
  '/company/settings': {
    title: 'Globale Konfiguration',
    text: 'Setzen Sie Standardwerte die für alle Standorte gelten: Vollzeit-Wochenstunden, Urlaubstage pro Jahr, automatische Urlaubsgenehmigung. Neue Standorte erben diese Werte automatisch.',
    cta: 'Werte prüfen',
  },
  '/company/support': {
    title: 'Hilfe & Support',
    text: 'Kontaktieren Sie das OKUN-Team direkt oder lesen Sie in der Wissensdatenbank nach. Ihr Support-Team antwortet in der Regel innerhalb von 4 Stunden.',
    cta: 'Support kontaktieren',
  },
}

// Employee pages — informal "du"
const EMPLOYEE_BANNERS: Record<string, BannerConfig> = {
  '/employee': {
    title: 'Dein Alltagsstart',
    text: 'Hier siehst du jeden Tag auf einen Blick: welcher Dienst ansteht, wie dein Stundenkonto steht und ob Urlaubsanträge offen sind. Drück „Einstempeln" wenn du anfängst.',
    cta: 'Verstanden',
  },
  '/employee/schedule': {
    title: 'Deine Woche auf einen Blick',
    text: 'Der heutige Tag ist immer hervorgehoben. Wechsle oben zwischen Tages-, Wochen- und Monatsansicht. Die Icons rechts an jeder Schicht: Zeiterfassung, Details, Tausch.',
    cta: 'Dienstplan ansehen',
  },
  '/employee/time-tracking': {
    title: 'Deine Stunden im Blick',
    text: 'Die große Uhr zeigt die aktuelle Uhrzeit. Drücke „Starten" wenn du anfängst, „Stoppen" wenn du gehst. Darunter: Stundenkonto für heute, diese Woche und diesen Monat.',
    cta: 'Zeit starten',
  },
  '/employee/vacation': {
    title: 'Urlaub beantragen & planen',
    text: 'Oben siehst du deinen Resturlaub. Darunter kannst du Jahreswünsche eintragen (bevorzugte Monate) oder direkt einen konkreten Urlaubsantrag stellen.',
    cta: 'Antrag stellen',
  },
  '/employee/profile': {
    title: 'Dein Jahresüberblick',
    text: 'Hier siehst du deine persönlichen Kennzahlen: Resturlaub, Stundenkonto, Wochenstunden, Überstunden, Krankheitstage und Fehlzeiten für das aktuelle Jahr.',
    cta: 'Verstanden',
  },
  '/employee/substitutions': {
    title: 'Vertretungsanfragen',
    text: 'Hier siehst du offene Vertretungsanfragen bei denen du einspringen kannst, sowie den Status deiner eigenen Anfragen.',
    cta: 'Anfragen ansehen',
  },
}

// Shared across all roles
const SHARED_BANNERS: Record<string, BannerConfig> = {
  '/account': {
    title: 'Konto schützen',
    text: 'Richte 2-Faktor-Authentifizierung ein. Mit einer Authenticator-App ist dein Konto auch bei einem gestohlenen Passwort sicher.',
    cta: '2FA einrichten',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageBanner() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve banner config for current path + role
  function getBanner(): BannerConfig | null {
    if (!user) return null
    if (SHARED_BANNERS[pathname]) return SHARED_BANNERS[pathname]
    if (user.role === 'admin' && ADMIN_BANNERS[pathname]) return ADMIN_BANNERS[pathname]
    if (user.role === 'company' && COMPANY_BANNERS[pathname]) return COMPANY_BANNERS[pathname]
    if (user.role === 'employee' && EMPLOYEE_BANNERS[pathname]) return EMPLOYEE_BANNERS[pathname]
    return null
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setExiting(false)
    setVisible(false)

    const banner = getBanner()
    if (!banner) return

    const visited = getVisited()
    if (visited.includes(pathname)) return

    // Small delay so page content renders first
    const showTimer = setTimeout(() => {
      setVisible(true)
      timerRef.current = setTimeout(() => {
        dismiss()
      }, 8000)
    }, 600)

    return () => {
      clearTimeout(showTimer)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user])

  function dismiss(_action?: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    markVisited(pathname)
    setExiting(true)
    setTimeout(() => setVisible(false), 300)
  }

  const banner = getBanner()
  if (!visible || !banner) return null

  return (
    <div
      className="mx-3 mt-2 mb-0 flex items-center gap-3 px-4 py-2.5 rounded-2xl"
      style={{
        background: 'rgba(38,198,198,0.07)',
        border: '1px solid rgba(38,198,198,0.18)',
        minHeight: 50,
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      <Star
        size={15}
        className="flex-shrink-0"
        style={{ color: '#26C6C6', fill: 'rgba(38,198,198,0.25)' }}
      />
      <div className="flex-1 min-w-0 overflow-hidden">
        <span className="font-semibold text-navy text-[12px]">{banner.title} </span>
        <span className="text-[11px] text-gray-500">{banner.text}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => dismiss()}
          className="hidden sm:flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg hover:bg-black/[0.05] transition-colors whitespace-nowrap"
          style={{ color: '#26C6C6' }}
        >
          Mehr erfahren <ChevronRight size={11} />
        </button>
        <button
          onClick={() => dismiss()}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
          style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(15,23,42,0.65)' }}
        >
          Verstanden
        </button>
        <button
          onClick={() => dismiss()}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/[0.06] transition-colors flex-shrink-0"
          style={{ color: 'rgba(0,0,0,0.35)' }}
          aria-label="Banner schließen"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Reset helper (for testing) ────────────────────────────────────────────────

export function resetPageBanners() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
