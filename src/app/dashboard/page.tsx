'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { sb, fR, fD, fP, dI, ini } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Package, ShoppingCart, DollarSign, BarChart2, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton'

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

  // Vendedor stats
  const [vRev, setVRev]       = useState(0)
  const [vPrf, setVPrf]       = useState(0)
  const [vCount, setVCount]   = useState(0)
  const [vStock, setVStock]   = useState(0)
  const [vSales, setVSales]   = useState<Record<string, unknown>[]>([])

  const chartRef  = useRef<HTMLCanvasElement>(null)
  const chartInst = useRef<unknown>(null)

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
        sb.from('sales').select('total_price,profit_total,margin_percent,created_at').eq('status', 'APROVADA'),
        sb.from('products').select('id,date_added,brand,model').eq('status', 'ATIVO'),
        sb.from('sales').select('id,reference,total_price,profit_total,created_at,product:products(brand,model)').eq('status', 'APROVADA').order('created_at', { ascending: false }).limit(7),
        sb.from('users').select('id,name').eq('role', 'VENDEDOR').eq('status', 'ATIVO'),
      ])

      const allS: Record<string, number | string>[] = (s1.data || []) as Record<string, number | string>[]
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
      setStale(prods.filter(p => dI(p.date_added || '') >= 15) as Record<string, unknown>[])

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
        const { data } = await sb.from('sales').select('profit_total').eq('vendor_id', v.id).eq('status', 'APROVADA').gte('created_at', som.toISOString())
        const p = (data || []).reduce((a, x) => a + ((x as Record<string, number>).profit_total || 0), 0)
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

  useEffect(() => {
    if (!chartData.labels.length || !isAdmin() || !chartRef.current) return
    const load = async () => {
      try {
        if (!(window as Record<string, unknown>).Chart) {
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
          document.head.appendChild(s)
          await new Promise(res => { s.onload = res })
        }
        if (chartInst.current) (chartInst.current as { destroy: () => void }).destroy()
        const W = window as Record<string, unknown>
        const Chart = W.Chart as new (el: HTMLCanvasElement, cfg: unknown) => { destroy: () => void }
        chartInst.current = new Chart(chartRef.current!, {
          type: 'line',
          data: {
            labels: chartData.labels,
            datasets: [
              { label: 'Faturamento', data: chartData.rev, borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,.06)', tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: '#3B82F6' },
              { label: 'Lucro',       data: chartData.prf, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,.05)', tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: '#10B981' },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#4A566E', font: { size: 11 }, boxWidth: 10, padding: 14 } } },
            scales: {
              x: { ticks: { color: '#2E3A4E', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.03)' }, border: { display: false } },
              y: { ticks: { color: '#2E3A4E', font: { size: 10 }, callback: (v: unknown) => 'R$' + ((Number(v) >= 1000 ? (Number(v)/1000).toFixed(0)+'k' : String(v))) }, grid: { color: 'rgba(255,255,255,.03)' }, border: { display: false } },
            },
          },
        })
      } catch(e) { console.error('Chart error:', e) }
    }
    load()
  }, [chartData, isAdmin])

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
          <div key={l} className="stat-card stat-pop card-hover">
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
          { l: 'Faturamento',   v: fR(rev),        c: 'var(--accent)',  Icon: DollarSign,   d: delta(rev,  lrev) },
          { l: 'Lucro',         v: fR(prf),        c: 'var(--green)',   Icon: TrendingUp,   d: delta(prf,  lprf) },
          { l: 'Margem Média',  v: fP(mg),         c: 'var(--yellow)',  Icon: BarChart2,    d: null },
          { l: 'Vendas',        v: salesCount,      c: 'var(--purple)',  Icon: ShoppingCart, d: null },
          { l: 'Em Estoque',    v: stockCount,      c: 'var(--accent)',  Icon: Package,      d: null },
        ].map(({ l, v, c, Icon, d }) => (
          <div key={l} className="stat-card stat-pop card-hover">
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
          <div style={{ height: 160 }}><canvas ref={chartRef} /></div>
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
                  <span className="mono" style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{fR(v.p)}</span>
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
                  <td className="mono" style={{ color: 'var(--green)' }}>{fR(Number(s.profit_total) || 0)}</td>
                  <td><span className={`badge badge-${status === 'APROVADA' ? 'green' : status === 'CANCELADA' ? 'red' : 'gray'}`}>{status}</span></td>
                  <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(String(s.created_at || ''))}</td>
                </tr>
              )
            })}
            {!recent.length && <tr><td colSpan={6}><div className="empty"><p className="empty-title">Nenhuma venda ainda</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
