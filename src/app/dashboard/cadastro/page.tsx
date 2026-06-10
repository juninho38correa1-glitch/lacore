'use client'
import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Sparkles, Camera, Eye, EyeOff } from 'lucide-react'
import { sb, fR } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'

interface CatalogProduct {
  id: string; brand: string; model: string; storage: string
  color: string; condition: string
  processor?: string; ram?: string; camera_main?: string
  camera_front?: string; battery?: string; screen?: string
  nfc?: boolean; charging?: string; connectivity?: string; os?: string; dimensions?: string
  catalog_visible: boolean; catalog_description?: string
  created_at: string
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

const emptyForm = () => ({
  brand: 'Xiaomi', model: '', storage: '128GB', color: 'Preto', condition: 'Novo',
  processor: '', ram: '', camera_main: '', camera_front: '', battery: '', screen: '',
  nfc: false, charging: '', connectivity: '', os: '', dimensions: '',
  catalog_visible: true, catalog_description: '',
  imei: '', serial_number: '',
})

export default function CadastroPage() {
  const { isAdmin } = useAuth()
  const [produtos, setProdutos] = useState<CatalogProduct[]>([])
  const [loading, setLoading]   = useState(true)
  const [busca, setBusca]       = useState('')
  const [modal, setModal]       = useState<'novo' | CatalogProduct | null>(null)
  const [form, setForm]         = useState(emptyForm())
  const [saving, setSaving]     = useState(false)
  const [buscandoIA, setBuscandoIA] = useState(false)
  const [fotoFiles, setFotoFiles] = useState<File[]>([])
  const [fotosExistentes, setFotosExistentes] = useState<{id:string;url:string;storage_key:string;order:number}[]>([])

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('product_catalog').select('*').order('brand').order('model')
    setProdutos((data || []) as CatalogProduct[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNovo = () => { setForm(emptyForm()); setModal('novo') }
  const openEdit = async (p: CatalogProduct) => {
    setFotoFiles([])
    // Buscar fotos: 1) vinculadas ao catalog_id direto, 2) de qualquer produto vinculado por catalog_id (ou mesmo brand/model/storage) que tenha fotos
    const [{ data: fotosCat }, { data: prods }] = await Promise.all([
      sb.from('product_photos').select('id,url,storage_key,order').eq('catalog_id', p.id).order('order'),
      sb.from('products').select('id').eq('catalog_id', p.id),
    ])
    let fotosAll = (fotosCat || []) as {id:string;url:string;storage_key:string;order:number}[]
    let prodIds = (prods || []).map(pr => pr.id)
    if (!prodIds.length) {
      // Fallback: produto cadastrado direto no Estoque (sem vínculo de catalog_id) —
      // localiza pelo mesmo brand/model/storage
      const { data: prodsMatch } = await sb.from('products')
        .select('id').eq('brand', p.brand).eq('model', p.model).eq('storage', p.storage)
      prodIds = (prodsMatch || []).map(pr => pr.id)
    }
    if (!fotosAll.length && prodIds.length) {
      // Busca fotos de todos os produtos vinculados e usa o primeiro que tiver fotos
      const { data: fotosP } = await sb.from('product_photos')
        .select('id,url,storage_key,order,product_id').in('product_id', prodIds).order('order')
      const porProduto = (fotosP || []).reduce((acc: Record<string, typeof fotosP>, f) => {
        (acc[f.product_id] ||= []).push(f)
        return acc
      }, {})
      const idComFotos = prodIds.find(id => porProduto[id]?.length)
      fotosAll = (idComFotos ? porProduto[idComFotos] : []) as {id:string;url:string;storage_key:string;order:number}[]
    }
    setFotosExistentes(fotosAll)
    setForm({
      brand: p.brand, model: p.model, storage: p.storage, color: p.color, condition: p.condition,
      processor: p.processor || '', ram: p.ram || '', camera_main: p.camera_main || '',
      camera_front: p.camera_front || '', battery: p.battery || '', screen: p.screen || '',
      nfc: p.nfc || false, charging: p.charging || '', connectivity: p.connectivity || '',
      os: p.os || '', dimensions: p.dimensions || '',
      catalog_visible: p.catalog_visible, catalog_description: p.catalog_description || '',
    })
    setModal(p)
  }

  const buscarSpecs = async () => {
    if (!form.brand || !form.model) { toast('Informe marca e modelo primeiro', 'error'); return }
    setBuscandoIA(true)
    try {
      const { callFn } = await import('@/lib/supabase')
      const res = await callFn('ia-publicacao', {
        action: 'buscar_specs', brand: form.brand, model: form.model, storage: form.storage
      })
      if (res.specs) {
        setForm(f => ({
          ...f,
          processor:    res.specs.processor    || f.processor,
          ram:          res.specs.ram          || f.ram,
          camera_main:  res.specs.camera_main  || f.camera_main,
          camera_front: res.specs.camera_front || f.camera_front,
          battery:      res.specs.battery      || f.battery,
          screen:       res.specs.screen       || f.screen,
          nfc:          res.specs.nfc ?? f.nfc,
          charging:     res.specs.charging !== '-'     ? (res.specs.charging     || f.charging)     : f.charging,
          connectivity: res.specs.connectivity !== '-' ? (res.specs.connectivity || f.connectivity) : f.connectivity,
          os:           res.specs.os !== '-'           ? (res.specs.os           || f.os)           : f.os,
          dimensions:   res.specs.dimensions !== '-'   ? (res.specs.dimensions   || f.dimensions)   : f.dimensions,
        }))
        const nfcInfo = res.specs.nfc ? ' · ✓ NFC' : ' · ✗ sem NFC'
        toast(`Specs encontradas via ${res.fonte}${nfcInfo}!`, 'success')
      } else {
        toast(res.error || 'Specs não encontradas', 'error')
      }
    } catch { toast('Erro ao buscar specs', 'error') }
    finally { setBuscandoIA(false) }
  }

  const removerFotoCatalog = async (foto: {id:string;storage_key:string}) => {
    if (foto.storage_key) await sb.storage.from('product-photos').remove([foto.storage_key])
    await sb.from('product_photos').delete().eq('id', foto.id)
    setFotosExistentes(prev => prev.filter(f => f.id !== foto.id))
    toast('Foto removida', 'info')
  }

  const salvar = async () => {
    if (!form.model) { toast('Informe o modelo', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        brand: form.brand, model: form.model, storage: form.storage,
        color: form.color, condition: form.condition,
        processor: form.processor || null, ram: form.ram || null,
        camera_main: form.camera_main || null, camera_front: form.camera_front || null,
        battery: form.battery || null, screen: form.screen || null,
        nfc: form.nfc, charging: form.charging || null,
        connectivity: form.connectivity || null, os: form.os || null, dimensions: form.dimensions || null,
        catalog_visible: form.catalog_visible,
        catalog_description: form.catalog_description || null,
        updated_at: new Date().toISOString(),
      }
      // IMEI e serial vão para a tabela products (unidade física)
      const unitPayload = {
        imei: form.imei || null,
        serial_number: form.serial_number || null,
      }

      if (modal === 'novo') {
        const { error } = await sb.from('product_catalog').insert({ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() })
        if (error) {
          if (error.code === '23505') toast('Produto já cadastrado (mesma marca/modelo/storage/cor/condição)', 'error')
          else throw error
          return
        }
        // Buscar o ID recém-criado
        const { data: novocat } = await sb.from('product_catalog').select('id').eq('brand', form.brand).eq('model', form.model).eq('storage', form.storage).eq('color', form.color).eq('condition', form.condition).single()
        if (novocat) {
          const specUpdate = {
            catalog_id: novocat.id,
            processor: form.processor || null, ram: form.ram || null,
            camera_main: form.camera_main || null, camera_front: form.camera_front || null,
            battery: form.battery || null, screen: form.screen || null,
            nfc: form.nfc, charging: form.charging || null,
            connectivity: form.connectivity || null, os: form.os || null, dimensions: form.dimensions || null,
            ...(form.imei ? { imei: form.imei } : {}),
            ...(form.serial_number ? { serial_number: form.serial_number } : {}),
            updated_at: new Date().toISOString(),
          }
          await sb.from('products').update(specUpdate)
            .eq('brand', form.brand).eq('model', form.model)
            .eq('storage', form.storage).eq('color', form.color).eq('condition', form.condition)
        }
        toast('Produto cadastrado!', 'success')
      } else {
        const { error } = await sb.from('product_catalog').update(payload).eq('id', (modal as CatalogProduct).id)
        if (error) throw error

        const catalogId = (modal as CatalogProduct).id
        // Propagar specs para products vinculados por catalog_id (mais preciso)
        await sb.from('products').update({
          catalog_id: catalogId,
          processor: form.processor || null, ram: form.ram || null,
          camera_main: form.camera_main || null, camera_front: form.camera_front || null,
          battery: form.battery || null, screen: form.screen || null,
          // Atualizar também brand/model/storage/color/condition se mudaram
          brand: form.brand, model: form.model, storage: form.storage,
          color: form.color, condition: form.condition,
          updated_at: new Date().toISOString(),
        }).eq('catalog_id', catalogId)

        toast('Produto atualizado! Todas as unidades em estoque foram atualizadas.', 'success')
      }
      // Upload de novas fotos vinculadas ao catalog_id
      if (fotoFiles.length > 0) {
        let catId = ''
        if (modal === 'novo') {
          // Buscar o ID recém criado
          const { data: novo } = await sb.from('product_catalog')
            .select('id').eq('brand', form.brand).eq('model', form.model)
            .eq('storage', form.storage || '').eq('color', form.color || '').single()
          catId = novo?.id || ''
        } else {
          catId = (modal as CatalogProduct).id
        }
        if (catId) {
          const offsetOrder = fotosExistentes.length
          for (let i = 0; i < fotoFiles.length; i++) {
            const f = fotoFiles[i]
            const key = `catalog_${catId}_${Date.now()}_${i}.${f.name.split('.').pop()}`
            const { data: up } = await sb.storage.from('product-photos').upload(key, f)
            if (up) {
              const { data: { publicUrl } } = sb.storage.from('product-photos').getPublicUrl(key)
              await sb.from('product_photos').insert({ 
                id: crypto.randomUUID(), catalog_id: catId, product_id: null,
                url: publicUrl, storage_key: key, order: offsetOrder + i 
              })
            }
          }
        }
        setFotoFiles([])
      }
      setModal(null); load()
    } catch (e) { console.error(e); toast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  const excluir = async (p: CatalogProduct) => {
    if (!confirm(`Excluir ${p.brand} ${p.model} do catálogo?`)) return
    await sb.from('product_catalog').delete().eq('id', p.id)
    toast('Produto removido do catálogo', 'info'); load()
  }

  const filtrados = produtos.filter(p =>
    !busca || `${p.brand} ${p.model} ${p.storage} ${p.color}`.toLowerCase().includes(busca.toLowerCase())
  )
  const marcas = [...new Set(produtos.map(p => p.brand))]

  // Agrupar por marca para exibição
  const grupos = marcas.map(m => ({ marca: m, items: filtrados.filter(p => p.brand === m) })).filter(g => g.items.length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Cadastro de Produtos</h1>
          <p className="page-sub">Ficha técnica dos modelos — base para remessas e estoque</p>
        </div>
        {isAdmin() && (
          <button className="btn btn-primary" onClick={openNovo} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} />Novo Produto
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid-kpi">
        {marcas.map(m => (
          <div key={m} className="stat-card">
            <p className="stat-label">{m}</p>
            <p className="stat-value" style={{ color: 'var(--accent)', fontSize: 22 }}>
              {produtos.filter(p => p.brand === m).length}
            </p>
            <p style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 4 }}>modelos</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div style={{ position: 'relative', maxWidth: 320 }}>
        <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar modelo..." style={{ paddingLeft: 32 }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!filtrados.length && <div className="empty"><p className="empty-title">Nenhum produto no catálogo</p><p className="empty-sub">Cadastre os modelos que você trabalha</p></div>}
          {grupos.map(g => (
            <div key={g.marca}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-4)', marginBottom: 8 }}>{g.marca}</p>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Modelo</th><th>Storage</th><th>Cor</th><th>Condição</th>
                    <th className="hide-mobile">Processador</th><th className="hide-mobile">RAM</th>
                    <th className="hide-mobile">Bateria</th><th className="hide-mobile">Tela</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {g.items.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.model}</td>
                        <td><span className="badge badge-blue">{p.storage}</span></td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{p.color}</td>
                        <td><span className={`badge badge-${p.condition === 'Novo' ? 'green' : 'yellow'}`}>{p.condition}</span></td>
                        <td className="hide-mobile" style={{ color: 'var(--text-4)', fontSize: 12 }}>{p.processor || '—'}</td>
                        <td className="hide-mobile" style={{ color: 'var(--text-4)', fontSize: 12 }}>{p.ram || '—'}</td>
                        <td className="hide-mobile" style={{ color: 'var(--text-4)', fontSize: 12 }}>{p.battery || '—'}</td>
                        <td className="hide-mobile" style={{ color: 'var(--text-4)', fontSize: 12 }}>{p.screen || '—'}</td>
                        <td>
                          {isAdmin() && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => openEdit(p)} className="btn btn-ghost btn-icon-sm" title="Editar"><Edit2 size={12} /></button>
                              <button onClick={() => excluir(p)} className="btn btn-ghost btn-icon-sm" title="Excluir" style={{ color: 'var(--red)' }}><Trash2 size={12} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'Novo Produto' : `Editar — ${(modal as CatalogProduct)?.model}`} size="lg">
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Fotos — igual ao Estoque */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">🖼 Fotos</p>
            <div className="flex gap-2 flex-wrap">
              {fotosExistentes.map((f, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={f.url} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-1)' }} />
                  <button onClick={() => removerFotoCatalog(f)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 99, background: 'var(--red)', border: '2px solid var(--bg-1)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-colors">
                <Camera size={16} className="text-gray-500 mb-1" />
                <span className="text-[10px] text-gray-600">+Foto</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => setFotoFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
              </label>
              {fotoFiles.map((f, i) => (
                <div key={i} style={{ position: 'relative' }} className="w-20 h-20 rounded-lg border border-cyan-500/30 overflow-hidden">
                  <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                  <button onClick={() => setFotoFiles(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 99, background: 'var(--red)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
            </div>
            {fotoFiles.length > 0 && <p style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 6 }}>{fotoFiles.length} nova(s) — salva(s) ao confirmar</p>}
          </div>

          {/* Identificação */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">📱 Identificação</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Marca</label>
                <select value={form.brand} onChange={e => { const b = e.target.value; setForm(f => ({ ...f, brand: b, color: (COLORS_BY_BRAND[b] || COLORS_BY_BRAND['Outro'])[0] })) }}>
                  {BRANDS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Modelo *</label>
                <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Ex: Redmi Note 14 4G" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Storage</label>
                <select value={form.storage} onChange={e => setForm(f => ({ ...f, storage: e.target.value }))}>
                  {STORAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cor</label>
                <select value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}>
                  {getCores(form.brand).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Condição</label>
                <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">IMEI <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(opcional)</span></label>
                <input value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value.replace(/\D/g,'').slice(0,15) }))} placeholder="000000000000000" maxLength={15} inputMode="numeric" className="text-sm" />
              </div>
            </div>
          </div>

          {/* Specs — igual ao Estoque */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">⚙️ Especificações</p>
              <button onClick={buscarSpecs} disabled={buscandoIA} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-500/25 transition-colors disabled:opacity-50">
                <Sparkles size={12} />
                {buscandoIA ? 'Buscando...' : 'Buscar com IA'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['Processador','processor'],['RAM','ram'],['Bateria (mAh)','battery'],['Carregamento','charging'],['Tela','screen'],['Conectividade','connectivity'],['Câmera Traseira','camera_main'],['Câmera Frontal','camera_front'],['Sistema','os'],['Dimensões/Peso','dimensions']].map(([label, key]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input value={(form as Record<string,string>)[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder="—" className="text-sm" />
                </div>
              ))}
              {/* NFC */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)' }}>
                  <input type="checkbox" checked={form.nfc} onChange={e => setForm(f => ({ ...f, nfc: e.target.checked }))} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                  <span>Possui NFC</span>
                </label>
                <span className={`badge ${form.nfc ? 'badge-green' : 'badge-gray'}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {form.nfc
                    ? <><svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>NFC</>
                    : <><svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>Sem NFC</>
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Catálogo */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">🛍 Catálogo</p>
            <div className="grid grid-cols-1 gap-3">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, background: form.catalog_visible !== false ? 'rgba(37,99,235,.08)' : 'var(--bg-3)', border: `1px solid ${form.catalog_visible !== false ? 'rgba(37,99,235,.3)' : 'var(--border-1)'}` }}>
                <input type="checkbox" checked={form.catalog_visible !== false} onChange={e => setForm(f => ({ ...f, catalog_visible: e.target.checked }))} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: form.catalog_visible !== false ? 'var(--accent)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>{form.catalog_visible !== false ? <><Eye size={12} />Visível no Catálogo</> : <><EyeOff size={12} />Oculto do Catálogo</>}</p>
                  <p style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1 }}>{form.catalog_visible !== false ? 'DISPONÍVEL ou ESGOTADO conforme estoque' : 'Não aparece para clientes'}</p>
                </div>
              </label>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Observações</label>
                <textarea rows={2} value={form.catalog_description} onChange={e => setForm(f => ({ ...f, catalog_description: e.target.value }))} style={{ resize: 'none' }} placeholder="Ex: Compatível com carregador 67W..." className="text-sm" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={salvar} disabled={saving}>
              {saving ? 'Salvando...' : modal === 'novo' ? 'Cadastrar' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
