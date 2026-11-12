'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from './types'
import { pushAbmelden } from './nativ'

export interface LoginResult {
  ok: boolean
  requiresTOTP?: boolean
  pendingToken?: string
  requiresSMS?: boolean
  /** §196 Der Code kommt per E-Mail. */
  requiresEmail?: boolean
  userId?: string
  error?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  loginWithTotp: (pendingToken: string, totpCode: string) => Promise<LoginResult>
  loginWithSms: (userId: string, code: string) => Promise<LoginResult>
  loginWithEmailCode: (userId: string, code: string) => Promise<LoginResult>
  logout: () => void
  /**
   * §290 Die eigenen Angaben neu vom Server holen.
   *
   * GEMELDET: „Wenn ich mein Profilbild ändere, wird eine längere Zeit
   * trotzdem noch das alte angezeigt und nicht richtig aktualisiert —
   * obwohl ich das alte sogar entfernt hatte."
   *
   * Woran es lag: Der angemeldete Mensch steht hier im Zustand und zusätzlich
   * im `sessionStorage`. Gefüllt wird beides EINMAL, beim Aufbau dieses
   * Rahmens — also bei einem vollständigen Seitenaufbau. Wer sein Bild
   * wechselt, ändert damit den Datensatz auf dem Server und die Anzeige auf
   * der Profilseite, aber nicht diese Kopie. Die Leiste zeigte deshalb
   * weiter das alte Bild, und zwar bis zum nächsten echten Neuladen —
   * innerhalb der App kommt das praktisch nie vor, weil zwischen den Seiten
   * nicht neu geladen wird.
   *
   * Es war also nie ein Bild im Zwischenspeicher. Es war eine Kopie, die
   * niemand auffrischt.
   */
  aktualisieren: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('dienstplan_user')
      if (stored) setUser(JSON.parse(stored))
    } catch {}

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    fetch('/api/auth/me', { signal: controller.signal })
      .then(res => (res.ok ? res.json() : { user: null }))
      .then(({ user: serverUser }) => {
        if (serverUser) {
          setUser(serverUser)
          sessionStorage.setItem('dienstplan_user', JSON.stringify(serverUser))
        } else {
          setUser(null)
          sessionStorage.removeItem('dienstplan_user')
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout)
        setIsLoading(false)
      })
  }, [])

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) return { ok: false }
      const data = await res.json()
      if (data.requiresTOTP) {
        return { ok: false, requiresTOTP: true, pendingToken: data.pendingToken }
      }
      if (data.requiresSMS) {
        return { ok: false, requiresSMS: true, userId: data.userId }
      }
      if (data.requiresEmail) {
        return { ok: false, requiresEmail: true, userId: data.userId }
      }
      const { user: loggedInUser } = data
      setUser(loggedInUser)
      sessionStorage.setItem('dienstplan_user', JSON.stringify(loggedInUser))
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  const loginWithTotp = async (pendingToken: string, totpCode: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/2fa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, totpCode }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { ok: false, error: data.error }
      }
      const { user: loggedInUser } = await res.json()
      setUser(loggedInUser)
      sessionStorage.setItem('dienstplan_user', JSON.stringify(loggedInUser))
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  const loginWithSms = async (userId: string, code: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/2fa/sms-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { ok: false, error: data.error }
      }
      const meRes = await fetch('/api/auth/me')
      if (meRes.ok) {
        const { user: loggedInUser } = await meRes.json()
        if (loggedInUser) {
          setUser(loggedInUser)
          sessionStorage.setItem('dienstplan_user', JSON.stringify(loggedInUser))
        }
      }
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }
  /**
   * §196 Dasselbe wie oben, nur über die E-Mail-Route.
   *
   * Beide holen nach dem Prüfen `/api/auth/me`, weil die Sitzung als Keks
   * gesetzt wird und die Antwort den Benutzer nicht mitschickt.
   */
  const loginWithEmailCode = async (userId: string, code: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/2fa/email-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { ok: false, error: data.error }
      }
      const meRes = await fetch('/api/auth/me')
      if (meRes.ok) {
        const { user: loggedInUser } = await meRes.json()
        if (loggedInUser) {
          setUser(loggedInUser)
          sessionStorage.setItem('dienstplan_user', JSON.stringify(loggedInUser))
        }
      }
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }


  /**
   * §290 Die Angaben neu holen und ÜBERALL hinterlegen — Zustand und
   * `sessionStorage`. Nur eins von beidem zu setzen hieße, dass der nächste
   * Seitenaufbau das alte Bild zurückholt.
   */
  const aktualisieren = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return
      const { user: frisch } = await res.json()
      if (!frisch) return
      setUser(frisch)
      sessionStorage.setItem('dienstplan_user', JSON.stringify(frisch))
    } catch { /* Ohne Netz bleibt der letzte Stand stehen. */ }
  }

  const logout = () => {
    // §139 Zuerst das Gerät austragen, dann abmelden — danach fehlt die
    // Sitzung, und der Eintrag bliebe für immer stehen. Auf einem geteilten
    // Diensttelefon bekäme der Nachfolger sonst die Meldungen des Vorgängers.
    pushAbmelden().finally(() => {
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    })
    setUser(null)
    sessionStorage.removeItem('dienstplan_user')
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithTotp, loginWithSms, loginWithEmailCode, logout, aktualisieren }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
