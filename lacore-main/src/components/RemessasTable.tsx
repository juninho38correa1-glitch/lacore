'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Package, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react'
import { sb, fR, fD, callFn, BRANDS, MODELS, STORAGES, COLORS, CATS } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { Shipment, Product } from '@/lib/types'

interface ProdLine { brand: string; model: string; color: string; storage: string; condition: string; imei: string; qty: number; costUsd: number }

export default function RemessasTable() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [remessas, setRemessas] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [novaModal, setNovaModal] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [prodsByShip, setProdsByShip] = useState<Record<string, Product[]>>({})
  const [dolar, setDolar] = useState(5.8)
  const [dolarAuto, setDolarAuto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prodLines, setProdLines] = useState<ProdLine[]>([{ brand: 'Apple', model: '', color: 'Preto', storage: '128GB', condition: 'Novo', imei: '', qty: 1, costUsd: 0 }])
  const [shipForm, setShipForm] = useState({ reference: '', supplier: '', shipment_date: new Date().toISOString().split('T')[0], shipping_cost: '', insurance_cost: '', other_costs: '', notes: '' })
  const [specsLoadingIdx, setSpecsLoadingIdx] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('shipments').select('*').order('shipment_date', { ascending: false })
    setRemessas((data || []) as Shipment[])
    setLoading(false)
  }

  const buscarDolar = async () => {
    try {
      const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL')
      const d = await r.json()
      const v = parseFloat(d.USDBRL?.bid)
      if (v) { setDolar(v); setDolarAuto(true) }
    } catch { /* usa valor padrão */ }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (searchParams.get('nova') || novaModal) buscarDolar() }, [novaModal, searchParams])
  useEffect(() => { if (searchParams.get('nova')) setNovaModal(true) }, [searchParams])

  const addLine = () => setProdLines(p => [...p, { brand: 'Apple', model: '', color: 'Preto', storage: '128GB', condition: 'Novo', imei: '', qty: 1, costUsd: 0 }])
  const rmLine = (i: number) => { if (prodLines.length <= 1) { toast('Mínimo 1 produto', 'error'); return }; setProdLines(p => p.filter((_, j) => j !== i)) }
  const updLine = (i: number, k: keyof ProdLine, v: unknown) => setProdLines(p => { const n = [...p]; (n[i] as Record<string, unknown>)[k] = v; return n })

  const calcTotals = () => {
    const totalCostUsd = prodLines.reduce((a, p) => a + (p.costUsd * p.qty), 0)
    const extraBrl = parseFloat(shipForm.shipping_cost || '0') + parseFloat(shipForm.insurance_cost || '0') + parseFloat(shipForm.other_costs || '0')
    const totalBrl = totalCostUsd * dolar + extraBrl
    const qtd = prodLines.reduce((a, p) => a + p.qty, 0)
    const costPerUnit = qtd ? totalBrl / qtd : 0
    return { totalCostUsd, totalBrl, qtd, costPerUnit, extraBrl }
  }

  const save = async () => {
    if (!shipForm.reference) { toast('Referência é obrigatória', 'error'); return }
    if (prodLines.some(p => !p.model)) { toast('Preencha o modelo de todos os produtos', 'error'); return }
    setSaving(true)
    try {
      const { totalBrl, qtd } = calcTotals()
      const shipId = crypto.randomUUID()
      const { error: sErr } = await sb.from('shipments').insert({
        id: shipId, reference: shipForm.reference, supplier: shipForm.supplier, dollar_rate: dolar,
        shipping_cost: parseFloat(shipForm.shipping_cost || '0'),
        insurance_cost: parseFloat(shipForm.insurance_cost || '0'),
        other_costs: parseFloat(shipForm.other_costs || '0'),
        total_cost_brl: totalBrl, shipment_date: shipForm.shipment_date, notes: shipForm.notes, status: 'CHEGOU',
      })
      if (sErr) throw sErr
      const extraBrl = parseFloat(shipForm.shipping_cost || '0') + parseFloat(shipForm.insurance_cost || '0') + parseFloat(shipForm.other_costs || '0')
      const totalUsd = prodLines.reduce((a, p) => a + p.costUsd * p.qty, 0)
      for (const p of prodLines) {
        for (let i = 0; i < p.qty; i++) {
          const costU = totalUsd ? (p.costUsd * p.qty / totalUsd) * (totalUsd * dolar + extraBrl) / p.qty : 0
          await sb.from('products').insert({
            id: crypto.randomUUID(), shipment_id: shipId, brand: p.brand, model: p.model,
            category: CATS[p.brand] || 'Eletrônicos', color: p.color, storage: p.storage,
            condition: p.condition, imei: p.qty === 1 ? p.imei || null : null,
            cost_usd: p.costUsd, cost_brl_unit: Math.round(costU * 100) / 100,
            price_current: Math.ceil(costU * 1.48 / 10) * 10,
            price_min: Math.ceil(costU * 1.15 / 10) * 10,
            quantity: 1, status: 'ATIVO', date_added: new Date().toISOString(),
          })
        }
      }
      await sb.from('cashflow').insert({ id: crypto.randomUUID(), type: 'SAIDA', category: 'Importação', description: `Remessa ${shipForm.reference}`, amount: totalBrl, reference_id: shipId, reference_type: 'shipment', date: shipForm.shipment_date })
      toast(`Remessa ${shipForm.reference} cadastrada!`, 'success')
      setNovaModal(false)
      load()
    } catch { toast('Erro ao salvar remessa', 'error') }
    finally { setSaving(false) }
  }

  const loadProds = async (sid: string) => {
    if (prodsByShip[sid]) { setExpanded(expanded === sid ? null : sid); return }
    const { data } = await sb.from('products').select('*').eq('shipment_id', sid)
    setProdsByShip(p => ({ ...p, [sid]: (data || []) as Product[] }))
    setExpanded(sid)
  }

  const { totalCostUsd, totalBrl, qtd, costPerUnit } = calcTotals()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">{remessas.length} remessa(s)</span>
        <button onClick={() => setNovaModal(true)} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold">
          <Plus size={13} />Nova Remessa
        </button>
      </div>

      {loading ? <div className="flex justify-center p-16"><div className="spinner spinner-lg" /></div> : (
        <div className="space-y-3">
          {!remessas.length && <div className="card text-center py-10 text-gray-600">Nenhuma remessa cadastrada</div>}
          {remessas.map(r => (
            <div key={r.id} className="card p-0 overflow-hidden">
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/3 transition-colors" onClick={() => loadProds(r.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-white">{r.reference}</p>
                    <span className={`badge ${r.status === 'PROCESSADO' ? 'badge-green' : r.status === 'CHEGOU' ? 'badge-blue' : 'badge-yellow'}`}>{r.status}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-gray-500 text-xs">{r.supplier || '—'}</p>
                    <p className="text-gray-500 text-xs">Dólar: <span className="text-white">{fR(r.dollar_rate)}</span></p>
                    <p className="text-gray-500 text-xs">Total: <span className="text-cyan-300 font-semibold">{fR(r.total_cost_brl || 0)}</span></p>
                    {r.shipment_date && <p className="text-gray-500 text-xs">{fD(r.shipment_date)}</p>}
                  </div>
                </div>
                {expanded === r.id ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
              </div>
              {expanded === r.id && (
                <div className="border-t border-white/8">
                  <table>
                    <thead><tr><th>Produto</th><th>Cor</th><th>Storage</th><th>Cond.</th><th>Custo</th><th>Preço</th></tr></thead>
                    <tbody>
                      {(prodsByShip[r.id] || []).map(p => (
                        <tr key={p.id}>
                          <td className="text-white font-medium">{p.brand} {p.model}</td>
                          <td className="text-gray-400 text-xs">{p.color}</td>
                          <td className="text-gray-400 text-xs">{p.storage}</td>
                          <td><span className="badge badge-blue">{p.condition}</span></td>
                          <td className="font-mono text-xs text-gray-400">{fR(p.cost_brl_unit || 0)}</td>
                          <td className="font-mono text-cyan-300">{fR(p.price_current || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal nova remessa */}
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Remessa" size="xl">
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Cotação USD */}
          <div className="p-3 rounded-lg bg-cyan-500/8 border border-cyan-500/20 flex items-center justify-between">
            <span className="text-sm text-gray-300">Cotação USD: <strong className="text-cyan-300">{fR(dolar)}</strong></span>
            {dolarAuto && <span className="text-xs text-green-400">✓ Atualizado automaticamente</span>}
            <button onClick={buscarDolar} className="text-xs text-cyan-400 hover:underline">Atualizar</button>
          </div>
          {/* Dados da remessa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Referência *</label>
              <input value={shipForm.reference} onChange={e => setShipForm(f => ({ ...f, reference: e.target.value }))} placeholder="Ex: REM-001" className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Fornecedor</label>
              <input value={shipForm.supplier} onChange={e => setShipForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Nome do fornecedor" className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Data da Remessa</label>
              <input type="date" value={shipForm.shipment_date} onChange={e => setShipForm(f => ({ ...f, shipment_date: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Frete (R$)</label>
              <input type="number" value={shipForm.shipping_cost} onChange={e => setShipForm(f => ({ ...f, shipping_cost: e.target.value }))} placeholder="0" className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Seguro (R$)</label>
              <input type="number" value={shipForm.insurance_cost} onChange={e => setShipForm(f => ({ ...f, insurance_cost: e.target.value }))} placeholder="0" className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Outros custos (R$)</label>
              <input type="number" value={shipForm.other_costs} onChange={e => setShipForm(f => ({ ...f, other_costs: e.target.value }))} placeholder="0" className="text-sm" />
            </div>
          </div>
          {/* Produtos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Produtos</p>
              <button onClick={addLine} className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-gray-300 text-xs hover:bg-white/10">
                <Plus size={12} />Adicionar linha
              </button>
            </div>
            <div className="space-y-3">
              {prodLines.map((p, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/3 border border-white/8 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Marca</label>
                      <select value={p.brand} onChange={e => { updLine(i, 'brand', e.target.value); updLine(i, 'model', '') }} className="text-xs">
                        {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Modelo</label>
                      <select value={p.model} onChange={e => updLine(i, 'model', e.target.value)} className="text-xs">
                        <option value="">Selecione...</option>
                        {(MODELS[p.brand] || []).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Cor</label>
                      <select value={p.color} onChange={e => updLine(i, 'color', e.target.value)} className="text-xs">
                        {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Storage</label>
                      <select value={p.storage} onChange={e => updLine(i, 'storage', e.target.value)} className="text-xs">
                        {STORAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Condição</label>
                      <select value={p.condition} onChange={e => updLine(i, 'condition', e.target.value)} className="text-xs">
                        {['Novo','Seminovo A+','Seminovo A','Seminovo B'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Custo USD</label>
                      <input type="number" value={p.costUsd} onChange={e => updLine(i, 'costUsd', parseFloat(e.target.value) || 0)} className="text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Qtd</label>
                      <input type="number" min="1" value={p.qty} onChange={e => updLine(i, 'qty', parseInt(e.target.value) || 1)} className="text-xs" />
                    </div>
                    {p.qty === 1 && (
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">IMEI</label>
                        <input value={p.imei} onChange={e => updLine(i, 'imei', e.target.value)} placeholder="Opcional" className="text-xs" />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Custo BRL est.</label>
                      <p className="text-cyan-300 text-xs font-mono py-2">{fR(p.costUsd * dolar)}</p>
                    </div>
                  </div>
                  {prodLines.length > 1 && (
                    <button onClick={() => rmLine(i)} className="text-red-400 text-xs flex items-center gap-1 hover:text-red-300"><Trash2 size={11} />Remover</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Totais */}
          <div className="p-4 rounded-xl bg-white/3 border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div><p className="text-gray-500 text-xs">Produtos</p><p className="text-white font-bold">{qtd}</p></div>
            <div><p className="text-gray-500 text-xs">Total USD</p><p className="text-yellow-300 font-bold">${totalCostUsd.toFixed(2)}</p></div>
            <div><p className="text-gray-500 text-xs">Total BRL</p><p className="text-cyan-300 font-bold">{fR(totalBrl)}</p></div>
            <div><p className="text-gray-500 text-xs">Custo/un.</p><p className="text-green-400 font-bold">{fR(costPerUnit)}</p></div>
          </div>
        </div>
        <div className="p-4 border-t border-white/8 flex gap-2">
          <button onClick={() => setNovaModal(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 btn-primary py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Salvando...' : 'Cadastrar Remessa'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
