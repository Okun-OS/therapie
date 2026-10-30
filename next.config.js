/** @type {import('next').NextConfig} */
// §84: Build-Kennung sichtbar machen — damit sofort erkennbar ist, welcher
// Stand tatsächlich läuft (Railway setzt RAILWAY_GIT_COMMIT_SHA).
//
// §251 Daneben lag eine leere `next.config.mjs`. Next.js nimmt `.js` zuerst,
// also hatte sie keine Wirkung — aber wäre diese Datei je umbenannt oder
// entfernt worden, hätte still eine Konfiguration ohne Inhalt übernommen.
// Entfernt.
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID:
      (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || 'lokal',
  },

  async headers() {
    return [
      {
        /*
         * §251 Die Startseite darf im Browser nicht liegen bleiben.
         *
         * Nachgemessen wird sie im Betrieb mit
         * `cache-control: s-maxage=31536000, stale-while-revalidate`
         * ausgeliefert. `s-maxage` gilt nur für gemeinsame Zwischenspeicher —
         * ein Browser sucht sich ohne `max-age` seine eigene Regel. Liegt
         * die Seite dort, wird der Server gar nicht erst gefragt, und die
         * Weiterleitung für Angemeldete läuft nie. Genau so sieht die
         * gemeldete Sekunde aus.
         *
         * `no-cache` heißt nicht „nicht speichern", sondern „vor jeder
         * Benutzung nachfragen". Die Seite bleibt also schnell — sie wird nur
         * nicht mehr blind aus dem Speicher genommen. Für eine Seite, die je
         * nach Anmeldung etwas anderes tun muss, ist das die richtige Regel.
         */
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, must-revalidate' },
        ],
      },
      {
        /*
         * §251 Und der Dienst-Arbeiter selbst erst recht nicht.
         *
         * Er trägt die Regeln, nach denen alles andere gespeichert wird. Eine
         * alte Fassung, die hängenbleibt, hält auch alle alten Regeln am
         * Leben — und genau das kann erklären, warum eine Korrektur am
         * Zwischenspeicher ein Gerät tagelang nicht erreicht.
         */
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
