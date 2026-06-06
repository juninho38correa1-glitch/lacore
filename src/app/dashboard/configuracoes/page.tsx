'use client'
import { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, Trash2, CheckCircle, XCircle, Shield } from 'lucide-react'
import { callFn } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'


export default function ConfiguracoesPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [openaiKey, setOpenaiKey] = useState('')
  const [manusKey, setManusKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [showKeys, setShowKeys] = useState({ openai: false, manus: false, gemini: false })
  const [status, setStatus] = useState<Record<string, boolean> | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!isAdmin()) router.push('/dashboard') }, [isAdmin])

  const loadStatus = async () => {
    setLoading(true)
    const r = await callFn('ia-publicacao', { action: 'get_keys_status' }, user?.id, user?.role)
    if (!r.error) setStatus(r)
    setLoading(false)
  }
  useEffect(() => { if (user) loadStatus() }, [user])

  const saveKeys = async () => {
    if (!openaiKey && !manusKey && !geminiKey) { toast('Preencha pelo menos uma chave', 'error'); return }
    setSaving(true)
    const r = await callFn('ia-publicacao', { action: 'save_key', openai_key: openaiKey, manus_key: manusKey, gemini_key: geminiKey }, user?.id, user?.role)
    setSaving(false)
    if (r.error) { toast(r.error, 'error'); return }
    toast('Chaves salvas com segurança!', 'success')
    setOpenaiKey(''); setManusKey(''); setGeminiKey('')
    loadStatus()
  }

  const removeKey = async (tipo: 'openai' | 'manus' | 'gemini') => {
    if (!confirm(`Remover chave ${tipo.toUpperCase()}?`)) return
    const r = await callFn('ia-publicacao', { action: `remove_${tipo}_key` }, user?.id, user?.role)
    if (r.error) { toast(r.error, 'error'); return }
    toast(`Chave ${tipo.toUpperCase()} removida`, 'info')
    loadStatus()
  }

  const keys = [
    { id: 'openai' as const, label: 'OpenAI (GPT-4o)', value: openaiKey, set: setOpenaiKey, placeholder: 'sk-...', color: 'text-green-400' },
    { id: 'manus' as const, label: 'Manus AI', value: manusKey, set: setManusKey, placeholder: 'manus-...', color: 'text-blue-400' },
    { id: 'gemini' as const, label: 'Google Gemini', value: geminiKey, set: setGeminiKey, placeholder: 'AIza...', color: 'text-yellow-400' },
  ]

  return (
    <div className="space-y-5 max-w-2xl">
      <div><h1 className="text-2xl font-bold text-white">Configurações</h1><p className="text-gray-500 text-sm mt-0.5">Chaves de API e segurança do sistema</p></div>

      {/* Status das chaves */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Shield size={15} className="text-cyan-400" />Status das Chaves</h2>
        {loading ? <div className="flex gap-3">{[1,2,3].map(i => <div key={i} className="h-12 flex-1 rounded-lg bg-white/5 animate-pulse" />)}</div> : (
          <div className="grid grid-cols-3 gap-3">
            {keys.map(k => (
              <div key={k.id} className={`p-3 rounded-lg border ${status?.[k.id] || status?.[k.id + '_configured'] ? 'bg-green-500/8 border-green-500/20' : 'bg-white/3 border-white/8'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-400">{k.label.split(' ')[0]}</p>
                  {status?.[k.id] || status?.[k.id + '_configured'] ? <CheckCircle size={13} className="text-green-400" /> : <XCircle size={13} className="text-gray-600" />}
                </div>
                <p className={`text-xs font-semibold ${status?.[k.id] || status?.[k.id + '_configured'] ? 'text-green-300' : 'text-gray-600'}`}>{status?.[k.id] || status?.[k.id + '_configured'] ? '✓ Configurada' : 'Não configurada'}</p>
                {status?.[k.id] || status?.[k.id + '_configured'] && <button onClick={() => removeKey(k.id)} className="mt-1.5 text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5"><Trash2 size={9} />Remover</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configurar chaves */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-white mb-1">Configurar Chaves de API</h2>
        <p className="text-xs text-gray-500">As chaves são armazenadas com segurança no servidor via Edge Function. Nunca expostas no frontend.</p>
        {keys.map(k => (
          <div key={k.id}>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">{k.label}</label>
            <div className="relative">
              <input
                type={showKeys[k.id] ? 'text' : 'password'}
                value={k.value}
                onChange={e => k.set(e.target.value)}
                placeholder={k.placeholder}
                className="text-sm pr-10 font-mono"
              />
              <button onClick={() => setShowKeys(s => ({ ...s, [k.id]: !s[k.id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showKeys[k.id] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        ))}
        <button onClick={saveKeys} disabled={saving} className="btn-primary w-full py-2.5 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</> : <><Save size={14} />Salvar Chaves</>}
        </button>
      </div>

      {/* Info segurança */}
      <div className="card border-cyan-500/20 bg-cyan-500/5 space-y-2">
        <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">🔒 Auditoria de Segurança</h3>
        {[
          ['✅', 'Autenticação via pgcrypto', 'Senhas verificadas com bcrypt via SQL nativo'],
          ['✅', 'Chaves de API no servidor', 'Nunca expostas no frontend — armazenadas via Edge Function'],
          ['✅', 'Catálogo público separado', 'Acesso sem autenticação apenas para /catalogo'],
          ['✅', 'Controle ADMIN/VENDEDOR', 'Dados financeiros visíveis somente para admins'],
        ].map(([icon, title, desc]) => (
          <div key={title} className="flex items-start gap-2">
            <span className="text-xs mt-0.5">{icon}</span>
            <div><p className="text-white text-xs font-medium">{title}</p><p className="text-gray-500 text-[11px]">{desc}</p></div>
          </div>
        ))}
      </div>
    </div>
  )
}
