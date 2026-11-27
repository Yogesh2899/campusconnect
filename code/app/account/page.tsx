import { redirect } from 'next/navigation'
import { principal } from '@/lib/access'
export default async function Account() {
  const actor = await principal()
  redirect(actor ? '/account/'+actor.user.role.toLowerCase() : '/login')
}
