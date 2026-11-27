import Link from 'next/link'
import { Activity, ArrowRight, Bell, BookOpen, CalendarCheck, CalendarDays, CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Clock3, Eye, Info, Mail, MapPin, Megaphone, MessageCircle, Search, Star, UserRound, UsersRound, X, Zap } from 'lucide-react'
import type { MeetingStatus, Prisma } from '@prisma/client'
import { WorkspaceAction } from '@/components/workspace-action'
import type { DirectoryQuery } from '@/app/directory/directory-content'
import { availableSlots, bookableFaculty, openStatuses } from '@/lib/campus-workspace'
import { meetingPermissions } from '@/lib/meeting-permissions'
import { campusDate, campusDay, campusTime, campusZone, dayStart, monday, shiftDays } from '@/lib/campus-time'
import { db } from '@/lib/db'
import { CalendarDialog } from './calendar-dialog'
import styles from './dashboard.module.css'
import calendarStyles from './calendar.module.css'

const meetingInclude = {
  student: { select: { name: true } },
  slot: { include: { teacher: { select: { name: true, email: true } } } },
  proposedSlot: true,
} satisfies Prisma.CampusMeetingInclude
type Meeting = Prisma.CampusMeetingGetPayload<{ include: typeof meetingInclude }>
type Slot = { id: string; startAt: Date; endAt: Date }
const labels: Record<MeetingStatus, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', PROPOSED: 'Reschedule proposed',
  DECLINED: 'Rejected', CANCELLED: 'Cancelled', COMPLETED: 'Completed', NO_SHOW: 'No-show',
}
const statusLabel = (meeting: Meeting) => meeting.status === 'PROPOSED'
  ? meeting.proposalBy === 'STUDENT' ? 'Reschedule requested' : 'New time proposed'
  : labels[meeting.status]
const monthName = new Intl.DateTimeFormat('en-IN', { timeZone: campusZone, month: 'long', year: 'numeric' })
const weekday = new Intl.DateTimeFormat('en-IN', { timeZone: campusZone, weekday: 'short' })
const shortMonth = new Intl.DateTimeFormat('en-IN', { timeZone: campusZone, month: 'short' })
const clockInput = new Intl.DateTimeFormat('en-GB', { timeZone: campusZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const meetingTime = (slot: Slot) => campusDate(slot.startAt) + ' · ' + campusTime(slot.startAt) + ' – ' + campusTime(slot.endAt)
const participant = (meeting: Meeting, teacher: boolean) => teacher ? meeting.student.name : meeting.slot.teacher.name
const roomLink = (location: string) => {
  const url = URL.canParse(location) ? new URL(location) : null
  return url && ['https:', 'http:'].includes(url.protocol) ? url.href : null
}

function calendarRange(query: DirectoryQuery, now: Date, defaultView: 'week' | 'month') {
  const requested = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? dayStart(query.date) : null
  const focus = requested && Number.isFinite(requested.getTime()) && campusDay(requested) === query.date
    && query.date >= '1900-01-01' && query.date <= '9998-12-31' ? requested : now
  const view = query.view === 'month' || query.view === 'day' || query.view === 'week' ? query.view : defaultView
  const month = view === 'month'
  const [year, number] = campusDay(focus).split('-').map(Number)
  const first = (offset: number) => new Date(Date.UTC(year, number - 1 + offset, 1, 6))
  const start = month ? monday(first(0)) : view === 'day' ? dayStart(campusDay(focus)) : monday(focus)
  const end = month ? shiftDays(monday(shiftDays(first(1), -1)), 7) : shiftDays(start, view === 'day' ? 1 : 7)
  const length = (end.getTime() - start.getTime()) / 86400000
  const previous = month ? first(-1) : shiftDays(start, -length)
  const next = month ? first(1) : shiftDays(start, length)
  return { start, end, focus, previous, next, view, length }
}

function WeeklyCalendar({ root, now, meetings }: {
  root: string; now: Date; meetings: Meeting[]
}) {
  const { start, length } = calendarRange({}, now, 'week')
  const days = Array.from({ length }, (_, index) => shiftDays(start, index))
  const today = campusDay(now)
  const href = (date: Date, mode: string) => root + '?section=calendar&date=' + campusDay(date) + '&view=' + mode
  return <section className={styles.panel} aria-label="Meeting calendar">
    <div className={styles.panelHead}><h2><CalendarDays size={18} aria-hidden="true"/> Weekly calendar</h2>
      <Link className={styles.textLink} href={href(now, 'week')}>View all <ArrowRight size={15}/></Link>
    </div>
    <div className={styles.miniCalendarToolbar}>
      <strong>{monthName.format(now)}</strong>
      <div className={styles.calendarControls}>{['month', 'week', 'day'].map(mode => <Link key={mode} href={href(now, mode)}>{mode[0].toUpperCase() + mode.slice(1)}</Link>)}</div>
    </div>
    <div className={styles.miniDays}>
      {days.map(date => {
        const key = campusDay(date)
        return <Link key={key} href={href(date, 'day')} data-today={key === today} aria-label={campusDate(date)}>
          <span>{weekday.format(date)}</span><strong>{Number(key.slice(-2))}</strong>
        </Link>
      })}
    </div>
    {meetings.length ? <div className={styles.agenda}>{meetings.slice(0, 3).map(item => <Link className={styles.agendaEvent} key={item.id}
      data-status={item.status} href={href(item.slot.startAt, 'day')}><CalendarCheck size={15}/><span>{item.subject}</span><small>{campusTime(item.slot.startAt)}</small></Link>)}</div>
      : <p className={styles.emptyInline}>No meetings scheduled for this week.</p>}
  </section>
}

type CalendarEntry = { meeting: Meeting; slot: Slot; proposed: boolean }
const calendarStatus = { CONFIRMED: 'Confirmed', PENDING: 'Pending', PROPOSED: 'Reschedule', COMPLETED: 'Completed' }
const calendarMonth = new Intl.DateTimeFormat('en-IN', { timeZone: campusZone, month: 'short', year: 'numeric' })
const upcomingSlot = (meeting: Meeting, now: Date) =>
  meeting.status === 'PROPOSED' && meeting.proposedSlot && meeting.proposedSlot.startAt > now ? meeting.proposedSlot : meeting.slot

function Calendar({ root, query, now, range, meetings, upcoming, announcements, teacher }: {
  root: string; query: DirectoryQuery; now: Date; range: ReturnType<typeof calendarRange>; meetings: Meeting[]
  upcoming: Meeting[]; announcements: { id: string; title: string; createdAt: Date }[]; teacher: boolean
}) {
  const { start, end, focus, previous, next, view, length } = range
  const today = campusDay(now)
  const focusDay = campusDay(focus)
  const days = Array.from({ length }, (_, index) => shiftDays(start, index))
  const href = (date: Date, mode: string) => root + '?section=calendar&date=' + campusDay(date) + '&view=' + mode
  const current = href(focus, view)
  const events = new Map<string, CalendarEntry[]>()
  for (const meeting of meetings) {
    const entries: CalendarEntry[] = [{ meeting, slot: meeting.slot, proposed: false }]
    if (meeting.status === 'PROPOSED' && meeting.proposedSlot) {
      entries.push({ meeting, slot: meeting.proposedSlot, proposed: true })
    }
    for (const entry of entries) {
      if (entry.slot.startAt < start || entry.slot.startAt >= end) continue
      const key = campusDay(entry.slot.startAt)
      const dayEntries = events.get(key) ?? []
      dayEntries.push(entry)
      events.set(key, dayEntries)
    }
  }
  const selected = [...events.values()].flat().find(entry => entry.meeting.id === query.event && entry.proposed === (query.proposed === '1'))
  const bookHref = root + (teacher ? '?section=availability' : '?section=meetings#booking')
  const bookLabel = teacher ? 'Set Availability' : 'Book Meeting'
  const BookIcon = teacher ? Clock3 : CalendarPlus
  const detailHref = (id: string) => root + '?section=meeting&id=' + encodeURIComponent(id)
  const nextMeetings = upcoming.map(item => ({ item, slot: upcomingSlot(item, now) }))
    .sort((a, b) => a.slot.startAt.getTime() - b.slot.startAt.getTime()).slice(0, 3)
  return <section className={calendarStyles.calendar} aria-labelledby="calendar-title">
    <div className={calendarStyles.toolbar}>
      <div className={calendarStyles.title}><span><CalendarDays size={24}/></span>
        <div><h1 id="calendar-title">My Calendar</h1><p>{teacher ? 'Manage appointments and availability' : 'Manage your meetings and schedule'}</p></div>
      </div>
      <nav className={calendarStyles.modes} aria-label="Calendar view">
        {(['Month', 'Week', 'Day'] as const).map(mode => <Link href={href(focus, mode.toLowerCase())} key={mode}
          aria-current={view === mode.toLowerCase() ? 'page' : undefined}>{mode}</Link>)}
      </nav>
      <div className={calendarStyles.navigation}>
        <Link href={href(previous, view)} aria-label={'Previous ' + view}><ChevronLeft size={18}/></Link>
        <details key={current} className={calendarStyles.datePicker}>
          <summary aria-label="Jump to date">{view === 'day' ? campusDate(focus) : calendarMonth.format(focus)} <ChevronDown size={14}/></summary>
          <form action={root}>
            <input type="hidden" name="section" value="calendar"/><input type="hidden" name="view" value={view}/>
            <label>Jump to date<input type="date" name="date" defaultValue={focusDay} min="1900-01-01" max="9998-12-31" required/></label>
            <button type="submit">Go to date</button>
          </form>
        </details>
        <Link href={href(next, view)} aria-label={'Next ' + view}><ChevronRight size={18}/></Link>
      </div>
      <Link className={calendarStyles.book} href={bookHref}><BookIcon size={18}/>{bookLabel}</Link>
    </div>
    <div className={calendarStyles.layout}>
      <div className={calendarStyles.board}>
        <div className={calendarStyles.scroll} tabIndex={0} role="region" aria-label={view === 'day' ? 'Daily schedule' : 'Calendar grid'}>
          <div className={calendarStyles.grid} data-view={view}>
            {days.slice(0, view === 'day' ? 1 : 7).map(day => <div className={calendarStyles.weekday} key={campusDay(day)}>
              {view === 'day' ? campusDate(day) : weekday.format(day)}
            </div>)}
            {days.map(day => {
              const key = campusDay(day)
              const items = events.get(key) ?? []
              return <div className={calendarStyles.day} key={key} data-today={key === today}
                data-outside={view === 'month' && key.slice(0, 7) !== focusDay.slice(0, 7)}>
                {view !== 'day' && <Link href={href(day, 'day')} aria-label={'View ' + campusDate(day)}
                  className={calendarStyles.dayNumber} aria-current={key === today ? 'date' : undefined}>{Number(key.slice(-2))}</Link>}
                {items.sort((a, b) => a.slot.startAt.getTime() - b.slot.startAt.getTime()).map(({ meeting, slot, proposed }) =>
                  <Link className={calendarStyles.event} data-status={meeting.status} key={meeting.id + (proposed ? '-proposed' : '')}
                    href={current + '&event=' + encodeURIComponent(meeting.id) + (proposed ? '&proposed=1' : '')}
                    scroll={false} prefetch={false}>
                    <strong>{proposed ? 'Proposed: ' : ''}{meeting.subject}</strong>
                    <time dateTime={slot.startAt.toISOString()}>{campusTime(slot.startAt)}{view === 'day' && ' – ' + campusTime(slot.endAt)}</time>
                  </Link>)}
                {view === 'day' && items.length === 0 && <p className={calendarStyles.empty}>No meetings scheduled for this day.</p>}
              </div>
            })}
          </div>
        </div>
        <div className={calendarStyles.legend}>
          <ul aria-label="Meeting status legend">{Object.entries(calendarStatus).map(([status, name]) => <li key={status} data-status={status}>{name}</li>)}</ul>
          <div><span><Info size={14}/> All times IST</span><Link href={href(now, view)}>Today</Link></div>
        </div>
      </div>
      <aside className={calendarStyles.rail} aria-label="Calendar sidebar">
        <section><div className={calendarStyles.railHeading}><h2><Zap size={16}/> Upcoming Meetings</h2>
          <Link href={root + '?section=meetings'}>View all <ArrowRight size={13}/></Link></div>
          {nextMeetings.length ? <ul className={calendarStyles.upcoming}>{nextMeetings.map(({ item, slot }) => {
            const proposed = slot.id === item.proposedSlotId
            const destination = slot.startAt >= start && slot.startAt < end ? current : href(slot.startAt, 'day')
            return <li key={item.id}><Link href={destination + '&event=' + encodeURIComponent(item.id) + (proposed ? '&proposed=1' : '')} scroll={false}>
              <span className={calendarStyles.stamp}><small>{weekday.format(slot.startAt)}</small><strong>{Number(campusDay(slot.startAt).slice(-2))}</strong><small>{shortMonth.format(slot.startAt)}</small></span>
              <span><strong>{participant(item, teacher)}</strong><small>{campusTime(slot.startAt)} – {campusTime(slot.endAt)}</small><small>{item.subject}</small></span>
              <ChevronRight size={15}/>
            </Link></li>
          })}</ul> : <p className={calendarStyles.empty}>No upcoming meetings.</p>}
        </section>
        <section><div className={calendarStyles.railHeading}><h2><CalendarCheck size={16}/> Quick Actions</h2></div>
          <div className={calendarStyles.shortcuts}>
            <Link href={bookHref}><BookIcon size={18}/>{bookLabel}</Link>
            <Link href={root + '?section=faculty'}><Search size={18}/> Find Faculty</Link>
            {teacher ? <Link href={root + '?section=coordinators'}><UsersRound size={18}/> Coordinators</Link>
              : <Link href={root + '?section=saved'}><Star size={18}/> Saved Faculty</Link>}
            <a href="/directory/pdf" target="_blank" rel="noopener"><BookOpen size={18}/> Directory PDF</a>
          </div>
        </section>
        <section><div className={calendarStyles.railHeading}><h2><Megaphone size={16}/> Department Announcements</h2>
          <Link href={root + '?section=announcements'}>View all <ArrowRight size={13}/></Link></div>
          {announcements.length ? <ul className={calendarStyles.announcements}>{announcements.map(post => <li key={post.id}>
            <Link href={root + '?section=announcements'}><span aria-hidden="true"/><strong>{post.title}<small>{campusDate(post.createdAt)}</small></strong></Link>
          </li>)}</ul> : <p className={calendarStyles.empty}>No department announcements to display.</p>}
        </section>
      </aside>
    </div>
    {selected && <CalendarDialog back={current} key={selected.meeting.id + String(selected.proposed)}>
      <CalendarEventDetails entry={selected} teacher={teacher} now={now} detail={detailHref(selected.meeting.id)}/>
    </CalendarDialog>}
  </section>
}

function CalendarEventDetails({ entry, teacher, now, detail }: { entry: CalendarEntry; teacher: boolean; now: Date; detail: string }) {
  const { meeting, slot, proposed } = entry
  const name = participant(meeting, teacher)
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')
  const location = proposed ? meeting.proposedLocation : meeting.location
  const canCancel = meetingPermissions(meeting, teacher, now).cancel && !(teacher && meeting.status === 'PENDING')
  return <>
    <div className={calendarStyles.eventHeading}>
      <span aria-hidden="true">{initials}</span>
      <div><h2 id="calendar-event-title">{name}</h2><p>{meeting.subject}</p></div>
    </div>
    <span className={calendarStyles.eventBadge} data-status={meeting.status}>{proposed ? 'Proposed time' : statusLabel(meeting)}</span>
    <ul className={calendarStyles.eventFacts}>
      <li><CalendarDays size={16}/> {campusDate(slot.startAt)} {campusDay(slot.startAt).slice(0, 4)}</li>
      <li><Clock3 size={16}/> {campusTime(slot.startAt)} – {campusTime(slot.endAt)} IST</li>
      {location && <li><MapPin size={16}/> {location}</li>}
    </ul>
    {meeting.details && <p className={calendarStyles.description}>{meeting.details}</p>}
    <div className={calendarStyles.eventActions}>
      <Link href={detail}><Eye size={16}/> View Details</Link>
      <Link href={detail + '#messages'}><MessageCircle size={16}/> Message</Link>
      {canCancel && <details className={calendarStyles.cancel}>
        <summary><X size={16}/> {meeting.status === 'PENDING' ? 'Cancel Request' : 'Cancel Meeting'}</summary>
        <WorkspaceAction operation="respond" values={{ id: meeting.id, decision: 'cancel' }} success="Cancelled.">
          <button type="submit">Confirm cancellation</button>
        </WorkspaceAction>
      </details>}
    </div>
  </>
}

function MeetingList({ meetings, root, teacher, now, slots = [], compact = false }: {
  meetings: Meeting[]; root: string; teacher: boolean; now: Date; slots?: Slot[]; compact?: boolean
}) {
  if (!meetings.length) return <p className={styles.emptyInline}>{teacher ? 'No meeting requests or appointments here yet.' : 'Your meetings and requests will appear here.'}</p>
  return <ul className={styles.meetingList}>{meetings.map(meeting => {
    const detail = root + '?section=meeting&id=' + meeting.id
    return <li key={meeting.id} id={'meeting-' + meeting.id} className={styles.meetingRow}>
      <div className={styles.meetingHead}>{compact
        ? <span className={styles.dateStamp}><small>{weekday.format(meeting.slot.startAt)}</small><strong>{Number(campusDay(meeting.slot.startAt).slice(-2))}</strong><small>{shortMonth.format(meeting.slot.startAt)}</small></span>
        : <span className={styles.violet}><CalendarCheck size={17} aria-hidden="true"/></span>}
        <div><h3>{participant(meeting, teacher)}</h3><p>{meeting.subject}</p><small>{meetingTime(meeting.slot)}</small></div>
        <span className={styles.status} data-status={meeting.status}>{statusLabel(meeting)}</span>
      </div>
      {!compact && <>
        <MeetingActions meeting={meeting} teacher={teacher} now={now} slots={slots} detail={detail}/>
        <div className={styles.buttonRow}>
          <Link href={detail + '#messages'}><MessageCircle size={16}/>{!teacher && meeting.status === 'NO_SHOW' ? 'Contact Faculty' : 'Send Message'}</Link>
          {teacher && <Link href={detail + '#student'}>View Student</Link>}
          {teacher && meetingPermissions(meeting, teacher, now).notes && <Link href={detail + '#notes'}>Add Meeting Notes</Link>}
          {!teacher && meeting.status === 'COMPLETED' && !meeting.feedbackAt && <Link href={detail + '#feedback'}>Submit Feedback</Link>}
          {!teacher && ['DECLINED', 'CANCELLED'].includes(meeting.status) && <Link
            href={root + '?section=meetings&faculty=' + encodeURIComponent(meeting.slot.teacher.email) + '#booking'}>Request Again</Link>}
        </div>
      </>}
      <Link href={detail} className={styles.textLink}>View Details <ArrowRight size={14}/></Link>
    </li>
  })}</ul>
}

function MeetingActions({ meeting, teacher, now, slots, detail }: {
  meeting: Meeting; teacher: boolean; now: Date; slots: Slot[]; detail?: string
}) {
  const permissions = meetingPermissions(meeting, teacher, now)
  const proposal = meeting.status === 'PROPOSED'
  const rescheduleLabel = meeting.status === 'PENDING' ? 'Suggest New Time' : proposal ? 'Suggest Another Time' : 'Reschedule'
  const canCancel = permissions.cancel && (!permissions.respond || proposal)
  return <>
    {proposal && <p className={styles.meetingDetails}>Proposed time: {meetingTime(meeting.proposedSlot ?? meeting.slot)} IST</p>}
    {(permissions.respond || permissions.complete) && <WorkspaceAction operation="respond" values={{ id: meeting.id }} className={styles.actionForm}>
      {teacher && permissions.respond && <label>Room or meeting link<input name="location" maxLength={250} placeholder="Optional"/></label>}
      <div className={styles.buttonRow}>
        {permissions.respond && <>
          {permissions.accept && <button name="decision" value="accept" className={styles.primary}>{proposal ? teacher ? 'Approve' : 'Accept New Time' : 'Accept'}</button>}
          <button name="decision" value="decline">{proposal ? 'Decline' : 'Reject'}</button>
        </>}
        {permissions.complete && <button name="decision" value="complete" className={styles.primary}>Mark Completed</button>}
        {permissions.noShow && <button name="decision" value="no-show">Mark No-Show</button>}
      </div>
    </WorkspaceAction>}
    {canCancel && <details className={styles.reschedule}>
      <summary>{meeting.status === 'PENDING' ? 'Cancel Request' : 'Cancel Meeting'}</summary>
      <WorkspaceAction operation="respond" values={{ id: meeting.id, decision: 'cancel' }} className={styles.actionForm} success="Cancelled.">
        <button className={styles.danger}>Confirm cancellation</button>
      </WorkspaceAction>
    </details>}
    {permissions.reschedule && (detail && !teacher ? <Link href={detail + '#reschedule'} className={styles.textLink}>{rescheduleLabel}</Link> :
      <details className={styles.reschedule} id={detail ? undefined : 'reschedule'} open={!detail || undefined}>
        <summary>{rescheduleLabel}</summary>
        {slots.length ? <WorkspaceAction operation="respond" values={{ id: meeting.id, decision: 'reschedule' }} className={styles.actionForm}>
          <label>Available slot<select name="slotId" required><option value="">Select an open slot</option>{slots.map(slot => <option key={slot.id} value={slot.id}>{meetingTime(slot)}</option>)}</select></label>
          {teacher && <label>Room or meeting link<input name="location" maxLength={250} defaultValue={meeting.location ?? ''} placeholder="Optional"/></label>}
          <button className={styles.primary}>{teacher ? 'Propose time' : 'Request another time'}</button>
        </WorkspaceAction> : <p className={styles.muted}>No alternate times are published.</p>}
      </details>)}
  </>
}

async function MeetingDetail({ root, userId, teacher, query, now }: {
  root: string; userId: string; teacher: boolean; query: DirectoryQuery; now: Date
}) {
  const id = typeof query.id === 'string' && query.id.length <= 80 ? query.id : ''
  const meeting = await db.campusMeeting.findFirst({
    where: { id, ...(teacher ? { slot: { teacherId: userId } } : { studentId: userId }) },
    include: {
      ...meetingInclude,
      student: { select: { name: true, email: true, student: { select: { year: true, department: { select: { name: true } } } } } },
      slot: { include: { teacher: { select: { name: true, email: true } } } },
      messages: { select: { id: true, body: true, createdAt: true, sender: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 },
    },
  })
  if (!meeting) return <p className={styles.emptyInline}>Meeting not found.</p>
  const permissions = meetingPermissions(meeting, teacher, now)
  const joinUrl = meeting.status === 'CONFIRMED' && meeting.location ? roomLink(meeting.location) : null
  const slots = permissions.reschedule ? await db.campusSlot.findMany({
    where: { teacherId: meeting.slot.teacherId, ...availableSlots(now) }, orderBy: { startAt: 'asc' }, take: 100,
  }) : []
  return <>
    <Link className={styles.textLink} href={root + '?section=meetings'}>Back to meetings <ArrowRight size={14}/></Link>
    <Link className={styles.textLink} href={root + '?section=messages'}>Messages inbox <ArrowRight size={14}/></Link>
    <div className={styles.overviewGrid}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><h2>{meeting.subject}</h2><span className={styles.status} data-status={meeting.status}>{statusLabel(meeting)}</span></div>
        <p className={styles.meetingDetails}>{participant(meeting, teacher)} · {meetingTime(meeting.slot)} IST</p>
        {meeting.details && <p className={styles.meetingDetails}>{meeting.details}</p>}
        {meeting.location && <p className={styles.meetingDetails}>Location or meeting link: {meeting.location}</p>}
        {joinUrl && <a className={styles.textLink} href={joinUrl} target="_blank" rel="noopener noreferrer">Join meeting <ArrowRight size={14}/></a>}
        {teacher && <details className={styles.reschedule} id="student"><summary>View Student</summary>
          <dl className={styles.profileFields}><div><dt>Name</dt><dd>{meeting.student.name}</dd></div>
            <div><dt>Institutional email</dt><dd>{meeting.student.email}</dd></div>
            {meeting.student.student && <div><dt>Year of study</dt><dd>{meeting.student.student.year}</dd></div>}
            {meeting.student.student?.department && <div><dt>Department</dt><dd>{meeting.student.student.department.name}</dd></div>}
          </dl>
        </details>}
        <MeetingActions meeting={meeting} teacher={teacher} now={now} slots={slots}/>
        {!teacher && ['DECLINED', 'CANCELLED'].includes(meeting.status) && <Link className={styles.textLink}
          href={root + '?section=meetings&faculty=' + encodeURIComponent(meeting.slot.teacher.email) + '#booking'}>Request Again <ArrowRight size={14}/></Link>}
        {!teacher && meeting.status === 'NO_SHOW' && <a className={styles.textLink} href="#messages">Contact Faculty <ArrowRight size={14}/></a>}
        {permissions.notes && <details className={styles.reschedule} id="notes"><summary>Add Meeting Notes</summary>
          <WorkspaceAction operation="notes" values={{ id: meeting.id }} className={styles.actionForm} success="Private notes saved.">
            <label>Private faculty notes<textarea name="body" defaultValue={meeting.notes ?? ''} maxLength={4000} rows={4}/></label>
            <button>Save notes</button>
          </WorkspaceAction>
        </details>}
        {permissions.feedback && !meeting.feedbackAt && <details className={styles.reschedule} id="feedback"><summary>Submit Feedback</summary>
          <WorkspaceAction operation="feedback" values={{ id: meeting.id }} className={styles.actionForm} success="Feedback submitted.">
            <label>Rating<select name="rating" required defaultValue=""><option value="">Choose a rating</option>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} out of 5</option>)}</select></label>
            <label>Feedback for faculty<textarea name="body" rows={4} maxLength={2000}/></label>
            <button className={styles.primary}>Submit Feedback</button>
          </WorkspaceAction>
        </details>}
        {meeting.feedbackAt && <div className={styles.meetingDetails}><strong>Student feedback · {meeting.rating} out of 5</strong>{meeting.feedback && <p>{meeting.feedback}</p>}</div>}
      </section>
      <section id="messages" className={styles.panel}>
        <div className={styles.panelHead}><h2><MessageCircle size={18}/> Messages</h2></div>
        {meeting.messages.length ? <ul className={styles.meetingList}>{meeting.messages.slice().reverse().map(message => <li key={message.id} className={styles.meetingRow}>
          <h3>{message.sender.name}</h3><p className={styles.meetingDetails}>{message.body}</p>
          <small className={styles.muted}>{campusDate(message.createdAt)} · {campusTime(message.createdAt)}</small>
        </li>)}</ul> : <p className={styles.emptyInline}>Start a conversation about this meeting.</p>}
        <WorkspaceAction operation="message" values={{ id: meeting.id }} className={styles.actionForm} reset success="Message sent.">
          <label>Message<textarea name="body" rows={3} maxLength={2000} placeholder="Write a message about this meeting…" required/></label>
          <button className={styles.primary}><MessageCircle size={16}/> Send Message</button>
        </WorkspaceAction>
      </section>
    </div>
  </>
}

async function MessagesInbox({ root, where, teacher }: { root: string; where: Prisma.CampusMeetingWhereInput; teacher: boolean }) {
  const recent = await db.campusMessage.groupBy({
    by: ['meetingId'], where: { meeting: where }, _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } }, take: 50,
  })
  const [threads, unused] = await Promise.all([
    db.campusMeeting.findMany({
      where: { ...where, id: { in: recent.map(item => item.meetingId) } },
      include: { ...meetingInclude, messages: { orderBy: { createdAt: 'desc' }, take: 1,
        select: { body: true, createdAt: true, sender: { select: { name: true } } } } },
    }),
    db.campusMeeting.findMany({
      where: { ...where, messages: { none: {} }, status: { in: [...openStatuses] } },
      include: meetingInclude, orderBy: { createdAt: 'desc' }, take: 10,
    }),
  ])
  const byId = new Map(threads.map(thread => [thread.id, thread]))
  return <div className={styles.overviewGrid}>
    <section className={styles.panel} aria-label="Recent messages">
      <div className={styles.panelHead}><h2><MessageCircle size={19}/> Recent conversations</h2></div>
      {threads.length ? <ul className={styles.messageThreads}>{recent.map(({ meetingId }) => {
        const thread = byId.get(meetingId)
        const latest = thread?.messages[0]
        if (!thread || !latest) return null
        return <li key={thread.id}><Link href={root + '?section=meeting&id=' + thread.id + '#messages'}>
          <span><strong>{participant(thread, teacher)}</strong><span>{thread.subject}</span>
            <small>{latest.sender.name}: {latest.body}</small></span>
          <span><time dateTime={latest.createdAt.toISOString()}>{campusDate(latest.createdAt)}</time><ChevronRight size={17} aria-hidden="true"/></span>
        </Link></li>
      })}</ul> : <p className={styles.emptyInline}>Your meeting conversations will appear here.</p>}
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHead}><h2>Start a conversation</h2></div>
      {unused.length ? <ul className={styles.messageThreads}>{unused.map(item => <li key={item.id}>
        <Link href={root + '?section=meeting&id=' + item.id + '#messages'}>
          <span><strong>{participant(item, teacher)}</strong><span>{item.subject}</span></span><MessageCircle size={18} aria-hidden="true"/>
        </Link>
      </li>)}</ul> : <p className={styles.emptyInline}>Open a meeting to send a message to the other participant.</p>}
      <Link className={styles.textLink} href={root + '?section=meetings'}>View meetings <ArrowRight size={15}/></Link>
    </section>
  </div>
}

export async function WorkspacePanels({ root, section, query, teacher, userId, departmentId, unread, profile }: {
  root: string; section: string; query: DirectoryQuery; teacher: boolean; userId: string; departmentId?: string | null
  unread: number
  profile: { name: string; initials: string; summary: string; department?: string; completion: number }
}) {
  const now = new Date()
  const where = teacher ? { slot: { teacherId: userId } } : { studentId: userId }
  if (section === 'meeting') return <MeetingDetail root={root} query={query} now={now} teacher={teacher} userId={userId}/>
  if (section === 'messages') return <MessagesInbox root={root} where={where} teacher={teacher}/>
  const meetingSection = section === 'meetings' || section === 'history'
  const future = { OR: [{ slot: { startAt: { gt: now } } }, { proposedSlot: { startAt: { gt: now } } }] }
  const upcomingWhere = { ...where, status: { in: [...openStatuses] }, ...future }
  const calendarPage = section === 'calendar'
  const range = calendarRange(calendarPage ? query : {}, now, calendarPage ? 'month' : 'week')
  const dates = { gte: range.start, lt: range.end }
  const [meetings, upcoming, calendar, openSlots, notices, announcements, savedCount, interactionCount, blocks] = await Promise.all([
    meetingSection ? db.campusMeeting.findMany({ where: section === 'history' ? {
      ...where, OR: [{ status: { notIn: [...openStatuses] } }, { NOT: future }],
    } : upcomingWhere, include: meetingInclude, orderBy: { slot: { startAt: section === 'history' ? 'desc' : 'asc' } }, take: 100 }) : [],
    (section === 'overview' || calendarPage) ? db.campusMeeting.findMany({ where: upcomingWhere, include: meetingInclude, orderBy: { slot: { startAt: 'asc' } } }) : [],
    (section === 'overview' || calendarPage) ? db.campusMeeting.findMany({
      where: { ...where, status: { in: [...openStatuses, 'COMPLETED'] }, OR: [
        { slot: { startAt: dates } },
        ...(calendarPage ? [{ status: 'PROPOSED' as const, proposedSlot: { startAt: dates } }] : []),
      ] },
      include: meetingInclude, orderBy: { slot: { startAt: 'asc' } },
    }) : [],
    teacher && (section === 'availability' || section === 'overview' || meetingSection) ? db.campusSlot.findMany({
      where: { teacherId: userId, ...availableSlots(now) }, orderBy: { startAt: 'asc' },
    }) : [],
    section === 'notifications' || section === 'overview' ? db.campusNotice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: section === 'overview' ? 3 : 100 }) : [],
    departmentId && (section === 'announcements' || section === 'overview' || calendarPage) ? db.campusAnnouncement.findMany({
      where: { departmentId, archivedAt: null }, include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: section === 'announcements' ? 50 : calendarPage ? 2 : 3,
    }) : [],
    !teacher && section === 'overview' ? db.savedFaculty.count({ where: { userId } }) : 0,
    teacher && section === 'overview' ? db.campusMeeting.findMany({ where, distinct: ['studentId'], select: { studentId: true } }) : [],
    teacher && section === 'availability' ? db.campusBlock.findMany({ where: { teacherId: userId, endAt: { gt: now } }, orderBy: { startAt: 'asc' } }) : [],
  ])

  if (section === 'overview') {
    const pending = upcoming.filter(item => item.status === 'PENDING' || item.status === 'PROPOSED')
    const confirmed = upcoming.filter(item => item.status === 'CONFIRMED')
    const today = campusDay(now)
    const todayCount = calendar.filter(item => item.status === 'CONFIRMED' && campusDay(item.slot.startAt) === today).length
    const cards = teacher ? [
      { label: 'Today’s meetings', value: todayCount, to: 'calendar&view=day', icon: CalendarCheck, color: styles.blue },
      { label: 'This week', value: calendar.filter(item => item.status === 'CONFIRMED').length, to: 'calendar', icon: CalendarDays, color: styles.violet },
      { label: 'Pending requests', value: pending.length, to: 'meetings', icon: Bell, color: styles.peach },
      { label: 'Students connected', value: interactionCount.length, to: 'history', icon: UsersRound, color: styles.green },
    ] : [
      { label: 'Profile completion', value: profile.completion + '%', to: 'profile', icon: UserRound, color: styles.blue },
      { label: 'Upcoming meetings', value: confirmed.length, to: 'meetings', icon: CalendarCheck, color: styles.violet },
      { label: 'Pending requests', value: pending.length, to: 'meetings', icon: Bell, color: styles.peach },
      { label: 'Today’s schedule', value: todayCount, to: 'calendar&view=day', icon: CalendarDays, color: styles.green },
    ]
    return <>
      <div className={styles.metrics}>{cards.map(({ label, value, to, icon: Icon, color }) => <Link className={styles.metric} key={label} href={root + '?section=' + to}>
        <span className={color}><Icon size={20} aria-hidden="true"/></span><div><span>{label}</span><strong>{value}</strong>
          {to === 'profile' && <progress aria-label="Profile completion" max={100} value={profile.completion}/>}
        </div><ChevronRight className={styles.metricArrow} size={16} aria-hidden="true"/>
      </Link>)}</div>
      <div className={styles.dashboardBoard}>
        <div className={styles.boardMain}>
          <div className={styles.boardTop}>
            <section className={styles.panel}>
              <div className={styles.panelHead}><h2><CalendarCheck size={18}/> {teacher ? 'Upcoming appointments' : 'Upcoming meetings'}</h2>
                <Link className={styles.textLink} href={root + '?section=meetings'}>View all <ArrowRight size={15}/></Link></div>
              <MeetingList meetings={confirmed.slice(0, 3)} root={root} teacher={teacher} now={now} compact/>
            </section>
            <WeeklyCalendar root={root} now={now} meetings={calendar}/>
          </div>
          <div className={styles.boardBottom}>
            <section className={styles.panel}><div className={styles.panelHead}><h2><Zap size={18}/> Quick actions</h2></div>
              <div className={styles.quickActions}>
                <Link href={root + '?section=faculty'}><UsersRound size={20}/>Faculty directory</Link>
                <Link href={root + '?section=' + (teacher ? 'availability' : 'meetings')}><CalendarDays size={20}/>{teacher ? 'Availability' : 'Book a meeting'}</Link>
                <Link href={root + '?section=coordinators'}><Mail size={20}/>Coordinators</Link>
                {teacher ? <Link href={root + '?section=announcements'}><Megaphone size={20}/>Announcements</Link>
                  : <Link href={root + '?section=saved'}><Star size={20}/>Saved faculty <small>{savedCount}</small></Link>}
              </div>
            </section>
            <section className={styles.panel}><div className={styles.panelHead}><h2><Mail size={18}/> Meeting requests</h2>
              <Link className={styles.textLink} href={root + '?section=meetings'}>View all <ArrowRight size={15}/></Link></div>
              <MeetingList meetings={pending.slice(0, 2)} root={root} teacher={teacher} now={now} slots={openSlots} compact={!teacher}/>
            </section>
            <section className={styles.panel}><div className={styles.panelHead}><h2><Activity size={18}/> Your activity</h2>
              <Link className={styles.textLink} href={root + '?section=notifications'}>View all <ArrowRight size={15}/></Link></div>
              {notices.length ? <ul className={styles.simpleList}>{notices.map(item => <li key={item.id}><Bell size={15}/><span>{item.message}<small className={styles.muted}>{campusDate(item.createdAt)} · {campusTime(item.createdAt)}</small></span></li>)}</ul>
                : <p className={styles.emptyInline}>Meeting updates will appear here.</p>}
            </section>
          </div>
        </div>
        <aside className={styles.boardSide} aria-label="Campus and profile">
          <div className={styles.campusCard}><strong><span>TIET</span> × Thapar Connect</strong><p>Connect with faculty and students at Thapar.</p></div>
          <section className={styles.panel}><div className={styles.panelHead}><h2><Megaphone size={18}/> Recent announcements</h2>
            <Link className={styles.textLink} href={root + '?section=announcements'}>View all <ArrowRight size={15}/></Link></div>
            {announcements.length ? <ul className={styles.simpleList}>{announcements.map(post => <li key={post.id}><strong>{post.title}</strong><small className={styles.muted}>{campusDate(post.createdAt)}</small></li>)}</ul>
              : <p className={styles.emptyInline}>{departmentId ? 'No announcements have been posted yet.' : 'Department announcements appear once your profile has a department.'}</p>}
          </section>
          <section className={styles.panel}><div className={styles.panelHead}><h2><UserRound size={18}/> Your profile</h2></div>
            <div className={styles.overviewProfile}><span className={styles.avatar}>{profile.initials}</span><div><strong>{profile.name}</strong><p className={styles.muted}>{profile.summary}{profile.department ? ' · ' + profile.department : ''}</p></div></div>
            <div className={styles.profileProgress}><progress aria-label="Profile completion" max={100} value={profile.completion}/><small>{profile.completion}% complete</small></div>
            <Link className={styles.textLink} href={root + '?section=profile'}>View profile <ArrowRight size={15}/></Link>
          </section>
          {teacher && <section className={styles.panel}><div className={styles.panelHead}><h2><Clock3 size={18}/> Your availability</h2>
            <Link className={styles.textLink} href={root + '?section=availability'}>Manage <ArrowRight size={15}/></Link></div>
            {openSlots.length ? <ul className={styles.simpleList}>{openSlots.slice(0, 3).map(slot => <li key={slot.id}><Clock3 size={15}/>{meetingTime(slot)}</li>)}</ul>
              : <p className={styles.emptyInline}>Publish times so students can request a meeting.</p>}
          </section>}
        </aside>
      </div>
    </>
  }

  if (calendarPage) return <Calendar root={root} query={query} now={now} range={range} meetings={calendar}
    upcoming={upcoming} announcements={announcements} teacher={teacher}/>
  if (section === 'availability') return <div className={styles.overviewGrid}>
    <section className={styles.panel}><h2>Add an available time</h2><p className={styles.muted}>Students can request the times you publish. All times are IST.</p>
      <WorkspaceAction operation="slot-add" className={styles.actionForm} reset>
        <label>Date<input name="day" type="date" min={campusDay(now)} required/></label>
        <label>Start time<input name="time" type="time" required/></label>
        <label>Duration<select name="duration" defaultValue="30">{[15, 30, 45, 60].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
        <label>Repeat weekly<select name="weeks" defaultValue="1">
          <option value="1">Just once</option>{[2, 4, 8, 12].map(weeks => <option key={weeks} value={weeks}>{weeks} weeks</option>)}
        </select></label>
        <button className={styles.primary}>Set Availability</button>
      </WorkspaceAction>
    </section>
    <section className={styles.panel}><h2>Open slots</h2>
      {openSlots.length ? <ul className={styles.meetingList}>{openSlots.map(slot => <li key={slot.id} className={styles.meetingRow}><p>{meetingTime(slot)}</p>
        <details className={styles.reschedule}><summary>Edit Office Hours</summary>
          <WorkspaceAction operation="slot-edit" values={{ id: slot.id }} className={styles.actionForm}>
            <label>Date<input name="day" type="date" defaultValue={campusDay(slot.startAt)} min={campusDay(now)} required/></label>
            <label>Start time<input name="time" type="time" defaultValue={clockInput.format(slot.startAt)} required/></label>
            <label>Duration<select name="duration" defaultValue={String((slot.endAt.getTime()-slot.startAt.getTime())/60000)}>
              {[15,30,45,60].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select></label>
            <button className={styles.primary}>Save office hours</button>
          </WorkspaceAction>
        </details>
        <WorkspaceAction operation="slot-close" values={{ id: slot.id }} className={styles.actionForm}><button>Remove</button></WorkspaceAction>
      </li>)}</ul> : <p className={styles.emptyInline}>No open slots. Add a date and time to get started.</p>}
    </section>
    <section className={styles.panel}><h2>Block Time</h2><p className={styles.muted}>Blocking time closes overlapping open slots. Existing requests and appointments must be resolved first.</p>
      <WorkspaceAction operation="block-add" className={styles.actionForm} reset>
        <label>Date<input name="day" type="date" min={campusDay(now)} required/></label>
        <label>Start time<input name="start" type="time" required/></label>
        <label>End time<input name="end" type="time" required/></label>
        <label>Reason<input name="reason" maxLength={120} placeholder="Optional"/></label>
        <button className={styles.primary}>Block Time</button>
      </WorkspaceAction>
    </section>
    <section className={styles.panel}><h2>Blocked hours</h2>
      {blocks.length ? <ul className={styles.meetingList}>{blocks.map(block => <li key={block.id} className={styles.meetingRow}>
        <strong>{meetingTime(block)}</strong>{block.reason && <p>{block.reason}</p>}
        <WorkspaceAction operation="block-remove" values={{ id: block.id }} className={styles.actionForm}><button>Remove block</button></WorkspaceAction>
      </li>)}</ul> : <p className={styles.emptyInline}>No upcoming blocks.</p>}
    </section>
  </div>

  if (meetingSection) return <div className={styles.overviewGrid}>
    <section className={styles.panel}><h2>{section === 'history' ? 'Past and closed meetings' : teacher ? 'Requests and appointments' : 'Requests and upcoming meetings'}</h2>
      {teacher && section === 'meetings' && <Link className={styles.textLink} href={root + '?section=availability'}>Manage available times <ArrowRight size={15}/></Link>}
      {section === 'meetings' && <Link className={styles.textLink} href={root + '?section=history'}>Meeting history <ArrowRight size={15}/></Link>}
      <MeetingList meetings={meetings} root={root} teacher={teacher} slots={openSlots} now={now}/>
    </section>
    {!teacher && section === 'meetings' && <Booking root={root} query={query} now={now} userId={userId}/>}
  </div>

  if (section === 'notifications') return <section className={styles.panel}>
    <div className={styles.panelHead}><h2>{unread} unread</h2>
      {unread > 0 && <WorkspaceAction operation="read-notices" className={styles.actionForm}><button>Mark all as read</button></WorkspaceAction>}
    </div>
    {notices.length ? <ul className={styles.simpleList}>{notices.map(item => <li key={item.id}>
      <Bell size={17} aria-hidden="true"/><div><strong>{item.message}</strong><p className={styles.muted}>{campusDate(item.createdAt)} · {campusTime(item.createdAt)}{item.readAt ? '' : ' · New'}</p></div>
    </li>)}</ul> : <p className={styles.emptyInline}>Meeting updates will appear here.</p>}
  </section>

  return <div className={styles.overviewGrid}>
    <section className={styles.panel}><h2>Department notices</h2>
      {announcements.length ? <ul className={styles.meetingList}>{announcements.map(post => <li key={post.id} className={styles.meetingRow}>
        <h3>{post.title}</h3><p className={styles.meetingDetails}>{post.body}</p><p className={styles.muted}>{post.author.name} · {campusDate(post.createdAt)}</p>
      </li>)}</ul> : <p className={styles.emptyInline}>{departmentId ? 'No announcements have been posted yet.' : 'Your profile has no department assigned.'}</p>}
    </section>
    {teacher && departmentId && <section className={styles.panel}><h2>Publish an announcement</h2><p className={styles.muted}>Visible to members of your department.</p>
      <WorkspaceAction operation="announce" className={styles.actionForm} reset>
        <label>Title<input name="title" maxLength={120} required/></label>
        <label>Announcement<textarea name="body" rows={4} maxLength={2000} required/></label>
        <button className={styles.primary}>Publish Announcement</button>
      </WorkspaceAction>
    </section>}
  </div>
}

async function Booking({ root, query, now, userId }: { root: string; query: DirectoryQuery; now: Date; userId: string }) {
  const faculty = typeof query.faculty === 'string' ? query.faculty.slice(0, 254) : ''
  const teachers = await db.user.findMany({
    where: { ...bookableFaculty, id: { not: userId }, slots: { some: availableSlots(now) } },
    select: { id: true, name: true, email: true }, orderBy: { name: 'asc' },
  })
  const chosen = teachers.find(item => item.email === faculty)
  const slots = chosen ? await db.campusSlot.findMany({
    where: { teacherId: chosen.id, ...availableSlots(now) }, orderBy: { startAt: 'asc' },
  }) : []
  const selected = chosen ?? (faculty ? await db.dcseFaculty.findUnique({
    where: { email: faculty }, select: { name: true, email: true },
  }) : null)
  return <section id="booking" className={styles.panel}>
    <h2>Request Meeting</h2>
    <p className={styles.muted}>{selected ? 'Faculty member: ' + selected.name : 'Choose a faculty member to request a meeting.'}</p>
    {teachers.length ? <form action={root} className={styles.bookingPicker}>
      <input type="hidden" name="section" value="meetings"/>
      <label>Faculty member<select name="faculty" key={faculty} defaultValue={chosen?.email ?? ''} required>
        <option value="">Select a faculty member</option>{teachers.map(item => <option key={item.id} value={item.email}>{item.name} · {item.email}</option>)}
      </select></label><button>Show times</button>
    </form> : !selected && <p className={styles.emptyInline}>No faculty have published bookable times yet. Open the faculty directory to contact a faculty member.</p>}
    {chosen && slots.length > 0 ? <WorkspaceAction operation="request" className={styles.actionForm} reset key={chosen.id}>
      <label>Available time (IST)<select name="slotId" required><option value="">Select a time</option>{slots.map(slot => <option key={slot.id} value={slot.id}>{meetingTime(slot)}</option>)}</select></label>
      <label>Meeting purpose<input name="subject" required maxLength={120} placeholder="E.g. Project guidance"/></label>
      <label>Questions or details<textarea name="details" rows={3} maxLength={1000}/></label>
      <button className={styles.primary}>Request Meeting</button>
    </WorkspaceAction> : selected && <p className={styles.emptyInline}>
      No bookable times are available for {selected.name}. You can email them to ask for a time.
    </p>}
    <div className={styles.buttonRow}>
      {selected && slots.length === 0 && <a className={styles.primary}
        href={'mailto:' + selected.email + '?subject=' + encodeURIComponent('Meeting request via Thapar Connect')}>
        <Mail size={15} aria-hidden="true"/> Email Faculty
      </a>}
      <Link href={root + '?section=faculty'}>Faculty Directory</Link>
    </div>
  </section>
}
