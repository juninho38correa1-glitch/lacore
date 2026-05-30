'use client'
import { useState, useEffect } from 'react'
import { Sparkles, MapPin, DollarSign } from 'lucide-react'
import { sb, fR, callFn } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import type { Product } from '@/lib/types'

export const revalidate = 0

export default function PrecosPage() {
  const { user } = useAuth()
  const [prods, setProds] = useState<Product[]>([])
  const [cidades, setCidades] = useState<{ nome: string; microrregiao: { mesorregiao: { UF: { sigla: string } } } }[]>([])
  const [selectedProd, setSelectedProd] = useState('')
  const [cidadeQuery, setCidadeQuery] = useState('')
  const [cidadeSel, setCidadeSel] = useState('')
  const [cidadesFiltradas, setCidadesFiltradas] = useState<typeof cidades>([])
  const [mostraDropdown, setMostraDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [analise, setAnalise] = useState('')

  useEffect(() => {
    sb.from('products').select('id,brand,model,storage,cost_brl_unit,price_current').eq('status', 'ATIVO').order('brand').then(({ data }) => setProds((data || []) as Product[]))
    // Pré-carregar IBGE
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios')
      .then(r => r.json()).then(setCidades).catch(() => {})
  }, [])

  const buscarCidade = (q: string) => {
    setCidadeQuery(q)
    if (q.length < 2) { setCidadesFiltradas([]); return }
    const f = cidades.filter(c => c.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    setCidadesFiltradas(f)
    setMostraDropdown(true)
  }

  const selCidade = (c: typeof cidades[0]) => {
    const uf = c.microrregiao?.mesorregiao?.UF?.sigla || ''
    setCidadeSel(`${c.nome}/${uf}`)
    setCidadeQuery(`${c.nome}${uf ? ` - ${uf}` : ''}`)
    setCidadesFiltradas([])
    setMostraDropdown(false)
  }

  const analisar = async () => {
    if (!selectedProd) { toast('Selecione um produto', 'error'); return }
    const prod = prods.find(p => p.id === selectedProd)
    if (!prod) return
    setLoading(true); setAnalise('')
    const r = await callFn('ia-publicacao', {
      action: 'analisar_preco',
      produto_nome: `${prod.brand} ${prod.model}`,
      custo: prod.cost_brl_unit || 0,
      storage: prod.storage,
      regiao: cidadeSel || 'Brasil',
    }, user?.id, user?.role)
    setLoading(false)
    if (r.error) { toast(r.error, 'error'); return }
    setAnalise(r.texto || '')
  }

  const prod = prods.find(p => p.id === selectedProd)

  return (
    <div className="space-y-5 max-w-2xl">
      <div><h1 className="text-2xl font-bold text-white">IA de Preços</h1><p className="text-gray-500 text-sm mt-0.5">Análise de arbitragem regional via OpenAI</p></div>
      <div className="card space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block font-medium">Produto</label>
          <select value={selectedProd} onChange={e => setSelectedProd(e.target.value)} className="text-sm">
            <option value="">Selecione um produto...</option>
            {prods.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model}{p.storage ? ` ${p.storage}` : ''} — {fR(p.cost_brl_unit || 0)} custo</option>)}
          </select>
        </div>
        {prod && (
          <div className="grid grid-cols-3 gap-3">
            {[['Custo', fR(prod.cost_brl_unit || 0), 'text-gray-300'], ['Preço Atual', fR(prod.price_current || 0), 'text-cyan-300'], ['Margem Est.', prod.cost_brl_unit && prod.price_current ? ((prod.price_current - prod.cost_brl_unit) / prod.price_current * 100).toFixed(1) + '%' : '—', 'text-green-400']].map(([l, v, c]) => (
              <div key={l as string} className="p-3 rounded-lg bg-white/5 text-center">
                <p className="text-gray-500 text-xs">{l}</p>
                <p className={`font-bold ${c}`}>{v}</p>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <label className="text-xs text-gray-400 mb-1.5 block font-medium flex items-center gap-1"><MapPin size={12} />Região (busca cidade)</label>
          <input value={cidadeQuery} onChange={e => buscarCidade(e.target.value)} onFocus={() => cidadesFiltradas.length && setMostraDropdown(true)} placeholder="Ex: Maringá, São Paulo..." className="text-sm" />
          {mostraDropdown && cidadesFiltradas.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden shadow-xl">
              {cidadesFiltradas.map((c, i) => {
                const uf = c.microrregiao?.mesorregiao?.UF?.sigla || ''
                return <button key={i} onClick={() => selCidade(c)} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/8 transition-colors">{c.nome}{uf ? ` - ${uf}` : ''}</button>
              })}
            </div>
          )}
        </div>
        <button onClick={analisar} disabled={loading || !selectedProd} className="btn-primary w-full py-2.5 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analisando...</> : <><Sparkles size={15} />Analisar com IA</>}
        </button>
      </div>
      {analise && (
        <div className="card border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center gap-2 mb-3"><Sparkles size={15} className="text-purple-400" /><p className="text-sm font-semibold text-purple-300">Análise de Arbitragem</p></div>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{analise}</p>
        </div>
      )}
    </div>
  )
}
