'use client'
import { useState, useEffect } from 'react'
import { Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { sb, fR, fD } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { CashflowEntry } from '@/lib/types'

export default function FluxoCaixaTable() {
  const [entries, setEntries] = useState<CashflowEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [novaModal, setNovaModal] = useState(false)
  const [form, setForm] = useState({ type: 'SAIDA', category: 'Outros', description: '', amount: '', payment_method: 'PIX', date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('cashflow').select('*').order('date', { ascending: false }).limit(200)
    setEntries((data || []) as CashflowEntry[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const total = entries.reduce((a, e) => a + (e.type === 'ENTRADA' ? e.amount : -e.amount), 0)
  const entradas = entries.filter(e => e.type === 'ENTRADA').reduce((a, e) => a + e.amount, 0)
  const saidas = entries.filter(e => e.type === 'SAIDA').reduce((a, e) => a + e.amount, 0)

  const save = async () => {
    if (!form.description || !form.amount) { toast('Preencha descrição e valor', 'error'); return }
    setSaving(true)
    await sb.from('cashflow').insert({ id: crypto.randomUUID(), ...form, amount: parseFloat(form.amount) })
    toast('Lançamento adicionado!', 'success')
    setSaving(false); setNovaModal(false); load()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { l: 'Saldo Total', v: fR(total), c: total >= 0 ? 'text-green-400' : 'text-red-400' },
          { l: 'Entradas', v: fR(entradas), c: 'text-green-400' },
          { l: 'Saídas', v: fR(saidas), c: 'text-red-400' },
        ].map(({ l, v, c }) => (
          <div key={l} className="card"><p className="text-gray-500 text-xs mb-1">{l}</p><p className={`text-xl font-bold ${c}`}>{v}</p></div>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={() => setNovaModal(true)} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold"><Plus size={13} />Novo Lançamento</button>
      </div>
      {loading ? <div className="flex justify-center p-16"><div className="spinner spinner-lg" /></div> : (
        <div className="card p-0 overflow-hidden">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Forma</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {!entries.length && <tr><td colSpan={6} className="text-center py-10 text-gray-600">Nenhum lançamento</td></tr>}
              {entries.map(e => (
                <tr key={e.id}>
                  <td className="text-gray-500 text-xs">{fD(e.date)}</td>
                  <td><span className={`badge ${e.type === 'ENTRADA' ? 'badge-green' : 'badge-red'}`}>{e.type}</span></td>
                  <td className="text-gray-400 text-xs">{e.category}</td>
                  <td className="text-white text-sm">{e.description}</td>
                  <td className="text-gray-500 text-xs">{e.payment_method || '—'}</td>
                  <td className={`text-right font-mono font-semibold ${e.type === 'ENTRADA' ? 'text-green-400' : 'text-red-400'}`}>
                    {e.type === 'SAIDA' ? '-' : '+'}{fR(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Novo Lançamento" size="sm">
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['ENTRADA', 'SAIDA'] as const).map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${form.type === t ? (t === 'ENTRADA' ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-red-500/20 border-red-500/40 text-red-300') : 'bg-white/5 border-white/10 text-gray-400'}`}>
                {t === 'ENTRADA' ? '↑ Entrada' : '↓ Saída'}
              </button>
            ))}
          </div>
          {[['Categoria', 'category', 'select', ['Vendas','Importação','Frete','Comissão','Marketing','Aluguel','Salário','Impostos','Outros']],
            ['Descrição *', 'description', 'text', null],
            ['Valor (R$) *', 'amount', 'number', null],
            ['Forma de Pagamento', 'payment_method', 'select', ['PIX','Dinheiro','Cartão Crédito','Transferência','Outro']],
            ['Data', 'date', 'date', null],
          ].map(([l, k, type, opts]) => (
            <div key={k as string}>
              <label className="text-xs text-gray-400 mb-1 block">{l as string}</label>
              {type === 'select' ? (
                <select value={(form as Record<string, string>)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} className="text-sm">
                  {(opts as string[]).map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={type as string} value={(form as Record<string, string>)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} className="text-sm" />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setNovaModal(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 btn-primary py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
