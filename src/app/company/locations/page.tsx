'use client'

import Link from 'next/link'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/toast-context'
import { Building2, Plus, MapPin, Users, Palmtree, Edit, ChevronRight, UserCog, Crown, Mail } from 'lucide-react'
import type { Location, Employee, VacationRequest } from '@/lib/types'

export default function CompanyLocations() {
  const { showToast } = useToast()
  const [LOCATIONS, setLOCATIONS] = useState<Location[]>([])
  const [EMPLOYEES, setEMPLOYEES] = useState<Employee[]>([])
  const [VACATION_REQUESTS, setVACATION_REQUESTS] = useState<VacationRequest[]>([])

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(d => setLOCATIONS(d.locations))
    fetch('/api/employees').then(r => r.json()).then(d => setEMPLOYEES(d.employees))
    fetch('/api/vacation-requests').then(r => r.json()).then(d => setVACATION_REQUESTS(d.requests))
  }, [])

  const [selected, setSelected] = useState<Location | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', street: '', houseNumber: '', zip: '', city: '', bundesland: '', country: 'Deutschland' })
  const [addModal, setAddModal] = useState(false)
  const [newLoc, setNewLoc] = useState({ name: '', street: '', houseNumber: '', zip: '', city: '', bundesland: '', country: 'Deutschland' })
  const [adminInviteEmail, setAdminInviteEmail] = useState('')
  const [adminInviteName, setAdminInviteName] = useState('')
  const [addErrors, setAddErrors] = useState<string[]>([])
  const [inviteModal, setInviteModal] = useState<{ locationId: string; locationName: string } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [managingAdmin, setManagingAdmin] = useState(false)

  const startEditing = (loc: Location) => {
    setEditForm({
      name: loc.name,
      street: loc.street || '',
      houseNumber: loc.houseNumber || '',
      zip: loc.zip || '',
      city: loc.city,
      bundesland: loc.bundesland || loc.state || '',
      country: loc.country || 'Deutschland',
    })
    setIsEditing(true)
  }

  const saveEdit = async () => {
    if (!selected) return
    if (!editForm.name.trim() || !editForm.city.trim()) {
      showToast('Name und Stadt sind erforderlich', 'error')
      return
    }
    const address = editForm.street ? `${editForm.street}${editForm.houseNumber ? ' ' + editForm.houseNumber : ''}` : selected.address
    const updated = await fetch(`/api/locations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, address, state: editForm.bundesland }),
    }).then(r => r.json()).then(d => d.location)
    setLOCATIONS(prev => prev.map(l => l.id === updated.id ? updated : l))
    showToast('Standort aktualisiert', 'success')
    setIsEditing(false)
    setSelected(null)
  }

  const handleReassignAdmin = async (employeeId: string) => {
    if (!selected) return
    await fetch(`/api/locations/${selected.id}/reassign-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newAdminEmployeeId: employeeId }),
    })
    const refreshed = await fetch('/api/employees').then(r => r.json()).then(d => d.employees)
    setEMPLOYEES(refreshed)
    showToast('Standortleitung gewechselt', 'success')
    setManagingAdmin(false)
  }

  const handleAddLocation = async () => {
    const errors: string[] = []
    if (!newLoc.name.trim()) errors.push('Name ist erforderlich')
    if (!newLoc.city.trim()) errors.push('Stadt ist erforderlich')
    if (adminInviteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminInviteEmail)) {
      errors.push('E-Mail der Einrichtungsleitung ist ungültig')
    }

    if (errors.length > 0) {
      setAddErrors(errors)
      return
    }

    const address = newLoc.street ? `${newLoc.street}${newLoc.houseNumber ? ' ' + newLoc.houseNumber : ''}` : ''
    const location = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLoc, address }),
    }).then(r => r.json()).then(d => d.location)
    setLOCATIONS(prev => [...prev, location])

    // Einrichtungsleitung sofort einladen, falls angegeben
    if (adminInviteEmail.trim()) {
      try {
        await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: adminInviteEmail.trim(),
            role: 'admin',
            name: adminInviteName.trim() || undefined,
            locationId: location.id,
            customerId: location.customerId,
          }),
        })
        showToast(`Standort angelegt und Einladung an ${adminInviteEmail} gesendet`, 'success')
      } catch {
        showToast('Standort angelegt, aber Einladung konnte nicht gesendet werden', 'error')
      }
    } else {
      showToast('Standort gespeichert', 'success')
    }

    setAddModal(false)
    setAddErrors([])
    setNewLoc({ name: '', street: '', houseNumber: '', zip: '', city: '', bundesland: '', country: 'Deutschland' })
    setAdminInviteEmail('')
    setAdminInviteName('')
  }

  const handleSendInvite = async () => {
    if (!inviteModal || !inviteEmail.trim()) return
    setInviting(true)
    try {
      const loc = LOCATIONS.find(l => l.id === inviteModal.locationId)
      await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: 'admin',
          name: inviteName.trim() || undefined,
          locationId: inviteModal.locationId,
          customerId: loc?.customerId,
        }),
      })
      showToast(`Einladung an ${inviteEmail} gesendet`, 'success')
      setInviteModal(null)
      setInviteEmail('')
      setInviteName('')
    } catch {
      showToast('Einladung konnte nicht gesendet werden', 'error')
    } finally {
      setInviting(false)
    }
  }

  const locationStats = LOCATIONS.map(loc => {
    const emps = EMPLOYEES.filter(e => e.locationId === loc.id && e.role === 'employee')
    const admin = EMPLOYEES.find(e => e.locationId === loc.id && e.role === 'admin')
    const pending = VACATION_REQUESTS.filter(v => v.locationId === loc.id && v.status === 'pending')
    return { ...loc, emps, admin, pendingVacations: pending.length }
  })

  const selectedStats = selected ? locationStats.find(l => l.id === selected.id) : null

  return (
    <>
      
      <div className="p-4 sm:p-6 space-y-5">

        {/* Add Button */}
        <div className="flex justify-end">
          <Button onClick={() => setAddModal(true)} className="gap-2">
            <Plus size={16} />
            Standort hinzufügen
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-navy">{LOCATIONS.length}</p>
            <p className="text-xs text-gray-500">Standorte</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-navy">{EMPLOYEES.filter(e => e.role === 'employee').length}</p>
            <p className="text-xs text-gray-500">Mitarbeiter gesamt</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-navy">{EMPLOYEES.filter(e => e.role === 'admin').length}</p>
            <p className="text-xs text-gray-500">Admins</p>
          </div>
        </div>

        {/* Location Cards */}
        <div className="space-y-4">
          {locationStats.map(loc => (
            <div
              key={loc.id}
              onClick={() => setSelected(loc)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-navy to-navy-light p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/20 border border-brand/30 flex items-center justify-center">
                    <Building2 size={18} className="text-brand" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{loc.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-navy-100" />
                      <p className="text-navy-100 text-xs">
                        {loc.street ? `${loc.street}${loc.houseNumber ? ' ' + loc.houseNumber : ''}, ` : loc.address ? loc.address + ', ' : ''}
                        {loc.zip ? loc.zip + ' ' : ''}{loc.city}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">Aktiv</Badge>
                  <ChevronRight size={16} className="text-navy-100" />
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Users size={14} className="text-gray-400" />
                    <span className="text-lg font-bold text-navy">{loc.emps.length}</span>
                  </div>
                  <p className="text-xs text-gray-500">Mitarbeiter</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Palmtree size={14} className="text-amber-400" />
                    <span className={`text-lg font-bold ${loc.pendingVacations > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {loc.pendingVacations}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Offene Anträge</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-navy mb-0.5 truncate">{loc.admin?.name.split(' ')[0] ?? '—'}</p>
                  <p className="text-xs text-gray-500">Admin</p>
                </div>
              </div>

              {/* Employee Avatars */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-1">
                  {loc.emps.slice(0, 6).map(emp => (
                    <div key={emp.id} className="w-7 h-7 rounded-full bg-navy border-2 border-white flex items-center justify-center text-brand text-[10px] font-bold -ml-1 first:ml-0">
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                  ))}
                  {loc.emps.length > 6 && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-500 text-[10px] font-bold -ml-1">
                      +{loc.emps.length - 6}
                    </div>
                  )}
                  <span className="text-xs text-gray-400 ml-2">{loc.emps.length} Mitarbeiter</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Location Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setIsEditing(false); setManagingAdmin(false) }}
        title={isEditing ? 'Standort bearbeiten' : 'Standort-Details'}
        size="lg"
      >
        {selectedStats && isEditing && (
          <div className="space-y-4">
            <Input
              label="Name"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  label="Straße"
                  value={editForm.street}
                  onChange={e => setEditForm(f => ({ ...f, street: e.target.value }))}
                  placeholder="Musterstraße"
                />
              </div>
              <div className="w-28">
                <Input
                  label="Hausnummer"
                  value={editForm.houseNumber}
                  onChange={e => setEditForm(f => ({ ...f, houseNumber: e.target.value }))}
                  placeholder="12a"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-32">
                <Input
                  label="PLZ"
                  value={editForm.zip}
                  onChange={e => setEditForm(f => ({ ...f, zip: e.target.value }))}
                  placeholder="10115"
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Stadt"
                  value={editForm.city}
                  onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Berlin"
                />
              </div>
            </div>
            <Input
              label="Bundesland"
              value={editForm.bundesland}
              onChange={e => setEditForm(f => ({ ...f, bundesland: e.target.value }))}
              placeholder="Berlin"
            />
            <Input
              label="Land"
              value={editForm.country}
              onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}
              placeholder="Deutschland"
            />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => setIsEditing(false)}>Abbrechen</Button>
              <Button className="flex-1" onClick={saveEdit}>Speichern</Button>
            </div>
          </div>
        )}

        {selectedStats && !isEditing && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-navy flex items-center justify-center">
                <Building2 size={24} className="text-brand" />
              </div>
              <div>
                <p className="text-xl font-bold text-navy">{selectedStats.name}</p>
                <p className="text-gray-500 text-sm">
                  {selectedStats.street
                    ? `${selectedStats.street}${selectedStats.houseNumber ? ' ' + selectedStats.houseNumber : ''}, ${selectedStats.zip ? selectedStats.zip + ' ' : ''}${selectedStats.city}${selectedStats.bundesland ? ', ' + selectedStats.bundesland : ''}${selectedStats.country && selectedStats.country !== 'Deutschland' ? ', ' + selectedStats.country : ''}`
                    : `${selectedStats.address ? selectedStats.address + ', ' : ''}${selectedStats.city}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-navy">{selectedStats.emps.length}</p>
                <p className="text-xs text-gray-500">Mitarbeiter</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{selectedStats.pendingVacations}</p>
                <p className="text-xs text-gray-500">Offene Urlaubsanträge</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-navy">Team</p>
                {selectedStats.emps.length > 0 && (
                  <button
                    onClick={() => setManagingAdmin(m => !m)}
                    className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline"
                  >
                    <UserCog size={13} />
                    Standortleitung wechseln
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {selectedStats.admin && (
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-navy/5">
                    <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-brand text-xs font-bold">
                      {selectedStats.admin.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy">{selectedStats.admin.name}</p>
                      <p className="text-xs text-gray-400">Teamleitung</p>
                    </div>
                    <Badge variant="info" className="ml-auto">Admin</Badge>
                  </div>
                )}
                {selectedStats.emps.map(emp => (
                  <div key={emp.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.position} · {emp.weeklyHours}h/Wo</p>
                    </div>
                    {managingAdmin ? (
                      <Button variant="ghost" className="border border-gray-200 gap-1.5 text-xs px-2.5 py-1.5" onClick={() => handleReassignAdmin(emp.id)}>
                        <Crown size={12} />
                        Ernennen
                      </Button>
                    ) : (
                      <span className={`text-xs font-bold ${emp.hoursBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {emp.hoursBalance >= 0 ? '+' : ''}{emp.hoursBalance}h
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {/* §104 Standort öffnen: dort liegt alles zu diesem Standort */}
              <Link href={`/company/locations/${selectedStats.id}`} className="w-full">
                <Button className="w-full gap-2">
                  <Building2 size={15} />
                  Standort öffnen
                </Button>
              </Link>
              {!selectedStats.admin && (
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    setSelected(null)
                    setManagingAdmin(false)
                    setInviteModal({ locationId: selectedStats.id, locationName: selectedStats.name })
                  }}
                >
                  <Mail size={15} />
                  Einrichtungsleitung einladen
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setSelected(null); setManagingAdmin(false) }}>Schließen</Button>
                <Button className="flex-1 gap-2" onClick={() => startEditing(selectedStats)}>
                  <Edit size={16} />
                  Bearbeiten
                </Button>
              </div>
              {selectedStats.admin && (
                <button
                  onClick={() => {
                    setSelected(null)
                    setManagingAdmin(false)
                    setInviteModal({ locationId: selectedStats.id, locationName: selectedStats.name })
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 text-center transition-colors"
                >
                  Weitere Einrichtungsleitung einladen
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Location Modal */}
      <Modal open={addModal} onClose={() => { setAddModal(false); setAddErrors([]) }} title="Standort hinzufügen">
        <div className="space-y-4">
          {addErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                {addErrors.map(err => <li key={err}>{err}</li>)}
              </ul>
            </div>
          )}
          <Input
            label="Name"
            value={newLoc.name}
            onChange={e => setNewLoc(l => ({ ...l, name: e.target.value }))}
            placeholder="z.B. Kita Sonnenblume"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Straße"
                value={newLoc.street}
                onChange={e => setNewLoc(l => ({ ...l, street: e.target.value }))}
                placeholder="Musterstraße"
              />
            </div>
            <div className="w-28">
              <Input
                label="Hausnummer"
                value={newLoc.houseNumber}
                onChange={e => setNewLoc(l => ({ ...l, houseNumber: e.target.value }))}
                placeholder="12a"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-32">
              <Input
                label="PLZ"
                value={newLoc.zip}
                onChange={e => setNewLoc(l => ({ ...l, zip: e.target.value }))}
                placeholder="10115"
              />
            </div>
            <div className="flex-1">
              <Input
                label="Stadt"
                value={newLoc.city}
                onChange={e => setNewLoc(l => ({ ...l, city: e.target.value }))}
                placeholder="z.B. Frankfurt"
              />
            </div>
          </div>
          <Input
            label="Bundesland"
            value={newLoc.bundesland}
            onChange={e => setNewLoc(l => ({ ...l, bundesland: e.target.value }))}
            placeholder="z.B. Hessen"
          />

          {/* Optionale Einrichtungsleitung einladen */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
              <Mail size={13} />
              Einrichtungsleitung einladen (optional)
            </p>
            <div className="space-y-3">
              <Input
                label="Name der Einrichtungsleitung"
                value={adminInviteName}
                onChange={e => setAdminInviteName(e.target.value)}
                placeholder="z.B. Maria Müller"
              />
              <Input
                label="E-Mail-Adresse"
                type="email"
                value={adminInviteEmail}
                onChange={e => setAdminInviteEmail(e.target.value)}
                placeholder="m.mueller@beispiel.de"
              />
              {adminInviteEmail && (
                <p className="text-xs text-gray-500">
                  Eine Einladungs-E-Mail wird nach dem Anlegen des Standorts automatisch verschickt.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setAddModal(false); setAddErrors([]) }}>Abbrechen</Button>
            <Button className="flex-1" onClick={handleAddLocation}>
              {adminInviteEmail ? 'Anlegen & Einladen' : 'Anlegen'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Admin Modal (for existing locations) */}
      <Modal
        open={!!inviteModal}
        onClose={() => { setInviteModal(null); setInviteEmail(''); setInviteName('') }}
        title={`Einrichtungsleitung einladen – ${inviteModal?.locationName}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Die eingeladene Person erhält eine E-Mail mit einem Registrierungslink und bekommt automatisch Zugriff auf diesen Standort.
          </p>
          <Input
            label="Name"
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            placeholder="z.B. Maria Müller"
          />
          <Input
            label="E-Mail-Adresse"
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="m.mueller@beispiel.de"
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 border border-gray-200"
              onClick={() => { setInviteModal(null); setInviteEmail(''); setInviteName('') }}
            >
              Abbrechen
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSendInvite}
              disabled={!inviteEmail.trim() || inviting}
            >
              <Mail size={15} />
              {inviting ? 'Wird gesendet…' : 'Einladung senden'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
