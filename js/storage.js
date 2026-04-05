/**
 * storage.js – Lokale Datenpersistenz (localStorage)
 *
 * Datenschutz-Hinweise:
 * - Allgemeine Profildaten werden in localStorage gespeichert.
 * - Sensible Daten werden GETRENNT unter einem eigenen Key gespeichert.
 * - Keine Übertragung an Server.
 * - Nutzer kann Daten jederzeit löschen.
 * - Vorbereitet für optionale Verschlüsselung (AES via Web Crypto API).
 */

'use strict';

const STORAGE_KEYS = {
  profiles:        'kv_profiles_v1',       // Allgemeine Profildaten
  sensitiveData:   'kv_sensitive_v1',       // Sensible Daten (getrennt)
  appSettings:     'kv_settings_v1',        // App-Einstellungen
  funEntries:      'kv_fun_v1',             // Fun-Bereich Einträge (anonym)
};

// ─────────────────────────────────────────────────────────────────────────────
// GRUNDLEGENDE SPEICHER-OPERATIONEN
// ─────────────────────────────────────────────────────────────────────────────

function storageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('[Storage] Lesefehler:', key, e);
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('[Storage] Schreibfehler:', key, e);
    return false;
  }
}

function storageDelete(key) {
  try { localStorage.removeItem(key); return true; }
  catch (e) { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lädt alle Nutzerprofile (ohne sensible Daten).
 * Referenzprofile werden nicht gespeichert – sie kommen aus data.js.
 */
function loadProfiles() {
  return storageGet(STORAGE_KEYS.profiles) || [];
}

/**
 * Speichert alle Profile (sensible Daten werden herausgefiltert).
 */
function saveProfiles(profiles) {
  const sanitized = profiles
    .filter(p => !p.isReference)
    .map(p => {
      const { sensitive, ...rest } = p; // sensible Daten weglassen
      return rest;
    });
  return storageSet(STORAGE_KEYS.profiles, sanitized);
}

/**
 * Einzelnes Profil speichern/aktualisieren.
 */
function saveProfile(profile) {
  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  const { sensitive, ...withoutSensitive } = profile;
  withoutSensitive.updatedAt = Date.now();

  if (idx >= 0) {
    profiles[idx] = withoutSensitive;
  } else {
    profiles.push(withoutSensitive);
  }
  return storageSet(STORAGE_KEYS.profiles, profiles);
}

/**
 * Einzelnes Profil löschen.
 */
function deleteProfile(id) {
  const profiles = loadProfiles().filter(p => p.id !== id);
  storageSet(STORAGE_KEYS.profiles, profiles);
  deleteSensitiveData(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// SENSIBLE DATEN (GETRENNTE SPEICHERUNG)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lädt sensible Daten für alle Profile.
 * Gibt Map { profileId -> { sensitiveLength, sensitiveCircumference, history } } zurück.
 */
function loadAllSensitiveData() {
  return storageGet(STORAGE_KEYS.sensitiveData) || {};
}

/**
 * Sensible Daten eines Profils laden.
 */
function loadSensitiveData(profileId) {
  const all = loadAllSensitiveData();
  return all[profileId] || { sensitiveLength: null, sensitiveCircumference: null, history: {} };
}

/**
 * Sensible Daten eines Profils speichern.
 */
function saveSensitiveData(profileId, sensitiveData) {
  const all = loadAllSensitiveData();
  all[profileId] = { ...sensitiveData, savedAt: Date.now() };
  return storageSet(STORAGE_KEYS.sensitiveData, all);
}

/**
 * Sensible Daten eines Profils löschen.
 */
function deleteSensitiveData(profileId) {
  const all = loadAllSensitiveData();
  delete all[profileId];
  return storageSet(STORAGE_KEYS.sensitiveData, all);
}

// ─────────────────────────────────────────────────────────────────────────────
// VERLAUF (HISTORY)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verlaufseintrag hinzufügen (allgemein).
 */
function addHistoryEntry(profileId, field, value, date = Date.now(), note = '') {
  const profiles = loadProfiles();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return false;

  if (!profile.history) profile.history = {};
  if (!profile.history[field]) profile.history[field] = [];
  profile.history[field].push({ value, date, note });
  profile.history[field].sort((a, b) => a.date - b.date);

  return storageSet(STORAGE_KEYS.profiles, profiles);
}

/**
 * Verlaufseintrag für sensible Daten hinzufügen.
 */
function addSensitiveHistoryEntry(profileId, field, value, date = Date.now(), note = '') {
  const data = loadSensitiveData(profileId);
  if (!data.history) data.history = {};
  if (!data.history[field]) data.history[field] = [];
  data.history[field].push({ value, date, note });
  data.history[field].sort((a, b) => a.date - b.date);
  return saveSensitiveData(profileId, data);
}

// ─────────────────────────────────────────────────────────────────────────────
// EINSTELLUNGEN
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  privateModeEnabled: false,
  funModeEnabled: false,
  showReferenceProfiles: true,
  privacyAcknowledged: false,
  funModeAcknowledged: false,
  theme: 'light',
};

function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(storageGet(STORAGE_KEYS.appSettings) || {}) };
}

function saveSettings(settings) {
  return storageSet(STORAGE_KEYS.appSettings, settings);
}

function updateSetting(key, value) {
  const s = loadSettings();
  s[key] = value;
  return saveSettings(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exportiert alle Daten als JSON-String (optional ohne sensible Daten).
 */
function exportData(includeSensitive = false) {
  const profiles = loadProfiles();
  const settings = loadSettings();
  const payload = {
    exportedAt: Date.now(),
    version: '1.0.0',
    profiles,
    settings,
  };
  if (includeSensitive) {
    payload.sensitiveData = loadAllSensitiveData();
    payload._warning = 'Diese Datei enthält sensible Daten. Bitte sicher verwahren.';
  }
  return JSON.stringify(payload, null, 2);
}

/**
 * Importiert Daten aus JSON-String.
 * Gibt { success, imported, errors } zurück.
 */
function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    const result = { success: false, imported: 0, errors: [] };

    if (data.profiles && Array.isArray(data.profiles)) {
      const existing = loadProfiles();
      let count = 0;
      for (const p of data.profiles) {
        if (!p.id || !p.name) { result.errors.push('Ungültiges Profil übersprungen'); continue; }
        const idx = existing.findIndex(e => e.id === p.id);
        if (idx >= 0) existing[idx] = p;
        else existing.push(p);
        count++;
      }
      storageSet(STORAGE_KEYS.profiles, existing);
      result.imported = count;
    }

    if (data.sensitiveData) {
      const existing = loadAllSensitiveData();
      storageSet(STORAGE_KEYS.sensitiveData, { ...existing, ...data.sensitiveData });
    }

    result.success = true;
    return result;
  } catch (e) {
    return { success: false, imported: 0, errors: [e.message] };
  }
}

/**
 * Alle Daten löschen (vollständiger Reset).
 */
function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => storageDelete(key));
}

// ─────────────────────────────────────────────────────────────────────────────
// FUN-BEREICH (anonymisierte Einträge)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anonymen Eintrag für Fun-Bereich speichern.
 * Kein echter Name, nur anonyme ID.
 */
function saveFunEntry(field, value, anonymousLabel) {
  const entries = storageGet(STORAGE_KEYS.funEntries) || [];
  entries.push({
    id: 'anon_' + Math.random().toString(36).slice(2, 9),
    label: anonymousLabel || 'Nutzer',
    field,
    value,
    addedAt: Date.now(),
  });
  return storageSet(STORAGE_KEYS.funEntries, entries);
}

function loadFunEntries() {
  return storageGet(STORAGE_KEYS.funEntries) || [];
}
