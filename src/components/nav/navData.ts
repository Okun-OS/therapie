import type { Role } from '@/lib/types'
import {
  IcoDashboard, IcoMitarbeiter, IcoDienstplanung, IcoZeitUrlaub, IcoFinanzen,
  IcoKIAnalyse, IcoEinstellungen, IcoStandorte, IcoHeute,
  IcoPersonalrisiko, IcoSupport, IcoMitarbeiterprofil,
  IcoOKUNAssistent,
} from './OkunIcons'

export interface PanelItem {
  href: string
  label: string
  description?: string
  badge?: string
  isGold?: boolean
}

export interface PanelSection {
  title?: string
  items: PanelItem[]
}

export interface DockItem {
  id: string
  label: string
  icon: React.FC<{ size?: number; className?: string }>
  href?: string
  panel?: { title: string; sections: PanelSection[] }
  isGold?: boolean
  badge?: string | number
}

// ── Employee ────────────────────────────────────────────────────
const employeeDock: DockItem[] = [
  // "Mein Tag" = persönlicher Dashboard-Einstieg für Mitarbeiter
  { id: 'dashboard', label: 'Mein Tag', icon: IcoHeute, href: '/employee' },
  {
    id: 'dienstplan', label: 'Dienstplan', icon: IcoDienstplanung,
    panel: {
      title: 'Dienstplan',
      sections: [
        { items: [
          { href: '/employee/schedule',              label: 'Mein Dienstplan', description: 'Aktuelle Schichten & Woche' },
          { href: '/employee/schedule?tab=wishes',   label: 'Wunschdienste',   description: 'Schichtwünsche eintragen' },
          { href: '/employee/substitutions',         label: 'Vertretungen',    description: 'Schichten tauschen' },
        ]},
      ],
    },
  },
  {
    id: 'zeit', label: 'Zeit & Urlaub', icon: IcoZeitUrlaub,
    panel: {
      title: 'Zeit & Urlaub',
      sections: [
        { items: [
          { href: '/employee/time-tracking', label: 'Zeiterfassung', description: 'Stunden & Überstunden erfassen' },
          { href: '/employee/vacation',      label: 'Urlaub',        description: 'Anträge stellen & Resturlaub' },
        ]},
      ],
    },
  },
  // Profil: direkter Link — kein Panel, kein Workforce Score hier
  { id: 'profil', label: 'Profil', icon: IcoMitarbeiterprofil, href: '/employee/profile' },
  { id: 'assistent', label: 'OKUN Assistent', icon: IcoOKUNAssistent, href: '/admin/assistant', isGold: true },
]

// ── Admin (Standortleitung) ──────────────────────────────────────
// WICHTIG: Lohnabrechnung gehört NICHT hierher → ausschließlich Unternehmensebene
const adminDock: DockItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IcoDashboard, href: '/admin' },
  {
    id: 'mitarbeiter', label: 'Mitarbeiter', icon: IcoMitarbeiter,
    panel: {
      title: 'Mitarbeiter',
      sections: [
        { items: [
          // Mitarbeiter anlegen erfolgt über die Listenansicht selbst (+ Button)
          { href: '/admin/employees', label: 'Alle Mitarbeiter', description: 'Übersicht, Profile & Bearbeitung' },
        ]},
      ],
    },
  },
  {
    id: 'dienstplan', label: 'Dienstplanung', icon: IcoDienstplanung,
    panel: {
      title: 'Dienstplanung',
      sections: [
        { title: 'Planung', items: [
          { href: '/admin/schedule',  label: 'Dienstplan erstellen', description: 'KI-gestützte Wochenplanung', badge: 'KI', isGold: true },
          { href: '/admin/calendar',  label: 'Kalender',             description: 'Monatsübersicht' },
        ]},
        { title: 'Verwaltung', items: [
          { href: '/admin/vacation-requests', label: 'Urlaubsanträge', description: 'Genehmigen & ablehnen', badge: 'KI', isGold: true },
          { href: '/admin/vacation-plan',     label: 'Urlaubsplan',    description: 'Jahresplanung',          badge: 'KI', isGold: true },
          { href: '/admin/tasks',             label: 'Aufgaben',       description: 'To-dos & Checklisten' },
          { href: '/admin/substitutions',     label: 'Vertretungen',   description: 'Ausfälle & Ersatz',     badge: 'KI', isGold: true },
        ]},
      ],
    },
  },
  // Zeiterfassung: einzelne Seite → direkter Link statt Panel
  { id: 'zeit', label: 'Zeiterfassung', icon: IcoZeitUrlaub, href: '/admin/time-tracking' },
  {
    id: 'ki', label: 'KI & Analyse', icon: IcoKIAnalyse, isGold: true,
    panel: {
      title: 'KI & Analyse',
      sections: [
        { title: 'Intelligence', items: [
          { href: '/admin/workforce-score',    label: 'Workforce Score',    description: 'Team-Performance',       badge: 'KI', isGold: true },
          { href: '/admin/workforce-insights', label: 'Workforce Insights', description: 'Tiefenanalyse',          badge: 'KI', isGold: true },
          { href: '/admin/fairness-engine',    label: 'Fairness Engine',    description: 'Gerechte Verteilung',    badge: 'KI', isGold: true },
          { href: '/admin/personnel-risk',     label: 'Personalrisiko',     description: 'Frühwarnsystem',         badge: 'KI', isGold: true },
          { href: '/admin/controlling',        label: 'KI-Controlling',     description: 'Kennzahlen & Trends',    badge: 'KI', isGold: true },
        ]},
        { title: 'Berichte', items: [
          { href: '/admin/reports', label: 'Berichte & Export', description: 'Daten exportieren' },
        ]},
      ],
    },
  },
  {
    id: 'einstellungen', label: 'Einstellungen', icon: IcoEinstellungen,
    panel: {
      title: 'Einstellungen',
      sections: [
        { items: [
          // Standort-Onboarding = Regeln, Schichten, Arbeitszeiten für diesen Standort
          { href: '/admin/onboarding', label: 'Standort-Onboarding', description: 'Schichten, Regeln & Arbeitszeiten', badge: 'KI', isGold: true },
          { href: '/company/support',  label: 'Support & Hilfe',     description: 'Hilfe & Kontakt' },
        ]},
      ],
    },
  },
  { id: 'assistent', label: 'OKUN Assistent', icon: IcoOKUNAssistent, href: '/admin/assistant', isGold: true, badge: 'NEU' },
]

// ── Company (Unternehmensebene) ──────────────────────────────────
const companyDock: DockItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IcoDashboard, href: '/company' },
  {
    id: 'standorte', label: 'Standorte', icon: IcoStandorte,
    panel: {
      title: 'Standorte',
      sections: [
        { items: [
          { href: '/company/locations', label: 'Alle Standorte',  description: 'Übersicht & Vergleich' },
          { href: '/company/onboarding', label: 'KI-Onboarding', description: 'Neuen Standort einrichten', badge: 'KI', isGold: true },
        ]},
      ],
    },
  },
  {
    id: 'mitarbeiter', label: 'Mitarbeiter', icon: IcoMitarbeiter,
    panel: {
      title: 'Mitarbeiter',
      sections: [
        { items: [
          { href: '/company/employees/[id]', label: 'Mitarbeiterprofile', description: 'Standortübergreifend' },
        ]},
      ],
    },
  },
  {
    id: 'dienstplan', label: 'Dienstplanung', icon: IcoDienstplanung,
    panel: {
      title: 'Dienstplanung',
      sections: [
        { items: [
          { href: '/company/schedule',       label: 'Alle Dienstpläne',    description: 'Standortübergreifende Ansicht' },
          { href: '/company/vacation-plan',  label: 'Jahresurlaubsplanung', description: 'Unternehmensweite Übersicht' },
          { href: '/company/substitutions',  label: 'Vertretungen',        description: 'Ausfallmanagement' },
        ]},
      ],
    },
  },
  {
    id: 'finanzen', label: 'Finanzen', icon: IcoFinanzen,
    panel: {
      title: 'Finanzen & Abrechnung',
      sections: [
        { items: [
          { href: '/admin/payroll',    label: 'Lohnabrechnung',  description: 'Gehaltsabrechnungen aller Standorte', badge: 'NEU' },
          { href: '/admin/surcharges', label: 'Zuschlags-Engine', description: 'Zuschläge, Prämien & Sonderzahlungen', badge: 'NEU' },
        ]},
      ],
    },
  },
  {
    id: 'ki', label: 'KI & Analyse', icon: IcoKIAnalyse, isGold: true,
    panel: {
      title: 'KI & Analyse',
      sections: [
        { title: 'Intelligence', items: [
          { href: '/company/workforce-score',    label: 'Workforce Score',    description: 'Unternehmensweite Performance', badge: 'KI', isGold: true },
          { href: '/company/workforce-insights', label: 'Workforce Insights', description: 'Tiefenanalyse',                  badge: 'KI', isGold: true },
          { href: '/company/fairness-engine',    label: 'Fairness Engine',    description: 'Gerechte Verteilung',             badge: 'KI', isGold: true },
          { href: '/company/personnel-risk',     label: 'Personalrisiko',     description: 'Frühwarnsystem',                  badge: 'KI', isGold: true },
          { href: '/company/controlling',        label: 'KI-Controlling',     description: 'Kennzahlen & Trends',             badge: 'KI', isGold: true },
        ]},
        { title: 'Berichte', items: [
          { href: '/company/reports', label: 'Berichte & Export', description: 'Daten exportieren' },
        ]},
      ],
    },
  },
  {
    id: 'einstellungen', label: 'Einstellungen', icon: IcoEinstellungen,
    panel: {
      title: 'Einstellungen',
      sections: [
        { items: [
          { href: '/company/settings', label: 'Unternehmenseinstellungen', description: 'Globale Konfiguration' },
          { href: '/company/support',  label: 'Support & Hilfe',           description: 'Hilfe & Kontakt' },
        ]},
      ],
    },
  },
  { id: 'assistent', label: 'OKUN Assistent', icon: IcoOKUNAssistent, href: '/admin/assistant', isGold: true },
]

// ── OKUN Platform ────────────────────────────────────────────────
const okunDock: DockItem[] = [
  { id: 'dashboard', label: 'Systemübersicht', icon: IcoDashboard, href: '/okun' },
  { id: 'kunden', label: 'Kunden', icon: IcoMitarbeiter, href: '/okun/customers' },
  {
    id: 'verwaltung', label: 'Verwaltung', icon: IcoEinstellungen,
    panel: {
      title: 'Plattform-Verwaltung',
      sections: [
        { items: [
          { href: '/okun/test-accounts', label: 'Testzugänge', description: 'Demo-Konten verwalten' },
          { href: '/okun/invitations',   label: 'Einladungen', description: 'Zugänge versenden' },
        ]},
      ],
    },
  },
  { id: 'support', label: 'Support',        icon: IcoSupport,         href: '/okun/support' },
  { id: 'bugs',    label: 'Bug-Management', icon: IcoPersonalrisiko,  href: '/okun/bugs' },
]

export function getDockItems(role?: string): DockItem[] {
  switch (role as Role) {
    case 'employee': return employeeDock
    case 'admin':    return adminDock
    case 'company':  return companyDock
    case 'okun':     return okunDock
    default:         return adminDock
  }
}
