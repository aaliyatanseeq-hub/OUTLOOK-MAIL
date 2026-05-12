export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/respond/[token] — load employee info for pre-fill
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const sent = await prisma.sentEmail.findUnique({
    where: { responseToken: params.token },
    select: {
      id: true,
      toName: true,
      toEmail: true,
      respondedAt: true,
    },
  })

  if (!sent) {
    return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 })
  }

  return NextResponse.json({
    toName: sent.toName,
    toEmail: sent.toEmail,
    alreadySubmitted: !!sent.respondedAt,
    submittedAt: sent.respondedAt ?? null,
  })
}

// POST /api/respond/[token] — submit the form
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const sent = await prisma.sentEmail.findUnique({
    where: { responseToken: params.token },
    select: { id: true, toName: true, toEmail: true, respondedAt: true },
  })

  if (!sent) {
    return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 404 })
  }

  if (sent.respondedAt) {
    return NextResponse.json(
      { error: 'You have already submitted your response.', submittedAt: sent.respondedAt },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const { employeeId, workPhone, personalPhone } = body

  // Server-side validation
  const errors: Record<string, string> = {}

  const empId = employeeId?.trim() ?? ''
  const wPhone = workPhone?.trim() ?? ''
  const pPhone = personalPhone?.trim() ?? ''

  // Employee ID: required, min 3 chars
  if (!empId) {
    errors.employeeId = 'Employee ID is required.'
  } else if (empId.length < 3) {
    errors.employeeId = 'Employee ID must be at least 3 characters.'
  }

  // Phone validation: strip non-digits, must be 7–15 digits (ITU standard)
  const digitsOnly = (v: string) => v.replace(/\D/g, '')

  if (!wPhone) {
    errors.workPhone = 'Work phone number is required.'
  } else if (digitsOnly(wPhone).length < 7) {
    errors.workPhone = 'Work phone number is too short. Please enter a valid number.'
  } else if (digitsOnly(wPhone).length > 15) {
    errors.workPhone = 'Work phone number is too long. Please enter a valid number.'
  }

  if (!pPhone) {
    errors.personalPhone = 'Personal phone number is required.'
  } else if (digitsOnly(pPhone).length < 7) {
    errors.personalPhone = 'Personal phone number is too short. Please enter a valid number.'
  } else if (digitsOnly(pPhone).length > 15) {
    errors.personalPhone = 'Personal phone number is too long. Please enter a valid number.'
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 })
  }

  // Check if a response already exists for this email (extra dedup layer)
  const existing = await prisma.employeeResponse.findFirst({
    where: { fromEmail: { equals: sent.toEmail, mode: 'insensitive' } },
  })

  if (!existing) {
    await prisma.employeeResponse.create({
      data: {
        fromEmail:    sent.toEmail,
        fromName:     sent.toName,
        employeeId:   employeeId.trim(),
        workPhone:    workPhone.trim(),
        personalPhone: personalPhone.trim(),
        rawText:      `EMPLOYEE ID: ${employeeId.trim()}\nWORK PHONE: ${workPhone.trim()}\nPERSONAL PHONE: ${personalPhone.trim()}`,
        parsedOk:     true,
        receivedAt:   new Date(),
      },
    })
  }

  // Mark the sent email as responded regardless (prevent re-submission)
  await prisma.sentEmail.update({
    where: { id: sent.id },
    data:  { respondedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
