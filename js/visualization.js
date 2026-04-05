/**
 * visualization.js – SVG-basierte Visualisierungskomponenten
 *
 * Alle Darstellungen sind abstrakt und neutral.
 * Kein fotorealistischer oder expliziter Inhalt.
 *
 * Enthält:
 *  - ScaleChart     : Lineare Skala mit Markern, Referenzbändern, Verbindungslinien
 *  - BarChart       : Horizontale Balken mit Referenzkontext
 *  - BodyFigure     : Proportionale Silhouette-Figur (allgemeine Daten)
 *  - BodyComparison : Mehrere Figuren auf gemeinsamer Basislinie
 *  - AbstractShape  : Abstrahierte Form (sensibler Bereich, nur Länge/Umfang als Ellipse)
 *  - HistoryChart   : Zeitlicher Verlauf als Linienchart
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SVG-Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const child of children) {
    if (typeof child === 'string') el.textContent = child;
    else el.appendChild(child);
  }
  return el;
}

function makeSvg(w, h, extra = {}) {
  return svgEl('svg', {
    viewBox: `0 0 ${w} ${h}`,
    width: '100%',
    preserveAspectRatio: 'xMidYMid meet',
    ...extra,
  });
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Wert auf Pixelposition auf Achse mappen
function valueToX(value, domainMin, domainMax, xMin, xMax) {
  const t = (value - domainMin) / (domainMax - domainMin);
  return xMin + clamp(t, 0, 1) * (xMax - xMin);
}

// ─────────────────────────────────────────────────────────────────────────────
// FARBPALETTE
// ─────────────────────────────────────────────────────────────────────────────

const VIZ_COLORS = {
  bandLow:  '#fee2e2',   // Unterbereich (rosa)
  bandMid:  '#d1fae5',   // Durchschnittsbereich (grün)
  bandHigh: '#dbeafe',   // Oberbereich (blau)
  avgLine:  '#10b981',
  gridLine: '#e5e7eb',
  text:     '#374151',
  textMuted:'#9ca3af',
  bg:       '#f9fafb',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. SCALE CHART
//    Horizontale Skala mit Farbzonen, Referenzmarkern und Profilmarkern.
//    Verbindungslinien zwischen Profilen zeigen Differenz direkt.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} options
 *   field, entries (vergleichsresultat aus comparison.js),
 *   ref (Referenzdaten), cfg (MEASUREMENT_CONFIG-Eintrag),
 *   width, height, showConnectors
 */
function renderScaleChart(container, options) {
  const {
    field, entries = [], ref, cfg,
    width = 600, height = 130,
    showConnectors = true,
  } = options;

  container.innerHTML = '';
  if (!entries.length || !ref) return;

  const svg = makeSvg(width, height);
  const PAD = { l: 40, r: 40, t: 40, b: 30 };
  const xMin = PAD.l, xMax = width - PAD.r;
  const axisY = height - PAD.b;

  // Domäne mit etwas Rand
  const domMin = ref.min - (ref.max - ref.min) * 0.04;
  const domMax = ref.max + (ref.max - ref.min) * 0.04;
  const toX = v => valueToX(v, domMin, domMax, xMin, xMax);

  // ── Hintergrundbänder ──
  const bands = [
    { from: domMin,            to: ref.thresholds.small, fill: VIZ_COLORS.bandLow,  label: 'unter Ø' },
    { from: ref.thresholds.small, to: ref.thresholds.large, fill: VIZ_COLORS.bandMid,  label: 'Ø' },
    { from: ref.thresholds.large, to: domMax,             fill: VIZ_COLORS.bandHigh, label: 'über Ø' },
  ];
  for (const b of bands) {
    svg.appendChild(svgEl('rect', {
      x: toX(b.from), y: PAD.t - 18,
      width: Math.max(0, toX(b.to) - toX(b.from)),
      height: axisY - (PAD.t - 18),
      fill: b.fill, rx: 3,
    }));
  }

  // ── Achse ──
  svg.appendChild(svgEl('line', {
    x1: xMin, y1: axisY, x2: xMax, y2: axisY,
    stroke: '#9ca3af', 'stroke-width': 1.5,
  }));

  // ── Achsen-Ticks & Labels ──
  const tickValues = [ref.min, ref.p10, ref.p25, ref.avg, ref.p75, ref.p90, ref.max];
  const uniq = [...new Set(tickValues)].sort((a, b) => a - b);
  for (const tv of uniq) {
    const x = toX(tv);
    svg.appendChild(svgEl('line', { x1: x, y1: axisY, x2: x, y2: axisY + 5, stroke: '#9ca3af', 'stroke-width': 1 }));
    svg.appendChild(svgEl('text', {
      x, y: axisY + 14, 'text-anchor': 'middle',
      'font-size': '9', fill: VIZ_COLORS.textMuted,
    }, [`${tv}`]));
  }

  // ── Referenzmarker: Durchschnitt ──
  const avgX = toX(ref.avg);
  svg.appendChild(svgEl('line', {
    x1: avgX, y1: PAD.t - 18, x2: avgX, y2: axisY,
    stroke: VIZ_COLORS.avgLine, 'stroke-width': 1.5, 'stroke-dasharray': '4 3',
  }));
  svg.appendChild(svgEl('text', {
    x: avgX, y: PAD.t - 21, 'text-anchor': 'middle',
    'font-size': '9', fill: VIZ_COLORS.avgLine, 'font-weight': '600',
  }, ['Ø']));

  // ── Verbindungslinien zwischen Profilen (Differenz sichtbar) ──
  if (showConnectors && entries.length >= 2) {
    const lineY = axisY - 22;
    for (let i = 0; i < entries.length - 1; i++) {
      const ax = toX(entries[i].value);
      const bx = toX(entries[i + 1].value);
      const midX = (ax + bx) / 2;
      svg.appendChild(svgEl('line', {
        x1: ax, y1: lineY, x2: bx, y2: lineY,
        stroke: '#94a3b8', 'stroke-width': 1.2, 'stroke-dasharray': '3 2',
      }));
      const dv = Math.abs(entries[i].value - entries[i + 1].value);
      svg.appendChild(svgEl('text', {
        x: midX, y: lineY - 5, 'text-anchor': 'middle',
        'font-size': '9', fill: '#64748b',
      }, [`Δ ${dv.toFixed(cfg?.decimals ?? 1)} ${cfg?.unit ?? ''}`]));
    }
  }

  // ── Profil-Marker ──
  const markerY = axisY - 8;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const x = toX(e.value);

    // Dreieck-Marker
    const markerH = 10;
    const pts = `${x},${markerY - markerH} ${x - 6},${markerY + 2} ${x + 6},${markerY + 2}`;
    svg.appendChild(svgEl('polygon', { points: pts, fill: e.color }));

    // Wert-Label
    const labelY = i % 2 === 0 ? PAD.t - 5 : PAD.t + 6;
    svg.appendChild(svgEl('text', {
      x, y: labelY, 'text-anchor': 'middle',
      'font-size': '10', fill: e.color, 'font-weight': '600',
    }, [`${e.value.toFixed(cfg?.decimals ?? 1)}`]));

    // Name-Label
    svg.appendChild(svgEl('text', {
      x, y: labelY - 11, 'text-anchor': 'middle',
      'font-size': '9', fill: e.color,
    }, [e.profileName.length > 8 ? e.profileName.slice(0, 8) + '…' : e.profileName]));
  }

  // ── Einheit rechts ──
  if (cfg?.unit) {
    svg.appendChild(svgEl('text', {
      x: xMax + 5, y: axisY + 4, 'text-anchor': 'start',
      'font-size': '9', fill: VIZ_COLORS.textMuted,
    }, [cfg.unit]));
  }

  container.appendChild(svg);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BAR CHART
//    Horizontale Balken, ein Balken pro Profil, mit Referenzlinie.
// ─────────────────────────────────────────────────────────────────────────────

function renderBarChart(container, options) {
  const {
    entries = [], ref, cfg,
    width = 500, showAvgLine = true,
  } = options;

  container.innerHTML = '';
  if (!entries.length || !ref) return;

  const barH = 22, gap = 10;
  const PAD = { l: 90, r: 60, t: 10, b: 10 };
  const totalH = PAD.t + entries.length * (barH + gap) + PAD.b;
  const svg = makeSvg(width, totalH);

  const xMin = PAD.l, xMax = width - PAD.r;
  const domMax = ref.max * 1.05;
  const toX = v => valueToX(v, 0, domMax, xMin, xMax);
  const avgX = toX(ref.avg);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const y = PAD.t + i * (barH + gap);
    const barW = Math.max(2, toX(e.value) - xMin);

    // Balken-Hintergrund (Gesamtbreite)
    svg.appendChild(svgEl('rect', { x: xMin, y, width: xMax - xMin, height: barH, fill: '#f3f4f6', rx: 3 }));
    // Farbiger Balken
    svg.appendChild(svgEl('rect', { x: xMin, y, width: barW, height: barH, fill: e.color, rx: 3, opacity: '0.85' }));

    // Profilname links
    const nameLabel = e.profileName.length > 12 ? e.profileName.slice(0, 12) + '…' : e.profileName;
    svg.appendChild(svgEl('text', {
      x: xMin - 5, y: y + barH / 2 + 4,
      'text-anchor': 'end', 'font-size': '11', fill: VIZ_COLORS.text,
    }, [nameLabel]));

    // Wert rechts
    svg.appendChild(svgEl('text', {
      x: xMin + barW + 5, y: y + barH / 2 + 4,
      'text-anchor': 'start', 'font-size': '11', fill: e.color, 'font-weight': '600',
    }, [`${e.value.toFixed(cfg?.decimals ?? 1)} ${cfg?.unit ?? ''}`]));
  }

  // Durchschnittslinie
  if (showAvgLine) {
    svg.appendChild(svgEl('line', {
      x1: avgX, y1: PAD.t - 5,
      x2: avgX, y2: PAD.t + entries.length * (barH + gap) - gap + 5,
      stroke: VIZ_COLORS.avgLine, 'stroke-width': 1.5, 'stroke-dasharray': '4 3',
    }));
    svg.appendChild(svgEl('text', {
      x: avgX, y: PAD.t - 7, 'text-anchor': 'middle',
      'font-size': '9', fill: VIZ_COLORS.avgLine,
    }, [`Ø ${ref.avg}`]));
  }

  container.appendChild(svg);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BODY FIGURE (allgemeine Körperdaten)
//    Abstrakte Silhouette: Kreis (Kopf) + Ellipse (Rumpf) + Linien (Arme, Beine)
//    Proportional zur eingegebenen Körpergröße skaliert.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zeichnet eine einzelne abstrakte Körperfigur.
 * height_cm → Gesamthöhe der Figur
 * shoulderWidth_cm → Schulterbreite (relativ skaliert)
 * legLength_cm, armLength_cm → Proportionen
 */
function drawBodyFigure(svg, profile, cx, baseY, scale, color) {
  const g = profile.general;
  const h       = (g.height       || 175) * scale;
  const sw      = (g.shoulderWidth || 43)  * scale * 0.9;
  const legL    = (g.legLength    || 85)  * scale;
  const armL    = (g.armLength    || 72)  * scale;

  const headR   = h * 0.09;
  const torsoH  = h * 0.30;
  const torsoW  = sw * 0.5;

  const headY   = baseY - h;
  const shoulderY = headY + headR * 2 + h * 0.02;
  const hipY    = shoulderY + torsoH;
  const feetY   = baseY;
  const handY   = shoulderY + armL * 0.9;

  const group = svgEl('g', { class: 'body-figure' });

  // Kopf
  group.appendChild(svgEl('circle', {
    cx, cy: headY + headR, r: headR,
    fill: 'none', stroke: color, 'stroke-width': 1.8,
  }));

  // Rumpf
  group.appendChild(svgEl('ellipse', {
    cx, cy: shoulderY + torsoH / 2,
    rx: torsoW, ry: torsoH / 2,
    fill: color, opacity: '0.15', stroke: color, 'stroke-width': 1.5,
  }));

  // Arme
  group.appendChild(svgEl('line', {
    x1: cx - torsoW, y1: shoulderY,
    x2: cx - torsoW * 1.3, y2: handY,
    stroke: color, 'stroke-width': 1.8, 'stroke-linecap': 'round',
  }));
  group.appendChild(svgEl('line', {
    x1: cx + torsoW, y1: shoulderY,
    x2: cx + torsoW * 1.3, y2: handY,
    stroke: color, 'stroke-width': 1.8, 'stroke-linecap': 'round',
  }));

  // Beine
  group.appendChild(svgEl('line', {
    x1: cx - torsoW * 0.4, y1: hipY,
    x2: cx - torsoW * 0.5, y2: feetY,
    stroke: color, 'stroke-width': 1.8, 'stroke-linecap': 'round',
  }));
  group.appendChild(svgEl('line', {
    x1: cx + torsoW * 0.4, y1: hipY,
    x2: cx + torsoW * 0.5, y2: feetY,
    stroke: color, 'stroke-width': 1.8, 'stroke-linecap': 'round',
  }));

  // Name-Label
  group.appendChild(svgEl('text', {
    x: cx, y: baseY + 14, 'text-anchor': 'middle',
    'font-size': '11', fill: color, 'font-weight': '600',
  }, [profile.name.length > 10 ? profile.name.slice(0, 10) + '…' : profile.name]));

  // Größe-Label
  if (g.height) {
    group.appendChild(svgEl('text', {
      x: cx, y: baseY + 26, 'text-anchor': 'middle',
      'font-size': '10', fill: VIZ_COLORS.textMuted,
    }, [`${g.height} cm`]));
  }

  svg.appendChild(group);
}

/**
 * Zeichnet mehrere Körperfiguren auf gemeinsamer Basislinie (Vergleich).
 */
function renderBodyComparison(container, profiles) {
  container.innerHTML = '';
  const validProfiles = profiles.filter(p => p.general?.height);
  if (!validProfiles.length) return;

  const heights = validProfiles.map(p => p.general.height);
  const maxH = Math.max(...heights);
  const figH = 220;
  const scale = figH / maxH;
  const figW = Math.max(80, 110);
  const totalW = validProfiles.length * figW + 40;
  const svgH = figH + 60;

  const svg = makeSvg(totalW, svgH);

  // Basislinie
  svg.appendChild(svgEl('line', {
    x1: 10, y1: figH + 5, x2: totalW - 10, y2: figH + 5,
    stroke: VIZ_COLORS.gridLine, 'stroke-width': 1,
  }));

  validProfiles.forEach((profile, i) => {
    const cx = 20 + i * figW + figW / 2;
    drawBodyFigure(svg, profile, cx, figH + 5, scale, profile.color);
  });

  container.appendChild(svg);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ABSTRACT SHAPE (sensitiver Bereich)
//    Zeigt Länge und Umfang als abstrakte Ellipse – keinerlei realistische Darstellung.
//    Rein funktional: Unterschiede in Länge und Verhältnis erkennbar machen.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zeichnet eine abstrakte Ellipse, bei der
 *   - Höhe  ∝ Länge (sensitiveLength)
 *   - Breite ∝ Umfang / (2π)  → Durchmesser
 *
 * Keine fotorealistischen Details. Rein proportionale Form für Vergleich.
 */
function drawAbstractShape(svg, entry, cx, baseY, lengthScale, color, label) {
  const length = entry.length || 10;
  const circ   = entry.circumference || 10;
  const diameter = circ / Math.PI; // Näherung Durchmesser

  const displayH = length * lengthScale;
  const displayW = diameter * lengthScale * 1.5;

  const group = svgEl('g');

  // Hauptform
  group.appendChild(svgEl('ellipse', {
    cx, cy: baseY - displayH / 2,
    rx: Math.max(4, displayW / 2),
    ry: Math.max(4, displayH / 2),
    fill: color, opacity: '0.2',
    stroke: color, 'stroke-width': 1.8,
  }));

  // Längen-Linie (Hilfsmarkierung)
  group.appendChild(svgEl('line', {
    x1: cx, y1: baseY,
    x2: cx, y2: baseY - displayH,
    stroke: color, 'stroke-width': 1, 'stroke-dasharray': '3 2', opacity: '0.5',
  }));

  // Label
  group.appendChild(svgEl('text', {
    x: cx, y: baseY + 13,
    'text-anchor': 'middle', 'font-size': '10', fill: color, 'font-weight': '600',
  }, [label]));
  group.appendChild(svgEl('text', {
    x: cx, y: baseY + 24,
    'text-anchor': 'middle', 'font-size': '9', fill: VIZ_COLORS.textMuted,
  }, [`L: ${length.toFixed(1)} cm | U: ${circ.toFixed(1)} cm`]));

  svg.appendChild(group);
}

/**
 * Vergleich mehrerer abstrakter Formen auf einer gemeinsamen Achse.
 */
function renderAbstractComparison(container, entries) {
  container.innerHTML = '';
  const valid = entries.filter(e => e.length && e.circumference);
  if (!valid.length) return;

  const maxLen   = Math.max(...valid.map(e => e.length));
  const figH     = 160;
  const scale    = (figH * 0.8) / maxLen;
  const colW     = 110;
  const totalW   = valid.length * colW + 40;
  const svgH     = figH + 50;

  const svg = makeSvg(totalW, svgH);

  // Basislinie
  svg.appendChild(svgEl('line', {
    x1: 10, y1: figH, x2: totalW - 10, y2: figH,
    stroke: VIZ_COLORS.gridLine, 'stroke-width': 1,
  }));

  valid.forEach((e, i) => {
    const cx = 20 + i * colW + colW / 2;
    drawAbstractShape(svg, e, cx, figH, scale, e.color, e.label);
  });

  container.appendChild(svg);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MULTI-FELD ÜBERSICHT (synchronisierte Skalen untereinander)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zeichnet mehrere ScaleCharts untereinander – eine Skala pro Feld.
 * Gleiche Logik, einheitliche Darstellung für alle Merkmale.
 */
function renderMultiFieldOverview(container, comparisonResults, dataCategory = 'general') {
  container.innerHTML = '';
  const fields = Object.keys(comparisonResults).filter(f => comparisonResults[f] !== null);
  if (!fields.length) return;

  for (const field of fields) {
    const result = comparisonResults[field];
    if (!result) continue;

    const wrap = document.createElement('div');
    wrap.className = 'multi-field-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'multi-field-label';
    labelEl.textContent = MEASUREMENT_CONFIG[field]?.label ?? field;
    wrap.appendChild(labelEl);

    const chartEl = document.createElement('div');
    chartEl.className = 'multi-field-chart';
    renderScaleChart(chartEl, {
      field,
      entries: result.entries,
      ref: result.ref,
      cfg: result.cfg,
      width: 560,
      height: 110,
      showConnectors: result.entries.length >= 2,
    });
    wrap.appendChild(chartEl);

    container.appendChild(wrap);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. HISTORY CHART (Verlauf über Zeit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Einfaches Linien-Chart für Messverlauf.
 * Kleine Schwankungen werden als normal dargestellt.
 * Hinweis bei größeren Abweichungen (mögliche Messungenauigkeit).
 */
function renderHistoryChart(container, historyEntries, field, profileColor = '#6366f1') {
  container.innerHTML = '';
  if (!historyEntries || historyEntries.length < 2) {
    container.textContent = 'Mindestens 2 Einträge für Verlaufsansicht benötigt.';
    return;
  }

  const cfg = MEASUREMENT_CONFIG[field];
  const W = 500, H = 140;
  const PAD = { l: 50, r: 20, t: 20, b: 30 };
  const svg = makeSvg(W, H);

  const values = historyEntries.map(e => e.value);
  const dates  = historyEntries.map(e => e.date);
  const minV = Math.min(...values) * 0.95;
  const maxV = Math.max(...values) * 1.05;
  const minD = Math.min(...dates);
  const maxD = Math.max(...dates);

  const toX = d => valueToX(d, minD, maxD, PAD.l, W - PAD.r);
  const toY = v => H - PAD.b - ((v - minV) / (maxV - minV)) * (H - PAD.t - PAD.b);

  // Hintergrund
  svg.appendChild(svgEl('rect', { x: PAD.l, y: PAD.t, width: W - PAD.l - PAD.r, height: H - PAD.t - PAD.b, fill: '#f9fafb', rx: 3 }));

  // Gitternetz
  for (let p = 0; p <= 4; p++) {
    const y = PAD.t + p * (H - PAD.t - PAD.b) / 4;
    svg.appendChild(svgEl('line', { x1: PAD.l, y1: y, x2: W - PAD.r, y2: y, stroke: VIZ_COLORS.gridLine, 'stroke-width': 1 }));
    const v = maxV - p * (maxV - minV) / 4;
    svg.appendChild(svgEl('text', { x: PAD.l - 5, y: y + 4, 'text-anchor': 'end', 'font-size': '9', fill: VIZ_COLORS.textMuted }, [v.toFixed(cfg?.decimals ?? 1)]));
  }

  // Linie
  const pts = historyEntries.map(e => `${toX(e.date)},${toY(e.value)}`).join(' ');
  svg.appendChild(svgEl('polyline', {
    points: pts, fill: 'none',
    stroke: profileColor, 'stroke-width': 2, 'stroke-linejoin': 'round',
  }));

  // Punkte + Hinweis bei großer Abweichung
  const avgVal = values.reduce((a, b) => a + b, 0) / values.length;
  historyEntries.forEach((e, i) => {
    const x = toX(e.date), y = toY(e.value);
    const deviation = Math.abs(e.value - avgVal) / avgVal;
    const pointColor = deviation > 0.15 ? '#f59e0b' : profileColor;

    svg.appendChild(svgEl('circle', { cx: x, cy: y, r: 4, fill: pointColor, stroke: '#fff', 'stroke-width': 1.5 }));

    if (i === historyEntries.length - 1) {
      svg.appendChild(svgEl('text', { x: x + 6, y: y - 4, 'font-size': '10', fill: pointColor, 'font-weight': '600' },
        [`${e.value.toFixed(cfg?.decimals ?? 1)}`]));
    }

    // Hinweis auf mögliche Messungenauigkeit
    if (deviation > 0.15) {
      svg.appendChild(svgEl('text', { x, y: y - 10, 'text-anchor': 'middle', 'font-size': '8', fill: '#f59e0b' }, ['?']));
    }
  });

  // Datumsbeschriftung (Anfang/Ende)
  const fmtDate = ts => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  svg.appendChild(svgEl('text', { x: PAD.l, y: H - 5, 'font-size': '9', fill: VIZ_COLORS.textMuted }, [fmtDate(minD)]));
  svg.appendChild(svgEl('text', { x: W - PAD.r, y: H - 5, 'text-anchor': 'end', 'font-size': '9', fill: VIZ_COLORS.textMuted }, [fmtDate(maxD)]));

  // Einheit
  svg.appendChild(svgEl('text', { x: PAD.l - 5, y: PAD.t - 5, 'text-anchor': 'end', 'font-size': '9', fill: VIZ_COLORS.textMuted }, [cfg?.unit ?? '']));

  container.appendChild(svg);

  // Hinweis auf Messungenauigkeiten
  const hasOutlier = values.some(v => Math.abs(v - avgVal) / avgVal > 0.15);
  if (hasOutlier) {
    const hint = document.createElement('p');
    hint.className = 'chart-hint warning';
    hint.textContent = '⚠ Gelbe Markierungen zeigen Werte, die stärker vom Durchschnitt der eigenen Messungen abweichen. Mögliche Messungenauigkeit.';
    container.appendChild(hint);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. RANKING CHART (Fun-Bereich)
//    Horizontale Rangliste, eigene Position hervorgehoben.
// ─────────────────────────────────────────────────────────────────────────────

function renderRankingChart(container, rankingData, highlightId) {
  container.innerHTML = '';
  if (!rankingData?.ranked?.length) return;

  const { ranked, ref, cfg } = rankingData;
  const W = 500;
  const rowH = 28, gap = 4;
  const PAD = { l: 30, r: 80, t: 10, b: 10 };
  const totalH = PAD.t + ranked.length * (rowH + gap) + PAD.b;
  const svg = makeSvg(W, totalH);

  const maxVal = ref?.max || Math.max(...ranked.map(r => r.value)) * 1.1;
  const toBarW = v => Math.max(4, ((v / maxVal)) * (W - PAD.l - PAD.r));

  for (let i = 0; i < ranked.length; i++) {
    const e = ranked[i];
    const y = PAD.t + i * (rowH + gap);
    const isHighlight = e.profileId === highlightId;
    const barW = toBarW(e.value);
    const barColor = isHighlight ? e.color : '#cbd5e1';

    svg.appendChild(svgEl('rect', { x: PAD.l, y: y + 2, width: W - PAD.l - PAD.r, height: rowH - 4, fill: '#f1f5f9', rx: 3 }));
    svg.appendChild(svgEl('rect', { x: PAD.l, y: y + 2, width: barW, height: rowH - 4, fill: barColor, rx: 3, opacity: isHighlight ? '0.9' : '0.5' }));

    // Rang
    svg.appendChild(svgEl('text', {
      x: PAD.l - 5, y: y + rowH / 2 + 4,
      'text-anchor': 'end', 'font-size': '10', fill: '#64748b',
    }, [`#${i + 1}`]));

    // Name
    const nameLabel = e.profileName.length > 10 ? e.profileName.slice(0, 10) + '…' : e.profileName;
    svg.appendChild(svgEl('text', {
      x: PAD.l + 6, y: y + rowH / 2 + 4,
      'text-anchor': 'start', 'font-size': '10',
      fill: isHighlight ? '#1e293b' : '#64748b',
      'font-weight': isHighlight ? '700' : '400',
    }, [nameLabel + (isHighlight ? ' ◀ Du' : '')]));

    // Wert
    svg.appendChild(svgEl('text', {
      x: W - PAD.r + 5, y: y + rowH / 2 + 4,
      'text-anchor': 'start', 'font-size': '10',
      fill: isHighlight ? e.color : '#94a3b8', 'font-weight': isHighlight ? '700' : '400',
    }, [`${e.value.toFixed(cfg?.decimals ?? 1)} ${cfg?.unit ?? ''}`]));

    // Extrembereich-Badges
    if (e.isTop10pct) {
      svg.appendChild(svgEl('text', { x: W - 5, y: y + rowH / 2 + 4, 'text-anchor': 'end', 'font-size': '8', fill: '#3b82f6' }, ['▲ obere 10 %']));
    } else if (e.isBottom10pct) {
      svg.appendChild(svgEl('text', { x: W - 5, y: y + rowH / 2 + 4, 'text-anchor': 'end', 'font-size': '8', fill: '#94a3b8' }, ['▼ untere 10 %']));
    }
  }

  container.appendChild(svg);
}
