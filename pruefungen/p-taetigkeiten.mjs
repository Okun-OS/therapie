// Nachweis §233: Eine Tätigkeit am Dienst erreicht den Rechendienst.
//
//     node pruefungen/p-taetigkeiten.mjs
//
// DIE ENTSCHEIDUNG
// „Der Plan soll sie beachten: Wer eine Tätigkeit nicht darf, bekommt den
// Dienst nicht, der sie verlangt."
//
// WAS VORHER WAR
// Die Kette stand still, und zwar vollständig:
//
//   `/admin/tasks` legte Tätigkeiten an und ordnete sie Leuten zu — speicherte
//   `Employee.allowedTasks` — und `rule-model-service.ts` schickte `aufgaben:
//   []` an den Rechendienst, dessen `solver.py` das Feld ohnehin nie las. Die
//   Tätigkeitsblöcke am Dienstplan wurden in zwei Ansichten angezeigt und von
//   nichts geschrieben.
//
// Eine Seite zum Zuordnen, eine Anzeige für das Ergebnis, und zwischen beiden
// keine Leitung.
//
// WAS DIESE PRÜFUNG MISST
// Nicht, ob der Plan „gut" ist — das kann sie nicht. Sie prüft die ÜBERTRAGUNG
// am aufgezeichneten Regelmodell eines echten Rechenlaufs: Steht die
// Anforderung am Dienst drin, und stehen die erlaubten Tätigkeiten am
// Menschen? Genau diese beiden Felder waren leer. Mit Gegenprobe: Ohne
// Anforderung darf nichts eingeschränkt werden.

import { pruefer, login, hole, sende } from './helfer.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const { check, bilanz } = pruefer()

const okun = await login('okun@okun.de')
const leitung = await login('leitung@rheinblick-reha.de')
const anna = await login('anna.fischer@rheinblick-reha.de')

const meLeitung = (await hole(leitung, '/api/auth/me')).body.user
const locationId = meLeitung.locationId
const belegschaft = ((await hole(leitung, '/api/employees')).body.employees ?? [])
  .filter(e => e.locationId === locationId && e.role === 'employee')

const TAETIGKEIT = 'Nachweis §233 Dokumentation'
const dienste = (await hole(leitung, `/api/shifts?locationId=${locationId}`)).body.shifts ?? []
const dienst = dienste[0]
const darfEs = belegschaft[0]
const darfEsNicht = belegschaft[1]

if (!dienst || !darfEs || !darfEsNicht) {
  console.error('Standort ohne Dienste oder mit weniger als zwei Mitarbeitern.')
  process.exit(1)
}

const jahr = new Date().getFullYear() + 1
const planVon = `${jahr}-10-04`, planBis = `${jahr}-10-15`

console.log(`Dienst „${dienst.name}" · darf: ${darfEs.name} · darf nicht: ${darfEsNicht.name}`)
console.log(`Rechenlauf ${planVon} bis ${planBis}\n`)

/*
 * Der Ausgangszustand, den diese Prüfung selbst herstellt. Ohne das Aufräumen
 * trägt der Dienst nach dem ersten Lauf noch die Anforderung, und die
 * Gegenprobe „ohne Anforderung" wäre dann keine.
 */
await prisma.shift.update({ where: { id: dienst.id }, data: { requiredTasks: [] } })
for (const e of belegschaft) {
  await prisma.employee.update({
    where: { id: e.id },
    data: { allowedTasks: (e.allowedTasks ?? []).filter(t => t !== TAETIGKEIT) },
  })
}

/** Einen Rechenlauf starten und sein aufgezeichnetes Modell holen. */
async function modellVomLauf() {
  const lauf = await sende(leitung, '/api/planning/runs', 'POST', {
    locationId, von: planVon, bis: planBis,
  })
  if (lauf.status !== 202) return { fehler: `HTTP ${lauf.status}`, modell: null }
  for (let versuch = 0; versuch < 120; versuch++) {
    const sitzung = await prisma.planningSession.findUnique({ where: { id: lauf.body.sessionId } })
    const roh = sitzung?.ruleModelSnap ?? {}
    // Gewartet wird auf den FERTIGEN Lauf, nicht nur auf das Modell: Der
    // gerechnete Plan ist die zweite Hälfte der Zusage.
    if (sitzung?.status === 'completed' && JSON.stringify(roh).length > 50) {
      return { fehler: null, modell: roh, plan: sitzung.finalPlan ?? null }
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  return { fehler: 'Der Lauf wurde nicht fertig', modell: null, plan: null }
}

// ── §233 Die Tätigkeit anlegen und zuordnen ───────────────────────────────
console.log('=== §233 Zuordnen ===')

const angelegt = await sende(leitung, '/api/task-types', 'POST', { name: TAETIGKEIT })
check('Die Leitung kann eine Tätigkeit anlegen',
  angelegt.status === 200 || angelegt.status === 201,
  angelegt.body.error ?? `${angelegt.body.taskTypes?.length ?? 0} im Katalog`)

const zugeordnet = await sende(leitung, `/api/employees/${darfEs.id}`, 'PATCH', {
  allowedTasks: [...(darfEs.allowedTasks ?? []), TAETIGKEIT],
})
check('Und sie einer Person zuordnen', zugeordnet.status === 200,
  zugeordnet.body.error ?? (zugeordnet.body.employee?.allowedTasks ?? []).join(', '))

const fremdZuordnen = await sende(anna, `/api/employees/${darfEs.id}`, 'PATCH', {
  allowedTasks: [TAETIGKEIT],
})
check('Ein Mitarbeiter kann sich KEINE Tätigkeit selbst zuordnen',
  fremdZuordnen.status === 403, `HTTP ${fremdZuordnen.status}`)

// ── §233 Gegenprobe: ohne Anforderung schränkt nichts ein ────────────────
console.log('\n=== §233 Gegenprobe: der Dienst verlangt noch nichts ===')

const ohne = await modellVomLauf()
check('Ein Rechenlauf entsteht', !ohne.fehler, ohne.fehler ?? 'Modell aufgezeichnet')
const ohneDienst = (ohne.modell?.schichten ?? []).find(s => s.id === dienst.id)
check('Der Dienst verlangt nichts', (ohneDienst?.aufgaben ?? []).length === 0,
  JSON.stringify(ohneDienst?.aufgaben ?? null))

/*
 * Die erlaubten Tätigkeiten stehen TROTZDEM schon am Menschen. Das ist die
 * eine Hälfte, die vorher fehlte — und sie muss da sein, bevor ein Dienst
 * etwas verlangt, sonst wäre der erste Dienst mit Anforderung für niemanden
 * besetzbar.
 */
const ohneMensch = (ohne.modell?.mitarbeiter ?? []).find(m => m.id === darfEs.id)
check('Die erlaubten Tätigkeiten stehen am Menschen',
  (ohneMensch?.erlaubteAufgaben ?? []).includes(TAETIGKEIT),
  JSON.stringify(ohneMensch?.erlaubteAufgaben ?? null))
const ohneAnderer = (ohne.modell?.mitarbeiter ?? []).find(m => m.id === darfEsNicht.id)
check('Und bei der anderen Person leer',
  !(ohneAnderer?.erlaubteAufgaben ?? []).includes(TAETIGKEIT),
  JSON.stringify(ohneAnderer?.erlaubteAufgaben ?? null))

// ── §233 Mit Anforderung ──────────────────────────────────────────────────
console.log('\n=== §233 Der Dienst verlangt sie ===')

const verlangt = await sende(okun, `/api/shifts/${dienst.id}`, 'PATCH', {
  requiredTasks: [TAETIGKEIT],
})
check('OKUN kann die Anforderung an den Dienst hängen', verlangt.status === 200,
  verlangt.body.error ?? 'gesetzt')

const leitungVersucht = await sende(leitung, `/api/shifts/${dienst.id}`, 'PATCH', {
  requiredTasks: [],
})
check('Die Leitung kann die Einrichtung NICHT ändern (§202)',
  leitungVersucht.status === 403, `HTTP ${leitungVersucht.status}`)

const mit = await modellVomLauf()
check('Ein Rechenlauf entsteht weiterhin', !mit.fehler, mit.fehler ?? 'Modell aufgezeichnet')
const mitDienst = (mit.modell?.schichten ?? []).find(s => s.id === dienst.id)
check('Die Anforderung erreicht den Rechendienst',
  (mitDienst?.aufgaben ?? []).includes(TAETIGKEIT),
  JSON.stringify(mitDienst?.aufgaben ?? null))

/*
 * Und die Zusage, auf die es hinausläuft: Wer sie nicht darf, bekommt den
 * Dienst nicht.
 *
 * Gemessen am GERECHNETEN Plan des Laufs, nicht an den Dienstplan-Einträgen:
 * Ein Lauf schreibt nichts in den Plan, das ist ein eigener Schritt. Beim
 * ersten Versuch stand hier „0 Dienste im Zeitraum, davon 0 ohne Recht" —
 * grün, und bewiesen war nichts.
 */
const gerechnet = (mit.plan?.eintraege ?? []).filter(e => e.schichtId === dienst.id)
check('Der gerechnete Plan besetzt diesen Dienst überhaupt',
  gerechnet.length > 0,
  `${gerechnet.length} Zuteilungen auf „${dienst.name}"`)

/*
 * Verglichen wird mit dem MODELL des Laufs, nicht mit der Belegschaftsliste
 * von oben. Die wurde geholt, BEVOR die Tätigkeit zugeordnet wurde — beim
 * ersten Versuch zählte die Prüfung damit alle zehn Zuteilungen als „ohne
 * Recht", obwohl sie alle an die berechtigte Person gingen. Das Modell trägt
 * genau den Stand, mit dem gerechnet wurde.
 */
const rechte = new Map((mit.modell?.mitarbeiter ?? [])
  .map(m => [m.id, m.erlaubteAufgaben ?? []]))
const ohneRecht = gerechnet.filter(e => !(rechte.get(e.mitarbeiterId) ?? []).includes(TAETIGKEIT))
check('Und niemand darin hat die Tätigkeit nicht',
  gerechnet.length > 0 && ohneRecht.length === 0,
  `${gerechnet.length} Zuteilungen, davon ${ohneRecht.length} ohne Recht`)

/*
 * Die Gegenprobe zu dieser Zahl: Ohne Anforderung bekamen auch andere den
 * Dienst. Ohne sie wäre „nur die Berechtigten" grün, weil der Dienst zufällig
 * immer an dieselbe Person geht.
 */
const vorherAndere = (ohne.plan?.eintraege ?? [])
  .filter(e => e.schichtId === dienst.id)
  .filter(e => e.mitarbeiterId !== darfEs.id)
check('Vorher bekamen ihn auch andere — die Einschränkung wirkt also',
  vorherAndere.length > 0,
  `${vorherAndere.length} Zuteilungen an andere, solange nichts verlangt wurde`)

// ── §233 Die Leitung sieht, welcher Dienst sie verlangt ───────────────────
console.log('\n=== §233 Sichtbar in der Maske ===')

const dienstJetzt = ((await hole(leitung, `/api/shifts?locationId=${locationId}`)).body.shifts ?? [])
  .find(s => s.id === dienst.id)
check('Die Anforderung kommt über die Schnittstelle mit',
  (dienstJetzt?.requiredTasks ?? []).includes(TAETIGKEIT),
  JSON.stringify(dienstJetzt?.requiredTasks ?? null))

// ── Aufräumen ─────────────────────────────────────────────────────────────
await prisma.shift.update({ where: { id: dienst.id }, data: { requiredTasks: [] } })
for (const e of belegschaft) {
  await prisma.employee.update({
    where: { id: e.id },
    data: { allowedTasks: (e.allowedTasks ?? []).filter(t => t !== TAETIGKEIT) },
  })
}
await sende(leitung, `/api/tasks/${encodeURIComponent(TAETIGKEIT)}`, 'DELETE', {})
await prisma.$disconnect()

bilanz()
