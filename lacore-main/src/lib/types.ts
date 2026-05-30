export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'VENDEDOR'
  status: 'ATIVO' | 'INATIVO'
  commission_type?: 'percent_profit' | 'percent_sale' | 'fixed'
  commission_rate?: number
  monthly_goal?: number
  created_at?: string
}

export interface Product {
  id: string
  brand: string
  model: string
  category?: string
  color?: string
  storage?: string
  condition?: string
  imei?: string
  status: 'ATIVO' | 'VENDIDO' | 'RESERVADO' | 'INATIVO'
  quantity?: number
  cost_usd?: number
  cost_brl_unit?: number
  price_current?: number
  price_min?: number
  shipment_id?: string
  date_added?: string
  processor?: string
  ram?: string
  camera_main?: string
  camera_front?: string
  battery?: string
  screen?: string
  catalog_visible?: boolean
  catalog_highlight?: boolean
  catalog_label?: string
  catalog_installments?: number
  catalog_warranty?: string
  catalog_description?: string
  photos?: ProductPhoto[]
}

export interface ProductPhoto {
  id: string
  product_id: string
  url: string
  storage_key: string
  order: number
}

export interface Sale {
  id: string
  reference?: string
  product_id: string
  vendor_id: string
  customer_id?: string
  total_price: number
  cost_brl_unit?: number
  profit_total?: number
  margin_percent?: number
  payment_method?: string
  status: 'PENDENTE' | 'APROVADA' | 'ESTORNADA'
  notes?: string
  created_at: string
  product?: { brand: string; model: string; color?: string }
  vendor?: { name: string }
  customer?: { name: string; phone?: string }
}

export interface Shipment {
  id: string
  reference: string
  supplier?: string
  dollar_rate: number
  shipping_cost?: number
  insurance_cost?: number
  other_costs?: number
  total_cost_usd?: number
  total_cost_brl?: number
  shipment_date?: string
  arrival_date?: string
  notes?: string
  status: 'PENDENTE' | 'EM_TRANSITO' | 'CHEGOU' | 'PROCESSADO'
  created_at?: string
}

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  cpf?: string
  city?: string
  state?: string
  tags?: string[]
  notes?: string
  total_purchases?: number
  total_spent?: number
  last_purchase?: string
  created_at?: string
}

export interface CashflowEntry {
  id: string
  type: 'ENTRADA' | 'SAIDA'
  category: string
  description: string
  amount: number
  payment_method?: string
  reference_id?: string
  reference_type?: string
  date: string
  created_at?: string
}

export interface Commission {
  id: string
  vendor_id: string
  sale_id: string
  amount: number
  status: 'PENDENTE' | 'PAGA' | 'CANCELADA'
  created_at?: string
  vendor?: { name: string }
  sale?: { reference: string; total_price: number }
}
