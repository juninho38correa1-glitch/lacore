'use client'
import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Save, Trash2, CheckCircle, XCircle, Shield, Bell, BellOff, ImagePlus, Loader2, Store, ChevronDown } from 'lucide-react'
import { callFn, sb } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'
import { LogoIcon } from '@/lib/useLogo'


export default function ConfiguracoesPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const logoRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default')
  const [openaiKey, setOpenaiKey] = useState('')
  const [manusKey, setManusKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [showKeys, setShowKeys] = useState({ openai: false, manus: false, gemini: false })
  const [status, setStatus] = useState<Record<string, boolean> | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [keysOpen, setKeysOpen] = useState(false)

  useEffect(() => { if (!isAdmin()) router.push('/dashboard') }, [isAdmin])

  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission)
    sb.from('system_config').select('value').eq('key', 'company_logo').single()
      .then(({ data }) => { if (data?.value) setLogoUrl(data.value) })
  }, [])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setLogoUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const key = `company_logo.${ext}`
      await sb.storage.from('avatars').remove([key])
      const { error } = await sb.storage.from('avatars').upload(key, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(key)
      const urlWithBust = publicUrl + '?t=' + Date.now()
      await sb.from('system_config').upsert({ key: 'company_logo', value: urlWithBust, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      setLogoUrl(urlWithBust)
      toast('Logo atualizada com sucesso!', 'success')
    } catch { toast('Erro ao fazer upload da logo', 'error') }
    finally { setLogoUploading(false); if (logoRef.current) logoRef.current.value = '' }
  }

  const handleLogoRemove = async () => {
    if (!confirm('Restaurar logo padrão (LC)?')) return
    await sb.from('system_config').delete().eq('key', 'company_logo')
    setLogoUrl(null)
    toast('Logo restaurada para o padrão', 'info')
  }

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') { toast('Notificações não suportadas neste navegador', 'error'); return }
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
    if (perm === 'granted') {
      new Notification('Lacore Store', { body: 'Notificações ativadas! Você será avisado sobre parcelas.', icon: '/favicon.png' })
      toast('Notificações ativadas com sucesso!', 'success')
    } else {
      toast('Permissão negada. Ative nas configurações do navegador.', 'error')
    }
  }

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
      <div className="card">
        <button
          onClick={() => setKeysOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <h2 className="text-sm font-semibold text-white">Configurar Chaves de API</h2>
          <ChevronDown size={16} style={{ color: 'var(--text-3)', transition: 'transform .2s', transform: keysOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>

        {keysOpen && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        )}
      </div>

      {/* Logo da empresa */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Store size={15} className="text-blue-400" />Logo da Empresa</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flexShrink: 0 }}>
            <LogoIcon size={56} />
          </div>
          <div style={{ flex: 1 }}>
            <p className="text-xs text-gray-400 mb-3">A logo aparece na sidebar e na página de login. Formatos aceitos: PNG, JPG, SVG.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => logoRef.current?.click()}
                disabled={logoUploading}
                className="btn-primary text-xs px-3 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {logoUploading ? <Loader2 size={12} style={{ animation: 'spin .6s linear infinite' }} /> : <ImagePlus size={12} />}
                {logoUploading ? 'Enviando...' : 'Alterar logo'}
              </button>
              {logoUrl && (
                <button
                  onClick={handleLogoRemove}
                  className="text-xs px-3 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={11} />Restaurar padrão
                </button>
              )}
            </div>
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
          </div>
        </div>
      </div>

      {/* Notificações push */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Bell size={15} className="text-yellow-400" />Notificações de Parcelas</h2>
        <p className="text-xs text-gray-500">Receba alertas do browser quando houver parcelas vencidas ou vencendo hoje. Funciona enquanto o app estiver aberto ou em segundo plano.</p>
        <div className={`flex items-center justify-between p-3 rounded-lg border ${notifPerm === 'granted' ? 'bg-green-500/8 border-green-500/20' : notifPerm === 'denied' ? 'bg-red-500/8 border-red-500/20' : 'bg-white/3 border-white/8'}`}>
          <div className="flex items-center gap-2">
            {notifPerm === 'granted'
              ? <><CheckCircle size={14} className="text-green-400" /><span className="text-xs font-semibold text-green-300">Notificações ativas</span></>
              : notifPerm === 'denied'
              ? <><BellOff size={14} className="text-red-400" /><span className="text-xs font-semibold text-red-300">Bloqueadas pelo navegador</span></>
              : <><Bell size={14} className="text-gray-500" /><span className="text-xs text-gray-400">Não configurado</span></>}
          </div>
          {notifPerm !== 'granted' && notifPerm !== 'denied' && (
            <button
              onClick={requestNotifPermission}
              className="btn-primary text-xs px-3 py-1.5 rounded-lg"
            >
              Ativar alertas
            </button>
          )}
          {notifPerm === 'denied' && (
            <span className="text-[11px] text-gray-500">Ative nas configurações do navegador</span>
          )}
        </div>
        {notifPerm === 'granted' && (
          <button
            onClick={() => new Notification('Lacore Store — Teste ✅', {
              body: 'Notificações funcionando corretamente!',
              icon: '/favicon.png',
              tag: 'lacore-teste',
            })}
            className="text-xs flex items-center gap-2 px-3 py-2 rounded-lg border border-yellow-500/20 bg-yellow-500/8 text-yellow-300 hover:bg-yellow-500/15 transition-colors cursor-pointer w-full justify-center"
            style={{ fontFamily: 'var(--font)', fontWeight: 500 }}
          >
            <Bell size={12} />Enviar notificação de teste
          </button>
        )}
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
