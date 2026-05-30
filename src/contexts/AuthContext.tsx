'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { sb } from '@/lib/supabase'
import type { User } from '@/lib/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: () => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restaurar sessão do localStorage
  useEffect(() => {
    const sv = localStorage.getItem('lacore_u')
    if (sv) {
      try {
        const saved = JSON.parse(sv)
        // Usar os dados salvos direto — a RPC já retornou tudo
        if (saved.id && saved.name && saved.role) {
          setUser(saved as User)
          setLoading(false)
          return
        }
      } catch { /* ignora */ }
    }
    setLoading(false)
  }, [])

  // Login via pgcrypto — usa APENAS a RPC, sem segundo select
  const login = async (email: string, password: string) => {
    const { data, error } = await sb.rpc('verify_user_password', {
      p_email: email,
      p_password: password,
    })
    if (error || !data?.length) throw new Error('Email ou senha incorretos')

    const u = data[0]
    const userData: User = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as 'ADMIN' | 'VENDEDOR',
      status: u.status as 'ATIVO' | 'INATIVO',
    }
    setUser(userData)
    // Salvar objeto completo no localStorage para restore sem segundo select
    localStorage.setItem('lacore_u', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('lacore_u')
  }

  const isAdmin = () => user?.role === 'ADMIN'

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
