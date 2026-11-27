'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import styles from './calendar.module.css'

export function CalendarDialog({ back, children }: { back: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => element?.close()
  }, [])

  const dismiss = () => router.replace(back, { scroll: false })
  return <dialog ref={dialog} className={styles.eventDialog} aria-labelledby="calendar-event-title"
    onCancel={event => { event.preventDefault(); dismiss() }}
    onClick={event => { if (event.target === event.currentTarget) dismiss() }}>
    <div className={styles.dialogContent}>
      <button className={styles.dismiss} type="button" onClick={dismiss} aria-label="Close event details"><X size={18}/></button>
      {children}
    </div>
  </dialog>
}
