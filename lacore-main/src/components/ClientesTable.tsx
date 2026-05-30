'use client'
import { useState, useEffect } from 'react'
import { Plus, Search, MessageCircle, Send } from 'lucide-react'
import { sb, fR, fD, WA_NUMBER } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { Customer } from '@/lib/types'

export default function ClientesTable() {
  const [clientes, setClientes] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Customer | 'novo' | null>(null)
  const [disparoModal, setDisparoModal] = useState(false)
  const [form, setForm] = useState<Partial<Customer>>({})
  const [saving, setSaving] = useState(false)
  const [dispMsg, setDispMsg] = useState('Olá {nome}! Temos novidades na LACORE. Acesse nosso catálogo! 🚀')
  const [dispTag, setDispTag] = useState('')
  const [disparando, setDisparando] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('customers').select('*').order('name')
    setClientes((data || []) as Customer[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const open = (c?: Customer) => {
    setForm(c ? { ...c } : { tags: [] })
    setModal(c || 'novo')
  }

  const save = async () => {
    if (!form.name || !form.phone) { toast('Nome e telefone são obrigatórios', 'error'); return }
    setSaving(true)
    const existing = modal !== 'novo' ? (modal as Customer) : null
    if (existing) {
      await sb.from('customers').update({ ...form, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await sb.from('customers').insert({ id: crypto.randomUUID(), ...form, total_purchases: 0, total_spent: 0, created_at: new Date().toISOString() })
    }
    toast('Cliente salvo!', 'success')
    setSaving(false); setModal(null); load()
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remover cliente ${name}?`)) return
    await sb.from('customers').delete().eq('id', id)
    toast('Cliente removido', 'info'); load()
  }

  const enviarWA = (phone: string, name: string) => {
    const num = phone.replace(/\D/g, '')
    const msg = `Olá ${name}! Temos novidades na LACORE. Acesse nosso catálogo: https://lacore.vercel.app/catalogo.html`
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const dispararMassa = async () => {
    const alvo = clientes.filter(c => c.phone && (!dispTag || c.tags?.includes(dispTag)))
    if (!alvo.length) { toast('Nenhum cliente com esse filtro', 'error'); return }
    if (!confirm(`Disparar para ${alvo.length} clientes?`)) return
    setDisparando(true)
    for (const c of alvo) {
      const num = c.phone!.replace(/\D/g, '')
      const msg = dispMsg.replace('{nome}', c.name.split(' ')[0])
      window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank')
      await new Promise(r => setTimeout(r, 800))
    }
    setDisparando(false); setDisparoModal(false)
    toast(`Disparos iniciados para ${alvo.length} clientes`, 'success')
  }

  const filtered = clientes.filter(c => !search || `${c.name} ${c.phone} ${c.city}`.toLowerCase().includes(search.toLowerCase()))
  const allTags = [...new Set(clientes.flatMap(c => c.tags || []))]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9 text-sm" /></div>
        <div className="flex gap-2">
          <button onClick={() => setDisparoModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-xs font-semibold"><Send size={13} />Disparo WA</button>
          <button onClick={() => open()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold"><Plus size={13} />Novo</button>
        </div>
      </div>
      {loading ? <div className="flex justify-center p-16"><div className="spinner spinner-lg" /></div> : (
        <div className="card p-0 overflow-hidden">
          <table>
            <thead><tr><th>Nome</th><th>Telefone</th><th>Cidade</th><th>Tags</th><th>Compras</th><th>Total Gasto</th><th></th></tr></thead>
            <tbody>
              {!filtered.length && <tr><td colSpan={7} className="text-center py-10 text-gray-600">Nenhum cliente</td></tr>}
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="font-semibold text-white cursor-pointer hover:text-cyan-300" onClick={() => open(c)}>{c.name}</td>
                  <td className="font-mono text-xs text-gray-400">{c.phone || '—'}</td>
                  <td className="text-gray-400 text-xs">{c.city || '—'}{c.state ? `/${c.state}` : ''}</td>
                  <td>{(c.tags || []).map(t => <span key={t} className="badge badge-gray mr-1">{t}</span>)}</td>
                  <td className="text-gray-400 text-xs">{c.total_purchases || 0}</td>
                  <td className="font-mono text-xs text-cyan-300">{fR(c.total_spent || 0)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {c.phone && <button onClick={() => enviarWA(c.phone!, c.name)} className="p-1.5 rounded hover:bg-green-500/15 text-gray-400 hover:text-green-400 transition-colors" title="WhatsApp"><MessageCircle size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal novo/editar cliente */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'novo' ? 'Novo Cliente' : `Editar — ${(modal as Customer)?.name}`} size="md">
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[['Nome *', 'name', 'text'], ['Telefone *', 'phone', 'text'], ['Email', 'email', 'email'], ['CPF', 'cpf', 'text'], ['Cidade', 'city', 'text'], ['Estado', 'state', 'text']].map(([l, k, t]) => (
              <div key={k}><label className="text-xs text-gray-400 mb-1 block">{l}</label><input type={t} value={(form as Record<string, string>)[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="text-sm" /></div>
            ))}
          </div>
          <div><label className="text-xs text-gray-400 mb-1 block">Tags (separadas por vírgula)</label><input value={(form.tags || []).join(', ')} onChange={e => setForm(f => ({ ...f, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} placeholder="vip, recorrente, instagram" className="text-sm" /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">Observações</label><textarea rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-sm resize-none" /></div>
          <div className="flex gap-2 pt-1">
            {modal !== 'novo' && <button onClick={() => { remove((modal as Customer).id, (modal as Customer).name); setModal(null) }} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20">Remover</button>}
            <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 btn-primary py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal disparo WA */}
      <Modal open={disparoModal} onClose={() => setDisparoModal(false)} title="Disparo WhatsApp em Massa" size="md">
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Filtrar por Tag (deixe vazio para todos)</label>
            <select value={dispTag} onChange={e => setDispTag(e.target.value)} className="text-sm">
              <option value="">Todos os clientes</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Mensagem (use {'{nome}'} para personalizar)</label>
            <textarea rows={4} value={dispMsg} onChange={e => setDispMsg(e.target.value)} className="text-sm resize-none" />
          </div>
          <div className="p-3 rounded-lg bg-white/5 text-xs text-gray-400">
            Será disparado para: <strong className="text-white">{clientes.filter(c => c.phone && (!dispTag || c.tags?.includes(dispTag))).length} clientes</strong>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDisparoModal(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-sm">Cancelar</button>
            <button onClick={dispararMassa} disabled={disparando} className="flex-1 btn-primary py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50">{disparando ? 'Disparando...' : 'Disparar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
