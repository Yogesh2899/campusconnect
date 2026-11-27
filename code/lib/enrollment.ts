import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from './db'
import { sendMail, sendOtpMail } from './mail'
import { OTP_MINUTES } from './otp-email'
import { MIN_PASSWORD_LENGTH, OWNER_EMAIL } from './account-policy'
import { COMPUTING_DEPARTMENT, validRegistrationDepartment } from './departments'

export const address = z.string().trim().toLowerCase().email().max(254).endsWith('@thapar.edu')
const label = z.string().trim().min(1).max(120)
const password = z.string().min(MIN_PASSWORD_LENGTH).max(128)
const otp = z.string().regex(/^\d{6}$/)
export const studentFields = z.strictObject({
  email: address, name: label, password, studentId: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,32}$/),
  departmentId: label, year: z.number().int().min(1).max(8), code: otp,
})
export const staffCodeFields = z.strictObject({ email: address, owner: z.boolean().default(false) })
export const staffFields = staffCodeFields.extend({ name: label.optional(), password, code: otp })
export const invitationFields = z.strictObject({ email: address, name: label, employeeId: label, departmentId: label, designation: label })
export const activationFields = z.strictObject({ token: z.string().regex(/^[0-9a-f]{64}$/), password })
export const codeField = z.strictObject({code: otp})
export class InputError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}
function digest(key: string, code: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('Missing application secret')
  return createHmac('sha256',secret).update(key + ':' + code).digest('hex')
}
export async function issueCode(key: string, email: string) {
  const code = randomInt(1000000).toString().padStart(6, '0')
  const hash = digest(key, code)
  const limitKey = 'campus-mail:' + tokenHash(key)
  const now = BigInt(Date.now())
  const cutoff = now - BigInt(3600000)
  const allowed = await db.$executeRaw`INSERT INTO "RateLimit" ("id","key","count","lastRequest")
    VALUES (${randomUUID()}, ${limitKey}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count"=CASE WHEN "RateLimit"."lastRequest" < ${cutoff} THEN 1 ELSE "RateLimit"."count"+1 END,
      "lastRequest"=CASE WHEN "RateLimit"."lastRequest" < ${cutoff} THEN ${now} ELSE "RateLimit"."lastRequest" END
    WHERE "RateLimit"."count" < 8 OR "RateLimit"."lastRequest" < ${cutoff}`
  if (!allowed) throw new InputError('Too many code requests. Try again in an hour.',429)
  const written = await db.$executeRaw`INSERT INTO "StudentChallenge" ("email", "digest", "expiresAt", "sentAt", "attempts")
    VALUES (${key}, ${hash}, (NOW() AT TIME ZONE 'UTC') + make_interval(mins => ${OTP_MINUTES}::int), (NOW() AT TIME ZONE 'UTC'), 0)
    ON CONFLICT ("email") DO UPDATE SET "digest"=EXCLUDED."digest", "expiresAt"=EXCLUDED."expiresAt", "sentAt"=EXCLUDED."sentAt", "attempts"=0
    WHERE "StudentChallenge"."sentAt" < EXCLUDED."sentAt" - interval '1 minute'`
  if (!written) throw new InputError('Wait a minute before requesting another code.', 429)
  await sendOtpMail(email, code, 'verify')
}
async function consumeCode(tx: Prisma.TransactionClient, key: string, code: string) {
  const where = { email:key, expiresAt:{gt:new Date()}, attempts:{lt:5} }
  const consumed = await tx.studentChallenge.deleteMany({where:{...where,digest:digest(key,code)}})
  if (consumed.count) return true
  await tx.studentChallenge.updateMany({where,data:{attempts:{increment:1}}})
  return false
}
export async function registerStudent(input: z.infer<typeof studentFields>) {
  const ok = await db.$transaction(async tx => {
    const [department, faculty] = await Promise.all([
      tx.department.findUnique({ where: { id: input.departmentId }, select: { name: true } }),
      tx.dcseFaculty.findUnique({ where: { email: input.email }, select: { email: true } }),
    ])
    if (!department || !validRegistrationDepartment(department.name)) throw new InputError('Choose a department from the list.')
    if (faculty || input.email === OWNER_EMAIL) throw new InputError('Use faculty or administrator sign-in for this address.')
    if (!await consumeCode(tx,'student:'+input.email,input.code)) return false
    if (await tx.teacherInvitation.findUnique({where:{email:input.email}})) throw new InputError('Use your faculty invitation.')
    const existing = await tx.user.findUnique({ where: { email: input.email }, include: { student: true } })
    let userId: string
    if (existing) {
      if (existing.student?.studentId !== input.studentId) throw new InputError('The supplied account details are unavailable.', 409)
      const claimed = await tx.user.updateMany({
        where: { id: existing.id, role: 'STUDENT', emailVerified: false, suspended: false, deletedAt: null },
        data: { emailVerified: true },
      })
      if (!claimed.count) throw new InputError('The supplied account details are unavailable.', 409)
      if (!existing.student.departmentId) {
        await tx.studentProfile.update({ where: { userId: existing.id }, data: { departmentId: input.departmentId } })
      }
      userId = existing.id
    } else {
      const user = await tx.user.create({data:{
        name:input.name,email:input.email,emailVerified:true,role:'STUDENT',
        student:{create:{studentId:input.studentId,departmentId:input.departmentId,year:input.year}},
      }})
      userId = user.id
    }
    await tx.account.create({data:{accountId:userId,userId,providerId:'credential',password:await hashPassword(input.password)}})
    await tx.auditLog.create({data:{actorId:userId,action:'STUDENT_REGISTERED'}})
    return true
  })
  if (!ok) throw new InputError('Invalid or expired code.')
}

async function staffIdentity(tx: Prisma.TransactionClient, email: string, owner: boolean) {
  if (owner && email === OWNER_EMAIL) return { role: 'ADMIN' as const, faculty: null }
  if (!owner && email !== OWNER_EMAIL) {
    const faculty = await tx.dcseFaculty.findUnique({ where: { email } })
    if (faculty) return { role: 'TEACHER' as const, faculty }
  }
  throw new InputError(owner ? 'This address is unavailable for administrator setup.' : 'Use an email listed in the faculty directory.', 403)
}

export async function sendStaffCode(input: z.infer<typeof staffCodeFields>) {
  const { email, owner } = input
  await staffIdentity(db, email, owner)
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new InputError('Sign in with your existing account or use Forgot password.', 409)
  }
  await issueCode((owner ? 'owner-enroll:' : 'faculty-enroll:') + email, email)
}

export async function enrollStaff({ email, owner, name, password, code }: z.infer<typeof staffFields>) {
  if (owner && !name) throw new InputError('Enter your full name.')
  const ok = await db.$transaction(async tx => {
    const identity = await staffIdentity(tx, email, owner)
    if (!await consumeCode(tx, (owner ? 'owner-enroll:' : 'faculty-enroll:') + email, code)) return false
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) throw new InputError('Sign in with your existing account or use Forgot password.', 409)
    const department = identity.faculty && await tx.department.findUniqueOrThrow({ where: { name: COMPUTING_DEPARTMENT } })
    const user = await tx.user.create({
      data: { email, name: identity.faculty?.name ?? name!, emailVerified: true, role: identity.role },
    })
    if (identity.faculty && department) {
      await tx.teacherProfile.create({ data: {
        userId: user.id, employeeId: 'directory:' + user.id, designation: identity.faculty.designation, departmentId: department.id,
      } })
    }
    await tx.account.create({ data: { accountId: user.id, userId: user.id, providerId: 'credential', password: await hashPassword(password) } })
    await tx.auditLog.create({ data: { actorId: user.id, action: owner ? 'ADMIN_PROVISIONED' : 'DIRECTORY_FACULTY_ACTIVATED' } })
    return true
  })
  if (!ok) throw new InputError('Invalid or expired code.')
}
const tokenHash = (token:string) => createHash('sha256').update(token).digest('hex')
export async function inviteTeacher(actorId:string, input:z.infer<typeof invitationFields>) {
  const token = randomBytes(32).toString('hex')
  const fields = {...input, issuedBy:actorId, tokenHash:tokenHash(token), expiresAt:new Date(Date.now()+86400000)}
  await db.$transaction(async tx => {
    if (await tx.user.findUnique({where:{email:input.email}})) throw new InputError('This address already has an account.',409)
    const invite = await tx.teacherInvitation.upsert({where:{email:input.email}, create:fields, update:fields})
    await tx.auditLog.create({data:{actorId, action:'TEACHER_INVITED',targetId:invite.id}})
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  await sendMail(input.email,'Your Thapar Connect faculty invitation','Set your password within 24 hours: '+process.env.BETTER_AUTH_URL+'/login/activate#'+token)
}
export async function activateTeacher(input:z.infer<typeof activationFields>) {
  const hash = tokenHash(input.token)
  await db.$transaction(async tx => {
    const used = await tx.teacherInvitation.updateMany({where:{tokenHash:hash,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}})
    if (!used.count) throw new InputError('Invalid or expired invitation.')
    const invite = await tx.teacherInvitation.findUniqueOrThrow({where:{tokenHash:hash}})
    const user = await tx.user.create({data:{email:invite.email,name:invite.name,emailVerified:true,role:'TEACHER',
      teacher:{create:{employeeId:invite.employeeId,departmentId:invite.departmentId,designation:invite.designation}}}})
    await tx.account.create({data:{accountId:user.id,userId:user.id,providerId:'credential',password:await hashPassword(input.password)}})
    await tx.auditLog.create({data:{actorId:user.id,action:'TEACHER_ACTIVATED'}})
  })
}
export async function verifyAdmin(sessionId:string, actorId:string, code:string) {
  const ok = await db.$transaction(async tx => {
    if (!await consumeCode(tx,'admin:'+sessionId,code)) return false
    await tx.verification.create({data:{id:randomUUID(),identifier:'admin-grant:'+sessionId,value:'verified',expiresAt:new Date(Date.now()+3600000)}})
    await tx.auditLog.create({data:{actorId,action:'ADMIN_SECOND_FACTOR_VERIFIED'}})
    return true
  })
  if (!ok) throw new InputError('Invalid or expired code.')
}


