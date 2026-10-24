// Nachweis §232: Das „Persönliche" sagt die Wahrheit über sich — und hat
// keine zweiten Felder mehr.
//
//     node pruefungen/o-persoenliches.mjs
//
// DIE FRAGE
// „Bei den Bildern 2, 3, 4 und 5 siehst du mal so Sachen, wo ich mich frage,
// brauchen wir das noch?"
//
// ZWEI BEFUNDE
//
//   1. ZWEI FELDER FÜR DIESELBE ANTWORT. Unter „Persönliches" standen
//      „Bevorzugte Gruppen" und „Schicht-Vorlieben". Beides gab es ein zweites
//      Mal an einer Stelle, die den Plan wirklich ändert: die Gruppe am
//      Mitarbeiter und `EmployeePlanningProfile.shiftPreference`. Wer „lieber
//      Frühdienst" in das freiwillige Feld schrieb, hatte es gesagt und nichts
//      erreicht. §229 hat gezeigt, was ein Schattenfeld kostet.
//
//   2. DIE MASKE VERSPRACH ETWAS FALSCHES. Dort stand: „Sie helfen der KI,
//      faire und menschlichere Dienstpläne zu erstellen." Keines dieser Felder
//      erreicht den Rechendienst — `rule-model-service.ts` lädt sie nicht
//      einmal. Das ist die schlechteste Art, eine freiwillige Angabe
//      einzusammeln: Sie kostet Vertrauen und bringt nichts.
//
// WAS DIESE PRÜFUNG MISST
// Dass die beiden Felder nicht mehr gespeichert werden, dass die verbliebenen
// vier weiter funktionieren (die Gegenprobe — „alles weg" wäre auch grün), und
// dass die Angaben beim Rechendienst NICHT ankommen. Letzteres ist die
// eigentliche Zusage: Was die Maske sagt, muss stimmen.

import { pruefer, login, hole, sende } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const { check, bilanz } = pruefer()

const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')
const kita = await login('leitung@kita-sonnenschein.de')

const meAnna = (await hole(anna, '/api/auth/me')).body.user
const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const annaId = meAnna.employeeId
const locationId = meLeitung.locationId
const kollege = ((await hole(leitung, '/api/employees')).body.employees ?? [])
  .find(e => e.id !== annaId && e.locationId === locationId)

// Ein Zeitraum weit in der Zukunft, damit der Lauf keinen Bestandsplan trifft.
const jahr = new Date().getFullYear() + 1
const planVon = `${jahr}-09-07`, planBis = `${jahr}-09-18`

console.log(`Anna ${annaId?.slice(0, 8)} · Kollege ${kollege?.name}`)
console.log(`Rechenlauf ${planVon} bis ${planBis}\n`)

// ── §232 Die verbliebenen Felder tun es noch ──────────────────────────────
console.log('=== §232 Was bleibt, funktioniert ===')

const gespeichert = await sende(anna, '/api/employee-human-context', 'PATCH', {
  employeeId: annaId,
  strengths: ['Elternkommunikation', 'Dokumentation'],
  lifeCircumstances: ['Lange Anfahrt'],
  preferredActivities: ['Vorbereitung von Aktivitäten'],
  agreements: 'Dienstags nach 15 Uhr nicht erreichbar.',
})
check('Die freiwilligen Angaben lassen sich speichern', gespeichert.status === 200,
  gespeichert.body.error ?? 'gespeichert')

const gelesen = await hole(anna, `/api/employee-human-context?employeeId=${annaId}`)
const ctx = gelesen.body.contexts?.[0] ?? gelesen.body.context
check('Und wieder lesen', gelesen.status === 200 && !!ctx, `HTTP ${gelesen.status}`)
check('Stärken stehen drin', (ctx?.strengths ?? []).includes('Dokumentation'),
  (ctx?.strengths ?? []).join(', '))
check('Lebenssituation steht drin', (ctx?.lifeCircumstances ?? []).includes('Lange Anfahrt'),
  (ctx?.lifeCircumstances ?? []).join(', '))
check('Bevorzugte Tätigkeiten stehen drin',
  (ctx?.preferredActivities ?? []).includes('Vorbereitung von Aktivitäten'),
  (ctx?.preferredActivities ?? []).join(', '))
check('Die Absprache steht drin', (ctx?.agreements ?? '').includes('Dienstags'),
  ctx?.agreements ?? '—')

// ── §232 Die beiden Schattenfelder gibt es nicht mehr ─────────────────────
console.log('\n=== §232 Keine zweiten Felder für dieselbe Antwort ===')

const mitSchatten = await sende(anna, '/api/employee-human-context', 'PATCH', {
  employeeId: annaId,
  strengths: ['Elternkommunikation'],
  preferredGroups: ['Gruppe Sonnenblume'],
  shiftPreferences: ['Lieber Frühdienst'],
})
check('Ein Versuch, sie doch zu schicken, stört nicht',
  mitSchatten.status === 200, `HTTP ${mitSchatten.status}`)

/*
 * §232 Ohne Kennung gab es ALLES — über alle Kunden hinweg. Das war die
 * schwerste Fundstelle dieses Blocks: „Lebenssituation" meint alleinerziehend,
 * Pflege von Angehörigen, gesundheitliche Einschränkungen (Art. 9 DSGVO).
 */
const alleAufEinmal = await hole(anna, '/api/employee-human-context')
check('Ein Abruf OHNE Kennung gibt nicht mehr die ganze Tabelle',
  alleAufEinmal.status === 400,
  `HTTP ${alleAufEinmal.status}, ${alleAufEinmal.body.contexts?.length ?? 0} Datensätze`)

const danach = await hole(anna, `/api/employee-human-context?employeeId=${annaId}`)
const ctx2 = danach.body.contexts?.[0] ?? danach.body.context
check('Aber gespeichert wird nichts davon',
  ctx2?.preferredGroups === undefined && ctx2?.shiftPreferences === undefined,
  Object.keys(ctx2 ?? {}).join(', '))

/*
 * Wo die Schichtvorliebe HINGEHÖRT — die Gegenprobe zum Entfernen. Ohne sie
 * wäre „das Feld ist weg" grün, auch wenn es die Angabe nirgends mehr gäbe.
 */
const planProfil = await sende(leitung, '/api/employee-planning-profile', 'PUT', {
  employeeId: annaId, shiftPreference: 'frueh',
})
check('Die Dienstvorliebe hat weiter ihr eigenes Feld',
  planProfil.status === 200 && planProfil.body.profile?.shiftPreference === 'frueh',
  planProfil.body.error ?? planProfil.body.profile?.shiftPreference)

// ── §232 Der Rechendienst bekommt sie nicht ───────────────────────────────
console.log('\n=== §232 Die Zusage: beim Rechnen kommt nichts davon an ===')

/*
 * Der Kern. Die Maske sagt jetzt ausdrücklich „in die Berechnung des
 * Dienstplans gehen sie nicht ein". Das muss nachprüfbar sein, sonst ist die
 * neue Zusage so viel wert wie die alte.
 *
 * Geprüft wird am Regelmodell — genau dem, was an den Rechendienst geht.
 */
/*
 * Geprüft wird am `ruleModelSnap` eines echten Rechenlaufs — das ist genau
 * das, was an den Rechendienst ging. Eine Prüfung, die stattdessen den Code
 * liest, prüft die Absicht und nicht die Übertragung.
 */
const lauf = await sende(leitung, '/api/planning/runs', 'POST', {
  locationId, von: planVon, bis: planBis,
})
check('Ein Rechenlauf lässt sich starten', lauf.status === 202,
  lauf.body.error ?? `${lauf.body.sessionId?.slice(0, 8)} · ${lauf.body.status}`)

/*
 * Der Lauf rechnet im Hintergrund. Gewartet wird auf das aufgezeichnete
 * Modell, nicht auf den fertigen Plan: Ob der Plan am Ende aufgeht, ist eine
 * andere Frage als die, was an den Rechendienst ging.
 */
let sitzung = null
for (let versuch = 0; versuch < 60; versuch++) {
  sitzung = lauf.body.sessionId
    ? await prisma.planningSession.findUnique({ where: { id: lauf.body.sessionId } })
    : null
  if (sitzung && JSON.stringify(sitzung.ruleModelSnap ?? {}).length > 50) break
  await new Promise(r => setTimeout(r, 1000))
}
const alsText = JSON.stringify(sitzung?.ruleModelSnap ?? {})
check('Und sein Modell ist aufgezeichnet', alsText.length > 50,
  `${alsText.length} Zeichen`)

check('Die Lebenssituation steht NICHT darin',
  !alsText.includes('Lange Anfahrt'),
  alsText.includes('Lange Anfahrt') ? 'gefunden — die Maske lügt wieder' : 'nicht gefunden')
check('Die Absprache steht NICHT darin',
  !alsText.includes('Dienstags nach 15 Uhr'),
  alsText.includes('Dienstags nach 15 Uhr') ? 'gefunden' : 'nicht gefunden')
check('Die Stärken stehen NICHT darin',
  !alsText.includes('Elternkommunikation'),
  alsText.includes('Elternkommunikation') ? 'gefunden' : 'nicht gefunden')

/*
 * Die Gegenprobe dazu: Was WIRKLICH plant, muss im Modell stehen. Sonst wäre
 * „steht nicht darin" auch dann grün, wenn das Modell leer wäre.
 */
check('Die Dienstvorliebe dagegen schon — sie plant',
  /"vorliebe":\s*"frueh"|"schichtTyp":\s*"frueh"/.test(alsText),
  /"vorliebe"/.test(alsText) ? 'Vorliebe im Modell' : 'KEINE Vorliebe im Modell')

// ── §232 Nur die eigenen Angaben ──────────────────────────────────────────
console.log('\n=== §232 Fremde Angaben bleiben verschlossen ===')

const fremdLesen = await hole(anna, `/api/employee-human-context?employeeId=${kollege.id}`)
check('Anna kommt NICHT an die Angaben einer Kollegin',
  fremdLesen.status === 403, `HTTP ${fremdLesen.status}`)
const fremdSchreiben = await sende(anna, '/api/employee-human-context', 'PATCH', {
  employeeId: kollege.id, strengths: ['fremd'],
})
check('Und kann auch nichts für sie eintragen',
  fremdSchreiben.status === 403, `HTTP ${fremdSchreiben.status}`)
const fremdeLeitung = await hole(kita, `/api/employee-human-context?employeeId=${annaId}`)
check('Eine fremde Leitung kommt ebenfalls nicht heran',
  fremdeLeitung.status === 403 || fremdeLeitung.status === 404,
  `HTTP ${fremdeLeitung.status}`)
check('Die eigene Leitung darf sie sehen',
  (await hole(leitung, `/api/employee-human-context?employeeId=${annaId}`)).status === 200)

/*
 * §232 Der Umweg über das Sprachmodell darf kein zweiter Eingang sein.
 *
 * `/api/ai/human-context-chat` schreibt am Ende in dieselbe Personalakte.
 * Dort stand nur `requireRole(req)` — jede angemeldete Person konnte ein
 * Gespräch über eine fremde Kennung führen und damit in deren Akte schreiben.
 */
const chatFremd = await sende(anna, '/api/ai/human-context-chat', 'POST', {
  employeeId: kollege.id,
  messages: [{ role: 'user', content: 'Ich bin alleinerziehend.' }],
})
check('Auch über den KI-Chat kommt niemand an eine fremde Akte',
  chatFremd.status === 403, `HTTP ${chatFremd.status}`)

// ── Aufräumen ─────────────────────────────────────────────────────────────
await sende(anna, '/api/employee-human-context', 'PATCH', {
  employeeId: annaId,
  strengths: [], lifeCircumstances: [], preferredActivities: [], agreements: '',
})
await sende(leitung, '/api/employee-planning-profile', 'PUT', {
  employeeId: annaId, shiftPreference: 'keine',
})
await prisma.$disconnect()

bilanz()
