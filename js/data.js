/**
 * data.js – Datenmodell, Referenzdaten, Messkonfiguration
 *
 * HINWEIS ZU REFERENZWERTEN:
 * Alle Zahlenwerte in REFERENCE_DATA sind Demo- und Platzhalterwerte.
 * Sie basieren auf grob approximierten Bevölkerungsdurchschnittswerten
 * (deutschsprachiger Raum) und stellen keine medizinische Aussage dar.
 * Die modulare Struktur erlaubt spätere Integration echter Datensätze.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// MESSKONFIGURATION – Metadaten für alle unterstützten Messfelder
// ─────────────────────────────────────────────────────────────────────────────

const MEASUREMENT_CONFIG = {
  // Allgemeine Körpermaße
  height: {
    label: 'Körpergröße', unit: 'cm', decimals: 1,
    min: 100, max: 250, step: 0.5, category: 'general',
  },
  weight: {
    label: 'Körpergewicht', unit: 'kg', decimals: 1,
    min: 30, max: 200, step: 0.5, category: 'general',
  },
  shoeSize: {
    label: 'Schuhgröße', unit: 'EU', decimals: 0,
    min: 30, max: 55, step: 0.5, category: 'general',
  },
  handLength: {
    label: 'Handlänge', unit: 'cm', decimals: 1,
    min: 12, max: 30, step: 0.5, category: 'general',
  },
  armLength: {
    label: 'Armlänge', unit: 'cm', decimals: 1,
    min: 45, max: 100, step: 0.5, category: 'general',
  },
  legLength: {
    label: 'Beinlänge', unit: 'cm', decimals: 1,
    min: 60, max: 130, step: 0.5, category: 'general',
  },
  shoulderWidth: {
    label: 'Schulterbreite', unit: 'cm', decimals: 1,
    min: 28, max: 65, step: 0.5, category: 'general',
  },
  bodyHair: {
    label: 'Körperbehaarung', unit: 'Stufe', decimals: 0,
    min: 0, max: 5, step: 1, category: 'general',
    scaleLabels: ['keine', 'sehr wenig', 'wenig', 'mittel', 'stark', 'sehr stark'],
    isScale: true,
  },
  // Sensible Maße (Privatbereich)
  sensitiveLength: {
    label: 'Länge', unit: 'cm', decimals: 1,
    min: 4, max: 28, step: 0.5, category: 'sensitive',
  },
  sensitiveCircumference: {
    label: 'Umfang', unit: 'cm', decimals: 1,
    min: 5, max: 20, step: 0.5, category: 'sensitive',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REFERENZDATEN
// Struktur je Feld: { avg, p10, p25, p75, p90, min, max, thresholds, labels }
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_DATA = {
  _meta: {
    source: 'DEMO-Platzhalterwerte (approximiert, kein wissenschaftlicher Anspruch)',
    version: '1.0.0-demo',
    note: 'Diese Werte dienen nur zur Orientierung. Für klinische Zwecke sind validierte Referenzdaten erforderlich.',
  },

  general: {
    height: {
      avg: 175, p10: 161, p25: 168, p75: 182, p90: 190, min: 145, max: 215,
      thresholds: { small: 168, large: 182 },
      labels: { small: 'klein (< 168 cm)', average: 'durchschnittlich (168–182 cm)', large: 'groß (> 182 cm)' },
    },
    weight: {
      avg: 76, p10: 56, p25: 65, p75: 88, p90: 101, min: 42, max: 155,
      thresholds: { small: 65, large: 88 },
      labels: { small: 'leicht (< 65 kg)', average: 'mittel (65–88 kg)', large: 'schwer (> 88 kg)' },
    },
    shoeSize: {
      avg: 42, p10: 38, p25: 40, p75: 44, p90: 46, min: 35, max: 51,
      thresholds: { small: 40, large: 44 },
      labels: { small: 'klein (< 40)', average: 'mittel (40–44)', large: 'groß (> 44)' },
    },
    handLength: {
      avg: 18.5, p10: 16.0, p25: 17.3, p75: 19.7, p90: 21.0, min: 13.5, max: 26.0,
      thresholds: { small: 17.3, large: 19.7 },
      labels: { small: 'klein (< 17,3 cm)', average: 'mittel (17,3–19,7 cm)', large: 'groß (> 19,7 cm)' },
    },
    armLength: {
      avg: 72, p10: 63, p25: 67, p75: 77, p90: 81, min: 52, max: 94,
      thresholds: { small: 67, large: 77 },
      labels: { small: 'kurz (< 67 cm)', average: 'mittel (67–77 cm)', large: 'lang (> 77 cm)' },
    },
    legLength: {
      avg: 85, p10: 75, p25: 80, p75: 91, p90: 96, min: 66, max: 112,
      thresholds: { small: 80, large: 91 },
      labels: { small: 'kurz (< 80 cm)', average: 'mittel (80–91 cm)', large: 'lang (> 91 cm)' },
    },
    shoulderWidth: {
      avg: 43, p10: 37, p25: 40, p75: 46, p90: 49, min: 31, max: 59,
      thresholds: { small: 40, large: 46 },
      labels: { small: 'schmal (< 40 cm)', average: 'mittel (40–46 cm)', large: 'breit (> 46 cm)' },
    },
    bodyHair: {
      avg: 2.5, p10: 0, p25: 1, p75: 4, p90: 5, min: 0, max: 5,
      thresholds: { small: 1.5, large: 3.5 },
      labels: { small: 'wenig (0–1)', average: 'mittel (2–3)', large: 'viel (4–5)' },
    },
  },

  sensitive: {
    sensitiveLength: {
      // DEMO: Annäherung an Metaanalysen (z. B. Veale et al. 2015, approximiert)
      avg: 13.5, p10: 10.5, p25: 12.0, p75: 15.0, p90: 17.0, min: 7.0, max: 23.0,
      thresholds: { small: 12.0, large: 15.0 },
      labels: {
        small: 'unterdurchschnittlich (< 12,0 cm)',
        average: 'durchschnittlich (12,0–15,0 cm)',
        large: 'überdurchschnittlich (> 15,0 cm)',
      },
    },
    sensitiveCircumference: {
      avg: 11.5, p10: 9.5, p25: 10.5, p75: 12.5, p90: 13.5, min: 6.5, max: 17.0,
      thresholds: { small: 10.5, large: 12.5 },
      labels: {
        small: 'unterdurchschnittlich (< 10,5 cm)',
        average: 'durchschnittlich (10,5–12,5 cm)',
        large: 'überdurchschnittlich (> 12,5 cm)',
      },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REFERENZPROFILE (eingebaut, nicht löschbar)
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_PROFILES = {
  ref_small: {
    id: 'ref_small', name: 'Referenz: Klein', isReference: true,
    color: '#3b82f6',
    general: { height: 163, weight: 60, shoeSize: 39, handLength: 16.8,
      armLength: 65, legLength: 78, shoulderWidth: 38, bodyHair: 1 },
    sensitive: { sensitiveLength: 10.5, sensitiveCircumference: 9.5 },
    history: {},
  },
  ref_average: {
    id: 'ref_average', name: 'Referenz: Durchschnitt', isReference: true,
    color: '#10b981',
    general: { height: 175, weight: 76, shoeSize: 42, handLength: 18.5,
      armLength: 72, legLength: 85, shoulderWidth: 43, bodyHair: 2 },
    sensitive: { sensitiveLength: 13.5, sensitiveCircumference: 11.5 },
    history: {},
  },
  ref_large: {
    id: 'ref_large', name: 'Referenz: Groß', isReference: true,
    color: '#f59e0b',
    general: { height: 188, weight: 90, shoeSize: 46, handLength: 21.0,
      armLength: 79, legLength: 93, shoulderWidth: 47, bodyHair: 4 },
    sensitive: { sensitiveLength: 17.0, sensitiveCircumference: 13.5 },
    history: {},
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL-FACTORY
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f97316',
  '#8b5cf6', '#06b6d4', '#84cc16', '#ef4444',
];
let _colorIdx = 0;

function generateProfileColor() {
  return PROFILE_COLORS[(_colorIdx++) % PROFILE_COLORS.length];
}

function createProfile(name) {
  return {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: name || 'Neues Profil',
    isReference: false,
    color: generateProfileColor(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    general: {
      height: null, weight: null, shoeSize: null, handLength: null,
      armLength: null, legLength: null, shoulderWidth: null, bodyHair: null,
    },
    sensitive: {
      sensitiveLength: null, sensitiveCircumference: null,
    },
    history: {
      // field -> [{ value: number, date: timestamp, note: string }]
    },
  };
}

/**
 * Fügt einem Profil einen historischen Messwert hinzu.
 */
function addHistoryEntry(profile, field, value, date = Date.now(), note = '') {
  if (!profile.history[field]) profile.history[field] = [];
  profile.history[field].push({ value, date, note });
  profile.history[field].sort((a, b) => a.date - b.date);
}

/**
 * Gibt den aktuellsten Wert eines Felds zurück (aus history oder direkt).
 */
function getCurrentValue(profile, field, category = 'general') {
  const hist = profile.history[field];
  if (hist && hist.length > 0) return hist[hist.length - 1].value;
  return category === 'general' ? profile.general[field] : profile.sensitive[field];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY-DATEN-STRUKTUR (Vorbereitung für spätere Erweiterung)
// In der MVP-Version keine echte Datensammlung.
// ─────────────────────────────────────────────────────────────────────────────

const COMMUNITY = {
  _note: 'Platzhalter. MVP: keine echte Datensammlung. Für spätere anonymisierte Community-Integration vorbereitet.',
  enabled: false,
  // Später: aggregierte Verteilungsdaten nach Feldern
  aggregates: null,
  // Später: anonymisierte Einträge für Rankings
  entries: [],
};
