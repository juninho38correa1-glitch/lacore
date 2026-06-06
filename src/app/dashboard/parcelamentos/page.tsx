'use client'
import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, CheckCircle, Clock, AlertTriangle, XCircle, MessageCircle, FileText } from 'lucide-react'
import { sb, fR, fD, WA_NUMBER } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'

interface Contract {
  id: string
  buyer_name: string
  buyer_phone?: string
  buyer_cpf?: string
  product_description: string
  total_amount: number
  down_payment: number
  down_payment_paid?: boolean
  down_payment_date?: string
  financed_amount: number
  installments: number
  installment_value: number
  contract_date: string
  first_due_date: string
  status: 'ATIVO' | 'QUITADO' | 'INADIMPLENTE' | 'CANCELADO'
  seller_id?: string
  notes?: string
  created_at: string
  payments?: Payment[]
}

interface Payment {
  id: string
  contract_id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO'
  paid_at?: string
  paid_amount?: number
  payment_method?: string
  notes?: string
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ATIVO:        { label: 'Ativo',        cls: 'badge-blue'   },
  QUITADO:      { label: 'Quitado',      cls: 'badge-green'  },
  INADIMPLENTE: { label: 'Inadimplente', cls: 'badge-red'    },
  CANCELADO:    { label: 'Cancelado',    cls: 'badge-gray'   },
  PENDENTE:     { label: 'Pendente',     cls: 'badge-yellow' },
  PAGO:         { label: 'Pago',         cls: 'badge-green'  },
  VENCIDO:      { label: 'Vencido',      cls: 'badge-red'    },
}

export default function ParcelamentosPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [novoModal, setNovoModal] = useState(false)
  const [pagarModal, setPagarModal] = useState<{ payment: Payment; contract: Contract } | null>(null)
  const [tab, setTab] = useState<'ATIVO' | 'QUITADO' | 'INADIMPLENTE' | 'todos'>('ATIVO')
  const [produtos, setProdutos] = useState<{ id: string; label: string }[]>([])

  // Form novo contrato
  const [form, setForm] = useState({
    buyer_name: '', buyer_phone: '', buyer_cpf: '',
    product_id: '', product_description: '',
    total_amount: '', down_payment: '0',
    installments: '2',
    notes: '',
  })
  // Parcelas com datas individuais
  const [parcelaDates, setParcelaDates] = useState<{ date: string; amount: string }[]>([
    { date: '', amount: '' },
    { date: '', amount: '' },
  ])
  const [saving, setSaving] = useState(false)

  // Form pagamento
  const [payForm, setPayForm] = useState({ paid_amount: '', payment_method: 'PIX', notes: '' })

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('installment_contracts').select('*').order('created_at', { ascending: false })
    // Buscar pagamentos
    const contracts = (data || []) as Contract[]
    if (contracts.length) {
      const ids = contracts.map(c => c.id)
      const { data: pays } = await sb.from('installment_payments').select('*').in('contract_id', ids).order('installment_number')
      const payMap: Record<string, Payment[]> = {}
      ;(pays || []).forEach((p: Payment) => { if (!payMap[p.contract_id]) payMap[p.contract_id] = []; payMap[p.contract_id].push(p) })
      contracts.forEach(c => { c.payments = payMap[c.id] || [] })
    }
    // Atualizar vencidos automaticamente
    for (const c of contracts) {
      if (c.status !== 'ATIVO') continue
      for (const p of c.payments || []) {
        if (p.status === 'PENDENTE' && new Date(p.due_date) < new Date(new Date().toDateString())) {
          await sb.from('installment_payments').update({ status: 'VENCIDO' }).eq('id', p.id)
          p.status = 'VENCIDO'
        }
      }
      // Verificar se ficou inadimplente (parcela vencida há mais de 5 dias)
      const hasOverdue = (c.payments || []).some(p => {
        if (p.status !== 'VENCIDO') return false
        const daysLate = Math.floor((Date.now() - new Date(p.due_date).getTime()) / 86400000)
        return daysLate > 5
      })
      if (hasOverdue && c.status === 'ATIVO') {
        await sb.from('installment_contracts').update({ status: 'INADIMPLENTE' }).eq('id', c.id)
        c.status = 'INADIMPLENTE'
      }
      // Verificar se quitou
      const allPaid = (c.payments || []).length > 0 && (c.payments || []).every(p => p.status === 'PAGO')
      if (allPaid) {
        await sb.from('installment_contracts').update({ status: 'QUITADO' }).eq('id', c.id)
        c.status = 'QUITADO'
      }
    }
    setContracts(contracts)
    setLoading(false)
  }

  const loadProdutos = async () => {
    const { data } = await sb.from('products').select('id,brand,model,color,storage').eq('status', 'ATIVO').order('brand')
    setProdutos((data || []).map((p: Record<string,string>) => ({ id: p.id, label: `${p.brand} ${p.model} ${p.color || ''} ${p.storage || ''}`.trim() })))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (novoModal) loadProdutos() }, [novoModal])

  // Calcular parcela
  const financed = Math.max(0, parseFloat(form.total_amount || '0') - parseFloat(form.down_payment || '0'))
  
  // Quando muda o número de parcelas, ajusta o array de datas
  const onInstallmentsChange = (n: string) => {
    const num = parseInt(n) || 2
    setForm(f => ({ ...f, installments: n }))
    setParcelaDates(prev => {
      const next = [...prev]
      while (next.length < num) next.push({ date: '', amount: '' })
      while (next.length > num) next.pop()
      return next
    })
  }

  // Distribuir valor igualmente
  const distribuirValor = () => {
    const n = parcelaDates.length
    if (!financed || !n) return
    const base = Math.floor((financed / n) * 100) / 100
    const last = Math.round((financed - base * (n - 1)) * 100) / 100
    setParcelaDates(prev => prev.map((p, i) => ({ ...p, amount: (i === n - 1 ? last : base).toString() })))
  }

  const totalParcelas = parcelaDates.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0)
  const diffTotal = Math.abs(financed - totalParcelas) > 0.01

  const salvarContrato = async () => {
    if (!form.buyer_name || !form.total_amount) {
      toast('Preencha nome e valor total', 'error'); return
    }
    if (parcelaDates.some(p => !p.date || !p.amount)) {
      toast('Preencha a data e valor de todas as parcelas', 'error'); return
    }
    if (diffTotal) {
      toast(`Soma das parcelas (${fR(totalParcelas)}) difere do valor financiado (${fR(financed)})`, 'error'); return
    }
    setSaving(true)
    try {
      const contractId = crypto.randomUUID()
      const n = parcelaDates.length
      const instVal = parseFloat(parcelaDates[0].amount) || 0

      const { error } = await sb.from('installment_contracts').insert({
        id: contractId,
        buyer_name: form.buyer_name,
        buyer_phone: form.buyer_phone || null,
        buyer_cpf: form.buyer_cpf || null,
        product_id: form.product_id || null,
        product_description: form.product_description || (produtos.find(p => p.id === form.product_id)?.label || 'Produto'),
        total_amount: parseFloat(form.total_amount),
        down_payment: parseFloat(form.down_payment || '0'),
        financed_amount: financed,
        installments: n,
        installment_value: instVal,
        contract_date: new Date().toISOString().split('T')[0],
        first_due_date: parcelaDates[0].date,
        seller_id: user?.id || null,
        notes: form.notes || null,
        status: 'ATIVO',
      })
      if (error) throw error

      if (form.product_id) {
        await sb.from('products').update({ status: 'VENDIDO' }).eq('id', form.product_id)
      }

      // Criar parcelas com DATAS INDIVIDUAIS
      for (let i = 0; i < n; i++) {
        await sb.from('installment_payments').insert({
          id: crypto.randomUUID(),
          contract_id: contractId,
          installment_number: i + 1,
          due_date: parcelaDates[i].date,
          amount: parseFloat(parcelaDates[i].amount),
          status: 'PENDENTE',
        })
      }

      toast(`Contrato criado! ${n} parcelas com datas personalizadas`, 'success')
      setNovaModal(false)
      setForm({ buyer_name: '', buyer_phone: '', buyer_cpf: '', product_id: '', product_description: '', total_amount: '', down_payment: '0', installments: '2', notes: '' })
      setParcelaDates([{ date: '', amount: '' }, { date: '', amount: '' }])
      load()
    } catch (e) { console.error(e); toast('Erro ao criar contrato', 'error') }
    finally { setSaving(false) }
  }

  const registrarPagamento = async () => {
    if (!pagarModal) return
    const { payment, contract } = pagarModal
    setSaving(true)
    try {
      const amt = parseFloat(payForm.paid_amount) || payment.amount
      await sb.from('installment_payments').update({
        status: 'PAGO',
        paid_at: new Date().toISOString(),
        paid_amount: amt,
        payment_method: payForm.payment_method,
        notes: payForm.notes || null,
      }).eq('id', payment.id)

      // Registrar no fluxo de caixa como ENTRADA_PARCELA
      await sb.from('cashflow').insert({
        id: crypto.randomUUID(),
        type: 'ENTRADA_PARCELA',
        description: `Parcela ${payment.installment_number}/${contract.installments} — ${contract.buyer_name} (${contract.product_description})`,
        amount: amt,
        payment_method: payForm.payment_method,
        date: new Date().toISOString(),
        created_by: user?.id,
        contract_id: contract.id,
        installment_number: payment.installment_number,
      })

      toast(`Parcela ${payment.installment_number} registrada!`, 'success')
      setPagarModal(null)
      setPayForm({ paid_amount: '', payment_method: 'PIX', notes: '' })
      load()
    } catch (e) { console.error(e); toast('Erro ao registrar pagamento', 'error') }
    finally { setSaving(false) }
  }

  const notificarWA = (contract: Contract, payment?: Payment) => {
    const phone = contract.buyer_phone?.replace(/\D/g, '')
    if (!phone) { toast('Cliente sem telefone cadastrado', 'error'); return }
    let msg = ''
    if (payment) {
      const daysLate = Math.floor((Date.now() - new Date(payment.due_date).getTime()) / 86400000)
      if (daysLate > 0) {
        msg = `Olá ${contract.buyer_name}! 👋\n\nPassando para avisar que a parcela ${payment.installment_number}/${contract.installments} do *${contract.product_description}* de *${fR(payment.amount)}* está em atraso há ${daysLate} dia${daysLate > 1 ? 's' : ''}.\n\nVencimento: ${fD(payment.due_date)}\n\nPor favor, entre em contato para regularizar. 🙏`
      } else {
        msg = `Olá ${contract.buyer_name}! 👋\n\nLembrete: a parcela ${payment.installment_number}/${contract.installments} do *${contract.product_description}* de *${fR(payment.amount)}* vence hoje, ${fD(payment.due_date)}.\n\nPix/pagamento: confirme com nosso time. 😊`
      }
    } else {
      const pending = (contract.payments || []).filter(p => p.status === 'PENDENTE' || p.status === 'VENCIDO')
      msg = `Olá ${contract.buyer_name}! 👋\n\nResumo do seu parcelamento *${contract.product_description}*:\n• Parcelas pagas: ${(contract.payments || []).filter(p => p.status === 'PAGO').length}/${contract.installments}\n• Pendentes: ${pending.length}\n• Próximo venc: ${pending[0] ? fD(pending[0].due_date) : 'Nenhum'}\n\nQualquer dúvida, estamos à disposição! 🤝`
    }
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const diasVencimento = (dateStr: string) => {
    const diff = Math.floor((new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86400000)
    if (diff < 0) return { text: `${Math.abs(diff)}d atraso`, color: 'var(--red)' }
    if (diff === 0) return { text: 'Vence hoje!', color: 'var(--yellow)' }
    if (diff <= 3) return { text: `${diff}d para vencer`, color: 'var(--yellow)' }
    return { text: `${diff}d`, color: 'var(--text-4)' }
  }

  const filtered = contracts.filter(c => tab === 'todos' || c.status === tab)

  // Stats
  const totalAtivo = contracts.filter(c => c.status === 'ATIVO').reduce((a, c) => a + c.financed_amount, 0)
  const totalReceber = contracts.filter(c => c.status === 'ATIVO').reduce((a, c) => {
    const pending = (c.payments || []).filter(p => p.status === 'PENDENTE' || p.status === 'VENCIDO')
    return a + pending.reduce((b, p) => b + p.amount, 0)
  }, 0)
  const inadimplentes = contracts.filter(c => c.status === 'INADIMPLENTE').length
  const vencendoHoje = contracts.flatMap(c => (c.payments || []).filter(p => {
    const diff = Math.floor((new Date(p.due_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    return p.status === 'PENDENTE' && diff >= 0 && diff <= 3
  })).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Parcelamentos Próprios</h1>
          <p className="page-sub">Controle de vendas a prazo direto com o cliente</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNovoModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} />Novo Contrato
        </button>
      </div>

      {/* KPIs */}
      <div className="grid-kpi">
        {[
          { l: 'Contratos Ativos',    v: contracts.filter(c => c.status === 'ATIVO').length, c: 'var(--accent)',  icon: '📋' },
          { l: 'Total Financiado',    v: fR(totalAtivo),  c: 'var(--text-1)', icon: '💰' },
          { l: 'A Receber',           v: fR(totalReceber), c: 'var(--green)',  icon: '✅' },
          { l: 'Venc. em 3 dias',     v: vencendoHoje,    c: 'var(--yellow)', icon: '⏰' },
          { l: 'Inadimplentes',       v: inadimplentes,   c: inadimplentes > 0 ? 'var(--red)' : 'var(--text-3)', icon: '⚠️' },
        ].map(k => (
          <div key={k.l} className="stat-card stat-pop card-hover">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="stat-label">{k.l}</p>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
            </div>
            <p className="stat-value" style={{ color: k.c, fontSize: 20 }}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['ATIVO','INADIMPLENTE','QUITADO','todos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', border: '1px solid', transition: 'all .12s', background: tab === t ? 'rgba(59,130,246,.1)' : 'transparent', borderColor: tab === t ? 'rgba(59,130,246,.3)' : 'var(--border-1)', color: tab === t ? 'var(--accent)' : 'var(--text-3)' }}>
            {t === 'todos' ? 'Todos' : t.charAt(0) + t.slice(1).toLowerCase()}
            <span style={{ marginLeft: 5, fontSize: 10, opacity: .7 }}>
              {t === 'todos' ? contracts.length : contracts.filter(c => c.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!filtered.length && <div className="empty"><p className="empty-title">Nenhum contrato encontrado</p></div>}
          {filtered.map(c => {
            const paid = (c.payments || []).filter(p => p.status === 'PAGO').length
            const pct = c.installments ? (paid / c.installments) * 100 : 0
            const nextPending = (c.payments || []).find(p => p.status === 'PENDENTE' || p.status === 'VENCIDO')
            const isOpen = expanded === c.id
            const sb_ = STATUS_BADGE[c.status]

            return (
              <div key={c.id} className="card card-glow" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header do contrato */}
                <div style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }} onClick={() => setExpanded(isOpen ? null : c.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <p style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-1)' }}>{c.buyer_name}</p>
                      <span className={`badge ${sb_.cls}`}>{sb_.label}</span>
                      {nextPending && nextPending.status === 'VENCIDO' && (
                        <span className="badge badge-red badge-pulse" style={{ fontSize: 9.5 }}>
                          <AlertTriangle size={9} />VENCIDA
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8 }}>{c.product_description}</p>
                    {/* Barra de progresso */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 99, transition: 'width .4s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-4)', flexShrink: 0 }}>{paid}/{c.installments}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Total: <strong style={{ color: 'var(--text-1)' }}>{fR(c.total_amount)}</strong></span>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.installments}x <strong style={{ color: 'var(--accent)' }}>{fR(c.installment_value)}</strong></span>
                      {nextPending && (
                        <span style={{ fontSize: 12, color: diasVencimento(nextPending.due_date).color }}>
                          Próx: {fD(nextPending.due_date)} · {diasVencimento(nextPending.due_date).text}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                    {c.down_payment > 0 && !c.down_payment_paid && (
                      <button onClick={async e => {
                        e.stopPropagation()
                        if (!confirm(`Registrar entrada de ${fR(c.down_payment)} como recebida?`)) return
                        await sb.from('installment_contracts').update({ down_payment_paid: true, down_payment_date: new Date().toISOString() }).eq('id', c.id)
                        await sb.from('cashflow').insert({ id: crypto.randomUUID(), type: 'ENTRADA_ENTRADA', description: `Entrada — ${c.buyer_name} (${c.product_description})`, amount: c.down_payment, date: new Date().toISOString(), created_by: user?.id, contract_id: c.id })
                        toast('Entrada registrada!', 'success'); load()
                      }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        💰 Entrada
                      </button>
                    )}
                    {c.buyer_phone && (
                      <button onClick={e => { e.stopPropagation(); notificarWA(c) }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.2)', color: '#25d366', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <MessageCircle size={11} />WA
                      </button>
                    )}
                  </div>
                    {isOpen ? <ChevronUp size={14} style={{ color: 'var(--text-4)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-4)' }} />}
                  </div>
                </div>

                {/* Parcelas expandidas */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-1)' }}>
                    {c.down_payment > 0 && (
                      <div style={{ padding: '8px 16px', background: 'rgba(16,185,129,.05)', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Entrada paga</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{fR(c.down_payment)}</span>
                      </div>
                    )}
                    {(c.payments || []).map(p => {
                      const sv = STATUS_BADGE[p.status]
                      const dv = diasVencimento(p.due_date)
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-1)', background: p.status === 'VENCIDO' ? 'rgba(239,68,68,.03)' : p.status === 'PAGO' ? 'rgba(16,185,129,.02)' : 'transparent' }}>
                          <div style={{ width: 24, height: 24, borderRadius: 99, background: p.status === 'PAGO' ? 'rgba(16,185,129,.12)' : p.status === 'VENCIDO' ? 'rgba(239,68,68,.12)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {p.status === 'PAGO' ? <CheckCircle size={12} style={{ color: 'var(--green)' }} /> : p.status === 'VENCIDO' ? <XCircle size={12} style={{ color: 'var(--red)' }} /> : <Clock size={12} style={{ color: 'var(--text-4)' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Parcela {p.installment_number}</p>
                              <span className={`badge ${sv.cls}`} style={{ fontSize: 9.5 }}>{sv.label}</span>
                            </div>
                            <p style={{ fontSize: 11, color: p.status === 'PAGO' ? 'var(--green)' : dv.color }}>
                              {p.status === 'PAGO' ? `Pago em ${fD(p.paid_at || '')} — ${p.payment_method || ''}` : `Venc: ${fD(p.due_date)} · ${dv.text}`}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: p.status === 'PAGO' ? 'var(--green)' : 'var(--accent)' }}>{fR(p.paid_amount || p.amount)}</p>
                            {(p.status === 'PENDENTE' || p.status === 'VENCIDO') && (
                              <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginTop: 5 }}>
                                <button onClick={() => { setPagarModal({ payment: p, contract: c }); setPayForm({ paid_amount: p.amount.toString(), payment_method: 'PIX', notes: '' }) }} className="btn btn-primary btn-sm" style={{ padding: '3px 10px', fontSize: 11 }}>
                                  Registrar
                                </button>
                                {c.buyer_phone && (
                                  <button onClick={() => notificarWA(c, p)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.2)', color: '#25d366', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                    <MessageCircle size={10} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {c.notes && (
                      <div style={{ padding: '8px 16px', background: 'var(--bg-2)', display: 'flex', gap: 6 }}>
                        <FileText size={12} style={{ color: 'var(--text-4)', flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.4 }}>{c.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Novo Contrato */}
      <Modal open={novoModal} onClose={() => setNovoModal(false)} title="Novo Contrato de Parcelamento" size="md">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Cliente */}
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)' }}>Dados do Cliente</p>
          <div className="form-grid-2" style={{ gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="label">Nome completo *</label>
              <input value={form.buyer_name} onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))} placeholder="Nome do comprador" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input value={form.buyer_phone} onChange={e => setForm(f => ({ ...f, buyer_phone: e.target.value }))} placeholder="(44) 99999-9999" />
            </div>
            <div>
              <label className="label">CPF (opcional)</label>
              <input value={form.buyer_cpf} onChange={e => setForm(f => ({ ...f, buyer_cpf: e.target.value }))} placeholder="000.000.000-00" />
            </div>
          </div>

          {/* Produto */}
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginTop: 4 }}>Produto</p>
          <div>
            <label className="label">Produto do estoque (opcional)</label>
            <select value={form.product_id} onChange={e => {
              const p = produtos.find(x => x.id === e.target.value)
              setForm(f => ({ ...f, product_id: e.target.value, product_description: p?.label || f.product_description }))
            }}>
              <option value="">Selecionar do estoque...</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Descrição do produto *</label>
            <input value={form.product_description} onChange={e => setForm(f => ({ ...f, product_description: e.target.value }))} placeholder="Ex: iPhone 15 Pro 256GB Preto" />
          </div>

          {/* Valores */}
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginTop: 4 }}>Condições de Pagamento</p>
          <div className="form-grid-2" style={{ gap: 12 }}>
            <div>
              <label className="label">Valor total (R$) *</label>
              <input type="number" step="0.01" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="0,00" />
            </div>
            <div>
              <label className="label">Entrada (R$)</label>
              <input type="number" step="0.01" value={form.down_payment} onChange={e => setForm(f => ({ ...f, down_payment: e.target.value }))} placeholder="0,00" />
            </div>
            <div>
              <label className="label">Número de parcelas *</label>
              <select value={form.installments} onChange={e => onInstallmentsChange(e.target.value)}>
                {[2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => <option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" onClick={distribuirValor} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={!financed}>
                ÷ Distribuir igualmente
              </button>
            </div>
          </div>

          {/* Parcelas com datas individuais */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginBottom: 8 }}>
              Datas e valores de cada parcela
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parcelaDates.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 9 }}>Vencimento *</label>
                    <input type="date" value={p.date} onChange={e => setParcelaDates(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: 9 }}>Valor (R$) *</label>
                    <input type="number" step="0.01" value={p.amount} onChange={e => setParcelaDates(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} placeholder="0,00" />
                  </div>
                </div>
              ))}
            </div>

            {/* Validação soma */}
            {form.total_amount && totalParcelas > 0 && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: diffTotal ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)', border: `1px solid ${diffTotal ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)'}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-4)' }}>Financiado: <strong style={{ color: 'var(--accent)' }}>{fR(financed)}</strong></span>
                  <span style={{ color: 'var(--text-4)' }}>Soma parcelas: <strong style={{ color: diffTotal ? 'var(--red)' : 'var(--green)' }}>{fR(totalParcelas)}</strong></span>
                </div>
                {diffTotal && <p style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 4 }}>⚠ Diferença de {fR(Math.abs(financed - totalParcelas))} — ajuste os valores ou use "Distribuir igualmente"</p>}
                {!diffTotal && <p style={{ fontSize: 10.5, color: 'var(--green)', marginTop: 4 }}>✓ Valores conferem</p>}
              </div>
            )}
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Garantia, condições especiais..." style={{ resize: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setNovoModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={salvarContrato} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Contrato'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Registrar Pagamento */}
      <Modal open={!!pagarModal} onClose={() => setPagarModal(null)} title={pagarModal ? `Parcela ${pagarModal.payment.installment_number}/${pagarModal.contract.installments} — ${pagarModal.contract.buyer_name}` : ''} size="sm">
        {pagarModal && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--text-4)' }}>Valor original</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{fR(pagarModal.payment.amount)}</p>
              <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>Venc: {fD(pagarModal.payment.due_date)}</p>
            </div>
            <div>
              <label className="label">Valor recebido (R$)</label>
              <input type="number" step="0.01" value={payForm.paid_amount} onChange={e => setPayForm(f => ({ ...f, paid_amount: e.target.value }))} placeholder={pagarModal.payment.amount.toString()} />
            </div>
            <div>
              <label className="label">Forma de pagamento</label>
              <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                {['PIX', 'Dinheiro', 'Transferência', 'Cartão Crédito', 'Cartão Débito', 'Outro'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea rows={2} value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' }} placeholder="Comprovante, observações..." />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPagarModal(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={registrarPagamento} disabled={saving}>
                {saving ? 'Salvando...' : '✓ Confirmar Pagamento'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
