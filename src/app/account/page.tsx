'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/lib/auth-context'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  User, Mail, Shield, Bell, LogOut, Camera, Trash2,
  Lock, ChevronRight, CheckCircle2, AlertCircle, Download, ShieldAlert,
} from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  admin:    'Standortleitung',
  company:  'Geschäftsführung',
  employee: 'Mitarbeiter',
  okun:     'OKUN Admin',
}

function Avatar({ name, avatarUrl, size = 80 }: { name: string; avatarUrl?: string; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(135deg, #26C6C6 0%, #0E6B6F 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: '#0a2233',
      }}
    >
      {initials}
    </div>
  )
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  const [name, setName] = useState(user?.name ?? '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')

  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(true)

  const [exportLoading, setExportLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Nur Bilddateien erlaubt (JPG, PNG, WebP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Bild zu groß (max. 5 MB)')
      return
    }
    setAvatarError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const SIZE = 256
        canvas.width = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext('2d')!
        const scale = Math.max(SIZE / img.width, SIZE / img.height)
        const sx = (img.width * scale - SIZE) / 2
        const sy = (img.height * scale - SIZE) / 2
        ctx.drawImage(img, -sx / scale, -sy / scale, img.width, img.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        uploadAvatar(dataUrl)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function uploadAvatar(dataUrl: string) {
    setAvatarLoading(true)
    setAvatarError('')
    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAvatarError(data.error ?? 'Fehler beim Hochladen')
      } else {
        setAvatarUrl(data.avatarUrl)
      }
    } catch {
      setAvatarError('Netzwerkfehler')
    } finally {
      setAvatarLoading(false)
    }
  }

  async function removeAvatar() {
    setAvatarLoading(true)
    try {
      await fetch('/api/auth/avatar', { method: 'DELETE' })
      setAvatarUrl(undefined)
    } finally {
      setAvatarLoading(false)
    }
  }

  async function saveName() {
    if (!name.trim()) return
    setNameLoading(true)
    setNameError('')
    setNameSaved(false)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const d = await res.json()
        setNameError(d.error ?? 'Fehler beim Speichern')
      } else {
        setNameSaved(true)
        setTimeout(() => setNameSaved(false), 3000)
      }
    } catch {
      setNameError('Netzwerkfehler')
    } finally {
      setNameLoading(false)
    }
  }

  async function changePassword() {
    if (newPw !== confirmPw) {
      setPwError('Passwörter stimmen nicht überein')
      return
    }
    setPwLoading(true)
    setPwError('')
    setPwSaved(false)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const d = await res.json()
      if (!res.ok) {
        setPwError(d.error ?? 'Fehler beim Ändern')
      } else {
        setPwSaved(true)
        setCurrentPw('')
        setNewPw('')
        setConfirmPw('')
        setTimeout(() => setPwSaved(false), 3000)
      }
    } catch {
      setPwError('Netzwerkfehler')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const res = await fetch('/api/auth/me/export')
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `okun-datenschutz-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportLoading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/auth/me', { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setDeleteError(d.error ?? 'Fehler beim Löschen')
        return
      }
      logout()
      router.push('/login')
    } catch {
      setDeleteError('Netzwerkfehler')
    } finally {
      setDeleteLoading(false)
    }
  }

  function handleLogout() {
    logout()
    router.push('/login')
  }

  if (!user) return null

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-navy">Mein Konto</h1>

        {/* ── Profil-Header ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar name={user.name} avatarUrl={avatarUrl} size={80} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand text-navy flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
                title="Foto ändern"
              >
                <Camera size={13} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-navy truncate">{user.name}</p>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
              <span
                className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(38,198,198,0.12)', color: '#0E6B6F' }}
              >
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {user.customerName && (
                <p className="text-xs text-gray-400 mt-0.5">{user.customerName}</p>
              )}
            </div>
          </div>
          {avatarError && <p className="text-xs text-red-600 mt-3">{avatarError}</p>}
          {avatarUrl && (
            <button
              onClick={removeAvatar}
              disabled={avatarLoading}
              className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} /> Foto entfernen
            </button>
          )}
        </div>

        {/* ── Persönliche Daten ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User size={16} className="text-brand" />
            <h2 className="font-semibold text-navy">Persönliche Daten</h2>
          </div>

          <div>
            <Input
              label="Name"
              value={name}
              onChange={e => { setName(e.target.value); setNameSaved(false) }}
              placeholder="Vor- und Nachname"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy mb-1.5">E-Mail</label>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
              <Mail size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-500">{user.email}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">E-Mail kann nur vom Administrator geändert werden</p>
          </div>

          {nameError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={14} /> {nameError}
            </div>
          )}
          {nameSaved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 size={14} /> Name gespeichert
            </div>
          )}

          <Button
            onClick={saveName}
            loading={nameLoading}
            disabled={!name.trim() || name === user.name}
            className="w-full sm:w-auto"
          >
            Name speichern
          </Button>
        </div>

        {/* ── Passwort ────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock size={16} className="text-brand" />
            <h2 className="font-semibold text-navy">Passwort ändern</h2>
          </div>

          <Input
            label="Aktuelles Passwort"
            type="password"
            value={currentPw}
            onChange={e => { setCurrentPw(e.target.value); setPwSaved(false) }}
            autoComplete="current-password"
          />
          <Input
            label="Neues Passwort"
            type="password"
            value={newPw}
            onChange={e => { setNewPw(e.target.value); setPwSaved(false) }}
            autoComplete="new-password"
            hint="Mindestens 8 Zeichen"
          />
          <Input
            label="Neues Passwort bestätigen"
            type="password"
            value={confirmPw}
            onChange={e => { setConfirmPw(e.target.value); setPwSaved(false) }}
            autoComplete="new-password"
          />

          {pwError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={14} /> {pwError}
            </div>
          )}
          {pwSaved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 size={14} /> Passwort erfolgreich geändert
            </div>
          )}

          <Button
            onClick={changePassword}
            loading={pwLoading}
            disabled={!currentPw || !newPw || !confirmPw}
            className="w-full sm:w-auto"
          >
            Passwort ändern
          </Button>
        </div>

        {/* ── 2FA & Sicherheit ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => router.push('/account/security')}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-brand" />
              <div className="text-left">
                <p className="font-semibold text-navy text-sm">Sicherheit & Zwei-Faktor-Authentifizierung</p>
                <p className="text-xs text-gray-500 mt-0.5">TOTP-App, SMS-Verifizierung, Anmeldesicherheit</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>

        {/* ── Benachrichtigungen ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-brand" />
            <h2 className="font-semibold text-navy">Benachrichtigungen</h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-navy">E-Mail-Benachrichtigungen</p>
                <p className="text-xs text-gray-400">Dienstplan-Updates, Urlaubsanträge, Neuigkeiten</p>
              </div>
              <button
                onClick={() => setNotifEmail(v => !v)}
                className={`relative w-10 h-6 rounded-full transition-colors ${notifEmail ? 'bg-brand' : 'bg-gray-200'}`}
                role="switch"
                aria-checked={notifEmail}
              >
                <span
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: notifEmail ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-navy">Push-Benachrichtigungen</p>
                <p className="text-xs text-gray-400">Direkte Benachrichtigungen auf diesem Gerät</p>
              </div>
              <button
                onClick={() => setNotifPush(v => !v)}
                className={`relative w-10 h-6 rounded-full transition-colors ${notifPush ? 'bg-brand' : 'bg-gray-200'}`}
                role="switch"
                aria-checked={notifPush}
              >
                <span
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: notifPush ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </label>
          </div>
        </div>

        {/* ── Datenschutz & DSGVO ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={16} className="text-brand" />
            <h2 className="font-semibold text-navy">Datenschutz (DSGVO)</h2>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-navy">Meine Daten exportieren</p>
              <p className="text-xs text-gray-400 mt-0.5">Alle gespeicherten Daten als JSON-Datei herunterladen (Art. 20 DSGVO)</p>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                <Download size={14} />
                {exportLoading ? 'Wird exportiert…' : 'Daten herunterladen'}
              </button>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-sm font-medium text-red-600">Konto unwiderruflich löschen</p>
              <p className="text-xs text-gray-400 mt-0.5">Löscht Ihren Account und anonymisiert Ihre Mitarbeiterdaten (Art. 17 DSGVO)</p>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="mt-2 text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
                >
                  Konto löschen…
                </button>
              ) : (
                <div className="mt-2 p-3 rounded-xl border border-red-200 bg-red-50 space-y-2">
                  <p className="text-xs font-semibold text-red-700">Diese Aktion kann nicht rückgängig gemacht werden. Wirklich fortfahren?</p>
                  {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? 'Wird gelöscht…' : 'Ja, Konto löschen'}
                    </button>
                    <button
                      onClick={() => { setDeleteConfirm(false); setDeleteError('') }}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Abmelden ────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-6 py-4 text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} />
            <span className="font-semibold text-sm">Abmelden</span>
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
