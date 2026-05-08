export const dynamic = 'force-dynamic'

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  createGoogleOAuthClient,
  getGoogleOAuthScopes,
  isGoogleOAuthConfigured,
} from '@/lib/google-oauth'

const STATE_COOKIE = 'google_oauth_state'
const RETURN_TO_COOKIE = 'google_oauth_return_to'
const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  }
}

function sanitizeReturnTo(value: string | null): string {
  if (!value) return '/settings'
  if (!value.startsWith('/')) return '/settings'
  if (value.startsWith('//')) return '/settings'
  return value
}

function buildSettingsErrorRedirect(req: NextRequest, reason: string) {
  const url = new URL('/settings', req.url)
  url.searchParams.set('google_oauth', reason)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return buildSettingsErrorRedirect(req, 'missing_config')
  }

  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo'))
  const state = crypto.randomBytes(24).toString('hex')
  const oauth2 = createGoogleOAuthClient(req.nextUrl.origin)

  const authorizeUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: getGoogleOAuthScopes(),
    state,
  })

  const res = NextResponse.redirect(authorizeUrl)
  const cookieOptions = getCookieOptions()
  res.cookies.set(STATE_COOKIE, state, cookieOptions)
  res.cookies.set(RETURN_TO_COOKIE, returnTo, cookieOptions)
  return res
}
