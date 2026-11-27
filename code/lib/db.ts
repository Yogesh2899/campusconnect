import { PrismaClient } from '@prisma/client'

const runtime = globalThis as typeof globalThis & { campusDb?: PrismaClient }
export const db = runtime.campusDb ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') runtime.campusDb = db
