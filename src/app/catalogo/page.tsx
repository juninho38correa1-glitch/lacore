'use client'
import { useState, useEffect } from 'react'
import { Search, MessageCircle, X, ChevronDown, ChevronUp, Smartphone } from 'lucide-react'
import { sb, fR, WA_NUMBER } from '@/lib/supabase'
import type { Product } from '@/lib/types'

// ── Taxas reais InfinityPay (repasse ao cliente, plano até 80k/mês, Visa/Master)
// Fonte: infinitepay.io/taxas — atualizado mai/2026
const TAXAS_IP: Record<number, number> = {
  1: 2.69, 2: 3.94, 3: 4.46, 4: 4.98,
  5: 5.49, 6: 5.99, 7: 6.51, 8: 6.99,
  9: 7.51, 10: 7.99, 11: 8.49, 12: 8.99,
}

// Calcula valor que o cliente paga com repasse de taxa
function calcParcela(preco: number, parcelas: number) {
  const taxa = TAXAS_IP[parcelas] / 100
  const totalCliente = preco / (1 - taxa)
  return { total: totalCliente, parcela: totalCliente / parcelas }
}

interface Grupo {
  key: string; brand: string; model: string; storage: string
  rep: Product; cores: string[]; qtd: number
}

export default function CatalogoPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [ordem, setOrdem] = useState('recentes')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<Product | null>(null)
  const [mainImg, setMainImg] = useState('')
  const [corModal, setCorModal] = useState<Grupo | null>(null)
  const [parcelaSel, setParcelaSel] = useState(12)
  const [mostrarSimulador, setMostrarSimulador] = useState(false)

  const load = async () => {
    const { data } = await sb.from('products').select('*,photos:product_photos(*)').eq('status', 'ATIVO').order('date_added', { ascending: false })
    const prods = ((data || []) as Product[]).filter(p => p.catalog_visible !== false)
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

  const marcas = [...new Set(grupos.map(g => g.brand))].sort()

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (modal) {
      setMainImg((modal.photos || []).sort((a, b) => a.order - b.order)[0]?.url || '')
      setParcelaSel(12)
      setMostrarSimulador(false)
    }
  }, [modal])

  const abrirGrupo = (g: Grupo) => {
    if (g.cores.length <= 1) setModal(g.rep)
    else setCorModal(g)
  }

  // WhatsApp com mensagem personalizada do produto
  const abrirWA = (prod?: Product | null) => {
    let msg = ''
    if (prod) {
      const preco = fR(prod.price_current || 0)
      const parc = calcParcela(prod.price_current || 0, 12)
      msg = `Olá! Vi o *${prod.brand} ${prod.model}${prod.storage ? ` ${prod.storage}` : ''}${prod.color ? ` — ${prod.color}` : ''}* no catálogo da LACORE Store por *${preco}* à vista (ou ${fR(parc.parcela)}/mês em até 12x) e tenho interesse! Ainda está disponível?`
    } else {
      msg = `Olá! Acessei o catálogo da LACORE Store e gostaria de saber mais sobre os produtos disponíveis.`
    }
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const preco = modal?.price_current || 0
  const simCalc = calcParcela(preco, parcelaSel)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font)' }}>
      {/* Header */}
      <header style={{ background: 'rgba(12,14,20,.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-1)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(59,130,246,.3)', flexShrink: 0 }}>
              <svg width="14" height="13" viewBox="0 0 40 36" fill="none">
                <path d="M4 4L4 28L18 28" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 4C22 4 37 4 37 18C37 28 30 28 30 28" stroke="white" strokeWidth="5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '.1em', color: 'var(--text-1)', lineHeight: 1 }}>LACORE</p>
              <p style={{ fontSize: 9, color: 'var(--text-4)', letterSpacing: '.06em', lineHeight: 1, marginTop: 2 }}>STORE</p>
            </div>
          </div>
          <button onClick={() => abrirWA()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 99, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.25)', color: '#25d366', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 }}>
            <MessageCircle size={13} />Falar no WhatsApp
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 48px' }}>
        {/* Busca + filtros */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..." style={{ paddingLeft: 32, background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 10, color: 'var(--text-1)', fontSize: 13 }} />
          </div>
          <select value={ordem} onChange={e => setOrdem(e.target.value)} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 10, color: 'var(--text-2)', fontSize: 12, padding: '8px 10px', width: 'auto' }}>
            <option value="recentes">Mais recentes</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="az">A–Z</option>
          </select>
        </div>

        {/* Filtros de marca */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {['todos', 'destaques', ...marcas].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding: '4px 14px', borderRadius: 99, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', border: '1px solid', transition: 'all .12s', background: filtro === f ? 'rgba(59,130,246,.12)' : 'transparent', borderColor: filtro === f ? 'rgba(59,130,246,.35)' : 'var(--border-1)', color: filtro === f ? 'var(--accent)' : 'var(--text-4)', textTransform: 'capitalize' }}>
              {f === 'todos' ? 'Todos' : f === 'destaques' ? '⭐ Destaques' : f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className="catalog-grid-responsive">
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ background: 'var(--bg-1)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-1)' }}>
                <div style={{ aspectRatio: '1', background: 'var(--bg-2)', animation: 'skeleton-shimmer 1.4s ease infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%)' }} />
                <div style={{ padding: 12 }}>
                  <div style={{ height: 12, width: '60%', background: 'var(--bg-3)', borderRadius: 4, marginBottom: 8, animation: 'skeleton-shimmer 1.4s ease infinite', backgroundSize: '200% 100%' }} />
                  <div style={{ height: 18, width: '40%', background: 'var(--bg-3)', borderRadius: 4, animation: 'skeleton-shimmer 1.4s ease infinite', backgroundSize: '200% 100%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className="catalog-grid-responsive">
            {filtrados().map(g => {
              const p = g.rep
              const foto = (p.photos || []).sort((a, b) => a.order - b.order)[0]?.url
              const parc12 = calcParcela(p.price_current || 0, 12)
              return (
                <div key={g.key} onClick={() => abrirGrupo(g)} className="card-hover" style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}>
                  {/* Foto */}
                  <div style={{ position: 'relative', background: 'var(--bg-2)', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {foto ? (
                      <img src={foto} alt={`${p.brand} ${p.model}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 10 }} />
                    ) : (
                      <Smartphone size={40} style={{ color: 'var(--border-2)' }} />
                    )}
                    {p.catalog_highlight && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, letterSpacing: '.04em' }}>DESTAQUE</div>
                    )}
                    {p.catalog_label && (
                      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(245,158,11,.15)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,.25)', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>{p.catalog_label}</div>
                    )}
                    {g.qtd > 1 && (
                      <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.6)', color: 'var(--text-3)', fontSize: 9, padding: '2px 6px', borderRadius: 6 }}>{g.qtd} un.</div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 2 }}>{p.brand}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3, marginBottom: 4 }}>{p.model}{p.storage ? ` ${p.storage}` : ''}</p>
                    {g.cores.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {g.cores.map(c => <span key={c} style={{ fontSize: 9.5, color: 'var(--text-4)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>{c}</span>)}
                      </div>
                    )}
                    {p.price_current ? (
                      <>
                        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fR(p.price_current)}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
                          ou <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fR(parc12.parcela)}/mês</span> em 12x c/ juros
                        </p>
                      </>
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Consulte o preço</p>
                    )}
                  </div>
                </div>
              )
            })}
            {!filtrados().length && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 24px' }}>
                <p style={{ color: 'var(--text-4)', fontSize: 14 }}>Nenhum produto encontrado</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal seleção de cor */}
      {corModal && (
        <div onClick={() => setCorModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)', zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--bg-1)', borderRadius: '16px 16px 0 0', padding: '20px 20px 32px', border: '1px solid var(--border-2)' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border-2)', borderRadius: 99, margin: '0 auto 16px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{corModal.brand} {corModal.model}</p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 16 }}>Selecione a cor</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {corModal.cores.map(cor => {
                const prod = corModal.rep
                return (
                  <button key={cor} onClick={() => { setModal(prod); setCorModal(null) }} style={{ padding: '12px', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', transition: 'border-color .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,.4)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'}
                  >
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{cor}</p>
                    {prod.price_current && <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>{fR(prod.price_current)}</p>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal produto */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: '20px 20px 0 0', maxHeight: '94dvh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border-2)', borderRadius: 99, margin: '12px auto 0' }} />
            
            {/* Foto principal */}
            <div style={{ position: 'relative', background: 'var(--bg-2)', margin: '12px 16px 0', borderRadius: 14, overflow: 'hidden', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mainImg ? (
                <img src={mainImg} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }} />
              ) : (
                <Smartphone size={60} style={{ color: 'var(--border-2)' }} />
              )}
              <button onClick={() => setModal(null)} style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 99, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} />
              </button>
            </div>

            {/* Miniaturas */}
            {(modal.photos || []).length > 1 && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 16px 0', overflowX: 'auto' }}>
                {(modal.photos || []).sort((a, b) => a.order - b.order).map((f, i) => (
                  <img key={i} src={f.url} onClick={() => setMainImg(f.url)} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'contain', background: 'var(--bg-2)', padding: 4, border: `2px solid ${mainImg === f.url ? 'var(--accent)' : 'var(--border-1)'}`, cursor: 'pointer', flexShrink: 0, transition: 'border-color .12s' }} />
                ))}
              </div>
            )}

            <div style={{ padding: '14px 18px 28px' }}>
              {/* Nome + preço */}
              <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 2 }}>{modal.brand}</p>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, lineHeight: 1.3 }}>
                {modal.model}{modal.storage ? ` ${modal.storage}` : ''}{modal.color ? ` — ${modal.color}` : ''}
              </h2>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                {modal.price_current ? (
                  <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fR(modal.price_current)}</p>
                ) : (
                  <p style={{ fontSize: 16, color: 'var(--text-3)' }}>Consulte o preço</p>
                )}
                {modal.condition && <span style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 6 }}>{modal.condition}</span>}
              </div>

              {/* ── SIMULADOR INFINITYPAY ── */}
              {modal.price_current && (
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
                  <button onClick={() => setMostrarSimulador(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(59,130,246,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11 }}>💳</span>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Simular parcelamento</p>
                        <p style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                          {mostrarSimulador ? 'Fechar simulador' : `até 12x de ${fR(calcParcela(modal.price_current, 12).parcela)}`}
                        </p>
                      </div>
                    </div>
                    {mostrarSimulador ? <ChevronUp size={14} style={{ color: 'var(--text-4)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-4)' }} />}
                  </button>

                  {mostrarSimulador && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-1)' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-4)', margin: '10px 0 10px', textTransform: 'uppercase', letterSpacing: '.05em' }}>Selecione o número de parcelas</p>
                      
                      {/* Grade de parcelas */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5, marginBottom: 14 }}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => {
                          const c = calcParcela(modal.price_current!, n)
                          const sel = parcelaSel === n
                          return (
                            <button key={n} onClick={() => setParcelaSel(n)} style={{
                              padding: '7px 4px', borderRadius: 8, border: `1px solid ${sel ? 'rgba(59,130,246,.5)' : 'var(--border-1)'}`,
                              background: sel ? 'rgba(59,130,246,.1)' : 'var(--bg-3)',
                              cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .1s',
                            }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: sel ? 'var(--accent)' : 'var(--text-2)', lineHeight: 1 }}>{n}x</p>
                              <p style={{ fontSize: 8.5, color: sel ? 'var(--accent)' : 'var(--text-4)', marginTop: 2, lineHeight: 1 }}>
                                {n === 1 ? 'à vista' : `${TAXAS_IP[n]}%`}
                              </p>
                            </button>
                          )
                        })}
                      </div>

                      {/* Resultado */}
                      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <p style={{ fontSize: 9.5, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Valor por parcela</p>
                            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                              {fR(parcelaSel === 1 ? modal.price_current : simCalc.parcela)}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: 9.5, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Total a pagar</p>
                            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                              {fR(parcelaSel === 1 ? modal.price_current : simCalc.total)}
                            </p>
                          </div>
                        </div>
                        <div style={{ marginTop: 8, padding: '6px 10px', background: parcelaSel === 1 ? 'rgba(16,185,129,.06)' : 'rgba(245,158,11,.06)', border: `1px solid ${parcelaSel === 1 ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)'}`, borderRadius: 7 }}>
                          {parcelaSel === 1 ? (
                            <p style={{ fontSize: 11, color: 'var(--green)' }}>✓ Pagamento à vista — sem acréscimos</p>
                          ) : (
                            <p style={{ fontSize: 11, color: 'var(--yellow)' }}>
                              Taxa InfinityPay de {TAXAS_IP[parcelaSel]}% repassada ao cliente · Você recebe {fR(modal.price_current)} integrais
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Specs */}
              {(modal.processor || modal.ram || modal.camera_main || modal.battery || modal.screen) && (
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginBottom: 10 }}>Especificações</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[
                      ['Processador', modal.processor], ['RAM', modal.ram],
                      ['Câmera', modal.camera_main], ['Câmera frontal', modal.camera_front],
                      ['Bateria', modal.battery], ['Tela', modal.screen],
                    ].filter(([, v]) => v).map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 11.5, color: 'var(--text-4)', flexShrink: 0 }}>{l}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-2)', textAlign: 'right' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {modal.catalog_description && (
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14 }}>{modal.catalog_description}</p>
              )}

              {/* Botões */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => setModal(null)} style={{ padding: '12px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: 'var(--text-3)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  Voltar
                </button>
                <button onClick={() => abrirWA(modal)} style={{ padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #25d366, #128c7e)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 16px rgba(37,211,102,.25)' }}>
                  <MessageCircle size={15} />Quero este!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp flutuante */}
      <button onClick={() => abrirWA()} style={{ position: 'fixed', bottom: 20, right: 20, width: 52, height: 52, borderRadius: 99, background: '#25d366', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(37,211,102,.4)', zIndex: 40, transition: 'transform .15s', animation: 'fadeIn .3s .5s both' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
      >
        <MessageCircle size={22} />
      </button>
    </div>
  )
}
