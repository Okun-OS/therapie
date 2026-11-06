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

/*
 * §201 Der Seite sagen, dass sie im Programm läuft — bevor sie gezeichnet
 * wird.
 *
 * Es ginge auch in der App selbst, über `window.okun`. Dann käme die
 * Erkenntnis aber erst nach der Hydrierung, und für den Bruchteil davor
 * stünde die Kopfleiste ohne Platz für die Fensterknöpfe da — ein sichtbares
 * Zucken bei jedem Seitenwechsel. Hier ist es vor dem ersten Bild da.
 */
const istMac = process.platform === 'darwin'
const markieren = () => {
  const w = document.documentElement
  if (!w) return
  w.classList.add('im-programm')
  if (istMac) w.classList.add('huelle-mac')
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', markieren, { once: true })
} else {
  markieren()
}

contextBridge.exposeInMainWorld('okun', {
  /** Dass wir hier sind. Die Seite kann Browsereigenes ausblenden. */
  imProgramm: true,

  /**
   * Welche Farbe die Fensterknöpfe oben rechts haben sollen.
   *
   * Das Betriebssystem zeichnet sie über unsere Kopfleiste, kennt deren Farbe
   * aber nicht. Die Anmeldeseite ist dunkel, die App dahinter hell — also
   * sagt es jede Seite selbst. Wüsste es stattdessen die Hülle, stünde die
   * Liste der dunklen Seiten an einer zweiten Stelle und liefe beim nächsten
   * neuen Bildschirm auseinander.
   */
  leiste: (art) => ipcRenderer.invoke('okun:leiste', art),

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
