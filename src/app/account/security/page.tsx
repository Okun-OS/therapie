'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { ShieldCheck, ShieldOff, QrCode, Copy, Check, AlertCircle, CheckCircle2 } from 'lucide-react'

type SetupStep = 'idle' | 'scan' | 'verify' | 'done'

export default function SecurityPage() {
  const { user } = useAuth()

  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null)
  const [setupStep, setSetupStep] = useState<SetupStep>('idle')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [secretCopied, setSecretCopied] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDisableForm, setShowDisableForm] = useState(false)

  useEffect(() => {
    fetch('/api/auth/2fa/status')
      .then(r => r.json())
      .then(d => setTotpEnabled(d.totpEnabled ?? false))
      .catch(() => setTotpEnabled(false))
  }, [])

  async function startSetup() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler'); return }
      setQrDataUrl(data.qrDataUrl)
      setSecret(data.secret)
      setSetupStep('scan')
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }

  async function verifySetup() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyCode }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ungültiger Code'); return }
      setTotpEnabled(true)
      setSetupStep('done')
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }

  async function disable2fa() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableCode }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Ungültiger Code'); return }
      setTotpEnabled(false)
      setShowDisableForm(false)
      setDisableCode('')
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }

  if (totpEnabled === null) {
    return (
      <DashboardLayout>
        <Header title="Sicherheit" subtitle="Konto & Zwei-Faktor-Authentifizierung" />
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-navy border-t-brand rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Header title="Sicherheit" subtitle="Konto & Zwei-Faktor-Authentifizierung" />

      <div className="p-4 sm:p-6 max-w-2xl space-y-5">

        {/* Status card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {totpEnabled
                ? <ShieldCheck size={18} className="text-teal-600" />
                : <ShieldOff size={18} className="text-gray-400" />}
              <CardTitle>Zwei-Faktor-Authentifizierung (2FA)</CardTitle>
            </div>
          </CardHeader>

          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-4 ${totpEnabled ? 'bg-teal-50 border border-teal-100' : 'bg-amber-50 border border-amber-100'}`}>
            {totpEnabled
              ? <CheckCircle2 size={18} className="text-teal-600 mt-0.5 flex-shrink-0" />
              : <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />}
            <div>
              <p className={`text-sm font-semibold ${totpEnabled ? 'text-teal-800' : 'text-amber-800'}`}>
                {totpEnabled ? '2FA ist aktiv' : '2FA ist nicht aktiviert'}
              </p>
              <p className={`text-xs mt-0.5 ${totpEnabled ? 'text-teal-600' : 'text-amber-600'}`}>
                {totpEnabled
                  ? 'Dein Konto ist mit einem zusätzlichen Einmal-Passwort geschützt.'
                  : 'Aktiviere die Zwei-Faktor-Authentifizierung für mehr Sicherheit.'}
              </p>
            </div>
          </div>

          {/* Setup flow */}
          {!totpEnabled && setupStep === 'idle' && (
            <Button onClick={startSetup} loading={loading} className="gap-2">
              <QrCode size={16} />
              2FA einrichten
            </Button>
          )}

          {!totpEnabled && setupStep === 'scan' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Scanne den QR-Code mit deiner Authenticator-App (z.B. Google Authenticator oder Authy) und gib anschließend den 6-stelligen Code zur Bestätigung ein.
              </p>
              <div className="flex justify-center">
                {qrDataUrl && <img src={qrDataUrl} alt="QR-Code für 2FA" className="w-48 h-48 rounded-xl border border-gray-200" />}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Oder manuell eingeben:</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <code className="text-xs font-mono text-gray-700 break-all flex-1">{secret}</code>
                  <button onClick={copySecret} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors" aria-label="Geheimnis kopieren">
                    {secretCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-gray-500" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy mb-1.5">Bestätigungscode eingeben</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                  placeholder="000 000"
                  className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.4em] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={verifySetup} loading={loading} disabled={verifyCode.replace(/\s/g, '').length < 6}>
                  Bestätigen &amp; aktivieren
                </Button>
                <Button variant="ghost" onClick={() => { setSetupStep('idle'); setError('') }}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {(totpEnabled || setupStep === 'done') && setupStep !== 'done' && (
            <div className="space-y-3">
              {!showDisableForm ? (
                <Button
                  variant="secondary"
                  onClick={() => { setShowDisableForm(true); setError('') }}
                  className="gap-2 text-red-600 hover:bg-red-50 border-red-200"
                >
                  <ShieldOff size={16} />
                  2FA deaktivieren
                </Button>
              ) : (
                <div className="space-y-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-sm font-semibold text-red-800">2FA deaktivieren</p>
                  <p className="text-xs text-red-600">Gib deinen aktuellen Authenticator-Code ein, um 2FA zu deaktivieren.</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    maxLength={7}
                    value={disableCode}
                    onChange={e => setDisableCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                    placeholder="000 000"
                    className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.4em] border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
                  />
                  {error && (
                    <div className="bg-white border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={disable2fa}
                      loading={loading}
                      disabled={disableCode.replace(/\s/g, '').length < 6}
                      className="text-red-600 hover:bg-red-100 border-red-300"
                    >
                      Deaktivieren
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowDisableForm(false); setDisableCode(''); setError('') }}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {setupStep === 'done' && (
            <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
              <CheckCircle2 size={20} className="text-teal-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-teal-800">2FA erfolgreich aktiviert!</p>
                <p className="text-xs text-teal-600">Bei der nächsten Anmeldung wirst du nach deinem Authenticator-Code gefragt.</p>
              </div>
            </div>
          )}
        </Card>

        {/* Info */}
        <Card>
          <CardTitle className="mb-3">Was ist die Zwei-Faktor-Authentifizierung?</CardTitle>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Mit 2FA schützt du dein Konto durch einen zusätzlichen Schritt beim Anmelden. Nach dem Passwort gibst du einen 6-stelligen Code ein, der in deiner Authenticator-App angezeigt wird und sich alle 30 Sekunden ändert.
            </p>
            <p>
              Empfohlene Apps: <strong>Google Authenticator</strong>, <strong>Authy</strong>, <strong>Microsoft Authenticator</strong> oder jede andere TOTP-kompatible App.
            </p>
          </div>
        </Card>

        <p className="text-xs text-gray-400">
          Konto: <strong>{user?.email}</strong>
        </p>
      </div>
    </DashboardLayout>
  )
}
