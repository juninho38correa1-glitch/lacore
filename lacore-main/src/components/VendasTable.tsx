'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, CheckCircle, XCircle, RotateCcw, Search } from 'lucide-react'
import { sb, fR, fD, callFn } from '@/lib/supabase'
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
      ? sb.from('sales').select('*,product:products(brand,model,color),vendor:users(name),customer:customers(name,phone)')
      : sb.from('sales').select('*,product:products(brand,model,color),customer:customers(name)').eq('vendor_id', user!.id)
    const { data } = await q.order('created_at', { ascending: false }).limit(100)
    setVendas((data || []) as Sale[])
    setLoading(false)
  }

  const loadNew = async () => {
    const [p, c] = await Promise.all([
      sb.from('products').select('id,brand,model,color,storage,condition,price_current,cost_brl_unit').eq('status', 'ATIVO').order('brand'),
      sb.from('customers').select('id,name,phone').order('name').limit(100),
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
      const { error } = await sb.from('sales').insert({
        id: crypto.randomUUID(), reference: ref, product_id: form.product_id, vendor_id: user!.id, customer_id: form.customer_id || null,
        total_price: total, cost_brl_unit: cost, profit_total: profit, margin_percent: margin,
        payment_method: form.payment_method, notes: form.notes, status: 'PENDENTE',
      })
      if (error) throw error
      await sb.from('products').update({ status: 'VENDIDO' }).eq('id', form.product_id)
      toast(`Venda ${ref} registrada!`, 'success')
      setNovaModal(false)
      load()
    } catch { toast('Erro ao registrar venda', 'error') }
    finally { setSaving(false) }
  }

  const validar = async (id: string, action: 'APROVADA' | 'ESTORNADA') => {
    const venda = vendas.find(v => v.id === id)
    if (!venda) return
    if (action === 'ESTORNADA') {
      if (!confirm(`Estornar venda ${venda.reference}? O produto voltará ao estoque.`)) return
      await sb.from('products').update({ status: 'ATIVO' }).eq('id', venda.product_id)
      await sb.from('commissions').update({ status: 'CANCELADA' }).eq('sale_id', id)
      await sb.from('cashflow').delete().eq('reference_id', id)
    } else {
      const commission = venda.profit_total ? venda.profit_total * 0.1 : 0
      await sb.from('commissions').insert({ id: crypto.randomUUID(), vendor_id: venda.vendor_id, sale_id: id, amount: commission, status: 'PENDENTE' })
      await sb.from('cashflow').insert({ id: crypto.randomUUID(), type: 'ENTRADA', category: 'Venda', description: `${venda.reference} - Venda aprovada`, amount: venda.total_price, reference_id: id, reference_type: 'sale', date: new Date().toISOString().split('T')[0] })
    }
    await sb.from('sales').update({ status: action }).eq('id', id)
    toast(action === 'APROVADA' ? 'Venda aprovada!' : 'Venda estornada', action === 'APROVADA' ? 'success' : 'info')
    load()
  }

  const filtered = vendas.filter(v => !search || `${v.reference} ${v.product?.brand} ${v.product?.model} ${v.vendor?.name}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar venda..." className="pl-9 text-sm" />
        </div>
        <button onClick={openNova} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold">
          <Plus size={13} />Nova Venda
        </button>
      </div>

      {loading ? <div className="flex justify-center p-16"><div className="spinner spinner-lg" /></div> : (
        <div className="card p-0 overflow-hidden">
          <table>
            <thead><tr>
              <th>Ref</th><th>Produto</th>{isAdmin() && <th>Vendedor</th>}<th>Cliente</th>
              <th>Valor</th>{isAdmin() && <th>Lucro</th>}<th>Status</th><th>Data</th>
              {isAdmin() && <th></th>}
            </tr></thead>
            <tbody>
              {!filtered.length && <tr><td colSpan={9} className="text-center py-10 text-gray-600">Nenhuma venda</td></tr>}
              {filtered.map(v => (
                <tr key={v.id}>
                  <td className="font-mono text-xs text-gray-400">{v.reference}</td>
                  <td className="font-semibold text-white">{v.product?.brand} {v.product?.model} <span className="text-gray-500 text-xs">{v.product?.color}</span></td>
                  {isAdmin() && <td className="text-gray-400 text-xs">{v.vendor?.name}</td>}
                  <td className="text-gray-400 text-xs">{v.customer?.name || '—'}</td>
                  <td className="font-mono font-semibold text-cyan-300">{fR(v.total_price)}</td>
                  {isAdmin() && <td className="font-mono text-green-400 text-xs">{fR(v.profit_total || 0)}</td>}
                  <td>
                    <span className={`badge ${v.status === 'APROVADA' ? 'badge-green' : v.status === 'PENDENTE' ? 'badge-yellow' : 'badge-red'}`}>{v.status}</span>
                  </td>
                  <td className="text-gray-500 text-xs">{fD(v.created_at)}</td>
                  {isAdmin() && (
                    <td>
                      <div className="flex items-center gap-1">
                        {v.status === 'PENDENTE' && <>
                          <button onClick={() => validar(v.id, 'APROVADA')} className="p-1.5 rounded hover:bg-green-500/15 text-gray-400 hover:text-green-400 transition-colors" title="Aprovar"><CheckCircle size={13} /></button>
                          <button onClick={() => validar(v.id, 'ESTORNADA')} className="p-1.5 rounded hover:bg-red-500/15 text-gray-400 hover:text-red-400 transition-colors" title="Rejeitar"><XCircle size={13} /></button>
                        </>}
                        {v.status === 'APROVADA' && (
                          <button onClick={() => validar(v.id, 'ESTORNADA')} className="p-1.5 rounded hover:bg-orange-500/15 text-gray-400 hover:text-orange-400 transition-colors" title="Estornar"><RotateCcw size={13} /></button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Venda" size="md">
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Produto *</label>
            <select value={form.product_id} onChange={e => onProdSel(e.target.value)} className="text-sm">
              <option value="">Selecione o produto...</option>
              {prods.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} — {p.color} {p.storage} ({p.condition})</option>)}
            </select>
          </div>
          {selectedProd && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300">
              Preço sugerido: <strong className="text-cyan-300">{fR(selectedProd.price_current || 0)}</strong> · Mín: <strong className="text-yellow-300">{fR(selectedProd.price_min || 0)}</strong>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Preço de Venda (R$) *</label>
            <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Ex: 1499" className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Cliente (opcional)</label>
            <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="text-sm">
              <option value="">Sem cliente vinculado</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `— ${c.phone}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Forma de Pagamento</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="text-sm">
              {['PIX','Dinheiro','Cartão Crédito','Cartão Débito','Transferência','Outro'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Observações</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observações da venda..." className="text-sm resize-none" />
          </div>
          {selectedProd && form.price && (
            <div className="p-3 rounded-lg bg-green-500/8 border border-green-500/20 text-xs">
              <p className="text-gray-400">Lucro estimado:</p>
              <p className="text-green-400 font-semibold text-base">{fR(parseFloat(form.price) - (selectedProd.cost_brl_unit || 0))}</p>
              <p className="text-gray-500">Margem: {selectedProd.cost_brl_unit ? ((parseFloat(form.price) - selectedProd.cost_brl_unit) / parseFloat(form.price) * 100).toFixed(1) : '—'}%</p>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setNovaModal(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-sm">Cancelar</button>
            <button onClick={saveVenda} disabled={saving} className="flex-1 btn-primary py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50">
              {saving ? 'Salvando...' : 'Registrar Venda'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
