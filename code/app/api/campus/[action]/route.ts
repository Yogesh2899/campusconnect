import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { principal, workspacePrincipal } from '@/lib/access'
import { db } from '@/lib/db'
import { MailDeliveryError } from '@/lib/mail'
import { applyWorkspaceAction } from '@/lib/campus-workspace'
import { applyAdminAction } from '@/lib/campus-admin'
import { activateTeacher, activationFields, address, codeField, enrollStaff, InputError, invitationFields, inviteTeacher, issueCode, registerStudent, sendStaffCode, staffCodeFields, staffFields, studentFields, verifyAdmin } from '@/lib/enrollment'

export async function POST(request: Request, context:{params:Promise<{action:string}>}) {
  const {action} = await context.params
  if (request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return new Response(null,{status:403})
  try {
    const body:unknown = await request.json()
    if (action === 'student-code') {
      const {email} = z.strictObject({email:address}).parse(body)
      await issueCode('student:'+email,email)
    } else if (action === 'staff-code') await sendStaffCode(staffCodeFields.parse(body))
    else if (action === 'staff-enroll') await enrollStaff(staffFields.parse(body))
    else if (action === 'workspace') {
      const user = await workspacePrincipal(request.headers.get('x-campus-workspace'))
      if (!user) throw new InputError('Sign in and verify your access to use the dashboard.', 403)
      await applyWorkspaceAction(user, body)
    } else if (action === 'register') await registerStudent(studentFields.parse(body))
    else if (action === 'activate') await activateTeacher(activationFields.parse(body))
    else {
      const actor = await principal('ADMIN')
      if (!actor) throw new InputError('Administrator sign-in required.',403)
      if (action === 'admin-code') await issueCode('admin:'+actor.session.id,actor.user.email)
      else if (action === 'admin-verify') await verifyAdmin(actor.session.id,actor.user.id,codeField.parse(body).code)
      else if (!actor.authorized) throw new InputError('Verify your sign-in code.',403)
      else if (action === 'admin') await applyAdminAction(actor.user.id, body, request.headers)
      else if (action === 'invite') await inviteTeacher(actor.user.id,invitationFields.parse(body))
      else if (action === 'suspend') {
        const {email} = z.strictObject({email:address}).parse(body)
        await db.$transaction(async tx => {
          const user = await tx.user.findFirst({where:{email,role:{in:['STUDENT','TEACHER']}}})
          if (!user) throw new InputError('Account unavailable.',404)
          await tx.user.update({where:{id:user.id},data:{suspended:true}})
          await tx.session.deleteMany({where:{userId:user.id}})
          await tx.auditLog.create({data:{actorId:actor.user.id,action:'ACCOUNT_SUSPENDED',targetId:user.id}})
        })
      } else throw new InputError('Unknown operation.',404)
    }
    return Response.json({ok:true})
  } catch (e) {
    if (e instanceof InputError) return Response.json({message:e.message},{status:e.status})
    if (e instanceof z.ZodError || e instanceof SyntaxError) return Response.json({message:'Check the submitted fields.'},{status:400})
    if (e instanceof Prisma.PrismaClientKnownRequestError && (
      e.code === 'P2034' || (['workspace', 'admin'].includes(action) && e.code === 'P2002')
    )) {
      return Response.json({ message: 'This time or record changed. Refresh and try again.' }, { status: 409 })
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2003'].includes(e.code)) return Response.json({message:'The supplied account details are unavailable.'},{status:409})
    if (e instanceof MailDeliveryError) {
      console.error('Campus email failed', { action, reason: e.reason, status: e.status })
      return Response.json({message:'Email delivery is temporarily unavailable. Please try again later.'},{status:503})
    }
    const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code
      : e instanceof Prisma.PrismaClientInitializationError ? e.errorCode : undefined
    console.error('Campus request failed', { action, error: e instanceof Error ? e.constructor.name : 'Unknown', code })
    return Response.json({message:'Service unavailable. Please try again.'},{status:503})
  }
}
