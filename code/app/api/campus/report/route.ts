import { principal } from '@/lib/access'
import { db } from '@/lib/db'

function csvValue(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '')
  const guarded = /^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text
  return '"' + guarded.replaceAll('"', '""') + '"'
}

export async function GET(request: Request) {
  const admin = await principal('ADMIN')
  if (!admin?.authorized) return new Response(null, { status: 403 })
  const type = new URL(request.url).searchParams.get('type')
  const rows: unknown[][] = []
  if (type === 'users') {
    const users = await db.user.findMany({
      where: { deletedAt: null },
      select: { name: true, email: true, role: true, emailVerified: true, suspended: true, adminVerifiedAt: true, createdAt: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })
    rows.push(['Name', 'Institutional email', 'Role', 'Email verified', 'Suspended', 'Admin verified at', 'Created at'])
    for (const user of users) rows.push([user.name, user.email, user.role, user.emailVerified, user.suspended, user.adminVerifiedAt, user.createdAt])
  } else if (type === 'audit') {
    const entries = await db.auditLog.findMany({
      select: { action: true, targetId: true, createdAt: true, actor: { select: { email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    rows.push(['Action', 'Actor', 'Target', 'Time'])
    for (const entry of entries) rows.push([entry.action, entry.actor?.email, entry.targetId, entry.createdAt])
  } else return new Response(null, { status: 404 })

  await db.auditLog.create({ data: { actorId: admin.user.id, action: 'ADMIN_CSV_EXPORTED_' + type.toUpperCase() } })
  return new Response('\uFEFF' + rows.map(row => row.map(csvValue).join(',')).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="thapar-connect-' + type + '.csv"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
