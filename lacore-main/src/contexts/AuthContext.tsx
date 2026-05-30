'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { sb, ini } from '@/lib/supabase'
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

  // Restaurar sessão do localStorage — igual ao original
  useEffect(() => {
    const sv = localStorage.getItem('lacore_u')
    if (sv) {
      try {
        const { id } = JSON.parse(sv)
        sb.from('users').select('*').eq('id', id).eq('status', 'ATIVO').single()
          .then(({ data }) => {
            if (data) setUser(data as User)
          })
          .finally(() => setLoading(false))
      } catch {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  // Login via pgcrypto — igual ao original
  const login = async (email: string, password: string) => {
    const { data, error } = await sb.rpc('verify_user_password', {
      p_email: email,
      p_password: password,
    })
    if (error || !data?.length) throw new Error('Email ou senha incorretos')
    const { data: u } = await sb.from('users').select('*').eq('id', data[0].id).single()
    if (!u) throw new Error('Usuário não encontrado')
    setUser(u as User)
    localStorage.setItem('lacore_u', JSON.stringify({ id: u.id }))
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
