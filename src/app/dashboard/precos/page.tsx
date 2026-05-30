'use client'
import { useState, useEffect, useRef } from 'react'
import { Sparkles, MapPin, Search } from 'lucide-react'
import { sb, fR, callFn } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import type { Product } from '@/lib/types'

interface Grupo { brand: string; model: string; storage: string; preco: number; custo: number; rep: Product }

export default function PrecosPage() {
  const { user } = useAuth()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [cidadeQuery, setCidadeQuery] = useState('')
  const [cidadeSel, setCidadeSel] = useState('')
  const [cidades, setCidades] = useState<{ nome: string; uf: string }[]>([])
  const [cidadesFiltradas, setCidadesFiltradas] = useState<{ nome: string; uf: string }[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const [loading, setLoading] = useState(false)
  const [analise, setAnalise] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Agrupar produtos por brand+model+storage
    sb.from('products').select('id,brand,model,storage,cost_brl_unit,price_current').eq('status', 'ATIVO').order('brand')
      .then(({ data }) => {
        const map: Record<string, Grupo> = {}
        ;(data || []).forEach((p: Product) => {
          const k = `${p.brand}||${p.model}||${p.storage || ''}`
          if (!map[k]) map[k] = { brand: p.brand, model: p.model, storage: p.storage || '', preco: p.price_current || 0, custo: p.cost_brl_unit || 0, rep: p }
        })
        setGrupos(Object.values(map))
      })

    // Carregar cidades IBGE
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios')
      .then(r => r.json())
      .then(data => setCidades(data.map((c: { nome: string; microrregiao: { mesorregiao: { UF: { sigla: string } } } }) => ({
        nome: c.nome,
        uf: c.microrregiao?.mesorregiao?.UF?.sigla || ''
      }))))
      .catch(() => {})
  }, [])

  const buscarCidade = (q: string) => {
    setCidadeQuery(q)
    setCidadeSel('')
    if (q.length < 2) { setCidadesFiltradas([]); setShowDrop(false); return }
    const f = cidades.filter(c =>
      c.nome.toLowerCase().startsWith(q.toLowerCase()) ||
      c.nome.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 10)
    setCidadesFiltradas(f)
    setShowDrop(f.length > 0)
  }

  const selCidade = (c: { nome: string; uf: string }) => {
    setCidadeSel(`${c.nome}/${c.uf}`)
    setCidadeQuery(`${c.nome} — ${c.uf}`)
    setCidadesFiltradas([]); setShowDrop(false)
  }

  const analisar = async () => {
    if (!selectedKey) { toast('Selecione um produto', 'error'); return }
    const g = grupos.find(x => `${x.brand}||${x.model}||${x.storage}` === selectedKey)
    if (!g) return
    setLoading(true); setAnalise('')

    // Chamar a edge function com action analisar_preco
    const r = await callFn('ia-publicacao', {
      action: 'analisar_preco',
      produto_nome: `${g.brand} ${g.model}`,
      custo: g.custo,
      storage: g.storage,
      regiao: cidadeSel || 'Brasil',
    }, user?.id, user?.role)

    setLoading(false)
    if (r.error) { toast(r.error, 'error'); return }
    setAnalise(r.texto || r.analise || JSON.stringify(r))
  }

  const g = grupos.find(x => `${x.brand}||${x.model}||${x.storage}` === selectedKey)

  return (
    <div style={{ maxWidth: 640, width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="page-header">
        <h1 className="page-title">IA de Preços</h1>
        <p className="page-sub">Análise de arbitragem regional via OpenAI</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label">Produto (agrupado)</label>
          <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}>
            <option value="">Selecione um produto...</option>
            {grupos.map(g => (
              <option key={`${g.brand}||${g.model}||${g.storage}`} value={`${g.brand}||${g.model}||${g.storage}`}>
                {g.brand} {g.model}{g.storage ? ` ${g.storage}` : ''} — custo {fR(g.custo)}
              </option>
            ))}
          </select>
        </div>

        {g && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[['Custo BRL', fR(g.custo), 'var(--text-2)'], ['Preço Atual', fR(g.preco), 'var(--accent)'], ['Margem Est.', g.custo && g.preco ? ((g.preco - g.custo) / g.preco * 100).toFixed(1) + '%' : '—', 'var(--green)']].map(([l, v, c]) => (
              <div key={l as string} style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{l}</p>
                <p style={{ fontWeight: 700, fontSize: 14, color: c as string }}>{v}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ position: 'relative' }} ref={dropRef}>
          <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={11} />Região
            {cidadeSel && <span style={{ color: 'var(--accent)', fontSize: 10.5, fontWeight: 500 }}>✓ {cidadeSel}</span>}
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
            <input
              value={cidadeQuery}
              onChange={e => buscarCidade(e.target.value)}
              onFocus={() => cidadesFiltradas.length && setShowDrop(true)}
              placeholder="Digite o nome da cidade..."
              style={{ paddingLeft: 32 }}
            />
          </div>
          {showDrop && cidadesFiltradas.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 20, width: '100%', marginTop: 4, background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', maxHeight: 220, overflowY: 'auto' }}>
              {cidadesFiltradas.map((c, i) => (
                <button key={i} onClick={() => selCidade(c)} style={{ width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <span>{c.nome}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>{c.uf}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={analisar} disabled={loading || !selectedKey} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 13.5 }}>
          {loading
            ? <><div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.2)' }} />Analisando...</>
            : <><Sparkles size={15} />Analisar com IA</>
          }
        </button>
      </div>

      {analise && (
        <div className="card" style={{ borderColor: 'rgba(139,92,246,.2)', background: 'rgba(139,92,246,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={14} style={{ color: 'var(--purple)' }} />
            <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--purple)' }}>Análise de Arbitragem</p>
            {cidadeSel && <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 'auto' }}>📍 {cidadeSel}</span>}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{analise}</p>
        </div>
      )}
    </div>
  )
}
