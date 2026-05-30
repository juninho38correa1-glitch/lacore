'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, CheckCircle, XCircle, RotateCcw, Search } from 'lucide-react'
import { sb, fR, fD } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { Sale, Product, Customer } from '@/lib/types'

export default function VendasTable() {
  const { user, isAdmin } = useAuth()
  const searchParams = useSearchParams()
  const [vendas, setVendas] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [novaModal, setNovaModal] = useState(false)
  const [prods, setProds] = useState<Product[]>([])
  const [clientes, setClientes] = useState<Customer[]>([])
  const [form, setForm] = useState({ product_id: '', customer_id: '', payment_method: 'PIX', notes: '', price: '' })
  const [saving, setSaving] = useState(false)
  const [selectedProd, setSelectedProd] = useState<Product | null>(null)

  const load = async () => {
    setLoading(true)
    const q = isAdmin()
      ? sb.from('sales').select('id,reference,product_id,vendor_id,customer_id,total_price,cost_brl_unit,profit_total,margin_percent,channel,notes,status,created_at,product:products(brand,model,color),customer:customers(name,phone)')
      : sb.from('sales').select('id,reference,product_id,vendor_id,customer_id,total_price,cost_brl_unit,profit_total,margin_percent,channel,notes,status,created_at,product:products(brand,model,color),customer:customers(name)').eq('vendor_id', user!.id)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
    if (error) console.error('Erro vendas:', error)
    setVendas((data || []) as Sale[])
    setLoading(false)
  }

  const loadNew = async () => {
    const [p, c] = await Promise.all([
      sb.from('products').select('id,brand,model,color,storage,condition,price_current,cost_brl_unit,price_min').eq('status', 'ATIVO').order('brand'),
      sb.from('customers').select('id,name,phone').order('name').limit(200),
    ])
    setProds((p.data || []) as Product[])
    setClientes((c.data || []) as Customer[])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (searchParams.get('nova')) { setNovaModal(true); loadNew() } }, [searchParams])

  const openNova = () => { loadNew(); setNovaModal(true); setForm({ product_id: '', customer_id: '', payment_method: 'PIX', notes: '', price: '' }); setSelectedProd(null) }

  const onProdSel = (id: string) => {
    const p = prods.find(x => x.id === id)
    setSelectedProd(p || null)
    setForm(f => ({ ...f, product_id: id, price: p?.price_current?.toString() || '' }))
  }

  const saveVenda = async () => {
    if (!form.product_id || !form.price) { toast('Produto e preço são obrigatórios', 'error'); return }
    setSaving(true)
    try {
      const total = parseFloat(form.price)
      const cost = selectedProd?.cost_brl_unit || 0
      const profit = total - cost
      const margin = cost ? (profit / total * 100) : 0
      const ref = 'VDA-' + Date.now().toString(36).toUpperCase()
      const saleId = crypto.randomUUID()
      const { error } = await sb.from('sales').insert({
        id: saleId, reference: ref,
        product_id: form.product_id, vendor_id: user!.id,
        customer_id: form.customer_id || null,
        total_price: total, cost_brl_unit: cost,
        profit_total: profit, margin_percent: margin,
        // channel omitido — ENUM restrito no banco notes: form.notes,
        status: 'APROVADA', // Banco não tem PENDENTE — vai direto APROVADA
      })
      if (error) throw error
      await sb.from('products').update({ status: 'VENDIDO' }).eq('id', form.product_id)
      // Registrar no cashflow com ENUM correto do banco
      await sb.from('cashflow').insert({
        id: crypto.randomUUID(),
        type: 'ENTRADA_VENDA',
        description: `Venda ${ref} — ${selectedProd?.brand} ${selectedProd?.model}`,
        amount: total,
        sale_id: saleId,
        created_by: user!.id,
        date: new Date().toISOString(),
      })
      toast(`Venda ${ref} registrada!`, 'success')
      setNovaModal(false); load()
    } catch (e) { console.error(e); toast('Erro ao registrar venda', 'error') }
    finally { setSaving(false) }
  }

  const estornar = async (id: string) => {
    const venda = vendas.find(v => v.id === id)
    if (!venda || !confirm(`Cancelar venda ${venda.reference}? O produto voltará ao estoque.`)) return
    await sb.from('products').update({ status: 'ATIVO' }).eq('id', venda.product_id)
    await sb.from('sales').update({ status: 'CANCELADA' }).eq('id', id)
    // Remover do cashflow
    await sb.from('cashflow').delete().eq('sale_id', venda.reference || '')
    toast('Venda cancelada', 'info')
    load()
  }

  // Agrupar produtos por brand+model para seleção limpa
  const prodsAgrupados = prods.reduce((acc, p) => {
    const key = `${p.brand} ${p.model} ${p.storage || ''} (${p.condition || ''})`
    if (!acc.find((x: Product) => x.id === p.id)) acc.push(p)
    return acc
  }, [] as Product[])

  const filtered = vendas.filter(v => !search || `${v.reference} ${v.product?.brand} ${v.product?.model}`.toLowerCase().includes(search.toLowerCase()))

  const badgeStatus = (s: string) => s === 'APROVADA' ? 'badge-green' : s === 'CANCELADA' ? 'badge-red' : 'badge-gray'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar venda..." style={{ paddingLeft: 32 }} />
        </div>
        <button className="btn btn-primary" onClick={openNova} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}>
          <Plus size={14} />Nova Venda
        </button>
      </div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Ref</th><th>Produto</th>{isAdmin() && <th>Cliente</th>}
              <th>Valor</th>{isAdmin() && <th>Lucro</th>}
              <th>Canal</th><th>Status</th><th>Data</th>
              {isAdmin() && <th></th>}
            </tr></thead>
            <tbody>
              {!filtered.length && <tr><td colSpan={9}><div className="empty"><p className="empty-title">Nenhuma venda encontrada</p></div></td></tr>}
              {filtered.map(v => (
                <tr key={v.id}>
                  <td className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{v.reference}</td>
                  <td style={{ fontWeight: 500 }}>
                    {v.product?.brand} {v.product?.model}
                    {v.product?.color && <span style={{ color: 'var(--text-4)', fontSize: 11, marginLeft: 4 }}>{v.product.color}</span>}
                  </td>
                  {isAdmin() && <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{v.customer?.name || '—'}</td>}
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{fR(v.total_price)}</td>
                  {isAdmin() && <td className="mono" style={{ color: 'var(--green)' }}>{fR(v.profit_total || 0)}</td>}
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{v.channel || '—'}</td>
                  <td><span className={`badge ${badgeStatus(v.status)}`}>{v.status}</span></td>
                  <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(v.created_at)}</td>
                  {isAdmin() && (
                    <td>{v.status === 'APROVADA' && (
                      <button onClick={() => estornar(v.id)} className="btn btn-ghost btn-icon-sm" title="Cancelar" style={{ color: 'var(--yellow)' }}><RotateCcw size={13} /></button>
                    )}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Venda" size="md">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Produto *</label>
            <select value={form.product_id} onChange={e => onProdSel(e.target.value)}>
              <option value="">Selecione o produto...</option>
              {prodsAgrupados.map(p => (
                <option key={p.id} value={p.id}>{p.brand} {p.model} — {p.color} {p.storage} ({p.condition})</option>
              ))}
            </select>
          </div>
          {selectedProd && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 8, fontSize: 12 }}>
              Sugerido: <strong style={{ color: 'var(--accent)' }}>{fR(selectedProd.price_current || 0)}</strong>
              {selectedProd.price_min ? <> · Mín: <strong style={{ color: 'var(--yellow)' }}>{fR(selectedProd.price_min)}</strong></> : ''}
            </div>
          )}
          <div><label className="label">Preço de Venda (R$) *</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" /></div>
          <div><label className="label">Cliente (opcional)</label>
            <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
              <option value="">Sem cliente vinculado</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
            </select>
          </div>
          <div><label className="label">Forma de Pagamento</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              {['PIX','Dinheiro','Cartão Crédito','Cartão Débito','Transferência','Outro'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Observações</label><textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' }} /></div>
          {selectedProd && form.price && (
            <div style={{ padding: '10px 12px', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--text-4)' }}>Lucro estimado</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{fR(parseFloat(form.price) - (selectedProd.cost_brl_unit || 0))}</p>
              <p style={{ fontSize: 11, color: 'var(--text-4)' }}>Margem: {selectedProd.cost_brl_unit ? ((parseFloat(form.price) - selectedProd.cost_brl_unit) / parseFloat(form.price) * 100).toFixed(1) : '—'}%</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={() => setNovaModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={saveVenda} disabled={saving}>
              {saving ? 'Salvando...' : 'Registrar Venda'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
