import { timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { principal } from '@/lib/access'
import { InputError } from '@/lib/enrollment'
import { processStudentRoster, scheduleStudents } from '@/lib/student-roster'

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 32) return new Response(null, { status: 503 })
  const provided = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from('Bearer ' + secret)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return new Response(null, { status: 401 })
  const processed = await processStudentRoster()
  return Response.json({ processed }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return new Response(null, { status: 403 })
  const actor = await principal('ADMIN')
  if (!actor?.authorized) return new Response(null, { status: 403 })
  if ((process.env.CRON_SECRET?.length ?? 0) < 32) {
    return Response.json({ message: 'Set the production CRON_SECRET before scheduling the roster.' }, { status: 503 })
  }
  try {
    const form = await request.formData()
    const file = form.get('roster')
    if (!(file instanceof File) || file.size > 150000) throw new InputError('Select a roster JSON file under 150 KB.')
    const scheduled = await scheduleStudents(JSON.parse(await file.text()), actor.user.id)
    return Response.json(scheduled, { status: 201 })
  } catch (error) {
    if (error instanceof InputError) return Response.json({ message: error.message }, { status: error.status })
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json({ message: 'Use the verified 160-record roster JSON.' }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ message: 'This roster overlaps an import already scheduled.' }, { status: 409 })
    }
    throw error
  }
}
