'use client'
import { useState, useEffect } from 'react'
import { Sparkles, Copy, Check } from 'lucide-react'
import { sb, callFn } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import type { Product } from '@/lib/types'

export const revalidate = 0

const CANAIS = [
  { id: 'ml', label: '🛒 Mercado Livre' },
  { id: 'olx', label: '🟠 OLX' },
  { id: 'facebook', label: '👍 Facebook' },
  { id: 'whatsapp', label: '💬 WhatsApp' },
  { id: 'instagram', label: '📸 Instagram' },
]

export default function PublicacoesPage() {
  const { user } = useAuth()
  const [prods, setProds] = useState<Product[]>([])
  const [sel, setSel] = useState('')
  const [canal, setCanal] = useState('ml')
  const [extra, setExtra] = useState('')
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    sb.from('products').select('id,brand,model,color,storage,condition,price_current,cost_brl_unit,processor,ram,camera_main,camera_front,battery,screen').eq('status', 'ATIVO').order('brand').then(({ data }) => setProds((data || []) as Product[]))
  }, [])

  const gerar = async () => {
    if (!sel) { toast('Selecione um produto', 'error'); return }
    const prod = prods.find(p => p.id === sel)
    if (!prod) return
    setLoading(true); setTexto('')
    const r = await callFn('ia-publicacao', { action: 'gerar_texto', produto: prod, canal, extra }, user?.id, user?.role)
    setLoading(false)
    if (r.error) { toast(r.error, 'error'); return }
    setTexto(r.texto || '')
  }

  const copiar = () => {
    navigator.clipboard.writeText(texto)
    setCopied(true); toast('Texto copiado!', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const prod = prods.find(p => p.id === sel)

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-white">Publicações IA</h1><p className="text-gray-500 text-sm mt-0.5">Gere anúncios com IA para múltiplos canais</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Configuração */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Produto</label>
              <select value={sel} onChange={e => setSel(e.target.value)} className="text-sm">
                <option value="">Selecione o produto...</option>
                {prods.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} — {p.color} {p.storage}</option>)}
              </select>
            </div>
            {prod && (
              <div className="p-3 rounded-lg bg-white/5 text-xs space-y-1">
                {prod.processor && <p className="text-gray-400">Proc: <span className="text-white">{prod.processor}</span></p>}
                {prod.ram && <p className="text-gray-400">RAM: <span className="text-white">{prod.ram}</span></p>}
                {prod.camera_main && <p className="text-gray-400">Câm: <span className="text-white">{prod.camera_main}</span></p>}
                {prod.battery && <p className="text-gray-400">Bat: <span className="text-white">{prod.battery}</span></p>}
                {!prod.processor && <p className="text-yellow-400">⚠️ Sem specs — vá em Estoque → Editar e preencha as especificações primeiro</p>}
              </div>
            )}
            <div>
              <label className="text-xs text-gray-400 mb-2 block font-medium">Canal</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CANAIS.map(c => (
                  <button key={c.id} onClick={() => setCanal(c.id)} className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors ${canal === c.id ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-300'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">Informações extras (opcional)</label>
              <textarea rows={2} value={extra} onChange={e => setExtra(e.target.value)} placeholder="Ex: aceita troca, entrega em mãos, parcelamento no cartão..." className="text-sm resize-none" />
            </div>
            <button onClick={gerar} disabled={loading || !sel} className="btn-primary w-full py-2.5 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Gerando...</> : <><Sparkles size={15} />Gerar com IA</>}
            </button>
          </div>
        </div>

        {/* Resultado */}
        <div className="card min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Texto Gerado</p>
            {texto && (
              <button onClick={copiar} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${copied ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-white/8 text-gray-300 hover:bg-white/15 border border-white/10'}`}>
                {copied ? <><Check size={12} />Copiado!</> : <><Copy size={12} />Copiar</>}
              </button>
            )}
          </div>
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center"><div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-2" /><p className="text-gray-500 text-xs">Gerando anúncio...</p></div>
            </div>
          )}
          {!loading && !texto && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div><Sparkles size={32} className="text-gray-700 mx-auto mb-2" /><p className="text-gray-600 text-sm">Selecione um produto e canal, depois clique em Gerar</p></div>
            </div>
          )}
          {texto && !loading && (
            <textarea readOnly value={texto} className="flex-1 min-h-[250px] resize-none text-sm leading-relaxed bg-white/3 border-white/8 text-gray-200" />
          )}
        </div>
      </div>
    </div>
  )
}
