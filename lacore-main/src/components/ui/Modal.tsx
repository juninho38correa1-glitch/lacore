'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
}

const WIDTHS = { sm: 420, md: 560, lg: 720, xl: 960 }

export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  // Lógica de Escape — preservada
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(10px)',
        zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: WIDTHS[size],
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          margin: 'auto',
        }}
        className="anim-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-1)',
          }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-.01em' }}>{title}</h3>
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 6,
                background: 'var(--bg-3)', border: '1px solid var(--border-2)',
                color: 'var(--text-3)', cursor: 'pointer',
                transition: 'all .12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)' }}
            >
              <X size={13} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
