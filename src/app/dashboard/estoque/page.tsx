export const revalidate = 0
import EstoqueTable from '@/components/EstoqueTable'
export default function EstoquePage() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-white">Estoque</h1><p className="text-gray-500 text-sm mt-0.5">Gestão de produtos em estoque</p></div>
      <EstoqueTable />
    </div>
  )
}
