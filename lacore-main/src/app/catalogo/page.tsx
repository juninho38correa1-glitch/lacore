'use client'
import { useState, useEffect } from 'react'
import { Search, MessageCircle, X, ChevronLeft } from 'lucide-react'
import { sb, fR, WA_NUMBER } from '@/lib/supabase'
import type { Product, ProductPhoto } from '@/lib/types'

interface Grupo {
  key: string; brand: string; model: string; storage: string
  rep: Product; cores: string[]; qtd: number
}

export default function CatalogoPage() {
  const [allProds, setAllProds] = useState<Product[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [ordem, setOrdem] = useState('recentes')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<Product | null>(null)
  const [mainImg, setMainImg] = useState('')
  const [corModal, setCorModal] = useState<Grupo | null>(null)

  const load = async () => {
    const { data } = await sb.from('products').select('*,photos:product_photos(*)').eq('status', 'ATIVO').order('date_added', { ascending: false })
    const prods = ((data || []) as Product[]).filter(p => p.catalog_visible !== false)
    setAllProds(prods)
    setGrupos(agrupar(prods))
    setLoading(false)
  }

  const agrupar = (prods: Product[]): Grupo[] => {
    const map: Record<string, Grupo> = {}
    prods.forEach(p => {
      const k = `${p.brand}|${p.model}|${p.storage || ''}`
      if (!map[k]) map[k] = { key: k, brand: p.brand, model: p.model, storage: p.storage || '', rep: p, cores: [], qtd: 0 }
      map[k].qtd++
      if (p.color && !map[k].cores.includes(p.color)) map[k].cores.push(p.color)
      if ((p.photos || []).length > (map[k].rep.photos || []).length) map[k].rep = p
    })
    return Object.values(map)
  }

  const filtrados = () => {
    let list = [...grupos]
    if (busca) { const q = busca.toLowerCase(); list = list.filter(g => `${g.brand} ${g.model} ${g.storage} ${g.cores.join(' ')}`.toLowerCase().includes(q)) }
    if (filtro === 'destaques') list = list.filter(g => g.rep.catalog_highlight)
    else if (filtro !== 'todos') list = list.filter(g => g.brand === filtro)
    if (ordem === 'menor') list.sort((a, b) => (a.rep.price_current || 0) - (b.rep.price_current || 0))
    else if (ordem === 'maior') list.sort((a, b) => (b.rep.price_current || 0) - (a.rep.price_current || 0))
    else if (ordem === 'az') list.sort((a, b) => `${a.brand}${a.model}`.localeCompare(`${b.brand}${b.model}`))
    return list
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (modal) setMainImg((modal.photos || []).sort((a, b) => a.order - b.order)[0]?.url || '') }, [modal])

  const abrirGrupo = (g: Grupo) => {
    if (g.cores.length <= 1) setModal(g.rep)
    else setCorModal(g)
  }

  const waMsg = (p: Product, g?: Grupo) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/catalogo`
    const msg = `Olá! Tenho interesse em:\n\n*${p.brand} ${p.model}*\n${p.storage || ''}${p.color ? '\nCor: ' + p.color : ''}\nCondição: ${p.condition || 'Novo'}\n${p.price_current ? 'Valor: ' + fR(p.price_current) : 'Valor a consultar'}${g && g.qtd > 1 ? '\nEstoque: ' + g.qtd + ' unidades' : ''}\n\n${url}`
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const brands = [...new Set(allProds.map(p => p.brand))]
  const list = filtrados()

  return (
    <div className="min-h-screen bg-[#060810]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#060810]/95 backdrop-blur border-b border-white/6">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/catalogo" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-cyan flex items-center justify-center">
              <svg width="18" height="16" viewBox="0 0 40 36" fill="none"><defs><linearGradient id="clg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff"/><stop offset="100%" stopColor="#6a8fa8"/></linearGradient></defs><path d="M4 4L4 28L18 28" stroke="url(#clg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 4C22 4 37 4 37 18C37 28 30 28 30 28" stroke="url(#clg)" strokeWidth="4" strokeLinecap="round"/></svg>
            </div>
            <div><p className="text-white font-bold text-sm tracking-widest">LACORE</p><p className="text-[9px] text-gray-600 tracking-wider uppercase">Tecnologia no seu Nível</p></div>
          </a>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..." className="pl-8 w-44 text-xs py-1.5 bg-white/5 border-white/10" />
            </div>
            <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#25d366] to-[#128c7e] text-white text-xs font-bold">
              <MessageCircle size={13} />WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center py-12 px-4" style={{ background: 'radial-gradient(ellipse at 50% 0%,rgba(14,165,233,.08) 0%,transparent 60%)' }}>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-widest uppercase mb-2" style={{ background: 'linear-gradient(180deg,#fff 0%,#c8d8e8 50%,#8aaabb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Catálogo de Produtos
        </h1>
        <p className="text-gray-500 text-sm">Smartphones premium • Garantia • Qualidade assegurada</p>
        <div className="w-16 h-0.5 mx-auto mt-4" style={{ background: 'linear-gradient(90deg,transparent,#0ea5e9,transparent)' }} />
      </section>

      {/* Filtros */}
      <div className="max-w-6xl mx-auto px-4 pb-4 flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Filtrar:</span>
        {[['todos', 'Todos'], ...brands.map(b => [b, b]), ['destaques', '⭐ Destaques']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)} className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filtro === v ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-white/4 border-white/10 text-gray-500 hover:text-gray-300'}`}>{l}</button>
        ))}
        <select value={ordem} onChange={e => setOrdem(e.target.value)} className="ml-auto text-xs py-1.5 px-2 rounded-lg bg-white/5 border-white/10 text-gray-400">
          <option value="recentes">Mais recentes</option>
          <option value="menor">Menor preço</option>
          <option value="maior">Maior preço</option>
          <option value="az">A - Z</option>
        </select>
      </div>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        <p className="text-gray-600 text-xs mb-4">{list.length} modelo(s) disponível(is)</p>
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" /></div>
        ) : !list.length ? (
          <div className="text-center py-20 text-gray-600"><p className="text-4xl mb-4">📦</p><p>Nenhum produto encontrado</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {list.map((g, i) => {
              const p = g.rep
              const photo = (p.photos || []).sort((a, b) => a.order - b.order)[0]
              const badge = p.catalog_highlight ? { cls: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300', txt: p.catalog_label || 'Destaque' } : p.catalog_label === 'Promoção' ? { cls: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300', txt: 'Promoção' } : p.condition === 'Novo' ? { cls: 'bg-green-500/15 border-green-500/30 text-green-300', txt: 'Novo' } : p.condition?.startsWith('Seminovo') ? { cls: 'bg-purple-500/12 border-purple-500/30 text-purple-300', txt: 'Seminovo' } : null
              const coresStr = g.cores.length <= 3 ? g.cores.join(', ') : g.cores.slice(0, 2).join(', ') + ` +${g.cores.length - 2}`
              return (
                <div key={i} onClick={() => abrirGrupo(g)} className="relative bg-[#0b0d14] border border-white/6 rounded-xl overflow-hidden cursor-pointer transition-all hover:border-cyan-500/30 hover:-translate-y-1 hover:shadow-xl">
                  {badge && <span className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>{badge.txt}</span>}
                  {g.qtd > 1 && <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">{g.qtd} un.</span>}
                  <div className="aspect-square bg-[#0f1117] flex items-center justify-center overflow-hidden">
                    {photo ? <img src={photo.url} alt={`${p.brand} ${p.model}`} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" /> : <span className="text-4xl opacity-20">📱</span>}
                  </div>
                  <div className="p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-0.5">{p.brand}</p>
                    <p className="text-white text-xs font-semibold leading-tight mb-2 line-clamp-2">{p.model}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {p.storage && <span className="text-[9px] bg-white/6 px-1.5 py-0.5 rounded text-gray-500">{p.storage}</span>}
                      {coresStr && <span className="text-[9px] bg-white/6 px-1.5 py-0.5 rounded text-gray-500">{coresStr}</span>}
                    </div>
                    <p className="text-cyan-300 font-bold text-base leading-none">{p.price_current ? fR(p.price_current) : 'Consultar'}</p>
                    {p.price_current && p.catalog_installments ? <p className="text-[10px] text-gray-600 mt-0.5">ou {fR(p.price_current / p.catalog_installments)}/mês em {p.catalog_installments}x</p> : null}
                  </div>
                  <div className="px-3 pb-3 flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModal(g.rep)} className="flex-1 py-1.5 rounded-lg text-white text-[11px] font-bold bg-gradient-to-r from-[#0ea5e9] to-[#0284c7]">Ver detalhes</button>
                    <button onClick={() => waMsg(g.rep, g)} className="py-1.5 px-2 rounded-lg text-xs text-[#25d366] bg-[#25d366]/10 border border-[#25d366]/20">💬</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/6 py-8 text-center">
        <p className="font-bold tracking-widest text-gray-600 text-sm">LACORE</p>
        <p className="text-gray-700 text-[10px] tracking-wider mt-1">— Tecnologia no seu Nível —</p>
        <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full bg-[#25d366]/10 border border-[#25d366]/20 text-[#25d366] text-xs font-medium">
          💬 Fale conosco pelo WhatsApp
        </a>
      </footer>

      {/* Modal produto */}
      {modal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setModal(null); window.history.pushState(null, '', '/catalogo') }}>
          <div className="w-full sm:max-w-xl bg-[#0d1117] rounded-t-2xl sm:rounded-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 sm:hidden" />
            {/* Galeria */}
            <div className="bg-[#0f1117]">
              {mainImg ? <img src={mainImg} className="w-full aspect-video object-cover" alt="" /> : <div className="w-full aspect-video flex items-center justify-center text-6xl opacity-10">📱</div>}
              {(modal.photos || []).length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {(modal.photos || []).sort((a, b) => a.order - b.order).map((ph, i) => (
                    <img key={i} src={ph.url} onClick={() => setMainImg(ph.url)} className={`w-12 h-12 rounded-lg object-cover cursor-pointer border-2 flex-shrink-0 transition-colors ${mainImg === ph.url ? 'border-cyan-400' : 'border-transparent'}`} />
                  ))}
                </div>
              )}
            </div>
            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">{modal.brand}</p>
              <h2 className="text-xl font-bold text-white mb-1">{modal.model}</h2>
              <p className="text-gray-500 text-sm mb-4">{[modal.storage, modal.color, modal.condition].filter(Boolean).join(' — ')}</p>
              <div className="p-4 rounded-xl bg-white/3 border border-white/8 mb-4">
                <p className="text-3xl font-bold text-cyan-300">{modal.price_current ? fR(modal.price_current) : 'Consultar preço'}</p>
                {modal.price_current && modal.catalog_installments ? <p className="text-gray-500 text-xs mt-1">ou <span className="text-green-400 font-semibold">{fR(modal.price_current / modal.catalog_installments)} em até {modal.catalog_installments}x</span> sem juros</p> : null}
              </div>
              {(modal.processor || modal.ram || modal.camera_main || modal.battery || modal.screen) && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[['Processador', modal.processor], ['RAM', modal.ram], ['Câmera', modal.camera_main], ['Frontal', modal.camera_front], ['Bateria', modal.battery], ['Tela', modal.screen]].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l as string} className="bg-white/3 rounded-lg p-2.5"><p className="text-[9px] uppercase tracking-wider text-gray-600 mb-0.5">{l}</p><p className="text-white text-xs font-semibold">{v}</p></div>
                  ))}
                </div>
              )}
              {modal.catalog_description && <p className="text-gray-400 text-sm leading-relaxed mb-4 p-3 bg-white/3 rounded-lg">{modal.catalog_description}</p>}
              {modal.catalog_warranty && <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/8 border border-green-500/15 rounded-lg p-3 mb-4">🛡️ {modal.catalog_warranty}</div>}
              <div className="flex gap-2 sticky bottom-0 bg-[#0d1117] py-3 -mx-5 px-5 border-t border-white/6 -mb-5">
                <button onClick={() => waMsg(modal)} className="flex-1 py-3 rounded-xl font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg,#25d366,#128c7e)' }}>💬 Comprar pelo WhatsApp</button>
                <button onClick={() => { setModal(null) }} className="py-3 px-4 rounded-xl bg-white/8 border border-white/10 text-gray-400 text-lg">✕</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal seletor de cor */}
      {corModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCorModal(null)}>
          <div className="w-full sm:max-w-sm bg-[#0d1117] rounded-t-2xl sm:rounded-xl p-5" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4 sm:hidden" />
            <p className="text-white font-bold mb-1">{corModal.brand} {corModal.model}</p>
            <p className="text-gray-500 text-xs mb-4">Escolha a cor disponível:</p>
            <div className="grid grid-cols-3 gap-2">
              {corModal.cores.map(cor => {
                const unids = allProds.filter(p => p.brand === corModal.brand && p.model === corModal.model && (p.storage || '') === corModal.storage && p.color === cor)
                const rep = unids.find(p => (p.photos || []).length > 0) || unids[0]
                const foto = rep && (rep.photos || []).length > 0 ? (rep.photos || []).sort((a, b) => a.order - b.order)[0] : null
                return (
                  <button key={cor} onClick={() => { if (rep) { setModal(rep); setCorModal(null) } }} className="bg-white/4 border border-white/10 rounded-xl p-2 text-center hover:border-cyan-500/40 transition-colors">
                    {foto ? <img src={foto.url} className="w-14 h-14 rounded-lg object-cover mx-auto mb-1" /> : <div className="w-14 h-14 rounded-lg bg-white/8 flex items-center justify-center text-xl mx-auto mb-1">📱</div>}
                    <p className="text-white text-[10px] font-semibold">{cor}</p>
                    <p className="text-gray-600 text-[9px]">{unids.length} un.</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
