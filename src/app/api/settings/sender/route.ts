import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const KEY_NAME  = 'sender_name'
const KEY_EMAIL = 'sender_email'

// GET /api/settings/sender — returns saved sender name + email
export async function GET() {
  const [nameRow, emailRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: KEY_NAME } }),
    prisma.appSetting.findUnique({ where: { key: KEY_EMAIL } }),
  ])

  // Fall back to MAIL_FROM env var if nothing saved yet
  const envFrom = process.env.MAIL_FROM?.trim() ?? ''
  const envMatch = envFrom.match(/^(.*?)\s*<([^>]+)>$/)
  const envName  = envMatch?.[1]?.trim() ?? ''
  const envEmail = envMatch?.[2]?.trim() ?? process.env.SMTP_USER?.trim() ?? ''

  return NextResponse.json({
    name:  nameRow?.value  ?? envName,
    email: emailRow?.value ?? envEmail,
    source: (nameRow || emailRow) ? 'db' : 'env',
  })
}

// POST /api/settings/sender — save sender name + email
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name  = String(body.name  ?? '').trim()
  const email = String(body.email ?? '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  await Promise.all([
    prisma.appSetting.upsert({
      where:  { key: KEY_NAME },
      update: { value: name },
      create: { key: KEY_NAME, value: name },
    }),
    prisma.appSetting.upsert({
      where:  { key: KEY_EMAIL },
      update: { value: email },
      create: { key: KEY_EMAIL, value: email },
    }),
  ])

  return NextResponse.json({ success: true, name, email })
}
