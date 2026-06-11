'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { sb, fR, fD, fP, dI, ini } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Package, ShoppingCart, DollarSign, BarChart2, AlertTriangle, ArrowUpRight, Smartphone } from 'lucide-react'
import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton'
import { RevenueChart } from '@/components/RevenueChart'
import { Modal } from '@/components/ui/Modal'

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // Admin stats
  const [rev, setRev]         = useState(0)
  const [prf, setPrf]         = useState(0)
  const [mg, setMg]           = useState(0)
  const [salesCount, setSalesCount] = useState(0)
  const [stockCount, setStockCount] = useState(0)
  const [lrev, setLrev]       = useState(0)
  const [lprf, setLprf]       = useState(0)
  const [recent, setRecent]   = useState<Record<string, unknown>[]>([])
  const [vRank, setVRank]     = useState<{ id: string; name: string; p: number; c: number }[]>([])
  const [stale, setStale]     = useState<Record<string, unknown>[]>([])
  const [chartData, setChartData] = useState<{ labels: string[]; rev: number[]; prf: number[] }>({ labels: [], rev: [], prf: [] })
  const [extratoSales, setExtratoSales] = useState<Record<string, unknown>[]>([])
  const [extratoOpen, setExtratoOpen] = useState<'faturamento' | 'lucro' | null>(null)
  const [topProducts, setTopProducts] = useState<{ brand: string; model: string; qtd: number }[]>([])

  // Vendedor stats
  const [vRev, setVRev]       = useState(0)
  const [vPrf, setVPrf]       = useState(0)
  const [vCount, setVCount]   = useState(0)
  const [vStock, setVStock]   = useState(0)
  const [vSales, setVSales]   = useState<Record<string, unknown>[]>([])
  const [aReceber, setAReceber] = useState(0)
  const [vencidosParc, setVencidosParc] = useState(0)

  useEffect(() => {
    if (!user) return
    if (isAdmin()) loadAdmin()
    else loadVendedor()
  }, [user])

  const loadAdmin = async () => {
    try {
      setLoading(true)
      const now = new Date()
      const som = new Date(now.getFullYear(), now.getMonth(), 1)
      const lsom = new Date(now.getFullYear(), now.getMonth() - 1, 1)

      const [s1, s2, s3, s4] = await Promise.all([
        sb.from('sales').select('id,reference,total_price,profit_total,margin_percent,created_at,notes,customer:customers(name,city,state),product:products(brand,model,color)').eq('status', 'APROVADA'),
        sb.from('products').select('id,date_added,brand,model').eq('status', 'ATIVO'),
        sb.from('sales').select('id,reference,total_price,profit_total,created_at,product:products(brand,model)').eq('status', 'APROVADA').order('created_at', { ascending: false }).limit(7),
        sb.from('users').select('id,name').eq('status', 'ATIVO'), // todos os usuários ativos
      ])

      const allS: Record<string, unknown>[] = (s1.data || []) as Record<string, unknown>[]
      const prods: Record<string, string>[] = (s2.data || []) as Record<string, string>[]

      const thisMo = allS.filter(s => new Date(s.created_at as string) >= som)
      const lastMo = allS.filter(s => new Date(s.created_at as string) >= lsom && new Date(s.created_at as string) < som)

      setRev(thisMo.reduce((a, x) => a + ((x.total_price as number) || 0), 0))
      setPrf(thisMo.reduce((a, x) => a + ((x.profit_total as number) || 0), 0))
      setMg(thisMo.length ? thisMo.reduce((a, x) => a + ((x.margin_percent as number) || 0), 0) / thisMo.length : 0)
      setSalesCount(thisMo.length)
      setStockCount(prods.length)
      setLrev(lastMo.reduce((a, x) => a + ((x.total_price as number) || 0), 0))
      setLprf(lastMo.reduce((a, x) => a + ((x.profit_total as number) || 0), 0))
      setRecent((s3.data || []) as Record<string, unknown>[])
      setExtratoSales([...thisMo].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()))

      // Top 5 produtos mais vendidos no mês (agrupado por modelo, ignorando cor/armazenamento)
      const prodMap = new Map<string, { brand: string; model: string; qtd: number }>()
      thisMo.forEach(s => {
        const p = s.product as Record<string, string> | null
        if (!p) return
        const key = `${p.brand}|${p.model}`
        const cur = prodMap.get(key) || { brand: p.brand, model: p.model, qtd: 0 }
        cur.qtd += 1
        prodMap.set(key, cur)
      })
      setTopProducts([...prodMap.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 5))
      setStale(prods.filter(p => dI(p.date_added || '') >= 15) as Record<string, unknown>[])

      // Buscar a receber de parcelamentos
      const { data: parcPend } = await sb.from('installment_payments').select('amount,status').in('status', ['PENDENTE','VENCIDO'])
      const totalAR = (parcPend || []).reduce((a, p) => a + ((p as Record<string,number>).amount || 0), 0)
      const totalVenc = (parcPend || []).filter((p: Record<string,string>) => p.status === 'VENCIDO').reduce((a, p) => a + ((p as Record<string,number>).amount || 0), 0)
      setAReceber(totalAR)
      setVencidosParc(totalVenc)

      // Chart 6 meses
      const labels: string[] = [], revArr: number[] = [], prfArr: number[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        labels.push(d.toLocaleDateString('pt-BR', { month: 'short' }))
        const s = new Date(d.getFullYear(), d.getMonth(), 1)
        const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
        const f = allS.filter(x => new Date(x.created_at as string) >= s && new Date(x.created_at as string) <= e)
        revArr.push(f.reduce((a, x) => a + ((x.total_price as number) || 0), 0))
        prfArr.push(f.reduce((a, x) => a + ((x.profit_total as number) || 0), 0))
      }
      setChartData({ labels, rev: revArr, prf: prfArr })

      // Ranking vendedores
      const vends = (s4.data || []) as { id: string; name: string }[]
      const rank = await Promise.all(vends.map(async v => {
        const { data } = await sb.from('sales').select('total_price').eq('vendor_id', v.id).eq('status', 'APROVADA').gte('created_at', som.toISOString())
        const p = (data || []).reduce((a, x) => a + ((x as Record<string, number>).total_price || 0), 0)
        return { id: v.id, name: v.name, p, c: (data || []).length }
      }))
      rank.sort((a, b) => b.p - a.p)
      setVRank(rank)
    } catch (e) { console.error('Dashboard admin error:', e) }
    finally { setLoading(false) }
  }

  const loadVendedor = async () => {
    try {
      setLoading(true)
      if (!user) return
      const som = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const [s1, s2, s3] = await Promise.all([
        sb.from('sales').select('profit_total,total_price').eq('vendor_id', user.id).eq('status', 'APROVADA').gte('created_at', som.toISOString()),
        sb.from('products').select('id').eq('status', 'ATIVO'),
        sb.from('sales').select('id,reference,total_price,created_at,product:products(brand,model)').eq('vendor_id', user.id).eq('status', 'APROVADA').order('created_at', { ascending: false }).limit(10),
      ])
      const sales = (s1.data || []) as Record<string, number>[]
      setVRev(sales.reduce((a, x) => a + (x.total_price || 0), 0))
      setVPrf(sales.reduce((a, x) => a + (x.profit_total || 0), 0))
      setVCount(sales.length)
      setVStock((s2.data || []).length)
      setVSales((s3.data || []) as Record<string, unknown>[])
    } catch (e) { console.error('Dashboard vendedor error:', e) }
    finally { setLoading(false) }
  }

  const delta = (c: number, p: number) => {
    if (!p) return null
    const pct = ((c - p) / p) * 100
    return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 }
  }

  if (loading) return (
    <div>
      <div className="page-header">
        <div style={{ width: 140, height: 24, background: 'var(--bg-3)', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ width: 200, height: 14, background: 'var(--bg-3)', borderRadius: 4 }} />
      </div>
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="chart-layout" style={{ marginBottom: 16 }}>
        <div className="card" style={{ height: 220 }} />
        <div className="card" style={{ height: 220 }} />
      </div>
      <div className="table-wrap">
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-1)', height: 48 }} />
        <table><tbody>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody></table>
      </div>
    </div>
  )

  // ── VENDEDOR ──
  if (!isAdmin()) return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {[
          { l: 'Faturamento', v: fR(vRev),   c: 'var(--accent)',  Icon: DollarSign  },
          { l: 'Comissão',    v: fR(vPrf),   c: 'var(--green)',   Icon: TrendingUp  },
          { l: 'Vendas',      v: vCount,      c: 'var(--purple)',  Icon: ShoppingCart },
          { l: 'Em Estoque',  v: vStock,      c: 'var(--yellow)',  Icon: Package     },
        ].map(({ l, v, c, Icon }) => (
          <div key={l} className={`stat-card stat-pop card-hover card-glow ${l === "Faturamento" ? "stat-card-accent" : l === "Lucro" ? "stat-card-green" : l === "Margem Média" ? "stat-card-yellow" : ""}`} style={{ cursor: "default" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <p className="stat-label">{l}</p>
              <Icon size={13} style={{ color: 'var(--text-4)' }} />
            </div>
            <p className="stat-value" style={{ color: c, fontSize: 22 }}>{v}</p>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid var(--border-1)' }}>
          <p style={{ fontSize: 13.5, fontWeight: 600 }}>Minhas Vendas Recentes</p>
          <button onClick={() => router.push('/dashboard/vendas')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 3 }}>Ver todas <ArrowUpRight size={11} /></button>
        </div>
        <table>
          <thead><tr><th>Ref</th><th>Produto</th><th>Valor</th><th>Data</th></tr></thead>
          <tbody>
            {vSales.map((s, i) => {
              const prod = s.product as Record<string, string> | null
              return (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{String(s.reference || '—')}</td>
                  <td style={{ fontWeight: 500 }}>{prod?.brand} {prod?.model}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{fR(Number(s.total_price) || 0)}</td>
                  <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(String(s.created_at || ''))}</td>
                </tr>
              )
            })}
            {!vSales.length && <tr><td colSpan={4}><div className="empty"><p className="empty-title">Nenhuma venda ainda</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── ADMIN ──
  const rankColors = ['#F59E0B', '#8B9BBE', '#A16207']
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {[
          { l: 'Faturamento',   v: fR(rev),        c: 'var(--accent)',  Icon: DollarSign,   d: delta(rev,  lrev), onClick: () => setExtratoOpen('faturamento') },
          { l: 'Lucro',         v: fR(prf),        c: 'var(--green)',   Icon: TrendingUp,   d: delta(prf,  lprf), onClick: () => setExtratoOpen('lucro') },
          { l: 'Margem Média',  v: fP(mg),         c: 'var(--yellow)',  Icon: BarChart2,    d: null },
          { l: 'Vendas',        v: salesCount,      c: 'var(--purple)',  Icon: ShoppingCart, d: null, href: '/dashboard/vendas' },
          { l: 'Em Estoque',    v: stockCount,      c: 'var(--accent)',  Icon: Package,      d: null, href: '/dashboard/estoque' },
        { l: 'A Receber',      v: fR(aReceber),    c: 'var(--yellow)',  Icon: DollarSign,   d: null, href: '/dashboard/fluxo-caixa?tab=areceber' },
        { l: 'Parc. Vencidas', v: fR(vencidosParc), c: vencidosParc > 0 ? 'var(--red)' : 'var(--text-3)', Icon: BarChart2, d: null, href: '/dashboard/fluxo-caixa?tab=areceber' },
        ].map(({ l, v, c, Icon, d, href, onClick }) => (
          <div key={l} onClick={() => onClick ? onClick() : href && router.push(href)}
               role={(href || onClick) ? 'button' : undefined}
               tabIndex={(href || onClick) ? 0 : undefined}
               onKeyDown={(href || onClick) ? (e) => { if (e.key === 'Enter') { onClick ? onClick() : href && router.push(href) } } : undefined}
               className={`stat-card stat-pop card-hover card-glow ${(href || onClick) ? 'clickable' : ''} ${l === "Faturamento" ? "stat-card-accent" : l === "Lucro" ? "stat-card-green" : l === "Margem Média" ? "stat-card-yellow" : ""}`}
               style={{ cursor: (href || onClick) ? "pointer" : "default" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <p className="stat-label">{l}</p>
              <Icon size={13} style={{ color: 'var(--text-4)' }} />
            </div>
            <p className="stat-value" style={{ color: c, fontSize: 22 }}>{v}</p>
            {d && <p className={`stat-delta ${d.up ? 'delta-up' : 'delta-down'}`}>{d.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{d.pct}% vs mês ant.</p>}
          </div>
        ))}
      </div>

      <div className="chart-layout" style={{ marginBottom: 16 }}>
        <div className="card">
          <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)', marginBottom: 14 }}>Faturamento — Últimos 6 Meses</p>
          <div style={{ height: 160 }}>{chartData.labels.length > 0 && <RevenueChart data={chartData} />}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)', marginBottom: 12 }}>Top Vendedores</p>
            {!vRank.length
              ? <p style={{ fontSize: 12, color: 'var(--text-4)' }}>Sem dados este mês</p>
              : vRank.slice(0, 4).map((v, i) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderBottom: i < vRank.slice(0,4).length - 1 ? '1px solid var(--border-1)' : 'none' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, width: 14, color: rankColors[i] || 'var(--text-4)' }}>{i + 1}</span>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{ini(v.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-4)' }}>{v.c} venda{v.c !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{fR(v.p)}</span>
                </div>
              ))
            }
          </div>
          <div className="card" style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Smartphone size={11} />Top 5 Mais Vendidos
            </p>
            {!topProducts.length
              ? <p style={{ fontSize: 12, color: 'var(--text-4)' }}>Sem dados este mês</p>
              : topProducts.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderBottom: i < topProducts.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, width: 14, color: rankColors[i] || 'var(--text-4)' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand} {p.model}</p>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{p.qtd}x</span>
                </div>
              ))
            }
          </div>
          {stale.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(245,158,11,.2)' }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--yellow)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={11} />Estoque Parado
              </p>
              {(stale as Record<string, string>[]).slice(0, 3).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-1)' }}>
                  <p style={{ fontSize: 11.5, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand} {p.model}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span className={`badge ${dI(p.date_added || '') >= 25 ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: 9.5 }}>{dI(p.date_added || '')}d</span>
                    <button onClick={() => router.push('/dashboard/precos')} style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>IA →</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid var(--border-1)' }}>
          <p style={{ fontSize: 13.5, fontWeight: 600 }}>Vendas Recentes</p>
          <button onClick={() => router.push('/dashboard/vendas')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 3 }}>Ver todas <ArrowUpRight size={11} /></button>
        </div>
        <table>
          <thead><tr><th>Ref</th><th>Produto</th><th>Valor</th><th>Lucro</th><th>Status</th><th>Data</th></tr></thead>
          <tbody>
            {recent.map((s, i) => {
              const prod = s.product as Record<string, string> | null
              const status = String(s.status || '')
              return (
                <tr key={i}>
                  <td className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{String(s.reference || '—')}</td>
                  <td style={{ fontWeight: 500 }}>{prod?.brand} {prod?.model}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{fR(Number(s.total_price) || 0)}</td>
                  <td className="hide-mobile mono" style={{ color: 'var(--green)' }}>{fR(Number(s.profit_total) || 0)}</td>
                  <td><span className={`badge badge-${status === 'APROVADA' ? 'green' : status === 'CANCELADA' ? 'red' : 'gray'}`}>{status}</span></td>
                  <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(String(s.created_at || ''))}</td>
                </tr>
              )
            })}
            {!recent.length && <tr><td colSpan={6}><div className="empty"><p className="empty-title">Nenhuma venda ainda</p></div></td></tr>}
          </tbody>
        </table>
      </div>

      <Modal
        open={extratoOpen !== null}
        onClose={() => setExtratoOpen(null)}
        title={extratoOpen === 'faturamento' ? 'Extrato de Faturamento' : 'Extrato de Lucro'}
        size="xl"
      >
        <div style={{ padding: '14px 18px' }}>
          <p style={{ fontSize: 11.5, color: 'var(--text-4)', marginBottom: 12 }}>
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} · {extratoSales.length} venda{extratoSales.length !== 1 ? 's' : ''}
          </p>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Cidade</th>
                <th>Produto</th>
                <th>{extratoOpen === 'lucro' ? 'Lucro' : 'Valor'}</th>
              </tr>
            </thead>
            <tbody>
              {extratoSales.map((s, i) => {
                const cust = s.customer as Record<string, string> | null
                const prod = s.product as Record<string, string> | null
                const notes = String(s.notes || '')
                const itensMatch = notes.match(/Itens:\s*(.+)/)
                const produtoLabel = itensMatch ? itensMatch[1] : (prod ? `${prod.brand} ${prod.model}` : '—')
                const valor = extratoOpen === 'lucro' ? Number(s.profit_total) || 0 : Number(s.total_price) || 0
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(String(s.created_at || ''))}</td>
                    <td style={{ fontWeight: 500 }}>{cust?.name || '—'}</td>
                    <td className="hide-mobile" style={{ color: 'var(--text-3)', fontSize: 12 }}>{cust?.city ? `${cust.city}${cust.state ? `/${cust.state}` : ''}` : '—'}</td>
                    <td className="hide-mobile" style={{ color: 'var(--text-3)', fontSize: 12 }}>{produtoLabel}</td>
                    <td className="mono" style={{ fontWeight: 600, color: extratoOpen === 'lucro' ? 'var(--green)' : 'var(--accent)' }}>{fR(valor)}</td>
                  </tr>
                )
              })}
              {!extratoSales.length && <tr><td colSpan={5}><div className="empty"><p className="empty-title">Nenhuma venda este mês</p></div></td></tr>}
            </tbody>
            {extratoSales.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ fontWeight: 600, color: 'var(--text-2)' }}>Total</td>
                  <td className="mono" style={{ fontWeight: 700, color: extratoOpen === 'lucro' ? 'var(--green)' : 'var(--accent)' }}>
                    {fR(extratoOpen === 'lucro' ? prf : rev)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Modal>
    </div>
  )
}
