export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmailProvider } from '@/lib/email/get-email-provider'
import { getSenderConfig, formatFrom } from '@/lib/email/from-address'

// POST /api/responses/remind — re-send the form link to all non-responders
export async function POST() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'

  // Find all sent emails that have a token but no response yet
  const pending = await prisma.sentEmail.findMany({
    where: {
      status:       { not: 'failed' },
      responseToken: { not: null },
      respondedAt:  null,
    },
    select: {
      id: true,
      toName: true,
      toEmail: true,
      responseToken: true,
    },
    distinct: ['toEmail'],
  })

  if (pending.length === 0) {
    return NextResponse.json({ success: true, sent: 0, message: 'Everyone has already responded!' })
  }

  const sender   = await getSenderConfig()
  const from     = formatFrom(sender.name, sender.email)
  const provider = await getEmailProvider()

  let sent = 0
  let failed = 0

  for (const p of pending) {
    const link = `${appUrl}/respond/${p.responseToken}`
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <p>Dear ${p.toName},</p>
        <p>This is a reminder to please submit your employee details. We haven't received your response yet.</p>
        <p>It only takes 1 minute:</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
            Submit My Details →
          </a>
        </p>
        <p style="color:#888;font-size:12px">Or paste this link in your browser:<br>${link}</p>
        <p style="color:#888;font-size:12px">This link is personal to you — please do not share it.</p>
        <p>Regards,<br>${sender.name || 'HR Department'}</p>
      </div>
    `

    const result = await provider.sendEmail({
      to:      p.toEmail,
      from,
      subject: 'Reminder: Please Submit Your Employee Details',
      html,
    })

    if (result.success) sent++
    else failed++
  }

  return NextResponse.json({ success: true, sent, failed, total: pending.length })
}
