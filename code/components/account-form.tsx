'use client'

import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { MIN_PASSWORD_LENGTH, OWNER_EMAIL } from '@/lib/account-policy'
import { DepartmentPicker, type DepartmentOption } from './department-picker'

const titles:Record<string,string> = {
  student:'Student login', teacher:'Teacher login', admin:'Admin login', register:'Create student account',
  forgot:'Recover your password', reset:'Choose a new password', activate:'Activate faculty account',
  otp:'Email code login', challenge:'Verify admin access', invite:'Invite a faculty member', suspend:'Suspend an account',
  'faculty-setup':'Activate a faculty account', 'owner-setup':'Set up the administrator account',
}
export const modes = Object.keys(titles)
async function post(path:string, body:object) {
  const res = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const data = await res.json().catch(()=>({}))
  if (!res.ok) throw Error(data.message || 'Request failed. Please try again.')
  return data
}
function PasswordField({confirm=false, creating=false}:{confirm?:boolean,creating?:boolean}) {
  const [visible,setVisible] = useState(false)
  const name = confirm ? 'confirm' : 'password'
  const label = confirm ? 'Confirm password' : 'Password'
  const Icon = visible ? EyeOff : Eye
  return <div className="secret-field">
    <label htmlFor={name}>{label}</label>
    <div><input id={name} name={name} type={visible?'text':'password'} required
      placeholder={confirm ? 'Re-enter your password' : creating ? 'At least 8 characters' : 'Enter your password'}
      autoComplete={creating?'new-password':'current-password'} minLength={MIN_PASSWORD_LENGTH} maxLength={128}/>
      <button type="button" aria-label={(visible?'Hide ':'Show ')+(confirm?'password confirmation':'password')}
        aria-controls={name} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}><Icon size={19} aria-hidden="true"/></button>
    </div>
  </div>
}

export function AccountForm({mode,departments=[],google=false,registrationAvailable=true}:{mode:string,departments?:DepartmentOption[],google?:boolean,registrationAvailable?:boolean}) {
  const [sent,setSent] = useState(false)
  const [busy,setBusy] = useState(false)
  const [notice,setNotice] = useState('')

  const login = ['student','teacher','admin'].includes(mode)
  const ownerSetup = mode === 'owner-setup'
  const staffSetup = mode === 'faculty-setup' || ownerSetup
  const usesCode = staffSetup || ['otp','register','challenge'].includes(mode)
  const newPassword = staffSetup ? sent : ['reset','activate','register'].includes(mode)
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const data = Object.fromEntries(form) as Record<string,string>
    const {email,password,code,name,departmentId,employeeId,designation} = data
    const intent = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)?.value
    setBusy(true)
    setNotice('')
    try {
      if (mode === 'register' && intent !== 'resend' && !departments.some(department => department.id === departmentId)) {
        throw Error('Choose a department from the list.')
      }
      if (newPassword && password !== data.confirm) throw Error('Passwords must match.')
      if (intent === 'google') {
        const result = await post('/api/auth/sign-in/social',{provider:'google',callbackURL:'/account'})
        window.location.assign(result.url)
      } else if (login) {
        await post('/api/auth/sign-in/email',{email,password,rememberMe:form.has('remember')})
        window.location.assign('/account/' + mode)
      } else if (usesCode && (!sent || intent === 'resend')) {
        if (mode === 'otp') await post('/api/auth/email-otp/send-verification-otp',{email,type:'sign-in'})
        else if (mode === 'register') await post('/api/campus/student-code',{email})
        else if (staffSetup) await post('/api/campus/staff-code',{email,owner:ownerSetup})
        else await post('/api/campus/admin-code',{})
        setSent(true)
        setNotice('Check your institutional inbox for the six-digit code.')
      } else if (mode === 'register') {
        await post('/api/campus/register',{name,email,password,code,departmentId,studentId:data.studentId,year:Number(data.year)})
        await post('/api/auth/sign-in/email',{email,password})
        window.location.assign('/account/student')
      } else if (staffSetup) {
        await post('/api/campus/staff-enroll',{email,password,code,owner:ownerSetup,...(ownerSetup ? {name} : {})})
        await post('/api/auth/sign-in/email',{email,password})
        window.location.assign('/account')
      } else if (mode === 'otp') {
        await post('/api/auth/sign-in/email-otp',{email,otp:code})
        window.location.assign('/account')
      } else if (mode === 'challenge') {
        await post('/api/campus/admin-verify',{code})
        const workspace = new URLSearchParams(location.search).get('workspace')
        window.location.assign('/account/' + (workspace === 'student' || workspace === 'teacher' ? workspace : 'admin'))
      } else if (mode === 'forgot') {
        await post('/api/auth/request-password-reset',{email,redirectTo:location.origin+'/login/reset'})
        setNotice('If your address is registered, check your inbox for a reset link.')
      } else if (mode === 'reset') {
        await post('/api/auth/reset-password',{newPassword:password,token:new URLSearchParams(location.search).get('token')})
        setNotice('Password updated. You can sign in now.')
      } else if (mode === 'activate') {
        await post('/api/campus/activate',{token:location.hash.slice(1),password})
        window.location.replace('/login/teacher')
      } else if (mode === 'invite') {
        await post('/api/campus/invite',{email,name,departmentId,employeeId,designation})
        setNotice('Invitation sent. The faculty member has 24 hours to activate their account.')
      } else if (mode === 'suspend') {
        await post('/api/campus/suspend',{email})
        setNotice('Account suspended and sessions revoked.')
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Request failed.') }
    finally { setBusy(false) }
  }
  return <>
    <div className="login-copy"><span className="login-kicker">THAPAR CONNECT</span><h1 id="login-title">{titles[mode]}</h1></div>
    {mode === 'register' && <p className="registration-intro">{registrationAvailable
      ? 'Choose your department and verify your @thapar.edu email to finish registration.'
      : 'Student registration is temporarily unavailable. Please return when enrollment opens.'}</p>}
    {staffSetup && <p className="registration-intro">{ownerSetup
      ? 'Verify the designated Thapar email and choose a password for first-time setup.'
      : 'Use the institutional email listed in the faculty directory to activate your account.'}</p>}
    <form className="login-form" onSubmit={submit}>
      {(['register','invite'].includes(mode) || (ownerSetup && sent)) && <label>Full name<input name="name" autoComplete="name" placeholder="Enter your full name" required maxLength={120}/></label>}
      {!['reset','activate','challenge'].includes(mode) && <label>Institutional email<input name="email" type="email" autoComplete="email" placeholder="you@thapar.edu" defaultValue={ownerSetup ? OWNER_EMAIL : undefined} required readOnly={sent || ownerSetup}/></label>}
      {mode === 'register' && <><div className="registration-fields"><label>Student ID<input name="studentId" placeholder="Enter your student ID" required pattern="[a-zA-Z0-9\-]{3,32}"/></label><label>Year of study<input name="year" type="number" min="1" max="8" placeholder="e.g. 2" required/></label></div>
        <DepartmentPicker departments={departments}/></>}
      {mode === 'invite' && <><label>Employee ID<input required name="employeeId"/></label><label>Designation<input required name="designation"/></label></>}
      {mode === 'invite' && <label>Department<select name="departmentId" defaultValue="" required><option value="">Select your department</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
      {(login || newPassword) && <PasswordField creating={newPassword}/>}
      {newPassword && <PasswordField creating confirm/>}

      {login && <label><input name="remember" type="checkbox" style={{width:'auto',height:'auto'}}/> Remember this device</label>}
      {sent && <label>Verification code<input name="code" placeholder="Enter the 6-digit code from your email" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required autoFocus/></label>}
      <button type="submit" disabled={busy || (mode==='register' && !registrationAvailable)} className="login-submit">{busy?'Please wait…':login?'Sign in':usesCode?(sent?'Verify and continue':'Send verification code'):titles[mode]}</button>
      {sent && <button disabled={busy} formNoValidate name="intent" value="resend">Send another code</button>}
      {google && ['student','teacher'].includes(mode) && <button className="button button-outline" formNoValidate value="google" disabled={busy}>Continue with Google</button>}
      {notice && <p className="login-notice" role="status">{notice}</p>}
    </form>
    <div className="login-footer">
      {login && <Link href="/login/forgot">Forgot password?</Link>}{' '}
      {['student','teacher'].includes(mode) && <Link href="/login/otp">Use an email code</Link>}{' '}
      {mode==='teacher' && <><Link href="/login/faculty-setup">Activate a faculty account</Link><Link href="/login/admin">Admin access</Link></>}{' '}
      {mode==='admin' && <Link href="/login/owner-setup">First-time administrator setup</Link>}
      {mode==='student' && <><Link href="/login/register">Create student account</Link>{' · '}<Link href="/login/teacher">Teacher login</Link></>}
      {!login && <Link href="/login">Back to sign in</Link>}
    </div>
  </>
}

