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

  // Employee ID: required, 5–6 chars
  if (!empId) {
    errors.employeeId = 'Employee ID is required.'
  } else if (empId.length < 5) {
    errors.employeeId = 'Employee ID must be at least 5 characters.'
  } else if (empId.length > 6) {
    errors.employeeId = 'Employee ID must not exceed 6 characters.'
  }

  const digitsOnly = (v: string) => v.replace(/\D/g, '')

  // Validate digit count based on country code prefix in the stored value
  function validatePhone(phone: string): string | null {
    const d = digitsOnly(phone)
    if (phone.startsWith('+971')) {
      // UAE: 8–9 digits after code
      const local = d.replace(/^971/, '')
      if (local.length < 8) return 'UAE numbers must be at least 8 digits.'
      if (local.length > 9) return 'UAE numbers must not exceed 9 digits.'
    } else if (phone.startsWith('+966')) {
      // KSA: 8–9 digits after code
      const local = d.replace(/^966/, '')
      if (local.length < 8) return 'KSA numbers must be at least 8 digits.'
      if (local.length > 9) return 'KSA numbers must not exceed 9 digits.'
    } else if (phone.startsWith('+91')) {
      // India: exactly 10 digits after code
      const local = d.replace(/^91/, '')
      if (local.length !== 10) return 'Indian numbers must be exactly 10 digits.'
    } else {
      if (d.length < 7)  return 'Please enter a valid phone number.'
      if (d.length > 15) return 'Phone number is too long.'
    }
    return null
  }

  if (!wPhone) {
    errors.workPhone = 'Work phone number is required.'
  } else {
    const err = validatePhone(wPhone)
    if (err) errors.workPhone = err
  }

  if (pPhone) {
    const err = validatePhone(pPhone)
    if (err) errors.personalPhone = err
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
