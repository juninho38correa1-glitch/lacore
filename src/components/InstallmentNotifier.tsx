'use client'
import { useEffect, useState } from 'react'
import { sb, fR, fD } from '@/lib/supabase'
import { Bell, X, MessageCircle, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AlertItem {
  id: string
  buyer: string
  buyer_phone: string
  product: string
  due_date: string
  amount: number
  status: 'VENCIDO' | 'HOJE'
}

const STORAGE_KEY = 'lacore_notif_dismissed'

export default function InstallmentNotifier() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [visible, setVisible] = useState(false)
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifPerm(Notification.permission)
    }
    checkAlerts()
  }, [])

  const checkAlerts = async () => {
    // Usa data local (não UTC) para evitar bug de fuso horário no Brasil (UTC-3)
    const now = new Date()
    const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const { data } = await sb
      .from('installment_payments')
      .select('id,due_date,amount,status,installment_contracts(buyer_name,buyer_phone,product_description)')
      .in('status', ['PENDENTE', 'VENCIDO'])
      .lte('due_date', hoje)          // vencidos + vence hoje
      .order('due_date')
      .limit(20)

    if (!data?.length) return

    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
    // Mantém no dismissed apenas IDs que ainda existem nos dados retornados (auto-limpeza)
    const validIds = new Set((data as Record<string, unknown>[]).map(p => String(p.id)))
    const cleanDismissed = dismissed.filter((id: string) => validIds.has(id))
    if (cleanDismissed.length !== dismissed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanDismissed))
    }
    const todayStr = hoje

    const items: AlertItem[] = data
      .filter((p: Record<string, unknown>) => !dismissed.includes(String(p.id)))
      .map((p: Record<string, unknown>) => {
        const c = p.installment_contracts as Record<string, unknown> | null
        const dueDate = String(p.due_date).substring(0, 10)
        return {
          id: String(p.id),
          buyer: String(c?.buyer_name || ''),
          buyer_phone: String(c?.buyer_phone || ''),
          product: String(c?.product_description || ''),
          due_date: String(p.due_date),
          amount: Number(p.amount),
          status: dueDate === todayStr ? 'HOJE' : 'VENCIDO',
        }
      })

    if (!items.length) return

    setAlerts(items)
    setVisible(true)

    // Dispara notificação nativa do browser / PWA
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const vencidos = items.filter(i => i.status === 'VENCIDO').length
      const hoje2 = items.filter(i => i.status === 'HOJE').length
      const partes = []
      if (vencidos) partes.push(`${vencidos} vencida${vencidos > 1 ? 's' : ''}`)
      if (hoje2) partes.push(`${hoje2} vence hoje`)
      new Notification('Lacore Store — Parcelas ⚠️', {
        body: `${partes.join(' · ')} — toque para ver`,
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: 'lacore-parcelas',
      })
    }
  }

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
    if (perm === 'granted') {
      new Notification('Lacore Store ✓', {
        body: 'Notificações ativadas! Você será avisado sobre parcelas.',
        icon: '/favicon.png',
      })
    }
  }

  const dismiss = (id: string) => {
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
    dismissed.push(id)
    // Guardar por 24h apenas — limpar dismissed antigos
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed.slice(-50)))
    const next = alerts.filter(a => a.id !== id)
    setAlerts(next)
    if (!next.length) setVisible(false)
  }

  const dismissAll = () => {
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]
    alerts.forEach(a => dismissed.push(a.id))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed.slice(-50)))
    setAlerts([])
    setVisible(false)
  }

  const abrirWA = (item: AlertItem) => {
    const phone = item.buyer_phone.replace(/\D/g, '')
    const numero = phone.startsWith('55') ? phone : `55${phone}`
    if (!numero || numero.length < 10) return
    const venc = (() => { const [y,m,d] = item.due_date.substring(0,10).split('-'); return `${d}/${m}/${y}` })()
    const msg = item.status === 'VENCIDO'
      ? `Olá ${item.buyer}! 😊\n\nPassando para lembrar que a parcela do *${item.product}* venceu em *${venc}* e ainda está em aberto.\n\n💰 Valor: *${fR(item.amount)}*\n\nPodemos combinar o pagamento? 🙏`
      : `Olá ${item.buyer}! 😊\n\nLembrando que sua parcela do *${item.product}* vence *hoje (${venc})*.\n\n💰 Valor: *${fR(item.amount)}*\n\nEstou à disposição! 😉`
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (!visible || !alerts.length) return null

  const vencidos = alerts.filter(a => a.status === 'VENCIDO')
  const hoje = alerts.filter(a => a.status === 'HOJE')

  return (
    <div
      style={{
        position: 'fixed', bottom: 80, right: 16, zIndex: 45,
        width: 'min(360px, calc(100vw - 32px))',
        background: 'var(--bg-1)',
        border: '1px solid rgba(239,68,68,.35)',
        borderRadius: 16,
        boxShadow: '0 8px 0 rgba(0,0,0,.5), 0 16px 48px rgba(0,0,0,.45), 0 0 0 1px rgba(239,68,68,.1)',
        overflow: 'hidden',
        animation: 'slideIn .3s cubic-bezier(.34,1.56,.64,1) both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(239,68,68,.08)', borderBottom: '1px solid rgba(239,68,68,.15)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bell size={14} style={{ color: 'var(--red)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
            {vencidos.length > 0 && <>{vencidos.length} parcela{vencidos.length > 1 ? 's' : ''} vencida{vencidos.length > 1 ? 's' : ''}</>}
            {vencidos.length > 0 && hoje.length > 0 && ' · '}
            {hoje.length > 0 && <span style={{ color: 'var(--yellow)' }}>{hoje.length} vence hoje</span>}
          </p>
          <p style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1 }}>Toque em WA para cobrar</p>
        </div>
        <button onClick={dismissAll} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>

      {/* Lista */}
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {alerts.map(item => (
          <div
            key={item.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-1)' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.buyer}</p>
              <p style={{ fontSize: 11, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: item.status === 'VENCIDO' ? 'var(--red)' : 'var(--yellow)' }}>{fR(item.amount)}</span>
                <span style={{ fontSize: 10, color: 'var(--text-4)' }}>
                  {item.status === 'HOJE' ? 'Vence hoje' : `Venceu ${fD(item.due_date)}`}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {item.buyer_phone && (
                <button
                  onClick={() => abrirWA(item)}
                  style={{ padding: '5px 8px', borderRadius: 7, background: '#25d366', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
                >
                  <MessageCircle size={11} />WA
                </button>
              )}
              <button
                onClick={() => dismiss(item.id)}
                style={{ padding: '5px 6px', borderRadius: 7, background: 'var(--bg-3)', border: '1px solid var(--border-1)', color: 'var(--text-4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', alignItems: 'center' }}>
        {notifPerm === 'default' && (
          <button
            onClick={requestNotifPermission}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', color: 'var(--accent)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            <Bell size={11} />Ativar alertas
          </button>
        )}
        {notifPerm === 'granted' && (
          <span style={{ fontSize: 10.5, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Bell size={10} />Alertas ativos
          </span>
        )}
        <button
          onClick={() => { router.push('/dashboard/fluxo-caixa?tab=areceber'); setVisible(false) }}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: 'var(--bg-3)', border: '1px solid var(--border-1)', color: 'var(--text-2)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)' }}
        >
          Ver todas <ChevronRight size={11} />
        </button>
      </div>
    </div>
  )
}
