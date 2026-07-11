'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from './types'

export interface LoginResult {
  ok: boolean
  requiresTOTP?: boolean
  pendingToken?: string
  requiresSMS?: boolean
  userId?: string
  error?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  loginWithTotp: (pendingToken: string, totpCode: string) => Promise<LoginResult>
  loginWithSms: (userId: string, code: string) => Promise<LoginResult>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cached: User | null = null
    try {
      const stored = sessionStorage.getItem('dienstplan_user')
      if (stored) {
        cached = JSON.parse(stored)
        setUser(cached)
      }
    } catch {}

    fetch('/api/auth/me')
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
      .finally(() => setIsLoading(false))
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

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem('dienstplan_user')
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithTotp, loginWithSms, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
