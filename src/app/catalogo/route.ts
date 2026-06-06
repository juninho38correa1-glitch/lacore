import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

/**
 * Serve o catálogo público no endpoint /catalogo
 * Mantém a URL exata já divulgada: https://lacore.vercel.app/catalogo
 */
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'catalogo.html')
    const html = readFileSync(filePath, 'utf-8')

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch {
    return new NextResponse('Catálogo temporariamente indisponível.', { status: 500 })
  }
}
