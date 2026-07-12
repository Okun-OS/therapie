'use client'

import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/lib/toast-context'
import { Building2, Plus, Mail, ChevronRight, ChevronDown, Edit, Users, AlertTriangle, MapPin, User, Trash2, Search, SortAsc } from 'lucide-react'
import type { Customer, CustomerStatus, LicensePlan, Location } from '@/lib/types'

interface UnassignedLocation { id: string; name: string; city: string; employeeCount: number }
interface UnassignedCompanyUser { id: string; name: string; email: string; role: 'company' | 'admin' }
interface UnassignedAdminUser { id: string; name: string; email: string }
interface Employee { id: string; name: string; email: string }

const UNASSIGNED_ROLE_LABEL: Record<'company' | 'admin', string> = {
  company: 'Geschäftsführung',
  admin: 'Standortleitung',
}

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

type SortKey = 'name' | 'status' | 'plan' | 'createdAt'

export default function OkunCustomers() {
  const { showToast } = useToast()
  const [CUSTOMERS, setCUSTOMERS] = useState<Customer[]>([])
  const [unassignedLocations, setUnassignedLocations] = useState<UnassignedLocation[]>([])
  const [unassignedCompanyUsers, setUnassignedCompanyUsers] = useState<UnassignedCompanyUser[]>([])
  const [adminsWithoutLocation, setAdminsWithoutLocation] = useState<UnassignedAdminUser[]>([])
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [assignChoice, setAssignChoice] = useState<Record<string, string>>({})

  // Search/filter/sort
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<CustomerStatus | ''>('')
  const [filterPlan, setFilterPlan] = useState<LicensePlan | ''>('')
  const [sortKey, setSortKey] = useState<SortKey>('name')

  // Tree expand/collapse state
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set())
  const [locationEmployees, setLocationEmployees] = useState<Record<string, Employee[]>>({})
  const [loadingLocations, setLoadingLocations] = useState<Set<string>>(new Set())

  // Delete modals
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<Customer | null>(null)
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft')
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [deleteLocationTarget, setDeleteLocationTarget] = useState<Location | null>(null)
  const [deleteLocationLoading, setDeleteLocationLoading] = useState(false)

  const [deleteEmployeeTarget, setDeleteEmployeeTarget] = useState<Employee | null>(null)
  const [deleteEmployeeLoading, setDeleteEmployeeLoading] = useState(false)

  const loadUnassigned = () => {
    fetch('/api/okun/unassigned').then(r => r.json()).then(d => {
      setUnassignedLocations(d.locations ?? [])
      setUnassignedCompanyUsers(d.companyUsers ?? [])
      setAdminsWithoutLocation(d.adminsWithoutLocation ?? [])
    })
  }

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setCUSTOMERS(d.customers))
    fetch('/api/locations').then(r => r.json()).then(d => setAllLocations(d.locations ?? []))
    loadUnassigned()
  }, [])

  // Filtered + sorted customers
  const filteredCustomers = useMemo(() => {
    let list = [...CUSTOMERS]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.contactEmail.toLowerCase().includes(q)
      )
    }
    if (filterStatus) list = list.filter(c => c.status === filterStatus)
    if (filterPlan) list = list.filter(c => c.plan === filterPlan)
    list.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      if (sortKey === 'status') return a.status.localeCompare(b.status)
      if (sortKey === 'plan') return a.plan.localeCompare(b.plan)
      if (sortKey === 'createdAt') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      return 0
    })
    return list
  }, [CUSTOMERS, search, filterStatus, filterPlan, sortKey])

  const toggleCustomer = (id: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const toggleLocation = async (locationId: string) => {
    if (expandedLocations.has(locationId)) {
      setExpandedLocations(prev => { const next = new Set(prev); next.delete(locationId); return next })
      return
    }
    setExpandedLocations(prev => new Set(prev).add(locationId))
    if (!(locationId in locationEmployees)) {
      setLoadingLocations(prev => new Set(prev).add(locationId))
      try {
        const res = await fetch(`/api/employees?locationId=${locationId}`)
        const data = await res.json()
        setLocationEmployees(prev => ({ ...prev, [locationId]: data.employees ?? [] }))
      } catch {
        setLocationEmployees(prev => ({ ...prev, [locationId]: [] }))
      } finally {
        setLoadingLocations(prev => { const next = new Set(prev); next.delete(locationId); return next })
      }
    }
  }

  const assignToCustomer = async (type: 'location' | 'companyUser', id: string) => {
    const customerId = assignChoice[id]
    if (!customerId) { showToast('Bitte zuerst ein Unternehmen auswählen', 'error'); return }
    await fetch('/api/okun/unassigned/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, customerId }),
    })
    showToast('Zuordnung gespeichert', 'success')
    loadUnassigned()
  }

  const assignAdminLocation = async (userId: string) => {
    const locationId = assignChoice[userId]
    if (!locationId) { showToast('Bitte zuerst einen Standort auswählen', 'error'); return }
    const res = await fetch('/api/okun/unassigned/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'adminLocation', id: userId, locationId }),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error || 'Zuordnung fehlgeschlagen', 'error'); return }
    showToast('Standort zugeordnet', 'success')
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
    if (!editForm.name.trim() || !editForm.contactEmail.trim()) { showToast('Bitte alle Pflichtfelder ausfüllen', 'error'); return }
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
    if (errors.length > 0) { setAddErrors(errors); return }

    const { customer, emailSent } = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCust),
    }).then(r => r.json())
    setCUSTOMERS(prev => [...prev, customer])
    showToast(emailSent ? 'Kunde angelegt · Einladung versendet' : 'Kunde angelegt, Einladung konnte nicht versendet werden', emailSent ? 'success' : 'error')
    setAddModal(false)
    setAddErrors([])
    setNewCust({ name: '', contactName: '', contactEmail: '', plan: 'starter', seatsLicensed: 10 })
  }

  // Delete handlers
  const handleDeleteCustomer = async () => {
    if (!deleteCustomerTarget) return
    if (deleteMode === 'hard' && deleteConfirmName !== deleteCustomerTarget.name) {
      showToast('Unternehmensname stimmt nicht überein', 'error')
      return
    }
    setDeleteLoading(true)
    const res = await fetch(`/api/customers/${deleteCustomerTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: deleteMode, confirmName: deleteConfirmName }),
    })
    if (res.ok) {
      if (deleteMode === 'hard') {
        setCUSTOMERS(prev => prev.filter(c => c.id !== deleteCustomerTarget.id))
      } else {
        setCUSTOMERS(prev => prev.map(c => c.id === deleteCustomerTarget.id ? { ...c, status: 'cancelled' as CustomerStatus } : c))
      }
      showToast(deleteMode === 'hard' ? 'Kunde endgültig gelöscht' : 'Kunde deaktiviert', 'success')
      setDeleteCustomerTarget(null)
      setDeleteConfirmName('')
    } else {
      const data = await res.json()
      showToast(data.error ?? 'Fehler beim Löschen', 'error')
    }
    setDeleteLoading(false)
  }

  const handleDeleteLocation = async () => {
    if (!deleteLocationTarget) return
    setDeleteLocationLoading(true)
    const res = await fetch(`/api/locations/${deleteLocationTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setAllLocations(prev => prev.filter(l => l.id !== deleteLocationTarget.id))
      showToast('Standort gelöscht', 'success')
      setDeleteLocationTarget(null)
    } else {
      const data = await res.json()
      showToast(data.error ?? 'Fehler beim Löschen', 'error')
    }
    setDeleteLocationLoading(false)
  }

  const handleDeleteEmployee = async () => {
    if (!deleteEmployeeTarget) return
    setDeleteEmployeeLoading(true)
    const res = await fetch(`/api/employees/${deleteEmployeeTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      // Remove from locationEmployees cache
      setLocationEmployees(prev => {
        const updated: Record<string, Employee[]> = {}
        for (const [loc, emps] of Object.entries(prev)) {
          updated[loc] = emps.filter(e => e.id !== deleteEmployeeTarget.id)
        }
        return updated
      })
      showToast('Mitarbeiter gelöscht', 'success')
      setDeleteEmployeeTarget(null)
    } else {
      const data = await res.json()
      showToast(data.error ?? 'Fehler beim Löschen', 'error')
    }
    setDeleteEmployeeLoading(false)
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

        {/* Search/filter/sort bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suchen nach Name, Ansprechpartner, E-Mail…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value as CustomerStatus | '')} className="sm:w-36">
            <option value="">Alle Status</option>
            <option value="trial">Test</option>
            <option value="active">Aktiv</option>
            <option value="suspended">Gesperrt</option>
            <option value="cancelled">Gekündigt</option>
          </Select>
          <Select value={filterPlan} onChange={e => setFilterPlan(e.target.value as LicensePlan | '')} className="sm:w-40">
            <option value="">Alle Pläne</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm cursor-default">
            <SortAsc size={14} className="text-gray-400 shrink-0" />
            <Select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="border-0 p-0 text-sm bg-transparent focus:ring-0 focus:outline-none">
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="plan">Plan</option>
              <option value="createdAt">Erstellt</option>
            </Select>
          </div>
        </div>

        {filteredCustomers.length === 0 && CUSTOMERS.length > 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Keine Kunden entsprechen den Filterkriterien.</p>
        )}

        {(unassignedLocations.length > 0 || unassignedCompanyUsers.length > 0 || adminsWithoutLocation.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-navy text-sm">Nicht zugeordnete Altdaten</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Diese Standorte/Accounts entstanden, bevor Unternehmens-Zuordnung im System existierte. Bitte einmalig dem richtigen Unternehmen zuordnen.
                </p>
              </div>
            </div>

            {adminsWithoutLocation.map(u => (
              <div key={u.id} className="flex items-center gap-2 bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email} · Standortleitung ohne Standort</p>
                </div>
                <Select value={assignChoice[u.id] ?? ''} onChange={e => setAssignChoice(prev => ({ ...prev, [u.id]: e.target.value }))} className="w-48">
                  <option value="">Standort wählen…</option>
                  {allLocations.map(l => <option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}
                </Select>
                <Button onClick={() => assignAdminLocation(u.id)}>Zuordnen</Button>
              </div>
            ))}

            {unassignedLocations.map(loc => (
              <div key={loc.id} className="flex items-center gap-2 bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{loc.name}</p>
                  <p className="text-xs text-gray-500">{loc.city} · {loc.employeeCount} Mitarbeiter</p>
                </div>
                <Select value={assignChoice[loc.id] ?? ''} onChange={e => setAssignChoice(prev => ({ ...prev, [loc.id]: e.target.value }))} className="w-48">
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
                  <p className="text-xs text-gray-500">{u.email} · {UNASSIGNED_ROLE_LABEL[u.role]}</p>
                </div>
                <Select value={assignChoice[u.id] ?? ''} onChange={e => setAssignChoice(prev => ({ ...prev, [u.id]: e.target.value }))} className="w-48">
                  <option value="">Unternehmen wählen…</option>
                  {CUSTOMERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Button onClick={() => assignToCustomer('companyUser', u.id)}>Zuordnen</Button>
              </div>
            ))}
          </div>
        )}

        {/* Hierarchical tree view */}
        <div className="space-y-3">
          {filteredCustomers.map(c => {
            const customerLocations = allLocations.filter(l => l.customerId === c.id)
            const isCustomerExpanded = expandedCustomers.has(c.id)

            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Customer row */}
                <div
                  onClick={() => toggleCustomer(c.id)}
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                >
                  <div className="shrink-0 text-gray-400">
                    {isCustomerExpanded ? <ChevronDown size={18} className="text-navy" /> : <ChevronRight size={18} />}
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-navy truncate">{c.name}</p>
                    <p className="text-xs text-gray-500 truncate">{c.contactName} · {c.contactEmail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:block">{customerLocations.length} Standorte</span>
                    <span className="text-xs text-gray-400 hidden sm:block">·</span>
                    <span className="text-xs text-gray-400 hidden sm:block">{c.seatsUsed}/{c.seatsLicensed} Plätze</span>
                    <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
                    <span className="text-xs font-medium text-navy bg-navy/10 px-2 py-0.5 rounded-lg">{PLAN_LABEL[c.plan]}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setSelected(c) }}
                      className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-400 hover:text-navy"
                      title="Bearbeiten"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteCustomerTarget(c); setDeleteMode('soft'); setDeleteConfirmName('') }}
                      className="p-1.5 rounded-lg hover:bg-red-100 transition-colors text-gray-400 hover:text-red-600"
                      title="Löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Locations */}
                {isCustomerExpanded && (
                  <div className="border-t border-gray-100">
                    {customerLocations.length === 0 ? (
                      <div className="px-6 py-3 text-xs text-gray-400 italic">Keine Standorte zugeordnet</div>
                    ) : (
                      customerLocations.map((loc, locIdx) => {
                        const isLocExpanded = expandedLocations.has(loc.id)
                        const isLoadingEmps = loadingLocations.has(loc.id)
                        const employees = locationEmployees[loc.id] ?? []
                        const isLast = locIdx === customerLocations.length - 1

                        return (
                          <div key={loc.id} className={isLast ? '' : 'border-b border-gray-50'}>
                            <div
                              onClick={() => toggleLocation(loc.id)}
                              className="flex items-center gap-3 pl-10 pr-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                            >
                              <div className="shrink-0 text-gray-300">
                                {isLocExpanded ? <ChevronDown size={15} className="text-gray-500" /> : <ChevronRight size={15} />}
                              </div>
                              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                <MapPin size={13} className="text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-navy truncate">{loc.name}</p>
                                <p className="text-xs text-gray-400 truncate">{loc.city}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  <Users size={12} />
                                  <span>{loc.employeeCount ?? '–'}</span>
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); setDeleteLocationTarget(loc) }}
                                  className="p-1 rounded-lg hover:bg-red-100 transition-colors text-gray-300 hover:text-red-500"
                                  title="Standort löschen"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Employees */}
                            {isLocExpanded && (
                              <div className="pl-20 pr-4 pb-2">
                                {isLoadingEmps ? (
                                  <p className="text-xs text-gray-400 py-2">Lade Mitarbeiter…</p>
                                ) : employees.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic py-2">Keine Mitarbeiter gefunden</p>
                                ) : (
                                  <div className="space-y-1 py-1">
                                    {employees.map(emp => (
                                      <div key={emp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
                                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                          <User size={11} className="text-gray-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <span className="text-xs font-medium text-navy truncate block">{emp.name}</span>
                                          {emp.email && <span className="text-xs text-gray-400 truncate block">{emp.email}</span>}
                                        </div>
                                        <button
                                          onClick={() => setDeleteEmployeeTarget(emp)}
                                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 transition-all text-gray-300 hover:text-red-500"
                                          title="Mitarbeiter löschen"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit / Detail modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setIsEditing(false) }} title={isEditing ? 'Kunde bearbeiten' : 'Kunden-Details'} size="lg">
        {selected && isEditing && (
          <div className="space-y-4">
            <Input label="Organisation" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Ansprechpartner" value={editForm.contactName} onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))} />
            <Input label="E-Mail" value={editForm.contactEmail} onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Status" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as CustomerStatus }))}>
                <option value="trial">Test</option>
                <option value="active">Aktiv</option>
                <option value="suspended">Gesperrt</option>
                <option value="cancelled">Gekündigt</option>
              </Select>
              <Select label="Lizenz-Plan" value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value as LicensePlan }))}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </div>
            <Input label="Lizenzplätze" type="number" min={1} value={editForm.seatsLicensed} onChange={e => setEditForm(f => ({ ...f, seatsLicensed: Number(e.target.value) }))} />
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

      {/* Add customer modal */}
      <Modal open={addModal} onClose={() => { setAddModal(false); setAddErrors([]) }} title="Kunde anlegen">
        <div className="space-y-4">
          {addErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                {addErrors.map(err => <li key={err}>{err}</li>)}
              </ul>
            </div>
          )}
          <Input label="Organisation" value={newCust.name} onChange={e => setNewCust(c => ({ ...c, name: e.target.value }))} placeholder="z.B. Lebenshilfe Musterstadt" />
          <Input label="Ansprechpartner" value={newCust.contactName} onChange={e => setNewCust(c => ({ ...c, contactName: e.target.value }))} placeholder="Name der Geschäftsführung" />
          <Input icon={Mail} value={newCust.contactEmail} onChange={e => setNewCust(c => ({ ...c, contactEmail: e.target.value }))} placeholder="kontakt@organisation.de" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Lizenz-Plan" value={newCust.plan} onChange={e => setNewCust(c => ({ ...c, plan: e.target.value as LicensePlan }))}>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </Select>
            <Input label="Lizenzplätze" type="number" min={1} value={newCust.seatsLicensed} onChange={e => setNewCust(c => ({ ...c, seatsLicensed: Number(e.target.value) }))} />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setAddModal(false); setAddErrors([]) }}>Abbrechen</Button>
            <Button className="flex-1" onClick={handleAddCustomer}>Speichern</Button>
          </div>
        </div>
      </Modal>

      {/* Delete customer modal */}
      <Modal open={!!deleteCustomerTarget} onClose={() => { setDeleteCustomerTarget(null); setDeleteConfirmName('') }} title="Unternehmen löschen">
        {deleteCustomerTarget && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-800">{deleteCustomerTarget.name}</p>
              <p className="text-xs text-red-700 mt-1">Diese Aktion betrifft alle Standorte, Mitarbeiter und Daten dieses Unternehmens.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-navy">Löschmodus</label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="radio" name="deleteMode" value="soft" checked={deleteMode === 'soft'} onChange={() => setDeleteMode('soft')} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-navy">Deaktivieren (empfohlen)</p>
                    <p className="text-xs text-gray-500">Status wird auf &quot;Gekündigt&quot; gesetzt. Daten bleiben erhalten und können wiederhergestellt werden.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-red-100 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                  <input type="radio" name="deleteMode" value="hard" checked={deleteMode === 'hard'} onChange={() => setDeleteMode('hard')} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Endgültig löschen</p>
                    <p className="text-xs text-gray-500">Alle Daten werden unwiderruflich gelöscht. Nicht rückgängig zu machen.</p>
                  </div>
                </label>
              </div>
            </div>

            {deleteMode === 'hard' && (
              <div>
                <label className="block text-sm font-semibold text-navy mb-1.5">
                  Zur Bestätigung: Unternehmensname eingeben
                </label>
                <Input
                  value={deleteConfirmName}
                  onChange={e => setDeleteConfirmName(e.target.value)}
                  placeholder={deleteCustomerTarget.name}
                />
                <p className="text-xs text-gray-400 mt-1">Gib genau <strong>{deleteCustomerTarget.name}</strong> ein.</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setDeleteCustomerTarget(null); setDeleteConfirmName('') }}>Abbrechen</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={handleDeleteCustomer}
                loading={deleteLoading}
                disabled={deleteMode === 'hard' && deleteConfirmName !== deleteCustomerTarget.name}
              >
                {deleteMode === 'hard' ? 'Endgültig löschen' : 'Deaktivieren'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete location modal */}
      <Modal open={!!deleteLocationTarget} onClose={() => setDeleteLocationTarget(null)} title="Standort löschen">
        {deleteLocationTarget && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-800">{deleteLocationTarget.name}</p>
              <p className="text-xs text-red-700 mt-1">{deleteLocationTarget.city} · Dieser Standort und alle zugehörigen Daten werden endgültig gelöscht.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setDeleteLocationTarget(null)}>Abbrechen</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600" onClick={handleDeleteLocation} loading={deleteLocationLoading}>
                Standort löschen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete employee modal */}
      <Modal open={!!deleteEmployeeTarget} onClose={() => setDeleteEmployeeTarget(null)} title="Mitarbeiter löschen">
        {deleteEmployeeTarget && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-800">{deleteEmployeeTarget.name}</p>
              <p className="text-xs text-red-700 mt-1">{deleteEmployeeTarget.email} · Mitarbeiterdaten werden endgültig gelöscht.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setDeleteEmployeeTarget(null)}>Abbrechen</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600" onClick={handleDeleteEmployee} loading={deleteEmployeeLoading}>
                Mitarbeiter löschen
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
