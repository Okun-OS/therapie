'use client'

import { Shield } from 'lucide-react'
import { MeineDatenrechte } from '@/components/datenschutz/MeineDatenrechte'

/**
 * §139 „Meine Daten" in der Mitarbeiter-App.
 *
 * ZWEI GRÜNDE, WARUM DIESE SEITE EXISTIERT
 *
 *   Art. 15, 17 und 20 DSGVO geben jedem das Recht zu erfahren, was gespeichert
 *   ist, es mitzunehmen und es löschen zu lassen. Bisher gab es die Auskunft
 *   nur als Link in einer Liste und die Löschung gar nicht für den Betroffenen
 *   selbst — sie musste jemand anders anstoßen.
 *
 *   Apple verlangt seit 2022, dass eine App, die ein Konto führt, das Löschen
 *   auch IN der App anbietet (Richtlinie 5.1.1 v). Ein Hinweis „schreiben Sie
 *   uns" genügt dort ausdrücklich nicht und ist ein häufiger Ablehnungsgrund.
 *
 * §140 Der Inhalt steht in `MeineDatenrechte` und wird von „Mein Konto"
 * mitbenutzt. Zwei Fassungen desselben Rechts sind genau so entstanden, wie
 * solche Dinge entstehen — und sie widersprachen sich prompt.
 */
export default function MeineDaten() {
  return (
    <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-navy font-bold text-xl flex items-center gap-2">
          <Shield size={20} className="text-teal-600" /> Meine Daten
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Was über dich gespeichert ist, zum Nachlesen und zum Mitnehmen — und der
          Weg, es löschen zu lassen.
        </p>
      </div>

      <MeineDatenrechte />

      <p className="text-[11px] text-gray-400 text-center px-4">
        Fragen dazu beantwortet deine Standortleitung oder der Datenschutzbeauftragte
        deines Arbeitgebers.
      </p>
    </div>
  )
}
