'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  // Lógica de submit — preservada
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Preencha email e senha'); return }
    setError(''); setSubmitting(true)
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(59,130,246,.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 360, position: 'relative' }} className="anim-fade-up">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex',
            width: 52, height: 52,
            borderRadius: 14,
            background: 'var(--accent)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 0 32px rgba(59,130,246,.3)',
          }}>
            <svg width="24" height="22" viewBox="0 0 40 36" fill="none">
              <defs>
                <linearGradient id="llg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,.95)"/>
                  <stop offset="100%" stopColor="rgba(255,255,255,.55)"/>
                </linearGradient>
              </defs>
              <path d="M4 4L4 28L18 28" stroke="url(#llg)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4C22 4 37 4 37 18C37 28 30 28 30 28" stroke="url(#llg)" strokeWidth="4.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '.12em', color: 'var(--text-1)', marginBottom: 4 }}>LACORE</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', letterSpacing: '.04em' }}>Gestão de Importação</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border-1)',
          borderRadius: 16,
          padding: 28,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-4)', marginBottom: 20 }}>
            Acesso ao sistema
          </p>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', marginBottom: 16,
              background: 'var(--red-s)',
              border: '1px solid rgba(239,68,68,.2)',
              borderRadius: 8,
            }} className="anim-fade-in">
              <AlertCircle size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, color: '#F87171' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit(e as unknown as React.FormEvent)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-4)',
                    cursor: 'pointer', display: 'flex',
                    transition: 'color .12s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-4)'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 4 }}
            >
              {submitting ? (
                <><div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.25)' }} />Entrando...</>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-4)', marginTop: 20, letterSpacing: '.02em' }}>
          LACORE © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
