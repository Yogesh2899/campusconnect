import type { MeetingStatus, Role } from '@prisma/client'

export const openStatuses = ['PENDING', 'CONFIRMED', 'PROPOSED'] as const

export function meetingPermissions(meeting: {
  status: MeetingStatus
  proposalBy: Role | null
  proposedSlot?: { startAt: Date } | null
  slot: { startAt: Date; endAt: Date }
}, teacher: boolean, now: Date) {
  const future = meeting.slot.startAt > now
  const proposalFuture = (meeting.proposedSlot?.startAt ?? meeting.slot.startAt) > now
  const respondingToProposal = meeting.status === 'PROPOSED' && (proposalFuture || future) &&
    (teacher ? meeting.proposalBy === 'STUDENT' : meeting.proposalBy !== 'STUDENT')
  const pendingResponse = teacher && meeting.status === 'PENDING' && future
  const pastConfirmed = teacher && meeting.status === 'CONFIRMED' && meeting.slot.endAt <= now
  return {
    respond: pendingResponse || respondingToProposal,
    accept: pendingResponse || (respondingToProposal && proposalFuture),
    cancel: (future || (meeting.status === 'PROPOSED' && proposalFuture)) && openStatuses.some(status => status === meeting.status),
    reschedule: (future && (meeting.status === 'CONFIRMED' || (teacher && meeting.status === 'PENDING'))) ||
      (meeting.status === 'PROPOSED' && (future || proposalFuture) && (teacher || meeting.proposalBy === 'STUDENT')),
    complete: pastConfirmed,
    noShow: pastConfirmed,
    feedback: !teacher && meeting.status === 'COMPLETED',
    notes: teacher && ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(meeting.status),
  }
}
