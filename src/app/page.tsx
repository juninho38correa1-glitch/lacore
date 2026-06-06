'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LogoIcon } from '@/lib/useLogo'
import { TrendingUp, Package, CreditCard, ShoppingBag, ArrowRight, BarChart3, Bell } from 'lucide-react'

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
          <a href="#funcionalidades" style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', textDecoration: 'none', transition: 'color .15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.55)')}>
            Funcionalidades
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
          <a href="#funcionalidades" onClick={() => setMenuOpen(false)} style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', textDecoration: 'none', padding: '8px 0' }}>Funcionalidades</a>
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

/* ─── Stats preview card ─────────────────────────────────── */
function DashboardPreview() {
  const stats = [
    { label: 'Saldo em Caixa', value: 'R$ 12.843', icon: TrendingUp, color: '#22c55e', bg: 'rgba(34,197,94,.1)' },
    { label: 'Vendas no Mês', value: '47 vendas', icon: ShoppingBag, color: 'var(--accent)', bg: 'rgba(59,130,246,.1)' },
    { label: 'A Receber', value: 'R$ 3.210', icon: CreditCard, color: '#f59e0b', bg: 'rgba(245,158,11,.1)' },
    { label: 'Itens em Estoque', value: '136 itens', icon: Package, color: '#a78bfa', bg: 'rgba(167,139,250,.1)' },
  ]
  const vendas = [
    { ref: 'VDA-MQ038BUG', produto: 'Xiaomi Poco C85', valor: 'R$ 1.119', status: 'APROVADA', cor: '#22c55e' },
    { ref: 'VDA-MPYOPMPY', produto: 'Redmi A5 Preto', valor: 'R$ 741', status: 'APROVADA', cor: '#22c55e' },
    { ref: 'VDA-KPL77FXQ', produto: 'Poco C85 Preto', valor: 'R$ 989', status: 'APROVADA', cor: '#22c55e' },
  ]

  return (
    <div style={{
      background: 'rgba(18,18,23,.9)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20,
      overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)',
    }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
        <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <LogoIcon size={16} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontFamily: 'var(--font-head)' }}>Lacore ERP — Dashboard</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 99, padding: '2px 8px' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Ao vivo</span>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: 'rgba(255,255,255,.04)' }}>
        {stats.map((s) => (
          <div key={s.label} style={{ padding: '14px 16px', background: 'rgba(12,12,16,.95)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={15} style={{ color: s.color }} />
            </div>
            <div>
              <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>{s.label}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: 'var(--font-head)' }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Vendas recentes */}
      <div style={{ padding: '14px 16px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <BarChart3 size={12} style={{ color: 'rgba(255,255,255,.3)' }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.3)' }}>Vendas recentes</span>
        </div>
        {vendas.map(v => (
          <div key={v.ref} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <div>
              <p style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,.75)' }}>{v.produto}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 1 }}>{v.ref}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{v.valor}</span>
              <span style={{ fontSize: 9.5, fontWeight: 600, color: v.cor, background: `${v.cor}18`, border: `1px solid ${v.cor}33`, padding: '2px 7px', borderRadius: 99 }}>{v.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Notification row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'rgba(59,130,246,.06)', borderTop: '1px solid rgba(59,130,246,.12)' }}>
        <Bell size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <p style={{ fontSize: 10.5, color: 'rgba(59,130,246,.8)' }}>1 parcela vence hoje · <strong style={{ color: 'var(--accent)' }}>Cobrar via WhatsApp</strong></p>
      </div>
    </div>
  )
}

/* ─── Features ──────────────────────────────────────────── */
const features = [
  { icon: ShoppingBag, title: 'Gestão de Vendas', desc: 'Registro completo com comprovante PDF profissional, multi-produto e histórico por cliente.', color: '#3b82f6' },
  { icon: Package, title: 'Controle de Estoque', desc: 'Cadastro com fotos, specs técnicas, variantes e movimentação em tempo real.', color: '#22c55e' },
  { icon: CreditCard, title: 'Parcelamentos', desc: 'Contratos de parcelamento com alertas automáticos e cobrança via WhatsApp.', color: '#f59e0b' },
  { icon: TrendingUp, title: 'Fluxo de Caixa', desc: 'Entradas, saídas, saldo acumulado e relatórios de performance exportáveis.', color: '#a78bfa' },
  { icon: BarChart3, title: 'Relatórios', desc: 'Relatório de vendas, estoque e financeiro com exportação em PDF e impressão.', color: '#f472b6' },
  { icon: Bell, title: 'Alertas Push', desc: 'Notificações de parcelas vencidas e cobrança automática via WhatsApp do cliente.', color: '#34d399' },
]

/* ─── Main Page ─────────────────────────────────────────── */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const { login, user } = useAuth()
  const router = useRouter()
  const loginRef = useRef<HTMLDivElement>(null)

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

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => document.getElementById('login-email')?.focus(), 600)
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-1)', overflowX: 'hidden' }}>
      <Navigation onEntrar={scrollToLogin} />

      {/* ── Hero ── */}
      <section style={{ paddingTop: 'clamp(100px,14vw,140px)', paddingBottom: 80, position: 'relative', overflow: 'hidden' }}>
        {/* Background glows */}
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '0', left: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', position: 'relative' }}>

          {/* Badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28,
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)', transition: 'all .5s ease' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 99, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', flexShrink: 0 }} />
              Novo · Alertas de parcelas e cobrança via WhatsApp
              <ArrowRight size={11} style={{ opacity: .6 }} />
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            textAlign: 'center', fontSize: 'clamp(32px,5.5vw,60px)', fontWeight: 700, lineHeight: 1.1,
            letterSpacing: '-.03em', marginBottom: 20,
            background: 'linear-gradient(to bottom, #fff 30%, rgba(255,255,255,.5))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            fontFamily: 'var(--font-head)',
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)', transition: 'all .55s ease .08s',
          }}>
            Gestão completa<br />para sua loja de eletrônicos
          </h1>

          {/* Subtitle */}
          <p style={{ textAlign: 'center', fontSize: 'clamp(14px,1.6vw,17px)', color: 'rgba(255,255,255,.45)', maxWidth: 540, margin: '0 auto 36px', lineHeight: 1.65,
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)', transition: 'all .6s ease .15s' }}>
            Vendas, estoque, parcelamentos, fluxo de caixa e relatórios — tudo em um sistema feito para a sua realidade.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 60,
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(12px)', transition: 'all .65s ease .2s' }}>
            <button onClick={scrollToLogin}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,.88))', color: '#09090b', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-head)', transition: 'transform .15s, box-shadow .15s', boxShadow: '0 4px 24px rgba(255,255,255,.12)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(255,255,255,.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(255,255,255,.12)' }}>
              Acessar o Sistema <ArrowRight size={15} />
            </button>
            <a href="/catalogo" target="_blank"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', borderRadius: 12, background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)', fontSize: 14, fontWeight: 500, border: '1px solid rgba(255,255,255,.1)', textDecoration: 'none', transition: 'all .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.1)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.7)' }}>
              Ver Catálogo
            </a>
          </div>

          {/* Dashboard preview */}
          <div style={{ maxWidth: 720, margin: '0 auto',
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all .7s ease .28s' }}>
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="funcionalidades" style={{ padding: '80px 20px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--accent)', marginBottom: 12 }}>Funcionalidades</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 700, letterSpacing: '-.02em', marginBottom: 48, fontFamily: 'var(--font-head)' }}>
            Tudo que você precisa em um só lugar
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {features.map(f => (
              <div key={f.title} style={{ padding: '20px 22px', borderRadius: 16, border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)', transition: 'all .18s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.12)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.07)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${f.color}15`, border: `1px solid ${f.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <f.icon size={18} style={{ color: f.color }} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 7, fontFamily: 'var(--font-head)' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Login ── */}
      <section style={{ padding: '80px 20px 100px', borderTop: '1px solid rgba(255,255,255,.05)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div ref={loginRef} style={{ maxWidth: 400, margin: '0 auto', position: 'relative' }}>
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
