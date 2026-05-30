'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Info } from 'lucide-react'

interface ToastItem { id: string; msg: string; type: 'success' | 'error' | 'info' }
let _add: ((t: ToastItem) => void) | null = null

export function toast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
  _add?.({ id: Math.random().toString(36).slice(2), msg, type })
}

const CONFIG = {
  success: { icon: CheckCircle, color: 'var(--green)',  border: 'rgba(16,185,129,.2)',  bg: 'rgba(16,185,129,.06)'  },
  error:   { icon: XCircle,     color: 'var(--red)',    border: 'rgba(239,68,68,.2)',    bg: 'rgba(239,68,68,.06)'   },
  info:    { icon: Info,         color: 'var(--accent)', border: 'rgba(59,130,246,.2)',   bg: 'rgba(59,130,246,.06)'  },
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => {
    _add = (t) => {
      setToasts(p => [...p, t])
      setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 3800)
    }
    return () => { _add = null }
  }, [])
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map(t => {
        const { icon: Icon, color, border, bg } = CONFIG[t.type]
        return (
          <div key={t.id} className="anim-fade-up" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px',
            background: `color-mix(in srgb, var(--bg-1) 90%, ${bg})`,
            border: `1px solid ${border}`,
            borderRadius: 10,
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13, fontWeight: 500,
            color: 'var(--text-1)',
            maxWidth: 320,
            pointerEvents: 'auto',
          }}>
            <Icon size={14} style={{ color, flexShrink: 0 }} />
            {t.msg}
          </div>
        )
      })}
    </div>
  )
}
