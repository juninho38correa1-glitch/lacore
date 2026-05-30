'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Package, Edit2, Camera, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { sb, fR, fD, dI, ini, callFn } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { Product, ProductPhoto } from '@/lib/types'

interface Grupo {
  key: string; brand: string; model: string; storage: string
  condition: string; items: Product[]; qtd: number
  price: number; cost: number; fotos: ProductPhoto[]
}

export default function EstoqueTable() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [prods, setProds] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'agrupado' | 'individual'>('agrupado')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<{ grupo: Grupo | null }>({ grupo: null })
  const [precoModal, setPrecoModal] = useState<{ grupo: Grupo | null; mode: 'percent' | 'fixed' }>({ grupo: null, mode: 'percent' })
  const [editForm, setEditForm] = useState<Partial<Product>>({})
  const [fotoFiles, setFotoFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [specsLoading, setSpecsLoading] = useState(false)
  const [precoInput, setPrecoInput] = useState('')
  const [precoOrigem, setPrecoOrigem] = useState<'cost' | 'current'>('cost')

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('products').select('*,photos:product_photos(*)').eq('status', 'ATIVO').order('date_added', { ascending: false })
    setProds((data || []) as Product[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const agrupar = (): Grupo[] => {
    const map: Record<string, Grupo> = {}
    prods.forEach(p => {
      const k = `${p.brand}||${p.model}||${p.storage || ''}||${p.color || ''}||${p.condition || ''}`
      if (!map[k]) map[k] = { key: k, brand: p.brand, model: p.model, storage: p.storage || '', condition: p.condition || '', items: [], qtd: 0, price: 0, cost: 0, fotos: [] }
      map[k].items.push(p)
      map[k].qtd++
      if (!map[k].price && p.price_current) map[k].price = p.price_current
      if (!map[k].cost && p.cost_brl_unit) map[k].cost = p.cost_brl_unit
      if (p.photos?.length && !map[k].fotos.length) map[k].fotos = p.photos
    })
    return Object.values(map)
  }

  const grupos = agrupar().filter(g =>
    !search || `${g.brand} ${g.model} ${g.storage}`.toLowerCase().includes(search.toLowerCase())
  )
  const filtrados = prods.filter(p =>
    !search || `${p.brand} ${p.model} ${p.storage || ''} ${p.color || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const openEdit = (g: Grupo) => {
    const rep = g.items[0]
    setEditForm({ brand: rep.brand, model: rep.model, storage: rep.storage, condition: rep.condition, processor: rep.processor, ram: rep.ram, camera_main: rep.camera_main, camera_front: rep.camera_front, battery: rep.battery, screen: rep.screen, catalog_visible: rep.catalog_visible, catalog_highlight: rep.catalog_highlight, catalog_label: rep.catalog_label, catalog_installments: rep.catalog_installments, catalog_warranty: rep.catalog_warranty, catalog_description: rep.catalog_description })
    setFotoFiles([])
    setEditModal({ grupo: g })
  }

  const buscarSpecs = async () => {
    if (!editForm.brand || !editForm.model) { toast('Preencha marca e modelo', 'error'); return }
    setSpecsLoading(true)
    const r = await callFn('ia-publicacao', { action: 'buscar_specs', brand: editForm.brand, model: editForm.model, storage: editForm.storage }, user?.id, user?.role)
    setSpecsLoading(false)
    if (r.error) { toast(r.error, 'error'); return }
    const s = r.specs || {}
    setEditForm(f => ({ ...f, processor: s.processor || f.processor, ram: s.ram || f.ram, camera_main: s.camera_main || f.camera_main, camera_front: s.camera_front || f.camera_front, battery: s.battery || f.battery, screen: s.screen || f.screen }))
    toast('Specs preenchidas pela IA!', 'success')
  }

  const removerFoto = async (foto: { id: string; storage_key: string }) => {
    if (!confirm('Remover esta foto?')) return
    if (foto.storage_key) await sb.storage.from('product-photos').remove([foto.storage_key])
    await sb.from('product_photos').delete().eq('id', foto.id)
    // Atualizar fotos do grupo no estado
    if (editModal.grupo) {
      const novasFotos = editModal.grupo.fotos.filter(f => f.id !== foto.id)
      setEditModal(m => m.grupo ? { grupo: { ...m.grupo!, fotos: novasFotos } } : m)
    }
    toast('Foto removida', 'info')
    load()
  }

  const saveEdit = async () => {
    if (!editModal.grupo) return
    setSaving(true)
    try {
      const ids = editModal.grupo.items.map(p => p.id)
      const specFields = { processor: editForm.processor, ram: editForm.ram, camera_main: editForm.camera_main, camera_front: editForm.camera_front, battery: editForm.battery, screen: editForm.screen }
      await sb.from('products').update({ ...specFields, catalog_visible: editForm.catalog_visible, catalog_highlight: editForm.catalog_highlight, catalog_label: editForm.catalog_label, catalog_installments: editForm.catalog_installments, catalog_warranty: editForm.catalog_warranty, catalog_description: editForm.catalog_description }).in('id', ids)
      // Upload fotos
      for (let i = 0; i < fotoFiles.length; i++) {
        const f = fotoFiles[i]
        const key = `${ids[0]}/${Date.now()}_${i}.${f.name.split('.').pop()}`
        const { data: up } = await sb.storage.from('product-photos').upload(key, f)
        if (up) {
          const { data: { publicUrl } } = sb.storage.from('product-photos').getPublicUrl(key)
          await sb.from('product_photos').insert({ product_id: ids[0], url: publicUrl, storage_key: key, order: i })
        }
      }
      toast('Grupo atualizado!', 'success')
      setEditModal({ grupo: null })
      load()
    } catch { toast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  const calcPreco = () => {
    const g = precoModal.grupo
    if (!g || !precoInput) return null
    const base = precoOrigem === 'cost' ? g.cost : g.price
    if (precoModal.mode === 'percent') return Math.ceil(base * (1 + parseFloat(precoInput) / 100) / 10) * 10
    return parseFloat(precoInput)
  }

  const savePreco = async () => {
    if (!precoModal.grupo) return
    const novo = calcPreco()
    if (!novo) { toast('Preço inválido', 'error'); return }
    setSaving(true)
    const ids = precoModal.grupo.items.map(p => p.id)
    await sb.from('products').update({ price_current: novo }).in('id', ids)
    await sb.from('audit_logs').insert({ action: 'PRICE_CHANGE', entity: 'product', entity_id: ids[0], details: { old: precoModal.grupo.price, new: novo, unit: ids.length } })
    toast(`Preço atualizado para ${fR(novo)}`, 'success')
    setSaving(false)
    setPrecoModal({ grupo: null, mode: 'percent' })
    load()
  }

  const margin = (cost: number, price: number) => cost && price ? ((price - cost) / price * 100).toFixed(1) + '%' : '—'

  // Abrir edição para produto individual (não grupo)
  const openEditById = (p: Product) => {
    const g: Grupo = { key: p.id, brand: p.brand, model: p.model, storage: p.storage || '', condition: p.condition || '', items: [p], qtd: 1, price: p.price_current || 0, cost: p.cost_brl_unit || 0, fotos: p.photos || [] }
    openEdit(g)
  }

  // Remover produto do estoque
  const removerProduto = async (id: string, nome: string) => {
    if (!confirm(`Remover "${nome}" do estoque? Esta ação não pode ser desfeita.`)) return
    // Remover fotos do storage
    const { data: fotos } = await sb.from('product_photos').select('storage_key').eq('product_id', id)
    for (const f of (fotos || [])) {
      if (f.storage_key) await sb.storage.from('product-photos').remove([f.storage_key])
    }
    await sb.from('product_photos').delete().eq('product_id', id)
    await sb.from('products').update({ status: 'AVARIADO' }).eq('id', id)
    toast('Produto removido do estoque', 'info')
    load()
  }

  if (loading) return <div className="flex justify-center p-16"><div className="spinner spinner-lg" /></div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-9 w-full text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['agrupado', 'individual'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}>
                {v === 'agrupado' ? 'Agrupado' : 'Individual'}
              </button>
            ))}
          </div>
          {isAdmin() && (
            <button onClick={() => router.push('/dashboard/estoque/novo')} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold">
              <Plus size={13} />Novo
            </button>
          )}
        </div>
      </div>

      {/* View agrupado */}
      {view === 'agrupado' && (
        <div className="card p-0 overflow-hidden">
          <table>
            <thead><tr>
              <th>Produto</th><th>Storage</th><th>Cond.</th><th>Qtd</th>
              {isAdmin() && <><th>Custo</th><th>Margem</th></>}
              <th>Preço</th><th>Parado</th><th></th>
            </tr></thead>
            <tbody>
              {!grupos.length && <tr><td colSpan={9} className="text-center py-10 text-gray-600">Nenhum produto</td></tr>}
              {grupos.map(g => (
                <>
                  <tr key={g.key} className="cursor-pointer" onClick={() => setExpanded(expanded === g.key ? null : g.key)}>
                    <td>
                      <div className="flex items-center gap-2">
                        {g.fotos[0] ? <img src={g.fotos[0].url} className="w-8 h-8 rounded-lg object-contain flex-shrink-0" /> : <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"><Package size={13} className="text-gray-600" /></div>}
                        <div><p className="text-white font-semibold text-sm">{g.brand} {g.model}{g.items[0]?.color && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 500, background: 'rgba(255,255,255,.07)', color: 'var(--text-3)', border: '1px solid var(--border-1)' }}>{g.items[0].color}</span>}</p><p className="text-gray-500 text-xs">{g.qtd > 1 ? `${g.qtd} unidades` : '1 unidade'}</p></div>
                      </div>
                    </td>
                    <td><span className="badge badge-gray">{g.storage || '—'}</span></td>
                    <td><span className="badge badge-blue">{g.condition || '—'}</span></td>
                    <td className="font-semibold text-white">{g.qtd}</td>
                    {isAdmin() && <>
                      <td className="font-mono text-gray-400 text-xs">{fR(g.cost)}</td>
                      <td><span className={`badge ${parseFloat(margin(g.cost, g.price)) >= 20 ? 'badge-green' : 'badge-yellow'}`}>{margin(g.cost, g.price)}</span></td>
                    </>}
                    <td className="font-mono font-semibold text-cyan-300">{fR(g.price)}</td>
                    <td><span className={`badge ${g.items.some(p => dI(p.date_added || '') >= 25) ? 'badge-red' : g.items.some(p => dI(p.date_added || '') >= 15) ? 'badge-yellow' : 'badge-green'}`}>{Math.max(...g.items.map(p => dI(p.date_added || '')))}d</span></td>
                    <td>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-cyan-500/15 text-gray-400 hover:text-cyan-300 transition-colors" title="Editar grupo"><Edit2 size={13} /></button>
                        {isAdmin() && <button onClick={() => { setPrecoModal({ grupo: g, mode: 'percent' }); setPrecoInput('') }} className="p-1.5 rounded-lg hover:bg-yellow-500/15 text-gray-400 hover:text-yellow-300 transition-colors text-xs font-bold" title="Editar preço">R$</button>}
                        {expanded === g.key ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
                      </div>
                    </td>
                  </tr>
                  {expanded === g.key && g.items.map(p => (
                    <tr key={p.id} className="bg-white/2">
                      <td className="pl-12"><p className="text-gray-300 text-xs">{p.color || '—'} · IMEI: {p.imei || '—'}</p></td>
                      <td colSpan={isAdmin() ? 7 : 5}><span className={`badge ${p.status === 'ATIVO' ? 'badge-green' : 'badge-gray'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View individual */}
      {view === 'individual' && (
        <div className="card p-0 overflow-hidden">
          <table>
            <thead><tr>
              <th>Produto</th><th>Cor</th><th>IMEI</th><th>Status</th>
              {isAdmin() && <th>Custo</th>}
              <th>Preço</th><th>Adicionado</th>
            </tr></thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id}>
                  <td><p className="text-white font-medium">{p.brand} {p.model}</p><p className="text-gray-500 text-xs">{p.storage}</p></td>
                  <td className="text-gray-300 text-xs">{p.color || '—'}</td>
                  <td className="font-mono text-xs text-gray-400">{p.imei || '—'}</td>
                  <td><span className={`badge ${p.status === 'ATIVO' ? 'badge-green' : p.status === 'VENDIDO' ? 'badge-blue' : 'badge-gray'}`}>{p.status}</span></td>
                  {isAdmin() && <td className="font-mono text-xs text-gray-400">{fR(p.cost_brl_unit || 0)}</td>}
                  <td className="font-mono font-semibold text-cyan-300">{fR(p.price_current || 0)}</td>
                  <td className="text-gray-500 text-xs">{fD(p.date_added || '')}</td>
                  {isAdmin() && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEditById(p)} className="btn btn-ghost btn-icon-sm" title="Editar">✏️</button>
                        <button onClick={() => removerProduto(p.id, `${p.brand} ${p.model}`)} className="btn btn-ghost btn-icon-sm" title="Remover" style={{ color: 'var(--red)' }}>🗑</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editar grupo */}
      <Modal open={!!editModal.grupo} onClose={() => setEditModal({ grupo: null })} title={`Editar Grupo — ${editModal.grupo?.brand} ${editModal.grupo?.model} ${editModal.grupo?.storage}`} size="lg">
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="p-3 rounded-lg bg-cyan-500/8 border border-cyan-500/20 text-xs text-cyan-300">
            📋 Fotos e specs serão aplicadas a todas as {editModal.grupo?.qtd} unidade(s) deste grupo.
          </div>
          {/* Fotos */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">🖼 Fotos</p>
            <div className="flex gap-2 flex-wrap">
              {editModal.grupo?.fotos.map((f, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={f.url} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-1)' }} />
                  <button
                    onClick={() => removerFoto(f)}
                    title="Remover foto"
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 20, height: 20, borderRadius: 99,
                      background: 'var(--red)', border: '2px solid var(--bg-1)',
                      color: '#fff', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >✕</button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-colors">
                <Camera size={16} className="text-gray-500 mb-1" />
                <span className="text-[10px] text-gray-600">+Foto</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => setFotoFiles([...fotoFiles, ...Array.from(e.target.files || [])])} />
              </label>
              {fotoFiles.map((f, i) => (
                <div key={i} className="w-20 h-20 rounded-lg border border-cyan-500/30 flex items-center justify-center overflow-hidden">
                  <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
          {/* Specs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">⚙️ Especificações</p>
              <button onClick={buscarSpecs} disabled={specsLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition-colors disabled:opacity-50">
                <Sparkles size={12} />
                {specsLoading ? 'Buscando...' : 'Buscar com IA'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['Processador', 'processor'], ['RAM', 'ram'], ['Câmera Principal', 'camera_main'], ['Câmera Frontal', 'camera_front'], ['Bateria', 'battery'], ['Tela', 'screen']].map(([label, key]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input value={(editForm as Record<string, string>)[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} placeholder={`Ex: ${key === 'processor' ? 'Snapdragon 8 Gen 3' : key === 'ram' ? '12GB' : '—'}`} className="text-sm" />
                </div>
              ))}
            </div>
          </div>
          {/* Config catálogo */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">🛍 Configuração do Catálogo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Destaque na Vitrine</label>
                <select value={editForm.catalog_highlight ? 'sim' : 'nao'} onChange={e => setEditForm(f => ({ ...f, catalog_highlight: e.target.value === 'sim' }))} className="text-sm">
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Selo / Label</label>
                <select value={editForm.catalog_label || ''} onChange={e => setEditForm(f => ({ ...f, catalog_label: e.target.value }))} className="text-sm">
                  <option value="">Sem selo</option>
                  <option value="Promoção">Promoção</option>
                  <option value="Novo">Novo</option>
                  <option value="Hot">Hot</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Parcelas</label>
                <select value={editForm.catalog_installments || ''} onChange={e => setEditForm(f => ({ ...f, catalog_installments: parseInt(e.target.value) }))} className="text-sm">
                  {[0,3,6,9,10,12,18,24].map(n => <option key={n} value={n}>{n ? `${n}x` : 'Sem parcelamento'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Garantia</label>
                <input value={editForm.catalog_warranty || ''} onChange={e => setEditForm(f => ({ ...f, catalog_warranty: e.target.value }))} placeholder="Ex: 3 meses de garantia" className="text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Descrição para o Catálogo</label>
                <textarea rows={2} value={editForm.catalog_description || ''} onChange={e => setEditForm(f => ({ ...f, catalog_description: e.target.value }))} placeholder="Descrição para o cliente final..." className="text-sm resize-none" />
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end gap-2">
          <button onClick={() => setEditModal({ grupo: null })} className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10">Cancelar</button>
          <button onClick={saveEdit} disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>

      {/* Modal editar preço */}
      <Modal open={!!precoModal.grupo} onClose={() => setPrecoModal({ grupo: null, mode: 'percent' })} title="Editar Preço em Lote" size="sm">
        {precoModal.grupo && (
          <div className="p-5 space-y-4">
            <p className="text-gray-400 text-sm">{precoModal.grupo.brand} {precoModal.grupo.model} — <strong className="text-white">{precoModal.grupo.qtd} unidade(s)</strong></p>
            <div className="grid grid-cols-2 gap-2">
              {(['percent', 'fixed'] as const).map(m => (
                <button key={m} onClick={() => setPrecoModal(p => ({ ...p, mode: m }))} className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${precoModal.mode === m ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-300'}`}>
                  {m === 'percent' ? '% Margem' : 'R$ Fixo'}
                </button>
              ))}
            </div>
            {precoModal.mode === 'percent' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Base do cálculo</label>
                <select value={precoOrigem} onChange={e => setPrecoOrigem(e.target.value as 'cost' | 'current')} className="text-sm mb-2">
                  <option value="cost">Custo ({fR(precoModal.grupo.cost)})</option>
                  <option value="current">Preço atual ({fR(precoModal.grupo.price)})</option>
                </select>
                <label className="text-xs text-gray-400 mb-1 block">Margem %</label>
                <input type="number" value={precoInput} onChange={e => setPrecoInput(e.target.value)} placeholder="Ex: 48" className="text-sm" />
              </div>
            )}
            {precoModal.mode === 'fixed' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Novo preço (R$)</label>
                <input type="number" value={precoInput} onChange={e => setPrecoInput(e.target.value)} placeholder="Ex: 1499" className="text-sm" />
              </div>
            )}
            {precoInput && calcPreco() && (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-gray-500">Novo preço calculado</p>
                <p className="text-xl font-bold text-cyan-300">{fR(calcPreco()!)}</p>
                {precoModal.mode === 'percent' && <p className="text-xs text-gray-500 mt-1">Margem: {parseFloat(precoInput).toFixed(1)}%</p>}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setPrecoModal({ grupo: null, mode: 'percent' })} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-sm">Cancelar</button>
              <button onClick={savePreco} disabled={saving || !precoInput} className="flex-1 btn-primary py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
