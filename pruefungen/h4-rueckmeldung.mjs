// Nachweis H4: Was der Melder zu hören bekommt.
//
// Bisher verschwand eine Meldung im Nichts. Wer einen Fehler meldet, wusste
// danach nicht, ob ihn jemand gelesen hat, ob daran gearbeitet wird, und ob es
// je behoben wurde. Beim zweiten Mal meldet man dann nichts mehr — und genau
// die Leute, die den Betrieb kennen, hören auf zu sagen, was kaputt ist.
//
// Geprüft wird der ganze Weg: Der Kanal zu OKUN ist da, die Meldung kommt an,
// der Abschluss kommt an — und niemand sonst liest mit. Der letzte Punkt ist
// der wichtigste: Ein Kanal, in dem Störungen stehen, ist ein Blick in den
// Betrieb, und der geht Kollegen nichts an.

import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const anna = await login('anna.fischer@rheinblick-reha.de')
const kollege = await login('thomas.weber@rheinblick-reha.de')
const okun = await login('okun@okun.de')

const mAnna = (await hole(anna, '/api/auth/me')).body.user

/** Den Kanal zu OKUN holen — er entsteht beim ersten Öffnen der Nachrichten. */
async function kanal(cookie) {
  const liste = (await hole(cookie, '/api/chat')).body.raeume ?? []
  return liste.find(r => r.art === 'okun') ?? null
}

async function verlauf(cookie, raumId) {
  return (await hole(cookie, `/api/chat/${raumId}`)).body.nachrichten ?? []
}

// ── H4 Der Kanal ───────────────────────────────────────────────────────────
console.log('=== H4 Der Draht zu OKUN ===')

const meiner = await kanal(anna)
check('Beim Öffnen der Nachrichten ist der Kanal da', !!meiner, meiner?.titel)
check('Er heißt nach OKUN und nicht nach einer Person',
  /OKUN/i.test(meiner?.titel ?? ''), meiner?.titel)

const nochmal = await kanal(anna)
check('Ein zweites Öffnen legt keinen zweiten an', nochmal?.id === meiner?.id)

const beimKollegen = await kanal(kollege)
check('Jeder hat seinen eigenen', !!beimKollegen && beimKollegen.id !== meiner.id,
  beimKollegen?.id?.slice(0, 8))

const fremd = await hole(kollege, `/api/chat/${meiner.id}`)
check('Der Kanal einer Kollegin ist für niemanden sonst lesbar',
  fremd.status === 404, `HTTP ${fremd.status}`)

const beiOkun = (await hole(okun, '/api/chat')).body
check('Ein Plattformzugang hat selbst keinen Kanal',
  beiOkun.chatMoeglich === false || (beiOkun.raeume ?? []).length === 0,
  `chatMoeglich ${beiOkun.chatMoeglich}`)

// ── H4 Die Meldung kommt an ────────────────────────────────────────────────
console.log('\n=== H4 Eingegangen ===')

const vorher = (await verlauf(anna, meiner.id)).length

const gemeldet = await sende(anna, '/api/bug-reports', 'POST', {
  art: 'fehler', bereich: 'nachrichten',
  title: `H4-Nachweis Knopf ohne Wirkung ${Date.now().toString(36)}`,
  schritte: 'Auf Nachrichten gehen und auf Gruppe eröffnen drücken.',
  description: 'Es passiert nichts.',
  erwartet: 'Die Maske sollte aufgehen.',
  haeufigkeit: 'immer',
})
check('Die Meldung wird angenommen', gemeldet.status === 200, gemeldet.body.ticketId)

const nachMeldung = await verlauf(anna, meiner.id)
check('Es steht sofort eine Rückmeldung im Kanal',
  nachMeldung.length > vorher, `${vorher} → ${nachMeldung.length}`)

const eingang = nachMeldung[nachMeldung.length - 1]
check('Sie kommt von OKUN, nicht von einem Kollegen',
  /OKUN/i.test(eingang?.absenderName ?? ''), eingang?.absenderName)
check('Sie bedankt sich', /danke/i.test(eingang?.text ?? ''))
check('Sie verspricht eine Rückmeldung', /melden uns/i.test(eingang?.text ?? ''))
check('Und sie nennt die Nummer zum Nachfragen',
  (eingang?.text ?? '').includes(gemeldet.body.ticketId), gemeldet.body.ticketId)

// ── H4 Der Abschluss ───────────────────────────────────────────────────────
console.log('\n=== H4 Behoben ===')

const alle = (await hole(okun, '/api/bug-reports')).body.reports ?? []
const fund = alle.find(f => f.ticketId === gemeldet.body.ticketId)
check('OKUN findet den Fund', !!fund, fund?.id?.slice(0, 8))

await sende(okun, '/api/bug-reports', 'PATCH', {
  id: fund.id, erledigtNotiz: 'H4-Nachweis: behoben.',
})

const nachAbschluss = await verlauf(anna, meiner.id)
const abschluss = nachAbschluss[nachAbschluss.length - 1]
check('Nach dem Abschluss steht die Erledigt-Meldung im Kanal',
  nachAbschluss.length > nachMeldung.length,
  `${nachMeldung.length} → ${nachAbschluss.length}`)
check('Sie sagt, dass es behoben ist', /behoben/i.test(abschluss?.text ?? ''))
check('Und dass es jetzt funktionieren sollte',
  /funktionieren/i.test(abschluss?.text ?? ''))
check('Ohne Fachbegriffe',
  !/commit|branch|deploy/i.test(abschluss?.text ?? ''), abschluss?.text?.slice(0, 60))

// Kein zweites Mal dieselbe Meldung, wenn sich am Status nichts ändert.
await sende(okun, '/api/bug-reports', 'PATCH', {
  id: fund.id, adminNotes: 'Nur eine Notiz.',
})
const nachNotiz = await verlauf(anna, meiner.id)
check('Eine Notiz ohne Statuswechsel löst keine weitere Nachricht aus',
  nachNotiz.length === nachAbschluss.length,
  `${nachAbschluss.length} → ${nachNotiz.length}`)

// ── H4 Zurückschreiben ─────────────────────────────────────────────────────
console.log('\n=== H4 Zurückschreiben ===')

const antwort = await sende(anna, `/api/chat/${meiner.id}`, 'POST',
  { text: 'H4-Nachweis: Danke, geht wieder.' })
check('Man kann OKUN im Kanal antworten', antwort.status === 200,
  `HTTP ${antwort.status} · ${antwort.body.error}`)

const mitAntwort = await verlauf(anna, meiner.id)
check('Die Antwort steht im Verlauf',
  (mitAntwort[mitAntwort.length - 1]?.text ?? '').includes('geht wieder'))
check('Und ist als eigene gekennzeichnet',
  mitAntwort[mitAntwort.length - 1]?.vonMir === true)

const fremdSchreiben = await sende(kollege, `/api/chat/${meiner.id}`, 'POST',
  { text: 'H4-Nachweis: darf nicht gehen' })
check('In einen fremden Kanal schreibt niemand',
  fremdSchreiben.status === 404, `HTTP ${fremdSchreiben.status}`)

// ── H4 Der Kanal ist keine Gruppe ──────────────────────────────────────────
console.log('\n=== H4 Grenzen des Kanals ===')

check('Er lässt sich nicht verwalten', meiner.darfVerwalten === false)

const alsGruppe = await sende(anna, `/api/chat/${meiner.id}`, 'PATCH',
  { archivieren: true })
check('Und nicht schließen',
  alsGruppe.status >= 400 || (await kanal(anna))?.archiviert !== true,
  `HTTP ${alsGruppe.status}`)

const partner = (await hole(anna, '/api/chat/partner')).body.partner ?? []
check('OKUN taucht nicht in der Personenauswahl auf',
  !partner.some(p => /OKUN/i.test(p.name ?? '')),
  `${partner.length} Personen`)

// Aufräumen: Testfunde schließen.
const offeneTests = ((await hole(okun, '/api/bug-reports')).body.reports ?? [])
  .filter(f => /^H4-Nachweis/.test(f.title ?? '')
    && !['resolved', 'abgelehnt'].includes(f.status))
for (const f of offeneTests) {
  await sende(okun, '/api/bug-reports', 'PATCH', {
    id: f.id, status: 'abgelehnt', adminNotes: 'H4-Nachweis — automatisch geschlossen.',
  })
}
check('Der Nachweis lässt keine offenen Testfunde zurück',
  ((await hole(okun, '/api/bug-reports')).body.reports ?? [])
    .filter(f => /^H4-Nachweis/.test(f.title ?? '')
      && !['resolved', 'abgelehnt'].includes(f.status)).length === 0)

console.log(`\nMelderin ${String(mAnna.id).slice(0, 8)}`)
process.exit(bilanz() > 0 ? 1 : 0)
