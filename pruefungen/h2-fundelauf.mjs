// Nachweis H2: Der Zugang für den regelmäßigen Lauf.
//
// Ein eigener Schlüssel statt einer Anmeldung: Der Lauf soll offene Funde lesen
// und ihren Stand zurückschreiben — mehr nicht. Ein echtes Konto hätte die
// vollen Rechte dieses Kontos, und niemand braucht für Mängelmeldungen Zugriff
// auf Löhne.
//
// Zwei Dinge müssen deshalb sitzen: Ohne Schlüssel geht gar nichts, und mit
// Schlüssel geht nur das eine.

import { BASIS, pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const SCHLUESSEL = process.env.FUNDE_TOKEN ?? ''
const okun = await login('okun@okun.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const mit = async (methode, daten, schluessel = SCHLUESSEL) => {
  const r = await fetch(`${BASIS}/api/okun/funde`, {
    method: methode,
    headers: {
      ...(schluessel ? { authorization: `Bearer ${schluessel}` } : {}),
      'Content-Type': 'application/json',
    },
    body: daten === undefined ? undefined : JSON.stringify(daten),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

// ── H2 Ohne Schlüssel ──────────────────────────────────────────────────────
console.log('=== H2 Ohne Schlüssel ===')

const ohne = await mit('GET', undefined, '')
check('Ohne Schlüssel wird abgewiesen', ohne.status === 401 || ohne.status === 503,
  `HTTP ${ohne.status} · ${ohne.body.error}`)

const falsch = await mit('GET', undefined, 'x'.repeat(40))
check('Ein falscher Schlüssel wird abgewiesen', falsch.status === 401 || falsch.status === 503,
  `HTTP ${falsch.status}`)

if (!SCHLUESSEL) {
  // §135 Ohne hinterlegten Schluessel ist der Weg zu — und genau das wird hier
  // nachgewiesen. Der Rest der Pruefung braucht einen; sie sagt das und hoert
  // auf, statt gruen zu melden, was sie nicht geprueft hat.
  //
  // §138 Zwei verschiedene Lagen, die vorher verwechselt wurden: Entweder hat
  // AUCH DAS SYSTEM keinen Schluessel — dann muss der Weg mit 503 zu sein, und
  // genau das wird geprueft. Oder das System hat einen und nur dieser Prueflauf
  // kennt ihn nicht — dann ist ein rotes Kreuz hier eine Falschmeldung ueber
  // das Programm. Die Pruefung sagt dann, was ihr fehlt, und hoert auf.
  if (ohne.status === 503) {
    check('Ohne hinterlegten Schlüssel bleibt der Weg verschlossen',
      /kein Schlüssel/i.test(ohne.body.error ?? ''), ohne.body.error)
    console.log('\n  Hinweis: FUNDE_TOKEN ist weder im System noch hier gesetzt —')
    console.log('  der zweite Teil (Lesen und Zurückschreiben) wurde nicht ausgeführt.')
  } else {
    console.log('\n  Hinweis: Das System hat einen Schlüssel, dieser Prüflauf nicht.')
    console.log('  Der zweite Teil wurde nicht ausgeführt. Dafür:')
    console.log('    FUNDE_TOKEN=<derselbe Wert wie im System> npm run pruefen -- h2')
  }
  process.exit(bilanz() > 0 ? 1 : 0)
}

// Eine angemeldete Sitzung ist kein Ersatz für den Schlüssel.
const perAnmeldung = await fetch(`${BASIS}/api/okun/funde`, { headers: { cookie: okun } })
check('Auch eine OKUN-Anmeldung ersetzt den Schlüssel nicht',
  perAnmeldung.status === 401, `HTTP ${perAnmeldung.status}`)

// ── H2 Lesen ───────────────────────────────────────────────────────────────
console.log('\n=== H2 Offene Funde lesen ===')

// Ein frischer Fund, damit etwas zu lesen da ist.
const gemeldet = await sende(anna, '/api/bug-reports', 'POST', {
  art: 'fehler', bereich: 'nachrichten',
  title: 'Lauf-Nachweis: Gruppe lässt sich nicht öffnen',
  schritte: 'Als Leitung auf Nachrichten, dann Gruppe öffnen.',
  description: 'Nach dem Klick passiert nichts.',
  erwartet: 'Die Gruppe sollte sich öffnen.',
  haeufigkeit: 'immer',
})
const kennung = gemeldet.body.ticketId

const gelesen = await mit('GET')
check('Mit Schlüssel kommen die offenen Funde', gelesen.status === 200,
  `${gelesen.body.zusammenfassung?.gesamt} Funde`)
const meiner = (gelesen.body.funde ?? []).find(f => f.kennung === kennung)
check('Der neue Fund ist dabei', !!meiner, kennung)
check('Er ist schon einsortiert', meiner?.topf === 'selbst',
  `${meiner?.topf} — ${meiner?.topfText}`)
check('Die Zusammenfassung zählt mit',
  (gelesen.body.zusammenfassung?.selbst ?? 0) >= 1)
check('Die letzten Klicks und die Seite kommen mit',
  'letzteKlicks' in (meiner ?? {}) && 'seite' in (meiner ?? {}))

// ── H2 Zurückschreiben ─────────────────────────────────────────────────────
console.log('\n=== H2 Ergebnis zurückschreiben ===')

const vorgeschlagen = await mit('PATCH', {
  id: meiner.id, vorschlag: 'Der Chat hing am Mitarbeiterdatensatz statt am Konto.',
})
check('Ein Vorschlag lässt sich hinterlegen', vorgeschlagen.status === 200,
  vorgeschlagen.body.error)

const inArbeit = await mit('PATCH', { id: meiner.id, inArbeit: true })
check('Der Fund lässt sich auf „in Arbeit" setzen',
  inArbeit.body.fund?.status === 'in_progress', inArbeit.body.fund?.status)

const erledigt = await mit('PATCH', {
  id: meiner.id, erledigtNotiz: 'Behoben und mit einer Prüfung abgesichert.',
})
check('Und abschließen', erledigt.body.fund?.status === 'resolved')

const danach = await mit('GET')
check('Danach steht er nicht mehr in den offenen Funden',
  !(danach.body.funde ?? []).some(f => f.kennung === kennung))

// ── H2 Was der Lauf NICHT darf ─────────────────────────────────────────────
console.log('\n=== H2 Die Grenzen des Laufs ===')

const vorschlag = await sende(anna, '/api/bug-reports', 'POST', {
  art: 'verbesserung', bereich: 'dienstplan',
  title: 'Lauf-Nachweis: Woche wechseln braucht zu viele Klicks',
  description: 'Man muss über den Kalender gehen.',
  erwartet: 'Pfeile über der Tabelle wären schneller.',
})
const offene = (await mit('GET')).body.funde ?? []
const v = offene.find(f => f.kennung === vorschlag.body.ticketId)
check('Ein Vorschlag liegt im Topf „wartet auf Freigabe"', v?.topf === 'freigabe',
  `${v?.topf}`)

const heimlich = await mit('PATCH', {
  id: v.id, erledigtNotiz: 'Habe ich einfach mal gebaut.',
})
check('Ohne Freigabe kann der Lauf ihn nicht als erledigt melden',
  heimlich.status === 409, `HTTP ${heimlich.status} · ${heimlich.body.error}`)

const selbstFreigegeben = await mit('PATCH', { id: v.id, freigabe: 'freigegeben' })
check('Und sich die Freigabe auch nicht selbst erteilen',
  selbstFreigegeben.status === 200
  && (await hole(okun, '/api/bug-reports')).body.reports
    ?.find(f => f.ticketId === vorschlag.body.ticketId)?.freigabe === 'offen',
  'Freigabe bleibt offen')

// Erst nach der Freigabe durch einen Menschen geht es weiter.
const alleFunde = (await hole(okun, '/api/bug-reports')).body.reports ?? []
const vDb = alleFunde.find(f => f.ticketId === vorschlag.body.ticketId)
await sende(okun, '/api/bug-reports', 'PATCH', { id: vDb.id, freigabe: 'freigegeben' })

const jetzt = await mit('PATCH', {
  id: vDb.id, erledigtNotiz: 'Nach Freigabe umgesetzt.',
})
check('Nach der Freigabe geht es', jetzt.status === 200 && jetzt.body.fund?.status === 'resolved',
  jetzt.body.error)

// Ein Fund, den es nicht gibt.
const unbekannt = await mit('PATCH', { id: 'gibtesnicht', erledigtNotiz: 'x' })
check('Ein unbekannter Fund wird gemeldet, nicht stillschweigend angelegt',
  unbekannt.status === 404, `HTTP ${unbekannt.status}`)

process.exit(bilanz() > 0 ? 1 : 0)
