const CACHE_VERSION = 'okun-v4'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`

const STATIC_ASSETS = [
  '/',
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
