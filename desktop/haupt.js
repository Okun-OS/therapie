/**
 * §173 OKUN Workforce als Programm für den Rechner.
 *
 * WARUM DIE HÜLLE DIE ANLAGE LÄDT UND SIE NICHT MITBRINGT
 * Dieselbe Überlegung wie bei der Telefon-Hülle (§139): Die Seiten entstehen
 * auf dem Server, dort liegen Lohn, Zeiten und Rechte. Ein Programm, das den
 * Stand vom Tag der Auslieferung mitbrächte, wäre am Tag darauf falsch — und
 * jede Korrektur an der Lohnabrechnung müsste den Weg über eine neue
 * Installation nehmen. Bei einem Programm, das Gehälter rechnet, ist das
 * untragbar.
 *
 * WAS ES DANN ÜBERHAUPT BRINGT
 * Nicht „dieselbe Seite in einem Fenster ohne Adressleiste". Sondern das, was
 * ein Browsertab nicht kann:
 *
 *   - Es steht im Startmenü und in der Taskleiste, mit eigenem Symbol. Wer
 *     morgens den Rechner anmacht, klickt ein Programm an und sucht kein
 *     Lesezeichen.
 *   - Es merkt sich Fenstergröße und -lage über das Beenden hinaus.
 *   - Es druckt ohne Kopf- und Fußzeile des Browsers. Ein Lohnbeleg mit
 *     „1/2 — localhost:3000" am Rand geht nicht in eine Personalakte.
 *   - Die Adresse der eigenen Anlage ist einstellbar und bleibt gespeichert.
 *     Ein Kunde mit eigener Domain oder eigenem Server tippt sie einmal ein.
 *   - Fremde Adressen werden nicht geöffnet. Ein Link nach außen geht in den
 *     Systembrowser, nicht in das Fenster mit den Lohndaten.
 *   - Ist die Anlage nicht erreichbar, steht das im Klartext da statt einer
 *     weißen Fläche.
 *
 * WAS ES BEWUSST NICHT TUT
 * Es hält keine Daten auf dem Rechner. Kein Zwischenspeicher mit Gehältern in
 * einem Ordner, den die nächste Datenrettung findet. Was die Anlage schickt,
 * lebt im Fenster und verschwindet mit ihm.
 */
'use strict'

const { app, BrowserWindow, shell, Menu, dialog, ipcMain, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

/**
 * Die Adresse der Anlage.
 *
 * Reihenfolge: was der Benutzer eingestellt hat, dann was beim Bauen
 * mitgegeben wurde, dann die Anlage von OKUN. Ein Kunde, der selbst betreibt,
 * stellt sie im Programm ein — er soll dafür nichts neu bauen müssen.
 */
// §177 `/login`, nicht `/`: Unter `/` steht die Verkaufsseite. Wer das
// Programm öffnet, will arbeiten. Angemeldete werden von dort sofort
// weitergereicht.
const EINGEBAUT = process.env.OKUN_APP_URL || 'https://okun-workforce.com/login'

const einstellungenDatei = () => path.join(app.getPath('userData'), 'einstellungen.json')

function einstellungenLesen() {
  try {
    return JSON.parse(fs.readFileSync(einstellungenDatei(), 'utf8'))
  } catch {
    return {}
  }
}

function einstellungenSchreiben(werte) {
  try {
    fs.mkdirSync(path.dirname(einstellungenDatei()), { recursive: true })
    fs.writeFileSync(einstellungenDatei(), JSON.stringify(werte, null, 2), 'utf8')
    return true
  } catch (fehler) {
    console.error('Einstellungen nicht gespeichert:', fehler.message)
    return false
  }
}

/**
 * Eine Adresse annehmen oder ablehnen.
 *
 * Nur https, und kein Klartextweg. Bei Lohndaten wäre http nicht vertretbar —
 * die Ausnahme ist die Entwicklung am eigenen Rechner, wo es kein Netz gibt,
 * über das mitgelesen werden könnte.
 */
function adressePruefen(roh) {
  if (typeof roh !== 'string' || !roh.trim()) return null
  let u
  try {
    u = new URL(roh.trim())
  } catch {
    return null
  }
  const eigenerRechner = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && eigenerRechner)) return null
  return u.origin
}

function adresse() {
  return adressePruefen(einstellungenLesen().adresse) || adressePruefen(EINGEBAUT) || EINGEBAUT
}

// ── Das Fenster ────────────────────────────────────────────────────────────

const fensterDatei = () => path.join(app.getPath('userData'), 'fenster.json')

function fensterLageLesen() {
  try {
    const l = JSON.parse(fs.readFileSync(fensterDatei(), 'utf8'))
    if (typeof l.width === 'number' && typeof l.height === 'number') return l
  } catch { /* erster Start */ }
  return { width: 1400, height: 900 }
}

let fenster = null

function fensterBauen() {
  const lage = fensterLageLesen()

  fenster = new BrowserWindow({
    ...lage,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1A1D1F',
    title: 'OKUN Workforce',
    icon: path.join(__dirname, 'symbole', 'icon.png'),
    show: false,
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      // §173 Die drei Zeilen, auf die es sicherheitshalber ankommt: Die
      // geladene Seite bekommt kein Node, keinen Zugriff auf das Dateisystem
      // und lebt in ihrem eigenen Kontext. Was sie darf, steht in bruecke.js
      // und ist eine kurze Liste.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      preload: path.join(__dirname, 'bruecke.js'),
      spellcheck: true,
    },
  })

  const speichern = () => {
    if (!fenster || fenster.isDestroyed() || fenster.isMinimized()) return
    try {
      fs.mkdirSync(path.dirname(fensterDatei()), { recursive: true })
      fs.writeFileSync(fensterDatei(), JSON.stringify(fenster.getBounds()), 'utf8')
    } catch { /* nicht wichtig genug, um jemanden damit zu behelligen */ }
  }
  fenster.on('resize', speichern)
  fenster.on('move', speichern)
  fenster.once('ready-to-show', () => fenster.show())

  // §173 Fremde Adressen bleiben draußen.
  //
  // Ein Link nach außen — eine Hilfeseite, ein Gesetzestext, die Seite einer
  // Krankenkasse — geht in den Systembrowser. Er darf NICHT in dem Fenster
  // aufgehen, in dem gerade Lohndaten stehen: Eine fremde Seite im selben
  // Fenster sieht für den Benutzer aus wie ein Teil des Programms.
  const gehoertDazu = (ziel) => {
    try {
      return new URL(ziel).origin === adresse()
    } catch {
      return false
    }
  }

  fenster.webContents.setWindowOpenHandler(({ url }) => {
    if (gehoertDazu(url)) return { action: 'allow' }
    if (/^https?:$/.test(new URL(url).protocol)) shell.openExternal(url)
    return { action: 'deny' }
  })

  fenster.webContents.on('will-navigate', (ereignis, ziel) => {
    if (gehoertDazu(ziel)) return
    ereignis.preventDefault()
    try {
      if (/^https?:$/.test(new URL(ziel).protocol)) shell.openExternal(ziel)
    } catch { /* keine brauchbare Adresse — dann eben nichts */ }
  })

  // Ist die Anlage nicht erreichbar, steht das im Klartext da. Eine weiße
  // Fläche lässt jeden ratlos zurück und sieht aus wie ein kaputtes Programm.
  fenster.webContents.on('did-fail-load', (_e, code, beschreibung, ziel, hauptrahmen) => {
    if (!hauptrahmen) return
    // -3 ist ein abgebrochener Ladevorgang (z.B. eine Weiterleitung) und kein
    // Fehler, den jemand sehen muss.
    if (code === -3) return
    fenster.loadFile(path.join(__dirname, 'nicht-erreichbar.html'), {
      query: { adresse: adresse(), grund: beschreibung || String(code) },
    })
  })

  fenster.loadURL(adresse())
  return fenster
}

// ── Was die Seite darf ─────────────────────────────────────────────────────
//
// Eine kurze Liste, absichtlich. Jeder Punkt hier ist eine Tür in den
// Rechner, und jede Tür muss sich begründen lassen.

ipcMain.handle('okun:adresse', () => adresse())

ipcMain.handle('okun:adresse-setzen', (_e, roh) => {
  const geprueft = adressePruefen(roh)
  if (!geprueft) {
    return { ok: false, fehler: 'Das ist keine gültige https-Adresse.' }
  }
  const werte = { ...einstellungenLesen(), adresse: geprueft }
  if (!einstellungenSchreiben(werte)) {
    return { ok: false, fehler: 'Die Einstellung konnte nicht gespeichert werden.' }
  }
  if (fenster && !fenster.isDestroyed()) fenster.loadURL(geprueft)
  return { ok: true, adresse: geprueft }
})

// §173 Drucken ohne Kopf- und Fußzeile. Ein Lohnbeleg mit der Adresse der
// Anlage am Seitenrand gehört nicht in eine Personalakte.
ipcMain.handle('okun:drucken', () => {
  if (!fenster || fenster.isDestroyed()) return { ok: false }
  return new Promise(fertig => {
    fenster.webContents.print(
      { silent: false, printBackground: true, headerFooter: false },
      (erfolg, grund) => fertig({ ok: erfolg, fehler: erfolg ? undefined : grund }),
    )
  })
})

ipcMain.handle('okun:version', () => ({
  programm: app.getVersion(),
  plattform: process.platform,
  electron: process.versions.electron,
}))

// ── Menü ───────────────────────────────────────────────────────────────────

function adresseFragen() {
  if (!fenster || fenster.isDestroyed()) return
  fenster.loadFile(path.join(__dirname, 'adresse.html'), {
    query: { adresse: adresse() },
  })
}

function menuBauen() {
  const istMac = process.platform === 'darwin'
  const vorlage = [
    ...(istMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Adresse der Anlage…',
          click: adresseFragen,
        },
        {
          label: 'Drucken…',
          accelerator: 'CmdOrCtrl+P',
          click: () => fenster?.webContents.print({ printBackground: true, headerFooter: false }),
        },
        { type: 'separator' },
        istMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', accelerator: 'CmdOrCtrl+R', click: () => fenster?.loadURL(adresse()) },
        { role: 'resetZoom', label: 'Normale Größe' },
        { role: 'zoomIn', label: 'Größer' },
        { role: 'zoomOut', label: 'Kleiner' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' },
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Über OKUN Workforce',
          click: () => dialog.showMessageBox(fenster, {
            type: 'info',
            title: 'OKUN Workforce',
            message: `OKUN Workforce ${app.getVersion()}`,
            detail: `Anlage: ${adresse()}\n\nDas Programm zeigt Ihre Anlage. Lohn, Zeiten und `
              + 'Dienstpläne liegen dort und nicht auf diesem Rechner.',
            buttons: ['Schließen'],
          }),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(vorlage))
}

// ── Start ──────────────────────────────────────────────────────────────────

// §173 Ein zweiter Start holt das vorhandene Fenster nach vorn, statt ein
// zweites Programm daneben zu stellen. Zwei Fenster mit demselben Lohnmonat
// sind ein Weg, versehentlich zweimal freizugeben.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!fenster || fenster.isDestroyed()) return
    if (fenster.isMinimized()) fenster.restore()
    fenster.focus()
  })

  app.whenReady().then(() => {
    // §173 Nichts von der Anlage darf ungefragt an Kamera, Mikrofon oder Ort.
    // Die Anlage braucht das nicht; wer es doch anfragt, ist nicht die Anlage.
    session.defaultSession.setPermissionRequestHandler((_inhalt, recht, erlauben) => {
      erlauben(recht === 'clipboard-sanitized-write' || recht === 'notifications')
    })

    menuBauen()
    fensterBauen()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) fensterBauen()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

// Für die Prüfung: dieselbe Entscheidung, die das Fenster trifft, ohne Fenster.
module.exports = { adressePruefen }
