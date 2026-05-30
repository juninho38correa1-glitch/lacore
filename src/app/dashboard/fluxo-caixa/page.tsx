export const revalidate = 0
import FluxoCaixaTable from '@/components/FluxoCaixaTable'
export default function FluxoCaixaPage() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-white">Fluxo de Caixa</h1><p className="text-gray-500 text-sm mt-0.5">Entradas, saídas e saldo acumulado</p></div>
      <FluxoCaixaTable />
    </div>
  )
}
