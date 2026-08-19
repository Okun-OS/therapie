// §101 Dienstausfall — der Weg von „fällt aus" bis „jemand übernimmt".
//
// Vorher lief das über einen KI-Chat: die Leitung beschrieb den Ausfall, ein
// Sprachmodell legte eine Vertretungsanfrage an. Das ist der falsche Weg für
// eine Handlung, die ein Klick sein sollte — und niemand wurde am Ende
// benachrichtigt.
//
// Jetzt: Dienst im Plan anklicken, „fällt aus" wählen, Empfänger bestimmen,
// fertig. Die Betroffenen bekommen eine Push- und eine E-Mail-Nachricht sowie
// einen Eintrag in ihrem Postfach.

import { prisma } from './prisma'
import { notifyEmployee } from './notify'

export interface AusfallEingang {
  scheduleEntryId?: string | null
  locationId: string
  date: string
  startTime: string
  endTime: string
  shiftId?: string | null
  shiftName?: string | null
  originalEmployeeId?: string | null
  grund?: string | null
  /** 'alle' = alle Mitarbeiter des Standorts, 'auswahl' = nur die genannten */
  empfaenger: 'alle' | 'auswahl' | 'niemand'
  empfaengerIds?: string[]
  createdBy: string
}

function zeitraumText(e: { date: string; startTime: string; endTime: string }): string {
  const [j, m, t] = e.date.split('-')
  return `${t}.${m}.${j} von ${e.startTime} bis ${e.endTime}`
}

/**
 * Ausfall melden: Vertretungsanfrage anlegen, den ausgefallenen Dienst aus dem
 * Plan nehmen und die gewünschten Empfänger benachrichtigen.
 */
export async function ausfallMelden(eingang: AusfallEingang) {
  const anfrage = await prisma.substitutionRequest.create({
    data: {
      locationId: eingang.locationId,
      date: eingang.date,
      startTime: eingang.startTime,
      endTime: eingang.endTime,
      scheduleEntryId: eingang.scheduleEntryId ?? null,
      originalEmployeeId: eingang.originalEmployeeId ?? null,
      shiftId: eingang.shiftId ?? null,
      grund: eingang.grund ?? null,
      status: 'open',
      createdBy: eingang.createdBy,
    },
  })

  // Der ausgefallene Dienst verschwindet aus dem Plan — sonst steht dort
  // weiterhin jemand, der nicht kommt.
  if (eingang.scheduleEntryId) {
    await prisma.scheduleEntry.deleteMany({ where: { id: eingang.scheduleEntryId } })
  }

  const empfaenger = await empfaengerBestimmen(eingang)

  const dienst = eingang.shiftName ? `„${eingang.shiftName}“` : 'Ein Dienst'
  const titel = 'Dienst fällt aus — wer kann übernehmen?'
  const text = `${dienst} am ${zeitraumText(eingang)} ist unbesetzt.`
    + (eingang.grund ? ` Grund: ${eingang.grund}.` : '')
    + ' Wenn du einspringen kannst, melde dich in der App.'

  // Kandidaten festhalten, damit sichtbar ist, wer gefragt wurde
  if (empfaenger.length > 0) {
    await prisma.substitutionCandidate.createMany({
      data: empfaenger.map(e => ({
        requestId: anfrage.id,
        employeeId: e.id,
        employeeName: e.name,
        matchScore: 0,
        matchReasons: ['Über den Dienstausfall benachrichtigt'],
        escalationStage: 'group' as const,
        notifiedAt: new Date(),
      })),
      skipDuplicates: true,
    })
  }

  // Benachrichtigen. Ein Fehler bei einer Person darf die anderen nicht stoppen.
  const ergebnisse = await Promise.allSettled(
    empfaenger.map(e => notifyEmployee(e.id, {
      type: 'dienstausfall',
      title: titel,
      body: text,
      requestId: anfrage.id,
      url: '/employee/substitutions',
    })),
  )
  const benachrichtigt = ergebnisse.filter(r => r.status === 'fulfilled').length

  return { anfrage, benachrichtigt, gefragt: empfaenger.length }
}

async function empfaengerBestimmen(eingang: AusfallEingang) {
  if (eingang.empfaenger === 'niemand') return []

  const wo = eingang.empfaenger === 'auswahl'
    ? { id: { in: eingang.empfaengerIds ?? [] }, active: true }
    : { locationId: eingang.locationId, active: true }

  const alle = await prisma.employee.findMany({
    where: wo,
    select: { id: true, name: true, locationId: true },
  })

  // Wer selbst ausgefallen ist, bekommt keine Anfrage für den eigenen Dienst.
  // Und eine Auswahl darf nie über den Standort hinausreichen.
  return alle.filter(e =>
    e.id !== eingang.originalEmployeeId &&
    e.locationId === eingang.locationId,
  )
}

/**
 * Dienstanfrage an eine bestimmte Person — der Schritt, nachdem sich jemand
 * gemeldet hat. Sie bekommt eine verbindliche Anfrage, die sie annehmen oder
 * ablehnen kann.
 */
export async function dienstAnfragen(requestId: string, employeeId: string) {
  const anfrage = await prisma.substitutionRequest.findUnique({ where: { id: requestId } })
  if (!anfrage) throw new Error('Vertretungsanfrage nicht gefunden')
  if (anfrage.status === 'filled') throw new Error('Dieser Dienst ist bereits besetzt')

  const person = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, locationId: true },
  })
  if (!person) throw new Error('Mitarbeiter nicht gefunden')
  if (person.locationId !== anfrage.locationId) {
    throw new Error('Diese Person gehört nicht zu diesem Standort')
  }

  await prisma.substitutionCandidate.upsert({
    where: { requestId_employeeId: { requestId, employeeId } },
    create: {
      requestId, employeeId, employeeName: person.name,
      matchScore: 100, matchReasons: ['Direkt angefragt'],
      escalationStage: 'group', responseStatus: 'pending', notifiedAt: new Date(),
    },
    update: { responseStatus: 'pending', notifiedAt: new Date(), matchScore: 100 },
  })

  await notifyEmployee(employeeId, {
    type: 'dienstanfrage',
    title: 'Dienstanfrage — bitte bestätigen',
    body: `Du wurdest für den Dienst am ${zeitraumText(anfrage)} angefragt. `
      + 'Bitte in der App annehmen oder ablehnen.',
    requestId,
    url: '/employee/substitutions',
  })

  return { ok: true }
}

/**
 * Dienst endgültig besetzen: der Eintrag kommt zurück in den Plan, diesmal auf
 * die einspringende Person. Erst damit ist der Ausfall wirklich geschlossen.
 */
export async function dienstBesetzen(requestId: string, employeeId: string) {
  const anfrage = await prisma.substitutionRequest.findUnique({ where: { id: requestId } })
  if (!anfrage) throw new Error('Vertretungsanfrage nicht gefunden')
  if (anfrage.status === 'filled') throw new Error('Dieser Dienst ist bereits besetzt')
  if (!anfrage.shiftId) throw new Error('Zu dieser Anfrage ist kein Dienst hinterlegt')

  const person = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, locationId: true },
  })
  if (!person) throw new Error('Mitarbeiter nicht gefunden')
  if (person.locationId !== anfrage.locationId) {
    throw new Error('Diese Person gehört nicht zu diesem Standort')
  }

  // Doppelbelegung verhindern: an einem Tag nur ein Dienst
  const schonImDienst = await prisma.scheduleEntry.findFirst({
    where: { employeeId, date: anfrage.date },
    select: { id: true },
  })
  if (schonImDienst) throw new Error(`${person.name} hat an diesem Tag bereits einen Dienst`)

  const eintrag = await prisma.scheduleEntry.create({
    data: {
      employeeId,
      shiftId: anfrage.shiftId,
      date: anfrage.date,
      locationId: anfrage.locationId,
      startTime: anfrage.startTime,
      endTime: anfrage.endTime,
      isSubstitution: true,
      substitutionFor: anfrage.originalEmployeeId ?? null,
      reason: 'Vertretung für einen ausgefallenen Dienst',
    },
  })

  await prisma.substitutionRequest.update({
    where: { id: requestId },
    data: { status: 'filled', filledByEmployeeId: employeeId, filledAt: new Date() },
  })

  await prisma.substitutionCandidate.updateMany({
    where: { requestId, employeeId },
    data: { responseStatus: 'accepted', respondedAt: new Date() },
  })

  await notifyEmployee(employeeId, {
    type: 'dienst_uebernommen',
    title: 'Dienst übernommen',
    body: `Danke — du übernimmst den Dienst am ${zeitraumText(anfrage)}. Er steht jetzt in deinem Plan.`,
    requestId,
    url: '/employee/schedule',
  })

  return { eintrag }
}
