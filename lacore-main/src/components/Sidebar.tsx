'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ini } from '@/lib/supabase'
import {
  LayoutDashboard, Package, ShoppingCart, Send, DollarSign,
  Sparkles, Users, UserSquare, BarChart3, Store, Settings,
  LogOut, Menu, X,
} from 'lucide-react'

const ADM_NAV = [
  { sep: 'Principal' },
  { id: 'dashboard',  href: '/dashboard',              label: 'Dashboard',       icon: LayoutDashboard },
  { sep: 'Operações' },
  { id: 'estoque',    href: '/dashboard/estoque',       label: 'Estoque',         icon: Package },
  { id: 'vendas',     href: '/dashboard/vendas',        label: 'Vendas',          icon: ShoppingCart },
  { id: 'remessas',   href: '/dashboard/remessas',      label: 'Remessas',        icon: Send },
  { sep: 'Financeiro' },
  { id: 'caixa',      href: '/dashboard/fluxo-caixa',   label: 'Fluxo de Caixa',  icon: DollarSign },
  { id: 'iaprecos',   href: '/dashboard/precos',        label: 'IA de Preços',    icon: Sparkles },
  { sep: 'Gestão' },
  { id: 'vendedores', href: '/dashboard/vendedores',    label: 'Vendedores',      icon: UserSquare },
  { id: 'clientes',   href: '/dashboard/clientes',      label: 'Clientes',        icon: Users },
  { id: 'relatorios', href: '/dashboard/relatorios',    label: 'Relatórios',      icon: BarChart3 },
  { sep: 'Sistema' },
  { id: 'catalogo',   href: '/dashboard/vitrine',       label: 'Vitrine',         icon: Store },
  { id: 'config',     href: '/dashboard/configuracoes', label: 'Configurações',   icon: Settings },
]
const VND_NAV = [
  { id: 'dashboard', href: '/dashboard',          label: 'Dashboard', icon: LayoutDashboard },
  { id: 'estoque',   href: '/dashboard/estoque',  label: 'Estoque',   icon: Package },
  { id: 'vendas',    href: '/dashboard/vendas',   label: 'Vendas',    icon: ShoppingCart },
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAdmin, logout } = useAuth()
  const nav = isAdmin() ? ADM_NAV : VND_NAV

  const handleLogout = () => { logout(); router.push('/') }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Hamburguer mobile */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 md:hidden btn btn-ghost btn-icon"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border-2)' }}
      >
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>

      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen z-40 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width: 232,
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--border-1)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 34, height: 34,
              borderRadius: 9,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(59,130,246,.35)',
              flexShrink: 0,
            }}>
              <svg width="17" height="15" viewBox="0 0 40 36" fill="none">
                <defs>
                  <linearGradient id="slg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,.95)"/>
                    <stop offset="100%" stopColor="rgba(255,255,255,.55)"/>
                  </linearGradient>
                </defs>
                <path d="M4 4L4 28L18 28" stroke="url(#slg)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 4C22 4 37 4 37 18C37 28 30 28 30 28" stroke="url(#slg)" strokeWidth="4.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-1)' }}>LACORE</p>
              <p style={{ fontSize: 9.5, color: 'var(--text-4)', letterSpacing: '0.08em', marginTop: 1 }}>Gestão de Importação</p>
            </div>
          </div>
        </div>

        {/* User */}
        {user && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 700, color: '#fff',
                flexShrink: 0, letterSpacing: '.02em',
              }}>
                {ini(user.name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name.split(' ')[0]}
                </p>
                <p style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1 }}>
                  {isAdmin() ? 'Administrador' : 'Vendedor'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {nav.map((item, i) => {
            if ('sep' in item) {
              return (
                <p key={i} style={{
                  fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '.09em', color: 'var(--text-4)',
                  padding: '14px 10px 5px',
                }}>
                  {item.sep}
                </p>
              )
            }
            const Icon = item.icon!
            const active = isActive(item.href!)
            return (
              <Link
                key={item.id}
                href={item.href!}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 10px',
                  borderRadius: 7,
                  marginBottom: 1,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--text-1)' : 'var(--text-3)',
                  background: active ? 'var(--bg-3)' : 'transparent',
                  border: active ? '1px solid var(--border-2)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all .12s ease',
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
              >
                <Icon size={14.5} style={{ color: active ? 'var(--accent)' : 'inherit', flexShrink: 0 }} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '8px 8px 12px', borderTop: '1px solid var(--border-1)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 10px', borderRadius: 7, border: 'none',
              background: 'transparent', color: 'var(--text-4)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'all .12s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F87171'; (e.currentTarget as HTMLElement).style.background = 'var(--red-s)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-4)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <LogOut size={14} />
            Sair do sistema
          </button>
        </div>
      </aside>
    </>
  )
}
