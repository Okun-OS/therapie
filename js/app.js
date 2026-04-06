/**
 * app.js – Haupt-App-Controller
 *
 * Verwaltet:
 *  - App-Zustand (Profile, Einstellungen, aktiver Modus)
 *  - Navigation zwischen Bereichen
 *  - Formular-Handling (Profile anlegen/bearbeiten)
 *  - Vergleichslogik-Aufrufe und Visualisierungssteuerung
 *  - Datenschutz- und Disclaimer-Modals
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// APP-ZUSTAND
// ─────────────────────────────────────────────────────────────────────────────

const App = {
  profiles: [],          // Nutzerprofile (ohne Referenzprofile)
  sensitiveMap: {},      // { profileId: sensitiveData }
  settings: {},
  activeSection: 'profiles',
  activeCompareMode: '1v1',       // '1v1' | '1vref' | 'multi' | 'group'
  selectedProfileIds: [],
  editingProfileId: null,
  privateModeUnlocked: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISIERUNG
// ─────────────────────────────────────────────────────────────────────────────

function init() {
  App.settings = loadSettings();
  App.profiles  = loadProfiles();
  App.sensitiveMap = loadAllSensitiveData();

  // Sensible Daten in Profile-Objekte einbetten (in-memory)
  App.profiles.forEach(p => {
    p.sensitive = App.sensitiveMap[p.id] || { sensitiveLength: null, sensitiveCircumference: null, history: {} };
    if (!p.history) p.history = {};
  });

  renderProfileList();
  setupNavigation();
  setupModals();
  setupGeneralComparison();
  setupPrivateMode();
  setupFunMode();
  navigateTo(App.activeSection);
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

function navigateTo(section) {
  App.activeSection = section;

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));

  const tab = document.querySelector(`.nav-tab[data-section="${section}"]`);
  const sec = document.getElementById(`section-${section}`);
  if (tab) tab.classList.add('active');
  if (sec) sec.classList.add('active');

  // Sektionsabhängige Aktualisierungen
  if (section === 'general')  refreshGeneralComparison();
  if (section === 'private')  refreshPrivateMode();
  if (section === 'fun')      refreshFunMode();
}

function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const section = tab.dataset.section;
      if (section === 'private' && !App.privateModeUnlocked) {
        showPrivateDisclaimer(() => {
          App.privateModeUnlocked = true;
          navigateTo('private');
        });
        return;
      }
      navigateTo(section);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE-BEREICH
// ─────────────────────────────────────────────────────────────────────────────

function getAllProfiles(includeRefs = false) {
  const user = App.profiles;
  if (!includeRefs) return user;
  return [...user, ...Object.values(REFERENCE_PROFILES)];
}

function renderProfileList() {
  const container = document.getElementById('profile-list');
  if (!container) return;
  container.innerHTML = '';

  if (App.profiles.length === 0) {
    container.innerHTML = '<p class="empty-hint">Noch keine Profile. Erstelle dein erstes Profil.</p>';
  }

  App.profiles.forEach(profile => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML = `
      <div class="profile-card-header">
        <span class="profile-color-dot" style="background:${profile.color}"></span>
        <strong>${escHtml(profile.name)}</strong>
      </div>
      <div class="profile-card-stats">
        ${renderProfileStats(profile)}
      </div>
      <div class="profile-card-actions">
        <button class="btn btn-sm btn-outline" data-action="edit" data-id="${profile.id}">Bearbeiten</button>
        <button class="btn btn-sm btn-danger-outline" data-action="delete" data-id="${profile.id}">Löschen</button>
      </div>
    `;
    container.appendChild(card);
  });

  // Event-Delegation
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit')   openEditModal(id);
    if (action === 'delete') confirmDeleteProfile(id);
  });
}

function renderProfileStats(profile) {
  const g = profile.general;
  const items = [];
  if (g.height)   items.push(`<span>${g.height} cm</span>`);
  if (g.weight)   items.push(`<span>${g.weight} kg</span>`);
  if (g.shoeSize) items.push(`<span>Schuh ${g.shoeSize}</span>`);
  if (!items.length) return '<span class="muted">Noch keine Daten</span>';
  return items.join(' · ');
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL ANLEGEN / BEARBEITEN (Modal)
// ─────────────────────────────────────────────────────────────────────────────

function openNewProfileModal() {
  App.editingProfileId = null;
  const modal = document.getElementById('modal-profile');

  // Alle Eingabefelder leeren
  modal.querySelectorAll('input[type="number"], input[type="text"]').forEach(el => { el.value = ''; });
  document.getElementById('modal-profile-title').textContent = 'Neues Profil anlegen';

  // Ersten Tab aktivieren
  modal.querySelectorAll('.form-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  modal.querySelectorAll('.form-tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

  modal.classList.add('open');
}

function openEditModal(id) {
  const profile = App.profiles.find(p => p.id === id);
  if (!profile) return;
  App.editingProfileId = id;

  const modal = document.getElementById('modal-profile');
  document.getElementById('modal-profile-title').textContent = 'Profil bearbeiten';
  document.getElementById('field-profile-name').value = profile.name;

  // Allgemeine Felder befüllen
  Object.keys(MEASUREMENT_CONFIG).forEach(field => {
    const cfg = MEASUREMENT_CONFIG[field];
    if (cfg.category !== 'general') return;
    const el = document.getElementById(`field-${field}`);
    if (el) el.value = profile.general[field] ?? '';
  });

  // Sensible Felder
  const sens = profile.sensitive || {};
  ['sensitiveLength', 'sensitiveCircumference'].forEach(field => {
    const el = document.getElementById(`field-${field}`);
    if (el) el.value = sens[field] ?? '';
  });

  modal.classList.add('open');
}

function closeProfileModal() {
  document.getElementById('modal-profile').classList.remove('open');
  App.editingProfileId = null;
}

function saveProfileFromForm() {
  const name = document.getElementById('field-profile-name').value.trim();
  if (!name) { showToast('Bitte einen Namen eingeben.', 'error'); return; }

  let profile = App.editingProfileId
    ? App.profiles.find(p => p.id === App.editingProfileId)
    : createProfile(name);

  if (!profile) return;
  profile.name = name;

  // Allgemeine Felder lesen
  Object.keys(MEASUREMENT_CONFIG).forEach(field => {
    const cfg = MEASUREMENT_CONFIG[field];
    if (cfg.category !== 'general') return;
    const el = document.getElementById(`field-${field}`);
    if (!el) return;
    const val = el.value.trim();
    profile.general[field] = val !== '' ? parseFloat(val) : null;
  });

  // Sensible Felder
  if (!profile.sensitive) profile.sensitive = {};
  ['sensitiveLength', 'sensitiveCircumference'].forEach(field => {
    const el = document.getElementById(`field-${field}`);
    if (!el) return;
    const val = el.value.trim();
    profile.sensitive[field] = val !== '' ? parseFloat(val) : null;
  });

  // In App-State einpflegen
  if (!App.editingProfileId) {
    App.profiles.push(profile);
  }
  profile.updatedAt = Date.now();

  // Persistenz
  saveProfile(profile);
  saveSensitiveData(profile.id, profile.sensitive);
  App.sensitiveMap[profile.id] = profile.sensitive;

  closeProfileModal();
  renderProfileList();
  showToast(`Profil "${name}" gespeichert.`);
}

function confirmDeleteProfile(id) {
  const profile = App.profiles.find(p => p.id === id);
  if (!profile) return;
  if (!confirm(`Profil "${profile.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;

  deleteProfile(id);
  App.profiles = App.profiles.filter(p => p.id !== id);
  delete App.sensitiveMap[id];
  renderProfileList();
  showToast('Profil gelöscht.');
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLGEMEINER VERGLEICH
// ─────────────────────────────────────────────────────────────────────────────

function setupGeneralComparison() {
  const modeSelect = document.getElementById('compare-mode-select');
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      App.activeCompareMode = modeSelect.value;
      refreshGeneralComparison();
    });
  }

  const profileCheckboxes = document.getElementById('profile-checkboxes');
  if (profileCheckboxes) {
    profileCheckboxes.addEventListener('change', () => {
      App.selectedProfileIds = [...document.querySelectorAll('.profile-checkbox:checked')].map(c => c.value);
      refreshGeneralComparison();
    });
  }
}

function renderProfileCheckboxes(containerId, includeRefs = true) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const all = getAllProfiles(includeRefs);
  all.forEach(p => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.innerHTML = `
      <input type="checkbox" class="profile-checkbox" value="${p.id}"
        ${App.selectedProfileIds.includes(p.id) ? 'checked' : ''}>
      <span class="color-swatch" style="background:${p.color}"></span>
      ${escHtml(p.name)}${p.isReference ? ' <em>(Referenz)</em>' : ''}
    `;
    container.appendChild(label);
  });
}

function refreshGeneralComparison() {
  renderProfileCheckboxes('profile-checkboxes', true);

  const selectedAll = getAllProfiles(true).filter(p => App.selectedProfileIds.includes(p.id));

  // Mindestens 1 Profil nötig
  if (selectedAll.length === 0) {
    document.getElementById('general-viz-area').innerHTML =
      '<p class="empty-hint">Wähle mindestens ein Profil zum Vergleichen.</p>';
    return;
  }

  const mode = App.activeCompareMode;
  let profilesToCompare = selectedAll;

  // Gruppen-Modus: alle außer dem letzten als Gruppe, letzter als Einzel
  if (mode === 'group' && selectedAll.length >= 2) {
    const group = selectedAll.slice(0, -1);
    const single = selectedAll[selectedAll.length - 1];
    renderGroupComparison(group, single);
    return;
  }

  // Körperfiguren
  const bodyContainer = document.getElementById('body-figure-area');
  if (bodyContainer) renderBodyComparison(bodyContainer, profilesToCompare);

  // Allgemeiner Multi-Feld-Vergleich
  const results = fullComparison(profilesToCompare, 'general');
  const overviewContainer = document.getElementById('general-viz-area');
  renderMultiFieldOverview(overviewContainer, results, 'general');

  // Zusammenfassungstabelle
  renderComparisonTable('general-table-area', profilesToCompare, 'general');
}

function renderGroupComparison(groupProfiles, singleProfile) {
  const area = document.getElementById('general-viz-area');
  area.innerHTML = '';

  const title = document.createElement('h3');
  title.textContent = `Gruppenvergleich: "${singleProfile.name}" vs. Gruppe`;
  area.appendChild(title);

  const fields = Object.keys(MEASUREMENT_CONFIG).filter(f => MEASUREMENT_CONFIG[f].category === 'general');
  for (const field of fields) {
    const result = groupVsSingle(groupProfiles, singleProfile, field, 'general');
    if (!result || result.singleValue === null) continue;

    const row = document.createElement('div');
    row.className = 'group-compare-row';
    const cfg = MEASUREMENT_CONFIG[field];
    row.innerHTML = `
      <span class="field-label">${cfg.label}</span>
      <span>${escHtml(singleProfile.name)}: <strong>${result.singleValue.toFixed(cfg.decimals)} ${cfg.unit}</strong></span>
      <span>Gruppe Ø: <strong>${result.groupAvg.toFixed(cfg.decimals)} ${cfg.unit}</strong></span>
      <span class="diff ${result.diff?.direction}">${result.diff?.desc ?? '–'}</span>
    `;
    area.appendChild(row);
  }
}

function renderComparisonTable(containerId, profiles, dataCategory) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const fields = Object.keys(MEASUREMENT_CONFIG).filter(f => MEASUREMENT_CONFIG[f].category === dataCategory);
  const validFields = fields.filter(f =>
    profiles.some(p => {
      const v = dataCategory === 'general' ? p.general[f] : p.sensitive[f];
      return v !== null && v !== undefined;
    })
  );
  if (!validFields.length) return;

  const table = document.createElement('table');
  table.className = 'comparison-table';

  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Merkmal</th>
    ${profiles.map(p => `<th style="color:${p.color}">${escHtml(p.name)}</th>`).join('')}
    <th>Ø Referenz</th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const field of validFields) {
    const cfg = MEASUREMENT_CONFIG[field];
    const ref = REFERENCE_DATA[dataCategory]?.[field];
    const tr = document.createElement('tr');

    let cells = `<td class="field-name">${cfg.label}</td>`;
    for (const p of profiles) {
      const value = dataCategory === 'general' ? p.general[field] : p.sensitive[field];
      if (value === null || value === undefined) {
        cells += `<td class="muted">–</td>`;
        continue;
      }
      const cls = classifyValue(value, field, dataCategory);
      cells += `<td class="cell-${cls?.category ?? ''}">
        ${value.toFixed(cfg.decimals)} ${cfg.unit}
        ${cls ? `<br><small>${cls.contextLabel}</small>` : ''}
      </td>`;
    }
    cells += `<td class="ref-avg">${ref ? ref.avg.toFixed(cfg.decimals) + ' ' + cfg.unit : '–'}</td>`;
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATER MODUS
// ─────────────────────────────────────────────────────────────────────────────

function setupPrivateMode() {
  const modeSelect = document.getElementById('private-compare-mode');
  if (modeSelect) modeSelect.addEventListener('change', refreshPrivateMode);

  const checkboxes = document.getElementById('private-profile-checkboxes');
  if (checkboxes) {
    checkboxes.addEventListener('change', () => {
      refreshPrivateMode();
    });
  }
}

function showPrivateDisclaimer(onAccept) {
  const modal = document.getElementById('modal-private-disclaimer');
  if (!modal) { onAccept(); return; }
  modal.classList.add('open');

  const btn = document.getElementById('btn-private-accept');
  if (btn) btn.onclick = () => { modal.classList.remove('open'); onAccept(); };
}

function refreshPrivateMode() {
  if (!App.privateModeUnlocked) return;

  // Profil-Checkboxen für privaten Bereich
  renderPrivateProfileCheckboxes();

  const selected = getSelectedPrivateProfiles();

  // Kondom-Empfehlung: immer für das erste ausgewählte Profil
  if (selected.length >= 1) {
    renderCondomRecommendation(selected[0]);
  } else {
    document.getElementById('condom-result-area').innerHTML =
      '<p class="empty-hint">Profil mit Umfangsdaten auswählen.</p>';
  }

  // Vergleichs-Visualisierung
  renderSensitiveComparison(selected);

  // Tabelle
  renderComparisonTable('private-table-area', selected, 'sensitive');
}

function renderPrivateProfileCheckboxes() {
  const container = document.getElementById('private-profile-checkboxes');
  if (!container) return;

  const prevSelected = [...document.querySelectorAll('.priv-checkbox:checked')].map(c => c.value);
  container.innerHTML = '';

  const withSensitive = getAllProfiles(true).filter(p => {
    const s = p.sensitive;
    return s && (s.sensitiveLength || s.sensitiveCircumference);
  });

  if (!withSensitive.length) {
    container.innerHTML = '<p class="empty-hint">Keine Profile mit sensiblen Daten.</p>';
    return;
  }

  withSensitive.forEach(p => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.innerHTML = `
      <input type="checkbox" class="priv-checkbox" value="${p.id}"
        ${prevSelected.includes(p.id) || prevSelected.length === 0 ? 'checked' : ''}>
      <span class="color-swatch" style="background:${p.color}"></span>
      ${escHtml(p.name)}
    `;
    container.appendChild(label);
  });
}

function getSelectedPrivateProfiles() {
  const checked = [...document.querySelectorAll('.priv-checkbox:checked')].map(c => c.value);
  return getAllProfiles(true).filter(p => {
    const s = p.sensitive;
    return checked.includes(p.id) && s && (s.sensitiveLength || s.sensitiveCircumference);
  });
}

function renderSensitiveComparison(profiles) {
  // Skalen-Vergleich
  ['sensitiveLength', 'sensitiveCircumference'].forEach(field => {
    const containerId = `private-scale-${field}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    const result = compareProfiles(profiles, field, 'sensitive');
    if (!result) { container.innerHTML = ''; return; }

    renderScaleChart(container, {
      field,
      entries: result.entries,
      ref: result.ref,
      cfg: result.cfg,
      width: 560, height: 120,
      showConnectors: profiles.length >= 2,
    });
  });

  // Abstrakte Form (Länge + Umfang kombiniert)
  const abstractContainer = document.getElementById('private-abstract-area');
  if (abstractContainer) {
    const entries = profiles
      .filter(p => p.sensitive?.sensitiveLength && p.sensitive?.sensitiveCircumference)
      .map(p => ({
        length: p.sensitive.sensitiveLength,
        circumference: p.sensitive.sensitiveCircumference,
        label: p.name,
        color: p.color,
      }));
    renderAbstractComparison(abstractContainer, entries);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KONDOM-EMPFEHLUNG
// ─────────────────────────────────────────────────────────────────────────────

function renderCondomRecommendation(profile) {
  const container = document.getElementById('condom-result-area');
  if (!container) return;

  const rec = getRecommendationForProfile(profile);

  if (rec.error) {
    container.innerHTML = `<p class="empty-hint">${escHtml(rec.error)}</p>`;
    return;
  }

  const isBorderline = rec.isBorderline;
  const sizeLabels = rec.primarySizes.map(s => s.label).join(' oder ');

  container.innerHTML = `
    <div class="condom-result ${isBorderline ? 'borderline' : ''}">
      <div class="condom-result-header">
        <span class="condom-profile-dot" style="background:${profile.color}"></span>
        <strong>Empfehlung für ${escHtml(profile.name)}</strong>
      </div>

      <div class="condom-size-badge">
        ${escHtml(sizeLabels)}
        ${isBorderline ? '<span class="badge-hint">Grenzfall</span>' : ''}
      </div>

      <div class="condom-detail">
        <p><strong>Berechnete Nominalbreite:</strong> ca. ${rec.nominalWidthMm.toFixed(0)} mm</p>
        ${rec.lengthCategory ? `<p><strong>Länge:</strong> ${escHtml(rec.lengthCategory.label)} (${escHtml(rec.lengthCategory.note)})</p>` : ''}
        <p>${escHtml(rec.summary)}</p>
      </div>

      ${isBorderline ? `<div class="condom-borderline-hint"><strong>Grenzfall-Hinweis:</strong> ${escHtml(rec.borderlineHint)}</div>` : ''}

      <details class="condom-influences">
        <summary>Einfluss der Eingaben</summary>
        <table class="influence-table">
          <thead><tr><th>Faktor</th><th>Wert</th><th>Einfluss</th><th>Detail</th></tr></thead>
          <tbody>
            ${rec.influences.map(inf => `
              <tr>
                <td>${escHtml(inf.factor)}</td>
                <td>${escHtml(inf.value)}</td>
                <td><span class="weight-badge weight-${inf.weight}">${escHtml(inf.impact)}</span></td>
                <td>${escHtml(inf.detail)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>

      <details class="condom-size-table-details">
        <summary>Alle Größen im Überblick</summary>
        ${renderCondomSizeTable(rec)}
      </details>

      <p class="disclaimer">${escHtml(rec.disclaimer)}</p>
      <p class="data-note">ⓘ ${escHtml(rec.dataNote)}</p>
    </div>
  `;
}

function renderCondomSizeTable(rec) {
  const rows = getAllCondomSizes().map(s => {
    const isRec = rec.primarySizes.some(r => r.id === s.id);
    return `<tr class="${isRec ? 'row-highlighted' : ''}">
      <td>${escHtml(s.label)} ${isRec ? '◀' : ''}</td>
      <td>${s.nominalWidthMm.min}–${s.nominalWidthMm.max} mm</td>
      <td>${s.circumferenceCm.min.toFixed(1)}–${s.circumferenceCm.max.toFixed(1)} cm Umfang</td>
      <td class="muted">${escHtml(s.note)}</td>
    </tr>`;
  }).join('');
  return `<table class="size-overview-table"><thead><tr><th>Größe</th><th>Nominalbreite</th><th>Umfang</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUN-BEREICH
// ─────────────────────────────────────────────────────────────────────────────

function setupFunMode() {
  const fieldSelect = document.getElementById('fun-field-select');
  if (fieldSelect) {
    // Felder befüllen
    Object.keys(MEASUREMENT_CONFIG).forEach(f => {
      const cfg = MEASUREMENT_CONFIG[f];
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = `${cfg.label} (${cfg.category === 'sensitive' ? 'Privatbereich' : 'Allgemein'})`;
      fieldSelect.appendChild(opt);
    });
    fieldSelect.addEventListener('change', refreshFunMode);
  }

  const catSelect = document.getElementById('fun-category-select');
  if (catSelect) catSelect.addEventListener('change', refreshFunMode);
}

function refreshFunMode() {
  const fieldSelect = document.getElementById('fun-field-select');
  const field = fieldSelect?.value;
  if (!field) return;

  const cfg = MEASUREMENT_CONFIG[field];
  const dataCategory = cfg.category;

  // Profile ermitteln (inkl. Referenzprofile)
  const allProfiles = getAllProfiles(true);

  // Nur Profile mit Wert für dieses Feld
  const withValue = allProfiles.filter(p => {
    const v = dataCategory === 'general' ? p.general[field] : p.sensitive[field];
    return v !== null && v !== undefined;
  });

  if (withValue.length < 2) {
    document.getElementById('fun-ranking-area').innerHTML =
      '<p class="empty-hint">Mindestens 2 Profile mit diesem Wert benötigt.</p>';
    return;
  }

  const ranking = buildRanking(withValue, field, dataCategory);

  // Erster eigener Nutzerprofil-ID für Highlight
  const firstOwnProfile = withValue.find(p => !p.isReference);
  const highlightId = firstOwnProfile?.id;

  const container = document.getElementById('fun-ranking-area');
  renderRankingChart(container, ranking, highlightId);

  // Positions-Info
  if (highlightId) {
    const pos = getProfileRankPosition(highlightId, ranking);
    if (pos) {
      const infoEl = document.getElementById('fun-position-info');
      if (infoEl) {
        infoEl.innerHTML = `
          <strong>${escHtml(firstOwnProfile.name)}</strong> belegt Platz
          <strong>#${pos.rank}</strong> von ${pos.total}
          ${pos.percentile !== null ? `· Perzentil: <strong>${pos.percentile}</strong>` : ''}
          ${pos.entry?.isTop10pct ? '<span class="badge-top">obere 10 %</span>' : ''}
          ${pos.entry?.isBottom10pct ? '<span class="badge-bottom">untere 10 %</span>' : ''}
        `;
      }
    }
  }

  // Statistik
  renderFunStats(ranking, field, dataCategory);
}

function renderFunStats(ranking, field, dataCategory) {
  const container = document.getElementById('fun-stats-area');
  if (!container || !ranking) return;
  const cfg = MEASUREMENT_CONFIG[field];
  const ref = ranking.ref;
  const dec = cfg.decimals;

  container.innerHTML = `
    <div class="fun-stats-grid">
      <div class="fun-stat"><span class="stat-label">Höchster Wert</span><strong>${ranking.stats.max.toFixed(dec)} ${cfg.unit}</strong></div>
      <div class="fun-stat"><span class="stat-label">Niedrigster Wert</span><strong>${ranking.stats.min.toFixed(dec)} ${cfg.unit}</strong></div>
      <div class="fun-stat"><span class="stat-label">Durchschnitt (Gruppe)</span><strong>${ranking.stats.avg.toFixed(dec)} ${cfg.unit}</strong></div>
      <div class="fun-stat"><span class="stat-label">Spannweite</span><strong>${ranking.stats.range.toFixed(dec)} ${cfg.unit}</strong></div>
      ${ref ? `<div class="fun-stat"><span class="stat-label">Referenz-Ø</span><strong>${ref.avg.toFixed(dec)} ${cfg.unit}</strong></div>` : ''}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERLAUF
// ─────────────────────────────────────────────────────────────────────────────

function openHistoryView(profileId, field) {
  const profile = App.profiles.find(p => p.id === profileId);
  if (!profile) return;

  const container = document.getElementById('history-chart-area');
  if (!container) return;

  const cfg = MEASUREMENT_CONFIG[field];
  const isSensitive = cfg.category === 'sensitive';

  let histEntries;
  if (isSensitive) {
    histEntries = (profile.sensitive?.history?.[field]) || [];
  } else {
    histEntries = (profile.history?.[field]) || [];
  }

  document.getElementById('history-modal-title').textContent =
    `Verlauf: ${escHtml(profile.name)} – ${cfg.label}`;

  renderHistoryChart(container, histEntries, field, profile.color);
  document.getElementById('modal-history').classList.add('open');
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function triggerExport(includeSensitive = false) {
  const json = exportData(includeSensitive);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `koerpervergleich-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = importData(ev.target.result);
      if (result.success) {
        App.profiles = loadProfiles();
        App.sensitiveMap = loadAllSensitiveData();
        App.profiles.forEach(p => {
          p.sensitive = App.sensitiveMap[p.id] || { sensitiveLength: null, sensitiveCircumference: null };
        });
        renderProfileList();
        showToast(`${result.imported} Profil(e) importiert.`);
      } else {
        showToast('Import fehlgeschlagen: ' + result.errors.join(', '), 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearAllDataConfirm() {
  if (!confirm('Alle gespeicherten Daten (inkl. sensible Daten) wirklich löschen? Nicht rückgängig machbar.')) return;
  clearAllData();
  App.profiles = [];
  App.sensitiveMap = {};
  renderProfileList();
  showToast('Alle Daten gelöscht.');
}

// ─────────────────────────────────────────────────────────────────────────────
// MODALS & OVERLAYS
// ─────────────────────────────────────────────────────────────────────────────

function setupModals() {
  // Schließen per Overlay-Klick oder Escape
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Formular-Submit
  const saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) saveBtn.addEventListener('click', saveProfileFromForm);

  const cancelBtn = document.getElementById('btn-cancel-profile');
  if (cancelBtn) cancelBtn.addEventListener('click', closeProfileModal);

  // Import/Export
  document.getElementById('btn-export')?.addEventListener('click', () => triggerExport(false));
  document.getElementById('btn-export-sensitive')?.addEventListener('click', () => triggerExport(true));
  document.getElementById('btn-import')?.addEventListener('click', triggerImport);
  document.getElementById('btn-clear-all')?.addEventListener('click', clearAllDataConfirm);

  // Profil erstellen
  document.getElementById('btn-new-profile')?.addEventListener('click', openNewProfileModal);
  document.getElementById('btn-new-profile-2')?.addEventListener('click', openNewProfileModal);

  // Fun-Modus Disclaimer
  const funAccept = document.getElementById('btn-fun-accept');
  if (funAccept) funAccept.addEventListener('click', () => {
    document.getElementById('fun-disclaimer-banner').style.display = 'none';
    updateSetting('funModeAcknowledged', true);
  });

  // Verlaufs-Modal schließen
  document.getElementById('btn-close-history')?.addEventListener('click', () => {
    document.getElementById('modal-history').classList.remove('open');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST-NACHRICHTEN
// ─────────────────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 400); }, 3000);
}

// ─────────────────────────────────────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
