import { redirect } from 'next/navigation'
import { principal } from '@/lib/access'
import { CampusDashboard } from './dashboard'
import { AdminDashboard } from './admin-dashboard'
import type { DirectoryQuery } from '@/app/directory/directory-content'

export const metadata = { title: 'Dashboard · Thapar Connect' }

export default async function Account({params, searchParams}:{
  params:Promise<{role:string}>
  searchParams:Promise<DirectoryQuery>
}) {
  const {role} = await params
  const actor = await principal()
  if (!actor) redirect('/login')
  if (actor.user.role === 'ADMIN' && ['student', 'teacher'].includes(role)) {
    if (!actor.authorized) redirect('/login/challenge?workspace=' + role)
    return <CampusDashboard user={actor.user} teacher={role === 'teacher'} adminWorkspace query={await searchParams}/>
  }
  if (actor.user.role.toLowerCase() !== role) redirect('/account')
  if (!actor.authorized) redirect('/login/challenge')
  if (actor.user.role === 'STUDENT' || actor.user.role === 'TEACHER') {
    return <CampusDashboard user={actor.user} teacher={actor.user.role === 'TEACHER'} query={await searchParams}/>
  }
  return <AdminDashboard name={actor.user.name} query={await searchParams}/>
}

