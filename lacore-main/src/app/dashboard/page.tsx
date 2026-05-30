'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { sb, fR, fD, fP, dI, ini } from '@/lib/supabase'
import type { Sale, Product, User } from '@/lib/types'
import { TrendingUp, TrendingDown, Package, ShoppingCart, DollarSign, BarChart2, AlertTriangle, ArrowUpRight } from 'lucide-react'

declare global { interface Window { Chart: typeof import('chart.js')['Chart'] } }

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({ rev: 0, prf: 0, mg: 0, salesCount: 0, stockCount: 0, lrev: 0, lprf: 0 })
  const [recent, setRecent] = useState<Sale[]>([])
  const [vRank, setVRank] = useState<(User & { p: number; c: number })[]>([])
  const [stale, setStale] = useState<Product[]>([])
  const [chartData, setChartData] = useState<{ labels: string[]; rev: number[]; prf: number[] }>({ labels: [], rev: [], prf: [] })
  const [loading, setLoading] = useState(true)
  const [vendStats, setVendStats] = useState({ rev: 0, prf: 0, count: 0, estoque: 0 })
  const [vendSales, setVendSales] = useState<Sale[]>([])
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInst = useRef<unknown>(null)

  useEffect(() => {
    if (!user) return
    if (isAdmin()) loadAdmin()
    else loadVendedor()
  }, [user])

  // ── Carga admin — lógica preservada ──
  const loadAdmin = async () => {
    setLoading(true)
    const now = new Date(), som = new Date(now.getFullYear(), now.getMonth(), 1)
    const [s1, s2, s3, s4] = await Promise.all([
      sb.from('sales').select('total_price,profit_total,margin_percent,created_at').eq('status', 'APROVADA'),
      sb.from('products').select('id,date_added,brand,model,color,cost_brl_unit,price_current').eq('status', 'ATIVO'),
      sb.from('sales').select('*,product:products(brand,model),vendor:users(name)').eq('status', 'APROVADA').order('created_at', { ascending: false }).limit(7),
      sb.from('users').select('id,name').eq('role', 'VENDEDOR').eq('status', 'ATIVO'),
    ])
    const allS = s1.data || [], prods = (s2.data || []) as Product[]
    const thisMo = allS.filter((s: Sale) => new Date(s.created_at) >= som)
    const lastMo = allS.filter((s: Sale) => {
      const d = new Date(s.created_at)
      return d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) && d < som
    })
    const rev  = thisMo.reduce((a: number, x: Sale) => a + (x.total_price  || 0), 0)
    const prf  = thisMo.reduce((a: number, x: Sale) => a + (x.profit_total || 0), 0)
    const lrev = lastMo.reduce((a: number, x: Sale) => a + (x.total_price  || 0), 0)
    const lprf = lastMo.reduce((a: number, x: Sale) => a + (x.profit_total || 0), 0)
    const mg   = thisMo.length ? thisMo.reduce((a: number, x: Sale) => a + (x.margin_percent || 0), 0) / thisMo.length : 0
    setStats({ rev, prf, mg, salesCount: thisMo.length, stockCount: prods.length, lrev, lprf })
    setRecent((s3.data || []) as Sale[])
    setStale(prods.filter(p => dI(p.date_added || '') >= 15))
    const labels = [], revArr = [], prfArr = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      labels.push(d.toLocaleDateString('pt-BR', { month: 'short' }))
      const s = new Date(d.getFullYear(), d.getMonth(), 1)
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const f = allS.filter((x: Sale) => new Date(x.created_at) >= s && new Date(x.created_at) <= e)
      revArr.push(f.reduce((a: number, x: Sale) => a + (x.total_price  || 0), 0))
      prfArr.push(f.reduce((a: number, x: Sale) => a + (x.profit_total || 0), 0))
    }
    setChartData({ labels, rev: revArr, prf: prfArr })
    const vends = s4.data || []
    const rank = await Promise.all(vends.map(async (v: User) => {
      const { data } = await sb.from('sales').select('profit_total').eq('vendor_id', v.id).eq('status', 'APROVADA').gte('created_at', som.toISOString())
      return { ...v, p: (data || []).reduce((a: number, x: Sale) => a + (x.profit_total || 0), 0), c: (data || []).length }
    }))
    rank.sort((a, b) => b.p - a.p)
    setVRank(rank as (User & { p: number; c: number })[])
    setLoading(false)
  }

  const loadVendedor = async () => {
    if (!user) return
    setLoading(true)
    const now = new Date(), som = new Date(now.getFullYear(), now.getMonth(), 1)
    const [s1, s2, s3] = await Promise.all([
      sb.from('sales').select('profit_total,total_price,created_at').eq('vendor_id', user.id).eq('status', 'APROVADA').gte('created_at', som.toISOString()),
      sb.from('products').select('id').eq('status', 'ATIVO'),
      sb.from('sales').select('*,product:products(brand,model,color)').eq('vendor_id', user.id).eq('status', 'APROVADA').order('created_at', { ascending: false }).limit(10),
    ])
    const sales = s1.data || []
    setVendStats({
      rev:     sales.reduce((a: number, x: Sale) => a + (x.total_price  || 0), 0),
      prf:     sales.reduce((a: number, x: Sale) => a + (x.profit_total || 0), 0),
      count:   sales.length,
      estoque: (s2.data || []).length,
    })
    setVendSales((s3.data || []) as Sale[])
    setLoading(false)
  }

  // Chart.js — lógica preservada
  useEffect(() => {
    if (!chartData.labels.length || !isAdmin()) return
    const load = async () => {
      if (!window.Chart) {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
        document.head.appendChild(s)
        await new Promise(res => { s.onload = res })
      }
      if (!chartRef.current) return
      if (chartInst.current) (chartInst.current as { destroy: () => void }).destroy()
      chartInst.current = new window.Chart(chartRef.current, {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: [
            { label: 'Faturamento', data: chartData.rev, borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,.06)', tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: '#3B82F6', pointBorderWidth: 0 },
            { label: 'Lucro',       data: chartData.prf, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,.05)', tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: '#10B981', pointBorderWidth: 0 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#4A566E', font: { size: 11, family: 'Inter' }, boxWidth: 10, padding: 16 } } },
          scales: {
            x: { ticks: { color: '#2E3A4E', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.03)' }, border: { display: false } },
            y: { ticks: { color: '#2E3A4E', font: { size: 10 }, callback: (v: number) => v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : 'R$' + v }, grid: { color: 'rgba(255,255,255,.03)' }, border: { display: false } },
          },
        },
      })
    }
    load()
  }, [chartData, isAdmin])

  const delta = (c: number, p: number) => {
    if (!p) return null
    const pct = ((c - p) / p) * 100
    return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  // ── VENDEDOR ──
  if (!isAdmin()) return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { l: 'Faturamento Mês', v: fR(vendStats.rev),   c: 'var(--accent)',  icon: DollarSign  },
          { l: 'Comissão Mês',    v: fR(vendStats.prf),   c: 'var(--green)',   icon: TrendingUp  },
          { l: 'Vendas no Mês',   v: vendStats.count,     c: 'var(--purple)',  icon: ShoppingCart },
          { l: 'Em Estoque',      v: vendStats.estoque,   c: 'var(--yellow)',  icon: Package     },
        ].map(({ l, v, c, icon: Icon }) => (
          <div key={l} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <p className="stat-label">{l}</p>
              <Icon size={14} style={{ color: 'var(--text-4)' }} />
            </div>
            <p className="stat-value" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-1)' }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>Minhas Vendas Recentes</p>
          <button onClick={() => router.push('/dashboard/vendas')} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}>Ver todas <ArrowUpRight size={11} /></button>
        </div>
        <table>
          <thead><tr><th>Ref</th><th>Produto</th><th>Valor</th><th>Data</th></tr></thead>
          <tbody>
            {vendSales.map(s => (
              <tr key={s.id}>
                <td className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{s.reference || '—'}</td>
                <td style={{ fontWeight: 500 }}>{s.product?.brand} {s.product?.model}</td>
                <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{fR(s.total_price)}</td>
                <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(s.created_at)}</td>
              </tr>
            ))}
            {!vendSales.length && <tr><td colSpan={4}><div className="empty"><p className="empty-title">Nenhuma venda ainda</p></div></td></tr>}
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { l: 'Faturamento',   v: fR(stats.rev),          c: 'var(--accent)',  icon: DollarSign,   d: delta(stats.rev,  stats.lrev) },
          { l: 'Lucro',         v: fR(stats.prf),          c: 'var(--green)',   icon: TrendingUp,   d: delta(stats.prf,  stats.lprf) },
          { l: 'Margem Média',  v: fP(stats.mg),           c: 'var(--yellow)',  icon: BarChart2,    d: null },
          { l: 'Vendas',        v: stats.salesCount,        c: 'var(--purple)',  icon: ShoppingCart, d: null },
          { l: 'Em Estoque',    v: stats.stockCount,        c: 'var(--accent)',  icon: Package,      d: null },
        ].map(({ l, v, c, icon: Icon, d }) => (
          <div key={l} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <p className="stat-label">{l}</p>
              <Icon size={13} style={{ color: 'var(--text-4)' }} />
            </div>
            <p className="stat-value" style={{ color: c, fontSize: 22 }}>{v}</p>
            {d && (
              <p className={`stat-delta ${d.up ? 'delta-up' : 'delta-down'}`}>
                {d.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {d.pct}% vs mês ant.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Chart + Ranking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.06em' }}>Faturamento — Últimos 6 Meses</p>
          <div style={{ height: 160 }}><canvas ref={chartRef} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ flex: 1, padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Top Vendedores</p>
            {!vRank.length
              ? <p style={{ fontSize: 12, color: 'var(--text-4)' }}>Sem dados este mês</p>
              : vRank.slice(0, 4).map((v, i) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: i < 3 ? '1px solid var(--border-1)' : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, width: 14, color: rankColors[i] || 'var(--text-4)', textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{ini(v.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-4)' }}>{v.c} venda{v.c !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{fR(v.p)}</span>
                </div>
              ))}
          </div>
          {stale.length > 0 && (
            <div className="card" style={{ padding: '14px 16px', borderColor: 'rgba(245,158,11,.18)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={11} />Estoque Parado
              </p>
              {stale.slice(0, 3).map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-1)' }}>
                  <p style={{ fontSize: 11.5, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand} {p.model}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span className="badge" style={{ fontSize: 9.5 }} {...(dI(p.date_added || '') >= 25 ? { className: 'badge badge-red' } : { className: 'badge badge-yellow' })}>
                      {dI(p.date_added || '')}d
                    </span>
                    <button onClick={() => router.push('/dashboard/precos')} style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>IA →</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vendas recentes */}
      <div className="table-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-1)' }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>Vendas Recentes</p>
          <button onClick={() => router.push('/dashboard/vendas')} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}>Ver todas <ArrowUpRight size={11} /></button>
        </div>
        <table>
          <thead><tr><th>Ref</th><th>Produto</th><th>Vendedor</th><th>Valor</th><th>Lucro</th><th>Status</th><th>Data</th></tr></thead>
          <tbody>
            {recent.map(s => (
              <tr key={s.id}>
                <td className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{s.reference || '—'}</td>
                <td style={{ fontWeight: 500 }}>{s.product?.brand} {s.product?.model}</td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{s.vendor?.name || '—'}</td>
                <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{fR(s.total_price)}</td>
                <td className="mono" style={{ color: 'var(--green)' }}>{fR(s.profit_total || 0)}</td>
                <td><span className={`badge badge-${s.status === 'APROVADA' ? 'green' : s.status === 'PENDENTE' ? 'yellow' : 'red'}`}>{s.status}</span></td>
                <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(s.created_at)}</td>
              </tr>
            ))}
            {!recent.length && <tr><td colSpan={7}><div className="empty"><p className="empty-title">Nenhuma venda ainda</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
