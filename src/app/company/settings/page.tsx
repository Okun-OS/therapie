'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ORG_SETTINGS, updateOrgSettings } from '@/lib/mock-data'
import { useToast } from '@/lib/toast-context'
import { Building2, Clock, Palmtree, CheckCircle2, Mail } from 'lucide-react'

export default function CompanySettings() {
  const { showToast } = useToast()
  const [form, setForm] = useState(ORG_SETTINGS)

  const handleSave = () => {
    updateOrgSettings(form)
    showToast('Einstellungen gespeichert', 'success')
  }

  return (
    <>
      <Header title="Organisationsweite Einstellungen" subtitle="Gilt für alle Einrichtungen" />
      <div className="p-4 sm:p-6 space-y-5">

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-navy" />
              <CardTitle>Organisation</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Name der Organisation</label>
              <input
                value={form.organizationName}
                onChange={e => setForm(f => ({ ...f, organizationName: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-gray-400" />
              <input
                value={form.notificationEmail}
                onChange={e => setForm(f => ({ ...f, notificationEmail: e.target.value }))}
                placeholder="Benachrichtigungs-E-Mail"
                className="flex-1 px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-navy" />
              <CardTitle>Standardwerte für neue Einrichtungen</CardTitle>
            </div>
          </CardHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Wochenstunden (Vollzeit)</label>
              <input
                type="number"
                min={1}
                value={form.defaultWeeklyHours}
                onChange={e => setForm(f => ({ ...f, defaultWeeklyHours: Number(e.target.value) }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Urlaubstage pro Jahr</label>
              <input
                type="number"
                min={1}
                value={form.defaultVacationDaysPerYear}
                onChange={e => setForm(f => ({ ...f, defaultVacationDaysPerYear: Number(e.target.value) }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palmtree size={16} className="text-navy" />
              <CardTitle>Urlaubsgenehmigung</CardTitle>
            </div>
          </CardHeader>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Automatische Genehmigung bis (Tage)</label>
            <p className="text-xs text-gray-400 mb-2">Anträge bis zu dieser Dauer werden ohne Rückfrage an die Einrichtungsleitung genehmigt. 0 = immer manuell prüfen.</p>
            <input
              type="number"
              min={0}
              value={form.autoApproveVacationUnderDays}
              onChange={e => setForm(f => ({ ...f, autoApproveVacationUnderDays: Number(e.target.value) }))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
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
