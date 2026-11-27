import { notFound, redirect } from 'next/navigation'
import { LoginScreen } from '@/components/login-screen'
import { principal } from '@/lib/access'
import { db } from '@/lib/db'
import { googleEnabled } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export default async function AuthPage({params}:{params:Promise<{mode:string}>}) {
  const {mode} = await params
  if (!['student','teacher','admin','forgot','reset','activate','faculty-setup','owner-setup','otp','challenge','invite','suspend'].includes(mode)) notFound()
  if (['challenge','invite','suspend'].includes(mode)) {
    const actor = await principal('ADMIN')
    if (!actor) redirect('/login/admin')
    if (mode!=='challenge' && !actor.authorized) redirect('/login/challenge')
  }
  const departments = mode === 'invite' ? await db.department.findMany({orderBy:{name:'asc'}}) : []
  return <LoginScreen mode={mode} departments={departments} google={googleEnabled}/>
}

