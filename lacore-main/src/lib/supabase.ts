import { createClient } from '@supabase/supabase-js'

export const SB_URL = 'https://ritvdomqjwodevyhpqox.supabase.co'
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdHZkb21xandvZGV2eWhwcW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODcwMjcsImV4cCI6MjA5NTE2MzAyN30.eIS813sjVWvQihse4_uN5rnogEf7a_ghrynkoz5WePI'
export const WA_NUMBER = '5544997230700'

export const sb = createClient(SB_URL, SB_KEY)

// Chamada à Edge Function — igual ao original
export const callFn = async (name: string, body: Record<string, unknown>, userId?: string, userRole?: string) => {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 60000)
    const r = await fetch(`${SB_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, user_id: userId, user_role: userRole }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    return r.json()
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError')
      return { error: 'Tempo limite (60s). Verifique a conexão.' }
    return { error: e instanceof Error ? e.message : 'Erro desconhecido' }
  }
}

// Formatadores
export const fR = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
export const fD = (d: string) =>
  d ? new Intl.DateTimeFormat('pt-BR').format(new Date(d)) : '—'
export const fP = (v: number, dec = 1) => `${(v || 0).toFixed(dec)}%`
export const dI = (d: string) =>
  Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
export const ini = (n: string) =>
  (n || '').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase()

export const BRANDS = ['Apple','Samsung','Xiaomi','Motorola','Huawei','Sony','OnePlus','LG','Outro']
export const MODELS: Record<string, string[]> = {
  Apple: ['iPhone 15 Pro Max','iPhone 15 Pro','iPhone 15 Plus','iPhone 15','iPhone 14 Pro Max','iPhone 14 Pro','iPhone 14','iPhone 13 Pro','iPhone 13','iPhone 12','AirPods Pro 2','AirPods 3','Apple Watch S9','Apple Watch Ultra 2','Apple Watch SE','iPad Pro 12.9','iPad Air','MacBook Pro 14','MacBook Air M2'],
  Samsung: ['Galaxy S24 Ultra','Galaxy S24+','Galaxy S24','Galaxy S23 Ultra','Galaxy S23','Galaxy A55','Galaxy A54','Galaxy A35','Galaxy A14','Galaxy Z Fold 5','Galaxy Z Flip 5','Galaxy Watch 6'],
  Xiaomi: ['Xiaomi 14 Ultra','Xiaomi 14 Pro','Xiaomi 14','Redmi Note 14 4G','Redmi Note 14 5G','Redmi Note 13 Pro+','Redmi Note 13 Pro','Redmi Note 13','Redmi A5','POCO X6 Pro','POCO F5 Pro','POCO C85 4G'],
  Motorola: ['Edge 50 Pro','Edge 40 Pro','Edge 40','Moto G84','Moto G73','Moto G54','Razr 40 Ultra'],
  Huawei: ['P60 Pro','P60','Mate 60 Pro','Nova 11 Pro'],
  Sony: ['Xperia 1 VI','Xperia 1 V','Xperia 5 V'],
  OnePlus: ['OnePlus 12','OnePlus 11','OnePlus Nord 3'],
  LG: ['LG V60 ThinQ'],
  Outro: ['Outro Modelo'],
}
export const STORAGES = ['64GB','128GB','256GB','512GB','1TB']
export const COLORS = ['Preto','Branco','Azul','Prata','Grafite','Dourado','Roxo','Verde','Rosa','Titanium Natural','Titanium Black','Titanium White','Titan Desert']
export const CATS: Record<string, string> = {
  Apple: 'Smartphones', Samsung: 'Smartphones', Xiaomi: 'Smartphones',
  Motorola: 'Smartphones', Huawei: 'Smartphones', LG: 'Smartphones',
  Sony: 'Smartphones', OnePlus: 'Smartphones', Outro: 'Eletrônicos',
}
