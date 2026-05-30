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
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: WIDTHS[size],
          background: 'var(--bg-1)',
          border: '1px solid var(--border-2)',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,.6)',
          maxHeight: '92vh',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, background: 'var(--border-2)', borderRadius: 99, margin: '10px auto 0' }} />
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-1)' }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-1)' }}>{title}</h3>
            <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: 'var(--text-3)', cursor: 'pointer' }}>
              <X size={13} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
