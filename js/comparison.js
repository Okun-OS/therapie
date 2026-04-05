/**
 * comparison.js – Vergleichslogik, Perzentil-Berechnung, Kategorisierung
 *
 * Alle Berechnungen basieren auf den Demo-Referenzdaten aus data.js.
 * Keine medizinische Aussagekraft.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PERZENTIL & KLASSIFIZIERUNG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet den Perzentilwert per linearer Interpolation zwischen bekannten Stützpunkten.
 * @param {number} value - Messwert
 * @param {object} ref   - Referenzdaten-Objekt (mit min, p10, p25, avg, p75, p90, max)
 * @returns {number} Perzentil 0–100
 */
function calculatePercentile(value, ref) {
  if (value === null || value === undefined || !ref) return null;

  // Stützpunkte: [Wert, Perzentil]
  const pts = [
    [ref.min,  0],
    [ref.p10, 10],
    [ref.p25, 25],
    [ref.avg, 50],
    [ref.p75, 75],
    [ref.p90, 90],
    [ref.max, 100],
  ].filter(([v]) => v !== null && v !== undefined);

  if (value <= pts[0][0]) return 0;
  if (value >= pts[pts.length - 1][0]) return 100;

  for (let i = 0; i < pts.length - 1; i++) {
    const [v0, p0] = pts[i];
    const [v1, p1] = pts[i + 1];
    if (value >= v0 && value <= v1) {
      const t = (value - v0) / (v1 - v0);
      return Math.round(p0 + t * (p1 - p0));
    }
  }
  return 50;
}

/**
 * Wandelt einen Perzentilwert in eine kontextualisierte Kategorie um.
 * @returns {{ category, label, contextLabel, band }}
 */
function categorizePct(percentile, value, ref) {
  const t = ref.thresholds;
  let category, label, contextLabel, band;

  if (value < t.small) {
    category = 'below';
    label = 'unterdurchschnittlich';
    band = 'low';
    if (percentile <= 5)  contextLabel = 'sehr weit unter dem Durchschnitt';
    else if (percentile <= 15) contextLabel = 'deutlich unter dem Durchschnitt';
    else contextLabel = 'leicht unter dem Durchschnitt';
  } else if (value > t.large) {
    category = 'above';
    label = 'überdurchschnittlich';
    band = 'high';
    if (percentile >= 95) contextLabel = 'sehr weit über dem Durchschnitt';
    else if (percentile >= 85) contextLabel = 'deutlich über dem Durchschnitt';
    else contextLabel = 'leicht über dem Durchschnitt';
  } else {
    category = 'average';
    label = 'durchschnittlich';
    band = 'mid';
    if (percentile >= 45 && percentile <= 55) contextLabel = 'nahe am Mittelwert';
    else if (percentile > 55) contextLabel = 'oberes Mittelfeld';
    else contextLabel = 'unteres Mittelfeld';
  }

  return { category, label, contextLabel, band };
}

/**
 * Vollständige Einordnung eines Einzelwerts gegen Referenz.
 */
function classifyValue(value, field, dataCategory = 'general') {
  const ref = REFERENCE_DATA[dataCategory]?.[field];
  if (!ref || value === null || value === undefined) return null;

  const percentile = calculatePercentile(value, ref);
  const cat = categorizePct(percentile, value, ref);

  return {
    value, field, percentile, ref,
    ...cat,
    // Differenzen zu Referenzpunkten
    diffToAvg:   diffValues(value, ref.avg,           field),
    diffToSmall: diffValues(value, ref.thresholds.small, field),
    diffToLarge: diffValues(value, ref.thresholds.large, field),
    diffToP25:   diffValues(value, ref.p25,            field),
    diffToP75:   diffValues(value, ref.p75,            field),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIFFERENZ-BERECHNUNG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet absolute und prozentuale Differenz zweier Werte.
 */
function diffValues(a, b, field) {
  if (a === null || b === null || a === undefined || b === undefined) return null;
  const cfg = MEASUREMENT_CONFIG[field];
  const diff = a - b;
  const pct  = b !== 0 ? (diff / b) * 100 : 0;
  const sign = diff > 0 ? '+' : '';
  const dec  = cfg?.decimals ?? 1;

  let desc;
  if (Math.abs(diff) < Math.pow(10, -dec) / 2) {
    desc = 'identisch';
  } else {
    desc = `${sign}${diff.toFixed(dec)} ${cfg?.unit ?? ''} (${sign}${pct.toFixed(1)} %)`;
  }

  return { diff, absDiff: Math.abs(diff), pct, absPct: Math.abs(pct),
           direction: diff > 0 ? 'higher' : diff < 0 ? 'lower' : 'equal', desc };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL-VERGLEICH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vergleicht mehrere Profile für ein einzelnes Feld.
 * Gibt sortierte Einträge mit Rang, Perzentil und Differenzen zurück.
 *
 * @param {object[]} profiles     - Array von Profilen (inkl. Referenzprofilen)
 * @param {string}   field        - Messfeld
 * @param {string}   dataCategory - 'general' | 'sensitive'
 * @returns {object|null}
 */
function compareProfiles(profiles, field, dataCategory = 'general') {
  const cfg = MEASUREMENT_CONFIG[field];
  const ref = REFERENCE_DATA[dataCategory]?.[field];

  // Werte extrahieren
  const entries = profiles.map(p => {
    const value = dataCategory === 'general'
      ? p.general[field]
      : p.sensitive[field];
    if (value === null || value === undefined) return null;

    const percentile = ref ? calculatePercentile(value, ref) : null;
    const cat        = (ref && percentile !== null) ? categorizePct(percentile, value, ref) : {};

    return {
      profileId:   p.id,
      profileName: p.name,
      color:       p.color,
      isReference: p.isReference || false,
      value,
      percentile,
      ...cat,
    };
  }).filter(Boolean);

  if (entries.length === 0) return null;

  // Rangfolge (höchster Wert = Rang 1)
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  entries.forEach(e => {
    e.rank   = sorted.findIndex(s => s.profileId === e.profileId) + 1;
    e.rankOf = entries.length;
  });

  const values = entries.map(e => e.value);

  return {
    field, cfg, ref,
    entries,
    stats: {
      max: Math.max(...values),
      min: Math.min(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      range: Math.max(...values) - Math.min(...values),
    },
    pairwiseDiffs: computePairwiseDiffs(entries, field),
  };
}

/**
 * Alle paarweisen Differenzen innerhalb einer Eintragsliste.
 */
function computePairwiseDiffs(entries, field) {
  const result = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      result.push({
        a: entries[i],
        b: entries[j],
        ...diffValues(entries[i].value, entries[j].value, field),
      });
    }
  }
  return result;
}

/**
 * Vergleich: Einzelprofil gegen Gruppenducht (mehrere Profile gemittelt).
 */
function groupVsSingle(groupProfiles, singleProfile, field, dataCategory = 'general') {
  const getVal = p => dataCategory === 'general' ? p.general[field] : p.sensitive[field];

  const groupVals = groupProfiles.map(getVal).filter(v => v !== null && v !== undefined);
  if (groupVals.length === 0) return null;

  const groupAvg = groupVals.reduce((a, b) => a + b, 0) / groupVals.length;
  const singleVal = getVal(singleProfile);

  return {
    groupAvg, groupVals,
    groupProfiles: groupProfiles.map(p => ({ id: p.id, name: p.name, value: getVal(p) })),
    singleValue: singleVal,
    singleProfile: { id: singleProfile.id, name: singleProfile.name },
    diff: singleVal !== null ? diffValues(singleVal, groupAvg, field) : null,
  };
}

/**
 * Vollständiger Vergleich aller Felder einer Kategorie für gegebene Profile.
 */
function fullComparison(profiles, dataCategory = 'general') {
  const fields = Object.keys(MEASUREMENT_CONFIG)
    .filter(f => MEASUREMENT_CONFIG[f].category === dataCategory);

  const result = {};
  for (const field of fields) {
    result[field] = compareProfiles(profiles, field, dataCategory);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKINGS (für Fun-Bereich)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Erstellt ein Ranking aller Profile für ein Feld.
 * Gibt Top-N (höchste) und Bottom-N (niedrigste) zurück.
 * Extrembereiche: obere/untere 10 % basierend auf Referenzperzentil.
 */
function buildRanking(profiles, field, dataCategory = 'general') {
  const result = compareProfiles(profiles, field, dataCategory);
  if (!result) return null;

  const ref = REFERENCE_DATA[dataCategory]?.[field];
  const p10th  = ref ? ref.p10 : null;
  const p90th  = ref ? ref.p90 : null;

  const annotated = result.entries.map(e => ({
    ...e,
    isTop10pct:    p90th !== null && e.value >= p90th,
    isBottom10pct: p10th !== null && e.value <= p10th,
  }));

  return {
    field,
    cfg: result.cfg,
    ref,
    ranked: annotated.sort((a, b) => b.value - a.value),
    stats: result.stats,
  };
}

/**
 * Findet die Position eines Profils in einem Ranking.
 */
function getProfileRankPosition(profileId, ranking) {
  if (!ranking) return null;
  const idx = ranking.ranked.findIndex(e => e.profileId === profileId);
  if (idx === -1) return null;
  return {
    rank: idx + 1,
    total: ranking.ranked.length,
    percentile: ranking.ranked[idx].percentile,
    entry: ranking.ranked[idx],
  };
}
