'use client'
import { Suspense } from 'react'
import VendasTable from '@/components/VendasTable'
export default function VendasPage() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-white">Vendas</h1><p className="text-gray-500 text-sm mt-0.5">Registro e gestão de vendas</p></div>
      <Suspense fallback={null}><VendasTable /></Suspense>
    </div>
  )
}
