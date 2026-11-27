'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function WorkspaceAction({ operation, values = {}, children, className, reset = false, endpoint = 'workspace', success = 'Saved.' }: {
  operation: string
  values?: Record<string, string | boolean>
  children: ReactNode
  className?: string
  reset?: boolean
  endpoint?: 'workspace' | 'admin' | 'invite'
  success?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const inputs = Object.fromEntries(new FormData(form, submitter))
    setPending(true)
    setStatus('')
    try {
      const headers = { 'Content-Type': 'application/json', 'x-campus-workspace': pathname.split('/').at(-1) ?? '' }
      const response = await fetch('/api/campus/' + endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({ ...inputs, ...values, ...(endpoint === 'invite' ? {} : { operation }) }),
        signal: AbortSignal.timeout(15000),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'Unable to save. Please try again.')
      if (reset) form.reset()
      setStatus(success)
      router.refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save. Please try again.')
    } finally {
      setPending(false)
    }
  }
  return <form method="post" onSubmit={submit} className={className}>
    <fieldset disabled={pending} aria-busy={pending}>{children}</fieldset>
    {status && <p role="status">{status}</p>}
  </form>
}
