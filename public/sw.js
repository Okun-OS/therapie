// §239 Von v4 auf v5: Die alte Fassung hatte die VERKAUFSSEITE vorgespeichert.
// §251 Von v5 auf v6: Sie landete trotzdem im Speicher — siehe unten bei der
// Behandlung von `/`. Ohne Erhöhung bliebe die gespeicherte Kopie auf jedem
// Gerät liegen, das die App schon hat.
// §264 Von v6 auf v7 — und diesmal wird AUFGERÄUMT, nicht umbenannt.
//
// GEMELDET, ZUM FÜNFZEHNTEN MAL
// „Hat sich gar nichts verändert. Ich sehe immer noch die URL und auch immer
//  noch die Website. Langsam werde ich richtig sauer."
//
// NACHGEMESSEN, STATT WEITER ZU RATEN
// Der Server liefert das Richtige: `/` und `/app` antworten einem Angemeldeten
// mit dem dunklen Startbildschirm, nicht mit der Verkaufsseite. Geprüft am
// 29.10.2026 unmittelbar gegen okun-workforce.com.
//
// Gleichzeitig: App vom Startbildschirm, und als erstes die weiße
// Verkaufsseite. Beides zusammen lässt nur einen Schluss zu — diese Seite
// kommt gar nicht vom Server. Sie liegt auf dem Gerät.
//
// WIE SIE DORT HINKOMMT
// Bis §239 stand `'/'` in der Vorspeicherung: Bei der Installation wurde die
// Verkaufsseite mitgespeichert. §239 hat sie aus der Liste genommen, §251 das
// Nachspeichern unterbunden — beides wirkt aber NUR, wenn die neue Fassung des
// Dienst-Arbeiters auch das Sagen hat. Solange die alte läuft, gelten ihre
// Regeln, und sie liefert ihre Kopie aus, ohne den Server zu fragen.
//
// Und hier liegt der Konstruktionsfehler, der das am Leben gehalten hat: Beim
// Aufräumen wurden bisher nur Speicher gelöscht, deren Name NICHT zur neuen
// Fassung passt. Was in `okun-v6-static` lag, blieb liegen — und wer von v5
// auf v6 kam, trug die alte Kopie mit hinüber, weil sie beim Umstieg aus der
// gespeicherten Seite neu angelegt wurde.
//
// Diese Fassung löscht deshalb ALLES, was wir je gespeichert haben, und lädt
// danach offene Fenster neu. Ein Dienst-Arbeiter, der eine falsche Seite
// ausliefert, darf nicht darauf hoffen, dass sie irgendwann von selbst
// verschwindet.
const CACHE_VERSION = 'okun-v7'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`

/*
 * §239 Hier stand `'/'` — die Verkaufsseite, bei der Installation
 * vorgespeichert.
 *
 * Gemeldet: „Wenn ich auf die App gehe, dann kommt immer erst diese
 * Kack-Website." Genau so kam sie: Die App startete auf `/`, und sobald das
 * Netz langsam war, lieferte dieser Zwischenspeicher die gespeicherte
 * Verkaufsseite aus. Die Weiterleitung der Middleware läuft dann nicht — sie
 * steckt in einer Antwort, die nie geholt wurde.
 *
 * Eine Weiterleitung lässt sich nicht vorspeichern. Die App startet deshalb
 * auf `/app` (siehe `src/app/app/page.tsx`), und `/` liegt hier nicht mehr.
 * `/offline` bleibt: Das ist eine Seite, die es ohne Netz geben MUSS.
 */
const STATIC_ASSETS = [
  '/offline',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/icon-maskable-192.png',
  '/brand/icon-maskable-512.png',
]

/**
 * §264 Beim Einbau zuerst ALLES wegräumen, was je gespeichert wurde.
 *
 * Bisher wurde beim Aufräumen nur gelöscht, was nicht zur aktuellen Fassung
 * gehört. Das klingt vernünftig und ist genau die Lücke: Die Verkaufsseite,
 * einmal im Speicher, wandert beim Umstieg auf die nächste Fassung mit —
 * ausgeliefert aus einem Speicher, dessen Name zur NEUEN Fassung passt.
 *
 * Hier wird deshalb rückhaltlos geleert. Es geht dabei nichts verloren, was
 * nicht in Sekunden wieder da wäre: Es sind Kopien, keine Daten. Was ein
 * Mensch eingegeben und noch nicht abgeschickt hat, liegt woanders — in der
 * Warteschlange, nicht hier.
 */
async function allesLeeren() {
  const namen = await caches.keys()
  await Promise.all(namen.map(n => caches.delete(n)))
}

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    allesLeeren()
      .then(() => caches.open(STATIC_CACHE))
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  )
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await allesLeeren().catch(() => {})
    await caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
    await self.clients.claim()

    /*
     * §264 Und dann die offenen Fenster neu laden.
     *
     * Ohne das bliebe genau das auf dem Bildschirm stehen, worüber sich
     * jemand gerade beschwert — die alte Seite aus dem alten Speicher. Sie
     * verschwände erst beim nächsten Öffnen, und „mach die App einmal ganz
     * zu" ist keine Antwort, die man Pflegekräften zumuten sollte.
     *
     * `navigate` ist dafür das richtige Mittel: Es braucht keine Mithilfe der
     * Seite. Eine Nachricht an die Seite zu schicken würde hier nichts nützen
     * — die alte Seite hat auch das alte Programm und hörte gar nicht zu.
     */
    const fenster = await self.clients.matchAll({ type: 'window' })
    await Promise.all(fenster.map(f => {
      try { return f.navigate(f.url).catch(() => undefined) } catch { return undefined }
    }))
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET, cross-origin, and API calls (always network for API)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) {
    // §138 Was ein Mitarbeiter unterwegs LESEN koennen muss, auch wenn kein
    // Netz da ist: der eigene Dienstplan, die Dienste, der Stempelzustand, die
    // eigenen Unterlagen. Dafuer wird die letzte Antwort aufgehoben und im
    // Funkloch ausgeliefert — mit einem Merkmal im Kopf, damit die Oberflaeche
    // sagen kann, dass es ein aelterer Stand ist.
    //
    // Alles andere bleibt ungespeichert: Eine Lohnabrechnung oder eine
    // Mitarbeiterliste im Zwischenspeicher eines Telefons waere ein
    // Datenschutzproblem, kein Komfortgewinn.
    const OFFLINE_LESBAR = [
      '/api/schedule-entries',
      '/api/shifts',
      '/api/time-tracking/stempeln',
      '/api/absences',
      '/api/vacation-requests',
    ]
    const darfLiegenbleiben = OFFLINE_LESBAR.some(p => url.pathname === p)

    if (darfLiegenbleiben) {
      event.respondWith(
        fetch(request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone))
            }
            return response
          })
          .catch(() =>
            caches.match(request).then(cached => {
              if (!cached) {
                return new Response(JSON.stringify({ error: 'offline' }), {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' },
                })
              }
              // Der Oberflaeche sagen, dass das ein gespeicherter Stand ist.
              const kopf = new Headers(cached.headers)
              kopf.set('X-Okun-Stand', 'gespeichert')
              return cached.blob().then(inhalt =>
                new Response(inhalt, { status: 200, headers: kopf }))
            })
          )
      )
      return
    }

    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }

  /*
   * §251 Die Startseite wird NIE gespeichert und NIE aus dem Speicher
   * ausgeliefert.
   *
   * GEMELDET, DREIMAL
   * „Ich sehe immer noch, wenn ich auf die App gehe, erstmal für eine Sekunde
   * die Website und dann erst werde ich in die App geschickt."
   *
   * §239 hat `'/'` aus der Vorspeicherung genommen. Das reichte nicht: Die
   * Regel darunter speichert JEDE erfolgreiche Seitenantwort — und wer
   * abgemeldet auf `/` geht, bekommt die Verkaufsseite mit HTTP 200. Damit
   * liegt sie wieder im Speicher.
   *
   * Angemeldet antwortet der Server auf `/` mit einer Weiterleitung. Ist das
   * Netz aber langsam oder bricht die Anfrage ab, greift der Rückfall unten —
   * und liefert die gespeicherte Verkaufsseite aus. Dann läuft keine
   * Middleware, und erst der Browser schiebt die Weiterleitung nach. Genau
   * eine Sekunde.
   *
   * Nachgemessen trägt die Startseite im Betrieb `s-maxage=31536000` und
   * kommt aus dem Zwischenspeicher des Gerüsts (`x-nextjs-cache: HIT`) —
   * sie ist also eine Seite, die sehr gerne irgendwo liegen bleibt.
   *
   * Für `/` gibt es deshalb kein Zwischenspeichern und keinen Rückfall auf
   * eine Kopie. Ohne Netz erscheint die Offline-Seite; die sagt wenigstens
   * die Wahrheit.
   */
  if (url.pathname === '/') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline')))
    return
  }

  // HTML pages: NETWORK-FIRST. Nach einem Deploy zählt sofort der neue Stand;
  // der Cache ist ausschließlich Offline-Fallback. (Vorher: stale-while-
  // revalidate — das lieferte nach jedem Deploy erst die ALTE Seite aus.)
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then(cached => cached || caches.match('/offline'))
      )
  )
})

self.addEventListener('push', event => {
  let data = { title: 'OKUN Workforce', body: '' }
  try {
    data = event.data ? event.data.json() : data
  } catch {
    data.body = event.data ? event.data.text() : ''
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'OKUN Workforce', {
      body: data.body || '',
      icon: '/brand/icon-192.png',
      badge: '/brand/icon-96.png',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
