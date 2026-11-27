import { LoginScreen } from '@/components/login-screen'
import { registrationDepartments } from '@/lib/departments'


export const dynamic = 'force-dynamic'
export const metadata = { title: 'Create a student account · Thapar Connect' }

export default async function StudentRegistration() {
  const configured = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'BREVO_API_KEY', 'EMAIL_FROM']
    .every(key => Boolean(process.env[key]?.trim()))
  const departments = configured ? await registrationDepartments() : []
  return <LoginScreen mode="register" departments={departments} registrationAvailable={departments.length > 0}/>
}


