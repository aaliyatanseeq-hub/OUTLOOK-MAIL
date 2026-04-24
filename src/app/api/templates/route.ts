import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { emails: true } } },
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { name, description, senderName, senderEmail, subject, bodyTemplate } = body

  if (!name?.trim() || !senderName?.trim() || !senderEmail?.trim() || !subject?.trim() || !bodyTemplate?.trim()) {
    return NextResponse.json({ error: 'name, senderName, senderEmail, subject, bodyTemplate are required' }, { status: 400 })
  }

  const template = await prisma.template.create({
    data: { name: name.trim(), description: description?.trim() || null, senderName: senderName.trim(), senderEmail: senderEmail.trim(), subject: subject.trim(), bodyTemplate: bodyTemplate.trim() },
  })
  return NextResponse.json(template, { status: 201 })
}
