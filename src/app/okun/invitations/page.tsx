'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/lib/toast-context'
import { Mail, Plus, Send, RotateCw, Ban } from 'lucide-react'
import type { Role, Invitation, Customer } from '@/lib/types'

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'info' | 'warning' }> = {
  pending: { label: 'Ausstehend', variant: 'warning' },
  accepted: { label: 'Angenommen', variant: 'success' },
  expired: { label: 'Abgelaufen', variant: 'info' },
}

const ROLE_LABEL: Record<Role, string> = {
  employee: 'Mitarbeiter',
  admin: 'Standortleitung',
  company: 'Geschäftsführung',
  okun: 'OKUN Administrator',
}

export default function OkunInvitations() {
  const { showToast } = useToast()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ email: '', role: 'company' as Role, customerId: '', customerName: '' })
  const [errors, setErrors] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const loadInvitations = () => {
    fetch('/api/invitations')
      .then(res => res.json())
      .then(data => setInvitations(data.invitations ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    loadInvitations()
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data.customers ?? []))
      .catch(() => {})
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
      setForm({ email: '', role: 'company', customerId: '', customerName: '' })
      loadInvitations()
    } catch {
      setErrors(['Verbindung fehlgeschlagen. Bitte erneut versuchen.'])
    }
    setSending(false)
  }

  const handleResend = async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/invitations/${id}/resend`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Einladung konnte nicht erneut versendet werden', 'error')
      } else {
        showToast(data.emailSent ? 'Einladung erneut versendet' : 'Einladung erneuert, E-Mail konnte aber nicht versendet werden', data.emailSent ? 'success' : 'error')
        loadInvitations()
      }
    } catch {
      showToast('Verbindung fehlgeschlagen. Bitte erneut versuchen.', 'error')
    }
    setActingId(null)
  }

  const handleRevoke = async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/invitations/${id}/revoke`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Einladung konnte nicht zurückgezogen werden', 'error')
      } else {
        showToast('Einladung zurückgezogen', 'success')
        loadInvitations()
      }
    } catch {
      showToast('Verbindung fehlgeschlagen. Bitte erneut versuchen.', 'error')
    }
    setActingId(null)
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
              {inv.status !== 'accepted' && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border border-gray-200 px-2.5"
                    loading={actingId === inv.id}
                    onClick={() => handleResend(inv.id)}
                    title="Erneut senden"
                  >
                    <RotateCw size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border border-gray-200 px-2.5 text-red-600"
                    loading={actingId === inv.id}
                    onClick={() => handleRevoke(inv.id)}
                    title="Zurückziehen"
                  >
                    <Ban size={14} />
                  </Button>
                </div>
              )}
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
          <Input
            label="E-Mail"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="kontakt@organisation.de"
          />
          <Select
            label="Rolle"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
          >
            <option value="company">Geschäftsführung</option>
            <option value="admin">Standortleitung</option>
            <option value="employee">Mitarbeiter</option>
          </Select>
          {(form.role === 'company' || form.role === 'admin') && (
            <Select
              label="Unternehmen"
              value={form.customerId}
              onChange={e => {
                const customerId = e.target.value
                const customer = customers.find(c => c.id === customerId)
                setForm(f => ({ ...f, customerId, customerName: customer?.name ?? f.customerName }))
              }}
              hint={!form.customerId ? 'Ohne Zuordnung kann diese Person später keine Mitarbeiter anlegen, bis ein OKUN-Administrator sie manuell zuordnet.' : undefined}
            >
              <option value="">Keine Zuordnung (später manuell zuordnen)</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
          {!form.customerId && (
            <Input
              label="Organisation (optional, nur Anzeigename)"
              value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              placeholder="z.B. Lebenshilfe Rheinland"
              hint="Neue Organisationen bitte über 'Kunde anlegen' in Kunden & Organisationen anlegen, damit Standorte und Mitarbeiter korrekt zugeordnet werden können."
            />
          )}
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
