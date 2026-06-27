'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from './types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
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

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) return false
      const { user: loggedInUser } = await res.json()
      setUser(loggedInUser)
      sessionStorage.setItem('dienstplan_user', JSON.stringify(loggedInUser))
      return true
    } catch {
      return false
    }
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem('dienstplan_user')
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
