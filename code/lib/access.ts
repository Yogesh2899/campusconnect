import { headers } from 'next/headers'
import type { Role } from '@prisma/client'
import { auth } from './auth'
import { db } from './db'

export async function principal(role?: Role) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user || user.suspended || user.deletedAt || !user.emailVerified || (role && role !== user.role)) return null
  const grant = user.role === 'ADMIN' && await db.verification.findFirst({
    where: { identifier: 'admin-grant:' + session.session.id, expiresAt: { gt: new Date() } },
  })
  return { user, session: session.session, authorized: user.role !== 'ADMIN' || Boolean(grant) }
}

export async function workspacePrincipal(workspace: string | null) {
  const actor = await principal()
  if (!actor?.authorized) return null
  if (actor.user.role !== 'ADMIN') return { ...actor.user, accountRole: actor.user.role }
  if (workspace !== 'student' && workspace !== 'teacher') return null
  const role = workspace === 'teacher' ? 'TEACHER' : 'STUDENT'
  return { ...actor.user, role, accountRole: actor.user.role } as const
}
