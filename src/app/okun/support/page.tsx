'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SUPPORT_LOG, addSupportAccess, revokeSupportAccess, CUSTOMERS } from '@/lib/mock-data'
import { useToast } from '@/lib/toast-context'
import { LifeBuoy, Plus, ShieldOff } from 'lucide-react'

export default function OkunSupport() {
  const { showToast } = useToast()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ customerName: '', requestedBy: 'Lea Okun', reason: '' })
  const [errors, setErrors] = useState<string[]>([])

  const handleGrant = () => {
    const errs: string[] = []
    if (!form.customerName.trim()) errs.push('Organisation ist erforderlich')
    if (!form.reason.trim()) errs.push('Begründung ist erforderlich')
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    addSupportAccess(form)
    showToast('Support-Zugriff gewährt', 'success')
    setModal(false)
    setErrors([])
    setForm({ customerName: '', requestedBy: 'Lea Okun', reason: '' })
  }

  const handleRevoke = (id: string) => {
    revokeSupportAccess(id)
    showToast('Support-Zugriff entzogen', 'success')
  }

  return (
    <>
      <Header title="Support" subtitle="Supportzugriffe auf Kundenorganisationen" />
      <div className="p-4 sm:p-6 space-y-5">

        <div className="flex justify-end">
          <Button onClick={() => setModal(true)} className="gap-2">
            <Plus size={16} />
            Zugriff anfordern
          </Button>
        </div>

        <div className="space-y-3">
          {SUPPORT_LOG.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <LifeBuoy size={18} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy">{s.customerName}</p>
                <p className="text-xs text-gray-500">{s.reason}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Angefordert von {s.requestedBy} am {s.grantedAt}
                  {s.revokedAt && ` · beendet am ${s.revokedAt}`}
                </p>
              </div>
              {s.revokedAt ? (
                <Badge variant="default">Beendet</Badge>
              ) : (
                <Button variant="ghost" className="border border-gray-200 gap-1.5" onClick={() => handleRevoke(s.id)}>
                  <ShieldOff size={14} />
                  Entziehen
                </Button>
              )}
            </div>
          ))}
          {SUPPORT_LOG.length === 0 && (
            <div className="text-center py-12">
              <LifeBuoy size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">Keine Support-Zugriffe protokolliert</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setErrors([]) }} title="Support-Zugriff anfordern">
        <div className="space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                {errors.map(err => <li key={err}>{err}</li>)}
              </ul>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Organisation</label>
            <select
              value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Bitte wählen...</option>
              {CUSTOMERS.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Begründung</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="z.B. Support-Ticket #1234: Hilfe bei Dienstplan-Erstellung"
              rows={3}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setModal(false); setErrors([]) }}>Abbrechen</Button>
            <Button className="flex-1" onClick={handleGrant}>Gewähren</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
