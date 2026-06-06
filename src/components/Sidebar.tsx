'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LogoIcon } from '@/lib/useLogo'
import { LayoutDashboard, Package, BookOpen, ShoppingCart, Send, DollarSign, Sparkles, Users, UserSquare, BarChart3, Store, Settings, LogOut, Menu, X, CreditCard } from 'lucide-react'

const ADM_NAV = [
  { sep: 'Principal' },
  { id: 'dashboard',   href: '/dashboard',              label: 'Dashboard',      icon: LayoutDashboard },
  { sep: 'Operações' },
  { id: 'cadastro',   href: '/dashboard/cadastro',      label: 'Cadastro',       icon: BookOpen       },
  { id: 'estoque',     href: '/dashboard/estoque',       label: 'Estoque',        icon: Package        },
  { id: 'vendas',      href: '/dashboard/vendas',        label: 'Vendas',         icon: ShoppingCart   },
  { id: 'remessas',    href: '/dashboard/remessas',      label: 'Remessas',       icon: Send           },
  { sep: 'Financeiro' },
  { id: 'caixa',       href: '/dashboard/fluxo-caixa',   label: 'Fluxo de Caixa', icon: DollarSign     },
  { id: 'iaprecos',    href: '/dashboard/precos',        label: 'IA de Preços',   icon: Sparkles       },
  { sep: 'Gestão' },
  { id: 'vendedores',  href: '/dashboard/vendedores',    label: 'Vendedores',     icon: UserSquare     },
  { id: 'clientes',    href: '/dashboard/clientes',      label: 'Clientes',       icon: Users          },
  { id: 'relatorios',  href: '/dashboard/relatorios',    label: 'Relatórios',     icon: BarChart3      },
  { id: 'publicacoes', href: '/dashboard/publicacoes',   label: 'Publicações IA', icon: Sparkles       },
  { sep: 'Sistema' },
  { id: 'catalogo',    href: '/dashboard/vitrine',       label: 'Vitrine',        icon: Store          },
  { id: 'config',      href: '/dashboard/configuracoes', label: 'Configurações',  icon: Settings       },
]
const VND_NAV = [
  { id: 'dashboard', href: '/dashboard',         label: 'Dashboard', icon: LayoutDashboard },
  { id: 'estoque',   href: '/dashboard/estoque', label: 'Estoque',   icon: Package         },
  { id: 'vendas',    href: '/dashboard/vendas',  label: 'Vendas',    icon: ShoppingCart    },
]

// Chave no localStorage para logo customizado

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAdmin, logout } = useAuth()
  const nav = isAdmin() ? ADM_NAV : VND_NAV
  const handleLogout = () => { logout(); router.push('/') }
  const isActive = (href: string) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      <button onClick={() => setOpen(!open)} className="md:hidden" style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 8, padding: 8, color: 'var(--text-2)', cursor: 'pointer' }}>
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>
      {open && <div className="sidebar-backdrop md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`fixed left-0 top-0 h-screen z-40 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 232, background: 'var(--bg-1)', borderRight: '1px solid var(--border-1)' }}>

        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoIcon size={34} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-1)', fontFamily: 'var(--font-head)' }}>LACORE</p>
              <p style={{ fontSize: 9.5, color: 'var(--text-4)', letterSpacing: '0.06em', marginTop: 1 }}>LACORE Store</p>
            </div>
          </div>
        </div>



        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {nav.map((item, i) => {
            if ('sep' in item) return <p key={i} style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--text-4)', padding: '12px 10px 5px' }}>{item.sep}</p>
            const Icon = item.icon!
            const active = isActive(item.href!)
            return (
              <Link key={item.id} href={item.href!} onClick={() => setOpen(false)} className={`sidebar-link${active ? ' active' : ''}`}>
                <Icon size={14.5} className="sidebar-icon" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Perfil + Logout */}
        <div style={{ padding: '8px 8px 12px', borderTop: '1px solid var(--border-1)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href="/dashboard/perfil" onClick={() => setOpen(false)} className="sidebar-profile-link">
            <UserSquare size={14} style={{ flexShrink: 0 }} />Meu Perfil
          </Link>
          <button onClick={handleLogout} className="sidebar-logout">
            <LogOut size={14} />Sair do sistema
          </button>
        </div>
      </aside>
    </>
  )
}
