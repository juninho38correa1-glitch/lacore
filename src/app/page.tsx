'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LogoIcon } from '@/lib/useLogo'

/* ─── Navigation ─────────────────────────────────────────── */
function Navigation({ onEntrar }: { onEntrar: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      borderBottom: '1px solid rgba(255,255,255,.06)',
      background: 'rgba(9,9,11,.85)', backdropFilter: 'blur(16px)',
    }}>
      <nav style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoIcon size={30} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '.1em', color: 'var(--text-1)', fontFamily: 'var(--font-head)' }}>LACORE</span>
        </div>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="hidden md:flex">
          <a href="/catalogo" target="_blank" style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', textDecoration: 'none', transition: 'color .15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.55)')}>
            Catálogo público
          </a>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onEntrar}
            className="hidden md:inline-flex"
            style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'rgba(255,255,255,.7)', fontSize: 13, cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.06)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.7)' }}>
            Entrar
          </button>
          <button onClick={onEntrar}
            style={{ padding: '7px 18px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2563eb' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}>
            Acessar ERP
          </button>

          {/* Mobile menu button */}
          <button onClick={() => setMenuOpen(v => !v)} className="md:hidden"
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 4 }}>
            {menuOpen
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: 'rgba(9,9,11,.97)', borderTop: '1px solid rgba(255,255,255,.06)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <a href="/catalogo" target="_blank" onClick={() => setMenuOpen(false)} style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', textDecoration: 'none', padding: '8px 0' }}>Catálogo público</a>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 12 }}>
            <button onClick={() => { onEntrar(); setMenuOpen(false) }}
              style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Acessar ERP
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, user } = useAuth()
  const router = useRouter()
  const loginRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => document.getElementById('login-email')?.focus(), 600)
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-1)', overflowX: 'hidden' }}>
      <Navigation onEntrar={scrollToLogin} />

      {/* ── Login ── */}
      <section style={{ minHeight: '100vh', padding: '120px 20px 60px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        <div ref={loginRef} style={{ width: '100%', maxWidth: 400, margin: '0 auto', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ marginBottom: 14, display: 'inline-flex', boxShadow: '0 0 40px rgba(59,130,246,.2)' }}><LogoIcon size={56} /></div>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-1)', marginBottom: 5, fontFamily: 'var(--font-head)' }}>Bem-vindo de volta</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Entre com suas credenciais para continuar</p>
          </div>

          <div style={{ background: 'rgba(12,14,20,.8)', backdropFilter: 'blur(24px)', border: '1px solid var(--border-2)', borderRadius: 18, padding: '32px 28px', boxShadow: '0 24px 64px rgba(0,0,0,.5)' }}>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Email</label>
                <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required autoComplete="email" style={{ marginTop: 5 }} />
              </div>
              <div>
                <label className="label">Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password" style={{ marginTop: 5 }} />
              </div>
              {error && (
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, fontSize: 12.5, color: '#F87171', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>⚠</span>{error}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}>
                {loading ? <><div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.2)' }} />Entrando...</> : 'Entrar'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11.5, color: 'var(--text-4)' }}>LACORE Store · Sistema de Gestão</p>
        </div>
      </section>
    </main>
  )
}
