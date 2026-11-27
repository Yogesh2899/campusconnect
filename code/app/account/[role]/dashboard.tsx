import Link from 'next/link'
import {
  ArrowRight, BadgeCheck, Bell, CalendarDays, CalendarPlus, Clock3, ContactRound,
  History, LayoutDashboard, Megaphone, MessageCircle, Search, ShieldCheck, Star, UserRound, UsersRound,
} from 'lucide-react'
import { DirectoryContent, type DirectoryQuery } from '@/app/directory/directory-content'
import { SessionControls } from '@/components/session-controls'
import { ThemeToggle } from '@/components/theme-provider'
import { db } from '@/lib/db'
import { registrationDepartments } from '@/lib/departments'
import { WorkspaceAction } from '@/components/workspace-action'
import { campusZone } from '@/lib/campus-time'
import { WorkspacePanels } from './workspace-panels'
import { WorkspaceSwitcher } from './workspace-switcher'
import styles from './dashboard.module.css'

type User = { id: string; name: string; email: string }

export async function CampusDashboard({ user, teacher, query, adminWorkspace = false }: {
  user: User; teacher: boolean; query: DirectoryQuery; adminWorkspace?: boolean
}) {
  const sections = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'meetings', label: teacher ? 'Meeting requests' : 'My meetings', icon: CalendarPlus },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    ...(teacher ? [{ id: 'availability', label: 'Availability', icon: Clock3 }] : []),
    { id: 'faculty', label: 'Faculty directory', icon: UsersRound },
    { id: 'coordinators', label: 'Coordinators', icon: ContactRound },
    ...(teacher ? [] : [{ id: 'saved', label: 'Saved faculty', icon: Star }]),
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'history', label: 'Meeting history', icon: History, subpage: true },
    { id: 'meeting', label: 'Meeting details', icon: CalendarPlus, subpage: true },
    { id: 'profile', label: 'My profile', icon: UserRound },
  ]
  const active = sections.find(item => item.id === query.section) ?? sections[0]
  const root = teacher ? '/account/teacher' : '/account/student'
  const workspace = teacher ? 'Faculty dashboard' : 'Student dashboard'
  const href = (section: string) => section === 'overview' ? root : root + '?section=' + section
  const names = user.name.trim().split(/\s+/).filter(Boolean)
  const initials = (names[0]?.[0] ?? user.email[0]) + (names.length > 1 ? names.at(-1)![0] : '')
  const directory = ['faculty', 'coordinators', 'saved'].includes(active.id)
  const needsProfile = ['overview', 'profile', 'announcements', 'calendar'].includes(active.id) ||
    (teacher && adminWorkspace && active.id === 'availability')
  const calendar = active.id === 'calendar'
  const [student, staff, office, assignments, unread, departments] = await Promise.all([
    needsProfile && !teacher ? db.studentProfile.findUnique({ where: { userId: user.id }, include: { department: true } }) : null,
    needsProfile && teacher ? db.teacherProfile.findUnique({ where: { userId: user.id }, include: { department: true } }) : null,
    active.id === 'profile' && teacher ? db.dcseFaculty.findUnique({ where: { email: user.email } }) : null,
    active.id === 'profile' && teacher ? db.dcseResponsibility.findMany({
      where: { emails: { has: user.email } }, orderBy: { topic: 'asc' }, select: { id: true, topic: true },
    }) : [],
    db.campusNotice.count({ where: { userId: user.id, readAt: null } }),
    adminWorkspace && teacher && active.id === 'profile' ? registrationDepartments() : [],
  ])
  const roleProfile = teacher ? staff : student
  const profile = [
    { label: 'Name', value: user.name },
    { label: 'Institutional email', value: user.email },
    ...(!adminWorkspace || !teacher ? [{ label: teacher ? 'Employee ID' : 'Student ID', value: teacher ? staff?.employeeId : student?.studentId }] : []),
    { label: teacher ? 'Designation' : 'Year of study', value: teacher ? staff?.designation : student?.year },
    { label: 'Department', value: roleProfile?.department?.name },
    ...(office ? [{ label: 'Office', value: office.office }] : []),
  ]
  const profileCompletion = Math.round(100 * profile.filter(field => field.value).length / profile.length)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: campusZone }).format(new Date()))
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const greetingName = teacher ? user.name : names[0] || user.name
  const accountSummary = teacher ? staff?.designation || 'Faculty' : student?.year ? 'Year ' + student.year : 'Student'

  return <div className={styles.shell} data-overview={active.id === 'overview' || calendar} data-calendar={calendar}>
    <a href="#dashboard-main" className={styles.skip}>Skip to dashboard content</a>
    <aside className={styles.sidebar}>
      <Link href={root} className={styles.brand}>
        <img className={styles.mark} src="/thapar-logo.png" width={52} height={52} alt=""/>
        <span>Thapar Connect<small>{workspace}</small></span>
      </Link>
      <nav aria-label="Dashboard navigation" className={styles.nav}>
        {sections.filter(item => !item.subpage).map(({ id, label, icon: Icon }) => <Link key={id} href={href(id)}
          aria-current={active.id === id || (id === 'meetings' && ['history', 'meeting'].includes(active.id)) ? 'page' : undefined}>
          <Icon size={17} aria-hidden="true"/><span>{label}</span>
          {id === 'notifications' && unread > 0 && <b className={styles.navBadge} aria-label={unread + ' unread'}>{unread > 99 ? '99+' : unread}</b>}
        </Link>)}
      </nav>
      <div className={styles.sidebarFooter}><ThemeToggle/><SessionControls compact/></div>
    </aside>

    <div className={styles.workspace}>
      <header className={styles.masthead}>
      <div className={styles.toolbar}>
        <form action={root} role="search" aria-label="Search faculty" className={styles.quickSearch}>
          <input type="hidden" name="section" value="faculty"/>
          <Search size={17} aria-hidden="true"/>
          <input name="q" type="search" maxLength={120} placeholder="Search faculty…" aria-label="Faculty name, office or email"
            defaultValue={active.id === 'faculty' && typeof query.q === 'string' ? query.q : ''} key={active.id + String(query.q ?? '')}/>
          <button type="submit" aria-label="Submit faculty search"><ArrowRight size={17} aria-hidden="true"/></button>
        </form>
        <div className={styles.tools}>
          <Link href={href('messages')} aria-label="Open messages" className={styles.bell}><MessageCircle size={19} aria-hidden="true"/></Link>
          <Link href={href('notifications')} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={styles.bell}><Bell size={19}/>
            {unread > 0 && <span className={styles.alertBadge} aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
          </Link>
          <Link href={href('profile')} aria-label="My profile" className={styles.avatar}>{initials}</Link>
        </div>
      </div>
        {(active.id === 'overview' || calendar) && <div className={styles.welcome}>
          {calendar ? <strong>{greeting}, {greetingName}!</strong> : <h1>{greeting}, {greetingName}!</h1>}
          <p>{calendar ? 'Stay organized. Never miss an important meeting.' : teacher ? 'Manage your meetings, availability and department updates.' : 'Plan your week and connect with your faculty.'}</p>
        </div>}
      </header>
      <main id="dashboard-main" className={styles.main}>
        {adminWorkspace && <WorkspaceSwitcher current={teacher ? 'teacher' : 'student'}/>}
        {active.id !== 'overview' && !calendar && <div className={styles.pageHeading}>
          {directory && <p>Computer Science &amp; Engineering</p>}
          <h1>{active.label}</h1>
          {active.id === 'faculty' && <p>Find faculty contact details, office locations and bookable times.</p>}
          {active.id === 'coordinators' && <p>Find the faculty member responsible for a department service.</p>}
          {active.id === 'profile' && <p>Your {teacher ? 'faculty' : 'student'} account and sign-in settings.</p>}
        </div>}

        {adminWorkspace && teacher && active.id === 'availability' && !staff
          ? <section className={styles.panel}><h2>Set up your faculty profile</h2>
            <p className={styles.muted}>Choose your teaching department and designation before publishing bookable times.</p>
            <Link className={styles.textLink} href={href('profile') + '#faculty-workspace-profile'}>Set up faculty profile <ArrowRight size={14}/></Link>
          </section>
        : directory ? <DirectoryContent query={query} action={root} section={['section', active.id]} contacts={active.id === 'coordinators'}
          studentId={teacher ? undefined : user.id} savedOnly={active.id === 'saved'}/>
        : active.id === 'profile' ? <div className={styles.overviewGrid}>
          <section className={styles.panel} aria-label="Profile details">
            <div className={styles.profileHeading}><div className={styles.avatar}>{initials}</div>
              <div><h2>{user.name}</h2><p className={styles.verified}><BadgeCheck size={16} aria-hidden="true"/> Verified institutional email</p></div>
            </div>
            <dl className={styles.profileFields}>
              {profile.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not provided'}</dd></div>)}
            </dl>
            <details className={styles.reschedule}><summary>Edit Profile</summary>
              <WorkspaceAction operation="profile-edit" className={styles.actionForm} success="Profile saved.">
                <label>Display name<input name="name" defaultValue={user.name} maxLength={120} required/></label>
                {student && <label>Year of study<input name="year" type="number" min={1} max={8} defaultValue={student.year} required/></label>}
                <button className={styles.primary}>Save profile</button>
              </WorkspaceAction>
            </details>
          </section>
          {adminWorkspace && teacher && <section className={styles.panel} id="faculty-workspace-profile">
            <h2>Faculty workspace profile</h2>
            <WorkspaceAction operation="faculty-workspace-profile" className={styles.actionForm}>
              <label>Designation<input name="designation" defaultValue={staff?.designation} maxLength={120} required/></label>
              <label>Department<select name="departmentId" defaultValue={staff?.departmentId ?? ''} required>
                <option value="">Select a department</option>
                {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select></label>
              <button className={styles.primary}>Save faculty profile</button>
            </WorkspaceAction>
          </section>}
          <section className={styles.panel}>
            <h2 className={styles.securityTitle}><ShieldCheck size={20} aria-hidden="true"/> Account security</h2>
            <p className={styles.muted}>Review active sessions or sign out from your devices.</p>
            <div className={styles.devices}><SessionControls/></div>
          </section>
          {teacher && <section className={styles.panel}><h2>Your coordinator assignments</h2>
            {assignments.length ? <ul className={styles.assignments}>{assignments.map(item => <li key={item.id}>
              <Link href={href('coordinators') + '&q=' + encodeURIComponent(item.topic)}>
                <ContactRound size={18} aria-hidden="true"/><span>{item.topic}</span><ArrowRight size={17} aria-hidden="true"/>
              </Link>
            </li>)}</ul> : <p className={styles.muted}>No directory assignments are linked to your institutional email.</p>}
          </section>}
        </div> : <WorkspacePanels root={root} section={active.id} query={query} teacher={teacher} userId={user.id} departmentId={roleProfile?.departmentId}
          unread={unread} profile={{ name: user.name, initials, summary: accountSummary, department: roleProfile?.department?.name, completion: profileCompletion }}/>}
      </main>
      <footer className={styles.campusFooter}><span>Thapar Institute of Engineering &amp; Technology</span><strong>Thapar Connect</strong></footer>
    </div>
  </div>
}
