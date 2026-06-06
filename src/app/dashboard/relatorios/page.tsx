'use client'
import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, ShoppingCart, Printer, Share2 } from 'lucide-react'
import { sb, fR, fD } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'

interface ReportData { html: string; title: string }

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState('mes')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [reportModal, setReportModal] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)

  const getDatas = () => {
    const now = new Date()
    if (periodo === 'mes') return { ini: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), fim: now.toISOString() }
    if (periodo === 'trimestre') return { ini: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(), fim: now.toISOString() }
    return { ini: new Date(now.getFullYear(), 0, 1).toISOString(), fim: now.toISOString() }
  }

  const wrapHTML = (titulo: string, subtitulo: string, content: string, logoUrl = '') => `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #f1f5f9">
      ${logoUrl
        ? `<img src="${logoUrl}" style="width:42px;height:42px;border-radius:10px;object-fit:contain;background:#0c0e14;flex-shrink:0" />`
        : `<div style="width:42px;height:42px;border-radius:10px;background:#2563eb;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="18" viewBox="0 0 40 36" fill="none"><path d="M4 4L4 28L18 28" stroke="white" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 4C22 4 37 4 37 18C37 28 30 28 30 28" stroke="white" stroke-width="4.5" stroke-linecap="round"/></svg></div>`
      }
      <div><h1 style="margin:0;font-size:20px;color:#0f172a">${titulo}</h1><p style="margin:4px 0 0;color:#94a3b8;font-size:12px">${subtitulo}</p></div>
      <p style="margin-left:auto;color:#94a3b8;font-size:11px">Emitido em ${fD(new Date().toISOString())}</p>
    </div>
    ${content}`

  const gerarPDF = async (tipo: 'lucro' | 'comissoes' | 'vendas' | 'parcelamentos') => {
    setLoading('pdf_' + tipo)
    try {
      const { ini, fim } = getDatas()
      let content = '', titulo = '', subtitulo = `Período: ${fD(ini)} a ${fD(fim)}`

      if (tipo === 'lucro') {
        titulo = 'Relatório de Lucro'
        const { data, error } = await sb.from('sales').select('reference,total_price,profit_total,margin_percent,created_at,product:products(brand,model)').eq('status', 'APROVADA').gte('created_at', ini).lte('created_at', fim).order('created_at')
        if (error) throw error
        const sales = data || []
        const total_rev = sales.reduce((a, s) => a + ((s as Record<string,number>).total_price || 0), 0)
        const total_prf = sales.reduce((a, s) => a + ((s as Record<string,number>).profit_total || 0), 0)
        const avg_mg = sales.length ? sales.reduce((a, s) => a + ((s as Record<string,number>).margin_percent || 0), 0) / sales.length : 0
        subtitulo += ` · ${sales.length} vendas`
        content = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
          <div style="background:#eff6ff;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em">Faturamento</p><p style="font-size:24px;font-weight:700;color:#1d4ed8;margin:0">${fR(total_rev)}</p></div>
          <div style="background:#f0fdf4;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em">Lucro Total</p><p style="font-size:24px;font-weight:700;color:#16a34a;margin:0">${fR(total_prf)}</p></div>
          <div style="background:#fefce8;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em">Margem Média</p><p style="font-size:24px;font-weight:700;color:#ca8a04;margin:0">${avg_mg.toFixed(1)}%</p></div>
        </div>
        <div class=\"table-wrap\"><table style=\"width:100%;border-collapse:collapse;font-size:12px\">
          <tr style="background:#f8fafc"><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Ref</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Produto</th><th style="padding:9px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Valor</th><th class="hide-mobile" style="padding:9px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Lucro</th><th class="hide-mobile" style="padding:9px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Margem</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Data</th></tr>
          ${sales.map((s) => { const p = (s as Record<string,Record<string,string>>).product; return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px;font-family:monospace;font-size:11px;color:#6b7280">${(s as Record<string,string>).reference}</td><td style="padding:8px">${p?.brand} ${p?.model}</td><td style="padding:8px;text-align:right;color:#1d4ed8;font-weight:600">${fR((s as Record<string,number>).total_price)}</td><td style="padding:8px;text-align:right;color:#16a34a">${fR((s as Record<string,number>).profit_total)}</td><td style="padding:8px;text-align:right;color:#ca8a04">${((s as Record<string,number>).margin_percent || 0).toFixed(1)}%</td><td style="padding:8px;color:#6b7280;font-size:11px">${fD((s as Record<string,string>).created_at)}</td></tr>` }).join('')}
        </table>`

      } else if (tipo === 'comissoes') {
        titulo = 'Relatório de Comissões'
        const { data, error } = await sb.from('commissions').select('id,commission_amount,status,created_at,sale_id,commission_rate,commission_type').gte('created_at', ini).lte('created_at', fim).order('created_at')
        if (error) throw error
        const comms = data || []
        const total = comms.reduce((a, c) => a + ((c as Record<string,number>).commission_amount || 0), 0)
        const pagas = comms.filter(c => (c as Record<string,string>).status === 'PAGA').reduce((a, c) => a + ((c as Record<string,number>).commission_amount || 0), 0)
        subtitulo += ` · ${comms.length} comissões`
        content = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
          <div style="background:#faf5ff;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Total</p><p style="font-size:24px;font-weight:700;color:#7c3aed;margin:0">${fR(total)}</p></div>
          <div style="background:#f0fdf4;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Pagas</p><p style="font-size:24px;font-weight:700;color:#16a34a;margin:0">${fR(pagas)}</p></div>
          <div style="background:#fef9c3;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Pendentes</p><p style="font-size:24px;font-weight:700;color:#ca8a04;margin:0">${fR(total - pagas)}</p></div>
        </div>
        <div class=\"table-wrap\"><table style=\"width:100%;border-collapse:collapse;font-size:12px\">
          <tr style="background:#f8fafc"><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Venda ID</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Tipo</th><th style="padding:9px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Taxa</th><th style="padding:9px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Valor</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Status</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Data</th></tr>
          ${comms.map((c) => { const isPaga = (c as Record<string,string>).status === 'PAGA'; return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px;font-family:monospace;font-size:11px;color:#6b7280">${(c as Record<string,string>).sale_id?.slice(0,8) || '—'}</td><td style="padding:8px;color:#6b7280;font-size:11px">${(c as Record<string,string>).commission_type || '—'}</td><td style="padding:8px;text-align:right;color:#6b7280">${((c as Record<string,number>).commission_rate || 0).toFixed(1)}%</td><td style="padding:8px;text-align:right;color:#7c3aed;font-weight:600">${fR((c as Record<string,number>).commission_amount || 0)}</td><td style="padding:8px"><span style="background:${isPaga ? '#dcfce7' : '#fef9c3'};color:${isPaga ? '#166534' : '#854d0e'};padding:2px 8px;border-radius:99px;font-size:10px">${(c as Record<string,string>).status}</span></td><td style="padding:8px;color:#6b7280;font-size:11px">${fD((c as Record<string,string>).created_at)}</td></tr>` }).join('')}
        </table>`

      } else if (tipo === 'parcelamentos') {
        titulo = 'Relatório de Parcelamentos'
        const { data: contracts } = await sb.from('installment_contracts').select('*').order('created_at', { ascending: false })
        const { data: payments } = await sb.from('installment_payments').select('*').in('status', ['PENDENTE','VENCIDO','PAGO'])
        const cs = contracts || []
        const ativos = cs.filter((c: Record<string,string>) => c.status === 'ATIVO').length
        const inadimplentes = cs.filter((c: Record<string,string>) => c.status === 'INADIMPLENTE').length
        const quitados = cs.filter((c: Record<string,string>) => c.status === 'QUITADO').length
        const totalAR = (payments || []).filter((p: Record<string,string>) => p.status !== 'PAGO').reduce((a, p) => a + ((p as Record<string,number>).amount || 0), 0)
        const totalRecebido = (payments || []).filter((p: Record<string,string>) => p.status === 'PAGO').reduce((a, p) => a + ((p as Record<string,number>).paid_amount || (p as Record<string,number>).amount || 0), 0)
        subtitulo = `${cs.length} contratos · Gerado em ${fD(new Date().toISOString())}`
        content = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px">
          <div style="background:#eff6ff;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Contratos Ativos</p><p style="font-size:24px;font-weight:700;color:#1d4ed8;margin:0">${ativos}</p></div>
          <div style="background:#fee2e2;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Inadimplentes</p><p style="font-size:24px;font-weight:700;color:#dc2626;margin:0">${inadimplentes}</p></div>
          <div style="background:#f0fdf4;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Total Recebido</p><p style="font-size:24px;font-weight:700;color:#16a34a;margin:0">${fR(totalRecebido)}</p></div>
          <div style="background:#fefce8;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">A Receber</p><p style="font-size:24px;font-weight:700;color:#ca8a04;margin:0">${fR(totalAR)}</p></div>
        </div>
        <div class=\"table-wrap\"><table style=\"width:100%;border-collapse:collapse;font-size:12px\">
          <tr style="background:#f8fafc"><th style="padding:9px;text-align:left">Cliente</th><th>Produto</th><th>Total</th><th>Parcelas</th><th>Recebido</th><th>Status</th></tr>
          ${cs.map((ct: Record<string,unknown>) => {
            const ctPays = (payments || []).filter((p: Record<string,string>) => p.contract_id === ct.id)
            const recebido = ctPays.filter((p: Record<string,string>) => p.status === 'PAGO').reduce((a, p) => a + ((p as Record<string,number>).paid_amount || (p as Record<string,number>).amount || 0), 0)
            const statusColor = ct.status === 'QUITADO' ? '#16a34a' : ct.status === 'INADIMPLENTE' ? '#dc2626' : '#2563eb'
            return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px">${ct.buyer_name}</td><td style="padding:8px;color:#6b7280">${ct.product_description}</td><td style="padding:8px;font-weight:600;color:#1d4ed8">${fR(ct.total_amount as number)}</td><td style="padding:8px;color:#6b7280">${ct.installments}x ${fR(ct.installment_value as number)}</td><td style="padding:8px;color:#16a34a">${fR(recebido)}</td><td style="padding:8px"><span style="background:${statusColor}22;color:${statusColor};padding:2px 8px;border-radius:99px;font-size:10px">${ct.status}</span></td></tr>`
          }).join('')}
        </table>`
      } else {
        titulo = 'Relatório de Vendas'
        let q = sb.from('sales').select('reference,total_price,profit_total,margin_percent,channel,status,created_at,product:products(brand,model,color),customer:customers(name)').gte('created_at', ini).lte('created_at', fim)
        // Filtrar APROVADA por padrão — nunca incluir canceladas no faturamento
        if (filtroStatus) q = q.eq('status', filtroStatus as 'APROVADA' | 'REJEITADA' | 'CANCELADA')
        else q = q.eq('status', 'APROVADA')
        const { data, error } = await q.order('created_at', { ascending: false })
        if (error) throw error
        const sales = data || []
        const total_rev = sales.reduce((a, s) => a + ((s as Record<string,number>).total_price || 0), 0)
        const total_prf = sales.reduce((a, s) => a + ((s as Record<string,number>).profit_total || 0), 0)
        subtitulo += ` · ${sales.length} vendas${filtroStatus ? ' · ' + filtroStatus : ''}`
        content = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
          <div style="background:#f0fdfa;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Total Vendas</p><p style="font-size:24px;font-weight:700;color:#0f766e;margin:0">${sales.length}</p></div>
          <div style="background:#eff6ff;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Faturamento</p><p style="font-size:24px;font-weight:700;color:#1d4ed8;margin:0">${fR(total_rev)}</p></div>
          <div style="background:#f0fdf4;padding:16px;border-radius:10px"><p style="color:#6b7280;font-size:11px;margin:0 0 6px">Lucro Total</p><p style="font-size:24px;font-weight:700;color:#16a34a;margin:0">${fR(total_prf)}</p></div>
        </div>
        <div class=\"table-wrap\"><table style=\"width:100%;border-collapse:collapse;font-size:12px\">
          <tr style="background:#f8fafc"><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Ref</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Produto</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Cliente</th><th style="padding:9px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Valor</th><th style="padding:9px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Lucro</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Pgto</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Status</th><th style="padding:9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Data</th></tr>
          ${sales.map((s) => { const p = (s as Record<string,Record<string,string>>).product; const cu = (s as Record<string,Record<string,string>>).customer; return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px;font-family:monospace;font-size:11px;color:#6b7280">${(s as Record<string,string>).reference}</td><td style="padding:8px">${p?.brand} ${p?.model}<br><small style="color:#9ca3af">${p?.color || ''}</small></td><td style="padding:8px;color:#6b7280">${cu?.name || '—'}</td><td style="padding:8px;text-align:right;color:#1d4ed8;font-weight:600">${fR((s as Record<string,number>).total_price)}</td><td style="padding:8px;text-align:right;color:#16a34a">${fR((s as Record<string,number>).profit_total || 0)}</td><td style="padding:8px;color:#6b7280;font-size:11px">${(s as Record<string,string>).channel || '—'}</td><td style="padding:8px"><span style="background:${(s as Record<string,string>).status === 'APROVADA' ? '#dcfce7' : '#fee2e2'};color:${(s as Record<string,string>).status === 'APROVADA' ? '#166534' : '#991b1b'};padding:2px 8px;border-radius:99px;font-size:10px">${(s as Record<string,string>).status}</span></td><td style="padding:8px;color:#6b7280;font-size:11px">${fD((s as Record<string,string>).created_at)}</td></tr>` }).join('')}
        </table>`
      }

      const { data: logoData } = await sb.from('system_config').select('value').eq('key', 'company_logo').single()
      const logoUrl = logoData?.value || ''
            const fullHTML = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LACORE — ${titulo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; color: #1f2937; max-width: 1100px; margin: 0 auto; font-size: 14px; }
  h1 { font-size: 18px; }
  .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 480px; }
  th { padding: 8px; text-align: left; background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; white-space: nowrap; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  @media (max-width: 640px) {
    .hide-mobile { display: none !important; }
    body { padding: 10px; }
    h1 { font-size: 15px; }
    div[style*="grid-template-columns: repeat(3"] { grid-template-columns: repeat(2, 1fr) !important; }
    div[style*="grid-template-columns: repeat(2"] { grid-template-columns: 1fr !important; }
  }
  @media print {
    body { padding: 16px; }
    .no-print { display: none !important; }
    .table-wrap { overflow: visible; }
  }
</style>
</head><body>${wrapHTML(titulo, subtitulo, content, logoUrl)}</body></html>`
      setReportData({ html: fullHTML, title: titulo })
      setReportModal(true)
      toast('Relatório gerado!', 'success')
    } catch (e) { console.error(e); toast('Erro ao gerar relatório', 'error') }
    finally { setLoading(null) }
  }

  const downloadCSV = async (tipo: 'estoque' | 'fluxo' | 'vendas') => {
    setLoading(tipo)
    try {
      const { ini, fim } = getDatas()
      let csv = '', filename = ''
      if (tipo === 'estoque') {
        const { data } = await sb.from('products').select('brand,model,color,storage,condition,cost_brl_unit,price_current,status,date_added').eq('status', 'ATIVO').order('brand')
        const rows = (data || []).map((p) => [(p as Record<string,string>).brand,(p as Record<string,string>).model,(p as Record<string,string>).color,(p as Record<string,string>).storage,(p as Record<string,string>).condition,(p as Record<string,number>).cost_brl_unit,(p as Record<string,number>).price_current,(p as Record<string,string>).status,fD((p as Record<string,string>).date_added)].join(';'))
        csv = ['Marca;Modelo;Cor;Storage;Condição;Custo;Preço;Status;Data', ...rows].join('\n')
        filename = `estoque_${new Date().toISOString().split('T')[0]}.csv`
      } else if (tipo === 'fluxo') {
        const { data } = await sb.from('cashflow').select('*').gte('date', ini).lte('date', fim).order('date')
        const rows = (data || []).map((e) => [fD((e as Record<string,string>).date),(e as Record<string,string>).type,(e as Record<string,string>).description,(e as Record<string,number>).amount,(e as Record<string,string>).payment_method].join(';'))
        csv = ['Data;Tipo;Descrição;Valor;Forma', ...rows].join('\n')
        filename = `fluxo_caixa_${new Date().toISOString().split('T')[0]}.csv`
      } else {
        let q = sb.from('sales').select('reference,total_price,profit_total,margin_percent,channel,status,created_at,product:products(brand,model,color),customer:customers(name,phone)').gte('created_at', ini).lte('created_at', fim)
        if (filtroStatus) q = q.eq('status', filtroStatus as 'APROVADA' | 'REJEITADA' | 'CANCELADA')
        const { data } = await q.order('created_at', { ascending: false })
        const rows = (data || []).map((s) => { const p = (s as Record<string,Record<string,string>>).product; const cu = (s as Record<string,Record<string,string>>).customer; return [(s as Record<string,string>).reference, p ? `${p.brand} ${p.model}` : '',p?.color||'',cu?.name||'',cu?.phone||'',(s as Record<string,number>).total_price,(s as Record<string,number>).profit_total||0,`${((s as Record<string,number>).margin_percent||0).toFixed(1)}%`,(s as Record<string,string>).channel,(s as Record<string,string>).status,fD((s as Record<string,string>).created_at)].join(';') })
        csv = ['Ref;Produto;Cor;Cliente;Telefone;Valor;Lucro;Margem;Pgto;Status;Data', ...rows].join('\n')
        filename = `vendas_${new Date().toISOString().split('T')[0]}.csv`
      }
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
      toast('CSV baixado!', 'success')
    } catch (e) { console.error(e); toast('Erro ao gerar CSV', 'error') }
    finally { setLoading(null) }
  }

  const imprimir = () => {
    if (!reportData) return
    const w = window.open('', '_blank')!
    const htmlComFechar = reportData.html.replace(
      '</body>',
      `<div class="no-print" style="position:fixed;bottom:20px;right:20px;z-index:999">
        <button onclick="window.close()" style="background:#2563eb;color:#fff;border:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,.4);font-family:sans-serif">
          ✕ Fechar
        </button>
      </div></body>`
    )
  w.document.write(htmlComFechar)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  const salvarPDF = () => {
    if (!reportData) return
    // Abrir nova aba com o relatório e acionar dialog de impressão
    // O usuário seleciona "Salvar como PDF" na impressora
    const w = window.open('', '_blank')!
    const html = reportData.html.replace(
      '</head>',
      `<style>
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        /* Instrução que some ao imprimir */
        #print-tip {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: #1d4ed8; color: #fff; text-align: center;
          padding: 12px; font-size: 14px; font-family: sans-serif; z-index: 9999;
        }
        @media print { #print-tip { display: none !important; } }
      </style></head>`
    ).replace(
      '</body>',
      `<div id="print-tip">💡 Para salvar como PDF: pressione <strong>Ctrl+P</strong> (ou ⌘+P no Mac) → selecione <strong>"Salvar como PDF"</strong> na impressora</div></body>`
    )
    w.document.write(html)
    w.document.close()
    // Acionar o dialog de impressão automaticamente após 800ms
    setTimeout(() => {
      w.focus()
      w.print()
    }, 800)
    toast('Selecione "Salvar como PDF" na janela de impressão', 'info')
  }

  const compartilhar = async () => {
    if (!reportData) return
    // Compartilhar como texto/link — mais compatível
    if (navigator.share) {
      try {
        await navigator.share({
          title: reportData.title,
          text: `Relatório LACORE Store — ${reportData.title}`,
        })
        return
      } catch { /* usuário cancelou */ }
    }
    // Fallback: copiar link do relatório
    await navigator.clipboard.writeText(window.location.href)
    toast('Link copiado!', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, width: '100%' }}>
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-sub">Exportação de dados e relatórios</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)' }}>Filtros</p>
        <div className="form-grid-2" style={{ gap: 12 }}>
          <div>
            <label className="label">Período</label>
            <select value={periodo} onChange={e => setPeriodo(e.target.value)}>
              <option value="mes">Este Mês</option>
              <option value="trimestre">Últimos 3 Meses</option>
              <option value="ano">Este Ano</option>
            </select>
          </div>
          <div>
            <label className="label">Status das Vendas</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="APROVADA">Aprovadas</option>
              <option value="REJEITADA">Rejeitadas</option>
              <option value="CANCELADA">Canceladas</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)', marginBottom: 10 }}>Relatórios PDF</p>
        <div className="grid-cols-3" style={{ gap: 10 }}>
          {[
            { id: 'pdf_lucro',     label: 'Lucro',     fn: () => gerarPDF('lucro')     },
            { id: 'pdf_comissoes', label: 'Comissões', fn: () => gerarPDF('comissoes') },
            { id: 'pdf_vendas',    label: 'Vendas',    fn: () => gerarPDF('vendas')    },
          ].map(r => (
            <button key={r.id} onClick={r.fn} disabled={loading === r.id} className="card" style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, opacity: loading === r.id ? .6 : 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loading === r.id ? <div className="spinner spinner-sm" /> : <FileText size={14} style={{ color: 'var(--accent)' }} />}
              </div>
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{r.label}</p>
              <p style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}><FileText size={10} />Ver relatório</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-4)', marginBottom: 10 }}>Exportar CSV</p>
        <div className="grid-cols-3" style={{ gap: 10 }}>
          {[
            { id: 'vendas',  label: 'Vendas',  fn: () => downloadCSV('vendas')  },
            { id: 'estoque', label: 'Estoque', fn: () => downloadCSV('estoque') },
            { id: 'fluxo',   label: 'Caixa',   fn: () => downloadCSV('fluxo')   },
          ].map(r => (
            <button key={r.id} onClick={r.fn} disabled={loading === r.id} className="card" style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, opacity: loading === r.id ? .6 : 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loading === r.id ? <div className="spinner spinner-sm" /> : <FileSpreadsheet size={14} style={{ color: 'var(--green)' }} />}
              </div>
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{r.label} CSV</p>
              <p style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 3 }}><Download size={10} />Baixar CSV</p>
            </button>
          ))}
        </div>
      </div>

      {/* Modal de visualização do relatório */}
      <Modal open={reportModal} onClose={() => setReportModal(false)} title={reportData?.title || 'Relatório'} size="xl">
        {/* Barra de ações com scroll horizontal no mobile */}
        <div style={{
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          borderBottom: '1px solid var(--border-1)',
          padding: '10px 16px',
        }}>
          <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
            <button className="btn btn-secondary btn-sm" onClick={imprimir} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <Printer size={12} />Imprimir
            </button>
            <button className="btn btn-secondary btn-sm" onClick={salvarPDF} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <Download size={12} />Salvar PDF
            </button>
            <button className="btn btn-secondary btn-sm" onClick={compartilhar} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <Share2 size={12} />Compartilhar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setReportModal(false)} style={{ whiteSpace: 'nowrap', marginLeft: 4 }}>
              ✕ Fechar
            </button>
          </div>
        </div>
        {reportData && (
          <div style={{ overflow: 'hidden', position: 'relative' }}>
            <iframe
              srcDoc={reportData.html}
              style={{
                width: '100%',
                height: 'min(70dvh, 560px)',
                border: 'none', background: '#fff', display: 'block',
              }}
              title={reportData.title}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
