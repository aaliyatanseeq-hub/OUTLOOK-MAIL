import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/inbox/[id] — fetch full email and mark as read
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const email = await prisma.inboundEmail.findUnique({
    where: { id: params.id },
    include: {
      sentEmail: {
        select: {
          id: true,
          toName: true,
          toEmail: true,
          subject: true,
          body: true,
          sentAt: true,
          template: { select: { name: true } },
        },
      },
    },
  })

  if (!email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Auto-mark as read when opened
  if (!email.isRead) {
    await prisma.inboundEmail.update({
      where: { id: params.id },
      data: { isRead: true },
    })
  }

  return NextResponse.json(email)
}
