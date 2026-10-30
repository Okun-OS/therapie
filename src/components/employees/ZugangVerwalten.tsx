'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, Send, Pencil, KeyRound, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/toast-context'
import { istPlatzhalter } from '@/lib/belegschaft-import'

/**
 * §200 Der Zugang eines Mitarbeiters: E-Mail-Adresse tauschen und die
 * Einladung neu senden. Auf Standort- und auf Unternehmensebene dieselbe
 * Komponente — und dahinter dieselbe Schnittstelle, damit beide Ebenen
 * dasselbe bewirken.
 *
 * Bevor geändert wird, steht da, was mit einem bestehenden Konto geschieht.
 * Die Anmeldung eines Menschen umzulenken ist kein Tippfehler-Fix, und die
 * Leitung soll das wissen, bevor sie klickt — nicht danach.
 */

interface Stand {
  email: string
  konto: boolean
  einladung: { email: string; versendetAm: string; gueltigBis: string; abgelaufen: boolean } | null
}

const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE')

export function ZugangVerwalten({ employeeId, onEmailGeaendert }: {
  employeeId: string
  onEmailGeaendert?: (email: string) => void
}) {
  const { showToast } = useToast()
  const [stand, setStand] = useState<Stand | null>(null)
  const [bearbeiten, setBearbeiten] = useState(false)
  const [neueEmail, setNeueEmail] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')

  const laden = useCallback(async () => {
    const res = await fetch(`/api/employees/${employeeId}/invite`)
    if (res.ok) setStand(await res.json())
  }, [employeeId])

  useEffect(() => { laden() }, [laden])

  async function senden(email?: string) {
    setLaeuft(true); setFehler('')
    try {
      const res = await fetch(`/api/employees/${employeeId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email } : {}),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setFehler(d.error ?? 'Das hat nicht geklappt.'); return }
      if (d.stand) setStand(d.stand)
      if (d.adresseGeaendert) onEmailGeaendert?.(d.email)
      setBearbeiten(false)
      showToast(
        d.emailSent
          ? `Einladung an ${d.email} versendet`
          : `${d.adresseGeaendert ? 'Adresse geändert, aber die' : 'Die'} Einladung konnte nicht versendet werden`,
        d.emailSent ? 'success' : 'error',
      )
    } catch {
      setFehler('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!stand) return null

  const platzhalter = istPlatzhalter(stand.email)
  const offen = stand.einladung && !stand.einladung.abgelaufen

  let zustand: string
  if (platzhalter) zustand = 'Noch keine echte E-Mail-Adresse hinterlegt.'
  else if (stand.konto && offen) zustand = `Konto eingerichtet. Neue Einladung offen bis ${datum(stand.einladung!.gueltigBis)}.`
  else if (stand.konto) zustand = 'Konto eingerichtet.'
  else if (offen) zustand = `Eingeladen am ${datum(stand.einladung!.versendetAm)}, noch nicht angenommen — gültig bis ${datum(stand.einladung!.gueltigBis)}.`
  else if (stand.einladung) zustand = `Die Einladung vom ${datum(stand.einladung.versendetAm)} ist abgelaufen.`
  else zustand = 'Noch keine Einladung versendet.'

  return (
    <div data-test="zugang" className="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-white">
      <div className="flex items-start gap-2">
        <Mail size={15} className="text-gray-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-700">Zugang zur App</p>
          <p className="text-sm text-navy break-all" data-test="zugang-email">{stand.email}</p>
          <p className="text-xs text-gray-500 mt-0.5" data-test="zugang-stand">{zustand}</p>
        </div>
      </div>

      {bearbeiten ? (
        <div className="space-y-2">
          <input
            type="email"
            value={neueEmail}
            onChange={e => setNeueEmail(e.target.value)}
            placeholder="neue@adresse.de"
            data-test="zugang-neue-email"
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
            <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900">
              {stand.konto
                ? 'Die Anmeldung wechselt auf die neue Adresse. Über die Einladung dorthin setzt die Person ein neues Passwort. Die bisherige Adresse wird über die Änderung informiert.'
                : 'Der bisherige Einladungslink wird ungültig. Die Einladung geht an die neue Adresse.'}
            </p>
          </div>
          {fehler && <p className="text-xs text-red-600">{fehler}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200 text-xs"
              onClick={() => { setBearbeiten(false); setFehler('') }}>
              Abbrechen
            </Button>
            <Button className="flex-1 gap-1.5 text-xs" loading={laeuft}
              disabled={!neueEmail.trim()}
              onClick={() => senden(neueEmail.trim())}>
              <Send size={13} /> Ändern und einladen
            </Button>
          </div>
        </div>
      ) : (
        <>
          {fehler && <p className="text-xs text-red-600">{fehler}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setNeueEmail(''); setFehler(''); setBearbeiten(true) }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
              <Pencil size={12} /> {platzhalter ? 'Adresse eintragen' : 'Adresse ändern'}
            </button>
            {!platzhalter && (
              <button
                onClick={() => senden()}
                disabled={laeuft}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                {stand.konto
                  ? <><KeyRound size={12} /> Neu einladen (Passwort neu setzen)</>
                  : <><Send size={12} /> {stand.einladung ? 'Einladung erneut senden' : 'Einladung senden'}</>}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
