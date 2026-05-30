'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { sb } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ini } from '@/lib/supabase'

const AVATAR_KEY = 'lacore_avatar_'

export default function Topbar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user, isAdmin } = useAuth()

  // Carregar avatar
  useEffect(() => {
    if (!user) return
    // Primeiro tenta banco
    sb.from('users').select('avatar_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url)
        else {
          // Fallback localStorage
          const local = localStorage.getItem(AVATAR_KEY + user.id)
          if (local) setAvatarUrl(local)
        }
      })
  }, [user])

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'n') router.push('/dashboard/vendas?nova=1')
        if (e.key === 'r' && isAdmin()) router.push('/dashboard/remessas?nova=1')
        if (e.key === 'e') router.push('/dashboard/estoque')
        if (e.key === 'd') router.push('/dashboard')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, isAdmin])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const key = `avatar_${user.id}.${ext}`
      await sb.storage.from('avatars').remove([key])
      const { error } = await sb.storage.from('avatars').upload(key, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(key)
      const url = publicUrl + '?t=' + Date.now()
      await sb.from('users').update({ avatar_url: url }).eq('id', user.id)
      setAvatarUrl(url)
    } catch (err) { console.error('Avatar upload:', err) }
    finally { setUploading(false) }
  }

  return (
    <header className="topbar-inner">
      {/* Lado esquerdo — vazio (busca removida) */}
      <div />

      {/* Lado direito — Avatar + Nome */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => avatarRef.current?.click()}
              title="Alterar foto de perfil"
              style={{ background: 'none', border: 'none', padding: 0, cursor: uploading ? 'wait' : 'pointer', display: 'flex', position: 'relative' }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-2)', opacity: uploading ? 0.5 : 1 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', opacity: uploading ? 0.5 : 1 }}>
                  {ini(user.name)}
                </div>
              )}
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)' }}>
                {uploading ? <div className="spinner" style={{ width: 8, height: 8, borderWidth: 1.5 }} /> : <Camera size={7} />}
              </div>
            </button>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-1)', lineHeight: 1.2 }}>{user.name.split(' ')[0]}</p>
            <p style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.2 }}>{isAdmin() ? 'Admin' : 'Vendedor'}</p>
          </div>
        </div>
      )}
    </header>
  )
}
