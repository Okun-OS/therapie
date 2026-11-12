import { redirect } from 'next/navigation'

/**
 * §200 Die Dienstplanung wird jetzt am Standort eingerichtet:
 * Kunden → Kunde → Standort aufklappen (`/okun/customers`).
 *
 * Vorher stand hier eine eigene Seite mit allen Standorten aller Kunden
 * untereinander. Die Weiterleitung bleibt, damit alte Lesezeichen nicht ins
 * Leere laufen. Die Schnittstelle `/api/okun/dienstplanung` ist unverändert.
 */
export default function DienstplanungUmgezogen() {
  redirect('/okun/customers')
}
