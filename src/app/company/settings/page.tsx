'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/toast-context'
import { Building2, Clock, Palmtree, CheckCircle2, Mail } from 'lucide-react'
import type { OrgSettings } from '@/lib/types'

const DEFAULT_SETTINGS: OrgSettings = {
  organizationName: '',
  defaultWeeklyHours: 40,
  defaultVacationDaysPerYear: 30,
  autoApproveVacationUnderDays: 0,
  notificationEmail: '',
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
      <Header title="Organisationsweite Einstellungen" subtitle="Gilt für alle Standorte" />
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
