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
  // (`electron-builder --project desktop`), und `desktop/package.json` hat
  // keine Abhängigkeiten.
  directories: {
    output: 'pakete',
    buildResources: 'symbole',
  },

  files: ['haupt.js', 'bruecke.js', '*.html', 'symbole/**', 'package.json'],

  // Die Fassung von Electron steht in der Entwicklungsliste des Hauptpakets;
  // das Hüllenpaket kennt sie nicht.
  electronVersion: require('../node_modules/electron/package.json').version,

  artifactName: 'OKUN-Workforce-${version}-${os}-${arch}.${ext}',

  // §173 Keine Selbstaktualisierung — bewusst, und mit einem Grund, der
  // nicht „noch nicht gebaut" heißt.
  //
  // Die Hülle enthält keine Anwendung. Korrekturen an Lohn, Dienstplan oder
  // Recht gehen über den Server und sind beim nächsten Öffnen da; niemand
  // wartet auf ein Programm-Update. Was sich hier ändern könnte, ist das
  // Fenster selbst — selten. Eine Selbstaktualisierung bräuchte dafür einen
  // dauerhaft erreichbaren Ausgabekanal und eine Signatur, also zwei
  // Angriffsflächen für einen Nutzen, den es kaum gibt.
  //
  // Wird das später anders gesehen: `provider: 'generic'` mit einer Adresse,
  // die OKUN kontrolliert, plus electron-updater. Siehe DESKTOP.md.
  publish: null,

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
    /*
     * §187 Die Signatur — eingehängt, sobald sie da ist.
     *
     * WARUM HIER EIN BEFEHL STEHT UND KEIN ZERTIFIKAT
     * Seit Juni 2023 verlangen die Zertifizierungsstellen, dass der private
     * Schlüssel eines Code-Signing-Zertifikats auf zertifizierter Hardware
     * liegt — auf einem USB-Stick, der per Post kommt, oder in einem
     * Cloud-Tresor. Eine Datei mit Kennwort, wie es sie bis dahin gab, wird
     * nicht mehr ausgestellt.
     *
     * Für diesen Bau heißt das: Der Paketbauer kann nicht selbst signieren.
     * Er kann nur einen Befehl aufrufen, der es tut — und welcher das ist,
     * hängt davon ab, wofür sich das Haus entscheidet (Azure, ein
     * Cloud-Tresor der Zertifizierungsstelle, ein Stick am eigenen Rechner).
     * Deshalb steht hier kein Anbieter, sondern eine Stelle, an der einer
     * eingehängt wird:
     *
     *     OKUN_SIGN_BEFEHL='azuresigntool sign … "{datei}"' npm run desktop:win
     *
     * `{datei}` wird durch den Pfad der zu signierenden Datei ersetzt.
     *
     * WARUM `signtoolOptions` UND NICHT `win.sign`
     * Bis electron-builder 24 lag der Haken direkt unter `win.sign`. Seit 25
     * ist er nach `win.signtoolOptions.sign` umgezogen, weil daneben
     * `win.azureSignOptions` getreten ist. Der alte Platz wird nicht
     * stillschweigend ignoriert, sondern bricht den Bau ab:
     * „configuration.win should be one of these: null". Steht hier eines
     * Tages wieder die alte Form, ist das die Meldung dazu.
     */
    signtoolOptions: {
      /*
       * Nur SHA-256 — und das hat zwei Gründe.
       *
       * Voreingestellt signiert der Paketbauer jede Datei zweimal, mit SHA-1
       * und mit SHA-256. Das SHA-1-Blatt ist für Windows 7 vor dem ersten
       * Service Pack; dort läuft diese Hülle nicht, und keine heute
       * ausgestellte Zertifizierung unterschreibt noch SHA-1.
       *
       * Nebeneffekt, der hier willkommen ist: Der Haken unten wird damit
       * einmal pro Datei aufgerufen und nicht zweimal — die Warnung steht
       * also einmal da und nicht doppelt.
       */
      signingHashAlgorithms: ['sha256'],

      /*
       * OHNE `OKUN_SIGN_BEFEHL` WIRD UNSIGNIERT GEBAUT — und zwar laut.
       * Ein unsigniertes Installationsprogramm ist kein Fehler, solange
       * jemand es weiß: Zum Ausprobieren reicht es. Es still zu bauen und
       * erst beim Kunden zu merken, dass Windows „Unbekannter Herausgeber"
       * sagt, ist der Fehler.
       */
      sign: async (konfiguration) => {
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
        // Über die Shell, weil der Befehl des Anbieters eigene
        // Anführungszeichen und Umgebungsvariablen mitbringt. Er kommt aus der
        // Umgebung dieses Baus, nicht von außen — hier wird nichts Fremdes
        // ausgeführt.
        execFileSync(process.env.SHELL || '/bin/sh', ['-c', fertig], { stdio: 'inherit' })
      },
    },
  },

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
