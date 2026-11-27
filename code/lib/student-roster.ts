import { z } from 'zod'
import { address, InputError } from './enrollment'
import { OWNER_EMAIL } from './account-policy'
import { campusDay, dayStart, shiftDays } from './campus-time'
import { validRegistrationDepartment } from './departments'
import { db } from './db'

const roster = z.array(z.strictObject({
  email: address.refine(email => email !== OWNER_EMAIL),
  name: z.string().trim().min(1).max(120),
  studentId: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,32}$/),
  year: z.number().int().min(1).max(8),
  department: z.string().refine(validRegistrationDepartment).nullable(),
})).length(160)

export async function scheduleStudents(payload: unknown, adminId: string, now = new Date()) {
  const rows = roster.parse(payload)
  const emails = rows.map(row => row.email)
  const studentIds = rows.map(row => row.studentId)
  if (new Set(emails).size !== rows.length || new Set(studentIds).size !== rows.length) {
    throw new InputError('Each email and student ID must appear once.')
  }
  const start = new Date(shiftDays(dayStart(campusDay(now)), 1).getTime() + 10.5 * 3600000)
  await db.$transaction(async tx => {
    const [existing, profiles, faculty, invitations, scheduled] = await Promise.all([
      tx.user.count({ where: { email: { in: emails } } }),
      tx.studentProfile.count({ where: { studentId: { in: studentIds } } }),
      tx.dcseFaculty.count({ where: { email: { in: emails } } }),
      tx.teacherInvitation.count({ where: { email: { in: emails } } }),
      tx.scheduledStudent.count({ where: { OR: [{ email: { in: emails } }, { studentId: { in: studentIds } }] } }),
    ])
    if (existing || profiles || faculty || invitations || scheduled) {
      throw new InputError('The roster overlaps an existing account, faculty record, invitation, or import. No records were scheduled.', 409)
    }
    await tx.scheduledStudent.createMany({
      data: rows.map((row, index) => ({
        ...row, scheduledBy: adminId, scheduledAt: shiftDays(start, Math.floor(index * 15 / rows.length)),
      })),
    })
    await tx.auditLog.create({ data: { actorId: adminId, action: 'STUDENT_ROSTER_SCHEDULED' } })
  })
  return { total: rows.length, first: campusDay(start), last: campusDay(shiftDays(start, 14)) }
}

export async function processStudentRoster(now = new Date()) {
  const due = await db.scheduledStudent.findMany({
    where: { scheduledAt: { lte: now }, processedAt: null }, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    select: { id: true }, take: 40,
  })
  let processed = 0
  for (const { id } of due) {
    const handled = await db.$transaction(async tx => {
      const claimed = await tx.scheduledStudent.updateMany({ where: { id, processedAt: null }, data: { processedAt: new Date() } })
      if (!claimed.count) return false
      const row = await tx.scheduledStudent.findUniqueOrThrow({ where: { id }, include: {
        scheduler: { select: { role: true, suspended: true, deletedAt: true, emailVerified: true } },
      } })
      const { scheduler, email, studentId, scheduledBy } = row
      const [user, student, faculty, invitation, department] = await Promise.all([
        tx.user.findUnique({ where: { email }, select: { id: true } }),
        tx.studentProfile.findUnique({ where: { studentId }, select: { userId: true } }),
        tx.dcseFaculty.findUnique({ where: { email }, select: { email: true } }),
        tx.teacherInvitation.findUnique({ where: { email }, select: { id: true } }),
        row.department ? tx.department.findUnique({ where: { name: row.department }, select: { id: true } }) : null,
      ])
      const active = scheduler.role === 'ADMIN' && scheduler.emailVerified && !scheduler.suspended && !scheduler.deletedAt
      const created = active && !user && !student && !faculty && !invitation ? await tx.user.create({
        data: {
          name: row.name, email, role: 'STUDENT', emailVerified: false,
          student: { create: { studentId, year: row.year, departmentId: department?.id } },
        },
        select: { id: true },
      }) : null
      const outcome = created ? 'Provisioned' : active ? 'Duplicate' : 'Administrator inactive'
      await tx.scheduledStudent.update({ where: { id }, data: { outcome } })
      await tx.auditLog.create({ data: {
        actorId: scheduledBy, targetId: created?.id ?? id,
        action: created ? 'STUDENT_PROVISIONED_FROM_ROSTER' : 'STUDENT_ROSTER_RECORD_SKIPPED',
      } })
      return true
    })
    if (handled) processed++
  }
  return processed
}
