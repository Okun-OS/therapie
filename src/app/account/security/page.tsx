'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/lib/auth-context'
import { ShieldCheck, ShieldOff, QrCode, Copy, Check, AlertCircle, CheckCircle2, Smartphone, MessageSquare } from 'lucide-react'

type SetupStep = 'idle' | 'scan' | 'verify' | 'done'
type SmsStep = 'idle' | 'phone' | 'code' | 'done'

interface TwoFAStatus {
  totpEnabled: boolean
  smsOtpEnabled: boolean
  phoneVerified: boolean
  phone: string | null
}

export default function SecurityPage() {
  const { user } = useAuth()

  const [status, setStatus] = useState<TwoFAStatus | null>(null)

  // TOTP state
  const [setupStep, setSetupStep] = useState<SetupStep>('idle')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [secretCopied, setSecretCopied] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [totpError, setTotpError] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)
  const [showDisableForm, setShowDisableForm] = useState(false)

  // SMS 2FA state
  const [smsStep, setSmsStep] = useState<SmsStep>('idle')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsError, setSmsError] = useState('')
  const [smsLoading, setSmsLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/2fa/status')
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => setStatus({ totpEnabled: false, smsOtpEnabled: false, phoneVerified: false, phone: null }))
  }, [])

  // TOTP handlers
  async function startSetup() {
    setTotpError('')
    setTotpLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setTotpError(data.error ?? 'Fehler'); return }
      setQrDataUrl(data.qrDataUrl)
      setSecret(data.secret)
      setSetupStep('scan')
    } catch {
      setTotpError('Netzwerkfehler')
    } finally {
      setTotpLoading(false)
    }
  }

  async function verifySetup() {
    setTotpError('')
    setTotpLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyCode }),
      })
      const data = await res.json()
      if (!res.ok) { setTotpError(data.error ?? 'Ungültiger Code'); return }
      setStatus(s => s ? { ...s, totpEnabled: true } : s)
      setSetupStep('done')
    } catch {
      setTotpError('Netzwerkfehler')
    } finally {
      setTotpLoading(false)
    }
  }

  async function disable2fa() {
    setTotpError('')
    setTotpLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableCode }),
      })
      const data = await res.json()
      if (!res.ok) { setTotpError(data.error ?? 'Ungültiger Code'); return }
      setStatus(s => s ? { ...s, totpEnabled: false } : s)
      setShowDisableForm(false)
      setDisableCode('')
    } catch {
      setTotpError('Netzwerkfehler')
    } finally {
      setTotpLoading(false)
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }

  // SMS 2FA handlers
  async function sendSmsCode() {
    setSmsError('')
    setSmsLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/sms-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) { setSmsError(data.error ?? 'Fehler'); return }
      setSmsStep('code')
    } catch {
      setSmsError('Netzwerkfehler')
    } finally {
      setSmsLoading(false)
    }
  }

  async function verifySmsCode() {
    setSmsError('')
    setSmsLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/sms-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: smsCode }),
      })
      const data = await res.json()
      if (!res.ok) { setSmsError(data.error ?? 'Ungültiger Code'); return }
      setStatus(s => s ? { ...s, smsOtpEnabled: true, phoneVerified: true, phone: phone.replace(/(\+\d{1,3})\d+(\d{2})$/, '$1***$2') } : s)
      setSmsStep('done')
    } catch {
      setSmsError('Netzwerkfehler')
    } finally {
      setSmsLoading(false)
    }
  }

  async function disableSms() {
    setSmsLoading(true)
    try {
      await fetch('/api/auth/2fa/sms-disable', { method: 'POST' })
      setStatus(s => s ? { ...s, smsOtpEnabled: false, phoneVerified: false, phone: null } : s)
      setSmsStep('idle')
      setPhone('')
      setSmsCode('')
    } catch {
      setSmsError('Netzwerkfehler')
    } finally {
      setSmsLoading(false)
    }
  }

  if (!status) {
    return (
      <DashboardLayout>
        
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-navy border-t-brand rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      

      <div className="p-4 sm:p-6 max-w-2xl space-y-5">

        {/* TOTP card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode size={18} className={status.totpEnabled ? 'text-teal-600' : 'text-gray-400'} />
              <CardTitle>Authenticator-App (TOTP)</CardTitle>
            </div>
          </CardHeader>

          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-4 ${status.totpEnabled ? 'bg-teal-50 border border-teal-100' : 'bg-amber-50 border border-amber-100'}`}>
            {status.totpEnabled
              ? <CheckCircle2 size={18} className="text-teal-600 mt-0.5 flex-shrink-0" />
              : <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />}
            <div>
              <p className={`text-sm font-semibold ${status.totpEnabled ? 'text-teal-800' : 'text-amber-800'}`}>
                {status.totpEnabled ? 'TOTP aktiv' : 'TOTP nicht aktiviert'}
              </p>
              <p className={`text-xs mt-0.5 ${status.totpEnabled ? 'text-teal-600' : 'text-amber-600'}`}>
                {status.totpEnabled
                  ? 'Dein Konto ist mit einem Authenticator-Code geschützt.'
                  : 'Verwende Google Authenticator, Authy oder eine andere TOTP-App.'}
              </p>
            </div>
          </div>

          {!status.totpEnabled && setupStep === 'idle' && (
            <Button onClick={startSetup} loading={totpLoading} className="gap-2">
              <QrCode size={16} />
              TOTP einrichten
            </Button>
          )}

          {!status.totpEnabled && setupStep === 'scan' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Scanne den QR-Code mit deiner Authenticator-App und gib anschließend den 6-stelligen Code zur Bestätigung ein.
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
                <label className="block text-sm font-semibold text-navy mb-1.5">Bestätigungscode</label>
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
              {totpError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} />
                  {totpError}
                </div>
              )}
              <div className="flex gap-3">
                <Button onClick={verifySetup} loading={totpLoading} disabled={verifyCode.replace(/\s/g, '').length < 6}>
                  Bestätigen &amp; aktivieren
                </Button>
                <Button variant="ghost" onClick={() => { setSetupStep('idle'); setTotpError('') }}>Abbrechen</Button>
              </div>
            </div>
          )}

          {status.totpEnabled && setupStep !== 'done' && (
            <div className="space-y-3">
              {!showDisableForm ? (
                <Button variant="secondary" onClick={() => { setShowDisableForm(true); setTotpError('') }} className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
                  <ShieldOff size={16} />
                  TOTP deaktivieren
                </Button>
              ) : (
                <div className="space-y-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-sm font-semibold text-red-800">TOTP deaktivieren</p>
                  <p className="text-xs text-red-600">Gib deinen aktuellen Authenticator-Code ein.</p>
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
                  {totpError && (
                    <div className="bg-white border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                      <AlertCircle size={14} />
                      {totpError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={disable2fa} loading={totpLoading} disabled={disableCode.replace(/\s/g, '').length < 6} className="text-red-600 hover:bg-red-100 border-red-300">
                      Deaktivieren
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowDisableForm(false); setDisableCode(''); setTotpError('') }}>Abbrechen</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {setupStep === 'done' && (
            <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
              <CheckCircle2 size={20} className="text-teal-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-teal-800">TOTP erfolgreich aktiviert!</p>
                <p className="text-xs text-teal-600">Bei der nächsten Anmeldung wirst du nach deinem Authenticator-Code gefragt.</p>
              </div>
            </div>
          )}
        </Card>

        {/* SMS 2FA card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className={status.smsOtpEnabled ? 'text-teal-600' : 'text-gray-400'} />
              <CardTitle>SMS-Einmalcode (SMS-2FA)</CardTitle>
            </div>
          </CardHeader>

          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-4 ${status.smsOtpEnabled ? 'bg-teal-50 border border-teal-100' : 'bg-gray-50 border border-gray-100'}`}>
            {status.smsOtpEnabled
              ? <CheckCircle2 size={18} className="text-teal-600 mt-0.5 flex-shrink-0" />
              : <Smartphone size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />}
            <div>
              <p className={`text-sm font-semibold ${status.smsOtpEnabled ? 'text-teal-800' : 'text-gray-700'}`}>
                {status.smsOtpEnabled ? `SMS-2FA aktiv${status.phone ? ` (${status.phone})` : ''}` : 'SMS-2FA nicht aktiviert'}
              </p>
              <p className={`text-xs mt-0.5 ${status.smsOtpEnabled ? 'text-teal-600' : 'text-gray-500'}`}>
                {status.smsOtpEnabled
                  ? 'Bei der Anmeldung erhältst du einen Code per SMS.'
                  : 'Alternative zu TOTP: Code per SMS bei der Anmeldung.'}
              </p>
            </div>
          </div>

          {/* NIST note */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-4">
            <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              <strong>Sicherheitshinweis:</strong> SMS-basierte 2FA ist weniger sicher als TOTP (SIM-Swapping, SS7-Angriffe). TOTP wird für maximale Sicherheit empfohlen. SMS-2FA ist eine praktische Alternative, wenn kein Smartphone mit Authenticator-App verfügbar ist.
            </p>
          </div>

          {!status.smsOtpEnabled && smsStep === 'idle' && (
            <Button onClick={() => setSmsStep('phone')} className="gap-2">
              <Smartphone size={16} />
              SMS-2FA einrichten
            </Button>
          )}

          {!status.smsOtpEnabled && smsStep === 'phone' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Gib deine Handynummer ein. Wir senden dir einen Bestätigungscode.</p>
              <Input
                label="Handynummer"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+49 151 12345678"
              />
              {smsError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} />
                  {smsError}
                </div>
              )}
              <div className="flex gap-3">
                <Button onClick={sendSmsCode} loading={smsLoading} disabled={!phone.trim()}>Code senden</Button>
                <Button variant="ghost" onClick={() => { setSmsStep('idle'); setSmsError('') }}>Abbrechen</Button>
              </div>
            </div>
          )}

          {!status.smsOtpEnabled && smsStep === 'code' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Wir haben einen Code an <strong>{phone}</strong> gesendet. Gib ihn hier ein:</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={smsCode}
                onChange={e => setSmsCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.4em] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              {smsError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} />
                  {smsError}
                </div>
              )}
              <div className="flex gap-3">
                <Button onClick={verifySmsCode} loading={smsLoading} disabled={smsCode.length < 6}>Bestätigen</Button>
                <Button variant="ghost" onClick={() => { setSmsStep('phone'); setSmsError(''); setSmsCode('') }}>Zurück</Button>
              </div>
              <button onClick={() => { setSmsStep('phone'); setSmsError('') }} className="text-xs text-gray-400 underline hover:text-gray-600">
                Anderen Code anfordern
              </button>
            </div>
          )}

          {smsStep === 'done' && (
            <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
              <CheckCircle2 size={20} className="text-teal-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-teal-800">SMS-2FA erfolgreich aktiviert!</p>
                <p className="text-xs text-teal-600">Bei der nächsten Anmeldung erhältst du einen Code per SMS.</p>
              </div>
            </div>
          )}

          {status.smsOtpEnabled && smsStep !== 'done' && (
            <Button variant="secondary" onClick={disableSms} loading={smsLoading} className="gap-2 text-red-600 hover:bg-red-50 border-red-200">
              <ShieldOff size={16} />
              SMS-2FA deaktivieren
            </Button>
          )}
        </Card>

        {/* Info */}
        <Card>
          <CardTitle className="mb-3">Was ist die Zwei-Faktor-Authentifizierung?</CardTitle>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Mit 2FA schützt du dein Konto durch einen zusätzlichen Schritt beim Anmelden. Nach dem Passwort gibst du einen einmaligen Code ein, der entweder von deiner Authenticator-App generiert oder per SMS gesendet wird.
            </p>
            <p>
              Empfohlene TOTP-Apps: <strong>Google Authenticator</strong>, <strong>Authy</strong>, <strong>Microsoft Authenticator</strong>.
            </p>
            <p className="text-xs text-gray-400">
              TOTP und SMS-2FA können gleichzeitig aktiv sein. Bei der Anmeldung wird TOTP bevorzugt, wenn beide aktiviert sind.
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
