'use client'
import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, CheckCircle, X, Trash2, AlertTriangle } from 'lucide-react'
import { sb, fR, fD } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'

interface CatalogProduct {
  id: string; brand: string; model: string; storage: string; color: string; condition: string
  processor?: string; ram?: string
}

interface Shipment {
  id: string; reference: string; description: string
  travel_date: string; exchange_rate: number
  travel_cost_brl: number; other_costs_brl: number
  status: 'ABERTA' | 'FECHADA' | 'CANCELADA'; notes: string
  created_at: string; items?: ShipmentItem[]
}
interface ShipmentItem {
  id: string; shipment_id: string
  brand: string; model: string; storage: string; color: string; condition: string
  quantity: number; cost_usd: number; cost_brl: number; cost_brl_unit: number
  price_sale: number; price_min: number
  status: string; product_ids: string[]
}

const BRANDS     = ['Apple','Samsung','Xiaomi','Motorola','LG','Outro']
const STORAGES   = ['32GB','64GB','128GB','256GB','512GB','1TB']
const COLORS_BY_BRAND: Record<string, string[]> = {
  'Apple':    ['Preto', 'Branco', 'Prata', 'Meia-Noite', 'Estelar', 'Azul', 'Verde', 'Rosa', 'Roxo', 'Amarelo', 'Vermelho', 'Ultramarino', 'Verde-Acinzentado', 'Azul Claro', 'Lavanda', 'Azul-Céu', 'Dourado-Claro', 'Branco-Nuvem', 'Preto-Espacial', 'Laranja-Cósmico', 'Azul-Intenso', 'Prateado', 'Titânio Natural', 'Titânio Preto', 'Titânio Branco', 'Titânio Deserto'],
  'Samsung':  ['Preto', 'Branco', 'Prata', 'Cinza', 'Azul', 'Verde', 'Roxo', 'Amarelo', 'Vermelho', 'Azul Marinho', 'Azul Escuro', 'Verde Escuro', 'Verde Menta', 'Dourado', 'Rose Gold', 'Creme', 'Grafite', 'Coral', 'Lavanda'],
  'Xiaomi':   ['Preto', 'Branco', 'Prata', 'Cinza', 'Azul', 'Verde', 'Roxo', 'Amarelo', 'Vermelho', 'Azul Marinho', 'Verde Escuro', 'Verde Menta', 'Dourado', 'Rose Gold', 'Coral'],
  'Motorola': ['Preto', 'Branco', 'Prata', 'Cinza', 'Azul', 'Verde', 'Roxo', 'Vermelho', 'Dourado', 'Rose Gold', 'Coral'],
  'LG':       ['Preto', 'Branco', 'Prata', 'Cinza', 'Azul', 'Verde', 'Vermelho', 'Dourado'],
  'Outro':    ['Preto', 'Branco', 'Prata', 'Cinza', 'Azul', 'Verde', 'Roxo', 'Amarelo', 'Vermelho', 'Dourado', 'Rose Gold', 'Outro'],
}
const getCores = (brand: string) => COLORS_BY_BRAND[brand] || COLORS_BY_BRAND['Outro']
const CONDITIONS = ['Novo','Seminovo A+','Seminovo A','Seminovo B']

export default function RemessasPage() {
  const { user } = useAuth()
  const [remessas, setRemessas]     = useState<Shipment[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [novaModal, setNovaModal]   = useState(false)
  const [fecharModal, setFecharModal] = useState<Shipment | null>(null)
  const [saving, setSaving]         = useState(false)
  const [modelosSugeridos, setModelosSugeridos] = useState<string[]>([])
  const [catalogProdutos, setCatalogProdutos] = useState<CatalogProduct[]>([])

  // Form nova remessa
  const [form, setForm] = useState({
    description: '',
    travel_date: new Date().toISOString().split('T')[0],
    exchange_rate: '',
    travel_cost_brl: '0',
    other_costs_brl: '0',
    notes: '',
  })

  // Itens da remessa — 1 linha por modelo/cor/condição
  const emptyItem = () => ({
    brand: 'Xiaomi', model: '', storage: '128GB',
    color: 'Preto', condition: 'Novo',
    quantity: 1, cost_usd: 0, price_sale: 0, price_min: 0,
  })
  const [itens, setItens] = useState([emptyItem()])

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('shipments').select('*').order('created_at', { ascending: false })
    const ships = (data || []) as Shipment[]
    if (ships.length) {
      const ids = ships.map(s => s.id)
      const { data: items } = await sb.from('shipment_items').select('*').in('shipment_id', ids).order('id')
      ships.forEach(s => { s.items = (items || []).filter((i: ShipmentItem) => i.shipment_id === s.id) })
    }
    setRemessas(ships)
    setLoading(false)
  }

  const loadModelos = (brand: string) => {
    const uniq = [...new Set(catalogProdutos.filter(p => p.brand === brand).map(p => p.model))]
    setModelosSugeridos(uniq)
  }

  // Atualizar sugestões quando catálogo carrega
  useEffect(() => {
    if (catalogProdutos.length && itens[0]?.brand) loadModelos(itens[0].brand)
  }, [catalogProdutos])

  // Ao selecionar modelo, preencher storage/cor/condição e atualizar sugestões
  const onModeloSel = (idx: number, modelo: string, brand: string) => {
    const cat = catalogProdutos.find(p => p.brand === brand && p.model === modelo)
    setItens(prev => prev.map((x, i) => {
      if (i !== idx) return x
      return { ...x, model: modelo, storage: cat?.storage || x.storage, color: cat?.color || x.color, condition: cat?.condition || x.condition }
    }))
  }

  // Storages e cores disponíveis por modelo
  const getStoragesDo = (brand: string, model: string) => {
    return [...new Set(catalogProdutos.filter(p => p.brand === brand && p.model === model).map(p => p.storage))]
  }
  const getCoresDo = (brand: string, model: string, storage: string) => {
    return [...new Set(catalogProdutos.filter(p => p.brand === brand && p.model === model && p.storage === storage).map(p => p.color))]
  }

  useEffect(() => { load(); loadCatalog() }, [])

  const loadCatalog = async () => {
    const { data } = await sb.from('product_catalog').select('*').order('brand').order('model')
    setCatalogProdutos((data || []) as CatalogProduct[])
  }

  // ── Cálculo de custos ──────────────────────────────────────
  const exRate      = parseFloat(form.exchange_rate   || '0')
  const travelCost  = parseFloat(form.travel_cost_brl || '0')
  const otherCost   = parseFloat(form.other_costs_brl || '0')
  const totalCustoExtra = travelCost + otherCost
  const totalUSD    = itens.reduce((a, it) => a + (it.quantity * (it.cost_usd || 0)), 0)
  const totalBRL    = totalUSD * exRate + totalCustoExtra

  const calcCustoUnit = (it: typeof itens[0]) => {
    const costBRL   = (it.cost_usd || 0) * exRate
    const totalBase = itens.reduce((a, x) => a + x.quantity * (x.cost_usd || 0), 0)
    const share     = totalBase > 0 ? ((it.cost_usd || 0) / totalBase) * (totalCustoExtra / (it.quantity || 1)) : 0
    return costBRL + share
  }

  // ── Salvar remessa ─────────────────────────────────────────
  const salvarRemessa = async () => {
    if (!form.exchange_rate) { toast('Informe o câmbio do dia', 'error'); return }
    if (itens.some(it => !it.model)) { toast('Preencha o modelo de todos os itens', 'error'); return }
    setSaving(true)
    try {
      const ref  = 'REM-' + Date.now().toString(36).toUpperCase().slice(-5)
      const desc = form.description ||
        `Remessa ${new Date(form.travel_date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`

      const shipId = crypto.randomUUID()
      const { error } = await sb.from('shipments').insert({
        id: shipId, reference: ref, description: desc,
        travel_date: form.travel_date, exchange_rate: exRate,
        travel_cost_brl: travelCost, other_costs_brl: otherCost,
        notes: form.notes || null, status: 'ABERTA', created_by: user?.id,
      })
      if (error) throw error

      for (const it of itens) {
        const costUnit = calcCustoUnit(it)
        const costBRL  = (it.cost_usd || 0) * exRate * it.quantity
        await sb.from('shipment_items').insert({
          id: crypto.randomUUID(), shipment_id: shipId,
          brand: it.brand, model: it.model, storage: it.storage,
          color: it.color, condition: it.condition, quantity: it.quantity,
          cost_usd: it.cost_usd, cost_brl: costBRL, cost_brl_unit: costUnit,
          price_sale: it.price_sale || 0, price_min: it.price_min || 0,
          status: 'PENDENTE', product_ids: [],
        })
      }

      toast(`Remessa ${ref} criada! Defina os preços e feche para entrar no estoque.`, 'success')
      setNovaModal(false)
      setForm({ description: '', travel_date: new Date().toISOString().split('T')[0], exchange_rate: '', travel_cost_brl: '0', other_costs_brl: '0', notes: '' })
      setItens([emptyItem()])
      load()
    } catch (e) { console.error(e); toast('Erro ao salvar remessa', 'error') }
    finally { setSaving(false) }
  }

  // ── Fechar remessa → cria produtos no estoque ──────────────
  const fecharRemessa = async (ship: Shipment) => {
    if (!ship.items?.length) { toast('Remessa sem itens', 'error'); return }
    const semPreco = ship.items.filter(it => !it.price_sale)
    if (semPreco.length) { toast(`Defina o preço de venda de: ${semPreco.map(i => i.model).join(', ')}`, 'error'); return }
    setSaving(true)
    try {
      for (const it of ship.items) {
        const pids: string[] = []
        // Buscar catalog_id para vincular
        const { data: catItem } = await sb.from('product_catalog')
          .select('id')
          .eq('brand', it.brand).eq('model', it.model)
          .eq('storage', it.storage || '').eq('color', it.color || '')
          .eq('condition', it.condition || 'Novo')
          .maybeSingle()
        const catalogId = catItem?.id || null

        // Buscar produto existente no estoque
        const { data: existing } = await sb.from('products')
          .select('id')
          .eq('brand', it.brand).eq('model', it.model)
          .eq('storage', it.storage).eq('color', it.color)
          .eq('condition', it.condition).eq('status', 'ATIVO')
          .limit(1).single()

        if (existing) {
          // Produto já existe → só atualiza preço e custo se necessário
          await sb.from('products').update({
            cost_brl_unit: it.cost_brl_unit,
            price_current: it.price_sale,
            price_min: it.price_min,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)
          // Criar entradas adicionais para as unidades extras
          for (let i = 0; i < it.quantity; i++) {
            const pid = crypto.randomUUID()
            await sb.from('products').insert({
              id: pid, brand: it.brand, model: it.model,
              storage: it.storage, color: it.color, condition: it.condition,
              cost_usd: it.cost_usd, cost_brl_unit: it.cost_brl_unit,
              price_current: it.price_sale, price_min: it.price_min,
              catalog_id: catalogId,
              status: 'ATIVO', date_added: new Date().toISOString().split('T')[0],
              quantity: 1,
            })
            pids.push(pid)
          }
        } else {
          // Produto novo → criar N entradas (1 por unidade para IMEI futuro)
          for (let i = 0; i < it.quantity; i++) {
            const pid = crypto.randomUUID()
            await sb.from('products').insert({
              id: pid, brand: it.brand, model: it.model,
              storage: it.storage, color: it.color, condition: it.condition,
              cost_usd: it.cost_usd, cost_brl_unit: it.cost_brl_unit,
              price_current: it.price_sale, price_min: it.price_min,
              catalog_id: catalogId,
              status: 'ATIVO', date_added: new Date().toISOString().split('T')[0],
              quantity: 1,
            })
            pids.push(pid)
          }
        }
        await sb.from('shipment_items').update({ status: 'EM_ESTOQUE', product_ids: pids }).eq('id', it.id)
      }

      // Fechar remessa
      await sb.from('shipments').update({ status: 'FECHADA', updated_at: new Date().toISOString() }).eq('id', ship.id)

      // Lançar custos no cashflow
      const totalExtra = ship.travel_cost_brl + ship.other_costs_brl
      if (totalExtra > 0) {
        await sb.from('cashflow').insert({
          id: crypto.randomUUID(), type: 'SAIDA_VIAGEM',
          description: `Custos ${ship.reference} — ${ship.description}`,
          amount: totalExtra, date: new Date().toISOString(), created_by: user?.id,
        })
      }

      const total = ship.items.reduce((a, i) => a + i.quantity, 0)
      toast(`✅ Remessa fechada! ${total} produto${total > 1 ? 's' : ''} entrou${total > 1 ? 'ram' : ''} no estoque.`, 'success')
      setFecharModal(null); load()
    } catch (e) { console.error(e); toast('Erro ao fechar remessa', 'error') }
    finally { setSaving(false) }
  }

  // ── Atualizar preço de item inline ─────────────────────────
  const excluirRemessa = async (ship: Shipment) => {
    const isFechada = ship.status === 'FECHADA'
    const totalItens = (ship.items || []).reduce((a, i) => a + i.quantity, 0)

    const msg = isFechada
      ? `⚠️ Esta remessa está FECHADA.\n\n${totalItens} produto(s) serão removidos do estoque.\n\nTem certeza que deseja excluir "${ship.reference}"?`
      : `Excluir remessa ${ship.reference}?`

    if (!confirm(msg)) return
    setSaving(true)
    try {
      // Se fechada, reverter produtos do estoque
      if (isFechada) {
        for (const it of ship.items || []) {
          if (it.product_ids?.length) {
            // Marcar produtos como AVARIADO (remover do estoque ativo)
            for (const pid of it.product_ids) {
              await sb.from('products').update({ status: 'AVARIADO', updated_at: new Date().toISOString() }).eq('id', pid)
            }
          }
        }
        // Reverter lançamento de cashflow dos custos da viagem
        if (ship.travel_cost_brl > 0 || ship.other_costs_brl > 0) {
          await sb.from('cashflow')
            .delete()
            .ilike('description', '%' + ship.reference + '%')
        }
        toast(`Remessa excluída — ${totalItens} produto(s) removidos do estoque`, 'info')
      } else {
        toast('Remessa excluída', 'info')
      }

      // Excluir itens e remessa
      await sb.from('shipment_items').delete().eq('shipment_id', ship.id)
      await sb.from('shipments').delete().eq('id', ship.id)
      load()
    } catch (e) { console.error(e); toast('Erro ao excluir remessa', 'error') }
    finally { setSaving(false) }
  }

  const atualizarPreco = async (shipId: string, itemId: string, field: 'price_sale' | 'price_min', val: number) => {
    await sb.from('shipment_items').update({ [field]: val }).eq('id', itemId)
    setRemessas(prev => prev.map(s => s.id !== shipId ? s : {
      ...s, items: s.items?.map(it => it.id !== itemId ? it : { ...it, [field]: val })
    }))
  }

  // ── Stats ───────────────────────────────────────────────────
  const abertas  = remessas.filter(r => r.status === 'ABERTA').length
  const fechadas = remessas.filter(r => r.status === 'FECHADA')
  const totalInvestido = fechadas.reduce((a, r) =>
    a + (r.items || []).reduce((b, i) => b + i.cost_brl, 0) + r.travel_cost_brl + r.other_costs_brl, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Remessas</h1>
          <p className="page-sub">Entrada de mercadoria no estoque</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNovaModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} />Nova Remessa
        </button>
      </div>

      <div className="grid-kpi">
        {[
          { l: 'Abertas',         v: abertas,           c: 'var(--yellow)' },
          { l: 'Fechadas',        v: fechadas.length,   c: 'var(--green)'  },
          { l: 'Total Investido', v: fR(totalInvestido),c: 'var(--accent)' },
        ].map(k => (
          <div key={k.l} className="stat-card stat-pop">
            <p className="stat-label">{k.l}</p>
            <p className="stat-value" style={{ color: k.c, fontSize: 20 }}>{k.v}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!remessas.length && <div className="empty"><p className="empty-title">Nenhuma remessa cadastrada</p></div>}
          {remessas.map(ship => {
            const isOpen     = expanded === ship.id
            const totalItens = (ship.items || []).reduce((a, i) => a + i.quantity, 0)
            const totalCusto = (ship.items || []).reduce((a, i) => a + i.cost_brl, 0) + ship.travel_cost_brl + ship.other_costs_brl
            return (
              <div key={ship.id} className="card card-glow" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                     onClick={() => setExpanded(isOpen ? null : ship.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <p style={{ fontWeight: 700, fontSize: 14.5 }}>{ship.reference}</p>
                      <span className={`badge badge-${ship.status === 'FECHADA' ? 'green' : ship.status === 'ABERTA' ? 'yellow' : 'gray'}`}>
                        {ship.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 6 }}>{ship.description}</p>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-4)' }}>📅 {fD(ship.travel_date)}</span>
                      <span style={{ color: 'var(--text-4)' }}>💱 R$ {ship.exchange_rate?.toFixed(2)}/USD</span>
                      <span style={{ color: 'var(--text-4)' }}>📦 {totalItens} un.</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fR(totalCusto)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {ship.status === 'ABERTA' && (
                        <button onClick={e => { e.stopPropagation(); setFecharModal(ship) }}
                                className="btn btn-primary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={12} />Fechar → Estoque
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); excluirRemessa(ship) }}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--red)', border: '1px solid rgba(239,68,68,.2)', display: 'flex', alignItems: 'center', gap: 3 }}
                              title={ship.status === 'FECHADA' ? 'Excluir e reverter estoque' : 'Excluir remessa'}>
                        {ship.status === 'FECHADA' && <AlertTriangle size={11} />}
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {isOpen ? <ChevronUp size={14} style={{ color: 'var(--text-4)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-4)' }} />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-1)' }}>
                    <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
                      <table>
                        <thead><tr>
                          <th>Produto</th><th>Qtd</th>
                          <th>Custo USD</th><th>Custo BRL/un</th>
                          <th>Preço Venda</th><th>Preço Mín.</th><th>Margem</th>
                        </tr></thead>
                        <tbody>
                          {(ship.items || []).map(it => {
                            const margin = it.price_sale && it.cost_brl_unit
                              ? ((it.price_sale - it.cost_brl_unit) / it.price_sale * 100) : 0
                            return (
                              <tr key={it.id}>
                                <td style={{ fontWeight: 500 }}>
                                  {it.brand} {it.model}
                                  <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1 }}>
                                    {it.storage} · {it.color} · {it.condition}
                                  </div>
                                </td>
                                <td className="mono">{it.quantity}</td>
                                <td className="mono">$ {it.cost_usd?.toFixed(2)}</td>
                                <td className="mono" style={{ color: 'var(--red)' }}>{fR(it.cost_brl_unit)}</td>
                                <td>
                                  {ship.status === 'ABERTA' ? (
                                    <input type="number" defaultValue={it.price_sale || ''} placeholder="0,00"
                                      style={{ width: 90, padding: '4px 8px', fontSize: 12 }}
                                      onBlur={e => atualizarPreco(ship.id, it.id, 'price_sale', parseFloat(e.target.value) || 0)} />
                                  ) : <span className="mono" style={{ color: 'var(--accent)' }}>{fR(it.price_sale)}</span>}
                                </td>
                                <td>
                                  {ship.status === 'ABERTA' ? (
                                    <input type="number" defaultValue={it.price_min || ''} placeholder="0,00"
                                      style={{ width: 80, padding: '4px 8px', fontSize: 12 }}
                                      onBlur={e => atualizarPreco(ship.id, it.id, 'price_min', parseFloat(e.target.value) || 0)} />
                                  ) : <span className="mono" style={{ color: 'var(--text-3)' }}>{fR(it.price_min)}</span>}
                                </td>
                                <td>
                                  {it.price_sale ? (
                                    <span className={`badge badge-${margin >= 20 ? 'green' : margin >= 10 ? 'yellow' : 'red'}`}>
                                      {margin.toFixed(1)}%
                                    </span>
                                  ) : <span style={{ color: 'var(--text-4)', fontSize: 11 }}>—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {ship.notes && (
                      <div style={{ padding: '8px 16px', background: 'var(--bg-2)', fontSize: 12, color: 'var(--text-4)', borderTop: '1px solid var(--border-1)' }}>
                        📝 {ship.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Nova Remessa ── */}
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Remessa" size="xl">
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '75vh', overflowY: 'auto' }}>

          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginBottom: 10 }}>Dados da Viagem</p>
            <div className="form-grid-2" style={{ gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">Descrição</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Compras CDE — Junho 2026" />
              </div>
              <div>
                <label className="label">Data da viagem</label>
                <input type="date" value={form.travel_date} onChange={e => setForm(f => ({ ...f, travel_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Câmbio USD → BRL *</label>
                <input type="number" step="0.01" value={form.exchange_rate} onChange={e => setForm(f => ({ ...f, exchange_rate: e.target.value }))} placeholder="Ex: 5.90" />
              </div>
              <div>
                <label className="label">Custos da viagem (R$)</label>
                <input type="number" step="0.01" value={form.travel_cost_brl} onChange={e => setForm(f => ({ ...f, travel_cost_brl: e.target.value }))} placeholder="Hospedagem, combustível..." />
              </div>
              <div>
                <label className="label">Outros custos (R$)</label>
                <input type="number" step="0.01" value={form.other_costs_brl} onChange={e => setForm(f => ({ ...f, other_costs_brl: e.target.value }))} placeholder="Frete, taxas..." />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)' }}>Produtos Comprados</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setItens(prev => [...prev, emptyItem()])} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} />Adicionar
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {itens.map((it, idx) => {
                const costUnit = exRate ? calcCustoUnit(it) : 0
                const margin   = (it.price_sale || 0) > 0 && costUnit > 0
                  ? (((it.price_sale || 0) - costUnit) / (it.price_sale || 0) * 100) : 0

                return (
                  <div key={idx} style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)' }}>Produto {idx + 1}</p>
                      {itens.length > 1 && (
                        <button onClick={() => setItens(prev => prev.filter((_, j) => j !== idx))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 2 }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="form-grid-3" style={{ gap: 8, marginBottom: 8 }}>
                      <div>
                        <label className="label" style={{ fontSize: 9 }}>Marca</label>
                        <select value={it.brand} onChange={e => { const b = e.target.value; setItens(prev => prev.map((x, i) => i === idx ? { ...x, brand: b, color: getCores(b)[0] } : x)); loadModelos(b) }}>
                          {BRANDS.map(b => <option key={b}>{b}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label className="label" style={{ fontSize: 9 }}>Modelo *</label>
                        {modelosSugeridos.length > 0 ? (
                          <select value={it.model} onChange={e => onModeloSel(idx, e.target.value, it.brand)}>
                            <option value="">Selecione o modelo...</option>
                            {[...new Set(catalogProdutos.filter(p => p.brand === it.brand).map(p => p.model))].map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        ) : (
                          <input value={it.model} onChange={e => setItens(prev => prev.map((x, i) => i === idx ? { ...x, model: e.target.value } : x))} placeholder="Digite o modelo..." />
                        )}
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 9 }}>Storage</label>
                        <select value={it.storage} onChange={e => setItens(prev => prev.map((x, i) => i === idx ? { ...x, storage: e.target.value } : x))}>
                          {(it.model && getStoragesDo(it.brand, it.model).length > 0
                            ? getStoragesDo(it.brand, it.model)
                            : STORAGES
                          ).map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 9 }}>Cor</label>
                        <select value={it.color} onChange={e => setItens(prev => prev.map((x, i) => i === idx ? { ...x, color: e.target.value } : x))}>
                          {(it.model && getCoresDo(it.brand, it.model, it.storage).length > 0
                            ? getCoresDo(it.brand, it.model, it.storage)
                            : getCores(it.brand)
                          ).map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 9 }}>Condição</label>
                        <select value={it.condition} onChange={e => setItens(prev => prev.map((x, i) => i === idx ? { ...x, condition: e.target.value } : x))}>
                          {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 9 }}>Qtd</label>
                        <input type="number" min="1" value={it.quantity} onChange={e => setItens(prev => prev.map((x, i) => i === idx ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))} />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 9 }}>Custo (USD) *</label>
                        <input type="number" step="0.01" value={it.cost_usd || ''} onChange={e => setItens(prev => prev.map((x, i) => i === idx ? { ...x, cost_usd: parseFloat(e.target.value) || 0 } : x))} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 9 }}>Preço venda (R$)</label>
                        <input type="number" step="0.01" value={it.price_sale || ''} onChange={e => setItens(prev => prev.map((x, i) => i === idx ? { ...x, price_sale: parseFloat(e.target.value) || 0 } : x))} placeholder="0.00" />
                      </div>
                    </div>
                    {exRate > 0 && (it.cost_usd || 0) > 0 && (
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, padding: '6px 8px', background: 'var(--bg-3)', borderRadius: 6 }}>
                        <span style={{ color: 'var(--text-4)' }}>Custo/un: <strong style={{ color: 'var(--red)' }}>{fR(costUnit)}</strong></span>
                        {(it.price_sale || 0) > 0 && <>
                          <span style={{ color: 'var(--text-4)' }}>Lucro: <strong style={{ color: 'var(--green)' }}>{fR((it.price_sale || 0) - costUnit)}</strong></span>
                          <span className={`badge badge-${margin >= 20 ? 'green' : margin >= 10 ? 'yellow' : 'red'}`}>{margin.toFixed(1)}% margem</span>
                        </>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resumo total */}
          {exRate > 0 && (
            <div style={{ padding: '12px 14px', background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 10 }}>
              <div className="form-grid-3" style={{ gap: 10, textAlign: 'center' }}>
                {[
                  ['Total USD', `$ ${totalUSD.toFixed(2)}`, 'var(--text-1)'],
                  ['Custos extras', fR(totalCustoExtra), 'var(--yellow)'],
                  ['Total BRL', fR(totalBRL), 'var(--accent)'],
                ].map(([l, v, c]) => (
                  <div key={l as string}>
                    <p style={{ fontSize: 10, color: 'var(--text-4)' }}>{l}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: c as string }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label">Observações</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' }} placeholder="Notas da viagem..." />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setNovaModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={salvarRemessa} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Remessa'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Fechar → Estoque ── */}
      <Modal open={!!fecharModal} onClose={() => setFecharModal(null)} title={`Fechar ${fecharModal?.reference} → Estoque`} size="md">
        {fecharModal && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                Os seguintes produtos entrarão no estoque:
              </p>
              {fecharModal.items?.map(it => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--border-1)' }}>
                  <span style={{ color: 'var(--text-2)' }}>
                    {it.quantity}× {it.brand} {it.model} {it.storage} — {it.color}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--red)', fontSize: 11 }}>{fR(it.cost_brl_unit)}/un</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fR(it.price_sale)}</span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-2)' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {fecharModal.items?.reduce((a, i) => a + i.quantity, 0)} unidades no estoque
                </span>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                  {fR(fecharModal.items?.reduce((a, i) => a + i.cost_brl, 0) || 0)} custo total
                </span>
              </div>
            </div>
            {(fecharModal.travel_cost_brl + fecharModal.other_costs_brl) > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                💰 {fR(fecharModal.travel_cost_brl + fecharModal.other_costs_brl)} em custos de viagem serão lançados no Fluxo de Caixa
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setFecharModal(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => fecharRemessa(fecharModal)} disabled={saving}>
                {saving ? 'Processando...' : '✓ Confirmar → Entrar no Estoque'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
