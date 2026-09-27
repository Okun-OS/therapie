/**
 * §173 Wie aus dem Programm eine Datei zum Herunterladen wird.
 *
 * Was gebaut wird, ist eine Hülle um die laufende Anlage — nicht die Anlage
 * selbst. Deshalb ist das Paket klein und enthält keine Kundendaten, keine
 * Datenbank und keinen Schlüssel.
 *
 * WARUM DIES EINE .js-DATEI IST UND KEINE .yml
 * Der Paketbauer verlangt für ein .deb einen Verantwortlichen mit
 * E-Mail-Adresse. Die gehört zu OKUN und steht in der Umgebung
 * (`OKUN_FIRMA`, `OKUN_KONTAKT`) — dieselben Angaben wie im Impressum. Eine
 * erfundene Adresse in einem Paket, das bei Kunden installiert wird, wäre
 * eine Falschangabe; deshalb wird sie hier gelesen und nicht geraten.
 *
 *     OKUN_FIRMA="…" OKUN_KONTAKT="…" npm run desktop:linux
 */
const firma = process.env.OKUN_FIRMA || 'OKUN'
const kontakt = process.env.OKUN_KONTAKT || 'kontakt@okun.de'

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
    synopsis: 'Dienstpläne, Zeiten und Lohn für Pflege, Kita und Eingliederungshilfe',
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
