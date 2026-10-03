'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Receipt, Download, FileText, Loader2 } from 'lucide-react'

/**
 * §137 Meine Lohnabrechnungen.
 *
 * Sie lagen bisher in der Personalakte zwischen Verträgen, Zeugnissen und
 * Krankmeldungen. Das ist ordentlich abgelegt und für den Mitarbeiter trotzdem
 * am falschen Platz: Die Lohnabrechnung ist einer der häufigsten Gründe, die
 * App überhaupt zu öffnen — meist mit einem konkreten Anlass, etwa weil die
 * Bank sie sehen will.
 *
 * Deshalb ein eigener Ort, nach Jahren sortiert, mit dem Monat als Überschrift
 * statt eines Dateinamens wie „Entgeltabrechnung_2026_09_Fischer.pdf".
 */

interface Datei {
  id: string
  dateiname: string
  kategorie: string
  groesse: number
  createdAt: string
  gueltigVon?: string | null
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/**
 * Aus dem Dateinamen Monat und Jahr lesen.
 *
 * Die Belege heißen nach dem Muster „…2026_09…" oder „…09_2026…". Findet sich
 * nichts, bleibt das Datum der Ablage — dann steht eben das da, statt zu raten.
 */
function zeitraum(d: Datei): { jahr: number; monat: number | null } {
  const name = d.dateiname
  const jm = name.match(/(20\d{2})[_-](0[1-9]|1[0-2])/)
  if (jm) return { jahr: Number(jm[1]), monat: Number(jm[2]) }
  const mj = name.match(/(0[1-9]|1[0-2])[_-](20\d{2})/)
  if (mj) return { jahr: Number(mj[2]), monat: Number(mj[1]) }
  const abgelegt = new Date(d.createdAt)
  return { jahr: abgelegt.getFullYear(), monat: null }
}

const groesse = (b: number) =>
  b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

export default function MeinLohn() {
  const { user } = useAuth()
  const [dateien, setDateien] = useState<Datei[]>([])
  const [laedt, setLaedt] = useState(true)

  useEffect(() => {
    if (!user?.employeeId) return
    fetch(`/api/files?ownerType=employee&ownerId=${user.employeeId}`)
      .then(r => r.json())
      .then(d => setDateien(d.dateien ?? []))
      .catch(() => setDateien([]))
      .finally(() => setLaedt(false))
  }, [user?.employeeId])

  const abrechnungen = dateien
    .filter(d => d.kategorie === 'lohnabrechnung')
    .map(d => ({ ...d, ...zeitraum(d) }))
    .sort((a, b) => b.jahr - a.jahr || (b.monat ?? 0) - (a.monat ?? 0))

  const jahre = Array.from(new Set(abrechnungen.map(a => a.jahr)))

  // Die Jahresübersicht ist keine Lohnsteuerbescheinigung — sie heißt hier
  // genauso, wie sie im System heißt, damit niemand etwas anderes erwartet.
  const jahresbelege = dateien.filter(d => d.dateiname?.startsWith('Jahresuebersicht'))

  return (
    <div className="px-4 pt-4 pb-2 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-navy font-bold text-xl flex items-center gap-2">
          <Receipt size={20} className="text-teal-600" /> Lohnabrechnungen
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Deine Abrechnungen zum Ansehen und Herunterladen.
        </p>
      </div>

      {laedt ? (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      ) : abrechnungen.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <p className="text-sm text-gray-500">Noch keine Abrechnung hinterlegt.</p>
          <p className="text-xs text-gray-400 mt-1">
            Sobald dein Betrieb den Monat abgerechnet hat, erscheint sie hier — und du
            bekommst eine Nachricht.
          </p>
        </div>
      ) : (
        jahre.map(jahr => (
          <div key={jahr} className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase px-1">{jahr}</p>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {abrechnungen.filter(a => a.jahr === jahr).map(a => (
                <a
                  key={a.id}
                  href={`/api/files/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50"
                >
                  <FileText size={18} className="text-gray-300 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-navy">
                      {a.monat ? MONATE[a.monat - 1] : a.dateiname}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {groesse(a.groesse)}
                    </span>
                  </span>
                  <Download size={17} className="text-teal-600 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        ))
      )}

      {jahresbelege.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase px-1">Jahresübersichten</p>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {jahresbelege.map(d => (
              <a
                key={d.id}
                href={`/api/files/${d.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50"
              >
                <FileText size={18} className="text-gray-300 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-navy">{d.dateiname}</span>
                  <span className="block text-xs text-gray-400">{groesse(d.groesse)}</span>
                </span>
                <Download size={17} className="text-teal-600 shrink-0" />
              </a>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 px-1">
            Die Jahresübersicht ist keine Lohnsteuerbescheinigung. Die amtliche Bescheinigung
            kommt von der Finanzverwaltung.
          </p>
        </div>
      )}
    </div>
  )
}
