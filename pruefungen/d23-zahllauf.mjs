// Nachweis D23 (§218): Die Gehaltszahlung als Vorgang — und der Schutz davor,
// dass derselbe Monat zweimal bei der Bank landet.
import { BASIS, pruefer, login, hole, sende, zuruecksetzen, pruefMonate, lohnPerson } from './helfer.mjs'

const { check, bilanz } = pruefer()

const gf = await login('gf@rheinblick-reha.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const locationId = (await hole(anna, '/api/auth/me')).body.user.locationId

const jetzt = new Date()
const jahr = jetzt.getFullYear(), monat = jetzt.getMonth() + 1

/*
 * Der Ausgangszustand, den diese Prüfung selbst herstellt.
 *
 * Ein Zahlungslauf wird über seine Kennung wiedererkannt, und die Kennung
 * wird aus dem Inhalt gerechnet. Liefe diese Prüfung zweimal mit demselben
 * Inhalt, bekäme der zweite Lauf die gespeicherte Datei des ersten
 * zurückgereicht — und von da an prüfte sie etwas anderes als beim ersten
 * Mal. Deshalb bekommt eine Person eine Einmalzahlung mit einem Betrag, den
 * es so noch nie gab.
 */
await zuruecksetzen(gf, pruefMonate(jahr, monat))
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })

/*
 * Der Inhalt muss sich von Lauf zu Lauf unterscheiden.
 *
 * Ein Zahlungslauf wird über seine Kennung wiedererkannt, und die Kennung
 * wird aus dem Inhalt gerechnet. Liefe diese Prüfung zweimal mit demselben
 * Inhalt, bekäme der zweite Durchgang die gespeicherte Datei des ersten
 * zurückgereicht — und prüfte von da an etwas anderes als gedacht. Genau das
 * ist beim ersten Versuch passiert.
 *
 * Deshalb bekommt eine Person, die wirklich in der Zahldatei steht, eine
 * Einmalzahlung mit einem Betrag, den es so noch nie gab. Eine frisch
 * angelegte Person taugt dafür nicht: Sie hat im laufenden Monat keinen
 * Auszahlungsbetrag und fällt aus der Datei heraus.
 */
const vorher = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`)).body.entries ?? []
const ziel = vorher.find(e => (e.auszahlungsbetrag || e.netto) > 0)
check('Eine Person mit Auszahlungsbetrag steht bereit', Boolean(ziel), ziel?.employeeName)
const einmalig = 100 + (Date.now() % 900)
const praemie = await sende(gf, '/api/payroll/einmalzahlung', 'POST', {
  employeeId: ziel.employeeId, jahr, monat, art: 'praemie', betrag: einmalig,
})
check('Die Einmalzahlung wird erfasst', praemie.status === 200, praemie.body.error)
await sende(gf, '/api/payroll/vorbereiten', 'POST', { year: jahr, month: monat })

const alle = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`)).body.entries ?? []
const zielNeu = alle.find(e => e.employeeId === ziel.employeeId)
check('Sie wirkt sich auf den Auszahlungsbetrag aus',
  (zielNeu?.auszahlungsbetrag || 0) > (ziel.auszahlungsbetrag || ziel.netto),
  `${ziel.auszahlungsbetrag || ziel.netto} → ${zielNeu?.auszahlungsbetrag}`)

for (const e of alle) {
  if (e.status !== 'approved') await sende(gf, '/api/payroll', 'PATCH', { id: e.id, status: 'approved' })
}
check('Abrechnungen stehen freigegeben bereit', alle.length > 0, `${alle.length} Abrechnungen`)

const sepa = (art = '') =>
  fetch(`${BASIS}/api/payroll/export?art=sepa&year=${jahr}&month=${monat}${art}`,
    { headers: { cookie: gf } })

// ── Der Lauf entsteht ──────────────────────────────────────────────────────
console.log('\n=== Aus dem Download wird ein Vorgang ===')
const ersteR = await sepa()
const erste = await ersteR.text()
check('Die Zahldatei wird geliefert', ersteR.status === 200, `HTTP ${ersteR.status}`)
const laufId = ersteR.headers.get('x-okun-lauf')
const kennung = ersteR.headers.get('x-okun-kennung')
check('Dazu entsteht ein Zahlungslauf', Boolean(laufId), String(laufId))
check('Er trägt die Kennung aus der Datei',
  Boolean(kennung) && erste.includes(`<MsgId>${kennung}</MsgId>`), String(kennung))

const liste = await hole(gf, `/api/payroll/zahllauf?jahr=${jahr}&monat=${monat}`)
const lauf = (liste.body.laeufe ?? []).find(l => l.id === laufId)
check('Er steht in der Übersicht', Boolean(lauf), `${(liste.body.laeufe ?? []).length} Läufe`)
check('Mit dem Stand „erzeugt"', lauf?.status === 'erzeugt', lauf?.status)
check('Die Summe des Laufs steht in der Datei',
  erste.includes(`<CtrlSum>${lauf?.summe?.toFixed(2)}</CtrlSum>`),
  `${lauf?.summe} EUR · ${lauf?.anzahl} Zahlungen`)

// ── Derselbe Inhalt, dieselbe Datei ────────────────────────────────────────
console.log('\n=== Zweimal herunterladen ist nicht zweimal zahlen ===')
const zweiteR = await sepa()
const zweite = await zweiteR.text()
check('Der zweite Abruf ist als Wiederholung gekennzeichnet',
  zweiteR.headers.get('x-okun-wiederholung') === '1')
check('Und liefert Byte für Byte dieselbe Datei', zweite === erste,
  zweite === erste ? 'identisch' : 'unterschiedlich')
const nachZweitem = (await hole(gf, `/api/payroll/zahllauf?jahr=${jahr}&monat=${monat}`))
  .body.laeufe ?? []
// Gezählt wird gegen den Stand VOR dem zweiten Abruf, nicht gegen eine feste
// Zahl: Frühere Durchläufe dieser Prüfung lassen abgeschlossene Läufe liegen,
// und das ist richtig so — ein Zahlungslauf wird nicht gelöscht.
check('Es entsteht kein zweiter Lauf',
  nachZweitem.length === (liste.body.laeufe ?? []).length,
  `vorher ${(liste.body.laeufe ?? []).length}, nachher ${nachZweitem.length}`)

// ── Ein korrigierter Inhalt löst den erzeugten Lauf ab ─────────────────────
console.log('\n=== Korrigieren vor dem Einreichen ist erlaubt ===')
const raus = alle[0]
await sende(gf, '/api/payroll', 'PATCH', { id: raus.id, status: 'draft' })
const dritteR = await sepa()
await dritteR.text()
check('Ein geänderter Inhalt ergibt einen neuen Lauf',
  dritteR.status === 200 && dritteR.headers.get('x-okun-lauf') !== laufId,
  `HTTP ${dritteR.status}`)
const nachAbloesung = (await hole(gf, `/api/payroll/zahllauf?jahr=${jahr}&monat=${monat}`))
  .body.laeufe ?? []
check('Der alte Lauf ist verworfen, nicht gelöscht',
  nachAbloesung.find(l => l.id === laufId)?.status === 'verworfen',
  nachAbloesung.find(l => l.id === laufId)?.status)
check('Und er sagt, wodurch',
  String(nachAbloesung.find(l => l.id === laufId)?.notiz ?? '').includes('Abgelöst'))

// Den Stand wiederherstellen, damit der Inhalt wieder der ursprüngliche ist
await sende(gf, '/api/payroll', 'PATCH', { id: raus.id, status: 'approved' })
const vierteR = await sepa()
await vierteR.text()
const laufZwei = vierteR.headers.get('x-okun-lauf')
check('Der wiederhergestellte Inhalt ergibt wieder einen Lauf',
  vierteR.status === 200 && Boolean(laufZwei), `HTTP ${vierteR.status}`)

// ── Einreichen ─────────────────────────────────────────────────────────────
console.log('\n=== Eingereicht — ab hier ist Geld unterwegs ===')
const fremd = await sende(leitung, '/api/payroll/zahllauf', 'PATCH',
  { id: laufZwei, status: 'eingereicht' })
check('Eine Standortleitung darf das nicht eintragen', fremd.status === 403,
  `HTTP ${fremd.status}`)

const eingereicht = await sende(gf, '/api/payroll/zahllauf', 'PATCH',
  { id: laufZwei, status: 'eingereicht', notiz: 'Nachweis D23' })
check('Die Unternehmensebene trägt das Einreichen ein', eingereicht.status === 200,
  eingereicht.body.error)
check('Der Lauf steht auf „eingereicht"', eingereicht.body.lauf?.status === 'eingereicht')
check('Die enthaltenen Abrechnungen gelten als bezahlt',
  eingereicht.body.abrechnungen > 0, `${eingereicht.body.abrechnungen} Abrechnungen`)

const bezahlte = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`)).body.entries ?? []
check('Und zwar wirklich in der Abrechnung selbst',
  bezahlte.filter(e => e.status === 'paid').length > 0,
  `${bezahlte.filter(e => e.status === 'paid').length} auf bezahlt`)

// ── Der eigentliche Schutz ─────────────────────────────────────────────────
console.log('\n=== Keine zweite Datei, solange eine eingereicht ist ===')
const raus2 = bezahlte.find(e => e.status === 'paid')
await sende(gf, '/api/payroll', 'PATCH', { id: raus2.id, status: 'draft' })
const gesperrtR = await sepa()
const gesperrt = await gesperrtR.json().catch(() => ({}))
check('Ein geänderter Inhalt wird jetzt abgelehnt', gesperrtR.status === 409,
  `HTTP ${gesperrtR.status}`)
check('Mit dem Hinweis auf den offenen Lauf',
  String(gesperrt.error ?? '').includes('eingereicht'),
  String(gesperrt.error ?? '').slice(0, 90))
check('Und mit der Kennung, um die es geht', Boolean(gesperrt.offenerLauf),
  String(gesperrt.offenerLauf))

// ── Die Antwort der Bank ───────────────────────────────────────────────────
console.log('\n=== Was die Bank daraus gemacht hat ===')
const zurueck = await sende(gf, '/api/payroll/zahllauf', 'PATCH',
  { id: laufZwei, status: 'verworfen' })
check('Ein eingereichter Lauf lässt sich NICHT verwerfen', zurueck.status === 400,
  zurueck.body.error?.slice(0, 70))

const abgelehnt = await sende(gf, '/api/payroll/zahllauf', 'PATCH',
  { id: laufZwei, status: 'abgelehnt', notiz: 'Von der Bank zurückgewiesen' })
check('Eine Ablehnung lässt sich eintragen', abgelehnt.status === 200, abgelehnt.body.error)
const nachAblehnung = (await hole(gf, `/api/payroll?year=${jahr}&month=${monat}`)).body.entries ?? []
check('Danach gilt keine Abrechnung mehr als bezahlt',
  nachAblehnung.filter(e => e.status === 'paid').length === 0,
  `${nachAblehnung.filter(e => e.status === 'paid').length} noch auf bezahlt`)

const endstand = await sende(gf, '/api/payroll/zahllauf', 'PATCH',
  { id: laufZwei, status: 'ausgefuehrt' })
check('Aus einer Ablehnung wird nachträglich keine Ausführung',
  endstand.status === 400, endstand.body.error?.slice(0, 70))

const wiederFrei = await sepa()
await wiederFrei.text()
check('Nach der Ablehnung entsteht wieder eine Datei', wiederFrei.status === 200,
  `HTTP ${wiederFrei.status}`)

// ── Die Datei bleibt abrufbar ──────────────────────────────────────────────
console.log('\n=== Nachvollziehbar, was eingereicht wurde ===')
const wiederR = await fetch(`${BASIS}/api/payroll/zahllauf?id=${laufZwei}&datei=1`,
  { headers: { cookie: gf } })
const wieder = await wiederR.text()
check('Die gespeicherte Datei lässt sich erneut holen', wiederR.status === 200,
  `HTTP ${wiederR.status}`)
check('Sie trägt die Kennung des Laufs',
  wieder.includes(`<MsgId>${eingereicht.body.lauf?.kennung}</MsgId>`))
check('Ein Mitarbeiter kommt nicht an sie heran',
  (await fetch(`${BASIS}/api/payroll/zahllauf?id=${laufZwei}&datei=1`,
    { headers: { cookie: anna } })).status === 403)

bilanz()
