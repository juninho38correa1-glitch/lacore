'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, RotateCcw, Search, Trash2, FileText, Banknote, CalendarDays } from 'lucide-react'
import { sb, fR, fD, WA_NUMBER } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { Sale, Product, Customer } from '@/lib/types'

interface ItemVenda { product_id: string; product: Product | null; price: string }

export default function VendasTable() {
  const { user, isAdmin } = useAuth()
  const searchParams = useSearchParams()
  const [vendas, setVendas] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [novaModal, setNovaModal] = useState(false)
  const [notaModal, setNotaModal] = useState<Sale | null>(null)
  const [detalheModal, setDetalheModal] = useState<Sale | null>(null)
  const [prods, setProds] = useState<Product[]>([])
  const [clientes, setClientes] = useState<Customer[]>([])
  const [saving, setSaving] = useState(false)

  // Multi-item
  const [itens, setItens] = useState<ItemVenda[]>([{ product_id: '', product: null, price: '' }])

  // Pagamento
  const [payType, setPayType] = useState<'avista' | 'parcelado'>('avista')
  const [payMethod, setPayMethod] = useState('PIX')
  const [installments, setInstallments] = useState('2')
  // Parcelas com datas individuais (igual ao módulo de parcelamentos)
  const [parcelaDates, setParcelaDates] = useState<{ date: string; amount: string }[]>([
    { date: '', amount: '' }, { date: '', amount: '' },
  ])
  const [customer_id, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [channel, setChannel] = useState('DIRETO')

  const load = async () => {
    setLoading(true)
    const q = isAdmin()
      ? sb.from('sales').select('id,reference,product_id,vendor_id,customer_id,total_price,cost_brl_unit,profit_total,margin_percent,channel,notes,status,created_at,product:products(brand,model,color),customer:customers(name,phone)')
      : sb.from('sales').select('id,reference,product_id,vendor_id,customer_id,total_price,cost_brl_unit,profit_total,margin_percent,channel,notes,status,created_at,product:products(brand,model,color),customer:customers(name)').eq('vendor_id', user!.id)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
    if (error) console.error('Erro vendas:', error)
    setVendas((data || []) as Sale[])
    setLoading(false)
  }

  const loadNew = async () => {
    const [p, c] = await Promise.all([
      sb.from('products').select('id,brand,model,color,storage,condition,price_current,cost_brl_unit,price_min').eq('status', 'ATIVO').order('brand'),
      sb.from('customers').select('id,name,phone').order('name').limit(200),
    ])
    setProds((p.data || []) as Product[])
    setClientes((c.data || []) as Customer[])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (searchParams.get('nova')) { setNovaModal(true); loadNew() } }, [searchParams])

  const openNova = () => {
    loadNew(); setNovaModal(true)
    setItens([{ product_id: '', product: null, price: '' }])
    setPayType('avista'); setPayMethod('PIX'); setInstallments('2')
    setParcelaDates([{ date: '', amount: '' }, { date: '', amount: '' }])
    setCustomerId(''); setNotes(''); setChannel('DIRETO')
  }

  const onProdSel = (idx: number, id: string) => {
    const p = prods.find(x => x.id === id)
    setItens(prev => prev.map((item, i) => i === idx ? { product_id: id, product: p || null, price: p?.price_current?.toString() || '' } : item))
  }

  const onInstallmentsChange = (n: string) => {
    const num = parseInt(n) || 1
    setInstallments(n)
    setParcelaDates(prev => {
      const next = [...prev]
      while (next.length < num) next.push({ date: '', amount: '' })
      while (next.length > num) next.pop()
      return next
    })
  }

  const distribuirValor = () => {
    const n = parcelaDates.length
    if (!totalVenda || !n) return
    const base = Math.floor((totalVenda / n) * 100) / 100
    const last = Math.round((totalVenda - base * (n - 1)) * 100) / 100
    setParcelaDates(prev => prev.map((p, i) => ({ ...p, amount: (i === n - 1 ? last : base).toString() })))
  }

  const totalVenda = itens.reduce((a, it) => a + (parseFloat(it.price) || 0), 0)
  const totalCusto = itens.reduce((a, it) => a + (it.product?.cost_brl_unit || 0), 0)
  const lucroTotal = totalVenda - totalCusto
  const totalParcelas = parcelaDates.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0)
  const diffParc = Math.abs(totalVenda - totalParcelas) > 0.01

  const saveVenda = async () => {
    if (itens.some(it => !it.product_id || !it.price)) { toast('Selecione produto e preço para todos os itens', 'error'); return }
    if (payType === 'parcelado') {
      if (parcelaDates.some(p => !p.date || !p.amount)) { toast('Preencha data e valor de todas as parcelas', 'error'); return }
      if (diffParc) { toast(`Soma das parcelas (${fR(totalParcelas)}) difere do valor da venda (${fR(totalVenda)})`, 'error'); return }
    }
    setSaving(true)
    try {
      const ref = 'VDA-' + Date.now().toString(36).toUpperCase()
      const saleId = crypto.randomUUID()

      const firstPrice = parseFloat(itens[0].price) || 0
      const firstCost = itens[0].product?.cost_brl_unit || 0
      const profitUnit = firstPrice - firstCost

      await sb.from('sales').insert({
        id: saleId,
        reference: ref,
        product_id: itens[0].product_id,
        vendor_id: user!.id,
        customer_id: customer_id || null,
        quantity: 1,
        sale_price: firstPrice,
        total_price: totalVenda,
        discount_amount: 0,
        cost_brl_unit: totalCusto,
        profit_unit: profitUnit,
        profit_total: lucroTotal,
        margin_percent: totalVenda ? (lucroTotal / totalVenda * 100) : 0,
        channel: channel,
        notes: [
          notes,
          itens.length > 1 ? `Itens: ${itens.map(it => `${it.product?.brand} ${it.product?.model} (${fR(parseFloat(it.price))})`).join(', ')}` : '',
          payType === 'parcelado' ? `Parcelado ${installments}x — datas personalizadas` : '',
        ].filter(Boolean).join('\n') || null,
        status: 'APROVADA',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // Marcar produtos como vendidos
      for (const it of itens) {
        await sb.from('products').update({ status: 'VENDIDO' }).eq('id', it.product_id)
      }

      // Cashflow — só à vista
      if (payType === 'avista') {
        await sb.from('cashflow').insert({
          id: crypto.randomUUID(), type: 'ENTRADA_VENDA',
          description: `Venda ${ref} — ${itens.map(it => `${it.product?.brand} ${it.product?.model}`).join(', ')}`,
          amount: totalVenda, sale_id: saleId, created_by: user!.id,
          date: new Date().toISOString(), payment_method: payMethod,
        })
      }

      // Parcelado — criar contrato com datas individuais
      if (payType === 'parcelado') {
        const contractId = crypto.randomUUID()
        const n = parcelaDates.length
        const buyer = clientes.find(c => c.id === customer_id)

        await sb.from('installment_contracts').insert({
          id: contractId,
          buyer_name: buyer?.name || 'Cliente não identificado',
          buyer_phone: buyer?.phone || null,
          product_description: itens.map(it => `${it.product?.brand} ${it.product?.model}`).join(' + '),
          total_amount: totalVenda, down_payment: 0, financed_amount: totalVenda,
          installments: n, installment_value: parseFloat(parcelaDates[0].amount) || 0,
          contract_date: new Date().toISOString().split('T')[0],
          first_due_date: parcelaDates[0].date,
          seller_id: user!.id, status: 'ATIVO', notes: notes || null,
        })

        for (let i = 0; i < n; i++) {
          await sb.from('installment_payments').insert({
            id: crypto.randomUUID(), contract_id: contractId,
            installment_number: i + 1, due_date: parcelaDates[i].date,
            amount: parseFloat(parcelaDates[i].amount), status: 'PENDENTE',
          })
        }

        toast(`Venda ${ref} + contrato ${n}x criados! Acompanhe em Parcelamentos.`, 'success')
      } else {
        toast(`Venda ${ref} registrada!`, 'success')
      }

      setNovaModal(false); load()
    } catch (e) { console.error(e); toast('Erro ao registrar venda', 'error') }
    finally { setSaving(false) }
  }

  const estornar = async (id: string) => {
    const venda = vendas.find(v => v.id === id)
    if (!venda || !confirm(`Cancelar venda ${venda.reference}?`)) return
    // Devolver produto ao estoque
    await sb.from('products').update({ status: 'ATIVO' }).eq('id', venda.product_id)
    // Cancelar a venda
    await sb.from('sales').update({ status: 'CANCELADA' }).eq('id', id)
    // Remover do cashflow
    await sb.from('cashflow').delete().eq('sale_id', id)
    // Cancelar contrato de parcelamento vinculado (se existir)
    // Buscar contrato pelo produto e comprador
    const buyer = (venda.customer as Record<string,string> | null)?.name || ''
    const prod = (venda.product as Record<string,string> | null)
    if (prod) {
      const { data: contratos } = await sb.from('installment_contracts')
        .select('id')
        .ilike('product_description', `%${prod.brand}%${prod.model}%`)
        .eq('status', 'ATIVO')
      if (contratos?.length) {
        for (const ct of contratos) {
          await sb.from('installment_contracts').update({ status: 'CANCELADO' }).eq('id', ct.id)
          await sb.from('installment_payments').update({ status: 'CANCELADO' }).eq('contract_id', ct.id).neq('status', 'PAGO')
        }
      }
    }
    toast('Venda cancelada', 'info'); load()
  }

  // Gerar comprovante profissional
  const gerarNota = async (v: Sale) => {
    // Abrir janela ANTES dos awaits — iOS Safari bloqueia window.open() após async
    const w = window.open('', '_blank')
    if (!w) { toast('Permita pop-ups para gerar o comprovante', 'error'); return }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;background:#f1f5f9;display:flex;justify-content:center;padding:20px}</style></head><body><p style="color:#64748b;font-size:14px;font-family:sans-serif">Gerando comprovante...</p></body></html>`)

    const [{ data: logoData }, { data: prodData }] = await Promise.all([
      sb.from('system_config').select('value').eq('key', 'company_logo').single(),
      sb.from('products').select('brand,model,color,storage,ram,condition,photos:product_photos(url)').eq('id', v.product_id).single(),
    ])
    const logoUrl   = logoData?.value || ''
    const prodPhotos = (prodData?.photos as { url: string }[] | undefined) || []
    const fmtBRL    = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
    const fmtDate   = (s: string) => { const [y,m,d] = s.substring(0,10).split('-'); return `${d}/${m}/${y}` }

    // ── Detectar venda multi-item a partir do notes ──────────────────────
    // Formato gravado: "Itens: Brand Model (R$ X,XX), Brand2 Model2 (R$ Y,YY)"
    interface ItemComprovante { nome: string; preco: string; foto: string }
    let itensComprovante: ItemComprovante[] = []

    const notesLines = (v.notes || '').split('\n')
    const itensLine  = notesLines.find(l => l.startsWith('Itens:'))

    if (itensLine) {
      // Split em "), " para separar itens (cada um termina com ")")
      const raw = itensLine.replace(/^Itens:\s*/, '')
      const partes: string[] = []
      let cur = ''
      for (const ch of raw) {
        cur += ch
        if (ch === ')') { partes.push(cur.trim().replace(/^[,\s]+/, '')); cur = '' }
      }
      // Para cada item buscar foto no banco por brand + model
      itensComprovante = await Promise.all(
        partes.map(async (parte) => {
          const match = parte.match(/^(.+?)\s*\((.+?)\)$/)
          const nome  = match?.[1]?.trim() || parte
          const preco = match?.[2]?.trim() || ''
          // Buscar foto: primeiro token = brand, resto = model
          const [itemBrand, ...modelParts] = nome.split(' ')
          const itemModel = modelParts.join(' ')
          let foto = ''
          if (itemBrand && itemModel) {
            // Usar as 2 primeiras palavras significativas do modelo como padrão de busca
            // Ex: "Poco C85 4G" → "%Poco%C85%" → bate com "Poco C85" e "Poco C85 4G"
            const sigWords = itemModel.split(' ').filter(w => w.length > 1).slice(0, 2)
            const ilikePattern = '%' + sigWords.join('%') + '%'

            const { data: fps } = await sb
              .from('products')
              .select('photos:product_photos(url)')
              .eq('brand', itemBrand)
              .ilike('model', ilikePattern)
              .limit(5)

            // Pegar a primeira foto disponível entre os produtos encontrados
            if (fps?.length) {
              for (const fp of fps) {
                const url = (fp.photos as { url: string }[])?.[0]?.url
                if (url) { foto = url; break }
              }
            }
          }
          return { nome, preco, foto }
        })
      )
    } else {
      // Venda de item único — usar prodData normalmente
      const prod = v.product as Record<string, string> | null
      const nome = [prodData?.brand || prod?.brand, prodData?.model || prod?.model, prodData?.storage]
        .filter(Boolean).join(' ')
      itensComprovante = [{ nome, preco: fmtBRL(v.total_price), foto: prodPhotos[0]?.url || '' }]
    }

    const isMulti   = itensComprovante.length > 1

    // ── Produto único (para seção de specs) ──────────────────────────────
    const prod = v.product as Record<string, string> | null
    const cust = v.customer as Record<string, string> | null
    const brand     = prodData?.brand     || prod?.brand  || ''
    const model     = prodData?.model     || prod?.model  || ''
    const storage   = prodData?.storage   || ''
    const color     = prodData?.color     || prod?.color  || ''
    const ram       = prodData?.ram       || ''
    const condition = prodData?.condition || ''

    // ── Parcelas ─────────────────────────────────────────────────────────
    let parcelas: { installment_number: number; due_date: string; amount: number; status: string }[] = []
    if (v.notes && v.notes.includes('Parcelado')) {
      const searchTerm = (brand + ' ' + model).trim()
      const { data: contracts } = await sb
        .from('installment_contracts')
        .select('id,installments')
        .ilike('product_description', `%${searchTerm}%`)
        .in('status', ['ATIVO', 'INADIMPLENTE'])
        .order('created_at', { ascending: false })
        .limit(1)
      if (contracts?.length) {
        const { data: pays } = await sb
          .from('installment_payments')
          .select('installment_number,due_date,amount,status')
          .eq('contract_id', contracts[0].id)
          .order('installment_number')
        parcelas = (pays || []) as typeof parcelas
      }
    }

    const isParcelado = parcelas.length > 0
    const pagas   = parcelas.filter(p => p.status === 'PAGO').length
    const progPct = isParcelado ? Math.round((pagas / parcelas.length) * 100) : 0
    const verCode = v.reference + '-' + v.created_at.substring(0,10).replace(/-/g,'')
    const waLink  = cust?.phone ? `https://wa.me/55${(cust.phone).replace(/\D/g,'')}` : `https://wa.me/${WA_NUMBER}`
    const CANAL_LABEL: Record<string, string> = { DIRETO: 'Presencial', WHATSAPP: 'WhatsApp', OLX: 'OLX', MERCADO_LIVRE: 'Mercado Livre', FACEBOOK: 'Facebook', SHOPEE: 'Shopee', OUTRO: 'Outro' }

    const nota = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comprovante de Venda — ${v.reference}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#eff6ff 0%,#f8fafc 50%,#f0fdf4 100%);min-height:100vh;display:flex;justify-content:center;align-items:flex-start;padding:24px 16px;-webkit-font-smoothing:antialiased}
  .doc{background:#fff;border-radius:20px;max-width:500px;width:100%;box-shadow:0 4px 0 rgba(0,0,0,.06),0 20px 60px rgba(0,0,0,.12);overflow:hidden;position:relative}

  /* Header gradient */
  .doc-header{background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 40%,#3b82f6 100%);padding:28px 28px 22px;position:relative;overflow:hidden}
  .doc-header::before{content:'';position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.07)}
  .doc-header::after{content:'';position:absolute;bottom:-20px;right:40px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.05)}
  .brand-row{display:flex;align-items:center;gap:12px;margin-bottom:20px}
  .brand-logo{width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2)}
  .brand-logo img{width:100%;height:100%;object-fit:contain;border-radius:10px}
  .brand-name{font-family:'Sora',sans-serif;font-size:16px;font-weight:700;color:#fff;letter-spacing:.08em}
  .brand-sub{font-size:10px;color:rgba(255,255,255,.65);letter-spacing:.05em;margin-top:2px}
  .status-chip{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;padding:4px 12px;border-radius:99px;font-size:11px;font-weight:600;backdrop-filter:blur(8px)}
  .status-chip::before{content:'';width:6px;height:6px;border-radius:50%;background:#4ade80;flex-shrink:0}
  .header-ref{font-family:'Sora',sans-serif;font-size:26px;font-weight:800;color:#fff;letter-spacing:-.02em;margin-top:8px;line-height:1}
  .header-date{font-size:11px;color:rgba(255,255,255,.6);margin-top:4px}

  /* Body */
  .doc-body{padding:24px 28px}

  /* Produto card */
  .produto-card{display:flex;gap:14px;align-items:center;padding:14px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;margin-bottom:20px}
  .produto-foto{width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0;background:#f1f5f9}
  .produto-foto-placeholder{width:64px;height:64px;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:24px}
  .produto-nome{font-family:'Sora',sans-serif;font-size:16px;font-weight:700;color:#0f172a;line-height:1.2}
  .produto-specs{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
  .spec-chip{background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600}
  .spec-chip.green{background:#dcfce7;color:#166534}
  .spec-chip.gray{background:#f1f5f9;color:#64748b}

  /* Seções */
  .section{margin-bottom:18px}
  .section-title{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:10px;display:flex;align-items:center;gap:6px}
  .section-title::after{content:'';flex:1;height:1px;background:#f1f5f9}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .info-item{background:#f8fafc;border-radius:10px;padding:10px 12px}
  .info-item.full{grid-column:1/-1}
  .info-label{font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:3px}
  .info-value{font-size:13px;font-weight:500;color:#0f172a}

  /* Total box */
  .total-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #bbf7d0;border-radius:16px;padding:20px 24px;margin:20px 0;display:flex;align-items:center;justify-content:space-between}
  .total-label{font-size:11px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .total-value{font-family:'Sora',sans-serif;font-size:32px;font-weight:800;color:#15803d;font-variant-numeric:tabular-nums;line-height:1}

  /* Parcelas */
  .parcelas-section{margin-bottom:18px}
  .progress-bar{height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-bottom:10px}
  .progress-fill{height:100%;background:linear-gradient(90deg,#2563eb,#3b82f6);border-radius:99px;transition:width .3s}
  .parc-table{width:100%;border-collapse:collapse}
  .parc-table th{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:600;padding:4px 8px;text-align:left;border-bottom:1px solid #f1f5f9}
  .parc-table td{font-size:12px;padding:6px 8px;border-bottom:1px solid #f8fafc;color:#334155}
  .parc-table tr:last-child td{border-bottom:none}
  .parc-pago{color:#16a34a;font-weight:600}
  .parc-pago::before{content:'✓ '}
  .parc-pendente{color:#2563eb}

  /* Garantia */
  .garantia-box{background:linear-gradient(135deg,#fefce8,#fef9c3);border:1px solid #fde047;border-radius:12px;padding:14px 16px;margin-bottom:18px;display:flex;align-items:flex-start;gap:10px}
  .garantia-icon{font-size:20px;flex-shrink:0;line-height:1}
  .garantia-title{font-size:12px;font-weight:700;color:#854d0e;margin-bottom:2px}
  .garantia-text{font-size:11px;color:#92400e;line-height:1.5}

  /* Contato */
  .contact-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:20px}
  .contact-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px}
  .contact-wa{display:inline-flex;align-items:center;gap:8px;background:#25d366;color:#fff;padding:8px 16px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;font-family:'Inter',sans-serif}
  .contact-wa svg{flex-shrink:0}

  /* Verificação */
  .verify-box{background:#f1f5f9;border-radius:10px;padding:12px 14px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between}
  .verify-label{font-size:9.5px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px}
  .verify-code{font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#334155;letter-spacing:.05em}

  /* Footer */
  .doc-footer{padding:16px 28px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;background:#fafafa}
  .footer-brand{font-size:10px;color:#94a3b8}
  .footer-brand strong{color:#2563eb}
  .footer-legal{font-size:9px;color:#cbd5e1;text-align:right}

  /* Print actions */
  .print-bar{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);border-bottom:1px solid #e2e8f0;padding:10px 16px;display:flex;gap:8px;align-items:center}
  .btn-print{background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;display:inline-flex;align-items:center;gap:6px}
  .btn-close{background:#f1f5f9;color:#64748b;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif}
  .print-label{font-size:11px;color:#94a3b8;margin-left:auto}
  @media print{
    @page{size:A4 portrait;margin:6mm 8mm}
    .print-bar,.print-fab{display:none!important}
    /* min-height:100vh no body era o culpado das 2 páginas — no print vira 0 */
    body{background:#fff!important;padding:0!important;display:block!important;min-height:0!important;height:auto!important;align-items:unset!important}
    .doc{border-radius:0;box-shadow:none;max-width:100%;width:100%}
    .doc-header{padding:16px 20px 14px}
    .header-ref{font-size:20px}
    .doc-body{padding:14px 20px}
    .total-box{padding:12px 16px;margin:12px 0}
    .total-value{font-size:24px}
    .section{margin-bottom:10px}
    .produto-card{padding:10px;margin-bottom:12px}
    .garantia-box{padding:10px 12px;margin-bottom:10px}
    .contact-box{padding:10px 12px;margin-bottom:12px}
    .verify-box{padding:8px 12px;margin-bottom:10px}
    .doc-footer{padding:10px 20px}
    .brand-row{margin-bottom:12px}
    .parcelas-section{margin-bottom:10px}
  }
  @media(max-width:520px){.doc-header{padding:20px 20px 18px}.doc-body{padding:18px 20px}.header-ref{font-size:20px}.total-value{font-size:26px}.info-grid{grid-template-columns:1fr}.info-item.full{grid-column:1}}
</style>
</head>
<body>
<div style="width:100%;max-width:500px">
  <div class="print-bar">
    <button class="btn-print" onclick="window.print()">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Imprimir / PDF
    </button>
    <button class="btn-close" onclick="window.close()">✕ Fechar</button>
    <span class="print-label">Ctrl+P para salvar PDF</span>
  </div>

  <div class="doc">
    <!-- Header -->
    <div class="doc-header">
      <div class="brand-row">
        <div class="brand-logo">${logoUrl ? `<img src="${logoUrl}" alt="Logo">` : `<svg width="22" height="20" viewBox="0 0 40 36" fill="none"><path d="M4 4L4 28L18 28" stroke="white" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 4C22 4 37 4 37 18C37 28 30 28 30 28" stroke="white" stroke-width="4.5" stroke-linecap="round"/></svg>`}</div>
        <div>
          <div class="brand-name">LACORE STORE</div>
          <div class="brand-sub">TECNOLOGIA NO SEU NÍVEL</div>
        </div>
        <div style="margin-left:auto">
          <div class="status-chip">Venda Aprovada</div>
        </div>
      </div>
      <div class="header-ref">${v.reference}</div>
      <div class="header-date">Emitido em ${new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })} às ${new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}</div>
    </div>

    <!-- Body -->
    <div class="doc-body">

      <!-- Produto(s) -->
      ${isMulti
        ? /* Múltiplos itens: lista com separador e preço individual */
          `<div style="margin-bottom:20px">
            <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:10px;display:flex;align-items:center;gap:6px">
              ${itensComprovante.length} Produtos adquiridos
              <span style="flex:1;height:1px;background:#f1f5f9;display:inline-block"></span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${itensComprovante.map((it, idx) => `
                <div style="display:flex;gap:12px;align-items:center;padding:12px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
                  <div style="font-size:13px;font-weight:700;color:#64748b;width:20px;flex-shrink:0;text-align:center">${idx + 1}</div>
                  ${it.foto
                    ? `<img src="${it.foto}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0" alt="${it.nome}">`
                    : `<div style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">📱</div>`}
                  <div style="flex:1;min-width:0">
                    <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.nome}</div>
                  </div>
                  <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#2563eb;flex-shrink:0">${it.preco}</div>
                </div>`).join('')}
            </div>
          </div>`
        : /* Item único: card com foto + specs */
          `<div class="produto-card">
            ${itensComprovante[0]?.foto
              ? `<img src="${itensComprovante[0].foto}" class="produto-foto" alt="${brand} ${model}">`
              : `<div class="produto-foto-placeholder">📱</div>`}
            <div style="flex:1;min-width:0">
              <div class="produto-nome">${brand} ${model}</div>
              <div class="produto-specs">
                ${storage   ? `<span class="spec-chip">${storage}</span>`          : ''}
                ${ram       ? `<span class="spec-chip green">${ram}</span>`        : ''}
                ${color     ? `<span class="spec-chip gray">${color}</span>`       : ''}
                ${condition ? `<span class="spec-chip gray">${condition}</span>`   : ''}
              </div>
            </div>
          </div>`
      }

      <!-- Total -->
      <div class="total-box">
        <div>
          <div class="total-label">Valor total da venda</div>
          <div class="total-value">${fmtBRL(v.total_price)}</div>
        </div>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#dcfce7"/><path d="M12 20l5 5 11-11" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>

      <!-- Infos da venda -->
      <div class="section">
        <div class="section-title">Detalhes</div>
        <div class="info-grid">
          <div class="info-item"><div class="info-label">Data</div><div class="info-value">${fmtDate(v.created_at)}</div></div>
          <div class="info-item"><div class="info-label">Pagamento</div><div class="info-value">${isParcelado ? `Parcelado ${parcelas.length}x` : (CANAL_LABEL[v.channel || ''] || v.channel || 'À Vista')}</div></div>
          <div class="info-item"><div class="info-label">Vendedor</div><div class="info-value">${user?.name || 'Lacore Store'}</div></div>
          <div class="info-item"><div class="info-label">Canal</div><div class="info-value">${CANAL_LABEL[v.channel || ''] || v.channel || '—'}</div></div>
          ${cust?.name ? `<div class="info-item full"><div class="info-label">Comprador</div><div class="info-value">${cust.name}${cust.phone ? ` · ${cust.phone}` : ''}</div></div>` : ''}
        </div>
      </div>

      <!-- Parcelas -->
      ${isParcelado && parcelas.length > 0 ? `
      <div class="section">
        <div class="section-title">Parcelas (${pagas}/${parcelas.length} pagas)</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progPct}%"></div></div>
        <table class="parc-table">
          <thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>
            ${parcelas.map(p => `
              <tr>
                <td>${p.installment_number}/${parcelas.length}</td>
                <td>${fmtDate(p.due_date)}</td>
                <td style="font-weight:600">${fmtBRL(p.amount)}</td>
                <td class="${p.status === 'PAGO' ? 'parc-pago' : 'parc-pendente'}">${p.status === 'PAGO' ? 'Pago' : p.status === 'VENCIDO' ? '⚠ Vencido' : 'Pendente'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <!-- Garantia -->
      <div class="garantia-box">
        <div class="garantia-icon">🛡️</div>
        <div>
          <div class="garantia-title">Garantia contra Defeito de Fábrica — 90 dias</div>
          <div class="garantia-text"><strong>90 dias</strong> contra defeitos de fabricação comprovados. Não nos responsabilizamos por danos causados por mau uso, quedas, líquidos, violação ou avarias externas. Todo acionamento passa por <strong>análise técnica</strong> para confirmar a legitimidade antes de qualquer providência.</div>
        </div>
      </div>

      <!-- Contato -->
      <div class="contact-box">
        <div class="contact-title">Suporte &amp; Contato</div>
        <p style="font-size:11.5px;color:#64748b;margin-bottom:10px">Dúvidas? Precisa de ajuda? Fale conosco agora:</p>
        <a href="${waLink}" target="_blank" class="contact-wa">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Chamar no WhatsApp
        </a>
      </div>

      <!-- Código de verificação -->
      <div class="verify-box">
        <div>
          <div class="verify-label">Código de verificação</div>
          <div class="verify-code">${verCode}</div>
        </div>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M17 17h3v3M14 17h.01M20 14h.01"/></svg>
      </div>

    </div><!-- /doc-body -->

    <!-- Footer -->
    <div class="doc-footer">
      <div class="footer-brand">Emitido por <strong>Lacore Store</strong></div>
      <div class="footer-legal">Documento sem valor fiscal<br>Apenas comprovante de venda</div>
    </div>
  </div>
</div>
</body></html>`

    w.document.open()
    w.document.write(nota)
    w.document.close()
  }

  const filtered = vendas.filter(v => !search || `${v.reference} ${(v.product as Record<string,string>)?.brand} ${(v.product as Record<string,string>)?.model}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160, maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar venda..." style={{ paddingLeft: 32 }} />
        </div>
        <button className="btn btn-primary" onClick={openNova} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}>
          <Plus size={14} />Nova Venda
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Ref</th><th>Produto</th>
              {isAdmin() && <th className="hide-mobile">Cliente</th>}
              <th>Valor</th>
              {isAdmin() && <th className="hide-mobile">Lucro</th>}
              <th>Status</th><th className="hide-mobile">Data</th>
              <th></th>
            </tr></thead>
            <tbody>
              {!filtered.length && <tr><td colSpan={8}><div className="empty"><p className="empty-title">Nenhuma venda encontrada</p></div></td></tr>}
              {filtered.map(v => {
                const prod = v.product as Record<string,string> | null
                const cust = v.customer as Record<string,string> | null
                return (
                  <tr key={v.id} className="clickable" onClick={() => setDetalheModal(v)}>
                    <td className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>{v.reference}</td>
                    <td style={{ fontWeight: 500 }}>
                      {prod?.brand} {prod?.model}
                      {prod?.color && <span style={{ color: 'var(--text-4)', fontSize: 11, marginLeft: 4 }}>{prod.color}</span>}
                    </td>
                    {isAdmin() && <td className="hide-mobile" style={{ color: 'var(--text-3)', fontSize: 12 }}>{cust?.name || '—'}</td>}
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{fR(v.total_price)}</td>
                    {isAdmin() && <td className="hide-mobile mono" style={{ color: 'var(--green)' }}>{fR(v.profit_total || 0)}</td>}
                    <td><span className={`badge badge-${v.status === 'APROVADA' ? 'green' : v.status === 'CANCELADA' ? 'red' : 'gray'}`}>{v.status}</span></td>
                    <td className="hide-mobile" style={{ color: 'var(--text-4)', fontSize: 12 }}>{fD(v.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button onClick={() => gerarNota(v)} className="btn btn-ghost btn-icon-sm" title="Gerar comprovante" style={{ color: 'var(--accent)' }}><FileText size={13} /></button>
                        {v.status === 'APROVADA' && isAdmin() && (
                          <button onClick={() => estornar(v.id)} className="btn btn-ghost btn-icon-sm" title="Cancelar" style={{ color: 'var(--yellow)' }}><RotateCcw size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Detalhe da Venda */}
      <Modal open={!!detalheModal} onClose={() => setDetalheModal(null)} title="Detalhes da Venda" size="sm">
        {detalheModal && (() => {
          const v = detalheModal
          const prod = v.product as Record<string,string> | null
          const cust = v.customer as Record<string,string> | null
          const CANAL_LABEL: Record<string, string> = { DIRETO: 'Direto (presencial)', WHATSAPP: 'WhatsApp', OLX: 'OLX', MERCADO_LIVRE: 'Mercado Livre', FACEBOOK: 'Facebook', SHOPEE: 'Shopee', OUTRO: 'Outro' }
          return (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Badge status */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge badge-${v.status === 'APROVADA' ? 'green' : v.status === 'CANCELADA' ? 'red' : 'gray'}`}>{v.status}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{v.reference}</span>
              </div>

              {/* Produto */}
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginBottom: 6 }}>Produto</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{prod?.brand} {prod?.model}{prod?.color ? ` — ${prod.color}` : ''}</p>
              </div>

              {/* Cliente */}
              {cust?.name && (
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginBottom: 6 }}>Cliente</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{cust.name}</p>
                  {cust.phone && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{cust.phone}</p>}
                </div>
              )}

              {/* Valores e pagamento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginBottom: 4 }}>Valor Total</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{fR(v.total_price)}</p>
                </div>
                {isAdmin() && (
                  <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginBottom: 4 }}>Lucro</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{fR(v.profit_total || 0)}</p>
                  </div>
                )}
              </div>

              {/* Canal e data */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                {v.channel && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-4)' }}>Canal</span><span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{CANAL_LABEL[v.channel] || v.channel}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-4)' }}>Data</span><span style={{ color: 'var(--text-2)' }}>{fD(v.created_at)}</span></div>
                {v.notes && v.notes.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} style={{ borderTop: i === 0 ? '1px solid var(--border-1)' : 'none', paddingTop: i === 0 ? 6 : 0 }}>
                    <p style={{ color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 }}>{line}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={() => setDetalheModal(null)}>Fechar</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '9px' }} onClick={() => { setDetalheModal(null); gerarNota(v) }}>
                  <FileText size={13} />Comprovante
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Modal Nova Venda */}
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Venda" size="lg">
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '72vh', overflowY: 'auto' }}>

          {/* PRODUTOS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)' }}>Produtos</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setItens(prev => [...prev, { product_id: '', product: null, price: '' }])} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} />Adicionar item
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {itens.map((item, idx) => (
                <div key={idx} style={{ padding: 12, background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <label className="label">Produto *</label>
                      <select value={item.product_id} onChange={e => onProdSel(idx, e.target.value)}>
                        <option value="">Selecione...</option>
                        {prods.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} — {p.color} {p.storage} ({p.condition})</option>)}
                      </select>
                    </div>
                    <div style={{ width: 110, flexShrink: 0 }}>
                      <label className="label">Preço *</label>
                      <input type="number" value={item.price} onChange={e => setItens(prev => prev.map((it, i) => i === idx ? { ...it, price: e.target.value } : it))} placeholder="0.00" />
                    </div>
                    {itens.length > 1 && (
                      <button onClick={() => setItens(prev => prev.filter((_, j) => j !== idx))} style={{ marginTop: 20, padding: 6, borderRadius: 6, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* RESUMO */}
          {itens.some(it => it.price) && (
            <div className="form-grid-3" style={{ gap: 8, padding: '10px 12px', background: 'rgba(59,130,246,.05)', border: '1px solid rgba(59,130,246,.15)', borderRadius: 10, textAlign: 'center' }}>
              <div>
                <p style={{ fontSize: 10, color: 'var(--text-4)' }}>Total da venda</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{fR(totalVenda)}</p>
              </div>
            </div>
          )}

          {/* PAGAMENTO */}
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-4)', marginBottom: 10 }}>Pagamento</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['avista', 'parcelado'] as const).map(t => (
                <button key={t} onClick={() => setPayType(t)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${payType === t ? 'rgba(59,130,246,.4)' : 'var(--border-1)'}`, background: payType === t ? 'rgba(59,130,246,.1)' : 'var(--bg-2)', color: payType === t ? 'var(--accent)' : 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {t === 'avista' ? <><Banknote size={13} />À Vista</> : <><CalendarDays size={13} />Parcelado Próprio</>}
                  </span>
                </button>
              ))}
            </div>

            {payType === 'avista' ? (
              <div>
                <label className="label">Método</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  {['PIX','Dinheiro','Cartão Crédito','Cartão Débito','Transferência','Outro'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-grid-2" style={{ gap: 10 }}>
                  <div>
                    <label className="label">Número de parcelas</label>
                    <select value={installments} onChange={e => onInstallmentsChange(e.target.value)}>
                      {/* 1x incluído para pagamento futuro com data específica */}
                      {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => (
                        <option key={n} value={n}>{n === 1 ? '1x (pagamento futuro)' : `${n}x`}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" onClick={distribuirValor} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={!totalVenda}>
                      ÷ Distribuir igualmente
                    </button>
                  </div>
                </div>

                {/* Parcelas com datas individuais */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-4)', marginBottom: 8 }}>
                    {parseInt(installments) === 1 ? 'Data e valor do pagamento' : 'Data e valor de cada parcela'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {parcelaDates.map((p, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 8, alignItems: 'center' }}>
                        <div style={{ width: 26, height: 26, borderRadius: 99, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                          {i + 1}
                        </div>
                        <div>
                          <label className="label" style={{ fontSize: 9 }}>Vencimento *</label>
                          <input type="date" value={p.date} onChange={e => setParcelaDates(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                        </div>
                        <div>
                          <label className="label" style={{ fontSize: 9 }}>Valor (R$) *</label>
                          <input type="number" step="0.01" value={p.amount} onChange={e => setParcelaDates(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} placeholder="0.00" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Validação */}
                  {totalVenda > 0 && totalParcelas > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: diffParc ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)', border: `1px solid ${diffParc ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)'}`, borderRadius: 8, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-4)' }}>Total: <strong style={{ color: 'var(--accent)' }}>{fR(totalVenda)}</strong></span>
                        <span style={{ color: 'var(--text-4)' }}>Parcelas: <strong style={{ color: diffParc ? 'var(--red)' : 'var(--green)' }}>{fR(totalParcelas)}</strong></span>
                      </div>
                      {diffParc && <p style={{ color: 'var(--red)', marginTop: 3 }}>⚠ Diferença de {fR(Math.abs(totalVenda - totalParcelas))}</p>}
                      {!diffParc && <p style={{ color: 'var(--green)', marginTop: 3 }}>✓ Valores conferem — contrato será criado em Parcelamentos</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CANAL */}
          <div>
            <label className="label">Canal de venda</label>
            <select value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="DIRETO">Direto (presencial)</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="OLX">OLX</option>
              <option value="MERCADO_LIVRE">Mercado Livre</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="SHOPEE">Shopee</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>

          {/* CLIENTE E NOTAS */}
          <div>
            <label className="label">Cliente (opcional)</label>
            <select value={customer_id} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Sem cliente vinculado</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'none' }} placeholder="Ex: Garantia 3 meses, produto testado..." />
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={() => setNovaModal(false)}>Cancelar</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={saveVenda} disabled={saving}>
              {saving ? 'Salvando...' : 'Registrar Venda'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
