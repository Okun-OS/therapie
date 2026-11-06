'use client'

/**
 * §131 Lohnabrechnung auf Unternehmensebene.
 *
 * Die Navigation des Unternehmens zeigte hierher — der Weg führte aber nach
 * `/admin/payroll`, und dessen Layout lässt nur die Rolle „admin" zu. Wer als
 * Unternehmen darauf klickte, landete wortlos wieder auf dem Dashboard.
 *
 * Dieselbe Seite, nur unter dem Layout des Unternehmens. Der Inhalt braucht
 * keinen Standort: die Abrechnungen werden serverseitig auf den Bereich des
 * Aufrufers eingegrenzt (`scope.ts`) — beim Unternehmen sind das alle eigenen
 * Standorte.
 */
export { default } from '@/app/admin/payroll/page'
