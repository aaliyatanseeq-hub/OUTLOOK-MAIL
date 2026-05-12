export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const responses = await prisma.employeeResponse.findMany({
    orderBy: { receivedAt: 'desc' },
    include: {
      inboundEmail: { select: { subject: true } },
    },
  })

  const total = await prisma.sentEmail.count({ where: { status: { not: 'failed' } } })
  const distinct = await prisma.sentEmail.findMany({
    where: { status: { not: 'failed' } },
    select: { toEmail: true },
    distinct: ['toEmail'],
  })

  return NextResponse.json({
    responses,
    stats: {
      totalSent: distinct.length,
      totalResponded: responses.length,
      parsedOk: responses.filter(r => r.parsedOk).length,
      needsReview: responses.filter(r => !r.parsedOk).length,
      pending: distinct.length - responses.length,
    },
  })
}

// DELETE /api/responses — delete a response by id and reset respondedAt on the linked sent email
export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const response = await prisma.employeeResponse.findUnique({ where: { id } })
  if (!response) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.employeeResponse.delete({ where: { id } })

  // Reset respondedAt so the employee gets a fresh link and can re-submit
  await prisma.sentEmail.updateMany({
    where: { toEmail: { equals: response.fromEmail, mode: 'insensitive' }, respondedAt: { not: null } },
    data:  { respondedAt: null },
  })

  return NextResponse.json({ success: true })
}
