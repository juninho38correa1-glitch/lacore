import { useEffect, useState } from 'react'
import { sb } from './supabase'

let cachedLogo: string | null = undefined as unknown as null

export function useLogo() {
  const [logo, setLogo] = useState<string | null>(cachedLogo || null)

  useEffect(() => {
    if (cachedLogo !== undefined) { setLogo(cachedLogo); return }
    sb.from('system_config').select('value').eq('key', 'company_logo').single()
      .then(({ data }) => {
        cachedLogo = data?.value || null
        setLogo(cachedLogo)
      })
  }, [])

  return logo
}

// Componente logo reutilizável
export function LogoIcon({ size = 34, style = {} }: { size?: number; style?: React.CSSProperties }) {
  const logo = useLogo()
  if (logo) {
    return (
      <img
        src={logo}
        style={{ width: size, height: size, borderRadius: size * 0.26, objectFit: 'contain', background: 'var(--bg-3)', border: '1px solid var(--border-1)', flexShrink: 0, ...style }}
      />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.26, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(59,130,246,.3)', flexShrink: 0, ...style }}>
      <svg width={size * 0.5} height={size * 0.46} viewBox="0 0 40 36" fill="none">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(255,255,255,.95)"/><stop offset="100%" stopColor="rgba(255,255,255,.6)"/></linearGradient></defs>
        <path d="M4 4L4 28L18 28" stroke="url(#lg)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 4C22 4 37 4 37 18C37 28 30 28 30 28" stroke="url(#lg)" strokeWidth="4.5" strokeLinecap="round"/>
      </svg>
    </div>
  )
}
