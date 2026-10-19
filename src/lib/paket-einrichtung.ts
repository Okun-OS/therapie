import { prisma } from '@/lib/prisma'
import { verfuegbareRegelpakete, type PaketEinrichtung } from '@/lib/regelpakete'
import { BETRIEBSTYP_ARBEITSTAGE } from '@/lib/rule-model-service'

/**
 * §201 Was ein Regelpaket mitbringt, am Standort anlegen.
 *
 * WARUM ES DAS GIBT
 * Ein Standort mit Regelpaket, aber ohne Dienstzeiten, hat Regeln für Dienste,
 * die es nicht gibt — und keinen Plan. So stand die Kita „Krümelkiste" da. Die
 * Dienstzeiten sollte bisher der Kunde in der Einrichtung anlegen; die gibt es
 * seit §201 nicht mehr, und das zu Recht: Was ein Betrieb für Dienste hat,
 * steht in seinem Regelwerk, und daraus baut OKUN sein Paket. Also kommt es
 * mit dem Paket.
 *
 * NUR WAS FEHLT — NIE ÜBERSCHREIBEN
 * Hat ein Standort schon Dienstzeiten, bleiben sie, auch wenn das Paket
 * andere vorsieht. Dienstzeiten hängen an jedem Eintrag im Dienstplan; sie
 * auszutauschen hieße, gemachte Pläne umzudeuten. Dasselbe gilt für Etagen
 * und Gruppen (an ihnen hängen die Stammgruppen der Belegschaft), für die
 * Arbeitstage und die Basiswerte. Was nicht angelegt wurde, steht mit Grund
 * im Bericht — damit OKUN sieht, wo Paket und Standort auseinanderliegen.
 */

const DB_ART: Record<string, string> = { frueh: 'early', spaet: 'late', mittel: 'mid', nacht: 'night' }

// Dieselben Farben wie bisher in den Einrichtungsskripten.
const FARBEN: Record<string, { color: string; bgColor: string }> = {
  early: { color: '#0B6E72', bgColor: '#DBF4F4' },
  mid: { color: '#8A5A08', bgColor: '#FCEFD6' },
  late: { color: '#4B3B96', bgColor: '#E9E4FB' },
  night: { color: '#1F2A44', bgColor: '#E3E7F0' },
}

const BETRIEBSTYP: Record<number, string> = { 5: 'mon_fri', 6: 'mon_sat', 7: '7_tage' }

export interface EinrichtungsBericht {
  dienstzeiten: { angelegt: number; vorhanden: number }
  struktur: { angelegt: number; vorhanden: number }
  arbeitstage: { gesetzt: string[] | null; vorhanden: string[] | null }
  basiswerte: { angelegt: boolean }
}

export async function einrichtungAnwenden(
  locationId: string,
  einrichtung: PaketEinrichtung | undefined,
): Promise<EinrichtungsBericht | null> {
  if (!einrichtung) return null

  const standort = await prisma.location.findUnique({
    where: { id: locationId }, select: { customerId: true },
  })
  if (!standort) return null

  return prisma.$transaction(async tx => {
    const [dienste, einheiten, modell, regeln] = await Promise.all([
      tx.shift.count({ where: { locationId } }),
      tx.planningUnit.count({ where: { locationId } }),
      tx.locationRuleModelRecord.findUnique({ where: { locationId } }),
      tx.locationPlanningRules.findUnique({ where: { locationId }, select: { locationId: true } }),
    ])

    let dienstzeitenAngelegt = 0
    if (dienste === 0) {
      for (const d of einrichtung.dienstzeiten) {
        const art = DB_ART[d.art] ?? 'mid'
        await tx.shift.create({
          data: {
            locationId, name: d.name, type: art, startTime: d.von, endTime: d.bis,
            minStaff: d.mindestbesetzung ?? 0, ...FARBEN[art],
          },
        })
        dienstzeitenAngelegt++
      }
    }

    let strukturAngelegt = 0
    if (einheiten === 0 && einrichtung.struktur.length > 0) {
      // Erst die Etagen, dann die Gruppen — die Gruppen brauchen deren IDs.
      const etageId = new Map<string, string>()
      let reihenfolge = 0
      for (const e of einrichtung.struktur.filter(e => e.typ === 'etage')) {
        const neu = await tx.planningUnit.create({
          data: { locationId, name: e.name, type: 'etage', minStaff: e.mindestbesetzung ?? 1, sortOrder: reihenfolge++ },
        })
        etageId.set(e.name, neu.id)
        strukturAngelegt++
      }
      for (const g of einrichtung.struktur.filter(e => e.typ === 'gruppe')) {
        await tx.planningUnit.create({
          data: {
            locationId, name: g.name, type: 'gruppe', minStaff: g.mindestbesetzung ?? 1,
            parentId: g.etage ? etageId.get(g.etage) ?? null : null, sortOrder: reihenfolge++,
          },
        })
        strukturAngelegt++
      }
    }

    // Arbeitstage: Geschrieben wird nur, was etwas ändert. Ohne Standortmodell
    // plant der Rechendienst Mo–Fr — ein Kita-Paket mit Mo–Fr hätte also ein
    // Modell angelegt, das nichts bewirkt und doch nie wieder weggeht. Die
    // Wohngruppe dagegen braucht ihre sieben Tage ausdrücklich. Ausdrücklich
    // genannte Tage am Standort bleiben, wie sie sind.
    const bisher = (modell?.ruleModel ?? null) as {
      betriebsTyp?: string; schichtmodell?: { arbeitstage?: string[] }
    } | null
    const ausdruecklich = bisher?.schichtmodell?.arbeitstage?.length ? bisher.schichtmodell.arbeitstage : null
    const wirksam = ausdruecklich
      ?? BETRIEBSTYP_ARBEITSTAGE[bisher?.betriebsTyp ?? 'mon_fri']
      ?? BETRIEBSTYP_ARBEITSTAGE.mon_fri
    const vorhandeneTage = wirksam
    let gesetzteTage: string[] | null = null
    if (!ausdruecklich && einrichtung.arbeitstage.length > 0
      && einrichtung.arbeitstage.join() !== wirksam.join()) {
      const betriebsTyp = BETRIEBSTYP[einrichtung.arbeitstage.length] ?? 'mon_fri'
      const ruleModel = {
        ...(bisher ?? {}),
        betriebsTyp,
        schichtmodell: { ...(bisher?.schichtmodell ?? {}), arbeitstage: einrichtung.arbeitstage },
      }
      if (modell) {
        await tx.locationRuleModelRecord.update({ where: { locationId }, data: { ruleModel } })
        gesetzteTage = einrichtung.arbeitstage
      } else if (standort.customerId) {
        await tx.locationRuleModelRecord.create({
          data: { locationId, customerId: standort.customerId, ruleModel },
        })
        gesetzteTage = einrichtung.arbeitstage
      }
    }

    let basiswerteAngelegt = false
    if (!regeln) {
      const b = einrichtung.basiswerte ?? {}
      await tx.locationPlanningRules.create({
        data: {
          locationId,
          ...(b.maxWochenstunden !== undefined ? { maxWeeklyHours: Math.round(b.maxWochenstunden) } : {}),
          ...(b.ruhezeitStunden !== undefined ? { restHours: Math.round(b.ruhezeitStunden) } : {}),
          ...(b.maxFolgetage !== undefined ? { maxConsecutiveDays: Math.round(b.maxFolgetage) } : {}),
        },
      })
      basiswerteAngelegt = true
    }

    return {
      dienstzeiten: { angelegt: dienstzeitenAngelegt, vorhanden: dienste },
      struktur: { angelegt: strukturAngelegt, vorhanden: einheiten },
      arbeitstage: { gesetzt: gesetzteTage, vorhanden: vorhandeneTage },
      basiswerte: { angelegt: basiswerteAngelegt },
    }
  })
}

/** §201 Ein Satz für OKUN: was angelegt wurde und was schon da war. */
export function berichtText(b: EinrichtungsBericht | null): string | null {
  if (!b) return null
  const teile: string[] = []
  if (b.dienstzeiten.angelegt) teile.push(`${b.dienstzeiten.angelegt} Dienstzeiten angelegt`)
  else if (b.dienstzeiten.vorhanden) teile.push(`Dienstzeiten waren schon da (${b.dienstzeiten.vorhanden}) und bleiben`)
  if (b.struktur.angelegt) teile.push(`${b.struktur.angelegt} Etagen/Gruppen angelegt`)
  if (b.arbeitstage.gesetzt) teile.push(`Arbeitstage ${b.arbeitstage.gesetzt.join(', ')}`)
  return teile.length ? teile.join(' · ') : null
}

/**
 * §201 Vor dem Planen: Hat der Standort ein Paket, aber noch keine
 * Dienstzeiten, wird die Einrichtung des Pakets jetzt angelegt.
 *
 * Für Standorte, denen ihr Paket vor §201 zugeordnet wurde — ohne diesen
 * Schritt bliebe dort alles beim Alten, bis jemand bei OKUN das Paket noch
 * einmal auswählt. Gibt die Zahl der Dienstzeiten danach zurück.
 */
export async function einrichtungNachholen(locationId: string): Promise<number> {
  const [standort, dienste] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId }, select: { rulePackId: true } }),
    prisma.shift.count({ where: { locationId } }),
  ])
  if (dienste > 0 || !standort?.rulePackId) return dienste
  const paket = (await verfuegbareRegelpakete()).pakete.find(p => p.id === standort.rulePackId)
  const bericht = await einrichtungAnwenden(locationId, paket?.einrichtung)
  return bericht?.dienstzeiten.angelegt ?? 0
}
