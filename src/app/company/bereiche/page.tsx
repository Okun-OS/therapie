'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, MapPin, Users, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import type { Bereich, Location } from '@/lib/types'

interface CompanyUser {
  id: string
  name: string
  email: string
  bereichIds: string[]
  hasAccess: boolean
}

interface BereichWithMeta extends Bereich {
  locations: Location[]
  bereichleiter: CompanyUser[]
  expanded: boolean
  editingName: boolean
  editName: string
  editDesc: string
  showUserPicker: boolean
}

export default function BereichePage() {
  const [bereiche, setBereiche] = useState<BereichWithMeta[]>([])
  const [allLocations, setAllLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [bRes, lRes] = await Promise.all([
        fetch('/api/bereiche'),
        fetch('/api/locations'),
      ])
      const { bereiche: raw } = await bRes.json()
      const { locations } = await lRes.json()
      setAllLocations(locations ?? [])
      setBereiche((raw ?? []).map((b: Bereich) => ({
        ...b,
        locations: (locations ?? []).filter((l: Location) => l.bereichId === b.id),
        bereichleiter: [],
        expanded: false,
        editingName: false,
        editName: b.name,
        editDesc: b.description ?? '',
        showUserPicker: false,
      })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const loadBereichUsers = async (bereichId: string) => {
    const res = await fetch(`/api/bereiche/${bereichId}/users`)
    const { users } = await res.json()
    setBereiche(prev => prev.map(b => b.id === bereichId ? { ...b, bereichleiter: users ?? [] } : b))
  }

  const toggleExpand = (id: string) => {
    setBereiche(prev => prev.map(b => {
      if (b.id !== id) return b
      const next = { ...b, expanded: !b.expanded }
      if (next.expanded && b.bereichleiter.length === 0) loadBereichUsers(id)
      return next
    }))
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/bereiche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Fehler'); return }
      setNewName(''); setNewDesc(''); setCreating(false)
      await fetchData()
    } finally { setSaving(false) }
  }

  const handleSaveEdit = async (b: BereichWithMeta) => {
    setSaving(true)
    try {
      await fetch(`/api/bereiche/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: b.editName.trim(), description: b.editDesc.trim() || undefined }),
      })
      await fetchData()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bereich „${name}" wirklich löschen? Alle Standorte werden ausgehängt.`)) return
    await fetch(`/api/bereiche/${id}`, { method: 'DELETE' })
    await fetchData()
  }

  const handleAssignLocation = async (bereichId: string, locationId: string, assign: boolean) => {
    await fetch(`/api/locations/${locationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bereichId: assign ? bereichId : null }),
    })
    await fetchData()
    await loadBereichUsers(bereichId)
  }

  const handleUserToggle = async (bereichId: string, users: CompanyUser[], userId: string, grant: boolean) => {
    const next = grant
      ? [...users.filter(u => u.hasAccess).map(u => u.id), userId]
      : users.filter(u => u.hasAccess && u.id !== userId).map(u => u.id)
    await fetch(`/api/bereiche/${bereichId}/users`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: next }),
    })
    await loadBereichUsers(bereichId)
  }

  const unassignedLocations = allLocations.filter(l => !l.bereichId)

  if (loading) return (
    <div className="p-6">
      <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}</div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy">Bereiche</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organisieren Sie Ihre Standorte in Bereiche und weisen Sie Bereichsleitungen zu.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors flex-shrink-0"
          >
            <Plus size={14} /> Neuer Bereich
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-navy">Neuer Bereich</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div>
            <label className="text-xs text-gray-500 font-medium">Name *</label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="z. B. Nord, Kita-Gruppe, Ambulanz …"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Beschreibung (optional)</label>
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="Kurze Beschreibung …"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || saving}
              className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-brand/90 transition-colors"
            >
              {saving ? 'Speichern…' : 'Erstellen'}
            </button>
            <button onClick={() => { setCreating(false); setError('') }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Abbrechen</button>
          </div>
        </div>
      )}

      {/* Bereiche list */}
      {bereiche.length === 0 && !creating && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🗂</div>
          <p className="text-sm font-medium">Noch keine Bereiche angelegt</p>
          <p className="text-xs mt-1">Erstellen Sie Ihren ersten Bereich, um Standorte zu gruppieren.</p>
        </div>
      )}

      <div className="space-y-3">
        {bereiche.map(b => (
          <div key={b.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Bereich header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {b.editingName ? (
                <div className="flex-1 flex gap-2">
                  <input
                    autoFocus
                    value={b.editName}
                    onChange={e => setBereiche(prev => prev.map(x => x.id === b.id ? { ...x, editName: e.target.value } : x))}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <input
                    value={b.editDesc}
                    onChange={e => setBereiche(prev => prev.map(x => x.id === b.id ? { ...x, editDesc: e.target.value } : x))}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="Beschreibung …"
                  />
                  <button onClick={() => handleSaveEdit(b)} className="text-brand hover:text-brand/70"><Check size={16} /></button>
                  <button onClick={() => setBereiche(prev => prev.map(x => x.id === b.id ? { ...x, editingName: false, editName: b.name, editDesc: b.description ?? '' } : x))} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy text-sm">{b.name}</span>
                    <span className="text-xs text-gray-400">{b.locations.length} Standort{b.locations.length !== 1 ? 'e' : ''}</span>
                  </div>
                  {b.description && <p className="text-xs text-gray-400 truncate">{b.description}</p>}
                </div>
              )}
              {!b.editingName && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setBereiche(prev => prev.map(x => x.id === b.id ? { ...x, editingName: true } : x))}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
                  ><Pencil size={14} /></button>
                  <button
                    onClick={() => handleDelete(b.id, b.name)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  ><Trash2 size={14} /></button>
                  <button
                    onClick={() => toggleExpand(b.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
                  >{b.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                </div>
              )}
            </div>

            {/* Expanded: locations + bereichsleiter */}
            {b.expanded && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-4 bg-gray-50/50">
                {/* Locations in this bereich */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin size={12} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zugeordnete Standorte</span>
                  </div>
                  {b.locations.length === 0 && (
                    <p className="text-xs text-gray-400 ml-4">Noch keine Standorte zugeordnet.</p>
                  )}
                  <div className="space-y-1">
                    {b.locations.map(loc => (
                      <div key={loc.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                        <span className="text-sm text-navy">{loc.name}</span>
                        <button
                          onClick={() => handleAssignLocation(b.id, loc.id, false)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >Entfernen</button>
                      </div>
                    ))}
                  </div>
                  {/* Assign unassigned locations */}
                  {unassignedLocations.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Standort hinzufügen:</p>
                      <div className="flex flex-wrap gap-1">
                        {unassignedLocations.map(loc => (
                          <button
                            key={loc.id}
                            onClick={() => handleAssignLocation(b.id, loc.id, true)}
                            className="text-xs px-2 py-1 bg-white border border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-brand hover:text-brand transition-colors"
                          >+ {loc.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bereichsleiter */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users size={12} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bereichsleitung</span>
                  </div>
                  {b.bereichleiter.length === 0 && (
                    <p className="text-xs text-gray-400 ml-4">Keine Bereichsleitung für diese Unternehmensebene gefunden.</p>
                  )}
                  <div className="space-y-1">
                    {b.bereichleiter.map(u => (
                      <div key={u.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                        <div>
                          <span className="text-sm text-navy">{u.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{u.email}</span>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={u.hasAccess}
                            onChange={e => handleUserToggle(b.id, b.bereichleiter, u.id, e.target.checked)}
                            className="accent-brand"
                          />
                          <span className="text-xs text-gray-500">{u.hasAccess ? 'Bereichsleiter' : 'Kein Zugriff'}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Unassigned locations info */}
      {unassignedLocations.length > 0 && bereiche.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Noch keinem Bereich zugeordnet</p>
          <div className="flex flex-wrap gap-1">
            {unassignedLocations.map(l => (
              <span key={l.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{l.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
