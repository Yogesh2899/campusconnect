import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { auth } from './auth'
import { db } from './db'
import { address, InputError } from './enrollment'
import { openStatuses } from './meeting-permissions'

const id = z.string().min(1).max(80)
const label = z.string().trim().min(1).max(120)
const studentId = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,32}$/)
const year = z.coerce.number().int().min(1).max(8)
const optionalId = z.union([id, z.literal('')]).optional()
const notice = { title: label, body: z.string().trim().min(1).max(2000) }
const form = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('add-student'), email: address, name: label, studentId, year, departmentId: optionalId }),
  z.strictObject({ operation: z.literal('add-faculty'), email: address, name: label, designation: label, office: label, floor: z.coerce.number().int().min(0).max(99) }),
  z.strictObject({ operation: z.literal('edit-user'), id, name: label, departmentId: optionalId }),
  z.strictObject({ operation: z.literal('verify-user'), id }),
  z.strictObject({ operation: z.literal('suspend-user'), id }),
  z.strictObject({ operation: z.literal('activate-user'), id }),
  z.strictObject({ operation: z.literal('delete-user'), id, confirmation: address }),
  z.strictObject({ operation: z.literal('role-student'), id, studentId, year, departmentId: optionalId }),
  z.strictObject({ operation: z.literal('role-teacher'), id, employeeId: label, designation: label, departmentId: id }),
  z.strictObject({ operation: z.literal('reset-user'), id }),
  z.strictObject({ operation: z.literal('announce-create'), departmentId: id, ...notice }),
  z.strictObject({ operation: z.literal('announce-edit'), id, ...notice }),
  z.strictObject({ operation: z.literal('announce-archive'), id }),
])
const accountRoles = ['STUDENT', 'TEACHER'] as const
const conflict = (message: string) => new InputError(message, 409)

export async function applyAdminAction(actorId: string, payload: unknown, headers: Headers) {
  const action = form.parse(payload)
  const now = new Date()
  if (action.operation === 'reset-user') {
    const target = await db.user.findFirst({
      where: { id: action.id, role: { in: [...accountRoles] }, deletedAt: null, suspended: false, emailVerified: true },
      select: { id: true, email: true },
    })
    if (!target) throw conflict('Password recovery requires an active, email-verified account.')
    const key = 'campus-admin-recovery:' + target.id
    await db.$transaction(async tx => {
      const acquired = await tx.$executeRaw`INSERT INTO "RateLimit" ("id","key","count","lastRequest")
        VALUES (${randomUUID()}, ${key}, 1, ${BigInt(now.getTime())})
        ON CONFLICT ("key") DO UPDATE SET "lastRequest" = EXCLUDED."lastRequest"
        WHERE "RateLimit"."lastRequest" <= ${BigInt(now.getTime() - 60000)}`
      if (!acquired) throw new InputError('Wait a minute before sending another recovery link.', 429)
      await tx.auditLog.create({ data: { actorId, targetId: target.id, action: 'ADMIN_PASSWORD_RESET_REQUESTED' } })
    })
    await auth.api.requestPasswordReset({ body: { email: target.email, redirectTo: new URL('/login/reset', process.env.BETTER_AUTH_URL).href }, headers })
    return
  }

  await db.$transaction(async tx => {
    async function audit(event: string, targetId: string) {
      await tx.auditLog.create({ data: { actorId, action: event, targetId } })
    }
    if (action.operation === 'add-student') {
      if (await tx.teacherInvitation.findUnique({ where: { email: action.email }, select: { id: true } })) {
        throw conflict('This address already has a faculty invitation.')
      }
      const user = await tx.user.create({ data: {
        email: action.email, name: action.name, role: 'STUDENT',
        student: { create: { studentId: action.studentId, year: action.year, departmentId: action.departmentId || null } },
      } })
      await audit('STUDENT_PROVISIONED', user.id)
      return
    }
    if (action.operation === 'add-faculty') {
      const { email, name, designation, office, floor } = action
      await tx.dcseFaculty.create({ data: { email, name, designation, office, floor } })
      await audit('FACULTY_RECORD_CREATED', email)
      return
    }
    if (action.operation === 'announce-create') {
      const post = await tx.campusAnnouncement.create({ data: {
        authorId: actorId, departmentId: action.departmentId, title: action.title, body: action.body,
      } })
      await audit('ANNOUNCEMENT_PUBLISHED', post.id)
      return
    }
    if (action.operation === 'announce-edit' || action.operation === 'announce-archive') {
      const result = await tx.campusAnnouncement.updateMany({
        where: { id: action.id, archivedAt: null },
        data: action.operation === 'announce-edit' ? { title: action.title, body: action.body } : { archivedAt: now },
      })
      if (!result.count) throw new InputError('Active announcement not found.', 404)
      await audit(action.operation === 'announce-edit' ? 'ANNOUNCEMENT_UPDATED' : 'ANNOUNCEMENT_ARCHIVED', action.id)
      return
    }

    const user = await tx.user.findFirst({
      where: { id: action.id, role: { in: [...accountRoles] }, deletedAt: null },
      select: { id: true, name: true, email: true, role: true, emailVerified: true, suspended: true },
    })
    if (!user) throw new InputError('Account unavailable.', 404)
    if (action.operation === 'verify-user') {
      if (!user.emailVerified) throw conflict('The user must first verify their own institutional email.')
      await tx.user.update({ where: { id: user.id }, data: { adminVerifiedAt: now } })
      await audit('ACCOUNT_REVIEWED', user.id)
      return
    }
    if (action.operation === 'edit-user') {
      await tx.user.update({ where: { id: user.id }, data: { name: action.name } })
      if (action.departmentId !== undefined && user.role === 'STUDENT') {
        await tx.studentProfile.updateMany({ where: { userId: user.id }, data: { departmentId: action.departmentId || null } })
      }
      if (action.departmentId && user.role === 'TEACHER') {
        await tx.teacherProfile.updateMany({ where: { userId: user.id }, data: { departmentId: action.departmentId } })
      }
      await audit('USER_UPDATED', user.id)
      return
    }
    if (action.operation === 'activate-user') {
      await tx.user.update({ where: { id: user.id }, data: { suspended: false } })
      await audit('ACCOUNT_ACTIVATED', user.id)
      return
    }
    if (action.operation === 'suspend-user' || action.operation === 'delete-user') {
      const removing = action.operation === 'delete-user'
      if (removing) {
        if (action.confirmation !== user.email || !user.suspended) throw conflict('Suspend the account and type its full email address to confirm removal.')
        const meetings = await tx.campusMeeting.findMany({ where: {
          status: { in: [...openStatuses] },
          AND: [
            { OR: [{ studentId: user.id }, { slot: { teacherId: user.id } }] },
            { OR: [{ slot: { endAt: { gt: now } } }, { proposedSlot: { startAt: { gt: now } } }] },
          ],
        }, select: { id: true, studentId: true, subject: true, slot: { select: { teacherId: true } } } })
        await tx.campusMeeting.updateMany({ where: { id: { in: meetings.map(item => item.id) } }, data: {
          status: 'CANCELLED', proposedSlotId: null, proposalBy: null, returnStatus: null, proposedLocation: null,
        } })
        if (meetings.length) await tx.campusNotice.createMany({ data: meetings.map(item => ({
          userId: item.studentId === user.id ? item.slot.teacherId : item.studentId,
          message: 'The meeting “' + item.subject + '” was cancelled because a participant’s account was removed.',
        })) })
      }
      await tx.user.update({ where: { id: user.id }, data: { suspended: true, ...(removing ? { deletedAt: now } : {}) } })
      await tx.session.deleteMany({ where: { userId: user.id } })
      await audit(removing ? 'ACCOUNT_DELETED' : 'ACCOUNT_SUSPENDED', user.id)
      return
    }

    const role = action.operation === 'role-teacher' ? 'TEACHER' : 'STUDENT'
    if (!user.emailVerified || user.role === role) throw conflict('Select a different role for an email-verified account.')
    const active = await tx.campusMeeting.findFirst({ where: {
      status: { in: [...openStatuses] },
      AND: [
        { OR: [{ studentId: user.id }, { slot: { teacherId: user.id } }] },
        { OR: [{ slot: { endAt: { gt: now } } }, { proposedSlot: { startAt: { gt: now } } }] },
      ],
    }, select: { id: true } })
    if (active) throw conflict('Resolve this account’s outstanding meetings before changing its role.')
    if (action.operation === 'role-teacher') {
      const data = { employeeId: action.employeeId, departmentId: action.departmentId, designation: action.designation }
      await tx.teacherProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data })
    } else {
      const data = { studentId: action.studentId, year: action.year, departmentId: action.departmentId || null }
      await tx.studentProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data })
      await tx.campusSlot.updateMany({ where: { teacherId: user.id, startAt: { gt: now } }, data: { closed: true } })
    }
    await tx.user.update({ where: { id: user.id }, data: { role, adminVerifiedAt: null } })
    await tx.session.deleteMany({ where: { userId: user.id } })
    await audit('ACCOUNT_ROLE_CHANGED_TO_' + role, user.id)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
