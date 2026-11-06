'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/toast-context'
import { Building2, Clock, Palmtree, CheckCircle2, Mail, Stethoscope } from 'lucide-react'
import type { OrgSettings } from '@/lib/types'

const DEFAULT_SETTINGS: OrgSettings = {
  organizationName: '',
  defaultWeeklyHours: 40,
  defaultVacationDaysPerYear: 30,
  autoApproveVacationUnderDays: 0,
  notificationEmail: '',
  auNachweisAbTag: null,
}

export default function CompanySettings() {
  const { showToast } = useToast()
  const [form, setForm] = useState<OrgSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    fetch('/api/org-settings').then(r => r.json()).then(d => setForm(d.settings))
  }, [])

  const handleSave = async () => {
    const updated = await fetch('/api/org-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json()).then(d => d.settings)
    setForm(updated)
    showToast('Einstellungen gespeichert', 'success')
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-5">

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-navy" />
              <CardTitle>Organisation</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Name der Organisation"
              value={form.organizationName}
              onChange={e => setForm(f => ({ ...f, organizationName: e.target.value }))}
            />
            <Input
              icon={Mail}
              value={form.notificationEmail}
              onChange={e => setForm(f => ({ ...f, notificationEmail: e.target.value }))}
              placeholder="Benachrichtigungs-E-Mail"
            />
          </div>
        </Card>

        {/* §113/§114 Ohne diese Angaben gibt es keine Entgeltabrechnung und
            keine SEPA-Datei — deshalb stehen sie hier und nicht versteckt. */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-navy" />
              <CardTitle>Angaben für die Lohnabrechnung</CardTitle>
            </div>
          </CardHeader>
          <p className="text-xs text-gray-400 mb-3">
            Die Anschrift steht auf jeder Entgeltabrechnung. Die Bankverbindung
            wird für die SEPA-Datei gebraucht, die Beraterdaten für den DATEV-Export.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Input label="Straße und Hausnummer" value={form.strasse ?? ''}
                onChange={e => setForm(f => ({ ...f, strasse: e.target.value }))} />
            </div>
            <Input label="PLZ" value={form.plz ?? ''}
              onChange={e => setForm(f => ({ ...f, plz: e.target.value }))} />
            <Input label="Ort" value={form.ort ?? ''}
              onChange={e => setForm(f => ({ ...f, ort: e.target.value }))} />
            <Input label="Betriebsnummer" placeholder="8-stellig, Agentur für Arbeit"
              value={form.betriebsnummer ?? ''}
              onChange={e => setForm(f => ({ ...f, betriebsnummer: e.target.value }))} />
            <Input label="Steuernummer" value={form.steuernummer ?? ''}
              onChange={e => setForm(f => ({ ...f, steuernummer: e.target.value }))} />
            <div className="sm:col-span-2">
              <Input label="IBAN des Unternehmens" placeholder="Von diesem Konto gehen die Gehälter ab"
                value={form.iban ?? ''}
                onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} />
            </div>
            <Input label="BIC" value={form.bic ?? ''}
              onChange={e => setForm(f => ({ ...f, bic: e.target.value }))} />
            <Input label="Kontoinhaber" placeholder="falls abweichend vom Namen"
              value={form.kontoinhaber ?? ''}
              onChange={e => setForm(f => ({ ...f, kontoinhaber: e.target.value }))} />
            <Input label="DATEV-Beraternummer" value={form.datevBeraternummer ?? ''}
              onChange={e => setForm(f => ({ ...f, datevBeraternummer: e.target.value }))} />
            <Input label="DATEV-Mandantennummer" value={form.datevMandantennummer ?? ''}
              onChange={e => setForm(f => ({ ...f, datevMandantennummer: e.target.value }))} />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-navy" />
              <CardTitle>Standardwerte für neue Standorte</CardTitle>
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
              <Palmtree size={16} className="text-navy" />
              <CardTitle>Urlaubsgenehmigung</CardTitle>
            </div>
          </CardHeader>
          <Input
            label="Automatische Genehmigung bis (Tage)"
            hint="Anträge bis zu dieser Dauer werden ohne Rückfrage an die Standortleitung genehmigt. 0 = immer manuell prüfen."
            type="number"
            min={0}
            value={form.autoApproveVacationUnderDays}
            onChange={e => setForm(f => ({ ...f, autoApproveVacationUnderDays: Number(e.target.value) }))}
          />
        </Card>

        {/*
          §130 §5 Abs.1 EntgFG: die Bescheinigung ist spaetestens am vierten
          Kalendertag vorzulegen. Satz 3 erlaubt dem Arbeitgeber, sie frueher zu
          verlangen — das steht dann im Arbeitsvertrag. Deshalb einstellbar und
          nicht einprogrammiert.
        */}
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
        </Card>

        <div className="flex justify-end">
          <Button className="gap-2" onClick={handleSave}>
            <CheckCircle2 size={16} />
            Einstellungen speichern
          </Button>
        </div>
      </div>
    </>
  )
}
