'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const { login, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    if (user) router.push('/dashboard')
  }, [user, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch {
      setError('Email ou senha incorretos')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '20%', right: '5%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Grid pattern */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: 400, position: 'relative',
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity .4s ease, transform .4s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 16, background: 'var(--accent)', marginBottom: 16, boxShadow: '0 0 40px rgba(59,130,246,.35), 0 0 80px rgba(59,130,246,.15)' }}>
            <svg width="28" height="25" viewBox="0 0 40 36" fill="none">
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,.95)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,.6)" />
                </linearGradient>
              </defs>
              <path d="M4 4L4 28L18 28" stroke="url(#lg)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 4C22 4 37 4 37 18C37 28 30 28 30 28" stroke="url(#lg)" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-1)', marginBottom: 6 }}>LACORE</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', letterSpacing: '.04em' }}>LACORE Store</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(12,14,20,.8)', backdropFilter: 'blur(24px)',
          border: '1px solid var(--border-2)', borderRadius: 18,
          padding: '32px 28px', boxShadow: '0 24px 64px rgba(0,0,0,.5)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Bem-vindo de volta</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginBottom: 24 }}>Entre com suas credenciais para continuar</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required autoComplete="email"
                style={{ marginTop: 5 }}
              />
            </div>
            <div>
              <label className="label">Senha</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                style={{ marginTop: 5 }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, fontSize: 12.5, color: '#F87171', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span>⚠</span>{error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4, justifyContent: 'center', letterSpacing: '.01em' }}>
              {loading ? (
                <><div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.2)' }} />Entrando...</>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5, color: 'var(--text-4)' }}>
          LACORE Store · Sistema de Gestão
        </p>
      </div>
    </div>
  )
}
