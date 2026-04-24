import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const PROVIDER_KEY = 'active_email_provider'

export async function GET() {
  const setting = await prisma.appSetting.findUnique({ where: { key: PROVIDER_KEY } })
  const envProvider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase().trim()
  const active = setting?.value ?? envProvider

  return NextResponse.json({
    active,
    source: setting ? 'db' : 'env',
    smtp: {
      configured: !!(
        process.env.SMTP_HOST?.trim() &&
        process.env.SMTP_PORT?.trim() &&
        process.env.SMTP_USER?.trim() &&
        process.env.SMTP_PASS?.trim()
      ),
      host: process.env.SMTP_HOST?.trim() || null,
      user: process.env.SMTP_USER?.trim() || null,
      mailFrom: process.env.MAIL_FROM?.trim() || null,
    },
    resend: {
      configured: !!(process.env.RESEND_API_KEY?.trim()),
      fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || null,
    },
    microsoft: {
      configured: !!(
        process.env.AZURE_TENANT_ID?.trim() &&
        process.env.AZURE_CLIENT_ID?.trim() &&
        process.env.AZURE_CLIENT_SECRET?.trim() &&
        process.env.MS_GRAPH_MAILBOX?.trim()
      ),
      mailbox: process.env.MS_GRAPH_MAILBOX?.trim() || null,
    },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const provider = String(body.provider || '').toLowerCase().trim()

  if (!['smtp', 'resend', 'microsoft'].includes(provider)) {
    return NextResponse.json({ error: 'provider must be smtp, resend, or microsoft' }, { status: 400 })
  }

  await prisma.appSetting.upsert({
    where: { key: PROVIDER_KEY },
    update: { value: provider },
    create: { key: PROVIDER_KEY, value: provider },
  })

  return NextResponse.json({ active: provider })
}
