'use client'
import { useState, useEffect, useRef } from 'react'
import { toast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

const FN_URL = 'https://ritvdomqjwodevyhpqox.supabase.co/functions/v1/specs-bulk-update'

interface Modelo { brand: string; model: string; storage: string; nfc: boolean|null; charging: string|null; os: string|null; dimensions: string|null }
interface Resultado { brand: string; model: string; storage: string; status: string; fonte?: string; error?: string }

export default function SpecsAdminPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [modelos, setModelos]     = useState<Modelo[]>([])
  const [loading, setLoading]     = useState(true)
  const [running, setRunning]     = useState(false)
  const [delay, setDelay]         = useState(3000)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [progress, setProgress]   = useState(0)
  const [log, setLog]             = useState<string[]>([])
  const logRef  = useRef<HTMLDivElement>(null)
  const stopRef = useRef(false)

  useEffect(() => {
    if (!isAdmin()) { router.replace('/dashboard'); return }
    carregarModelos()
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const addLog = (msg: string) =>
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`])

  const carregarModelos = async () => {
    setLoading(true)
    try {
      const res = await fetch(FN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_models' })
      })
      const d = await res.json()
      setModelos(d.models || [])
    } catch (e) { toast('Erro ao carregar modelos', 'error') }
    setLoading(false)
  }

  const rodarBulk = async () => {
    const min = Math.ceil(modelos.length * delay / 60000)
    if (!confirm(`Atualizar specs de ${modelos.length} modelos via IA?\n\nIsso vai usar suas chaves Gemini/OpenAI.\nTempo estimado: ~${min} minutos.\n\nVocê pode pausar a qualquer momento.`)) return
    setRunning(true); stopRef.current = false
    setResultados([]); setProgress(0); setLog([])
    addLog(`🚀 Iniciando: ${modelos.length} modelos | ${delay/1000}s delay | ~${min}min`)

    let ok = 0, erros = 0
    for (let i = 0; i < modelos.length; i++) {
      if (stopRef.current) { addLog('⏹ Parado pelo usuário'); break }
      const m = modelos[i]
      addLog(`[${i+1}/${modelos.length}] ${m.brand} ${m.model} ${m.storage}...`)
      try {
        const res = await fetch(FN_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_one', brand: m.brand, model: m.model, storage: m.storage })
        })
        const d = await res.json()
        if (d.success) {
          ok++
          const s = d.specs
          addLog(`  ✅ NFC:${s.nfc?'Sim':'Não'} | ${s.charging} | ${s.os} | ${s.dimensions?.split(',')[1]?.trim() || ''} | ${d.fonte}`)
          setResultados(prev => [...prev, { brand: m.brand, model: m.model, storage: m.storage, status: 'ok', fonte: d.fonte }])
        } else {
          erros++
          addLog(`  ⚠️ ${d.error}`)
          setResultados(prev => [...prev, { brand: m.brand, model: m.model, storage: m.storage, status: 'erro', error: d.error }])
        }
      } catch(e) {
        erros++
        addLog(`  ❌ Falha: ${e}`)
        setResultados(prev => [...prev, { brand: m.brand, model: m.model, storage: m.storage, status: 'erro', error: String(e) }])
      }
      setProgress(Math.round((i+1) / modelos.length * 100))
      if (i < modelos.length - 1 && !stopRef.current) await new Promise(r => setTimeout(r, delay))
    }

    addLog(`\n🏁 Concluído: ${ok} ✅ | ${erros} ❌`)
    toast(`Atualização concluída: ${ok} ok, ${erros} erros`, ok >= erros ? 'success' : 'error')
    setRunning(false)
    carregarModelos()
  }

  const incompletos = modelos.filter(m => !m.dimensions || !m.os || !m.charging || m.charging === '-')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
      <div>
        <h1 className="page-title">🔧 Specs em Massa — IA</h1>
        <p className="page-sub">Atualiza os 11 campos de specs via Gemini/OpenAI para todos os {modelos.length} modelos no cache</p>
      </div>

      <div className="grid-kpi">
        {[
          { l: 'Total modelos', v: modelos.length,              c: 'var(--accent)' },
          { l: 'Incompletos',   v: incompletos.length,           c: incompletos.length > 0 ? 'var(--yellow)' : 'var(--green)' },
          { l: 'Completos',     v: modelos.length - incompletos.length, c: 'var(--green)' },
        ].map(k => (
          <div key={k.l} className="stat-card">
            <p className="stat-label">{k.l}</p>
            <p className="stat-value" style={{ color: k.c, fontSize: 22 }}>{k.v}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontWeight: 600, fontSize: 14 }}>Configurações</p>
        <div className="form-grid-2" style={{ gap: 12 }}>
          <div>
            <label className="label">Delay entre chamadas</label>
            <select value={delay} onChange={e => setDelay(parseInt(e.target.value))} disabled={running}>
              <option value={2000}>2s — rápido (risco rate limit)</option>
              <option value={3000}>3s — recomendado</option>
              <option value={5000}>5s — seguro</option>
              <option value={8000}>8s — muito seguro</option>
            </select>
            <p style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 4 }}>
              Estimativa: ~{Math.ceil(modelos.length * delay / 60000)} minutos para {modelos.length} modelos
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {!running ? (
              <button className="btn btn-primary" onClick={rodarBulk} disabled={loading || modelos.length === 0} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                🚀 Iniciar Atualização
              </button>
            ) : (
              <button onClick={() => { stopRef.current = true }} style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 }}>
                ⏹ Parar
              </button>
            )}
          </div>
        </div>

        {(running || progress > 0) && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>
                {resultados.filter(r=>r.status==='ok').length} ✅  {resultados.filter(r=>r.status==='erro').length} ❌  de {modelos.length}
              </span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{progress}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
          </div>
        )}
      </div>

      {log.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 600, fontSize: 13 }}>Log em tempo real</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setLog([])}>Limpar</button>
          </div>
          <div ref={logRef} style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--bg-base)', padding: '12px 14px', maxHeight: 300, overflowY: 'auto', lineHeight: 1.8 }}>
            {log.map((line, i) => (
              <div key={i} style={{ color: line.includes('✅') ? '#34D399' : line.includes('❌') ? '#F87171' : line.includes('⚠️') ? '#FBB040' : line.includes('🚀')||line.includes('🏁') ? 'var(--accent)' : 'var(--text-3)' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)', marginBottom: 8 }}>
          Cache de Specs ({modelos.length} modelos)
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Marca</th><th>Modelo</th><th>Storage</th>
              <th>NFC</th><th>Carga</th><th>SO</th><th>Dimen.</th><th>Status</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8}><div className="empty"><div className="spinner" /></div></td></tr>}
              {!loading && modelos.map((m, i) => {
                const completo = !!(m.dimensions && m.os && m.charging && m.charging !== '-')
                const res = resultados.find(r => r.brand===m.brand && r.model===m.model && r.storage===m.storage)
                return (
                  <tr key={i}>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>{m.brand}</td>
                    <td style={{ fontSize: 12 }}>{m.model}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 9.5 }}>{m.storage}</span></td>
                    <td>
                      {m.nfc !== null
                        ? <span className={`badge badge-${m.nfc?'green':'gray'}`} style={{ fontSize: 9.5 }}>{m.nfc?'✓ Sim':'✗ Não'}</span>
                        : <span style={{ color: 'var(--text-4)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 11, color: m.charging&&m.charging!=='-' ? 'var(--accent)' : 'var(--text-4)' }}>{m.charging||'—'}</td>
                    <td style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{m.os ? m.os.split(' (')[0] : '—'}</td>
                    <td style={{ fontSize: 11 }}>{m.dimensions ? <span style={{ color: 'var(--green)' }}>✓</span> : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                    <td>
                      {res
                        ? <span className={`badge badge-${res.status==='ok'?'green':'red'}`} style={{ fontSize: 9.5 }}>{res.status==='ok' ? `✅ ${res.fonte}` : '❌'}</span>
                        : <span className={`badge badge-${completo?'green':'yellow'}`} style={{ fontSize: 9.5 }}>{completo?'Completo':'Incompleto'}</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
