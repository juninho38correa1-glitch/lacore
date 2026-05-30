'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Sparkles } from 'lucide-react'
import { sb, callFn, BRANDS, MODELS, STORAGES, COLORS, CATS } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'

export default function NovoProdutoPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [form, setForm] = useState({ brand: 'Apple', model: '', color: 'Preto', storage: '128GB', condition: 'Novo', imei: '', cost_usd: '', price_current: '', price_min: '', processor: '', ram: '', camera_main: '', camera_front: '', battery: '', screen: '' })
  const [fotos, setFotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [specsLoading, setSpecsLoading] = useState(false)

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const buscarSpecs = async () => {
    if (!form.brand || !form.model) { toast('Preencha marca e modelo primeiro', 'error'); return }
    setSpecsLoading(true)
    const r = await callFn('ia-publicacao', { action: 'buscar_specs', brand: form.brand, model: form.model, storage: form.storage }, user?.id, user?.role)
    setSpecsLoading(false)
    if (r.error) { toast(r.error, 'error'); return }
    const s = r.specs || {}
    setForm(p => ({ ...p, processor: s.processor || p.processor, ram: s.ram || p.ram, camera_main: s.camera_main || p.camera_main, camera_front: s.camera_front || p.camera_front, battery: s.battery || p.battery, screen: s.screen || p.screen }))
    toast('Specs preenchidas pela IA!', 'success')
  }

  const save = async () => {
    if (!form.model) { toast('Modelo é obrigatório', 'error'); return }
    setSaving(true)
    try {
      const id = crypto.randomUUID()
      const costBrl = parseFloat(form.cost_usd || '0') * 5.8
      const { error } = await sb.from('products').insert({
        id, brand: form.brand, model: form.model, category: CATS[form.brand] || 'Eletrônicos',
        color: form.color, storage: form.storage, condition: form.condition,
        imei: form.imei || null, cost_brl_unit: costBrl,
        price_current: parseFloat(form.price_current || '0') || Math.ceil(costBrl * 1.48 / 10) * 10,
        price_min: parseFloat(form.price_min || '0') || Math.ceil(costBrl * 1.15 / 10) * 10,
        processor: form.processor || null, ram: form.ram || null,
        camera_main: form.camera_main || null, camera_front: form.camera_front || null,
        battery: form.battery || null, screen: form.screen || null,
        quantity: 1, status: 'ATIVO', date_added: new Date().toISOString(),
      })
      if (error) throw error
      // Upload fotos
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i]
        const key = `${id}/${Date.now()}_${i}.${f.name.split('.').pop()}`
        const { data: up } = await sb.storage.from('product-photos').upload(key, f)
        if (up) {
          const { data: { publicUrl } } = sb.storage.from('product-photos').getPublicUrl(key)
          await sb.from('product_photos').insert({ product_id: id, url: publicUrl, storage_key: key, order: i })
        }
      }
      toast('Produto cadastrado!', 'success')
      router.push('/dashboard/estoque')
    } catch { toast('Erro ao cadastrar produto', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Novo Produto</h1><p className="text-gray-500 text-sm">Cadastro avulso de produto</p></div>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">← Voltar</button>
      </div>
      <div className="card space-y-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Identificação</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Marca</label>
            <select value={form.brand} onChange={e => { f('brand', e.target.value); f('model', '') }} className="text-sm">
              {BRANDS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Modelo *</label>
            <select value={form.model} onChange={e => f('model', e.target.value)} className="text-sm">
              <option value="">Selecione...</option>
              {(MODELS[form.brand] || []).map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Cor</label>
            <select value={form.color} onChange={e => f('color', e.target.value)} className="text-sm">
              {COLORS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Storage</label>
            <select value={form.storage} onChange={e => f('storage', e.target.value)} className="text-sm">
              {STORAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Condição</label>
            <select value={form.condition} onChange={e => f('condition', e.target.value)} className="text-sm">
              {['Novo','Seminovo A+','Seminovo A','Seminovo B'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">IMEI (opcional)</label>
            <input value={form.imei} onChange={e => f('imei', e.target.value)} placeholder="000000000000000" className="text-sm" />
          </div>
        </div>
      </div>
      <div className="card space-y-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Precificação</p>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-400 mb-1 block">Custo (USD)</label><input type="number" value={form.cost_usd} onChange={e => f('cost_usd', e.target.value)} placeholder="0.00" className="text-sm" /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">Preço de Venda</label><input type="number" value={form.price_current} onChange={e => f('price_current', e.target.value)} placeholder="Auto" className="text-sm" /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">Preço Mínimo</label><input type="number" value={form.price_min} onChange={e => f('price_min', e.target.value)} placeholder="Auto" className="text-sm" /></div>
        </div>
      </div>
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Especificações Técnicas</p>
          <button onClick={buscarSpecs} disabled={specsLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium disabled:opacity-50">
            <Sparkles size={12} />{specsLoading ? 'Buscando...' : 'Buscar com IA'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[['Processador','processor'],['RAM','ram'],['Câmera Principal','camera_main'],['Câmera Frontal','camera_front'],['Bateria','battery'],['Tela','screen']].map(([l, k]) => (
            <div key={k}><label className="text-xs text-gray-400 mb-1 block">{l}</label><input value={(form as Record<string, string>)[k]} onChange={e => f(k, e.target.value)} className="text-sm" /></div>
          ))}
        </div>
      </div>
      <div className="card space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fotos</p>
        <div className="flex gap-2 flex-wrap">
          {fotos.map((f, i) => <img key={i} src={URL.createObjectURL(f)} className="w-20 h-20 rounded-lg object-cover border border-white/10" />)}
          <label className="w-20 h-20 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-colors">
            <Camera size={16} className="text-gray-500 mb-1" /><span className="text-[10px] text-gray-600">+Foto</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => setFotos(p => [...p, ...Array.from(e.target.files || [])])} />
          </label>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg bg-white/5 text-gray-300 text-sm">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex-1 btn-primary py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-50">
          {saving ? 'Cadastrando...' : 'Cadastrar Produto'}
        </button>
      </div>
    </div>
  )
}
