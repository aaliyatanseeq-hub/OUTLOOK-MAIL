import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Get the set of email addresses we have ever sent to (used as an allow-list)
async function getHistoryEmails(): Promise<string[]> {
  const rows = await prisma.sentEmail.findMany({
    select: { toEmail: true },
    distinct: ['toEmail'],
  })
  return rows.map(r => r.toEmail.toLowerCase().trim())
}

// GET /api/inbox?unread=true&search=xyz&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const search = searchParams.get('search')?.trim() ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = 20

  const historyEmails = await getHistoryEmails()

  // Always restrict to emails from history contacts only
  const where: any = {
    fromEmail: { in: historyEmails, mode: 'insensitive' },
  }

  if (unreadOnly) where.isRead = false

  if (search) {
    where.AND = [
      {
        OR: [
          { fromEmail: { contains: search, mode: 'insensitive' } },
          { fromName: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { snippet: { contains: search, mode: 'insensitive' } },
        ],
      },
    ]
  }

  const [total, emails] = await Promise.all([
    prisma.inboundEmail.count({ where }),
    prisma.inboundEmail.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sentEmail: {
          select: { id: true, toName: true, toEmail: true, subject: true, sentAt: true },
        },
      },
    }),
  ])

  return NextResponse.json({ emails, total, page, pageSize })
}

// PATCH /api/inbox — mark message(s) as read
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [body.id]

  await prisma.inboundEmail.updateMany({
    where: { id: { in: ids } },
    data: { isRead: true },
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/inbox — purge all stored emails not from history contacts
export async function DELETE() {
  const historyEmails = await getHistoryEmails()

  const { count } = await prisma.inboundEmail.deleteMany({
    where: {
      fromEmail: { notIn: historyEmails, mode: 'insensitive' },
    },
  })

  return NextResponse.json({ success: true, deleted: count })
}
