'use client'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
export function SessionControls({ compact = false }: { compact?: boolean }) {
  const [error,setError] = useState('')
  const [sessions,setSessions] = useState<{id:string,token:string,userAgent?:string,expiresAt:string}[] | null>(null)
  async function listDevices() {
    try {
      const res = await fetch('/api/auth/list-sessions',{cache:'no-store'})
      if (!res.ok) throw Error()
      setSessions(await res.json())
      setError('')
    } catch { setError('Could not load your active sessions.') }
  }
  async function revoke(token:string) {
    try {
      const res = await fetch('/api/auth/revoke-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})})
      if (!res.ok) throw Error()
      const current = await fetch('/api/auth/get-session',{cache:'no-store'})
      if (!(await current.json())?.session) { location.assign('/login'); return }
      await listDevices()
    } catch { setError('Could not revoke this session.') }
  }
  async function logout(all:boolean) {
    try {
      for (const action of all?['revoke-sessions','sign-out']:['sign-out']) {
        const res = await fetch('/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
        if (!res.ok) throw Error('Could not finish signing out.')
      }
      location.assign('/login')
    } catch { setError('Could not finish signing out. Try again.') }
  }
  if (compact) return <div>
    <button type="button" onClick={()=>logout(false)}><LogOut size={17} aria-hidden="true"/>Sign out</button>
    {error && <p role="status">{error}</p>}
  </div>
  return <div className="login-footer">
    <button onClick={listDevices}>Active devices</button>{' · '}
    <button onClick={()=>logout(false)}>Sign out</button>{' · '}
    <button onClick={()=>logout(true)}>Sign out on all devices</button>
    {sessions && <ul>{sessions.map(s=><li key={s.id}>{s.userAgent || 'Device'} · Expires {new Date(s.expiresAt).toLocaleString()} <button onClick={()=>revoke(s.token)}>Revoke</button></li>)}</ul>}
    <p role="status">{error}</p></div>
}
