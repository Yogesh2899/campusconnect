import Link from 'next/link'
import { redirect } from 'next/navigation'
import { principal } from '@/lib/access'
import { DirectoryContent, type DirectoryQuery } from './directory-content'
import styles from './directory.module.css'

export const metadata = { title: 'DCSE directory · Thapar Connect' }

export default async function Directory({searchParams}:{searchParams:Promise<DirectoryQuery>}) {
  const actor = await principal()
  if (!actor) redirect('/login')
  if (!actor.authorized) redirect('/login/challenge')
  const query = await searchParams
  const contacts = query.view === 'contacts'
  return <main className={styles.page}>
    <Link href="/account">← My account</Link>
    <header><p>Computer Science &amp; Engineering</p><h1>Department directory</h1></header>
    <nav aria-label="Directory sections">
      <Link href="/directory" aria-current={!contacts?'page':undefined}>Faculty offices</Link>
      <Link href="/directory?view=contacts" aria-current={contacts?'page':undefined}>Who to contact</Link>
    </nav>
    <DirectoryContent query={query} action="/directory" contacts={contacts} section={contacts ? ['view', 'contacts'] : undefined}/>
  </main>
}
