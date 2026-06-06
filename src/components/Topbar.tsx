'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { sb, ini } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const AVATAR_KEY = 'lacore_avatar_'

export default function Topbar() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    sb.from('users').select('avatar_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url)
        else {
          const local = localStorage.getItem(AVATAR_KEY + user.id)
          if (local) setAvatarUrl(local)
        }
      })
  }, [user])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'n') router.push('/dashboard/vendas?nova=1')
      if (e.key === 'e') router.push('/dashboard/estoque')
      if (e.key === 'd') router.push('/dashboard')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

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
      <div />
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Avatar com hover feedback e anel de upload */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => !uploading && avatarRef.current?.click()}
              title={uploading ? 'Enviando foto...' : 'Alterar foto de perfil'}
              aria-label={uploading ? 'Enviando foto...' : 'Alterar foto de perfil'}
              className="topbar-avatar-btn"
              style={{ cursor: uploading ? 'wait' : 'pointer' }}
            >
              {/* Anel de progresso durante upload */}
              {uploading && (
                <svg style={{ position: 'absolute', inset: -3, width: 'calc(100% + 6px)', height: 'calc(100% + 6px)', borderRadius: 11 }}
                     viewBox="0 0 38 38" fill="none" aria-hidden="true">
                  <circle cx="19" cy="19" r="17" stroke="rgba(59,130,246,.15)" strokeWidth="2.5"/>
                  <circle cx="19" cy="19" r="17" stroke="#3B82F6" strokeWidth="2.5"
                          strokeLinecap="round" strokeDasharray="50 57"
                          style={{ animation: 'spin .8s linear infinite', transformOrigin: 'center' }}/>
                </svg>
              )}
              {avatarUrl ? (
                <img src={avatarUrl}
                     style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover',
                              border: '1px solid var(--border-2)', opacity: uploading ? 0.55 : 1,
                              transition: 'opacity .2s' }}
                     alt={`Avatar de ${user.name}`} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: '#fff',
                              opacity: uploading ? 0.55 : 1, transition: 'opacity .2s' }}>
                  {ini(user.name)}
                </div>
              )}
              {/* Badge câmera */}
              {!uploading && (
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14,
                              borderRadius: 99, background: 'var(--bg-3)', border: '1px solid var(--border-2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)',
                              transition: 'background .15s' }}>
                  <Camera size={7} />
                </div>
              )}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>

          {/* Nome e role */}
          <div>
            <p className="topbar-user-name" onClick={() => router.push('/dashboard/perfil')}
               role="button" tabIndex={0}
               onKeyDown={e => e.key === 'Enter' && router.push('/dashboard/perfil')}>
              {user.name.split(' ')[0]}
            </p>
            <p className="hide-mobile" style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.2 }}>
              {isAdmin() ? 'Admin' : 'Vendedor'}
            </p>
          </div>
        </div>
      )}
    </header>
  )
}
