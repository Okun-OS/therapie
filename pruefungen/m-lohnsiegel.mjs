// Nachweis M: Die zweite Tür vor der Lohnabrechnung — gegen das laufende System.
//
// §201
//
// WORUM ES GEHT
// Eine Sitzung hält dreißig Tage. In einer Wohngruppe steht ein Tablet im
// Dienstzimmer, und wer es in die Hand nimmt, ist angemeldet als der, der es
// zuletzt benutzt hat. Zwischen „Dienstplan ansehen" und „sehen, was die
// Kollegin verdient" lag bisher ein Fingertipp.
//
// WARUM DAS HIER GEPRÜFT WIRD UND NICHT NUR IM MODULTEST
// Weil der ganze Wert in dem liegt, was NICHT herauskommt. Ein Modultest kann
// zeigen, dass ein Siegel nach einer Viertelstunde abläuft (das tut er auch,
// in `src/lib/__tests__/lohnsiegel.test.ts` — dort ist die Uhrzeit ein
// Übergabewert). Er kann nicht zeigen, dass die ECHTE Datei an der ECHTEN
// Adresse nicht herauskommt. Genau darauf kommt es an: Die Abrechnung hat
// eine Adresse, und die steht im Verlauf des Browsers.
//
// UND WAS NICHT GESPERRT SEIN DARF
// Eine Sperre, die zu weit geraten ist, fällt im Betrieb genauso auf wie eine
// fehlende — nur später und bei jemandem, der gerade seinen Krankenschein
// hochladen wollte. Deshalb steht unter jeder Sperre hier ihre Gegenprobe.

import { pruefer, login, hole, sende, BASIS } from './helfer.mjs'

const { check, bilanz } = pruefer()

const MITARBEITER = 'anna.fischer@rheinblick-reha.de'
const PASSWORT = 'Test1234!'

const gf = await login('gf@rheinblick-reha.de')
const anna = await login(MITARBEITER)

/** Rohe Antwort — hier zählt der Statuscode, nicht ein JSON-Feld. */
async function datei(cookie, id) {
  const r = await fetch(`${BASIS}/api/files/${id}`, { headers: { cookie } })
  const typ = r.headers.get('content-type') ?? ''
  return {
    status: r.status,
    typ,
    körper: typ.includes('json') ? await r.json().catch(() => ({})) : null,
    bytes: typ.includes('json') ? 0 : (await r.arrayBuffer()).byteLength,
  }
}

/** Anmelden und NUR den Siegelkeks zurückgeben. */
async function siegelHolen(cookie, passwort = PASSWORT) {
  const r = await fetch(`${BASIS}/api/auth/lohnsiegel`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwort }),
  })
  const keks = r.headers.getSetCookie()
    .map(c => c.split(';')[0])
    .find(c => c.startsWith('okun_lohnsiegel='))
  return { status: r.status, body: await r.json().catch(() => ({})), keks }
}

// ── Ausgangszustand selbst herstellen (Regel 1 der Nachweis-README) ─────────
const ich = (await hole(anna, '/api/auth/me')).body
const employeeId = ich.user?.employeeId ?? ich.employeeId
check('Der Mitarbeiter ist einer Personalakte zugeordnet', Boolean(employeeId),
  JSON.stringify(ich).slice(0, 160))

const MARKE = `M200-${Date.now().toString(36)}`

/** Eine Datei in die Akte legen — als Leitung, denn nur die darf das. */
async function ablegen(kategorie, name) {
  const form = new FormData()
  form.set('datei', new File(
    [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])],
    name, { type: 'application/pdf' },
  ))
  form.set('ownerType', 'employee')
  form.set('ownerId', employeeId)
  form.set('kategorie', kategorie)
  form.set('sichtbarFuerMitarbeiter', 'true')
  const r = await fetch(`${BASIS}/api/files`, { method: 'POST', headers: { cookie: gf }, body: form })
  const b = await r.json().catch(() => ({}))
  return b.datei?.id ?? b.id ?? null
}

const abrechnungId = await ablegen('lohnabrechnung', `${MARKE}_Entgeltabrechnung_2026_09.pdf`)
const vertragId = await ablegen('vertrag', `${MARKE}_Arbeitsvertrag.pdf`)
check('Zwei frische Unterlagen abgelegt: eine Abrechnung, ein Vertrag',
  Boolean(abrechnungId && vertragId), `${abrechnungId} · ${vertragId}`)

// ── M1 Ohne Bestätigung kommt die Abrechnung nicht heraus ──────────────────
console.log('\n=== M1 Ohne Bestätigung kommt nichts heraus ===')

const stand = await hole(anna, '/api/auth/lohnsiegel')
check('Der Mitarbeiter wird gefragt', stand.body.noetig === true, JSON.stringify(stand.body))
check('Und ist zu Beginn gesperrt', stand.body.frei === false, JSON.stringify(stand.body))
check('Die Dauer der Freigabe steht in der Antwort', stand.body.minuten === 15,
  String(stand.body.minuten))

const zu = await datei(anna, abrechnungId)
check('Die Abrechnung wird abgewiesen', zu.status === 403, `HTTP ${zu.status}`)
check('Und die Antwort trägt eine Kennung zum Auswerten',
  zu.körper?.code === 'SIEGEL_NOETIG', JSON.stringify(zu.körper))
check('Es kommen KEINE Dateibytes mit', zu.bytes === 0, `${zu.bytes} Bytes`)

// Die Kopfdaten bleiben sichtbar — dass es eine Abrechnung für September
// gibt, ist keine Auskunft, die geschützt werden müsste.
const liste = await hole(anna, `/api/files?ownerType=employee&ownerId=${employeeId}`)
check('Die Liste nennt die Abrechnung trotzdem',
  (liste.body.dateien ?? []).some(d => d.id === abrechnungId),
  `${(liste.body.dateien ?? []).length} Einträge`)

// ── M2 Die Gegenproben: Was NICHT gesperrt sein darf ───────────────────────
console.log('\n=== M2 Was nicht gesperrt sein darf ===')

const vertrag = await datei(anna, vertragId)
check('Der eigene Arbeitsvertrag bleibt ohne Passwort erreichbar',
  vertrag.status === 200 && vertrag.bytes > 0, `HTTP ${vertrag.status}, ${vertrag.bytes} Bytes`)

const leitung = await datei(gf, abrechnungId)
check('Die Leitung kommt ohne Siegel an die Abrechnung',
  leitung.status === 200 && leitung.bytes > 0,
  `HTTP ${leitung.status} — sie hat die Lohnliste ohnehin offen; eine Sperre `
  + 'davor wäre Schaufenster-Sicherheit und würde jeden Abrechnungslauf aufhalten.')

const leitungStand = await hole(gf, '/api/auth/lohnsiegel')
check('Und wird auch gar nicht erst gefragt',
  leitungStand.body.noetig === false && leitungStand.body.frei === true,
  JSON.stringify(leitungStand.body))

// ── M3 Das falsche Passwort öffnet nichts ──────────────────────────────────
console.log('\n=== M3 Das falsche Passwort öffnet nichts ===')

const falsch = await siegelHolen(anna, 'Falsch1234!')
check('Ein falsches Passwort wird abgelehnt', falsch.status === 401, `HTTP ${falsch.status}`)
check('Und stellt kein Siegel aus', !falsch.keks, falsch.keks ?? '(keins)')

const leer = await sende(anna, '/api/auth/lohnsiegel', 'POST', {})
check('Ohne Passwort geht gar nichts', leer.status === 400, `HTTP ${leer.status}`)

const ohneAnmeldung = await fetch(`${BASIS}/api/auth/lohnsiegel`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ passwort: PASSWORT }),
})
check('Ohne Anmeldung lässt sich kein Siegel holen', ohneAnmeldung.status === 401,
  `HTTP ${ohneAnmeldung.status}`)

// ── M4 Mit dem richtigen Passwort geht sie auf ─────────────────────────────
console.log('\n=== M4 Mit dem richtigen Passwort ===')

const auf = await siegelHolen(anna)
check('Das richtige Passwort gibt frei', auf.status === 200 && auf.body.frei === true,
  `HTTP ${auf.status} ${JSON.stringify(auf.body)}`)
check('Es wird ein Siegel ausgestellt', Boolean(auf.keks), auf.keks ?? '(keins)')
check('Die Antwort enthält das Passwort NICHT',
  !JSON.stringify(auf.body).includes(PASSWORT), JSON.stringify(auf.body))

const offen = await datei(`${anna}; ${auf.keks}`, abrechnungId)
check('Jetzt kommt die Abrechnung heraus',
  offen.status === 200 && offen.bytes > 0, `HTTP ${offen.status}, ${offen.bytes} Bytes`)
check('Und zwar als PDF', offen.typ.includes('application/pdf'), offen.typ)

const nurSitzung = await datei(anna, abrechnungId)
check('Die Sitzung allein reicht weiterhin nicht', nurSitzung.status === 403,
  `HTTP ${nurSitzung.status} — sonst hinge die Freigabe am Benutzer statt am Gerät.`)

// ── M5 Das Siegel eines anderen gilt nicht ─────────────────────────────────
console.log('\n=== M5 Das Siegel eines anderen gilt nicht ===')

/*
 * Der Fall, gegen den die Sperre überhaupt gebaut ist: dasselbe Tablet, die
 * nächste Schicht. Das Siegel der Vorgängerin liegt noch im Browser. Käme die
 * Nachfolgerin damit an ihre Abrechnung, wäre die ganze Sperre wertlos —
 * denn gerade dann hat niemand ein Passwort eingegeben.
 */
const thomas = await login('thomas.weber@rheinblick-reha.de')
const thomasSiegel = await siegelHolen(thomas)
check('Auch der Kollege bekommt ein Siegel', Boolean(thomasSiegel.keks),
  `HTTP ${thomasSiegel.status}`)

const fremd = await datei(`${anna}; ${thomasSiegel.keks}`, abrechnungId)
check('Mit fremdem Siegel kommt die Abrechnung NICHT heraus', fremd.status === 403,
  `HTTP ${fremd.status}`)

const gebastelt = await datei(`${anna}; okun_lohnsiegel=ausgedacht.unterschrift`, abrechnungId)
check('Ein selbst geschriebenes Siegel hilft auch nicht', gebastelt.status === 403,
  `HTTP ${gebastelt.status}`)

// ── M6 Wieder sperren ──────────────────────────────────────────────────────
console.log('\n=== M6 Wieder sperren ===')

const zuRueck = await fetch(`${BASIS}/api/auth/lohnsiegel`, {
  method: 'DELETE', headers: { cookie: `${anna}; ${auf.keks}` },
})
const geloescht = zuRueck.headers.getSetCookie()
  .some(c => c.startsWith('okun_lohnsiegel=;') || /okun_lohnsiegel=;/.test(c))
check('Das Sperren gelingt', zuRueck.status === 200, `HTTP ${zuRueck.status}`)
check('Und räumt das Siegel weg', geloescht,
  zuRueck.headers.getSetCookie().join(' | ') || '(nichts gesetzt)')

// ── Aufräumen ──────────────────────────────────────────────────────────────
for (const id of [abrechnungId, vertragId]) {
  if (id) await fetch(`${BASIS}/api/files/${id}`, { method: 'DELETE', headers: { cookie: gf } })
}
const danach = await hole(gf, `/api/files?ownerType=employee&ownerId=${employeeId}`)
check('Die Prüfung lässt keine Unterlagen zurück',
  !(danach.body.dateien ?? []).some(d => d.dateiname?.includes(MARKE)),
  (danach.body.dateien ?? []).filter(d => d.dateiname?.includes(MARKE))
    .map(d => d.dateiname).join(', ') || 'keine')

process.exit(bilanz() ? 1 : 0)
