'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User, Role } from './types'

const DEMO_USERS: User[] = [
  { id: 'emp1', name: 'Maria Schmidt', email: 'employee@demo.de', role: 'employee', locationId: 'loc1', position: 'Erzieherin' },
  { id: 'adm1', name: 'Thomas Müller', email: 'admin@demo.de', role: 'admin', locationId: 'loc1', position: 'Teamleitung' },
  { id: 'cmp1', name: 'BrightCare GmbH', email: 'company@demo.de', role: 'company', position: 'Geschäftsführung' },
  { id: 'okun1', name: 'Lea Okun', email: 'okun@demo.de', role: 'okun', position: 'Plattform-Administration' },
]

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => boolean
  loginDemo: (role: Role) => void
  logout: () => void
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
    setIsLoading(false)
  }, [])

  const login = (email: string, _password: string): boolean => {
    const found = DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (found) {
      setUser(found)
      sessionStorage.setItem('dienstplan_user', JSON.stringify(found))
      return true
    }
    return false
  }

  const loginDemo = (role: Role) => {
    const found = DEMO_USERS.find(u => u.role === role)!
    setUser(found)
    sessionStorage.setItem('dienstplan_user', JSON.stringify(found))
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem('dienstplan_user')
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
