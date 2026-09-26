// ─── Module Engine ─────────────────────────────────────────────────────────────
//
// Pattern-matches discovered requirements and conversation text against a
// registry of known OKUN modules. Returns suggestions the UI can surface to
// the user ("Möchten Sie das Modul X aktivieren?").

import type { DiscoveredRequirement, ModuleDefinition } from './types'

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'tour-planning',
    name: 'Tourenplanung',
    description: 'Verwaltung und Planung von Touren, Fahrzeugen und Routen',
    triggers: ['tour', 'touren', 'fahrzeug', 'fahrzeuge', 'route', 'routen', 'tourenplanung', 'fahrtenbuch'],
  },
  {
    id: 'documentation',
    name: 'Dokumentation',
    description: 'Strukturierte Dokumentation von Prozessen, Begleitpersonen und Ereignissen',
    triggers: ['dokumentation', 'dokumentieren', 'protokoll', 'begleitkind', 'nachweis', 'bericht'],
  },
  {
    id: 'inventory',
    name: 'Inventarverwaltung',
    description: 'Verwaltung von Material, Geräten und Inventar',
    triggers: ['inventar', 'material', 'geräte', 'ausrüstung', 'verbrauchsmaterial', 'lager'],
  },
  {
    id: 'crm',
    name: 'Kundenverwaltung (CRM)',
    description: 'Verwaltung von Kunden-, Klienten- und Patientendaten',
    triggers: ['klient', 'klienten', 'patient', 'patienten', 'kunde', 'kunden', 'bewohner', 'teilnehmer'],
  },
  {
    id: 'recruiting',
    name: 'Recruiting',
    description: 'Bewerbermanagement und Stellenausschreibungen',
    triggers: ['bewerbung', 'bewerber', 'stellenausschreibung', 'recruiting', 'einstellung', 'stellenangebot'],
  },
  {
    id: 'project-management',
    name: 'Projektmanagement',
    description: 'Projektverfolgung, Aufgaben und Meilensteine',
    triggers: ['projekt', 'projekte', 'meilenstein', 'projektplan', 'aufgabenplanung'],
  },
]

/**
 * Checks text and discovered requirements against the module registry.
 * Returns a list of module IDs that may be relevant.
 */
export function detectModuleSuggestions(
  text: string,
  requirements: DiscoveredRequirement[],
): ModuleDefinition[] {
  const combined = [
    text.toLowerCase(),
    ...requirements.map(r => r.description.toLowerCase()),
  ].join(' ')

  return MODULE_REGISTRY.filter(mod =>
    mod.triggers.some(trigger => combined.includes(trigger))
  )
}
