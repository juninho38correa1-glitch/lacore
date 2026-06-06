export const revalidate = 0
import ClientesTable from '@/components/ClientesTable'
export default function ClientesPage() {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-white">Clientes</h1><p className="text-gray-500 text-sm mt-0.5">CRM e relacionamento com clientes</p></div>
      <ClientesTable />
    </div>
  )
}
