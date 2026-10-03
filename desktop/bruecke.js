/**
 * §173 Die Brücke zwischen der Anlage und dem Rechner.
 *
 * Alles, was die geladene Seite auf diesem Rechner darf, steht hier — und
 * nichts sonst. Kein `require`, kein Dateisystem, kein Prozess. Wer diese
 * Liste erweitert, öffnet eine Tür und muss sie begründen.
 *
 * Die Seite erkennt am Vorhandensein von `window.okun`, dass sie im Programm
 * läuft und nicht im Browser. Im Browser fehlt das Objekt, und die Seite
 * verhält sich wie immer — sie darf also nichts davon zwingend brauchen.
 */
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('okun', {
  /** Dass wir hier sind. Die Seite kann Browsereigenes ausblenden. */
  imProgramm: true,

  /** Welche Anlage das Fenster zeigt. */
  adresse: () => ipcRenderer.invoke('okun:adresse'),

  /** Eine andere Anlage einstellen. Nur https (oder der eigene Rechner). */
  adresseSetzen: (wert) => ipcRenderer.invoke('okun:adresse-setzen', wert),

  /**
   * Drucken ohne Kopf- und Fußzeile des Browsers.
   * Ein Lohnbeleg mit „1/2 — example.org" am Rand gehört nicht in eine
   * Personalakte.
   */
  drucken: () => ipcRenderer.invoke('okun:drucken'),

  /** Für die Fußzeile und für Fehlermeldungen. */
  version: () => ipcRenderer.invoke('okun:version'),
})
