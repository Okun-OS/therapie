'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/lib/toast-context'
import { Building2, Plus, Mail, ChevronRight, Edit, Users, KeyRound, AlertTriangle } from 'lucide-react'
import type { Customer, CustomerStatus, LicensePlan } from '@/lib/types'

interface UnassignedLocation { id: string; name: string; city: string; employeeCount: number }
interface UnassignedCompanyUser { id: string; name: string; email: string }

const STATUS_BADGE: Record<CustomerStatus, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' }> = {
  trial: { label: 'Test', variant: 'info' },
  active: { label: 'Aktiv', variant: 'success' },
  suspended: { label: 'Gesperrt', variant: 'danger' },
  cancelled: { label: 'Gekündigt', variant: 'warning' },
}

const PLAN_LABEL: Record<LicensePlan, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

export default function OkunCustomers() {
  const { showToast } = useToast()
  const [CUSTOMERS, setCUSTOMERS] = useState<Customer[]>([])
  const [unassignedLocations, setUnassignedLocations] = useState<UnassignedLocation[]>([])
  const [unassignedCompanyUsers, setUnassignedCompanyUsers] = useState<UnassignedCompanyUser[]>([])
  const [assignChoice, setAssignChoice] = useState<Record<string, string>>({})

  const loadUnassigned = () => {
    fetch('/api/okun/unassigned').then(r => r.json()).then(d => {
      setUnassignedLocations(d.locations ?? [])
      setUnassignedCompanyUsers(d.companyUsers ?? [])
    })
  }

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCUSTOMERS(d.customers))
    loadUnassigned()
  }, [])

  const assignToCustomer = async (type: 'location' | 'companyUser', id: string) => {
    const customerId = assignChoice[id]
    if (!customerId) {
      showToast('Bitte zuerst ein Unternehmen auswählen', 'error')
      return
    }
    await fetch('/api/okun/unassigned/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, customerId }),
    })
    showToast('Zuordnung gespeichert', 'success')
    loadUnassigned()
  }

  const [selected, setSelected] = useState<Customer | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', contactName: '', contactEmail: '', status: 'trial' as CustomerStatus, plan: 'starter' as LicensePlan, seatsLicensed: 0 })
  const [addModal, setAddModal] = useState(false)
  const [newCust, setNewCust] = useState({ name: '', contactName: '', contactEmail: '', plan: 'starter' as LicensePlan, seatsLicensed: 10 })
  const [addErrors, setAddErrors] = useState<string[]>([])

  const startEditing = (c: Customer) => {
    setEditForm({ name: c.name, contactName: c.contactName, contactEmail: c.contactEmail, status: c.status, plan: c.plan, seatsLicensed: c.seatsLicensed })
    setIsEditing(true)
  }

  const saveEdit = async () => {
    if (!selected) return
    if (!editForm.name.trim() || !editForm.contactEmail.trim()) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error')
      return
    }
    const updated = await fetch(`/api/customers/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    }).then(r => r.json()).then(d => d.customer)
    setCUSTOMERS(prev => prev.map(c => c.id === updated.id ? updated : c))
    setSelected(updated)
    showToast('Kunde aktualisiert', 'success')
    setIsEditing(false)
  }

  const handleAddCustomer = async () => {
    const errors: string[] = []
    if (!newCust.name.trim()) errors.push('Name ist erforderlich')
    if (!newCust.contactName.trim()) errors.push('Ansprechpartner ist erforderlich')
    if (!newCust.contactEmail.trim()) errors.push('E-Mail ist erforderlich')
    if (newCust.seatsLicensed < 1) errors.push('Mindestens 1 Lizenzplatz erforderlich')

    if (errors.length > 0) {
      setAddErrors(errors)
      return
    }

    const { customer, emailSent } = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCust),
    }).then(r => r.json())
    setCUSTOMERS(prev => [...prev, customer])
    if (emailSent) {
      showToast('Kunde angelegt · Einladung versendet', 'success')
    } else {
      showToast('Kunde angelegt, Einladung konnte aber nicht versendet werden', 'error')
    }
    setAddModal(false)
    setAddErrors([])
    setNewCust({ name: '', contactName: '', contactEmail: '', plan: 'starter', seatsLicensed: 10 })
  }

  return (
    <>
      <Header title="Kunden & Organisationen" subtitle={`${CUSTOMERS.length} Kunden verwaltet`} />
      <div className="p-4 sm:p-6 space-y-5">

        <div className="flex justify-end">
          <Button onClick={() => setAddModal(true)} className="gap-2">
            <Plus size={16} />
            Kunde anlegen
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-navy">{CUSTOMERS.length}</p>
            <p className="text-xs text-gray-500">Kunden</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-navy">{CUSTOMERS.filter(c => c.status === 'active').length}</p>
            <p className="text-xs text-gray-500">Aktive Abonnements</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-navy">{CUSTOMERS.reduce((s, c) => s + c.seatsUsed, 0)}/{CUSTOMERS.reduce((s, c) => s + c.seatsLicensed, 0)}</p>
            <p className="text-xs text-gray-500">Lizenzplätze genutzt</p>
          </div>
        </div>

        {(unassignedLocations.length > 0 || unassignedCompanyUsers.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-navy text-sm">Nicht zugeordnete Altdaten</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Diese Standorte/Accounts entstanden, bevor Unternehmens-Zuordnung im System existierte. Bitte einmalig dem richtigen Unternehmen zuordnen – Mitarbeiter und Logins dieses Standorts werden automatisch mit zugeordnet.
                </p>
              </div>
            </div>

            {unassignedLocations.map(loc => (
              <div key={loc.id} className="flex items-center gap-2 bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{loc.name}</p>
                  <p className="text-xs text-gray-500">{loc.city} · {loc.employeeCount} Mitarbeiter</p>
                </div>
                <Select
                  value={assignChoice[loc.id] ?? ''}
                  onChange={e => setAssignChoice(prev => ({ ...prev, [loc.id]: e.target.value }))}
                  className="w-48"
                >
                  <option value="">Unternehmen wählen…</option>
                  {CUSTOMERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Button onClick={() => assignToCustomer('location', loc.id)}>Zuordnen</Button>
              </div>
            ))}

            {unassignedCompanyUsers.map(u => (
              <div key={u.id} className="flex items-center gap-2 bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email} · Geschäftsführung</p>
                </div>
                <Select
                  value={assignChoice[u.id] ?? ''}
                  onChange={e => setAssignChoice(prev => ({ ...prev, [u.id]: e.target.value }))}
                  className="w-48"
                >
                  <option value="">Unternehmen wählen…</option>
                  {CUSTOMERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Button onClick={() => assignToCustomer('companyUser', u.id)}>Zuordnen</Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {CUSTOMERS.map(c => (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer overflow-hidden"
            >
              <div className="bg-gradient-to-r from-navy to-navy-light p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/20 border border-brand/30 flex items-center justify-center">
                    <Building2 size={18} className="text-brand" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{c.name}</p>
                    <p className="text-navy-100 text-xs mt-0.5">{c.contactName} · {c.contactEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
                  <ChevronRight size={16} className="text-navy-100" />
                </div>
              </div>

              <div className="p-4 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <KeyRound size={14} className="text-gray-400" />
                    <span className="text-sm font-bold text-navy">{PLAN_LABEL[c.plan]}</span>
                  </div>
                  <p className="text-xs text-gray-500">Lizenz</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Users size={14} className="text-gray-400" />
                    <span className="text-lg font-bold text-navy">{c.seatsUsed}/{c.seatsLicensed}</span>
                  </div>
                  <p className="text-xs text-gray-500">Plätze</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-navy mb-0.5">{c.locationsCount}</p>
                  <p className="text-xs text-gray-500">Standorte</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setIsEditing(false) }}
        title={isEditing ? 'Kunde bearbeiten' : 'Kunden-Details'}
        size="lg"
      >
        {selected && isEditing && (
          <div className="space-y-4">
            <Input
              label="Organisation"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Ansprechpartner"
              value={editForm.contactName}
              onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))}
            />
            <Input
              label="E-Mail"
              value={editForm.contactEmail}
              onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Status"
                value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value as CustomerStatus }))}
              >
                <option value="trial">Test</option>
                <option value="active">Aktiv</option>
                <option value="suspended">Gesperrt</option>
                <option value="cancelled">Gekündigt</option>
              </Select>
              <Select
                label="Lizenz-Plan"
                value={editForm.plan}
                onChange={e => setEditForm(f => ({ ...f, plan: e.target.value as LicensePlan }))}
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </div>
            <Input
              label="Lizenzplätze"
              type="number"
              min={1}
              value={editForm.seatsLicensed}
              onChange={e => setEditForm(f => ({ ...f, seatsLicensed: Number(e.target.value) }))}
            />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setIsEditing(false)}>Abbrechen</Button>
              <Button className="flex-1" onClick={saveEdit}>Speichern</Button>
            </div>
          </div>
        )}

        {selected && !isEditing && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-navy flex items-center justify-center">
                <Building2 size={24} className="text-brand" />
              </div>
              <div>
                <p className="text-xl font-bold text-navy">{selected.name}</p>
                <p className="text-gray-500 text-sm">{selected.contactName} · {selected.contactEmail}</p>
              </div>
              <Badge variant={STATUS_BADGE[selected.status].variant} className="ml-auto">{STATUS_BADGE[selected.status].label}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-navy">{PLAN_LABEL[selected.plan]}</p>
                <p className="text-xs text-gray-500">Lizenz-Plan</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-navy">{selected.seatsUsed}/{selected.seatsLicensed}</p>
                <p className="text-xs text-gray-500">Lizenzplätze genutzt</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Standorte</span>
                <span className="font-semibold text-navy">{selected.locationsCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Kunde seit</span>
                <span className="font-semibold text-navy">{selected.createdAt}</span>
              </div>
              {selected.renewalDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Verlängerung</span>
                  <span className="font-semibold text-navy">{selected.renewalDate}</span>
                </div>
              )}
              {selected.notes && (
                <div className="pt-1.5 border-t border-gray-100 mt-1.5">
                  <p className="text-xs text-gray-500">{selected.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setSelected(null)}>Schließen</Button>
              <Button className="flex-1 gap-2" onClick={() => startEditing(selected)}>
                <Edit size={16} />
                Bearbeiten
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={addModal} onClose={() => { setAddModal(false); setAddErrors([]) }} title="Kunde anlegen">
        <div className="space-y-4">
          {addErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                {addErrors.map(err => <li key={err}>{err}</li>)}
              </ul>
            </div>
          )}
          <Input
            label="Organisation"
            value={newCust.name}
            onChange={e => setNewCust(c => ({ ...c, name: e.target.value }))}
            placeholder="z.B. Lebenshilfe Musterstadt"
          />
          <Input
            label="Ansprechpartner"
            value={newCust.contactName}
            onChange={e => setNewCust(c => ({ ...c, contactName: e.target.value }))}
            placeholder="Name der Geschäftsführung"
          />
          <Input
            icon={Mail}
            value={newCust.contactEmail}
            onChange={e => setNewCust(c => ({ ...c, contactEmail: e.target.value }))}
            placeholder="kontakt@organisation.de"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Lizenz-Plan"
              value={newCust.plan}
              onChange={e => setNewCust(c => ({ ...c, plan: e.target.value as LicensePlan }))}
            >
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </Select>
            <Input
              label="Lizenzplätze"
              type="number"
              min={1}
              value={newCust.seatsLicensed}
              onChange={e => setNewCust(c => ({ ...c, seatsLicensed: Number(e.target.value) }))}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setAddModal(false); setAddErrors([]) }}>Abbrechen</Button>
            <Button className="flex-1" onClick={handleAddCustomer}>Speichern</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
