import { betterAuth } from 'better-auth'
import { createHmac } from 'node:crypto'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { emailOTP } from 'better-auth/plugins'
import { db } from './db'
import { sendMail, sendOtpMail } from './mail'
import { OTP_MINUTES } from './otp-email'
import { MIN_PASSWORD_LENGTH, OWNER_EMAIL } from './account-policy'
import { COMPUTING_DEPARTMENT } from './departments'

async function assignDirectoryRole(user: { id: string; email: string; role: 'STUDENT' | 'TEACHER' | 'ADMIN' }) {
  if (user.role === 'ADMIN') return
  const owner = user.email === OWNER_EMAIL
  const faculty = !owner && user.role === 'STUDENT' && await db.dcseFaculty.findUnique({ where: { email: user.email } })
  if (!owner && !faculty) return
  await db.$transaction(async tx => {
    const changed = await tx.user.updateMany({
      where: {
        id: user.id, role: user.role, emailVerified: true, suspended: false, deletedAt: null,
        // A faculty profile can remain after an administrator explicitly changes the role.
        ...(!owner ? { teacher: null } : {}),
      },
      data: { role: owner ? 'ADMIN' : 'TEACHER' },
    })
    if (!changed.count) return
    if (faculty) {
      const department = await tx.department.findUniqueOrThrow({ where: { name: COMPUTING_DEPARTMENT } })
      await tx.teacherProfile.create({ data: {
        userId: user.id, employeeId: 'directory:' + user.id, departmentId: department.id, designation: faculty.designation,
      } })
    }
    await tx.session.deleteMany({ where: { userId: user.id } })
    await tx.auditLog.create({ data: { actorId: user.id, action: owner ? 'ADMIN_PROVISIONED' : 'DIRECTORY_FACULTY_ACTIVATED' } })
  })
}

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
  emailAndPassword: {
    enabled: true, disableSignUp: true, requireEmailVerification: true,
    minPasswordLength: MIN_PASSWORD_LENGTH, maxPasswordLength: 128, revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const active = await db.user.findFirst({
        where: { id: user.id, emailVerified: true, suspended: false, deletedAt: null }, select: { id: true },
      })
      if (active) await sendMail(user.email, 'Reset your Thapar Connect password', 'Open this link to choose a new password: ' + url)
    },
  },
  socialProviders: googleEnabled ? { google: {
    clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    hd: 'thapar.edu', disableSignUp: true, disableImplicitSignUp: true,
  } } : {},
  session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 24 * 7 },
  rateLimit: { enabled: true, storage: 'database', window: 60, max: 40,
    customRules: { '/sign-in/email': { window: 60, max: 5 }, '/email-otp/send-verification-otp': { window: 60, max: 3 } } },
  databaseHooks: {
    user: { create: { before: async () => false } },
    session: { create: { before: async (session, ctx) => {
      const user = await db.user.findUnique({ where: { id: session.userId } })
      if (!user?.emailVerified || user.suspended || user.deletedAt || !user.email.endsWith('@thapar.edu')) return false
      if ((user.role === 'ADMIN' || user.email === OWNER_EMAIL) && ctx?.path !== '/sign-in/email') return false
      await assignDirectoryRole(user)
      return { data: session }
    }, after: async session => {
      await db.auditLog.create({ data: { actorId: session.userId, action: 'SESSION_CREATED' } })
    } } },
  },
  plugins: [emailOTP({
    disableSignUp: true, otpLength: 6, expiresIn: OTP_MINUTES * 60, allowedAttempts: 5,
    storeOTP: { hash: async otp => createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update('login:'+otp).digest('hex') },
    async sendVerificationOTP({ email, otp, type }) {
      if (type !== 'sign-in' || !email.endsWith('@thapar.edu') || email === OWNER_EMAIL) return
      const user = await db.user.findUnique({ where: { email } })
      if (user?.emailVerified && user.role !== 'ADMIN' && !user.suspended && !user.deletedAt) await sendOtpMail(email, otp, 'sign-in')
    },
  })],
})
