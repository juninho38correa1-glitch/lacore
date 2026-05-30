'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react'
import { sb, fR, fD, callFn, BRANDS, STORAGES, COLORS, CATS } from '@/lib/supabase'
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
  const [dolar, setDolar] = useState('')  // Campo aberto — sem valor padrão
  const [dolarAuto, setDolarAuto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prodsCadastrados, setProdsCadastrados] = useState<{brand:string,model:string}[]>([])
  const [prodLines, setProdLines] = useState<ProdLine[]>([
    { brand: 'Apple', model: '', color: 'Preto', storage: '128GB', condition: 'Novo', imei: '', qty: 1, costUsd: 0 }
  ])
  const [shipForm, setShipForm] = useState({ reference: '', supplier: '', shipment_date: new Date().toISOString().split('T')[0], shipping_cost: '', insurance_cost: '', other_costs: '', notes: '' })

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('shipments').select('*').order('shipment_date', { ascending: false })
    setRemessas((data || []) as Shipment[])
    setLoading(false)
  }

  const buscarProdutosCadastrados = async () => {
    const { data } = await sb.from('products').select('brand,model').order('brand').order('model')
    const unicos: {brand:string,model:string}[] = []
    const seen = new Set<string>()
    ;(data || []).forEach((p: {brand:string,model:string}) => {
      const k = `${p.brand}||${p.model}`
      if (!seen.has(k)) { seen.add(k); unicos.push(p) }
    })
    setProdsCadastrados(unicos)
  }

  const buscarDolar = async () => {
    try {
      const r = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL')
      const d = await r.json()
      const v = parseFloat(d.USDBRL?.bid)
      if (v) { setDolar(v.toFixed(2)); setDolarAuto(true); toast(`Cotação atualizada: ${fR(v)}`, 'success') }
    } catch { toast('Não foi possível buscar cotação automática', 'error') }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (searchParams.get('nova')) setNovaModal(true) }, [searchParams])
  useEffect(() => { if (novaModal) buscarProdutosCadastrados() }, [novaModal])

  const addLine = () => setProdLines(p => [...p, { brand: 'Apple', model: '', color: 'Preto', storage: '128GB', condition: 'Novo', imei: '', qty: 1, costUsd: 0 }])
  const rmLine = (i: number) => { if (prodLines.length <= 1) return; setProdLines(p => p.filter((_, j) => j !== i)) }
  const updLine = (i: number, k: keyof ProdLine, v: unknown) => setProdLines(p => { const n = [...p]; (n[i] as Record<string, unknown>)[k] = v; return n })

  const dolarVal = parseFloat(dolar.replace(',', '.')) || 0

  const calcTotals = () => {
    const totalUsd = prodLines.reduce((a, p) => a + (p.costUsd * p.qty), 0)
    const extra = parseFloat(shipForm.shipping_cost || '0') + parseFloat(shipForm.insurance_cost || '0') + parseFloat(shipForm.other_costs || '0')
    const totalBrl = totalUsd * dolarVal + extra
    const qtd = prodLines.reduce((a, p) => a + p.qty, 0)
    return { totalUsd, totalBrl, qtd, costPerUnit: qtd ? totalBrl / qtd : 0, extra }
  }

  const save = async () => {
    if (!shipForm.reference) { toast('Referência é obrigatória', 'error'); return }
    if (!dolarVal) { toast('Informe a cotação do dólar', 'error'); return }
    if (prodLines.some(p => !p.model.trim())) { toast('Preencha o modelo de todos os produtos', 'error'); return }
    setSaving(true)
    try {
      const { totalBrl, totalUsd, extra } = calcTotals()
      const shipId = crypto.randomUUID()
      await sb.from('shipments').insert({
        id: shipId, reference: shipForm.reference, supplier: shipForm.supplier,
        dollar_rate: dolarVal,
        shipping_cost: parseFloat(shipForm.shipping_cost || '0'),
        insurance_cost: parseFloat(shipForm.insurance_cost || '0'),
        other_costs: parseFloat(shipForm.other_costs || '0'),
        total_cost_brl: totalBrl, shipment_date: shipForm.shipment_date,
        notes: shipForm.notes, status: 'CHEGOU',
      })
      for (const p of prodLines) {
        for (let i = 0; i < p.qty; i++) {
          const costU = totalUsd ? (p.costUsd / totalUsd) * (totalUsd * dolarVal + extra) : 0
          await sb.from('products').insert({
            id: crypto.randomUUID(), shipment_id: shipId,
            brand: p.brand, model: p.model.trim(),
            category: CATS[p.brand] || 'Eletrônicos',
            color: p.color, storage: p.storage, condition: p.condition,
            imei: p.qty === 1 ? p.imei || null : null,
            cost_usd: p.costUsd, cost_brl_unit: Math.round(costU * 100) / 100,
            price_current: Math.ceil(costU * 1.48 / 10) * 10,
            price_min: Math.ceil(costU * 1.15 / 10) * 10,
            quantity: 1, status: 'ATIVO', date_added: new Date().toISOString(),
          })
        }
      }
      await sb.from('cashflow').insert({ id: crypto.randomUUID(), type: 'SAIDA', category: 'Importação', description: `Remessa ${shipForm.reference}`, amount: totalBrl, reference_id: shipId, reference_type: 'shipment', date: shipForm.shipment_date })
      toast(`Remessa ${shipForm.reference} cadastrada!`, 'success')
      setNovaModal(false); load()
    } catch (e) { console.error(e); toast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  const loadProds = async (sid: string) => {
    if (expanded === sid) { setExpanded(null); return }
    if (!prodsByShip[sid]) {
      const { data } = await sb.from('products').select('*').eq('shipment_id', sid)
      setProdsByShip(p => ({ ...p, [sid]: (data || []) as Product[] }))
    }
    setExpanded(sid)
  }

  const { totalUsd, totalBrl, qtd, costPerUnit } = calcTotals()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setNovaModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} />Nova Remessa
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!remessas.length && <div className="empty"><p className="empty-title">Nenhuma remessa cadastrada</p></div>}
          {remessas.map(r => (
            <div key={r.id} className="card-flat">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }} onClick={() => loadProds(r.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-1)' }}>{r.reference}</span>
                    <span className={`badge badge-${r.status === 'PROCESSADO' ? 'green' : r.status === 'CHEGOU' ? 'blue' : 'yellow'}`}>{r.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {r.supplier && <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{r.supplier}</span>}
                    <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>USD: <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{fR(r.dollar_rate)}</b></span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Total: <b style={{ color: 'var(--accent)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fR(r.total_cost_brl || 0)}</b></span>
                    {r.shipment_date && <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{fD(r.shipment_date)}</span>}
                  </div>
                </div>
                {expanded === r.id ? <ChevronUp size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />}
              </div>
              {expanded === r.id && (
                <div style={{ borderTop: '1px solid var(--border-1)' }}>
                  <table>
                    <thead><tr><th>Produto</th><th>Cor</th><th>Storage</th><th>Cond.</th><th>Custo BRL</th><th>Preço</th></tr></thead>
                    <tbody>
                      {(prodsByShip[r.id] || []).map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{p.brand} {p.model}</td>
                          <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{p.color}</td>
                          <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{p.storage}</td>
                          <td><span className="badge badge-blue">{p.condition}</span></td>
                          <td className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{fR(p.cost_brl_unit || 0)}</td>
                          <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{fR(p.price_current || 0)}</td>
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

      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Remessa" size="xl">
        <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cotação USD — campo manual + botão auto */}
          <div style={{ padding: '12px 14px', background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Cotação USD (R$)</label>
              <input
                type="number"
                step="0.01"
                value={dolar}
                onChange={e => { setDolar(e.target.value); setDolarAuto(false) }}
                placeholder="Ex: 5.85"
                style={{ marginTop: 4 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-sm" onClick={buscarDolar} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <RefreshCw size={11} />Buscar automático
              </button>
              {dolarAuto && <span style={{ fontSize: 10.5, color: 'var(--green)' }}>✓ Atualizado</span>}
            </div>
          </div>

          {/* Dados da remessa */}
          <div className="form-grid-2" style={{ gap: 12 }}>
            <div><label className="label">Referência *</label><input value={shipForm.reference} onChange={e => setShipForm(f => ({ ...f, reference: e.target.value }))} placeholder="Ex: REM-001" /></div>
            <div><label className="label">Fornecedor</label><input value={shipForm.supplier} onChange={e => setShipForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Nome do fornecedor" /></div>
            <div><label className="label">Data</label><input type="date" value={shipForm.shipment_date} onChange={e => setShipForm(f => ({ ...f, shipment_date: e.target.value }))} /></div>
            <div><label className="label">Frete (R$)</label><input type="number" value={shipForm.shipping_cost} onChange={e => setShipForm(f => ({ ...f, shipping_cost: e.target.value }))} placeholder="0" /></div>
            <div><label className="label">Seguro (R$)</label><input type="number" value={shipForm.insurance_cost} onChange={e => setShipForm(f => ({ ...f, insurance_cost: e.target.value }))} placeholder="0" /></div>
            <div><label className="label">Outros custos (R$)</label><input type="number" value={shipForm.other_costs} onChange={e => setShipForm(f => ({ ...f, other_costs: e.target.value }))} placeholder="0" /></div>
          </div>

          {/* Produtos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)' }}>Produtos</p>
              <button className="btn btn-secondary btn-sm" onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} />Adicionar linha</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {prodLines.map((p, i) => (
                <div key={i} style={{ padding: 12, background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10 }}>
                  <div className="form-grid-3" style={{ gap: 8, marginBottom: 8 }}>
                    <div>
                      <label className="label" style={{ fontSize: 9.5 }}>Marca</label>
                      <select value={p.brand} onChange={e => updLine(i, 'brand', e.target.value)} style={{ fontSize: 12 }}>
                        {BRANDS.map(b => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 9.5 }}>Modelo *</label>
                      <input
                        list={`models-${i}`}
                        value={p.model}
                        onChange={e => updLine(i, 'model', e.target.value)}
                        placeholder="Digite ou selecione..."
                        style={{ fontSize: 12 }}
                      />
                      <datalist id={`models-${i}`}>
                        {prodsCadastrados.filter(x => x.brand === p.brand).map((x, j) => (
                          <option key={j} value={x.model} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 9.5 }}>Cor</label>
                      <select value={p.color} onChange={e => updLine(i, 'color', e.target.value)} style={{ fontSize: 12 }}>
                        {COLORS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 9.5 }}>Storage</label>
                      <select value={p.storage} onChange={e => updLine(i, 'storage', e.target.value)} style={{ fontSize: 12 }}>
                        {STORAGES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 9.5 }}>Condição</label>
                      <select value={p.condition} onChange={e => updLine(i, 'condition', e.target.value)} style={{ fontSize: 12 }}>
                        {['Novo','Seminovo A+','Seminovo A','Seminovo B'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 9.5 }}>Custo USD</label>
                      <input type="number" value={p.costUsd} onChange={e => updLine(i, 'costUsd', parseFloat(e.target.value) || 0)} style={{ fontSize: 12 }} />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: 9.5 }}>Qtd</label>
                      <input type="number" min="1" value={p.qty} onChange={e => updLine(i, 'qty', parseInt(e.target.value) || 1)} style={{ fontSize: 12 }} />
                    </div>
                    {p.qty === 1 && (
                      <div>
                        <label className="label" style={{ fontSize: 9.5 }}>IMEI</label>
                        <input value={p.imei} onChange={e => updLine(i, 'imei', e.target.value)} placeholder="Opcional" style={{ fontSize: 12 }} />
                      </div>
                    )}
                    <div>
                      <label className="label" style={{ fontSize: 9.5 }}>Custo BRL est.</label>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', paddingTop: 10, fontVariantNumeric: 'tabular-nums' }}>{dolarVal ? fR(p.costUsd * dolarVal) : '—'}</p>
                    </div>
                  </div>
                  {prodLines.length > 1 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => rmLine(i)} style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Trash2 size={11} />Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totais */}
          <div className="form-grid-2" style={{ gap: 10, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10, textAlign: 'center' }}>
            {[
              ['Produtos', qtd, 'var(--text-1)'],
              ['Total USD', `$${totalUsd.toFixed(2)}`, 'var(--yellow)'],
              ['Total BRL', fR(totalBrl), 'var(--accent)'],
              ['Custo/un.', fR(costPerUnit), 'var(--green)'],
            ].map(([l, v, c]) => (
              <div key={l as string}>
                <p style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{l}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: c as string, fontVariantNumeric: 'tabular-nums' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-1)', display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={() => setNovaModal(false)}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar Remessa'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
