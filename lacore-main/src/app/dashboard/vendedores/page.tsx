'use client'
import { useState, useEffect } from 'react'
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import { sb, fR, ini } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/types'

export default function VendedoresPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [vends, setVends] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'ATIVO' | 'INATIVO'>('ATIVO')
  const [modal, setModal] = useState<User | 'novo' | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', commission_type: 'percent_profit', commission_rate: 10, monthly_goal: 0 })
  const [saving, setSaving] = useState(false)
  const [commissions, setCommissions] = useState<Record<string, number>>({})

  useEffect(() => { if (!isAdmin()) router.push('/dashboard') }, [isAdmin])

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('users').select('*').eq('role', 'VENDEDOR').order('name')
    setVends((data || []) as User[])
    // Comissões pendentes por vendedor
    const { data: c } = await sb.from('commissions').select('vendor_id,amount').eq('status', 'PENDENTE')
    const map: Record<string, number> = {}
    ;(c || []).forEach((x: { vendor_id: string; amount: number }) => { map[x.vendor_id] = (map[x.vendor_id] || 0) + x.amount })
    setCommissions(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const hashPass = async (pass: string) => {
    const r = await sb.rpc('hash_password', { p_password: pass })
    return r.data
  }

  const save = async () => {
    if (!form.name || !form.email) { toast('Nome e email obrigatórios', 'error'); return }
    setSaving(true)
    try {
      if (modal === 'novo') {
        if (!form.password) { toast('Senha obrigatória para novo vendedor', 'error'); setSaving(false); return }
        const hash = await hashPass(form.password)
        await sb.from('users').insert({ id: crypto.randomUUID(), name: form.name, email: form.email, password_hash: hash, role: 'VENDEDOR', status: 'ATIVO', email_verified: true, commission_type: form.commission_type, commission_rate: form.commission_rate, monthly_goal: form.monthly_goal })
      } else {
        const upd: Record<string, unknown> = { name: form.name, email: form.email, commission_type: form.commission_type, commission_rate: form.commission_rate, monthly_goal: form.monthly_goal }
        if (form.password) upd.password_hash = await hashPass(form.password)
        await sb.from('users').update(upd).eq('id', (modal as User).id)
      }
      toast(modal === 'novo' ? 'Vendedor criado!' : 'Vendedor atualizado!', 'success')
      setModal(null); load()
    } catch { toast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  const toggle = async (v: User) => {
    const ns = v.status === 'ATIVO' ? 'INATIVO' : 'ATIVO'
    await sb.from('users').update({ status: ns }).eq('id', v.id)
    toast(`${v.name} ${ns === 'ATIVO' ? 'ativado' : 'desativado'}`, 'info')
    load()
  }

  const pagarComissao = async (vid: string, name: string, valor: number) => {
    if (!confirm(`Pagar ${fR(valor)} de comissão para ${name}?`)) return
    await sb.from('commissions').update({ status: 'PAGA' }).eq('vendor_id', vid).eq('status', 'PENDENTE')
    await sb.from('cashflow').insert({ id: crypto.randomUUID(), type: 'SAIDA', category: 'Comissão', description: `Comissão ${name}`, amount: valor, date: new Date().toISOString().split('T')[0] })
    toast('Comissão paga!', 'success'); load()
  }

  const openEdit = (v: User) => {
    setForm({ name: v.name, email: v.email, password: '', commission_type: v.commission_type || 'percent_profit', commission_rate: v.commission_rate || 10, monthly_goal: v.monthly_goal || 0 })
    setModal(v)
  }

  const shown = vends.filter(v => v.status === tab)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Vendedores</h1><p className="text-gray-500 text-sm">Equipe e comissões</p></div>
        <button onClick={() => { setForm({ name: '', email: '', password: '', commission_type: 'percent_profit', commission_rate: 10, monthly_goal: 0 }); setModal('novo') }} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold"><Plus size={13} />Novo Vendedor</button>
      </div>
      <div className="flex gap-2">
        {(['ATIVO', 'INATIVO'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${tab === t ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>{t}</button>
        ))}
      </div>
      {loading ? <div className="flex justify-center p-16"><div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!shown.length && <p className="text-gray-600 col-span-full text-center py-10">Nenhum vendedor {tab.toLowerCase()}</p>}
          {shown.map(v => (
            <div key={v.id} className="card space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-cyan flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{ini(v.name)}</div>
                <div className="flex-1 min-w-0"><p className="text-white font-semibold truncate">{v.name}</p><p className="text-gray-500 text-xs truncate">{v.email}</p></div>
                <span className={`badge ${v.status === 'ATIVO' ? 'badge-green' : 'badge-gray'}`}>{v.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/3"><p className="text-gray-500">Tipo</p><p className="text-white font-medium">{v.commission_type === 'percent_profit' ? '% Lucro' : v.commission_type === 'percent_sale' ? '% Venda' : 'Fixo'}</p></div>
                <div className="p-2 rounded-lg bg-white/3"><p className="text-gray-500">Taxa</p><p className="text-white font-medium">{v.commission_rate}%</p></div>
                <div className="p-2 rounded-lg bg-white/3"><p className="text-gray-500">Meta</p><p className="text-white font-medium">{fR(v.monthly_goal || 0)}</p></div>
                <div className="p-2 rounded-lg bg-white/3 cursor-pointer" onClick={() => commissions[v.id] && pagarComissao(v.id, v.name, commissions[v.id])}><p className="text-gray-500">Comissão pend.</p><p className="text-yellow-300 font-bold">{fR(commissions[v.id] || 0)}</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(v)} className="flex-1 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs hover:bg-white/10 flex items-center justify-center gap-1.5"><Edit2 size={11} />Editar</button>
                <button onClick={() => toggle(v)} className="flex-1 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs hover:bg-white/10 flex items-center justify-center gap-1.5">
                  {v.status === 'ATIVO' ? <><ToggleRight size={13} className="text-green-400" />Desativar</> : <><ToggleLeft size={13} />Ativar</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'Novo Vendedor' : `Editar — ${(modal as User)?.name}`} size="sm">
        <div className="p-5 space-y-3">
          {[['Nome *', 'name', 'text'], ['Email *', 'email', 'email'], ['Senha' + (modal !== 'novo' ? ' (deixe em branco para não alterar)' : ' *'), 'password', 'password']].map(([l, k, t]) => (
            <div key={k}><label className="text-xs text-gray-400 mb-1 block">{l}</label><input type={t} value={(form as Record<string, string>)[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="text-sm" /></div>
          ))}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Tipo de Comissão</label>
            <select value={form.commission_type} onChange={e => setForm(f => ({ ...f, commission_type: e.target.value }))} className="text-sm">
              <option value="percent_profit">% do Lucro</option>
              <option value="percent_sale">% da Venda</option>
              <option value="fixed">Fixo por venda</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-400 mb-1 block">Taxa (%)</label><input type="number" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: parseFloat(e.target.value) }))} className="text-sm" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Meta Mensal (R$)</label><input type="number" value={form.monthly_goal} onChange={e => setForm(f => ({ ...f, monthly_goal: parseFloat(e.target.value) }))} className="text-sm" /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 btn-primary py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
