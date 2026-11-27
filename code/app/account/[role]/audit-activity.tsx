import Link from 'next/link'
import { Download, Search } from 'lucide-react'
import { campusDay, campusZone, dayStart, shiftDays } from '@/lib/campus-time'
import { db } from '@/lib/db'
import styles from './dashboard.module.css'

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: campusZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
const periodFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: campusZone, day: 'numeric', month: 'long', year: 'numeric',
})
const studentCreationActions = ['STUDENT_PROVISIONED', 'STUDENT_PROVISIONED_FROM_ROSTER']

function auditDate(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const day = dayStart(value)
  return !Number.isNaN(day.getTime()) && campusDay(day) === value ? value : undefined
}

export async function AuditActivity({ date, through, term, page, pageSize }: {
  date?: string | string[]
  through?: string | string[]
  term: string
  page: number
  pageSize: number
}) {
  const selected = auditDate(date)
  const today = dayStart(campusDay(new Date()))
  const requestedEnd = auditDate(through)
  const periodEnd = requestedEnd && requestedEnd <= campusDay(today) ? requestedEnd : undefined
  const lastDay = periodEnd ? dayStart(periodEnd) : today
  const summaryStart = shiftDays(lastDay, -14)
  const summaryEnd = shiftDays(lastDay, 1)
  const selectedDay = selected ? dayStart(selected) : undefined
  const dateFilter = selectedDay ? { gte: selectedDay, lt: shiftDays(selectedDay, 1) } :
    periodEnd ? { gte: summaryStart, lt: summaryEnd } : undefined
  const matches = { contains: term, mode: 'insensitive' as const }
  const [counts, entries] = await Promise.all([
    db.$queryRaw<{ day: string; created: bigint; sign_ins: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${campusZone}, 'YYYY-MM-DD') AS day,
        count(*) FILTER (WHERE creation) AS created, count(*) FILTER (WHERE NOT creation) AS sign_ins
      FROM (
        SELECT "createdAt", true AS creation FROM "User"
        WHERE "createdAt" >= ${summaryStart} AND "createdAt" < ${summaryEnd}
        UNION ALL
        SELECT "createdAt", false AS creation FROM "AuditLog"
        WHERE action = 'SESSION_CREATED' AND "createdAt" >= ${summaryStart} AND "createdAt" < ${summaryEnd}
      ) AS activity
      GROUP BY 1
    `,
    db.auditLog.findMany({
      where: {
        createdAt: dateFilter,
        ...(term ? { OR: [{ action: matches }, { targetId: matches }, { actor: { email: matches } }, { actor: { name: matches } }] } : {}),
      },
      select: { id: true, action: true, targetId: true, createdAt: true, actor: { select: { name: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize + 1,
    }),
  ])

  const shown = entries.slice(0, pageSize)
  const targetIds = shown.flatMap(event => event.targetId && studentCreationActions.includes(event.action) ? [event.targetId] : [])
  const targets = targetIds.length ? await db.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, name: true, email: true } }) : []
  const students = new Map(targets.map(student => [student.id, student]))
  const groups = Map.groupBy(shown, entry => campusDay(entry.createdAt))
  const dailyCounts = new Map(counts.map(row => [row.day, row]))
  const totals = counts.reduce((acc, row) => ({ created: acc.created + Number(row.created), signIns: acc.signIns + Number(row.sign_ins) }), { created: 0, signIns: 0 })
  const url = (day?: string, requestedPage = 1) => '/account/admin?' + new URLSearchParams({
    section: 'audit', ...(day ? { date: day } : {}), ...(term ? { q: term } : {}),
    ...(periodEnd ? { through: periodEnd } : {}),
    ...(requestedPage > 1 ? { page: String(requestedPage) } : {}),
  }).toString()

  return <>
    <section className={styles.panel} aria-labelledby="audit-totals">
      <h2 id="audit-totals">Daily activity</h2>
      <p className={styles.muted}>{periodFormat.formatRange(summaryStart, lastDay)} in India Standard Time. Select a date to filter the timeline.</p>
      <form action="/account/admin" className={styles.auditPeriod}>
        <input type="hidden" name="section" value="audit"/>
        {term && <input type="hidden" name="q" value={term}/>}
        <label htmlFor="audit-through">15-day period ending</label>
        <input id="audit-through" type="date" name="through" defaultValue={campusDay(lastDay)} max={campusDay(today)} required/>
        <button type="submit">Show period</button>
        {periodEnd && <Link href={'/account/admin?' + new URLSearchParams({ section: 'audit', ...(term ? { q: term } : {}) })}>Latest 15 days</Link>}
      </form>
      <table className={styles.auditTable}>
        <thead><tr><th scope="col">Date</th><th scope="col">Created</th><th scope="col">Sign-ins</th><th scope="col">Total</th></tr></thead>
        <tbody>{Array.from({ length: 15 }, (_, offset) => {
          const day = campusDay(shiftDays(summaryStart, offset))
          const row = dailyCounts.get(day)
          const created = Number(row?.created ?? 0)
          const signIns = Number(row?.sign_ins ?? 0)
          return <tr key={day}>
            <th scope="row"><Link href={url(day)} aria-current={selected === day ? 'date' : undefined}>{day}</Link></th>
            <td>{created}</td><td>{signIns}</td><td>{created + signIns}</td>
          </tr>
        })}</tbody>
        <tfoot><tr><th scope="row">Total</th><td>{totals.created}</td><td>{totals.signIns}</td><td>{totals.created + totals.signIns}</td></tr></tfoot>
      </table>
    </section>
    <section className={styles.panel + ' ' + styles.auditTimeline} aria-labelledby="audit-events">
      <h2 id="audit-events">Timestamped events</h2>
      <div className={styles.panelHead}>
        <form action="/account/admin" role="search" className={styles.quickSearch}>
          <input type="hidden" name="section" value="audit"/>
          {selected && <input type="hidden" name="date" value={selected}/>}
          {periodEnd && <input type="hidden" name="through" value={periodEnd}/>}
          <input name="q" type="search" maxLength={120} defaultValue={term} aria-label="Search audit logs" placeholder="Search records…"/>
          <button type="submit" aria-label="Search"><Search size={17}/></button>
        </form>
        <div className={styles.buttonRow}>
          {selected && <Link href={url()}>Clear date</Link>}
          <a className={styles.primary} href="/api/campus/report?type=audit"><Download size={16}/> Export CSV</a>
        </div>
      </div>
      {!groups.size && <p className={styles.emptyInline}>No audit events match these filters.</p>}
      {[...groups].map(([day, events]) => <section key={day} className={styles.auditDay}>
        <h3>{day}</h3>
        <ul>{events.map(event => {
          const subject = event.targetId ? students.get(event.targetId) : undefined
          const person = subject ?? event.actor
          const action = studentCreationActions.includes(event.action) ? 'Student account added' :
            event.action === 'SESSION_CREATED' ? 'Sign-in' : event.action.replaceAll('_', ' ')
          return <li key={event.id}>
            <time dateTime={event.createdAt.toISOString()}>{day + ' ' + timeFormat.format(event.createdAt) + ' IST'}</time>
            <strong>{action}</strong>
            <span>{person ? <>{person.name}<small>{person.email}</small></> : 'System'}
              {subject && subject.email !== event.actor?.email && <small>By {event.actor?.name ?? 'System'}</small>}
            </span>
          </li>
        })}</ul>
      </section>)}
      {(page > 1 || entries.length > pageSize) && <div className={styles.buttonRow}>
        {page > 1 && <Link href={url(selected, page - 1)}>Previous page</Link>}
        {entries.length > pageSize && <Link href={url(selected, page + 1)}>Next page</Link>}
      </div>}
    </section>
  </>
}
