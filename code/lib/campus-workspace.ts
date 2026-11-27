import { Prisma, type Role } from '@prisma/client'
import { z } from 'zod'
import { db } from './db'
import { InputError } from './enrollment'
import { campusDay, campusDate, campusTime } from './campus-time'
import { meetingPermissions, openStatuses } from './meeting-permissions'

export { openStatuses } from './meeting-permissions'
const occupied = [...openStatuses, 'COMPLETED'] as const
const short = z.string().trim().min(1).max(120)
const id = z.string().min(1).max(80)
const dayField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const durationField = z.coerce.number().int().refine(value => [15, 30, 45, 60].includes(value))
const fields = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('faculty-workspace-profile'), departmentId: id, designation: short }),
  z.strictObject({ operation: z.literal('slot-add'), day: dayField, time: timeField, duration: durationField, weeks: z.coerce.number().int().min(1).max(12).default(1) }),
  z.strictObject({ operation: z.literal('slot-edit'), id, day: dayField, time: timeField, duration: durationField }),
  z.strictObject({ operation: z.literal('slot-close'), id }),
  z.strictObject({ operation: z.literal('block-add'), day: dayField, start: timeField, end: timeField, reason: z.string().trim().max(120) }),
  z.strictObject({ operation: z.literal('block-remove'), id }),
  z.strictObject({ operation: z.literal('request'), slotId: id, subject: short, details: z.string().trim().max(1000) }),
  z.strictObject({ operation: z.literal('respond'), id, decision: z.enum(['accept', 'decline', 'cancel', 'complete', 'no-show', 'reschedule']), slotId: id.optional(), location: z.string().trim().max(250).optional() }),
  z.strictObject({ operation: z.literal('message'), id, body: z.string().trim().min(1).max(2000) }),
  z.strictObject({ operation: z.literal('notes'), id, body: z.string().trim().max(4000) }),
  z.strictObject({ operation: z.literal('feedback'), id, rating: z.coerce.number().int().min(1).max(5), body: z.string().trim().max(2000) }),
  z.strictObject({ operation: z.literal('profile-edit'), name: short, year: z.coerce.number().int().min(1).max(8).optional() }),
  z.strictObject({ operation: z.literal('save'), email: z.string().email().max(254), saved: z.boolean() }),
  z.strictObject({ operation: z.literal('read-notices') }),
  z.strictObject({ operation: z.literal('announce'), title: short, body: z.string().trim().min(1).max(2000) }),
])

type Actor = { id: string; name: string; role: Role; accountRole: Role }
type Transaction = Prisma.TransactionClient
const accessDenied = () => new InputError('This action is unavailable for your account.', 403)
const conflict = (message: string) => new InputError(message, 409)

export function availableSlots(now = new Date()) {
  return { startAt: { gt: now }, closed: false, proposal: null, meetings: { none: { status: { in: [...occupied] } } } } satisfies Prisma.CampusSlotWhereInput
}

export const bookableFaculty = {
  OR: [{ role: 'TEACHER' }, { role: 'ADMIN', teacher: { isNot: null } }],
  emailVerified: true, suspended: false, deletedAt: null,
} satisfies Prisma.UserWhereInput

async function checkStudentAvailability(tx: Transaction, studentId: string, slot: { startAt: Date; endAt: Date }, excludedId?: string) {
  const overlapTimes = { startAt: { lt: slot.endAt }, endAt: { gt: slot.startAt } }
  const overlap = await tx.campusMeeting.findFirst({
    where: { id: excludedId ? { not: excludedId } : undefined, studentId, status: { in: [...openStatuses] },
      OR: [{ slot: overlapTimes }, { proposedSlot: overlapTimes }] },
    select: { id: true },
  })
  if (overlap) throw conflict('You already have a meeting or request at that time.')
}

function futureTime(day: string, time: string, now: Date) {
  const date = new Date(day + 'T' + time + ':00+05:30')
  if (!Number.isFinite(date.getTime()) || campusDay(date) !== day ||
      date <= now || date.getTime() > now.getTime() + 180 * 86400000) {
    throw new InputError('Choose a future date within the next 180 days.')
  }
  return date
}

export async function applyWorkspaceAction(actor: Actor, payload: unknown) {
  const input = fields.parse(payload)
  if (actor.role === 'ADMIN') throw accessDenied()
  const teacherOnly = ['slot-add', 'slot-edit', 'slot-close', 'block-add', 'block-remove', 'announce', 'notes'].includes(input.operation)
  const studentOnly = ['request', 'save', 'feedback'].includes(input.operation)
  if ((teacherOnly && actor.role !== 'TEACHER') || (studentOnly && actor.role !== 'STUDENT')) throw accessDenied()

  const now = new Date()
  if (input.operation === 'faculty-workspace-profile') {
    if (actor.accountRole !== 'ADMIN' || actor.role !== 'TEACHER') throw accessDenied()
    await db.teacherProfile.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, employeeId: 'workspace:' + actor.id, departmentId: input.departmentId, designation: input.designation },
      update: { departmentId: input.departmentId, designation: input.designation },
    })
    return
  }
  if (input.operation === 'profile-edit') {
    await db.$transaction(async tx => {
      await tx.user.update({ where: { id: actor.id }, data: { name: input.name } })
      if (actor.role === 'STUDENT' && input.year !== undefined) {
        await tx.studentProfile.updateMany({ where: { userId: actor.id }, data: { year: input.year } })
      }
    })
    return
  }
  if (input.operation === 'save') {
    if (!input.saved) {
      await db.savedFaculty.deleteMany({ where: { userId: actor.id, facultyEmail: input.email } })
      return
    }
    if (!await db.dcseFaculty.findUnique({ where: { email: input.email }, select: { email: true } })) throw new InputError('Faculty member not found.', 404)
    await db.savedFaculty.upsert({ where: { userId_facultyEmail: { userId: actor.id, facultyEmail: input.email } },
      update: {}, create: { userId: actor.id, facultyEmail: input.email } })
    return
  }
  if (input.operation === 'read-notices') {
    await db.campusNotice.updateMany({ where: { userId: actor.id, readAt: null }, data: { readAt: now } })
    return
  }
  if (input.operation === 'announce') {
    const profile = await db.teacherProfile.findUnique({ where: { userId: actor.id }, select: { departmentId: true } })
    if (!profile) throw accessDenied()
    await db.campusAnnouncement.create({ data: { authorId: actor.id, departmentId: profile.departmentId, title: input.title, body: input.body } })
    return
  }

  await db.$transaction(async tx => {
    if (!await tx.user.findFirst({
      where: { id: actor.id, role: actor.accountRole, suspended: false, deletedAt: null, emailVerified: true },
      select: { id: true },
    })) throw accessDenied()
    if (input.operation === 'slot-add' || input.operation === 'slot-edit') {
      const startAt = futureTime(input.day, input.time, now)
      const editing = input.operation === 'slot-edit' ? input.id : undefined
      if (editing && !await tx.campusSlot.findFirst({ where: { id: editing, teacherId: actor.id, ...availableSlots(now) }, select: { id: true } })) {
        throw conflict('Only a future slot without a meeting can be edited.')
      }
      const times = Array.from({ length: input.operation === 'slot-add' ? input.weeks : 1 }, (_, index) => {
        const start = startAt.getTime() + index * 7 * 86400000
        return { startAt: new Date(start), endAt: new Date(start + input.duration * 60000) }
      })
      if (times.at(-1)!.startAt.getTime() > now.getTime() + 180 * 86400000) {
        throw new InputError('Repeat only through the next 180 days.')
      }
      const ranges = times.map(time => ({ startAt: { lt: time.endAt }, endAt: { gt: time.startAt } }))
      const [overlap, block] = await Promise.all([
        tx.campusSlot.findFirst({
          where: { teacherId: actor.id, closed: false, id: editing ? { not: editing } : undefined, OR: ranges }, select: { id: true },
        }),
        tx.campusBlock.findFirst({ where: { teacherId: actor.id, OR: ranges }, select: { id: true } }),
      ])
      if (overlap) throw conflict('You already have an availability slot at that time.')
      if (block) throw conflict('That time is blocked on your calendar.')
      if (editing) {
        await tx.campusSlot.update({ where: { id: editing }, data: times[0] })
        return
      }
      for (const time of times) {
        await tx.campusSlot.upsert({
          where: { teacherId_startAt: { teacherId: actor.id, startAt: time.startAt } },
          create: { teacherId: actor.id, ...time },
          update: { endAt: time.endAt, closed: false },
        })
      }
      return
    }
    if (input.operation === 'block-add') {
      const startAt = futureTime(input.day, input.start, now)
      const endAt = futureTime(input.day, input.end, now)
      if (endAt <= startAt) throw new InputError('End time must be after start time.')
      const overlap = { teacherId: actor.id, startAt: { lt: endAt }, endAt: { gt: startAt } }
      if (await tx.campusBlock.findFirst({ where: overlap, select: { id: true } })) throw conflict('That period overlaps an existing block.')
      const reserved = await tx.campusSlot.findFirst({
        where: { ...overlap, OR: [{ proposal: { isNot: null } }, { meetings: { some: { status: { in: [...openStatuses] } } } }] },
        select: { id: true },
      })
      if (reserved) throw conflict('Cancel or move the existing appointment before blocking that period.')
      await tx.campusBlock.create({ data: { teacherId: actor.id, startAt, endAt, reason: input.reason || null } })
      await tx.campusSlot.updateMany({ where: { ...overlap, startAt: { lt: endAt, gt: now } }, data: { closed: true } })
      return
    }
    if (input.operation === 'block-remove') {
      const result = await tx.campusBlock.deleteMany({ where: { id: input.id, teacherId: actor.id } })
      if (!result.count) throw new InputError('Time block not found.', 404)
      return
    }
    if (input.operation === 'slot-close') {
      const result = await tx.campusSlot.updateMany({
        where: { id: input.id, teacherId: actor.id, ...availableSlots(now) }, data: { closed: true },
      })
      if (!result.count) throw conflict('Only a future slot without a meeting can be removed.')
      return
    }
    if (input.operation === 'request') {
      const slot = await tx.campusSlot.findFirst({ where: { id: input.slotId, ...availableSlots(now),
        teacherId: { not: actor.id }, teacher: bookableFaculty } })
      if (!slot) throw conflict('That slot is unavailable. Choose another time.')
      await checkStudentAvailability(tx, actor.id, slot)
      await tx.campusMeeting.create({ data: { studentId: actor.id, slotId: slot.id, subject: input.subject, details: input.details } })
      await tx.campusNotice.create({ data: { userId: slot.teacherId, message: actor.name + ' requested a meeting on ' + campusDate(slot.startAt) + ' at ' + campusTime(slot.startAt) + '.' } })
      return
    }

    const meeting = await tx.campusMeeting.findFirst({ where: { id: input.id,
      ...(actor.role === 'TEACHER' ? { slot: { teacherId: actor.id } } : { studentId: actor.id }),
    }, include: { slot: true, proposedSlot: true } })
    if (!meeting) throw new InputError('Meeting not found.', 404)
    const isTeacher = actor.role === 'TEACHER'
    const permissions = meetingPermissions(meeting, isTeacher, now)
    const recipientId = isTeacher ? meeting.studentId : meeting.slot.teacherId
    if (input.operation === 'message') {
      if (!await tx.user.findFirst({ where: { id: recipientId, suspended: false, deletedAt: null }, select: { id: true } })) {
        throw conflict('This participant cannot receive messages.')
      }
      await tx.campusMessage.create({ data: { meetingId: meeting.id, senderId: actor.id, body: input.body } })
      await tx.campusNotice.create({ data: { userId: recipientId, message: actor.name + ' sent a message about “' + meeting.subject + '”.' } })
      return
    }
    if (input.operation === 'notes') {
      if (!permissions.notes) throw conflict('Notes become available when a meeting is confirmed.')
      await tx.campusMeeting.update({ where: { id: meeting.id }, data: { notes: input.body || null } })
      return
    }
    if (input.operation === 'feedback') {
      if (!permissions.feedback || meeting.feedbackAt) throw conflict('Feedback can be submitted once after a completed meeting.')
      await tx.campusMeeting.update({ where: { id: meeting.id }, data: { rating: input.rating, feedback: input.body, feedbackAt: now } })
      await tx.campusNotice.create({ data: { userId: recipientId, message: actor.name + ' left feedback about “' + meeting.subject + '”.' } })
      return
    }

    const next: Prisma.CampusMeetingUncheckedUpdateInput = {}
    const clearProposal = { proposedSlotId: null, proposalBy: null, returnStatus: null, proposedLocation: null }
    let message: string
    if (input.decision === 'accept' && permissions.accept) {
      next.status = 'CONFIRMED'
      if (meeting.status === 'PROPOSED') {
        if (meeting.proposedSlot) {
          await checkStudentAvailability(tx, meeting.studentId, meeting.proposedSlot, meeting.id)
          next.slotId = meeting.proposedSlot.id
        }
        next.location = input.location || meeting.proposedLocation || meeting.location
        Object.assign(next, clearProposal)
      } else if (isTeacher) next.location = input.location || null
      message = ' confirmed the meeting “' + meeting.subject + '”.'
    } else if (input.decision === 'decline' && permissions.respond) {
      const restore = meeting.status === 'PROPOSED' && meeting.slot.startAt > now && meeting.returnStatus
      next.status = restore || 'DECLINED'
      Object.assign(next, clearProposal)
      message = meeting.status === 'PROPOSED' ? ' declined the proposed time for “' + meeting.subject + '”.' : ' declined the meeting “' + meeting.subject + '”.'
    } else if (input.decision === 'cancel' && permissions.cancel) {
      next.status = 'CANCELLED'
      Object.assign(next, clearProposal)
      message = ' cancelled the meeting “' + meeting.subject + '”.'
    } else if (input.decision === 'complete' && permissions.complete) {
      next.status = 'COMPLETED'
      message = ' marked the meeting “' + meeting.subject + '” complete.'
    } else if (input.decision === 'no-show' && permissions.noShow) {
      next.status = 'NO_SHOW'
      message = ' marked the meeting “' + meeting.subject + '” as a no-show.'
    } else if (input.decision === 'reschedule' && permissions.reschedule && input.slotId) {
      const slot = await tx.campusSlot.findFirst({ where: { id: input.slotId, teacherId: meeting.slot.teacherId,
        teacher: bookableFaculty, ...availableSlots(now) } })
      if (!slot) throw conflict('Choose an open slot from your availability.')
      await checkStudentAvailability(tx, meeting.studentId, slot, meeting.id)
      next.status = 'PROPOSED'
      next.proposedSlotId = slot.id
      next.proposalBy = actor.role
      next.returnStatus = meeting.status === 'PROPOSED' ? meeting.returnStatus : meeting.status
      next.proposedLocation = input.location || meeting.location
      message = ' proposed ' + campusDate(slot.startAt) + ' at ' + campusTime(slot.startAt) + ' for “' + meeting.subject + '”.'
    } else {
      throw conflict('This meeting cannot be changed with that action.')
    }
    await tx.campusMeeting.update({ where: { id: meeting.id }, data: next })
    await tx.campusNotice.create({ data: { userId: recipientId, message: actor.name + message } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
