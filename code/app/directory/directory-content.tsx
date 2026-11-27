import Link from 'next/link'
import { CalendarPlus, FileText, Mail, MapPin, MessageCircle, Search, Star } from 'lucide-react'
import { db } from '@/lib/db'
import { DirectoryPrint } from '@/components/directory-print'
import { WorkspaceAction } from '@/components/workspace-action'
import styles from './directory.module.css'

export type DirectoryQuery = Record<string, string | string[] | undefined>
const floorLabel = (floor: number) => floor === 0 ? 'Ground floor' : 'Floor ' + floor

export async function DirectoryContent({ query, action, contacts, section, studentId, savedOnly = false }: {
  query: DirectoryQuery
  action: string
  contacts: boolean
  section?: [string, string]
  studentId?: string
  savedOnly?: boolean
}) {
  const term = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : ''
  const floor = typeof query.floor === 'string' && /^\d{1,2}$/.test(query.floor) ? Number(query.floor) : undefined
  const contains = { contains: term, mode: 'insensitive' as const }
  const [faculty, assignments, floors, saved, meetings] = await Promise.all([
    contacts ? [] : db.dcseFaculty.findMany({
      where: { floor, savedBy: savedOnly && studentId ? { some: { userId: studentId } } : undefined,
        OR: [{ name: contains }, { office: contains }, { email: contains }, { designation: contains }] },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    }),
    contacts ? db.dcseResponsibility.findMany({
      where: { OR: [{ topic: contains }, { coordinator: contains }, { emails: { has: term.toLowerCase() } }] },
      orderBy: { id: 'asc' },
    }) : [],
    contacts ? [] : db.dcseFaculty.findMany({ distinct: ['floor'], select: { floor: true }, orderBy: { floor: 'asc' } }),
    !contacts && studentId ? db.savedFaculty.findMany({ where: { userId: studentId }, select: { facultyEmail: true } }) : [],
    !contacts && studentId ? db.campusMeeting.findMany({
      where: { studentId }, select: { id: true, slot: { select: { teacher: { select: { email: true } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }) : [],
  ])
  const savedEmails = new Set(saved.map(item => item.facultyEmail))
  const conversations = new Map<string, string>()
  for (const meeting of meetings) {
    const { email } = meeting.slot.teacher
    if (!conversations.has(email)) conversations.set(email, meeting.id)
  }
  const count = contacts ? assignments.length : faculty.length
  const clear = section ? action + '?' + new URLSearchParams([section]).toString() : action

  return <div className={styles.content}>
    <div className={styles.pdfTools}>
      <a href="/directory/pdf" target="_blank" rel="noopener">
        <FileText size={16} aria-hidden="true"/> View directory PDF
      </a>
      {count > 0 && <DirectoryPrint/>}
    </div>
    <form action={action} className={styles.filters} aria-label="Filter directory">
      {section && <input type="hidden" name={section[0]} value={section[1]}/>}
      <label>{contacts ? 'Responsibility or coordinator' : 'Faculty name, designation, email or office'}
        <input key={term} type="search" name="q" defaultValue={term} maxLength={120}
          placeholder={contacts ? 'Search for timetable, projects, exams…' : 'Search for a name or room number…'}/>
      </label>
      {!contacts && <label>Office floor
        <select key={String(floor)} name="floor" defaultValue={floor ?? ''}>
          <option value="">All floors</option>
          {floors.map(item => <option key={item.floor} value={item.floor}>{floorLabel(item.floor)}</option>)}
        </select>
      </label>}
      <button type="submit"><Search size={16} aria-hidden="true"/> Search</button>
    </form>
    <div className={styles.resultBar}>
      <p>{count} {contacts ? (count === 1 ? 'assignment' : 'assignments') : (count === 1 ? 'faculty member' : 'faculty members')}{term && <> matching “{term}”</>}</p>
      {(term || (!contacts && floor !== undefined)) && <Link href={clear}>Clear filters</Link>}
    </div>
    {count === 0 && <p className={styles.empty}>{savedOnly && !term && floor === undefined
      ? 'Save faculty from the directory to find them here.' : 'No matching records. Try another search or clear your filters.'}</p>}
    <ul className={styles.results}>
      {faculty.map(member => <li key={member.email}>
        <h2>{member.name}</h2><p>{member.designation}</p>
        <strong><MapPin size={15} aria-hidden="true"/> Office {member.office} · {floorLabel(member.floor)}</strong>
        <a href={'mailto:' + member.email}><Mail size={15} aria-hidden="true"/><span>{member.email}</span></a>
        {studentId && <div className={styles.cardActions}>
          <Link className={styles.bookingAction} prefetch={false}
            href={action + '?section=meetings&faculty=' + encodeURIComponent(member.email) + '#booking'}
            aria-label={'Request Meeting with ' + member.name}>
            <CalendarPlus size={15} aria-hidden="true"/>Request Meeting
          </Link>
          {conversations.has(member.email)
            ? <Link prefetch={false} href={action + '?section=meeting&id=' + conversations.get(member.email) + '#messages'}
              aria-label={'Message ' + member.name}><MessageCircle size={15} aria-hidden="true"/> Message</Link>
            : <a href={'mailto:' + member.email} aria-label={'Email ' + member.name}><Mail size={15} aria-hidden="true"/> Email Faculty</a>}
          <WorkspaceAction operation="save" values={{ email: member.email, saved: !savedEmails.has(member.email) }}>
            <button type="submit" aria-pressed={savedEmails.has(member.email)} aria-label={(savedEmails.has(member.email) ? 'Unsave ' : 'Save ') + member.name}>
              <Star size={15} fill={savedEmails.has(member.email) ? 'currentColor' : 'none'} aria-hidden="true"/>
              {savedEmails.has(member.email) ? 'Saved' : 'Save'}
            </button>
          </WorkspaceAction>
        </div>}
      </li>)}
      {assignments.map(assignment => <li key={assignment.id}>
        <h2>{assignment.topic}</h2><p>{assignment.coordinator}</p>
        {assignment.emails.map(email => <a key={email} href={'mailto:' + email}><Mail size={15} aria-hidden="true"/><span>{email}</span></a>)}
      </li>)}
    </ul>
  </div>
}
