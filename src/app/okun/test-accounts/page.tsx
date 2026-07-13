'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/toast-context'
import { KeyRound, Plus, CheckCircle2, Clock } from 'lucide-react'
import type { Customer, TestAccount } from '@/lib/types'

export default function OkunTestAccounts() {
  const { showToast } = useToast()
  const [CUSTOMERS, setCUSTOMERS] = useState<Customer[]>([])
  const [TEST_ACCOUNTS, setTEST_ACCOUNTS] = useState<TestAccount[]>([])
  const [addModal, setAddModal] = useState(false)
  const [form, setForm] = useState({ customerName: '', contactEmail: '', durationDays: 30 })
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCUSTOMERS(d.customers))
    fetch('/api/test-accounts').then(r => r.json()).then(d => setTEST_ACCOUNTS(d.accounts))
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const handleAdd = async () => {
    const errs: string[] = []
    if (!form.customerName.trim()) errs.push('Organisation ist erforderlich')
    if (!form.contactEmail.trim()) errs.push('E-Mail ist erforderlich')
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    const account = await fetch('/api/test-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json()).then(d => d.account)
    setTEST_ACCOUNTS(prev => [...prev, account])
    showToast('Testzugang angelegt', 'success')
    setAddModal(false)
    setErrors([])
    setForm({ customerName: '', contactEmail: '', durationDays: 30 })
  }

  const convertToCustomer = async (testAccountId: string, customerName: string) => {
    const existing = CUSTOMERS.find(c => c.name === customerName)
    if (existing) {
      const updated = await fetch(`/api/customers/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      }).then(r => r.json()).then(d => d.customer)
      setCUSTOMERS(prev => prev.map(c => c.id === updated.id ? updated : c))
      const account = await fetch(`/api/test-accounts/${testAccountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ converted: true }),
      }).then(r => r.json()).then(d => d.account)
      setTEST_ACCOUNTS(prev => prev.map(t => t.id === account.id ? account : t))
      showToast(`${customerName} ist jetzt aktiver Kunde`, 'success')
    } else {
      showToast('Kunde nicht gefunden – bitte unter „Kunden“ anlegen', 'error')
    }
  }

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-5">

        <div className="flex justify-end">
          <Button onClick={() => setAddModal(true)} className="gap-2">
            <Plus size={16} />
            Testzugang anlegen
          </Button>
        </div>

        <div className="space-y-3">
          {TEST_ACCOUNTS.map(ta => {
            const expired = ta.expiresAt < today
            return (
              <div key={ta.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <KeyRound size={18} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{ta.customerName}</p>
                  <p className="text-xs text-gray-500">{ta.contactEmail}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock size={10} />
                    {ta.createdAt} bis {ta.expiresAt}
                  </p>
                </div>
                {ta.converted ? (
                  <Badge variant="success">Übernommen</Badge>
                ) : expired ? (
                  <Badge variant="danger">Abgelaufen</Badge>
                ) : (
                  <Button variant="ghost" className="border border-gray-200 gap-1.5" onClick={() => convertToCustomer(ta.id, ta.customerName)}>
                    <CheckCircle2 size={14} />
                    Übernehmen
                  </Button>
                )}
              </div>
            )
          })}
          {TEST_ACCOUNTS.length === 0 && (
            <div className="text-center py-12">
              <KeyRound size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">Keine Testzugänge vorhanden</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={addModal} onClose={() => { setAddModal(false); setErrors([]) }} title="Testzugang anlegen">
        <div className="space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                {errors.map(err => <li key={err}>{err}</li>)}
              </ul>
            </div>
          )}
          <Input
            label="Organisation"
            value={form.customerName}
            onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
            placeholder="z.B. Tagespflege Sonnenhof"
          />
          <Input
            label="E-Mail"
            value={form.contactEmail}
            onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
            placeholder="kontakt@organisation.de"
          />
          <Input
            label="Laufzeit (Tage)"
            type="number"
            min={1}
            value={form.durationDays}
            onChange={e => setForm(f => ({ ...f, durationDays: Number(e.target.value) }))}
          />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setAddModal(false); setErrors([]) }}>Abbrechen</Button>
            <Button className="flex-1" onClick={handleAdd}>Speichern</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
