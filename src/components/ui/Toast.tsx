'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem { id: number; message: string; type: ToastType }

let addToast: (msg: string, type?: ToastType) => void = () => {}

export function toast(message: string, type: ToastType = 'info') {
  addToast(message, type)
}

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
}
const COLORS = {
  success: { bg: 'rgba(16,185,129,.1)',  border: 'rgba(16,185,129,.25)', icon: '#10B981', bar: '#10B981' },
  error:   { bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.25)',  icon: '#EF4444', bar: '#EF4444' },
  info:    { bg: 'rgba(59,130,246,.1)',  border: 'rgba(59,130,246,.25)', icon: '#3B82F6', bar: '#3B82F6' },
  warning: { bg: 'rgba(245,158,11,.1)',  border: 'rgba(245,158,11,.25)', icon: '#F59E0B', bar: '#F59E0B' },
}

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const [progress, setProgress] = useState(100)
  const [visible, setVisible] = useState(false)
  const c = COLORS[item.type]

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const start = Date.now()
    const duration = 3500
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100))
      if (elapsed >= duration) { clearInterval(tick); setVisible(false); setTimeout(onRemove, 250) }
    }, 16)
    return () => clearInterval(tick)
  }, [onRemove])

  return (
    <div onClick={() => { setVisible(false); setTimeout(onRemove, 250) }} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px',
      background: `color-mix(in srgb, ${c.bg} 100%, var(--bg-1))`,
      backdropFilter: 'blur(20px)',
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      cursor: 'pointer', position: 'relative', overflow: 'hidden', minWidth: 240, maxWidth: 340,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0) scale(1)' : 'translateX(20px) scale(.97)',
      transition: 'opacity .25s, transform .25s',
    }}>
      {/* Ícone */}
      <div style={{ width: 24, height: 24, borderRadius: 99, background: `rgba(${c.icon === '#10B981' ? '16,185,129' : c.icon === '#EF4444' ? '239,68,68' : c.icon === '#3B82F6' ? '59,130,246' : '245,158,11'},.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: c.icon, flexShrink: 0 }}>
        {ICONS[item.type]}
      </div>
      {/* Texto */}
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', flex: 1, lineHeight: 1.4 }}>{item.message}</p>
      {/* X */}
      <span style={{ fontSize: 11, color: 'var(--text-4)', flexShrink: 0 }}>✕</span>
      {/* Barra de progresso */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: `${progress}%`, background: c.bar, borderRadius: '0 2px 2px 0', transition: 'width .016s linear' }} />
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    addToast = (message, type = 'info') => {
      setToasts(prev => [...prev, { id: Date.now(), message, type }])
    }
  }, [])

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastItem item={t} onRemove={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        </div>
      ))}
    </div>,
    document.body
  )
}
