'use client'
import { useState, useEffect } from 'react'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'
import { sb, fR, fD } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

export const revalidate = 0

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState('mes')
  const [loading, setLoading] = useState<string | null>(null)

  const getDatas = () => {
    const now = new Date()
    if (periodo === 'mes') return { ini: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), fim: now.toISOString() }
    if (periodo === 'trimestre') return { ini: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(), fim: now.toISOString() }
    return { ini: new Date(now.getFullYear(), 0, 1).toISOString(), fim: now.toISOString() }
  }

  const downloadCSV = async (tipo: 'estoque' | 'fluxo') => {
    setLoading(tipo)
    try {
      if (tipo === 'estoque') {
        const { data } = await sb.from('products').select('brand,model,color,storage,condition,cost_brl_unit,price_current,status,date_added').eq('status', 'ATIVO').order('brand')
        const rows = (data || []).map((p: Record<string, unknown>) => [p.brand, p.model, p.color, p.storage, p.condition, p.cost_brl_unit, p.price_current, p.status, fD(p.date_added as string)].join(';'))
        const csv = ['Marca;Modelo;Cor;Storage;Condição;Custo;Preço;Status;Data', ...rows].join('\n')
        download(csv, `estoque_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
      } else {
        const { ini, fim } = getDatas()
        const { data } = await sb.from('cashflow').select('*').gte('date', ini).lte('date', fim).order('date')
        const rows = (data || []).map((e: Record<string, unknown>) => [fD(e.date as string), e.type, e.category, e.description, e.amount, e.payment_method].join(';'))
        const csv = ['Data;Tipo;Categoria;Descrição;Valor;Forma', ...rows].join('\n')
        download(csv, `fluxo_caixa_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
      }
      toast('CSV gerado!', 'success')
    } catch { toast('Erro ao gerar CSV', 'error') }
    finally { setLoading(null) }
  }

  const gerarPDF = async (tipo: 'lucro' | 'comissoes') => {
    setLoading('pdf_' + tipo)
    try {
      const { ini, fim } = getDatas()
      let content = ''
      if (tipo === 'lucro') {
        const { data } = await sb.from('sales').select('*,product:products(brand,model),vendor:users(name)').eq('status', 'APROVADA').gte('created_at', ini).lte('created_at', fim).order('created_at')
        const total_rev = (data || []).reduce((a: number, s: Record<string, unknown>) => a + (s.total_price as number || 0), 0)
        const total_prf = (data || []).reduce((a: number, s: Record<string, unknown>) => a + (s.profit_total as number || 0), 0)
        content = `
          <h2>Relatório de Lucro</h2>
          <p>Período: ${fD(ini)} a ${fD(fim)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0">
            <div style="background:#f8f9fa;padding:12px;border-radius:8px"><p style="color:#666;font-size:12px">Faturamento Total</p><p style="font-size:24px;font-weight:bold;color:#0891b2">${fR(total_rev)}</p></div>
            <div style="background:#f8f9fa;padding:12px;border-radius:8px"><p style="color:#666;font-size:12px">Lucro Total</p><p style="font-size:24px;font-weight:bold;color:#16a34a">${fR(total_prf)}</p></div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Ref</th><th>Produto</th><th>Vendedor</th><th>Valor</th><th>Lucro</th><th>Data</th></tr>
            ${(data || []).map((s: Record<string, unknown>) => `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:6px">${s.reference}</td><td>${(s.product as Record<string, string>)?.brand} ${(s.product as Record<string, string>)?.model}</td><td>${(s.vendor as Record<string, string>)?.name}</td><td>${fR(s.total_price as number)}</td><td style="color:#16a34a">${fR(s.profit_total as number)}</td><td>${fD(s.created_at as string)}</td></tr>`).join('')}
          </table>`
      } else {
        const { data } = await sb.from('commissions').select('*,vendor:users(name),sale:sales(reference,total_price)').gte('created_at', ini).lte('created_at', fim).order('created_at')
        const total = (data || []).reduce((a: number, c: Record<string, unknown>) => a + (c.amount as number || 0), 0)
        content = `
          <h2>Relatório de Comissões</h2>
          <p>Período: ${fD(ini)} a ${fD(fim)} — Total: <strong>${fR(total)}</strong></p>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px">
            <tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Vendedor</th><th>Venda</th><th>Comissão</th><th>Status</th><th>Data</th></tr>
            ${(data || []).map((c: Record<string, unknown>) => `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:6px">${(c.vendor as Record<string, string>)?.name}</td><td>${(c.sale as Record<string, string>)?.reference}</td><td style="color:#0891b2;font-weight:bold">${fR(c.amount as number)}</td><td>${c.status}</td><td>${fD(c.created_at as string)}</td></tr>`).join('')}
          </table>`
      }
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>LACORE — Relatório</title><style>body{font-family:sans-serif;padding:24px;color:#1f2937}h1{color:#0891b2;margin-bottom:4px}h2{color:#374151}table{width:100%;border-collapse:collapse}th{text-align:left;background:#f1f5f9;padding:8px}td{padding:6px;border-bottom:1px solid #e5e7eb}</style></head><body><h1>LACORE</h1><p style="color:#6b7280;margin-bottom:16px">Tecnologia no seu Nível.</p>${content}</body></html>`
      const w = window.open('', '_blank')!
      w.document.write(html)
      w.document.close()
      setTimeout(() => { w.print() }, 500)
      toast('PDF aberto para impressão!', 'success')
    } catch { toast('Erro ao gerar PDF', 'error') }
    finally { setLoading(null) }
  }

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob(['\ufeff' + content], { type })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div><h1 className="text-2xl font-bold text-white">Relatórios</h1><p className="text-gray-500 text-sm mt-0.5">Exportação de dados e relatórios</p></div>
      <div className="card">
        <label className="text-xs text-gray-400 mb-2 block font-medium">Período</label>
        <div className="flex gap-2">
          {[['mes', 'Este Mês'], ['trimestre', 'Últimos 3 Meses'], ['ano', 'Este Ano']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriodo(v)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${periodo === v ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-300'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { id: 'pdf_lucro', label: 'PDF — Relatório de Lucro', desc: 'Faturamento e lucro por venda', icon: FileText, action: () => gerarPDF('lucro'), color: 'cyan' },
          { id: 'pdf_comissoes', label: 'PDF — Comissões', desc: 'Comissões por vendedor', icon: FileText, action: () => gerarPDF('comissoes'), color: 'cyan' },
          { id: 'estoque', label: 'CSV — Estoque', desc: 'Todos os produtos em estoque', icon: FileSpreadsheet, action: () => downloadCSV('estoque'), color: 'green' },
          { id: 'fluxo', label: 'CSV — Fluxo de Caixa', desc: 'Entradas e saídas do período', icon: FileSpreadsheet, action: () => downloadCSV('fluxo'), color: 'green' },
        ].map(r => (
          <button key={r.id} onClick={r.action} disabled={loading === r.id} className="card text-left hover:border-cyan-500/40 transition-colors group disabled:opacity-50">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${r.color === 'cyan' ? 'bg-cyan-500/15' : 'bg-green-500/15'}`}>
                {loading === r.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <r.icon size={16} className={r.color === 'cyan' ? 'text-cyan-400' : 'text-green-400'} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold group-hover:text-cyan-300 transition-colors">{r.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{r.desc}</p>
              </div>
              <Download size={14} className="text-gray-600 group-hover:text-gray-400 mt-1 flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
