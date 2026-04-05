/**
 * sizing.js – Kondomgrößen-Orientierungslogik
 *
 * WICHTIGER HINWEIS:
 * Diese Berechnungen dienen ausschließlich als Orientierungshilfe.
 * Sie sind KEIN medizinischer Rat und ersetzen keine Fachberatung.
 * Alle Größenangaben und Schwellenwerte sind Demo-/Platzhalterwerte.
 * Die Struktur ist modular – echte Herstellerdaten können später integriert werden.
 *
 * Grundlage der Berechnung:
 * - Primärer Parameter: Umfang (Circumference) → bestimmt die Nominalbreite (NW)
 * - Nominalbreite = Umfang / 2 (aufgefaltetes Kondom liegt flach)
 * - Sekundärer Parameter: Länge → beeinflusst Empfehlung für Kondomlänge
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// KONDOMGROSSEN-DATENBANK
// Alle Angaben sind Demo-Platzhalterwerte (ISO-angelehnt, approximiert).
// Quelle: angelehnt an ISO 4074 / branchenübliche Nominalbreiten (DEMO)
// ─────────────────────────────────────────────────────────────────────────────

const CONDOM_SIZES = [
  {
    id: 'snug',
    label: 'Eng / Snug Fit',
    nominalWidthMm: { min: 44, max: 47 },           // Nominalbreite in mm
    circumferenceCm: { min: 8.8, max: 9.4 },        // Entsprechender Umfang in cm
    lengthMm: { typical: 160, min: 150 },            // Kondomlänge in mm
    description: 'Für unterdurchschnittlichen Umfang. Sitzt eng und sicher.',
    note: 'DEMO-Wert',
  },
  {
    id: 'small',
    label: 'Klein',
    nominalWidthMm: { min: 47, max: 49 },
    circumferenceCm: { min: 9.4, max: 9.8 },
    lengthMm: { typical: 170, min: 160 },
    description: 'Für leicht unterdurchschnittlichen Umfang.',
    note: 'DEMO-Wert',
  },
  {
    id: 'regular',
    label: 'Standard / Regular',
    nominalWidthMm: { min: 49, max: 54 },
    circumferenceCm: { min: 9.8, max: 10.8 },
    lengthMm: { typical: 180, min: 170 },
    description: 'Passt für den Großteil der Menschen. Häufigste Größe.',
    note: 'DEMO-Wert',
  },
  {
    id: 'large',
    label: 'Groß / Large',
    nominalWidthMm: { min: 54, max: 57 },
    circumferenceCm: { min: 10.8, max: 11.4 },
    lengthMm: { typical: 185, min: 175 },
    description: 'Für überdurchschnittlichen Umfang.',
    note: 'DEMO-Wert',
  },
  {
    id: 'xl',
    label: 'XL',
    nominalWidthMm: { min: 57, max: 60 },
    circumferenceCm: { min: 11.4, max: 12.0 },
    lengthMm: { typical: 190, min: 180 },
    description: 'Für deutlich überdurchschnittlichen Umfang.',
    note: 'DEMO-Wert',
  },
  {
    id: 'xxl',
    label: 'XXL',
    nominalWidthMm: { min: 60, max: 65 },
    circumferenceCm: { min: 12.0, max: 13.0 },
    lengthMm: { typical: 200, min: 190 },
    description: 'Für sehr großen Umfang.',
    note: 'DEMO-Wert',
  },
  {
    id: 'xxxl',
    label: 'XXXL',
    nominalWidthMm: { min: 65, max: 99 },
    circumferenceCm: { min: 13.0, max: 99 },
    lengthMm: { typical: 210, min: 200 },
    description: 'Für außergewöhnlich großen Umfang. Spezialisierte Anbieter empfohlen.',
    note: 'DEMO-Wert',
  },
];

// Längenkategorien für Kondomlänge
const LENGTH_CATEGORIES = [
  { id: 'short',    label: 'Kurz',          maxCm: 11,   lengthMm: 160, note: 'Kürzere Kondome / Kurzkondome' },
  { id: 'standard', label: 'Standard',      maxCm: 16,   lengthMm: 180, note: 'Standardlänge (häufigste Variante)' },
  { id: 'long',     label: 'Lang',          maxCm: 19,   lengthMm: 190, note: 'Längere Kondome verfügbar' },
  { id: 'extra',    label: 'Extra lang',    maxCm: 99,   lengthMm: 200, note: 'Extralange Kondome, spezialisierte Anbieter' },
];

// ─────────────────────────────────────────────────────────────────────────────
// KERNBERECHNUNG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet die Nominalbreite in mm aus Umfang in cm.
 * Formel: NW = (Umfang / 2) * 10  [cm → mm, Kondom flach gefaltet = halber Umfang]
 */
function calcNominalWidth(circumferenceCm) {
  return (circumferenceCm / 2) * 10; // in mm
}

/**
 * Ermittelt passende Kondomgröße(n) basierend auf Nominalbreite.
 * Gibt primäre Empfehlung + ggf. Grenzfall-Hinweis zurück.
 */
function findSizesByNominalWidth(nwMm) {
  const matches = CONDOM_SIZES.filter(s =>
    nwMm >= s.nominalWidthMm.min && nwMm <= s.nominalWidthMm.max
  );

  // Prüfen ob nahe an einer Grenze (±1 mm)
  const borderline = [];
  for (let i = 0; i < CONDOM_SIZES.length - 1; i++) {
    const upper = CONDOM_SIZES[i].nominalWidthMm.max;
    if (Math.abs(nwMm - upper) <= 1) {
      borderline.push({ smaller: CONDOM_SIZES[i], larger: CONDOM_SIZES[i + 1] });
    }
  }

  return { matches, borderline };
}

/**
 * Bestimmt die Längenkategorie basierend auf Länge in cm.
 */
function getLengthCategory(lengthCm) {
  for (const cat of LENGTH_CATEGORIES) {
    if (lengthCm <= cat.maxCm) return cat;
  }
  return LENGTH_CATEGORIES[LENGTH_CATEGORIES.length - 1];
}

/**
 * Hauptfunktion: Vollständige Kondomgrößen-Empfehlung.
 *
 * @param {number|null} circumferenceCm - Umfang in cm
 * @param {number|null} lengthCm        - Länge in cm
 * @returns {object} Empfehlungsobjekt mit Begründung
 */
function calculateCondomRecommendation(circumferenceCm, lengthCm) {
  if (circumferenceCm === null || circumferenceCm === undefined) {
    return { error: 'Umfang nicht eingegeben. Der Umfang ist der primäre Parameter für die Größenempfehlung.' };
  }

  const nwMm = calcNominalWidth(circumferenceCm);
  const { matches, borderline } = findSizesByNominalWidth(nwMm);

  // Primäre Größenempfehlung
  const primary = matches.length > 0 ? matches : findNearestSize(nwMm);
  const sizeRange = primary.length > 1
    ? `${primary[0].label} – ${primary[primary.length - 1].label}`
    : primary[0]?.label ?? '–';

  // Längenempfehlung (optional)
  let lengthRec = null;
  if (lengthCm !== null && lengthCm !== undefined) {
    lengthRec = getLengthCategory(lengthCm);
  }

  // Einfluss der Eingaben erklären
  const influences = [
    {
      factor: 'Umfang',
      value: `${circumferenceCm.toFixed(1)} cm`,
      impact: 'Primär – bestimmt die Nominalbreite (NW)',
      detail: `Nominalbreite ≈ ${nwMm.toFixed(0)} mm (Umfang ÷ 2)`,
      weight: 'hoch',
    },
  ];
  if (lengthCm) {
    influences.push({
      factor: 'Länge',
      value: `${lengthCm.toFixed(1)} cm`,
      impact: 'Sekundär – beeinflusst Längenempfehlung',
      detail: `Kategorie: ${lengthRec?.label ?? '–'}`,
      weight: 'mittel',
    });
  }

  // Grenzfall-Hinweis
  let borderlineHint = null;
  if (borderline.length > 0) {
    const b = borderline[0];
    borderlineHint = `Ihr Wert liegt nahe der Grenze zwischen "${b.smaller.label}" ` +
      `und "${b.larger.label}". Empfehlung: Beide Größen ausprobieren, da individuelle ` +
      `Passform stark variieren kann.`;
  }

  // Zusammenfassung aufbauen
  const recommendation = {
    // Rohdaten
    circumferenceCm,
    lengthCm,
    nominalWidthMm: nwMm,

    // Empfehlungen
    primarySizes: primary,
    sizeRange,
    lengthCategory: lengthRec,

    // Erklärung
    influences,
    borderlineHint,
    isBorderline: borderline.length > 0,

    // Interpretation
    summary: buildSummary(primary, lengthRec, nwMm, borderline),

    // Rechtlicher Hinweis
    disclaimer: 'Diese Empfehlung ist eine unverbindliche Orientierungshilfe auf Basis von Demo-Referenzwerten. ' +
      'Individuelle Passform kann variieren. Keine medizinische Aussage.',
    dataNote: 'Alle Größenschwellen sind Demo-Platzhalterwerte (angelehnt an ISO 4074, approximiert).',
  };

  return recommendation;
}

function findNearestSize(nwMm) {
  // Nächstgelegene Größe finden falls genau zwischen zwei Kategorien
  let nearest = CONDOM_SIZES[0];
  let minDist = Infinity;
  for (const s of CONDOM_SIZES) {
    const center = (s.nominalWidthMm.min + s.nominalWidthMm.max) / 2;
    const dist = Math.abs(nwMm - center);
    if (dist < minDist) { minDist = dist; nearest = s; }
  }
  return [nearest];
}

function buildSummary(primary, lengthRec, nwMm, borderline) {
  const sizeLabel = primary.map(s => s.label).join(' oder ');
  let text = `Basierend auf der berechneten Nominalbreite von ${nwMm.toFixed(0)} mm ` +
    `wird die Kondomgröße "${sizeLabel}" empfohlen.`;

  if (lengthRec) {
    text += ` Für die Länge ist eine ${lengthRec.label.toLowerCase()}e Variante geeignet.`;
  }
  if (borderline.length > 0) {
    text += ' Der Wert liegt nahe einer Größengrenze – beide angrenzenden Größen können sinnvoll sein.';
  }
  return text;
}

/**
 * Gibt alle Größen als Übersichtstabelle zurück (für Vergleichsdarstellung).
 */
function getAllCondomSizes() {
  return CONDOM_SIZES;
}

/**
 * Berechnet für ein einzelnes Profil (mit sensitiven Daten) die Empfehlung.
 */
function getRecommendationForProfile(profile) {
  const c = profile.sensitive?.sensitiveCircumference;
  const l = profile.sensitive?.sensitiveLength;
  return calculateCondomRecommendation(c, l);
}
