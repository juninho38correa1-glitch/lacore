'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Sparkles } from 'lucide-react'
import { sb, callFn, BRANDS, STORAGES, COLORS, CATS } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'

export default function NovoProdutoPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [form, setForm] = useState({
    brand: 'Apple', model: '', color: 'Preto', storage: '128GB',
    condition: 'Novo', imei: '', cost_usd: '', price_current: '', price_min: '',
    processor: '', ram: '', camera_main: '', camera_front: '', battery: '', screen: '',
  })
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
    setForm(p => ({ ...p,
      processor: s.processor || p.processor, ram: s.ram || p.ram,
      camera_main: s.camera_main || p.camera_main, camera_front: s.camera_front || p.camera_front,
      battery: s.battery || p.battery, screen: s.screen || p.screen,
    }))
    toast('Specs preenchidas!', 'success')
  }

  const save = async () => {
    if (!form.model.trim()) { toast('Modelo é obrigatório', 'error'); return }
    setSaving(true)
    try {
      const id = crypto.randomUUID()
      const costBrl = parseFloat(form.cost_usd || '0') * 5.8
      const { error } = await sb.from('products').insert({
        id, brand: form.brand, model: form.model.trim(),
        category: CATS[form.brand] || 'Eletrônicos',
        color: form.color, storage: form.storage, condition: form.condition,
        imei: form.imei || null,
        cost_brl_unit: costBrl,
        price_current: parseFloat(form.price_current || '0') || Math.ceil(costBrl * 1.48 / 10) * 10,
        price_min: parseFloat(form.price_min || '0') || Math.ceil(costBrl * 1.15 / 10) * 10,
        processor: form.processor || null, ram: form.ram || null,
        camera_main: form.camera_main || null, camera_front: form.camera_front || null,
        battery: form.battery || null, screen: form.screen || null,
        quantity: 1, status: 'ATIVO', date_added: new Date().toISOString(),
      })
      if (error) throw error
      for (let i = 0; i < fotos.length; i++) {
        const file = fotos[i]
        const key = `${id}/${Date.now()}_${i}.${file.name.split('.').pop()}`
        const { data: up } = await sb.storage.from('product-photos').upload(key, file)
        if (up) {
          const { data: { publicUrl } } = sb.storage.from('product-photos').getPublicUrl(key)
          await sb.from('product_photos').insert({ product_id: id, url: publicUrl, storage_key: key, order: i })
        }
      }
      toast('Produto cadastrado!', 'success')
      router.push('/dashboard/estoque')
    } catch (e) { console.error(e); toast('Erro ao cadastrar', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h1 className="page-title">Novo Produto</h1><p className="page-sub">Cadastro avulso</p></div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ color: 'var(--text-3)' }}>← Voltar</button>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)' }}>Identificação</p>
        <div className="form-grid-2" style={{ gap: 12 }}>
          <div>
            <label className="label">Marca</label>
            <select value={form.brand} onChange={e => f('brand', e.target.value)}>
              {BRANDS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Modelo *</label>
            {/* Campo aberto — sem lista suspensa */}
            <input value={form.model} onChange={e => f('model', e.target.value)} placeholder="Ex: iPhone 15 Pro, Galaxy S24..." />
          </div>
          <div>
            <label className="label">Cor</label>
            <select value={form.color} onChange={e => f('color', e.target.value)}>
              {COLORS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Storage</label>
            <select value={form.storage} onChange={e => f('storage', e.target.value)}>
              {STORAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Condição</label>
            <select value={form.condition} onChange={e => f('condition', e.target.value)}>
              {['Novo','Seminovo A+','Seminovo A','Seminovo B'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">IMEI (opcional)</label>
            <input value={form.imei} onChange={e => f('imei', e.target.value)} placeholder="000000000000000" />
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)' }}>Precificação</p>
        <div className="form-grid-3" style={{ gap: 12 }}>
          <div><label className="label">Custo (USD)</label><input type="number" value={form.cost_usd} onChange={e => f('cost_usd', e.target.value)} placeholder="0.00" /></div>
          <div><label className="label">Preço de Venda</label><input type="number" value={form.price_current} onChange={e => f('price_current', e.target.value)} placeholder="Auto" /></div>
          <div><label className="label">Preço Mínimo</label><input type="number" value={form.price_min} onChange={e => f('price_min', e.target.value)} placeholder="Auto" /></div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)' }}>Especificações Técnicas</p>
          <button onClick={buscarSpecs} disabled={specsLoading || !form.model} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--purple)' }}>
            <Sparkles size={12} />{specsLoading ? 'Buscando...' : 'Buscar com IA'}
          </button>
        </div>
        <div className="form-grid-2" style={{ gap: 10 }}>
          {[['Processador','processor'],['RAM','ram'],['Câmera Principal','camera_main'],['Câmera Frontal','camera_front'],['Bateria','battery'],['Tela','screen']].map(([l, k]) => (
            <div key={k}><label className="label">{l}</label><input value={(form as Record<string,string>)[k]} onChange={e => f(k, e.target.value)} placeholder="—" /></div>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)' }}>Fotos</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {fotos.map((file, i) => (
            <img key={i} src={URL.createObjectURL(file)} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-1)' }} />
          ))}
          <label style={{ width: 80, height: 80, borderRadius: 8, border: '1px dashed var(--border-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'border-color .12s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,.4)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'}
          >
            <Camera size={16} style={{ color: 'var(--text-4)', marginBottom: 4 }} />
            <span style={{ fontSize: 10, color: 'var(--text-4)' }}>+Foto</span>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => setFotos(p => [...p, ...Array.from(e.target.files || [])])} />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={() => router.back()}>Cancelar</button>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={save} disabled={saving}>
          {saving ? <><div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.2)' }} />Cadastrando...</> : 'Cadastrar Produto'}
        </button>
      </div>
    </div>
  )
}
