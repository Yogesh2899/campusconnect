import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// Expose only flows used by this application. Account provisioning is transactional.
const routes = new Set(['sign-in/email', 'sign-in/social', 'callback/google', 'sign-out',
  'sign-in/email-otp', 'email-otp/send-verification-otp', 'request-password-reset',
  'reset-password', 'get-session', 'list-sessions', 'revoke-session', 'revoke-sessions'])
async function handle(request: Request) {
  const path = new URL(request.url).pathname.slice('/api/auth/'.length)
  if (!routes.has(path) && !/^reset-password\/[A-Za-z0-9_-]+$/.test(path)) return new Response(null, { status: 404 })
  const response = await auth.handler(request)
  if (path.startsWith('sign-in/') && response.status >= 400) {
    await db.auditLog.create({data:{action:response.status===429?'SIGN_IN_RATE_LIMITED':'SIGN_IN_DENIED',targetId:path}})
  }
  return response
}
export { handle as GET, handle as POST }
