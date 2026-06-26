'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/lib/toast-context'
import { Mail, Plus, Send } from 'lucide-react'
import type { Role, Invitation } from '@/lib/types'

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'info' | 'warning' }> = {
  pending: { label: 'Ausstehend', variant: 'warning' },
  accepted: { label: 'Angenommen', variant: 'success' },
  expired: { label: 'Abgelaufen', variant: 'info' },
}

const ROLE_LABEL: Record<Role, string> = {
  employee: 'Mitarbeiter',
  admin: 'Einrichtungsleitung',
  company: 'Geschäftsführung',
  okun: 'OKUN Administrator',
}

export default function OkunInvitations() {
  const { showToast } = useToast()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ email: '', role: 'company' as Role, customerName: '' })
  const [errors, setErrors] = useState<string[]>([])
  const [sending, setSending] = useState(false)

  const loadInvitations = () => {
    fetch('/api/invitations')
      .then(res => res.json())
      .then(data => setInvitations(data.invitations ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    loadInvitations()
  }, [])

  const handleSend = async () => {
    const errs: string[] = []
    if (!form.email.trim()) errs.push('E-Mail ist erforderlich')
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors([data.error || 'Einladung konnte nicht versendet werden'])
        setSending(false)
        return
      }
      showToast('Einladung versendet', 'success')
      setModal(false)
      setErrors([])
      setForm({ email: '', role: 'company', customerName: '' })
      loadInvitations()
    } catch {
      setErrors(['Verbindung fehlgeschlagen. Bitte erneut versuchen.'])
    }
    setSending(false)
  }

  return (
    <>
      <Header title="Einladungen" subtitle={`${invitations.length} Einladungen versendet`} />
      <div className="p-4 sm:p-6 space-y-5">

        <div className="flex justify-end">
          <Button onClick={() => setModal(true)} className="gap-2">
            <Plus size={16} />
            Einladung versenden
          </Button>
        </div>

        <div className="space-y-3">
          {invitations.map(inv => (
            <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Mail size={18} className="text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy">{inv.email}</p>
                <p className="text-xs text-gray-500">{ROLE_LABEL[inv.role]}{inv.customerName ? ` · ${inv.customerName}` : ''}</p>
                <p className="text-xs text-gray-400 mt-0.5">Versendet am {inv.sentAt}</p>
              </div>
              <Badge variant={STATUS_BADGE[inv.status].variant}>{STATUS_BADGE[inv.status].label}</Badge>
            </div>
          ))}
          {invitations.length === 0 && (
            <div className="text-center py-12">
              <Mail size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">Keine Einladungen versendet</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setErrors([]) }} title="Einladung versenden">
        <div className="space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                {errors.map(err => <li key={err}>{err}</li>)}
              </ul>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">E-Mail</label>
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="kontakt@organisation.de"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Rolle</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="company">Geschäftsführung</option>
              <option value="admin">Einrichtungsleitung</option>
              <option value="employee">Mitarbeiter</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Organisation (optional)</label>
            <input
              value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              placeholder="z.B. Lebenshilfe Rheinland"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setModal(false); setErrors([]) }}>Abbrechen</Button>
            <Button className="flex-1 gap-2" onClick={handleSend} loading={sending}>
              <Send size={16} />
              Senden
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
