import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'

const db = new PrismaClient()
try {
  const name = process.env.DEPARTMENT_NAME?.trim()
  if (name) await db.department.upsert({where:{name}, create:{name}, update:{}})
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (email) {
    const password = process.env.ADMIN_PASSWORD ?? ''
    if (!/^[^\s@]+@thapar\.edu$/.test(email) || password.length < 16 || password.length > 128 || !process.env.ADMIN_NAME?.trim()) throw Error('Invalid administrator provisioning fields')
    const hash = await hashPassword(password)
    await db.$transaction(async tx => {
      const existing = await tx.user.findUnique({where:{email}})
      if (existing?.role === 'ADMIN') return
      if (existing) throw Error('Address already registered')
      const user = await tx.user.create({data:{email,name:process.env.ADMIN_NAME.trim(), role:'ADMIN', emailVerified:true}})
      await tx.account.create({data:{providerId:'credential', accountId:user.id, userId:user.id,password:hash}})
      await tx.auditLog.create({data:{action:'ADMIN_PROVISIONED',targetId:user.id}})
    })
  }
} finally { await db.$disconnect() }
