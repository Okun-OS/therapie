// §239 Von v4 auf v5: Die alte Fassung hatte die VERKAUFSSEITE vorgespeichert.
// §251 Von v5 auf v6: Sie landete trotzdem im Speicher — siehe unten bei der
// Behandlung von `/`. Ohne Erhöhung bliebe die gespeicherte Kopie auf jedem
// Gerät liegen, das die App schon hat.
const CACHE_VERSION = 'okun-v6'
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

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(k => k.startsWith('okun-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map(k => caches.delete(k))
        )
      ),
    ])
  )
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
