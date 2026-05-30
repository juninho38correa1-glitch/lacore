'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Package, ShoppingCart, Send, Users, Command } from 'lucide-react'
import { sb, fR } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ini } from '@/lib/supabase'

export default function Topbar() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ type: string; items: Record<string, string>[] }[]>([])
  const [searching, setSearching] = useState(false)
  const router = useRouter()
  const { user, isAdmin } = useAuth()

  // ── Atalhos de teclado — lógica preservada ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'Escape') setSearchOpen(false)
      if (!searchOpen && !['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'n') router.push('/dashboard/vendas?nova=1')
        if (e.key === 'r' && isAdmin()) router.push('/dashboard/remessas?nova=1')
        if (e.key === 'e') router.push('/dashboard/estoque')
        if (e.key === 'd') router.push('/dashboard')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen, router, isAdmin])

  // ── Busca global — lógica preservada ──
  const buscarGlobal = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const [prods, vendas, remessas, clientes] = await Promise.all([
        sb.from('products').select('id,brand,model,color,status,price_current').or(`brand.ilike.%${q}%,model.ilike.%${q}%`).limit(4),
        sb.from('sales').select('id,reference,total_price,status').or(`reference.ilike.%${q}%`).limit(4),
        sb.from('shipments').select('id,reference,status,shipment_date').or(`reference.ilike.%${q}%`).limit(4),
        sb.from('customers').select('id,name,phone,city').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(4),
      ])
      const r = []
      if (prods.data?.length)    r.push({ type: 'Produtos',  items: prods.data    as Record<string,string>[] })
      if (vendas.data?.length)   r.push({ type: 'Vendas',    items: vendas.data   as Record<string,string>[] })
      if (remessas.data?.length) r.push({ type: 'Remessas',  items: remessas.data as Record<string,string>[] })
      if (clientes.data?.length) r.push({ type: 'Clientes',  items: clientes.data as Record<string,string>[] })
      setResults(r)
    } finally { setSearching(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => buscarGlobal(query), 280)
    return () => clearTimeout(t)
  }, [query, buscarGlobal])

  const navTo = (type: string) => {
    setSearchOpen(false); setQuery('')
    const routes: Record<string, string> = { Produtos: '/dashboard/estoque', Vendas: '/dashboard/vendas', Remessas: '/dashboard/remessas', Clientes: '/dashboard/clientes' }
    router.push(routes[type] || '/dashboard')
  }

  const iconMap: Record<string, React.ReactNode> = {
    Produtos:  <Package size={12} />,
    Vendas:    <ShoppingCart size={12} />,
    Remessas:  <Send size={12} />,
    Clientes:  <Users size={12} />,
  }
  const colorMap: Record<string, string> = {
    Produtos: 'var(--accent)', Vendas: 'var(--green)',
    Remessas: 'var(--yellow)', Clientes: 'var(--purple)',
  }

  return (
    <>
      <header style={{
        height: 52,
        background: 'rgba(8,10,15,.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-1)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky', top: 0, zIndex: 30,
        flexShrink: 0,
      }}>
        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            background: 'var(--bg-2)',
            border: '1px solid var(--border-1)',
            borderRadius: 7,
            color: 'var(--text-4)',
            fontSize: 12.5,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            transition: 'all .15s',
            minWidth: 200,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-3)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-1)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-4)' }}
        >
          <Search size={13} />
          <span style={{ flex: 1 }}>Buscar...</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, padding: '2px 6px', background: 'var(--bg-3)', borderRadius: 4, border: '1px solid var(--border-2)', color: 'var(--text-4)' }}>
            <Command size={9} />K
          </span>
        </button>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin() && (
            <button
              onClick={() => router.push('/dashboard/remessas?nova=1')}
              className="btn btn-secondary btn-sm"
              style={{ display: 'none' }}
            />
          )}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '.02em',
              }}>
                {ini(user.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-1)', lineHeight: 1.2 }}>{user.name.split(' ')[0]}</span>
                <span style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.2 }}>{isAdmin() ? 'Admin' : 'Vendedor'}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Search modal */}
      {searchOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 50,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '80px 16px 0',
          }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 560,
              background: 'var(--bg-1)',
              border: '1px solid var(--border-2)',
              borderRadius: var_r(12),
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            className="anim-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-1)' }}>
              <Search size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar produtos, vendas, clientes, remessas..."
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  color: 'var(--text-1)', fontSize: 14, fontFamily: 'var(--font)',
                  padding: 0,
                }}
              />
              {searching && <div className="spinner spinner-sm" />}
              <button
                onClick={() => setSearchOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', display: 'flex', padding: 4 }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {results.length === 0 && query.length >= 2 && !searching && (
                <div className="empty" style={{ padding: '32px 24px' }}>
                  <p className="empty-title">Nenhum resultado para &quot;{query}&quot;</p>
                </div>
              )}
              {results.map(group => (
                <div key={group.type}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-4)', padding: '10px 16px 6px', borderBottom: '1px solid var(--border-1)' }}>
                    {group.type}
                  </p>
                  {group.items.map((item, i) => (
                    <button key={i} onClick={() => navTo(group.type)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                      padding: '10px 16px', border: 'none', background: 'transparent',
                      cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: `color-mix(in srgb, ${colorMap[group.type]} 12%, transparent)`,
                        color: colorMap[group.type],
                      }}>
                        {iconMap[group.type]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.brand ? `${item.brand} ${item.model}` : item.name || item.reference}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
                          {item.status || item.phone || item.city || ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
              {!query && (
                <div style={{ padding: '12px 16px 14px' }}>
                  <p style={{ fontSize: 10.5, color: 'var(--text-4)', marginBottom: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em' }}>Atalhos</p>
                  {[['N','Nova venda'],['R','Nova remessa (admin)'],['E','Estoque'],['D','Dashboard'],['Esc','Fechar']].map(([k, l]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-1)' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{l}</span>
                      <kbd style={{ fontSize: 10.5, background: 'var(--bg-3)', border: '1px solid var(--border-2)', padding: '2px 7px', borderRadius: 4, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{k}</kbd>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function var_r(n: number) { return `${n}px` }
