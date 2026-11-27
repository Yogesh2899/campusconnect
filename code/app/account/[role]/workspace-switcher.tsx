import Link from 'next/link'
import { GraduationCap, Presentation, ShieldCheck } from 'lucide-react'
import styles from './dashboard.module.css'

const workspaces = [
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
  { id: 'teacher', label: 'Teacher', icon: Presentation },
  { id: 'student', label: 'Student', icon: GraduationCap },
] as const

export function WorkspaceSwitcher({ current }: { current: typeof workspaces[number]['id'] }) {
  return <nav className={styles.workspaceSwitcher} aria-label="Switch workspace">
    {workspaces.map(({ id, label, icon: Icon }) => <Link key={id} href={'/account/' + id}
      aria-current={id === current ? 'page' : undefined}><Icon size={16} aria-hidden="true"/>{label}</Link>)}
  </nav>
}
