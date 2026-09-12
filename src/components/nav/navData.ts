import type { Role } from '@/lib/types'
import {
  IcoDashboard, IcoMitarbeiter, IcoDienstplanung, IcoZeitUrlaub, IcoFinanzen,
  IcoKIAnalyse, IcoEinstellungen, IcoStandorte, IcoHeute,
  IcoPersonalrisiko, IcoSupport, IcoMitarbeiterprofil, IcoNachrichten,
  IcoOKUNAssistent,
} from './OkunIcons'

export interface PanelItem {
  href: string
  label: string
  description?: string
  badge?: string
  isGold?: boolean
  icon?: string
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
  { id: 'dashboard', label: 'Mein Tag', icon: IcoHeute, href: '/employee' },
  {
    id: 'dienstplan', label: 'Dienstplan', icon: IcoDienstplanung,
    panel: {
      title: 'Dienstplan',
      sections: [
        { items: [
          { href: '/employee/schedule',              label: 'Mein Dienstplan', description: 'Aktuelle Schichten & Woche',  icon: '📅' },
          { href: '/employee/schedule?tab=wishes',   label: 'Wunschdienste',   description: 'Schichtwünsche eintragen',   icon: '⭐' },
          { href: '/employee/substitutions',         label: 'Vertretungen',    description: 'Schichten tauschen',          icon: '🔄' },
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
          { href: '/employee/time-tracking', label: 'Zeiterfassung', description: 'Stunden & Überstunden erfassen', icon: '⏱' },
          { href: '/employee/vacation',      label: 'Urlaub',        description: 'Anträge stellen & Resturlaub',   icon: '🌴' },
        ]},
      ],
    },
  },
  { id: 'nachrichten', label: 'Nachrichten', icon: IcoNachrichten, href: '/employee/nachrichten' },
  { id: 'profil', label: 'Profil', icon: IcoMitarbeiterprofil, href: '/employee/profile' },
  { id: 'assistent', label: 'OKUN Assistent', icon: IcoOKUNAssistent, href: '/admin/assistant', isGold: true },
]

// ── Admin (Standortleitung) ──────────────────────────────────────
const adminDock: DockItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IcoDashboard, href: '/admin' },
  { id: 'mitarbeiter', label: 'Mitarbeiter', icon: IcoMitarbeiter, href: '/admin/employees' },
  {
    // §106 Von sieben Menuepunkten auf vier. Zusammengelegt wurde, was
    // dieselbe Frage beantwortet: Urlaub, Jahresplanung und Dienstwuensche
    // liegen jetzt auf einer Seite.
    //
    // Die goldenen "KI"-Marken sind weg: die Dienstplanung rechnet mit einem
    // Solver, und aus der Vertretung wurde die KI bewusst entfernt. Ein
    // Abzeichen, das etwas verspricht, was nicht stattfindet, ist schaedlich.
    id: 'dienstplan', label: 'Dienstplanung', icon: IcoDienstplanung,
    panel: {
      title: 'Dienstplanung',
      sections: [
        { items: [
          { href: '/admin/schedule',       label: 'Dienstplan',       description: 'Wochenplanung erstellen und veröffentlichen', icon: '🗓' },
          { href: '/admin/calendar',       label: 'Kalender',         description: 'Monatsübersicht',                            icon: '📅' },
          { href: '/admin/urlaub',         label: 'Urlaub & Wünsche', description: 'Anträge, Jahresplanung, Dienstwünsche',      icon: '🌴' },
          { href: '/admin/substitutions',  label: 'Vertretungen',     description: 'Ausfälle und Einspringen',                   icon: '🔄' },
        ]},
      ],
    },
  },
  { id: 'zeit', label: 'Zeiterfassung', icon: IcoZeitUrlaub, href: '/admin/time-tracking' },
  { id: 'nachrichten', label: 'Nachrichten', icon: IcoNachrichten, href: '/admin/nachrichten' },
  {
    // §106 Fuenf Analyseseiten auf denselben Daten wurden eine Seite mit
    // Umschaltung. Der Workforce Score gehoert fachlich zum Team und steht
    // deshalb daneben, nicht darin.
    id: 'auswertung', label: 'Auswertungen', icon: IcoKIAnalyse,
    panel: {
      title: 'Auswertungen',
      sections: [
        { items: [
          { href: '/admin/auswertungen',    label: 'Team & Kennzahlen', description: 'Analyse, Verteilung, Risiko, Trends', icon: '📊' },
          { href: '/admin/workforce-score', label: 'Workforce Score',   description: 'Punkte und Stufen des Teams',         icon: '⚡' },
          { href: '/admin/reports',         label: 'Berichte & Export', description: 'Daten exportieren',                   icon: '📤' },
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
          { href: '/admin/setup',     label: 'Einrichtung',      description: 'Betriebsform, Struktur, Dienste, Team & Regeln', badge: 'START', icon: '🚀' },
          { href: '/admin/model',     label: 'Regeln & Wartung', description: 'Regeln prüfen, Standort zurücksetzen',           icon: '📋' },
          { href: '/admin/tasks',     label: 'Aufgabenkatalog',  description: 'To-dos und Checklisten für Dienste',             icon: '✅' },
          { href: '/company/support', label: 'Support & Hilfe',  description: 'Hilfe & Kontakt',                                icon: '💬' },
          { href: '/funde',           label: 'Funde melden',     description: 'Fehler und Verbesserungsvorschläge',             icon: '🔍' },
        ]},
      ],
    },
  },
  { id: 'assistent', label: 'OKUN Assistent', icon: IcoOKUNAssistent, href: '/admin/assistant', isGold: true },
]

const companyDock: DockItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IcoDashboard, href: '/company' },
  {
    id: 'standorte', label: 'Standorte', icon: IcoStandorte,
    panel: {
      title: 'Standorte',
      sections: [
        { items: [
          { href: '/company/locations', label: 'Alle Standorte', description: 'Standort öffnen und alles dazu sehen', icon: '📍' },
          { href: '/company/bereiche',  label: 'Bereiche',       description: 'Organisationsstruktur & Bereichsleitung', icon: '🗂' },
        ]},
      ],
    },
  },
  { id: 'mitarbeiter', label: 'Mitarbeiter', icon: IcoMitarbeiter, href: '/company/employees' },
  { id: 'nachrichten', label: 'Nachrichten', icon: IcoNachrichten, href: '/company/nachrichten' },
  {
    id: 'finanzen', label: 'Finanzen', icon: IcoFinanzen,
    panel: {
      title: 'Finanzen & Abrechnung',
      sections: [
        { items: [
          { href: '/company/payroll',    label: 'Lohnabrechnung',   description: 'Abrechnungen aller Standorte', icon: '💰' },
          { href: '/company/surcharges', label: 'Zuschlags-Engine', description: 'Zuschläge, Prämien & Sonderzahlungen', icon: '⚡' },
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
          { href: '/company/settings',    label: 'Unternehmenseinstellungen', description: 'Globale Konfiguration',                    icon: '⚙️' },
          { href: '/company/datenschutz', label: 'Datenschutz',              description: 'Auskunft und Löschung nach DSGVO',         icon: '🔐' },
          { href: '/company/reports',     label: 'Berichte & Export',        description: 'Daten exportieren',                        icon: '📤' },
          { href: '/company/support',     label: 'Support & Hilfe',          description: 'Hilfe & Kontakt',                          icon: '💬' },
          { href: '/funde',               label: 'Funde melden',             description: 'Fehler und Verbesserungsvorschläge',       icon: '🔍' },
        ]},
      ],
    },
  },
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
          { href: '/okun/dienstplanung', label: 'Dienstplanung einrichten', description: 'Regelpakete zuordnen und freischalten', icon: '🗓️' },
          { href: '/okun/test-accounts', label: 'Testzugänge', description: 'Demo-Konten verwalten', icon: '🔑' },
          { href: '/okun/invitations',   label: 'Einladungen', description: 'Zugänge versenden',      icon: '✉️' },
        ]},
      ],
    },
  },
  { id: 'support', label: 'Support',        icon: IcoSupport,         href: '/okun/support' },
  { id: 'funde',   label: 'Funde',           icon: IcoPersonalrisiko,  href: '/funde' },
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
