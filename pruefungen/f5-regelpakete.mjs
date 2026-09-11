// Nachweis F5/F6: Regelpakete je Kunde und die Freischaltung der Dienstplanung.
//
// Das Geschäftsmodell aus PRODUKT-NOTIZEN.md: Alles außer der Dienstplanung ist
// Standard. Die Dienstplanung wird je Kunde von Hand programmiert — bis dahin
// bleibt sie gesperrt. Ein Kunde, der ungebaute Dienstplanung ausprobiert,
// bekommt einen schlechten Plan und ein falsches Bild vom Produkt.
import { pruefer, login, hole, sende } from './helfer.mjs'

const { check, bilanz } = pruefer()

const okun = await login('okun@okun.de')
const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')

const locationId = (await hole(leitung, '/api/auth/me')).body.user.locationId
console.log(`Standort ${locationId}\n`)

// ── Wer darf überhaupt hier hinein ─────────────────────────────────────────
console.log('=== Nur OKUN verwaltet die Dienstplanung ===')
for (const [wer, cookie] of [['Unternehmen', gf], ['Standortleitung', leitung]]) {
  const r = await hole(cookie, '/api/okun/dienstplanung')
  check(`${wer} kommt an die Verwaltung NICHT heran`, r.status === 403, `HTTP ${r.status}`)
}

const uebersicht = await hole(okun, '/api/okun/dienstplanung')
check('OKUN sieht alle Standorte', uebersicht.status === 200,
  `${uebersicht.body.standorte?.length ?? 0} Standorte`)
check('Und die verfügbaren Regelpakete',
  (uebersicht.body.pakete ?? []).some(p => p.id === 'kita_sonnenschein'),
  uebersicht.body.hinweis)
check('Der Rechendienst ist erreichbar', uebersicht.body.rechendienstErreichbar === true)

const paket = (uebersicht.body.pakete ?? []).find(p => p.id === 'kita_sonnenschein')
check('Ein Paket nennt Kunde und Version',
  !!paket?.kunde && !!paket?.version, `${paket?.kunde} v${paket?.version}`)

// ── Ein Paket zuordnen ─────────────────────────────────────────────────────
console.log('\n=== Regelpaket zuordnen ===')
const erfunden = await sende(okun, '/api/okun/dienstplanung', 'PATCH',
  { locationId, rulePackId: 'gibt_es_nicht' })
check('Ein Paket, das es nicht gibt, wird abgelehnt', erfunden.status === 400,
  erfunden.body.error)

const zugeordnet = await sende(okun, '/api/okun/dienstplanung', 'PATCH',
  { locationId, rulePackId: 'kita_sonnenschein' })
check('Ein vorhandenes Paket wird zugeordnet', zugeordnet.status === 200,
  zugeordnet.body.hinweis ?? zugeordnet.body.error)
check('Es steht am Standort', zugeordnet.body.standort?.rulePackId === 'kita_sonnenschein')

// ── Sperre ─────────────────────────────────────────────────────────────────
console.log('\n=== Gesperrte Dienstplanung ===')
await sende(okun, '/api/okun/dienstplanung', 'PATCH',
  { locationId, dienstplanungFrei: false })

const heute = new Date()
const von = new Date(heute.getTime() + 7 * 86400000).toISOString().slice(0, 10)
const bis = new Date(heute.getTime() + 13 * 86400000).toISOString().slice(0, 10)

const gesperrt = await sende(leitung, '/api/planning/runs', 'POST', { locationId, von, bis })
check('Die Leitung kann keinen Plan erzeugen', gesperrt.status === 423,
  `HTTP ${gesperrt.status}`)
check('Die Meldung erklärt es verständlich',
  /freigeschaltet|eingerichtet/.test(gesperrt.body.error ?? ''),
  gesperrt.body.error)
check('Sie ist als Sperre gekennzeichnet', gesperrt.body.gesperrt === true)

const gfGesperrt = await sende(gf, '/api/planning/runs', 'POST', { locationId, von, bis })
check('Auch das Unternehmen kommt nicht daran vorbei', gfGesperrt.status === 423)

// ── Ein eigener Hinweistext ────────────────────────────────────────────────
console.log('\n=== Eigener Hinweis für den Kunden ===')
await sende(okun, '/api/okun/dienstplanung', 'PATCH', {
  locationId,
  hinweis: 'Ihre Dienstplanung wird gerade eingerichtet. Wir melden uns nächste Woche.',
})
const mitHinweis = await sende(leitung, '/api/planning/runs', 'POST', { locationId, von, bis })
check('Der Kunde sieht den hinterlegten Text',
  mitHinweis.body.error?.includes('nächste Woche'), mitHinweis.body.error)

// ── Freischalten ───────────────────────────────────────────────────────────
console.log('\n=== Freischalten ===')
const frei = await sende(okun, '/api/okun/dienstplanung', 'PATCH',
  { locationId, dienstplanungFrei: true, hinweis: '' })
check('OKUN schaltet frei', frei.status === 200, frei.body.hinweis)
check('Wer freigeschaltet hat, steht fest', !!frei.body.standort?.dienstplanungFreiVon,
  frei.body.standort?.dienstplanungFreiVon)
check('Und seit wann', !!frei.body.standort?.dienstplanungFreiSeit,
  frei.body.standort?.dienstplanungFreiSeit)

const lauf = await sende(leitung, '/api/planning/runs', 'POST', { locationId, von, bis })
// 202 = angenommen; der Lauf rechnet im Hintergrund weiter
check('Danach läuft die Planung', lauf.status === 202, `HTTP ${lauf.status}`)

// ── Abschottung ────────────────────────────────────────────────────────────
console.log('\n=== Abschottung ===')
const fremdSchaltet = await sende(kita, '/api/okun/dienstplanung', 'PATCH',
  { locationId, dienstplanungFrei: false })
check('Eine fremde Leitung kann nicht sperren', fremdSchaltet.status === 403,
  `HTTP ${fremdSchaltet.status}`)

const selbstSchaltet = await sende(gf, '/api/okun/dienstplanung', 'PATCH',
  { locationId, rulePackId: 'kita_sonnenschein' })
check('Der Kunde kann sich kein Paket selbst zuordnen', selbstSchaltet.status === 403,
  `HTTP ${selbstSchaltet.status}`)

const nochFrei = (await hole(okun, '/api/okun/dienstplanung')).body.standorte
  .find(s => s.id === locationId)
check('Der Stand ist unverändert', nochFrei?.dienstplanungFrei === true)

process.exit(bilanz() ? 1 : 0)
