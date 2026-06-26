'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LOCATIONS, EMPLOYEES, VACATION_REQUESTS, updateLocation, addLocation, reassignLocationAdmin } from '@/lib/mock-data'
import { useToast } from '@/lib/toast-context'
import { Building2, Plus, MapPin, Users, Palmtree, Phone, Edit, MoreVertical, ChevronRight, UserCog, Crown } from 'lucide-react'
import type { Location } from '@/lib/types'

export default function CompanyLocations() {
  const { showToast } = useToast()
  const [selected, setSelected] = useState<Location | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', address: '', city: '' })
  const [addModal, setAddModal] = useState(false)
  const [newLoc, setNewLoc] = useState({ name: '', address: '', city: '' })
  const [addErrors, setAddErrors] = useState<string[]>([])
  const [managingAdmin, setManagingAdmin] = useState(false)

  const startEditing = (loc: Location) => {
    setEditForm({ name: loc.name, address: loc.address, city: loc.city })
    setIsEditing(true)
  }

  const saveEdit = () => {
    if (!selected) return
    if (!editForm.name.trim() || !editForm.address.trim() || !editForm.city.trim()) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error')
      return
    }
    updateLocation(selected.id, editForm)
    showToast('Standort aktualisiert', 'success')
    setIsEditing(false)
    setSelected(null)
  }

  const handleReassignAdmin = (employeeId: string) => {
    if (!selected) return
    reassignLocationAdmin(selected.id, employeeId)
    showToast('Einrichtungsleitung gewechselt', 'success')
    setManagingAdmin(false)
  }

  const handleAddLocation = () => {
    const errors: string[] = []
    if (!newLoc.name.trim()) errors.push('Name ist erforderlich')
    if (!newLoc.address.trim()) errors.push('Adresse ist erforderlich')
    if (!newLoc.city.trim()) errors.push('Stadt ist erforderlich')

    if (errors.length > 0) {
      setAddErrors(errors)
      return
    }

    addLocation(newLoc)
    showToast('Standort gespeichert', 'success')
    setAddModal(false)
    setAddErrors([])
    setNewLoc({ name: '', address: '', city: '' })
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
      <Header title="Standorte" subtitle={`${LOCATIONS.length} Standorte verwaltet`} />
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
                      <p className="text-navy-100 text-xs">{loc.address}, {loc.city}</p>
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
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Name</label>
              <input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Adresse</label>
              <input
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Stadt</label>
              <input
                value={editForm.city}
                onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
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
                <p className="text-gray-500 text-sm">{selectedStats.address}, {selectedStats.city}</p>
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
                    Einrichtungsleitung wechseln
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

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setSelected(null); setManagingAdmin(false) }}>Schließen</Button>
              <Button className="flex-1 gap-2" onClick={() => startEditing(selectedStats)}>
                <Edit size={16} />
                Bearbeiten
              </Button>
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
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Name</label>
            <input
              value={newLoc.name}
              onChange={e => setNewLoc(l => ({ ...l, name: e.target.value }))}
              placeholder="z.B. Kita Sonnenblume"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Adresse</label>
            <input
              value={newLoc.address}
              onChange={e => setNewLoc(l => ({ ...l, address: e.target.value }))}
              placeholder="Straße Hausnummer"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">Stadt</label>
            <input
              value={newLoc.city}
              onChange={e => setNewLoc(l => ({ ...l, city: e.target.value }))}
              placeholder="z.B. Frankfurt"
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 border border-gray-200" onClick={() => { setAddModal(false); setAddErrors([]) }}>Abbrechen</Button>
            <Button className="flex-1" onClick={handleAddLocation}>Speichern</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
