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

/**
 * Die Anlage — nur der Ursprung, ohne Pfad.
 *
 * Das ist die SICHERHEITSGRENZE: Alles mit diesem Ursprung darf im Fenster
 * aufgehen, alles andere geht in den Systembrowser.
 */
function anlage() {
  return adressePruefen(einstellungenLesen().adresse) || adressePruefen(EINGEBAUT) || EINGEBAUT
}

/**
 * §193 Womit das Fenster startet — und warum das NICHT dasselbe ist.
 *
 * Hier lag ein Fehler, der ein Jahr lang im Kommentar widerlegt stand. Zwei
 * Zeilen über der alten Fassung steht seit §177: „`/login`, nicht `/`: Unter
 * `/` steht die Verkaufsseite." Genau so war `EINGEBAUT` auch gesetzt. Nur
 * gab `adressePruefen` `u.origin` zurück — und `origin` ist der Ursprung OHNE
 * Pfad. Aus `https://okun-workforce.com/login` wurde `https://okun-workforce.com`,
 * und das Programm öffnete die Verkaufsseite.
 *
 * Der Eigentümer hat es gemeldet: „wenn ich die heruntergeladene Fassung
 * öffne, öffnet sich auch die Homepage — es müsste nur der Anmeldeschirm
 * aufgehen."
 *
 * Warum `adressePruefen` den Pfad trotzdem wegschneidet: Es prüft eine
 * Adresse, die ein KUNDE einträgt, der selbst betreibt. Dort ist nur der
 * Ursprung erwünscht; ein mitgegebener Pfad wäre eine zweite, stille
 * Einstellung. Der Fehler war nicht das Abschneiden, sondern dass derselbe
 * Wert danach als Startadresse benutzt wurde. Deshalb jetzt zwei Funktionen
 * mit zwei Aufgaben.
 */
function startAdresse() {
  return anlage() + '/login'
}

/**
 * §193 Die Verkaufsseiten haben in der Hülle nichts zu suchen.
 *
 * Wer das Programm installiert hat, ist Kunde — dem muss man nicht mehr
 * erklären, was das Programm kann. Landet er doch dort (über das Logo, über
 * einen Link), geht es zurück zur Anmeldung.
 *
 * `/impressum` und `/datenschutz` bleiben absichtlich erreichbar: Sie stehen
 * im Fuß der Anmeldeseite, und §5 DDG verlangt „ständig verfügbar".
 */
const VERKAUFSSEITEN = new Set(['/', '/funktionen', '/kontakt'])

function istVerkaufsseite(ziel) {
  try {
    const u = new URL(ziel)
    return u.origin === anlage() && VERKAUFSSEITEN.has(u.pathname.replace(/\/+$/, '') || '/')
  } catch {
    return false
  }
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

/**
 * §201 Die Fensterleiste.
 *
 * `hoehe` ist die Höhe der Kopfleiste der App (`CommandRail`). Die beiden
 * Farbpaare sind die beiden Gesichter der Anwendung: die Anmeldung ist dunkel
 * (`bg-navy`, #1A1D1F), alles dahinter hell (#F9FAFB). Welches gerade gilt,
 * sagt die Seite selbst über `window.okun.leiste('hell' | 'dunkel')` — die
 * Hülle führt keine Liste der dunklen Seiten, die beim nächsten neuen
 * Bildschirm veraltet wäre.
 */
const LEISTE = {
  mac: process.platform === 'darwin',
  hoehe: 70,
  dunkel: { color: '#1A1D1F', symbolColor: '#E8E8E8' },
  hell: { color: '#F9FAFB', symbolColor: '#1A1D1F' },
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
    /*
     * §201 Kein eigener Fensterrahmen — die App hat schon einen.
     *
     * Oben saß bisher die helle Fensterleiste des Betriebssystems über einer
     * App, die ihre eigene Kopfleiste mitbringt: zwei Kanten, zwei Farben,
     * und genau der Eindruck „Webseite in einem Kasten", über den sich der
     * Eigentümer beschwert hat.
     *
     * Jetzt zeichnet das Betriebssystem nur noch die drei Fensterknöpfe, und
     * zwar ÜBER unsere Kopfleiste (`CommandRail`, 70 px hoch). Deshalb hier
     * dieselbe Höhe — stünde sie woanders, verrutschten die Knöpfe beim
     * nächsten Umbau der Leiste, ohne dass es jemand merkt.
     *
     * Unter macOS wird das anders gemacht: `hiddenInset` lässt die drei
     * Punkte links stehen, wo sie dort hingehören, und sie werden nur tiefer
     * gesetzt.
     */
    ...(LEISTE.mac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 26 } }
      : {
        titleBarStyle: 'hidden',
        titleBarOverlay: { ...LEISTE.dunkel, height: LEISTE.hoehe },
      }),
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
      return new URL(ziel).origin === anlage()
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
    // §193 Verkaufsseite im Programm: zurück zur Anmeldung.
    if (istVerkaufsseite(ziel)) {
      ereignis.preventDefault()
      fenster.loadURL(startAdresse())
      return
    }
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
      query: { adresse: anlage(), grund: beschreibung || String(code) },
    })
  })

  fenster.loadURL(startAdresse())
  return fenster
}

// ── Was die Seite darf ─────────────────────────────────────────────────────
//
// Eine kurze Liste, absichtlich. Jeder Punkt hier ist eine Tür in den
// Rechner, und jede Tür muss sich begründen lassen.

/**
 * §201 Die Farbe der Fensterknöpfe umstellen.
 *
 * Unter macOS gibt es nichts zu tun: Die drei Punkte passen sich dort selbst
 * an, und `setTitleBarOverlay` wirft sogar, wenn es kein Overlay gibt.
 */
ipcMain.handle('okun:leiste', (_e, art) => {
  if (LEISTE.mac || !fenster || fenster.isDestroyed()) return false
  const farben = art === 'hell' ? LEISTE.hell : LEISTE.dunkel
  try {
    fenster.setTitleBarOverlay({ ...farben, height: LEISTE.hoehe })
    return true
  } catch {
    // Ältere Fassungen mancher Fenstersysteme können das nicht. Dann bleibt
    // die Startfarbe stehen — unschön, aber nichts, wofür man abstürzen muss.
    return false
  }
})

ipcMain.handle('okun:adresse', () => anlage())

ipcMain.handle('okun:adresse-setzen', (_e, roh) => {
  const geprueft = adressePruefen(roh)
  if (!geprueft) {
    return { ok: false, fehler: 'Das ist keine gültige https-Adresse.' }
  }
  const werte = { ...einstellungenLesen(), adresse: geprueft }
  if (!einstellungenSchreiben(werte)) {
    return { ok: false, fehler: 'Die Einstellung konnte nicht gespeichert werden.' }
  }
  if (fenster && !fenster.isDestroyed()) fenster.loadURL(geprueft + '/login')
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

// ── §205 Selbstaktualisierung ──────────────────────────────────────────────
//
// WARUM ES SIE JETZT GIBT — UND WARUM VORHER NICHT
// In §173 stand hier eine Absage mit Begründung: Die Hülle enthält keine
// Anwendung, Korrekturen an Lohn und Dienstplan gehen über den Server und
// sind beim nächsten Öffnen da. Das stimmt weiterhin.
//
// Was sich geändert hat, ist die Hülle selbst. Seit §201 trägt sie den
// Fensterrahmen, und als Nächstes kommen Offlinebetrieb, Benachrichtigungen
// und ein Symbol im Infobereich. Damit wird sie zu etwas, das sich ändert —
// und ohne Selbstaktualisierung erreicht keine dieser Verbesserungen jemals
// jemanden, der das Programm schon installiert hat. Er müsste von selbst auf
// die Idee kommen, nachzusehen.
//
// WAS HIER BEWUSST NICHT PASSIERT
//   – Es wird nichts erzwungen. Gefragt wird, wenn die neue Fassung fertig
//     heruntergeladen ist, und „Später" ist eine vollwertige Antwort. Ein
//     Programm, das sich mitten in der Dienstplanung selbst neu startet,
//     verliert Vertrauen schneller, als eine neue Fassung es aufbauen kann.
//   – Es wird nicht gemeldet, wenn nichts da ist. Eine automatische Suche,
//     die bei jedem Start „Sie sind aktuell" sagt, ist Lärm.
//   – Es wird nicht gemeldet, wenn die Suche scheitert. Solange die Dateien
//     nirgends liegen (siehe DESKTOP.md), scheitert sie bei JEDEM Start —
//     eine Fehlermeldung dafür wäre das Erste, was der Kunde vom Programm
//     sieht. Wer von Hand sucht, bekommt die Auskunft sehr wohl.
//
// SICHERHEIT
// Eine Selbstaktualisierung ist ein Weg, fremden Code auf einen Kundenrechner
// zu bringen — deshalb hängt alles daran, dass die heruntergeladene Datei
// geprüft wird. Das tut electron-updater unter Windows von sich aus: Es
// vergleicht den Herausgeber der Signatur mit dem, der beim Bauen in
// `app-update.yml` geschrieben wurde, und lehnt ab, wenn beides nicht
// zusammenpasst. Ein unsigniert gebautes Programm scheitert damit an der
// eigenen Prüfung — und das ist richtig so.
//
// Gesucht wird nur, wenn beim Bauen überhaupt ein Ausgabeort eingetragen
// wurde. Ohne den legt electron-builder kein `app-update.yml` an, und dann
// gibt es nichts zu holen.

let aktualisierung = null
/** Hat der Mensch selbst gesucht? Dann bekommt er auch eine Antwort. */
let suchtSelbst = false

/** Wurde beim Bauen ein Ausgabeort eingetragen? */
function ausgabeortVorhanden() {
  try {
    return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))
  } catch {
    return false
  }
}

function aktualisierungEinrichten() {
  if (!app.isPackaged) return null // In der Entwicklung gibt es nichts zu holen.
  if (!ausgabeortVorhanden()) return null

  let updater
  try {
    ({ autoUpdater: updater } = require('electron-updater'))
  } catch {
    return null // Paket nicht mitgebaut — dann eben ohne.
  }

  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  updater.logger = null

  updater.on('update-downloaded', (stand) => {
    if (!fenster || fenster.isDestroyed()) return
    dialog.showMessageBox(fenster, {
      type: 'info',
      title: 'Neue Fassung bereit',
      message: `OKUN Workforce ${stand?.version ?? ''} ist heruntergeladen.`,
      detail: 'Sie wird beim nächsten Start verwendet. Jetzt neu starten?',
      buttons: ['Jetzt neu starten', 'Später'],
      defaultId: 1,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) updater.quitAndInstall()
    })
  })

  updater.on('update-not-available', () => {
    if (!suchtSelbst) return
    suchtSelbst = false
    dialog.showMessageBox(fenster, {
      type: 'info', title: 'Alles aktuell',
      message: `Sie benutzen bereits die neueste Fassung (${app.getVersion()}).`,
      buttons: ['Schließen'],
    })
  })

  updater.on('error', (fehler) => {
    if (!suchtSelbst) return
    suchtSelbst = false
    dialog.showMessageBox(fenster, {
      type: 'warning',
      title: 'Suche nicht möglich',
      message: 'Es ließ sich nicht nachsehen, ob es eine neue Fassung gibt.',
      detail: `Meist liegt es an der Verbindung dieses Rechners.\n\n`
        + `Meldung des Systems: ${fehler?.message ?? fehler}`,
      buttons: ['Schließen'],
    })
  })

  return updater
}

/** @param {boolean} vonHand */
function nachAktualisierungSuchen(vonHand = false) {
  if (!aktualisierung) {
    if (!vonHand) return
    dialog.showMessageBox(fenster, {
      type: 'info',
      title: 'Keine Selbstaktualisierung',
      message: 'Diese Fassung aktualisiert sich nicht selbst.',
      detail: app.isPackaged
        ? 'Sie wurde ohne Ausgabeort gebaut. Neue Fassungen gibt es auf '
          + 'okun-workforce.com.'
        : 'Im Entwicklungsbetrieb gibt es nichts zu holen.',
      buttons: ['Schließen'],
    })
    return
  }
  suchtSelbst = vonHand
  aktualisierung.checkForUpdates().catch(() => undefined)
}

// ── Menü ───────────────────────────────────────────────────────────────────

function adresseFragen() {
  if (!fenster || fenster.isDestroyed()) return
  fenster.loadFile(path.join(__dirname, 'adresse.html'), {
    query: { adresse: anlage() },
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
        { label: 'Neu laden', accelerator: 'CmdOrCtrl+R', click: () => fenster?.loadURL(startAdresse()) },
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
          // §205 Von Hand suchen gibt es immer — auch wenn automatisch
          // gesucht wird. Wer wissen will, ob er aktuell ist, soll es
          // nachsehen können, statt auf den nächsten Start zu warten.
          label: 'Nach Aktualisierung suchen…',
          click: () => nachAktualisierungSuchen(true),
        },
        { type: 'separator' },
        {
          label: 'Über OKUN Workforce',
          click: () => dialog.showMessageBox(fenster, {
            type: 'info',
            title: 'OKUN Workforce',
            message: `OKUN Workforce ${app.getVersion()}`,
            detail: `Anlage: ${anlage()}\n\nDas Programm zeigt Ihre Anlage. Lohn, Zeiten und `
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

    /*
     * §205 Einmal nach dem Start nachsehen, und danach alle sechs Stunden.
     *
     * Die Verzögerung ist Absicht: In den ersten Sekunden lädt das Fenster
     * die Anlage, und darauf wartet jemand. Eine Aktualisierung wartet nicht,
     * sie kann warten.
     *
     * Sechs Stunden, weil die Hülle sich selten ändert und das Programm oft
     * tagelang offen bleibt. Häufiger zu fragen brächte nichts und kostet
     * jeden Kunden Datenverkehr.
     */
    aktualisierung = aktualisierungEinrichten()
    if (aktualisierung) {
      setTimeout(() => nachAktualisierungSuchen(false), 20_000)
      setInterval(() => nachAktualisierungSuchen(false), 6 * 60 * 60 * 1000)
    }

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
