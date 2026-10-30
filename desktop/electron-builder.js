/**
 * §173 Wie aus dem Programm eine Datei zum Herunterladen wird.
 *
 * Was gebaut wird, ist eine Hülle um die laufende Anlage — nicht die Anlage
 * selbst. Deshalb ist das Paket klein und enthält keine Kundendaten, keine
 * Datenbank und keinen Schlüssel.
 *
 * WARUM DIES EINE .js-DATEI IST UND KEINE .yml
 * Der Paketbauer verlangt für ein .deb einen Verantwortlichen mit
 * E-Mail-Adresse. Die gehört zu OKUN — dieselben Angaben wie im Impressum.
 * Eine erfundene Adresse in einem Paket, das bei Kunden installiert wird,
 * wäre eine Falschangabe; deshalb wird sie hier gelesen und nicht geraten.
 *
 * §187 WOHER DIE ANGABEN KOMMEN — UND WAS HIER VORHER FALSCH WAR
 * Bis zum 05.10.2026 stand hier `OKUN_FIRMA || 'OKUN'` und
 * `OKUN_KONTAKT || 'kontakt@okun.de'`. Die beiden Variablen stehen nur in
 * der Umgebung des Servers, nicht in der eines Baus — also griff praktisch
 * immer der Rückfallwert, und jedes gebaute .deb trug einen Verantwortlichen
 * mit einer Domain, die es nicht gibt. Gemerkt hätte man das erst an einem
 * Kundenrechner.
 *
 * Jetzt ist `desktop/package.json` die eine Quelle: Dort steht der Name, den
 * Windows im Installationsprogramm anzeigt, der im Signaturzertifikat stehen
 * wird und der ins .deb kommt. Die Umgebungsvariablen dürfen ihn weiterhin
 * überschreiben — für einen Bau im Auftrag eines anderen Hauses.
 *
 *     OKUN_FIRMA="…" OKUN_KONTAKT="…" npm run desktop:linux
 */
const huelle = require('./package.json')

// „Name <adresse>" auseinandernehmen. Steht dort etwas anderes, bleibt der
// ganze Text der Name — besser eine lange Zeile als eine erfundene Adresse.
const zerlegt = /^(.*?)\s*<([^>]+)>\s*$/.exec(huelle.author ?? '')
const firma = process.env.OKUN_FIRMA || (zerlegt ? zerlegt[1] : huelle.author)
const kontakt = process.env.OKUN_KONTAKT || (zerlegt ? zerlegt[2] : null)

if (!firma || !kontakt) {
  throw new Error(
    'desktop/package.json braucht `author` als "Firma <adresse@domain>" — '
    + 'der Paketbauer schreibt beides in die Pakete, die beim Kunden landen. '
    + `Vorgefunden: ${JSON.stringify(huelle.author)}`,
  )
}

/**
 * §187 Der Weg über Azure — wenn er eingerichtet ist.
 *
 * WARUM ES ZWEI WEGE GIBT UND NICHT EINEN
 * electron-builder 26 kann mit Azure Artifact Signing (früher „Trusted
 * Signing") selbst reden; dafür ist `win.azureSignOptions` da. Das ist der
 * gerade Weg: kein fremdes Programm, kein Shell-Befehl, keine
 * Anführungszeichen, die auf dem einen Rechner anders gemeint sind als auf
 * dem anderen.
 *
 * Nur ist Azure eine Entscheidung, die noch nicht gefallen ist. Fällt sie
 * anders aus — Zertifikat im Cloud-Tresor der Zertifizierungsstelle, oder ein
 * USB-Stick am eigenen Rechner — dann bleibt der allgemeine Weg über
 * `OKUN_SIGN_BEFEHL`. Hier steht deshalb beides, und die Umgebung entscheidet.
 *
 * Gesetzt werden müssen drei Angaben aus dem Azure-Portal plus die
 * Anmeldedaten, die Azure selbst liest (`AZURE_TENANT_ID`,
 * `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`):
 *
 *     OKUN_AZURE_ENDPUNKT=https://neu.codesigning.azure.net
 *     OKUN_AZURE_KONTO=<Name des Artifact-Signing-Kontos>
 *     OKUN_AZURE_PROFIL=<Name des Zertifikatsprofils>
 *
 * Der Herausgebername kommt NICHT aus der Umgebung, sondern aus
 * `package.json` — er muss wortgleich dem Namen im Zertifikat entsprechen,
 * und das ist derselbe, der ins .deb geht. Eine vierte Variable wäre eine
 * vierte Stelle, an der er abweichen kann.
 */
const azureTeile = {
  endpoint: process.env.OKUN_AZURE_ENDPUNKT,
  codeSigningAccountName: process.env.OKUN_AZURE_KONTO,
  certificateProfileName: process.env.OKUN_AZURE_PROFIL,
}
const azureGesetzt = Object.entries(azureTeile).filter(([, v]) => v)

if (azureGesetzt.length && azureGesetzt.length < 3) {
  // Halb eingerichtet ist schlimmer als gar nicht: Der Bau liefe sonst über
  // den anderen Weg oder unsigniert weiter, und niemand sähe, dass Azure
  // gemeint war.
  const fehlen = Object.entries(azureTeile).filter(([, v]) => !v).map(([k]) => k)
  throw new Error(
    'Azure-Signatur nur halb eingerichtet. Es fehlen: '
    + fehlen.map(k => ({
      endpoint: 'OKUN_AZURE_ENDPUNKT',
      codeSigningAccountName: 'OKUN_AZURE_KONTO',
      certificateProfileName: 'OKUN_AZURE_PROFIL',
    })[k]).join(', ')
    + ' — siehe DESKTOP.md, Abschnitt §187.',
  )
}

const azure = azureGesetzt.length === 3
  ? { ...azureTeile, publisherName: firma }
  : null

/**
 * §187 Der allgemeine Weg: ein Befehl aus der Umgebung.
 *
 * Fällt die Entscheidung nicht auf Azure, sondern auf einen Cloud-Tresor der
 * Zertifizierungsstelle oder einen USB-Stick am eigenen Rechner, dann weiß
 * nur der Anbieter, wie signiert wird. Hier steht deshalb kein Anbieter,
 * sondern eine Stelle, an der einer eingehängt wird:
 *
 *     OKUN_SIGN_BEFEHL='signtool sign /fd sha256 … "{datei}"' npm run desktop:win
 *
 * `{datei}` wird durch den Pfad der zu signierenden Datei ersetzt.
 *
 * OHNE DIESE VARIABLE WIRD UNSIGNIERT GEBAUT — und zwar laut. Ein
 * unsigniertes Installationsprogramm ist kein Fehler, solange jemand es
 * weiß: Zum Ausprobieren reicht es. Es still zu bauen und erst beim Kunden
 * zu merken, dass Windows „Unbekannter Herausgeber" sagt, ist der Fehler.
 */
async function signierenPerBefehl(konfiguration) {
  const befehl = process.env.OKUN_SIGN_BEFEHL
  if (!befehl) {
    console.warn(
      '\n  ⚠ UNSIGNIERT: ' + konfiguration.path + '\n'
      + '    Windows zeigt beim ersten Start „Unbekannter Herausgeber".\n'
      + '    Zum Signieren OKUN_SIGN_BEFEHL setzen — siehe DESKTOP.md.\n',
    )
    return
  }
  const { execFileSync } = require('node:child_process')
  const fertig = befehl.replaceAll('{datei}', konfiguration.path)
  console.log('  Signiere: ' + konfiguration.path)
  // Über die Shell, weil der Befehl des Anbieters eigene Anführungszeichen
  // und Umgebungsvariablen mitbringt. Er kommt aus der Umgebung dieses Baus,
  // nicht von außen — hier wird nichts Fremdes ausgeführt.
  execFileSync(process.env.SHELL || '/bin/sh', ['-c', fertig], { stdio: 'inherit' })
}

/*
 * §187 Genau EIN Signaturabschnitt, von der Umgebung bestimmt.
 *
 * Beides gleichzeitig zu setzen wäre mehrdeutig: Der Paketbauer gäbe eine
 * Warnung aus und nähme Azure. Deshalb wird hier einer der beiden Abschnitte
 * eingesetzt und nicht beide.
 *
 * WARUM `signtoolOptions` UND NICHT `win.sign`
 * Bis electron-builder 24 lag der Haken direkt unter `win.sign`. Seit 25 ist
 * er nach `win.signtoolOptions.sign` umgezogen, weil daneben
 * `win.azureSignOptions` getreten ist. Der alte Platz wird nicht
 * stillschweigend ignoriert, sondern bricht den Bau ab:
 * „configuration.win should be one of these: null". Steht hier eines Tages
 * wieder die alte Form, ist das die Meldung dazu.
 */
const signatur = azure
  ? { azureSignOptions: azure }
  : {
    signtoolOptions: {
      /*
       * Nur SHA-256 — und das hat zwei Gründe.
       *
       * Voreingestellt signiert der Paketbauer jede Datei zweimal, mit SHA-1
       * und mit SHA-256. Das SHA-1-Blatt ist für Windows 7 vor dem ersten
       * Service Pack; dort läuft diese Hülle nicht, und keine heute
       * ausgestellte Zertifizierung unterschreibt noch SHA-1.
       *
       * Nebeneffekt, der hier willkommen ist: Der Haken wird damit einmal pro
       * Datei aufgerufen und nicht zweimal — die Warnung steht also einmal da
       * und nicht doppelt.
       */
      signingHashAlgorithms: ['sha256'],
      sign: signierenPerBefehl,
    },
  }

module.exports = {
  appId: 'de.okun.workforce',
  productName: 'OKUN Workforce',
  copyright: `© ${new Date().getFullYear()} ${firma}`,

  // §173 Warum dieser Ordner ein eigenes Paket ist, und nicht nur ein
  // Unterordner.
  //
  // Der Paketbauer packt IMMER alle Produktionsabhängigkeiten des Projekts
  // ein, in dem er läuft — eine Liste in `files` ändert daran nichts. Der
  // erste Versuch aus dem Hauptverzeichnis heraus ergab 280 MB: Prisma mit
  // seinem Rechenkern, der Anthropic-Zugang, der Mailversand. Nichts davon
  // braucht ein Fenster, das eine Webseite lädt — und jedes Stück davon wäre
  // auf jedem Kundenrechner zu pflegen und auf Sicherheitslücken zu prüfen.
  //
  // Gebaut wird deshalb MIT DIESEM Verzeichnis als Projekt
  // (`electron-builder --project desktop`). §205: `desktop/package.json` hat
  // seither genau eine Abhängigkeit — `electron-updater`, 16 Pakete, 3,3 MB.
  directories: {
    output: 'pakete',
    buildResources: 'symbole',
  },

  // §205 `node_modules/**` steht ausdrücklich dabei. Sobald `files` gesetzt
  // ist, gilt nur noch diese Liste — ohne die Zeile fehlte `electron-updater`
  // im Paket, und die Selbstaktualisierung wäre still ausgefallen. Still,
  // weil das Programm genau dafür einen Rückfallweg hat (siehe haupt.js).
  files: [
    'haupt.js', 'bruecke.js', '*.html', 'symbole/**', 'package.json',
    'node_modules/**',
  ],

  // Die Fassung von Electron steht in der Entwicklungsliste des Hauptpakets;
  // das Hüllenpaket kennt sie nicht.
  electronVersion: require('../node_modules/electron/package.json').version,

  artifactName: 'OKUN-Workforce-${version}-${os}-${arch}.${ext}',

  /**
   * §205 Der Ausgabeort für die Selbstaktualisierung.
   *
   * In §173 stand hier eine Absage: Die Hülle enthält keine Anwendung,
   * Korrekturen gehen über den Server. Das stimmt weiterhin — nur ändert
   * sich seit §201 die Hülle selbst (Fensterrahmen, als Nächstes Offline
   * und Benachrichtigungen). Ohne Selbstaktualisierung erreicht davon
   * nichts jemanden, der das Programm schon installiert hat.
   *
   * `generic` statt GitHub: Die Dateien gehören auf eine Adresse, die OKUN
   * kontrolliert. Ein privates GitHub-Repository bräuchte ein Zugriffswort
   * in jedem ausgelieferten Programm — also ein Geheimnis auf dem Rechner
   * jedes Kunden, das dort nichts zu suchen hat.
   *
   * OHNE `OKUN_UPDATE_URL` BLEIBT ES AUS, und zwar absichtlich: Dann legt
   * electron-builder kein `app-update.yml` an, das Programm merkt das und
   * sucht gar nicht erst. Ein eingetragener Ausgabeort, an dem nichts liegt,
   * wäre schlechter — dann liefe bei jedem Start eine Suche ins Leere.
   *
   * Wohin die Dateien kommen, steht noch nicht fest (DESKTOP.md, „Eine Seite
   * zum Herunterladen"). Gebraucht werden dort `latest.yml` und die .exe aus
   * `desktop/pakete/`.
   */
  publish: process.env.OKUN_UPDATE_URL
    ? { provider: 'generic', url: process.env.OKUN_UPDATE_URL, channel: 'latest' }
    : null,

  linux: {
    category: 'Office',
    icon: 'symbole/icon.png',
    maintainer: `${firma} <${kontakt}>`,
    synopsis: 'Dienstpläne, Zeiten und Lohn — vom Bewerber bis zur Abrechnung',
    // §173 Der Programmname für das Fenster-Klassenzeichen: Ohne ihn
    // ordnen Linux-Oberflächen das laufende Fenster nicht dem Starter zu
    // und zeigen ein leeres Symbol in der Leiste.
    executableName: 'okun-workforce',
    desktop: {
      entry: {
        Name: 'OKUN Workforce',
        Comment: 'Dienstpläne, Zeiten und Lohn',
        Categories: 'Office;',
      },
    },
    target: [
      // AppImage läuft ohne Installation und ohne Administratorrechte —
      // das Gegenstück zu „herunterladen und starten".
      'AppImage',
      // .deb für Einrichtungen mit verwalteten Arbeitsplätzen.
      'deb',
    ],
  },

  win: {
    icon: 'symbole/icon.png',
    target: ['nsis'],
    // §187 Die Signatur. Welcher der beiden Abschnitte hier steht, entscheidet
    // die Umgebung — nachzulesen bei `signatur` weiter oben.
    ...signatur,
  },

  /**
   * §205 Der Installationsassistent.
   *
   * Daran misst jeder in den ersten dreißig Sekunden, ob eine Software ernst
   * gemeint ist — lange bevor er eine Funktion gesehen hat. Eine Datei, die
   * sich wortlos selbst entpackt, sieht aus wie ein Download von 2004.
   */
  nsis: {
    // Ohne Administratorrechte installierbar. In Einrichtungen hat die
    // Verwaltung selten Administratorrechte auf ihrem Rechner, und auf die
    // IT zu warten heißt oft: es passiert nie.
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'OKUN Workforce',

    // Die beiden Bilder des Assistenten. Erzeugt von
    // `node scripts/installer-bilder.mjs`; NSIS kann nur BMP, und nur in
    // genau diesen Maßen (164×314 und 150×57).
    installerSidebar: 'symbole/installer-seite.bmp',
    uninstallerSidebar: 'symbole/installer-seite.bmp',
    installerHeader: 'symbole/installer-kopf.bmp',

    // §205 Was unter „Apps & Features" steht. Ohne das steht dort der
    // technische Name — und daneben ein leeres Feld beim Herausgeber, was
    // in einer Einrichtung mit verwalteten Rechnern sofort auffällt.
    uninstallDisplayName: 'OKUN Workforce',
    menuCategory: false,

    // Nach der Installation gleich starten. Wer gerade installiert hat, will
    // hinein — nicht erst das Startmenü suchen.
    runAfterFinish: true,

    // §205 Beim Deinstallieren bleiben die eigenen Daten liegen: die
    // eingestellte Anlagen-Adresse und die Fensterlage. Wer neu installiert,
    // findet sein Fenster wieder, wo es war. Es sind keine Kunden- und keine
    // Lohndaten — die liegen auf dem Server, nicht hier (siehe §173).
    deleteAppDataOnUninstall: false,

    // Nur den Unterschied zur vorigen Fassung laden. Bei einer Hülle von
    // ~90 MB, die sich um ein paar Zeilen ändert, ist das der Unterschied
    // zwischen „lädt kurz" und „lädt im Hintergrund minutenlang".
    differentialPackage: true,
  },

  mac: {
    icon: 'symbole/icon.png',
    category: 'public.app-category.business',
    target: ['dmg'],
    // Ohne Beglaubigung („notarization") warnt macOS beim ersten Start. Der
    // Schlüssel dafür gehört zum Apple-Developer-Konto und liegt nicht im
    // Repo. Siehe DESKTOP.md.
    hardenedRuntime: true,
  },
}
