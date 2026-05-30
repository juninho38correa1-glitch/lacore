'use client'
import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { sb, fR, fD } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { CashflowEntry } from '@/lib/types'

// Mapeamento para exibição amigável
const TYPE_MAP: Record<string, { label: string; isEntrada: boolean }> = {
  ENTRADA_VENDA:           { label: 'Venda',            isEntrada: true  },
  ENTRADA_DEVOLUCAO:       { label: 'Devolução',        isEntrada: true  },
  ENTRADA_OUTRA:           { label: 'Entrada Outra',    isEntrada: true  },
  SAIDA_VIAGEM:            { label: 'Viagem',           isEntrada: false },
  SAIDA_COMBUSTIVEL:       { label: 'Combustível',      isEntrada: false },
  SAIDA_HOSPEDAGEM:        { label: 'Hospedagem',       isEntrada: false },
  SAIDA_ALIMENTACAO:       { label: 'Alimentação',      isEntrada: false },
  SAIDA_COMISSAO:          { label: 'Comissão',         isEntrada: false },
  SAIDA_TAXA_BANCARIA:     { label: 'Taxa Bancária',    isEntrada: false },
  SAIDA_TAXA_MARKETPLACE:  { label: 'Taxa Marketplace', isEntrada: false },
  SAIDA_MARKETING:         { label: 'Marketing',        isEntrada: false },
  SAIDA_FRETE:             { label: 'Frete',            isEntrada: false },
  SAIDA_OUTRA:             { label: 'Saída Outra',      isEntrada: false },
}

export default function FluxoCaixaTable() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<CashflowEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [novaModal, setNovaModal] = useState(false)
  const [form, setForm] = useState({ type: 'ENTRADA_OUTRA', description: '', amount: '', payment_method: 'PIX', date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await sb.from('cashflow').select('*').order('date', { ascending: false }).limit(300)
    if (error) console.error('Cashflow erro:', error)
    setEntries((data || []) as CashflowEntry[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const entradas = entries.filter(e => TYPE_MAP[e.type]?.isEntrada).reduce((a, e) => a + e.amount, 0)
  const saidas   = entries.filter(e => !TYPE_MAP[e.type]?.isEntrada).reduce((a, e) => a + e.amount, 0)
  const saldo    = entradas - saidas

  const save = async () => {
    if (!form.description || !form.amount) { toast('Preencha descrição e valor', 'error'); return }
    setSaving(true)
    const { error } = await sb.from('cashflow').insert({
      id: crypto.randomUUID(),
      type: form.type,
      description: form.description,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      created_by: user?.id,
      date: new Date(form.date).toISOString(),
    })
    if (error) { console.error(error); toast('Erro ao salvar', 'error') }
    else { toast('Lançamento adicionado!', 'success'); setNovaModal(false); load() }
    setSaving(false)
  }

  const entradas_types = Object.entries(TYPE_MAP).filter(([, v]) => v.isEntrada).map(([k, v]) => ({ value: k, label: v.label }))
  const saidas_types   = Object.entries(TYPE_MAP).filter(([, v]) => !v.isEntrada).map(([k, v]) => ({ value: k, label: v.label }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div className="grid-cols-3" style={{ gap: 14 }}>
        {[
          { l: 'Saldo Total',   v: fR(saldo),    c: saldo >= 0 ? 'var(--green)' : 'var(--red)'  },
          { l: 'Total Entradas', v: fR(entradas), c: 'var(--green)' },
          { l: 'Total Saídas',   v: fR(saidas),  c: 'var(--red)'   },
        ].map(({ l, v, c }) => (
          <div key={l} className="stat-card">
            <p className="stat-label">{l}</p>
            <p className="stat-value" style={{ color: c, fontSize: 22 }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setNovaModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}>
          <Plus size={14} />Novo Lançamento
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Forma</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {!entries.length && <tr><td colSpan={5}><div className="empty"><p className="empty-title">Nenhum lançamento</p><p className="empty-sub">As vendas aprovadas aparecem automaticamente aqui</p></div></td></tr>}
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
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{e.payment_method || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: tm?.isEntrada ? 'var(--green)' : 'var(--red)' }}>
                      {tm?.isEntrada ? '+' : '-'}{fR(e.amount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Novo Lançamento" size="sm">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Tipo</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <optgroup label="— Entradas —">
                {entradas_types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
              <optgroup label="— Saídas —">
                {saidas_types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
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
