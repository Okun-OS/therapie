import { prisma } from './prisma'
import { abgleichen, naechsteFaelligkeit, type Nachweisart, type Frist } from './fristen'

/**
 * §148 Einem neu angelegten Menschen seine Pflichtnachweise zuweisen.
 *
 * WARUM DAS AUTOMATISCH GESCHIEHT
 * Weil der Tag der Einstellung genau der Tag ist, an dem niemand daran denkt.
 * Führungszeugnis, Infektionsschutzbelehrung, Erste Hilfe — das sind die
 * Fristen, deren Fehlen einem erst bei der Prüfung auffällt. Wer über die
 * Bewerbung ins Haus kommt, hat seine Liste ab dem ersten Tag.
 *
 * WAS NICHT PASSIERT
 * Nichts wird überschrieben und nichts weggeräumt. Der Abgleich legt nur an,
 * was fehlt — zweimal aufgerufen ändert er beim zweiten Mal nichts.
 */
export async function fristenFuerPersonAnlegen(
  employeeId: string, customerId: string,
): Promise<number> {
  const person = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, position: true, qualifications: true, joinedAt: true },
  })
  if (!person) return 0

  const arten = await prisma.nachweisart.findMany({ where: { customerId, aktiv: true } })
  if (arten.length === 0) return 0
  const vorhandene = await prisma.frist.findMany({ where: { employeeId } })

  const { anzulegen } = abgleichen(
    arten as unknown as Nachweisart[],
    person as never,
    vorhandene as unknown as Frist[],
  )

  let angelegt = 0
  for (const art of anzulegen) {
    try {
      await prisma.frist.create({
        data: {
          employeeId, customerId, nachweisartId: art.id,
          bezeichnung: art.name, gattung: art.gattung,
          faelligAm: naechsteFaelligkeit(art, null, person.joinedAt),
        },
      })
      angelegt++
    } catch {
      // Die Eindeutigkeit (employeeId + nachweisartId) fängt Doppelte ab.
    }
  }
  return angelegt
}
