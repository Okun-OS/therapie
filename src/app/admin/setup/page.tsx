import { redirect } from 'next/navigation'

/**
 * §202 Diese Seite gibt es nicht mehr.
 *
 * Hier richtete der Kunde früher selbst ein, was ein Dienstplan braucht:
 * Betriebsform, Struktur, Dienste, Regeln — per Fragebogen, Formular oder
 * KI-Gespräch. Seit die Dienstplanung je Kunde als Regelpaket gebaut wird,
 * bringt das Paket diese Einrichtung mit, und OKUN weist es zu. Ein Kunde, der
 * hier eigene Dienste anlegte, baute an dem vorbei, wofür sein Paket gemacht
 * ist. Die Weiterleitung bleibt, damit alte Lesezeichen nicht ins Leere laufen.
 */
export default function Umgezogen() {
  redirect('/admin/schedule')
}
