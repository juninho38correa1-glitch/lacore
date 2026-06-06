'use client'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { sb } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import { Camera, Save, Lock, User } from 'lucide-react'

const AVATAR_KEY = 'lacore_avatar_'

export default function PerfilPage() {
  const { user, updateUser } = useAuth()
  const avatarRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ name: '', email: '' })
  const [passForm, setPassForm] = useState({ current: '', nova: '', confirma: '' })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({ name: user.name || '', email: user.email || '' })
    // Buscar avatar do banco
    sb.from('users').select('avatar_url,name,email').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url)
        else {
          const local = localStorage.getItem(AVATAR_KEY + user.id)
          if (local) setAvatarUrl(local)
        }
        if (data?.name) setForm({ name: data.name, email: data.email || '' })
      })
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const key = `avatar_${user.id}.${ext}`
      await sb.storage.from('avatars').remove([key])
      await sb.storage.from('avatars').upload(key, file, { upsert: true })
      const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(key)
      const url = publicUrl + '?t=' + Date.now()
      await sb.from('users').update({ avatar_url: url }).eq('id', user.id)
      setAvatarUrl(url)
      localStorage.setItem(AVATAR_KEY + user.id, url)
      toast('Foto atualizada!', 'success')
    } catch { toast('Erro ao enviar foto', 'error') }
    finally { setUploadingAvatar(false) }
  }

  const salvarInfo = async () => {
    if (!form.name || !form.email) { toast('Nome e email são obrigatórios', 'error'); return }
    setSavingInfo(true)
    try {
      await sb.from('users').update({ name: form.name, email: form.email, updated_at: new Date().toISOString() }).eq('id', user!.id)
      // Atualizar contexto imediatamente — sem precisar refazer login
      updateUser({ name: form.name, email: form.email })
      toast('Perfil atualizado!', 'success')
    } catch { toast('Erro ao salvar', 'error') }
    finally { setSavingInfo(false) }
  }

  const salvarSenha = async () => {
    if (!passForm.current) { toast('Informe a senha atual', 'error'); return }
    if (!passForm.nova || passForm.nova.length < 6) { toast('Nova senha deve ter ao menos 6 caracteres', 'error'); return }
    if (passForm.nova !== passForm.confirma) { toast('Senhas não conferem', 'error'); return }
    setSavingPass(true)
    try {
      // Verificar senha atual
      const { data } = await sb.rpc('verify_user_password', { p_email: user!.email, p_password: passForm.current })
      if (!data?.length) { toast('Senha atual incorreta', 'error'); setSavingPass(false); return }
      // Hash nova senha
      const { data: hash } = await sb.rpc('hash_password', { p_password: passForm.nova })
      await sb.from('users').update({ password_hash: hash, updated_at: new Date().toISOString() }).eq('id', user!.id)
      setPassForm({ current: '', nova: '', confirma: '' })
      toast('Senha alterada com sucesso!', 'success')
    } catch { toast('Erro ao alterar senha', 'error') }
    finally { setSavingPass(false) }
  }

  const ini = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <h1 className="page-title">Meu Perfil</h1>
        <p className="page-sub">Gerencie suas informações pessoais</p>
      </div>

      {/* Avatar */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {avatarUrl ? (
            <img src={avatarUrl} style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: '2px solid var(--border-2)' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff' }}>
              {user ? ini(user.name) : '?'}
            </div>
          )}
          <button
            onClick={() => avatarRef.current?.click()}
            disabled={uploadingAvatar}
            style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 99, background: 'var(--accent)', border: '2px solid var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
          >
            {uploadingAvatar ? <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> : <Camera size={12} />}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>
        <div>
          <p style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-1)' }}>{form.name || user?.name}</p>
          <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{form.email || user?.email}</p>
          <span className={`badge badge-${user?.role === 'ADMIN' ? 'blue' : 'green'}`} style={{ marginTop: 6 }}>{user?.role}</span>
        </div>
      </div>

      {/* Informações */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <User size={14} style={{ color: 'var(--accent)' }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Informações Pessoais</p>
        </div>
        <div>
          <label className="label">Nome completo</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Seu nome" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com" />
        </div>
        <button className="btn btn-primary" onClick={salvarInfo} disabled={savingInfo} style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '8px 18px' }}>
          {savingInfo ? <div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.2)' }} /> : <Save size={14} />}
          {savingInfo ? 'Salvando...' : 'Salvar informações'}
        </button>
      </div>

      {/* Senha */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Lock size={14} style={{ color: 'var(--yellow)' }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Alterar Senha</p>
        </div>
        <div>
          <label className="label">Senha atual</label>
          <input type="password" value={passForm.current} onChange={e => setPassForm(f => ({ ...f, current: e.target.value }))} placeholder="••••••••" autoComplete="current-password" />
        </div>
        <div className="form-grid-2" style={{ gap: 12 }}>
          <div>
            <label className="label">Nova senha</label>
            <input type="password" value={passForm.nova} onChange={e => setPassForm(f => ({ ...f, nova: e.target.value }))} placeholder="mín. 6 caracteres" autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirmar nova senha</label>
            <input type="password" value={passForm.confirma} onChange={e => setPassForm(f => ({ ...f, confirma: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
          </div>
        </div>
        {passForm.nova && passForm.confirma && passForm.nova !== passForm.confirma && (
          <p style={{ fontSize: 12, color: 'var(--red)' }}>⚠ As senhas não conferem</p>
        )}
        {passForm.nova && passForm.confirma && passForm.nova === passForm.confirma && passForm.nova.length >= 6 && (
          <p style={{ fontSize: 12, color: 'var(--green)' }}>✓ Senhas conferem</p>
        )}
        <button className="btn btn-secondary" onClick={salvarSenha} disabled={savingPass} style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '8px 18px' }}>
          {savingPass ? <div className="spinner spinner-sm" /> : <Lock size={14} />}
          {savingPass ? 'Alterando...' : 'Alterar senha'}
        </button>
      </div>
    </div>
  )
}
