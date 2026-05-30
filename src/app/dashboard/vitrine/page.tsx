'use client'
import { useState, useEffect } from 'react'
import { Search, ExternalLink, Eye, EyeOff, Star } from 'lucide-react'
import { sb, fR } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/types'


export default function VitrineAdminPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [prods, setProds] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { if (!isAdmin()) router.push('/dashboard') }, [isAdmin])

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('products').select('*,photos:product_photos(*)').eq('status', 'ATIVO').order('brand')
    setProds((data || []) as Product[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggle = async (id: string, field: 'catalog_visible' | 'catalog_highlight', val: boolean) => {
    await sb.from('products').update({ [field]: val }).eq('id', id)
    setProds(p => p.map(x => x.id === id ? { ...x, [field]: val } : x))
    toast(field === 'catalog_visible' ? (val ? 'Visível no catálogo' : 'Oculto do catálogo') : (val ? 'Destaque ativado' : 'Destaque removido'), 'success')
  }

  // Agrupar por brand+model+storage
  const grupos = Object.values(prods.reduce((m, p) => {
    const k = `${p.brand}||${p.model}||${p.storage || ''}`
    if (!m[k]) m[k] = { key: k, brand: p.brand, model: p.model, storage: p.storage || '', items: [], rep: p }
    m[k].items.push(p)
    if ((p.photos || []).length > (m[k].rep.photos || []).length) m[k].rep = p
    return m
  }, {} as Record<string, { key: string; brand: string; model: string; storage: string; items: Product[]; rep: Product }>))
    .filter(g => !search || `${g.brand} ${g.model}`.toLowerCase().includes(search.toLowerCase()))

  const catalogCount = prods.filter(p => p.catalog_visible !== false).length
  const highlightCount = prods.filter(p => p.catalog_highlight).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div><h1 className="text-2xl font-bold text-white">Vitrine / Catálogo</h1><p className="text-gray-500 text-sm mt-0.5">Gestão da loja pública</p></div>
        <a href="/catalogo" target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-colors">
          <ExternalLink size={13} />Ver Catálogo
        </a>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="card"><p className="text-gray-500 text-xs">Total em estoque</p><p className="text-white font-bold text-xl">{prods.length}</p></div>
        <div className="card"><p className="text-gray-500 text-xs">Visíveis no catálogo</p><p className="text-green-400 font-bold text-xl">{catalogCount}</p></div>
        <div className="card"><p className="text-gray-500 text-xs">Em destaque</p><p className="text-yellow-400 font-bold text-xl">{highlightCount}</p></div>
      </div>
      <div className="relative max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar produtos..." className="pl-9 text-sm" /></div>
      {loading ? <div className="flex justify-center p-16"><div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" /></div> : (
        <div className="card p-0 overflow-hidden">
          <table>
            <thead><tr>
              <th>Produto</th><th>Qtd</th><th>Preço</th>
              <th className="text-center">Visível</th>
              <th className="text-center">Destaque</th>
              <th>Config</th>
            </tr></thead>
            <tbody>
              {!grupos.length && <tr><td colSpan={6} className="text-center py-10 text-gray-600">Nenhum produto</td></tr>}
              {grupos.map(g => {
                const rep = g.rep
                const photo = (rep.photos || []).sort((a, b) => a.order - b.order)[0]
                const visible = rep.catalog_visible !== false
                const highlight = rep.catalog_highlight === true
                const allIds = g.items.map(p => p.id)
                return (
                  <tr key={g.key}>
                    <td>
                      <div className="flex items-center gap-2">
                        {photo ? <img src={photo.url} className="w-9 h-9 rounded-lg object-contain flex-shrink-0" /> : <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-lg flex-shrink-0">📱</div>}
                        <div>
                          <p className="text-white font-semibold text-sm">{g.brand} {g.model}</p>
                          <p className="text-gray-500 text-xs">{g.storage}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-gray-300">{g.items.length}</td>
                    <td className="font-mono text-cyan-300 text-sm">{fR(rep.price_current || 0)}</td>
                    <td className="text-center">
                      <button onClick={async () => { const newVal = !visible; for (const id of allIds) await sb.from('products').update({ catalog_visible: newVal }).eq('id', id); load(); toast(newVal ? 'Visível no catálogo' : 'Oculto do catálogo', 'success') }} className={`p-1.5 rounded-lg transition-colors ${visible ? 'text-green-400 hover:bg-green-500/15' : 'text-gray-600 hover:bg-white/8'}`}>
                        {visible ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                    </td>
                    <td className="text-center">
                      <button onClick={async () => { const newVal = !highlight; for (const id of allIds) await sb.from('products').update({ catalog_highlight: newVal }).eq('id', id); load(); toast(newVal ? 'Destaque ativado' : 'Destaque removido', 'success') }} className={`p-1.5 rounded-lg transition-colors ${highlight ? 'text-yellow-400 hover:bg-yellow-500/15' : 'text-gray-600 hover:bg-white/8'}`}>
                        <Star size={15} fill={highlight ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td>
                      <button onClick={() => router.push(`/dashboard/estoque`)} className="text-xs text-cyan-400 hover:underline">Editar →</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
