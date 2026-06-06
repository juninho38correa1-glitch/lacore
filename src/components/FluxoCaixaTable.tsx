'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, TrendingUp, TrendingDown, Clock, Wallet, ArrowDownCircle, ArrowUpCircle, ClipboardList, AlertTriangle, Banknote, CalendarClock, MessageCircle } from 'lucide-react'
import { sb, fR, fD, WA_NUMBER } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { CashflowEntry } from '@/lib/types'

const TYPE_MAP: Record<string, { label: string; isEntrada: boolean; color: string }> = {
  ENTRADA_VENDA:          { label: 'Venda à Vista',    isEntrada: true,  color: 'var(--green)'  },
  ENTRADA_PARCELA:        { label: 'Parcela Recebida', isEntrada: true,  color: 'var(--green)'  },
  ENTRADA_ENTRADA:        { label: 'Entrada Recebida', isEntrada: true,  color: 'var(--green)'  },
  ENTRADA_DEVOLUCAO:      { label: 'Devolução',        isEntrada: true,  color: 'var(--green)'  },
  ENTRADA_OUTRA:          { label: 'Entrada Outra',    isEntrada: true,  color: 'var(--green)'  },
  SAIDA_VIAGEM:           { label: 'Viagem',           isEntrada: false, color: 'var(--red)'    },
  SAIDA_COMBUSTIVEL:      { label: 'Combustível',      isEntrada: false, color: 'var(--red)'    },
  SAIDA_HOSPEDAGEM:       { label: 'Hospedagem',       isEntrada: false, color: 'var(--red)'    },
  SAIDA_ALIMENTACAO:      { label: 'Alimentação',      isEntrada: false, color: 'var(--red)'    },
  SAIDA_COMISSAO:         { label: 'Comissão',         isEntrada: false, color: 'var(--red)'    },
  SAIDA_TAXA_BANCARIA:    { label: 'Taxa Bancária',    isEntrada: false, color: 'var(--red)'    },
  SAIDA_TAXA_MARKETPLACE: { label: 'Taxa Marketplace', isEntrada: false, color: 'var(--red)'    },
  SAIDA_MARKETING:        { label: 'Marketing',        isEntrada: false, color: 'var(--red)'    },
  SAIDA_FRETE:            { label: 'Frete',            isEntrada: false, color: 'var(--red)'    },
  SAIDA_OUTRA:            { label: 'Saída Outra',      isEntrada: false, color: 'var(--red)'    },
}

export default function FluxoCaixaTable() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<CashflowEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [novaModal, setNovaModal] = useState(false)
  const searchParams = useSearchParams()
  const [visao, setVisao] = useState<'caixa' | 'areceber' | 'todos'>(
    searchParams.get('tab') === 'areceber' ? 'areceber' : 'caixa'
  )
  const [form, setForm] = useState({
    type: 'ENTRADA_OUTRA', description: '', amount: '',
    payment_method: 'PIX', date: new Date().toISOString().split('T')[0]
  })
  const [saving, setSaving] = useState(false)

  // Dados de parcelamentos a receber
  const [aReceber, setAReceber] = useState<{
    total: number
    proximos7: number
    vencidos: number
    itens: Array<{ id: string; contract_id: string; buyer: string; buyer_phone: string; product: string; due_date: string; amount: number; status: string; installment: number; total: number }>
  }>({ total: 0, proximos7: 0, vencidos: 0, itens: [] })

  // Modal registrar pagamento de parcela
  const [payModal, setPayModal] = useState(false)
  const [payItem, setPayItem] = useState<typeof aReceber.itens[0] | null>(null)
  const [payForm, setPayForm] = useState({ payment_method: 'PIX', amount: '' })
  const [payingSaving, setPayingSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await sb.from('cashflow').select('*').order('date', { ascending: false }).limit(300)
    if (error) console.error('Cashflow erro:', error)
    setEntries((data || []) as CashflowEntry[])

    // Buscar parcelas pendentes
    const { data: pays } = await sb
      .from('installment_payments')
      .select('id,contract_id,installment_number,due_date,amount,status,installment_contracts(buyer_name,buyer_phone,product_description,installments)')
      .in('status', ['PENDENTE', 'VENCIDO'])
      .order('due_date')
    
    const hoje = new Date()
    const em7dias = new Date(hoje); em7dias.setDate(em7dias.getDate() + 7)
    
    const itens = (pays || []).map((p: Record<string, unknown>) => {
      const c = p.installment_contracts as Record<string, unknown> | null
      return {
        id: String(p.id),
        contract_id: String(p.contract_id),
        buyer: String(c?.buyer_name || ''),
        buyer_phone: String(c?.buyer_phone || ''),
        product: String(c?.product_description || ''),
        due_date: String(p.due_date),
        amount: Number(p.amount),
        status: String(p.status),
        installment: Number(p.installment_number),
        total: Number(c?.installments || 0),
      }
    })
    
    const totalAR = itens.reduce((a, i) => a + i.amount, 0)
    const prox7 = itens.filter(i => new Date(i.due_date) <= em7dias && i.status === 'PENDENTE').reduce((a, i) => a + i.amount, 0)
    const vencidos = itens.filter(i => i.status === 'VENCIDO').reduce((a, i) => a + i.amount, 0)
    
    setAReceber({ total: totalAR, proximos7: prox7, vencidos, itens })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const entradas = entries.filter(e => TYPE_MAP[e.type]?.isEntrada).reduce((a, e) => a + e.amount, 0)
  const saidas = entries.filter(e => !TYPE_MAP[e.type]?.isEntrada).reduce((a, e) => a + e.amount, 0)
  const saldo = entradas - saidas

  const save = async () => {
    if (!form.description || !form.amount) { toast('Preencha descrição e valor', 'error'); return }
    setSaving(true)
    const { error } = await sb.from('cashflow').insert({
      id: crypto.randomUUID(), type: form.type, description: form.description,
      amount: parseFloat(form.amount), payment_method: form.payment_method,
      created_by: user?.id, date: new Date(form.date).toISOString(),
    })
    if (error) { console.error(error); toast('Erro ao salvar', 'error') }
    else { toast('Lançamento adicionado!', 'success'); setNovaModal(false); load() }
    setSaving(false)
  }

  const cobrarWhatsApp = (item: typeof aReceber.itens[0]) => {
    const phone = item.buyer_phone.replace(/\D/g, '')
    const numero = phone.startsWith('55') ? phone : `55${phone}`
    const venc = (() => { const [y,m,d] = item.due_date.substring(0,10).split('-'); return `${d}/${m}/${y}` })()
    const atraso = item.status === 'VENCIDO'
    const msg = atraso
      ? `Olá ${item.buyer}! 😊\n\nPassando para lembrar que a *parcela ${item.installment}/${item.total}* do ${item.product} venceu em *${venc}* e ainda está em aberto.\n\n💰 Valor: *${fR(item.amount)}*\n\nPodemos combinar o pagamento? Estou à disposição aqui! 🙏`
      : `Olá ${item.buyer}! 😊\n\nLembrando que a *parcela ${item.installment}/${item.total}* do ${item.product} vence em *${venc}*.\n\n💰 Valor: *${fR(item.amount)}*\n\nQualquer dúvida, estou aqui! 😉`
    const url = `https://wa.me/${numero || WA_NUMBER}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const abrirPayModal = (item: typeof aReceber.itens[0]) => {
    setPayItem(item)
    setPayForm({ payment_method: 'PIX', amount: item.amount.toFixed(2) })
    setPayModal(true)
  }

  const registrarPagamento = async () => {
    if (!payItem) return
    const amt = parseFloat(payForm.amount)
    if (!amt || amt <= 0) { toast('Informe o valor recebido', 'error'); return }
    setPayingSaving(true)
    try {
      const { error: e1 } = await sb.from('installment_payments').update({
        status: 'PAGO',
        paid_at: new Date().toISOString(),
        paid_amount: amt,
        payment_method: payForm.payment_method,
      }).eq('id', payItem.id)
      if (e1) throw e1

      const { error: e2 } = await sb.from('cashflow').insert({
        id: crypto.randomUUID(),
        type: 'ENTRADA_PARCELA',
        description: `Parcela ${payItem.installment}/${payItem.total} — ${payItem.buyer} (${payItem.product})`,
        amount: amt,
        payment_method: payForm.payment_method,
        date: new Date().toISOString(),
        created_by: user?.id,
      })
      if (e2) throw e2

      toast(`Parcela ${payItem.installment}/${payItem.total} de ${payItem.buyer} marcada como paga!`, 'success')
      setPayModal(false)
      load()
    } catch (err) {
      console.error(err); toast('Erro ao registrar pagamento', 'error')
    } finally {
      setPayingSaving(false)
    }
  }

  const entradas_types = Object.entries(TYPE_MAP).filter(([, v]) => v.isEntrada).map(([k, v]) => ({ value: k, label: v.label }))
  const saidas_types = Object.entries(TYPE_MAP).filter(([, v]) => !v.isEntrada).map(([k, v]) => ({ value: k, label: v.label }))

  const diasAte = (dateStr: string) => {
    const diff = Math.floor((new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86400000)
    if (diff < 0) return { text: `${Math.abs(diff)}d atraso`, color: 'var(--red)' }
    if (diff === 0) return { text: 'Hoje!', color: 'var(--yellow)' }
    if (diff <= 7) return { text: `${diff}d`, color: 'var(--yellow)' }
    return { text: `${diff}d`, color: 'var(--text-4)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPIs principais */}
      <div className="grid-kpi">
        {[
          { l: 'Saldo em Caixa',    v: fR(saldo),            c: saldo >= 0 ? 'var(--green)' : 'var(--red)',   Icon: Wallet },
          { l: 'Total Entradas',    v: fR(entradas),          c: 'var(--green)',  Icon: ArrowDownCircle },
          { l: 'Total Saídas',      v: fR(saidas),            c: 'var(--red)',    Icon: ArrowUpCircle },
          { l: 'A Receber (Parc.)', v: fR(aReceber.total),    c: 'var(--accent)', Icon: ClipboardList },
          { l: 'Vencidos',          v: fR(aReceber.vencidos), c: aReceber.vencidos > 0 ? 'var(--red)' : 'var(--text-3)', Icon: AlertTriangle },
        ].map(({ l, v, c, Icon }) => (
          <div key={l} className="stat-card stat-pop card-hover">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="stat-label">{l}</p>
              <Icon size={13} style={{ color: 'var(--text-4)' }} />
            </div>
            <p className="stat-value" style={{ color: c, fontSize: 20 }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Abas de visão */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['caixa', 'Em Caixa', Banknote], ['areceber', 'A Receber', CalendarClock], ['todos', 'Todos', null]] as const).map(([v, l, Icon]) => (
            <button key={v} onClick={() => setVisao(v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', border: '1px solid', transition: 'all .12s', background: visao === v ? 'rgba(59,130,246,.1)' : 'transparent', borderColor: visao === v ? 'rgba(59,130,246,.3)' : 'var(--border-1)', color: visao === v ? 'var(--accent)' : 'var(--text-3)' }}>
              {Icon && <Icon size={11} />}{l}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setNovaModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}>
          <Plus size={14} />Novo Lançamento
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : visao === 'areceber' ? (
        /* VISÃO A RECEBER */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Resumo */}
          <div className="form-grid-3" style={{ gap: 10 }}>
            {[
              { l: 'Total a Receber', v: fR(aReceber.total), c: 'var(--accent)', icon: <TrendingUp size={14} /> },
              { l: 'Próx. 7 dias',    v: fR(aReceber.proximos7), c: 'var(--yellow)', icon: <Clock size={14} /> },
              { l: 'Em Atraso',       v: fR(aReceber.vencidos), c: 'var(--red)', icon: <TrendingDown size={14} /> },
            ].map(k => (
              <div key={k.l} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: k.c }}>{k.icon}<p style={{ fontSize: 11, color: 'var(--text-4)' }}>{k.l}</p></div>
                <p style={{ fontSize: 20, fontWeight: 700, color: k.c }}>{k.v}</p>
              </div>
            ))}
          </div>

          {/* Lista de parcelas pendentes */}
          {!aReceber.itens.length ? (
            <div className="empty"><p className="empty-title">Nenhuma parcela pendente</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cliente</th><th>Produto</th><th>Parcela</th><th>Vencimento</th><th>Status</th><th style={{ textAlign: 'right' }}>Valor</th><th></th></tr></thead>
                <tbody>
                  {aReceber.itens.map((item, i) => {
                    const d = diasAte(item.due_date)
                    return (
                      <tr key={i} className="clickable" onClick={() => abrirPayModal(item)}>
                        <td style={{ fontWeight: 500 }}>{item.buyer}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.product}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-4)' }}>{item.installment}/{item.total}</td>
                        <td style={{ fontSize: 12, color: d.color }}>{fD(item.due_date)} · {d.text}</td>
                        <td><span className={`badge ${item.status === 'VENCIDO' ? 'badge-red' : 'badge-yellow'}`}>{item.status}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: item.status === 'VENCIDO' ? 'var(--red)' : 'var(--accent)' }}>{fR(item.amount)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {item.buyer_phone && (
                              <button
                                className="btn btn-sm"
                                onClick={() => cobrarWhatsApp(item)}
                                title="Enviar cobrança via WhatsApp"
                                style={{ background: '#25d366', color: '#fff', border: 'none', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 0 rgba(0,0,0,.25)' }}
                              >
                                <MessageCircle size={11} />
                                <span className="hide-mobile">WA</span>
                              </button>
                            )}
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => abrirPayModal(item)}
                              style={{ whiteSpace: 'nowrap', fontSize: 11 }}
                            >
                              ✓ Pago
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* VISÃO CAIXA / TODOS */
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th className="hide-mobile">Forma</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
            <tbody>
              {!entries.length && <tr><td colSpan={5}><div className="empty"><p className="empty-title">Nenhum lançamento</p></div></td></tr>}
              {entries.map(e => {
                const tm = TYPE_MAP[e.type]
                return (
                  <tr key={e.id}>
                    <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(e.date)}</td>
                    <td>
                      <span className={`badge ${tm?.isEntrada ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                        {tm?.label || e.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{e.description}</td>
                    <td className="hide-mobile" style={{ color: 'var(--text-3)', fontSize: 12 }}>{e.payment_method || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: tm?.isEntrada ? 'var(--green)' : 'var(--red)' }}>
                      {tm?.isEntrada ? '+' : '-'}{fR(e.amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal registrar pagamento de parcela */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Registrar Pagamento" size="sm">
        {payItem && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Info da parcela */}
            <div style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border-1)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{payItem.buyer}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>{payItem.product}</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                <span className={`badge ${payItem.status === 'VENCIDO' ? 'badge-red' : 'badge-yellow'}`}>{payItem.status}</span>
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Parcela {payItem.installment}/{payItem.total}</span>
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Venc.: {fD(payItem.due_date)}</span>
              </div>
            </div>

            <div>
              <label className="label">Valor Recebido (R$) *</label>
              <input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" />
              <p style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 4 }}>Valor original: {fR(payItem.amount)}</p>
            </div>

            <div>
              <label className="label">Forma de Pagamento</label>
              <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                {['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito', 'Transferência', 'Outro'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.18)', borderRadius: 8, fontSize: 11.5, color: 'var(--green)' }}>
              ✓ Ao confirmar, a parcela será marcada como PAGO e uma entrada <strong>ENTRADA_PARCELA</strong> será lançada no caixa automaticamente.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={() => setPayModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={registrarPagamento} disabled={payingSaving}>
                {payingSaving ? 'Salvando...' : '✓ Confirmar Recebimento'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal novo lançamento */}
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Novo Lançamento" size="sm">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Tipo</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <optgroup label="— Entradas —">{entradas_types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>
              <optgroup label="— Saídas —">{saidas_types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>
            </select>
          </div>
          <div><label className="label">Descrição *</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o lançamento..." /></div>
          <div><label className="label">Valor (R$) *</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" /></div>
          <div><label className="label">Forma de Pagamento</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              {['PIX','Dinheiro','Cartão Crédito','Cartão Débito','Transferência','Outro'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Data</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={() => setNovaModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
