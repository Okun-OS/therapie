import type { CapacitorConfig } from '@capacitor/cli'

/**
 * §139 Die native Hülle — Etappe 3 auf dem Weg in die Stores.
 *
 * WARUM DIE HÜLLE DIE SEITE LÄDT UND SIE NICHT MITBRINGT
 *
 * OKUN Workforce ist keine Sammlung von Dateien, die man einpacken kann: Die
 * Seiten entstehen auf dem Server, dort liegen Lohn, Zeiten und Rechte. Eine
 * App, die den Stand vom Tag der Einreichung mitbrächte, wäre am Tag darauf
 * falsch — und jede Korrektur an der Lohnabrechnung müsste durch eine
 * Store-Prüfung. Bei einem Programm, das Gehälter rechnet, ist das untragbar.
 *
 * Die Hülle lädt deshalb die laufende Anwendung. Was sie beisteuert, ist das,
 * was ein Browser nicht kann und was Apple sehen will:
 *
 *   - echte Push-Nachrichten über APNs und FCM, auch wenn die App zu ist
 *   - die Kamera für den Krankenschein, ohne Umweg über die Dateiauswahl
 *   - Face ID / Fingerabdruck als Sperre vor Lohn- und Personaldaten
 *   - der Umgang mit dem Funkloch (§138), der in der Hülle sichtbar wird
 *
 * Ohne diese vier wäre die App ein Lesezeichen, und Apple lehnt Lesezeichen ab
 * (Richtlinie 4.2). Mit ihnen ist sie ein Werkzeug.
 *
 * DIE ADRESSE IST EINSTELLBAR
 * `OKUN_APP_URL` beim Bauen der Hülle setzen. Ohne Angabe zeigt sie auf die
 * laufende Anlage. Vor der Einreichung gehört hier eine eigene Domain hin —
 * siehe APP-STORES.md.
 */

const adresse = process.env.OKUN_APP_URL?.replace(/\/+$/, '')
  || 'https://therapie-production.up.railway.app'

const config: CapacitorConfig = {
  appId: 'de.okun.workforce',
  appName: 'OKUN Workforce',

  // Es gibt kein mitgeliefertes Web-Verzeichnis; die Hülle lädt die Anwendung.
  // Der Ordner muss trotzdem existieren — dort liegt die Notfallseite, die
  // erscheint, wenn das Telefon die Anlage gar nicht erreicht.
  webDir: 'native/web',

  server: {
    url: adresse,
    // Nur über https. Ein Klartextweg wäre bei Lohndaten nicht vertretbar,
    // und beide Stores verlangen es ohnehin.
    androidScheme: 'https',
    cleartext: false,
    // Wenn die Anlage gar nicht antwortet, zeigt die Hülle diese Seite statt
    // eines leeren weißen Bildschirms. Ein Prüfer bei Apple sieht sonst nichts
    // und lehnt ab — und ein Mitarbeiter im Zug wüsste nicht, woran es liegt.
    errorPath: 'fehler.html',
  },

  ios: {
    // §139 Dienst-Arbeiter (und damit der Offline-Zwischenspeicher aus §138)
    // laufen in Apples WebView nur bei „app-bound domains". Der Preis: Die App
    // darf dann nur noch auf die unten in der Info.plist eingetragenen Domains
    // navigieren. Für uns kein Verlust — sie soll nirgendwo sonst hin.
    limitsNavigationsToAppBoundDomains: true,
    contentInset: 'always',
    backgroundColor: '#1A1D1F',
  },

  android: {
    backgroundColor: '#1A1D1F',
    // Kein Debug-Zugang in einer App, die Lohndaten anzeigt.
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#1A1D1F',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    PushNotifications: {
      // Ohne Ton kein Hinweis auf einen kurzfristigen Ausfall — und genau
      // dafür ist die Benachrichtigung da.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
