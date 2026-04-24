import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const template = await prisma.template.findUnique({ where: { id: params.id } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(template)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const { name, description, senderName, senderEmail, subject, bodyTemplate } = body

  const template = await prisma.template.update({
    where: { id: params.id },
    data: {
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(senderName && { senderName: senderName.trim() }),
      ...(senderEmail && { senderEmail: senderEmail.trim() }),
      ...(subject && { subject: subject.trim() }),
      ...(bodyTemplate && { bodyTemplate: bodyTemplate.trim() }),
    },
  })
  return NextResponse.json(template)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.template.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
