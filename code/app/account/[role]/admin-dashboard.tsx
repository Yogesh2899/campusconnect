import Link from 'next/link'
import { BookOpen, CalendarDays, ClipboardList, Download, GraduationCap, Megaphone, Search, ShieldCheck, UsersRound } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import type { DirectoryQuery } from '@/app/directory/directory-content'
import { SessionControls } from '@/components/session-controls'
import { ThemeToggle } from '@/components/theme-provider'
import { WorkspaceAction } from '@/components/workspace-action'
import { campusDate, campusTime } from '@/lib/campus-time'
import { db } from '@/lib/db'
import { WorkspaceSwitcher } from './workspace-switcher'
import { AuditActivity } from './audit-activity'
import styles from './dashboard.module.css'

const root = '/account/admin'
const sections = [
  { id: 'users', label: 'User Management', icon: UsersRound },
  { id: 'students', label: 'Student Overview', icon: GraduationCap },
  { id: 'teachers', label: 'Teacher Overview', icon: CalendarDays },
  { id: 'faculty', label: 'Faculty Management', icon: GraduationCap },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
] as const

type Department = { id: string; name: string }

function DepartmentField({ departments, selected = '', optional = false }: {
  departments: Department[]; selected?: string; optional?: boolean
}) {
  return <label>Department<select name="departmentId" defaultValue={selected} required={!optional}>
    <option value="">{optional ? 'No department assigned' : 'Select a department'}</option>
    {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
  </select></label>
}

function StudentFields({ studentId, year }: { studentId?: string; year?: number }) {
  return <>
    <label>Student ID<input name="studentId" defaultValue={studentId} maxLength={32} pattern="[A-Za-z0-9\-]{3,32}" required/></label>
    <label>Year of study<input name="year" type="number" min={1} max={8} defaultValue={year} required/></label>
  </>
}

function FacultyFields({ employeeId, designation }: { employeeId?: string; designation?: string }) {
  return <>
    <label>Employee ID<input name="employeeId" defaultValue={employeeId} maxLength={120} required/></label>
    <label>Designation<input name="designation" defaultValue={designation} maxLength={120} required/></label>
  </>
}

function AnnouncementFields({ title, body }: { title?: string; body?: string }) {
  return <>
    <label>Title<input name="title" maxLength={120} defaultValue={title} required/></label>
    <label>Announcement<textarea name="body" maxLength={2000} rows={4} defaultValue={body} required/></label>
  </>
}

export async function AdminDashboard({ name, query }: { name: string; query: DirectoryQuery }) {
  const active = sections.find(section => section.id === query.section) ?? sections[0]
  const term = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : ''
  const requestedPage = typeof query.page === 'string' && /^\d{1,4}$/.test(query.page) ? Math.max(1, Number(query.page)) : 1
  const matches = { contains: term, mode: 'insensitive' as const }
  const size = 25
  const skip = (requestedPage - 1) * size
  const role = active.id === 'students' ? 'STUDENT' : active.id === 'teachers' ? 'TEACHER' : undefined
  const listUsers = active.id === 'users' || Boolean(role)
  const url = (section: string, page = 1) => root + '?' + new URLSearchParams({
    section, ...(term && section === active.id ? { q: term } : {}), ...(page > 1 ? { page: String(page) } : {}),
  }).toString()
  const studentOverview = active.id === 'students'
  const upcomingMeetingFilter = {
    student: studentOverview ? { role: 'STUDENT', deletedAt: null } : undefined,
    slot: { teacher: role === 'TEACHER' ? { role, deletedAt: null } : undefined, startAt: { gte: new Date() } },
    status: { in: ['PENDING', 'CONFIRMED', 'PROPOSED'] },
  } satisfies Prisma.CampusMeetingWhereInput
  const [departments, users, faculty, posts, registered, verified, meetings, upcomingCount, enrollment] = await Promise.all([
    active.id === 'audit' ? [] : db.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    listUsers ? db.user.findMany({
      where: { role, deletedAt: null, OR: [{ name: matches }, { email: matches }] },
      select: {
        id: true, name: true, email: true, role: true, suspended: true, emailVerified: true, adminVerifiedAt: true,
        student: { select: { departmentId: true, studentId: true, year: true } },
        teacher: { select: { departmentId: true, employeeId: true, designation: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }], skip, take: size + 1,
    }) : [],
    active.id === 'faculty' ? db.dcseFaculty.findMany({
      where: { OR: [{ name: matches }, { email: matches }] }, orderBy: [{ name: 'asc' }, { email: 'asc' }], skip, take: size + 1,
    }) : [],
    active.id === 'announcements' ? db.campusAnnouncement.findMany({
      where: { OR: [{ title: matches }, { department: { name: matches } }] },
      include: { department: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take: size + 1,
    }) : [],
    role ? db.user.count({ where: { role, deletedAt: null } }) : 0,
    role === 'TEACHER' ? db.user.count({ where: { role, deletedAt: null, emailVerified: true, suspended: false } }) : 0,
    role ? db.campusMeeting.findMany({
      where: upcomingMeetingFilter,
      select: { id: true, subject: true, status: true, student: { select: { name: true } },
        slot: { select: { startAt: true, teacher: { select: { name: true } } } } },
      orderBy: { slot: { startAt: 'asc' } }, take: 8,
    }) : [],
    studentOverview ? db.campusMeeting.count({ where: upcomingMeetingFilter }) : 0,
    studentOverview ? db.studentProfile.groupBy({
      by: ['year', 'departmentId'], where: { user: { role: 'STUDENT', deletedAt: null } }, _count: { _all: true },
    }) : [],
  ])
  const found = users.length + faculty.length + posts.length
  const departmentNames = new Map(departments.map(department => [department.id, department.name]))
  const byYear = new Map<number, number>()
  const byDepartment = new Map<string, number>()
  let studentsWithProfiles = 0
  let studentsWithDepartment = 0
  for (const { year, departmentId, _count } of enrollment) {
    const count = _count._all
    byYear.set(year, (byYear.get(year) ?? 0) + count)
    studentsWithProfiles += count
    if (departmentId) {
      byDepartment.set(departmentId, (byDepartment.get(departmentId) ?? 0) + count)
      studentsWithDepartment += count
    }
  }

  return <div className={styles.shell}>
    <a href="#dashboard-main" className={styles.skip}>Skip to dashboard content</a>
    <aside className={styles.sidebar}><Link href={root} className={styles.brand}><img className={styles.mark} src="/thapar-logo.png" width={52} height={52} alt=""/><span>Thapar Connect<small>Administration</small></span></Link>
      <nav aria-label="Admin navigation" className={styles.nav}>
        {sections.map(({ id, label, icon: Icon }) => <Link key={id} href={url(id)} aria-current={id === active.id ? 'page' : undefined}><Icon size={17}/><span>{label}</span></Link>)}
        <Link href="/directory"><BookOpen size={17}/><span>Directory</span></Link>
      </nav>
      <div className={styles.sidebarFooter}><ThemeToggle/><SessionControls compact/></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.toolbar}><div className={styles.securityTitle}><ShieldCheck size={20}/> Administrator · {name}</div></header>
      <main id="dashboard-main" className={styles.main}>
        <WorkspaceSwitcher current="admin"/>
        <div className={styles.pageHeading}><h1>{active.label}</h1>{role && <p>Administrator overview of {role === 'STUDENT' ? 'student' : 'faculty'} accounts and upcoming meetings.</p>}</div>
        {role && <div className={styles.metrics}>
          <div className={styles.metric}><span className={styles.blue}><UsersRound size={20}/></span><div><span>Registered accounts</span><strong>{registered}</strong></div></div>
          {studentOverview ? <>
            <div className={styles.metric}><span className={styles.green}><GraduationCap size={20}/></span><div><span>Departments represented</span><strong>{byDepartment.size}</strong></div></div>
            <div className={styles.metric}><span className={styles.violet}><CalendarDays size={20}/></span><div><span>Upcoming meetings</span><strong>{upcomingCount}</strong></div></div>
          </> : <div className={styles.metric}><span className={styles.green}><ShieldCheck size={20}/></span><div><span>Verified and active</span><strong>{verified}</strong></div></div>}
        </div>}
        {active.id === 'audit' ? <AuditActivity date={query.date} through={query.through} term={term} page={requestedPage} pageSize={size}/> : <>
        <div className={styles.panelHead}>
          <form action={root} role="search" className={styles.quickSearch}><input type="hidden" name="section" value={active.id}/>
            <input name="q" type="search" maxLength={120} defaultValue={term} aria-label={'Search ' + active.label.toLowerCase()} placeholder="Search records…"/>
            <button type="submit" aria-label="Search"><Search size={17}/></button>
          </form>
          {active.id === 'users' && <div className={styles.buttonRow}>
            <a className={styles.primary} href={'/api/campus/report?type=' + active.id}><Download size={16}/> Export CSV</a>
          </div>}
        </div>
        <div className={styles.adminGrid}>
          <section className={styles.panel} aria-label={active.label + ' results'}>
            {found === 0 && <p className={styles.emptyInline}>No records match this search.</p>}
            {users.slice(0, size).map(user => <details key={user.id} className={styles.adminEntry}>
              <summary><strong>{user.name}</strong><span>{user.email} · {user.role === 'TEACHER' ? 'Faculty' : user.role === 'ADMIN' ? 'Administrator' : 'Student'}</span>
                {studentOverview && user.student && <small>Year {user.student.year} · {departmentNames.get(user.student.departmentId ?? '') ?? 'No department assigned'}</small>}
                {user.suspended ? <small>Suspended</small> : !studentOverview && (user.adminVerifiedAt || user.emailVerified) &&
                  <small>{user.adminVerifiedAt ? 'Admin verified' : 'Email verified'}</small>}
              </summary>
              {user.role !== 'ADMIN' && <>
              <details className={styles.reschedule}><summary>Edit User</summary>
                <WorkspaceAction endpoint="admin" operation="edit-user" values={{ id: user.id }} className={styles.actionForm}>
                  <label>Display name<input name="name" defaultValue={user.name} maxLength={120} required/></label>
                  <DepartmentField departments={departments} selected={user.teacher?.departmentId && user.role === 'TEACHER' ? user.teacher.departmentId : user.student?.departmentId ?? ''} optional={user.role === 'STUDENT'}/>
                  <button className={styles.primary}>Save user</button>
                </WorkspaceAction>
              </details>
              <div className={styles.buttonRow}>
                {user.emailVerified && !user.adminVerifiedAt && <WorkspaceAction endpoint="admin" operation="verify-user" values={{ id: user.id }} className={styles.actionForm}><button>Verify Account</button></WorkspaceAction>}
                <WorkspaceAction endpoint="admin" operation={user.suspended ? 'activate-user' : 'suspend-user'} values={{ id: user.id }} className={styles.actionForm}>
                  <button>{user.suspended ? 'Activate Account' : 'Suspend Account'}</button>
                </WorkspaceAction>
              </div>
              {user.emailVerified && <details className={styles.reschedule}><summary>Change Role</summary>
                <WorkspaceAction endpoint="admin" operation={user.role === 'STUDENT' ? 'role-teacher' : 'role-student'} values={{ id: user.id }} className={styles.actionForm}>
                  <p className={styles.muted}>New role: {user.role === 'STUDENT' ? 'Faculty' : 'Student'}. Active sessions will end.</p>
                  {user.role === 'STUDENT' ? <FacultyFields employeeId={user.teacher?.employeeId} designation={user.teacher?.designation}/>
                    : <StudentFields studentId={user.student?.studentId} year={user.student?.year}/>}
                  <DepartmentField departments={departments} selected={(user.role === 'STUDENT' ? user.teacher?.departmentId : user.student?.departmentId) ?? ''} optional={user.role === 'TEACHER'}/>
                  <button className={styles.primary}>Change Role</button>
                </WorkspaceAction>
              </details>}
              {!user.suspended && user.emailVerified && <details className={styles.reschedule}><summary>Reset Password</summary>
                <p className={styles.muted}>Send a secure recovery link to {user.email}.</p>
                <WorkspaceAction endpoint="admin" operation="reset-user" values={{ id: user.id }} className={styles.actionForm} success="Recovery requested.">
                  <button>Send password reset link</button>
                </WorkspaceAction>
              </details>}
              <details className={styles.reschedule}><summary>Delete Account</summary>
                {user.suspended ? <WorkspaceAction endpoint="admin" operation="delete-user" values={{ id: user.id }} className={styles.actionForm}>
                  <p className={styles.muted}>This removes account access and cancels open bookings. Existing records are retained for audit.</p>
                  <label>Confirm by typing {user.email}<input name="confirmation" type="email" autoComplete="off" required/></label>
                  <button className={styles.danger}>Delete Account</button>
                </WorkspaceAction> : <p className={styles.muted}>Suspend the account before removal.</p>}
              </details>
              </>}
            </details>)}
            {faculty.slice(0, size).map(member => <div key={member.email} className={styles.meetingRow}>
              <strong>{member.name}</strong><p className={styles.muted}>{member.designation} · Office {member.office}</p>
              <a className={styles.textLink} href={'mailto:' + member.email}>{member.email}</a>
            </div>)}
            {posts.slice(0, size).map(post => <details key={post.id} className={styles.adminEntry}>
              <summary><strong>{post.title}</strong><span>{post.department.name} · {campusDate(post.createdAt)}</span><small>{post.archivedAt ? 'Archived' : 'Published'}</small></summary>
              <p className={styles.meetingDetails}>{post.body}</p>
              {!post.archivedAt && <>
                <WorkspaceAction endpoint="admin" operation="announce-edit" values={{ id: post.id }} className={styles.actionForm}>
                  <AnnouncementFields title={post.title} body={post.body}/><button className={styles.primary}>Edit Announcement</button>
                </WorkspaceAction>
                <WorkspaceAction endpoint="admin" operation="announce-archive" values={{ id: post.id }} className={styles.actionForm}>
                  <button>Archive Announcement</button>
                </WorkspaceAction>
              </>}
            </details>)}
            {(requestedPage > 1 || found > size) && <div className={styles.buttonRow}>
              {requestedPage > 1 && <Link href={url(active.id, requestedPage - 1)}>Previous page</Link>}
              {found > size && <Link href={url(active.id, requestedPage + 1)}>Next page</Link>}
            </div>}
          </section>
          <aside className={styles.boardSide} aria-label={role ? 'Overview details' : 'Create records'}>
            {studentOverview && <>
              <section className={styles.panel}><h2>Students by year</h2>
                {registered ? <ul className={styles.simpleList}>
                  {[...byYear].sort(([a], [b]) => a - b).map(([year, count]) =>
                    <li key={year}><span>Year {year}</span><strong>{count}</strong></li>)}
                  {registered > studentsWithProfiles && <li><span>Year unspecified</span><strong>{registered - studentsWithProfiles}</strong></li>}
                </ul> : <p className={styles.emptyInline}>No student accounts yet.</p>}
              </section>
              <section className={styles.panel}><h2>Students by department</h2>
                {registered ? <ul className={styles.simpleList}>
                  {departments.filter(department => byDepartment.has(department.id)).map(department =>
                    <li key={department.id}><span>{department.name}</span><strong>{byDepartment.get(department.id)}</strong></li>)}
                  {registered > studentsWithDepartment && <li><span>No department assigned</span><strong>{registered - studentsWithDepartment}</strong></li>}
                </ul> : <p className={styles.emptyInline}>No student accounts yet.</p>}
              </section>
            </>}
            {role && <section className={styles.panel}><h2>Upcoming meetings</h2>
              {meetings.length ? <ul className={styles.simpleList}>{meetings.map(item => <li key={item.id}>
                <CalendarDays size={16}/><span><strong>{item.subject}</strong><small>{item.student.name} · {item.slot.teacher.name}</small>
                  <small>{campusDate(item.slot.startAt)} · {campusTime(item.slot.startAt)} IST · {item.status.toLowerCase()}</small></span>
              </li>)}</ul> : <p className={styles.emptyInline}>No upcoming meetings.</p>}
            </section>}
            {active.id === 'users' && <section className={styles.panel}><h2>Add Student</h2>
              <p className={styles.muted}>The student completes registration with their institutional email code and student ID.</p>
              <WorkspaceAction endpoint="admin" operation="add-student" className={styles.actionForm} reset success="Student added. They can now complete registration.">
                <label>Full name<input name="name" maxLength={120} required/></label>
                <label>Institutional email<input name="email" type="email" required/></label>
                <StudentFields/><DepartmentField departments={departments} optional/>
                <button className={styles.primary}>Add Student</button>
              </WorkspaceAction>
            </section>}
            {active.id === 'faculty' && <>
              <section className={styles.panel}><h2>Add Faculty</h2><p className={styles.muted}>Add a faculty directory record with office and contact details.</p>
                <WorkspaceAction endpoint="admin" operation="add-faculty" className={styles.actionForm} reset success="Faculty directory record added.">
                  <label>Full name<input name="name" maxLength={120} required/></label>
                  <label>Institutional email<input name="email" type="email" required/></label>
                  <label>Designation<input name="designation" maxLength={120} required/></label>
                  <label>Office<input name="office" maxLength={120} required/></label>
                  <label>Floor<input name="floor" type="number" min={0} max={99} required/></label>
                  <button className={styles.primary}>Add Faculty</button>
                </WorkspaceAction>
              </section>
              <section className={styles.panel}><h2>Invite Faculty</h2><p className={styles.muted}>Send a link to activate a faculty sign-in.</p>
                <WorkspaceAction endpoint="invite" operation="invite" className={styles.actionForm} reset success="Faculty invitation sent.">
                  <label>Full name<input name="name" maxLength={120} required/></label>
                  <label>Institutional email<input name="email" type="email" required/></label>
                  <FacultyFields/><DepartmentField departments={departments}/>
                  <button className={styles.primary}>Invite Faculty</button>
                </WorkspaceAction>
              </section>
            </>}
            {active.id === 'announcements' && <section className={styles.panel}><h2>Publish Announcement</h2>
              <WorkspaceAction endpoint="admin" operation="announce-create" className={styles.actionForm} reset success="Announcement published.">
                <DepartmentField departments={departments}/><AnnouncementFields/>
                <button className={styles.primary}>Publish Announcement</button>
              </WorkspaceAction>
            </section>}
          </aside>
        </div>
        </>}
      </main>
    </div>
  </div>
}
