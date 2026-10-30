'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/toast-context'
import { Clock, Palmtree, Mail, Stethoscope, Info } from 'lucide-react'
import type { OrgSettings } from '@/lib/types'

/**
 * §244 Die Einstellungen der Standortleitung.
 *
 * WARUM ES DIESE SEITE VORHER NICHT GAB — UND WARUM DAS NIEMANDEM AUFFIEL
 * `/admin/settings` war eine 404. Gemerkt hat es keiner, weil nichts im Menü
 * dorthin führte: Der Punkt „Einstellungen" der Leitung listete Nachweise,
 * Recruiting, Aufgabenkatalog, Support und Funde — aber keinen Weg zu den
 * Einstellungen selbst. Der Seitendurchgang (`alle-seiten-ohne-fehler`) rief
 * die Adresse zwar auf, meldete aber grün: Er sucht nach FEHLERTEXT, und die
 * eigene 404-Seite (§234) enthält keinen. Sie sagt ruhig und auf Deutsch, dass
 * es die Seite nicht gibt.
 *
 * WARUM DAS JETZT WICHTIG WURDE
 * Gemeldet war: „Dann wurde behauptet, dass Krankenschein erst am vierten Tag
 * nötig ist … Das muss auch möglich sein, dass es eingestellt wird." §242 hat
 * die Seite der Mitarbeitenden auf die eingestellte Regel umgestellt. Nur kam
 * die Leitung an diese Einstellung nicht heran: Sie liegt unter
 * `/company/settings`, und dort steht daneben die Bankverbindung des
 * Unternehmens.
 *
 * WARUM NICHT EINFACH EIN VERWEIS AUF /company/settings
 * Weil eine Leitung dort Felder sähe, die sie nicht speichern darf — Anschrift,
 * Betriebsnummer, IBAN, DATEV-Nummern. Der Server weist das seit §113/§114
 * zurecht ab, aber ein Formular, dessen halbe Felder beim Speichern eine
 * Absage ergeben, ist schlimmer als keines. Hier steht deshalb nur, was eine
 * Standortleitung wirklich ändern darf; die Liste ist dieselbe wie
 * `ERLAUBT_ALLE` in `/api/org-settings`.
 */

const VORGABE: OrgSettings = {
  organizationName: '',
  defaultWeeklyHours: 40,
  defaultVacationDaysPerYear: 30,
  autoApproveVacationUnderDays: 0,
  notificationEmail: '',
  auNachweisAbTag: null,
}

export default function AdminSettings() {
  const { showToast } = useToast()
  const [form, setForm] = useState<OrgSettings>(VORGABE)
  const [geladen, setGeladen] = useState(false)
  const [speichert, setSpeichert] = useState(false)

  useEffect(() => {
    fetch('/api/org-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.settings) setForm({ ...VORGABE, ...d.settings }) })
      .catch(() => {})
      .finally(() => setGeladen(true))
  }, [])

  async function speichern() {
    setSpeichert(true)
    try {
      /*
       * Nur die fünf Felder dieser Seite gehen hinaus.
       *
       * `form` trägt alles, was die Schnittstelle geliefert hat. Das ganze
       * Objekt zurückzuschicken hieße, als Leitung auch die Felder des
       * Unternehmens mitzusenden — und die Absage dafür einzufangen, obwohl
       * sie hier gar nicht bearbeitet wurden.
       */
      const r = await fetch('/api/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultWeeklyHours: form.defaultWeeklyHours,
          defaultVacationDaysPerYear: form.defaultVacationDaysPerYear,
          autoApproveVacationUnderDays: form.autoApproveVacationUnderDays,
          notificationEmail: form.notificationEmail,
          auNachweisAbTag: form.auNachweisAbTag,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        showToast(d.error ?? 'Das ließ sich nicht speichern.', 'error')
        return
      }
      if (d.settings) setForm({ ...VORGABE, ...d.settings })
      showToast('Einstellungen gespeichert', 'success')
    } finally {
      setSpeichert(false)
    }
  }

  if (!geladen) return null

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Stethoscope size={16} className="text-navy" />
            <CardTitle>Krankmeldung</CardTitle>
          </div>
        </CardHeader>
        <Input
          label="Bescheinigung verlangen ab dem … Kalendertag"
          hint="Das Gesetz verlangt sie spätestens ab dem 4. Kalendertag (§5 Abs.1 EntgFG). Sie dürfen sie früher verlangen — dann muss das im Arbeitsvertrag stehen. Gezählt werden Kalendertage, nicht Arbeitstage: Wer Freitag krank wird und Montag noch krank ist, ist am vierten Tag."
          type="number"
          min={1}
          max={7}
          value={form.auNachweisAbTag ?? 4}
          onChange={e => setForm(f => ({ ...f, auNachweisAbTag: Number(e.target.value) }))}
        />
        {/*
          §244 Was die Einstellung bewirkt, steht hier und nicht erst in der
          Mitarbeiter-App. Wer eine Zahl ändert, soll sehen, was sie auslöst —
          sonst stellt man sie einmal und sieht die Wirkung nie.
        */}
        <div className="mt-3 flex gap-2 rounded-xl bg-blue-50 p-3">
          <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            {(form.auNachweisAbTag ?? 4) <= 1
              ? 'Bei dieser Einstellung braucht jede Krankmeldung eine Bescheinigung, '
                + 'auch bei einem einzigen Tag. Die Mitarbeitenden sehen das beim Melden.'
              : `Bis zu ${(form.auNachweisAbTag ?? 4) - 1} Kalendertagen wird keine `
                + 'Bescheinigung verlangt. Die Mitarbeitenden sehen das beim Melden.'}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palmtree size={16} className="text-navy" />
            <CardTitle>Urlaubsgenehmigung</CardTitle>
          </div>
        </CardHeader>
        <Input
          label="Automatische Genehmigung bis (Tage)"
          hint="Anträge bis zu dieser Dauer werden ohne Rückfrage genehmigt. 0 = immer manuell prüfen."
          type="number"
          min={0}
          value={form.autoApproveVacationUnderDays}
          onChange={e => setForm(f => ({ ...f, autoApproveVacationUnderDays: Number(e.target.value) }))}
        />
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-navy" />
            <CardTitle>Vorgaben für neue Mitarbeitende</CardTitle>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Wochenstunden (Vollzeit)"
            type="number"
            min={1}
            value={form.defaultWeeklyHours}
            onChange={e => setForm(f => ({ ...f, defaultWeeklyHours: Number(e.target.value) }))}
          />
          <Input
            label="Urlaubstage pro Jahr"
            type="number"
            min={1}
            value={form.defaultVacationDaysPerYear}
            onChange={e => setForm(f => ({ ...f, defaultVacationDaysPerYear: Number(e.target.value) }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-navy" />
            <CardTitle>Benachrichtigungen</CardTitle>
          </div>
        </CardHeader>
        <Input
          label="E-Mail für Hinweise an die Leitung"
          hint="Dorthin gehen Hinweise, die nicht an eine einzelne Person gerichtet sind."
          type="email"
          value={form.notificationEmail ?? ''}
          onChange={e => setForm(f => ({ ...f, notificationEmail: e.target.value }))}
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={speichern} disabled={speichert}>
          {speichert ? 'Wird gespeichert…' : 'Speichern'}
        </Button>
      </div>
    </div>
  )
}
