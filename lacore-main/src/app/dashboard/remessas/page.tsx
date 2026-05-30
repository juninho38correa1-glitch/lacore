'use client'
import { Suspense } from 'react'
import RemessasTable from '@/components/RemessasTable'
export default function RemessasPage() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-white">Remessas</h1><p className="text-gray-500 text-sm mt-0.5">Importações e gestão de remessas</p></div>
      <Suspense fallback={null}><RemessasTable /></Suspense>
    </div>
  )
}
