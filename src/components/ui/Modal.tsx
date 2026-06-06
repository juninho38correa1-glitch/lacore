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
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="modal-box"
        style={{
          width: '100%',
          maxWidth: WIDTHS[size],
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,.6)',
          maxHeight: '88dvh',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-1)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{title}</h3>
            <button
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: 'var(--text-3)', cursor: 'pointer', transition: 'all .12s', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-4)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-3)' }}
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
