export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGoogleOAuthStatus, isGoogleOAuthConfigured } from '@/lib/google-oauth'

export async function GET() {
  const googleOauth = await getGoogleOAuthStatus()

  return NextResponse.json({
    active: 'smtp',
    source: 'env',
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
    googleInbox: {
      oauthClientConfigured: isGoogleOAuthConfigured(),
      ...googleOauth,
    },
  })
}
