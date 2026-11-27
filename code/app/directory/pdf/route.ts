import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { redirect } from 'next/navigation'
import { principal } from '@/lib/access'

export const runtime = 'nodejs'

export async function GET() {
  const actor = await principal()
  if (!actor) redirect('/login')
  if (!actor.authorized) redirect('/login/challenge')

  const pdf = await readFile(join(process.cwd(), 'assets', 'thapar-connect-directory.pdf'))
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Thapar-Connect-Directory.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
