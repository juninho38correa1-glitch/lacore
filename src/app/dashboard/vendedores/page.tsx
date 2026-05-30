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
  const [form, setForm] = useState({ name: '', email: '', password: '', commission_type: 'PERCENTUAL_LUCRO', commission_rate: 10, monthly_goal: 0 })
  const [saving, setSaving] = useState(false)
  const [commissions, setCommissions] = useState<Record<string, number>>({})

  useEffect(() => { if (!isAdmin()) router.push('/dashboard') }, [isAdmin])

  const load = async () => {
    setLoading(true)
    // Usar RPC SECURITY DEFINER para contornar RLS
    const { data, error } = await sb.rpc('get_vendedores')
    if (error) console.error('Vendedores RPC erro:', error)
    setVends((data || []) as User[])

    const { data: c } = await sb.from('commissions').select('vendor_id,amount').eq('status', 'PENDENTE')
    const map: Record<string, number> = {}
    ;(c || []).forEach((x: { vendor_id: string; amount: number }) => {
      map[x.vendor_id] = (map[x.vendor_id] || 0) + x.amount
    })
    setCommissions(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const hashPass = async (pass: string) => {
    const { data } = await sb.rpc('hash_password', { p_password: pass })
    return data
  }

  const save = async () => {
    if (!form.name || !form.email) { toast('Nome e email obrigatórios', 'error'); return }
    setSaving(true)
    try {
      if (modal === 'novo') {
        if (!form.password) { toast('Senha obrigatória', 'error'); setSaving(false); return }
        const hash = await hashPass(form.password)
        // Usar RPC SECURITY DEFINER para contornar RLS no insert
        const { data, error } = await sb.rpc('criar_vendedor', {
          p_name: form.name,
          p_email: form.email,
          p_password_hash: hash,
          p_commission_type: form.commission_type,
          p_commission_rate: form.commission_rate,
          p_monthly_goal: form.monthly_goal || null,
        })
        if (error) throw error
        const result = data as { error?: string; success?: boolean }
        if (result?.error) throw new Error(result.error)
      } else {
        const hash = form.password ? await hashPass(form.password) : null
        // Usar RPC SECURITY DEFINER para contornar RLS no update
        const { data, error } = await sb.rpc('atualizar_vendedor', {
          p_id: (modal as User).id,
          p_name: form.name,
          p_email: form.email,
          p_password_hash: hash,
          p_commission_type: form.commission_type,
          p_commission_rate: form.commission_rate,
          p_monthly_goal: form.monthly_goal || null,
        })
        if (error) throw error
        const result = data as { error?: string; success?: boolean }
        if (result?.error) throw new Error(result.error)
      }
      toast(modal === 'novo' ? 'Vendedor criado!' : 'Atualizado!', 'success')
      setModal(null); load()
    } catch (e) {
      console.error(e)
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    }
    finally { setSaving(false) }
  }

  const toggle = async (v: User) => {
    const ns = v.status === 'ATIVO' ? 'INATIVO' : 'ATIVO'
    // Usar RPC SECURITY DEFINER para contornar RLS
    await sb.rpc('toggle_vendedor_status', { p_id: v.id, p_status: ns })
    toast(`${v.name} ${ns === 'ATIVO' ? 'ativado' : 'desativado'}`, 'info')
    load()
  }

  const pagarComissao = async (vid: string, name: string, valor: number) => {
    if (!confirm(`Pagar ${fR(valor)} para ${name}?`)) return
    await sb.from('commissions').update({ status: 'PAGA' }).eq('vendor_id', vid).eq('status', 'PENDENTE')
    await sb.from('cashflow').insert({
      id: crypto.randomUUID(), type: 'SAIDA_COMISSAO',
      description: `Comissão ${name}`, amount: valor,
      date: new Date().toISOString(),
    })
    toast('Comissão paga!', 'success'); load()
  }

  const openEdit = (v: User) => {
    setForm({ name: v.name, email: v.email, password: '', commission_type: v.commission_type || 'PERCENTUAL_LUCRO', commission_rate: v.commission_rate || 10, monthly_goal: v.monthly_goal || 0 })
    setModal(v)
  }

  const tipoLabel = (t?: string) => ({ PERCENTUAL_LUCRO: '% Lucro', PERCENTUAL_VENDA: '% Venda', FIXO_POR_VENDA: 'Fixo' })[t || ''] || '—'
  const shown = vends.filter(v => v.status === tab)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><h1 className="page-title">Vendedores</h1><p className="page-sub">Equipe e comissões</p></div>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', email: '', password: '', commission_type: 'PERCENTUAL_LUCRO', commission_rate: 10, monthly_goal: 0 }); setModal('novo') }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} />Novo Vendedor
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {(['ATIVO', 'INATIVO'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 16px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .12s', border: '1px solid', background: tab === t ? 'rgba(59,130,246,.1)' : 'transparent', borderColor: tab === t ? 'rgba(59,130,246,.3)' : 'var(--border-1)', color: tab === t ? 'var(--accent)' : 'var(--text-3)' }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="grid-vend">
          {!shown.length && <p style={{ color: 'var(--text-4)', fontSize: 13, gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>Nenhum vendedor {tab.toLowerCase()}</p>}
          {shown.map(v => (
            <div key={v.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{ini(v.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.email}</p>
                </div>
                <span className={`badge badge-${v.status === 'ATIVO' ? 'green' : 'gray'}`}>{v.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['Tipo', tipoLabel(v.commission_type), 'var(--text-1)'], ['Taxa', `${v.commission_rate || 0}%`, 'var(--accent)'], ['Meta', fR(v.monthly_goal || 0), 'var(--text-1)'], ['Comissão Pend.', fR(commissions[v.id] || 0), 'var(--yellow)']].map(([l, val, c]) => (
                  <div key={l} style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 8, padding: '8px 10px', cursor: l === 'Comissão Pend.' && commissions[v.id] ? 'pointer' : 'default' }}
                    onClick={() => l === 'Comissão Pend.' && commissions[v.id] && pagarComissao(v.id, v.name, commissions[v.id])}>
                    <p style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-4)', marginBottom: 3 }}>{l}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: c }}>{val}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEdit(v)}><Edit2 size={12} />Editar</button>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => toggle(v)}>
                  {v.status === 'ATIVO' ? <><ToggleRight size={13} style={{ color: 'var(--green)' }} />Desativar</> : <><ToggleLeft size={13} />Ativar</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'Novo Vendedor' : `Editar — ${(modal as User)?.name}`} size="sm">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['Nome *', 'name', 'text'], ['Email *', 'email', 'email'], [modal !== 'novo' ? 'Senha (vazio = manter)' : 'Senha *', 'password', 'password']].map(([l, k, t]) => (
            <div key={k}><label className="label">{l}</label><input type={t} value={(form as Record<string, string>)[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
          ))}
          <div><label className="label">Tipo de Comissão</label>
            <select value={form.commission_type} onChange={e => setForm(f => ({ ...f, commission_type: e.target.value }))}>
              <option value="PERCENTUAL_LUCRO">% do Lucro</option>
              <option value="PERCENTUAL_VENDA">% da Venda</option>
              <option value="FIXO_POR_VENDA">Fixo por venda</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className="label">Taxa (%)</label><input type="number" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: parseFloat(e.target.value) || 0 }))} /></div>
            <div><label className="label">Meta Mensal (R$)</label><input type="number" value={form.monthly_goal} onChange={e => setForm(f => ({ ...f, monthly_goal: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
