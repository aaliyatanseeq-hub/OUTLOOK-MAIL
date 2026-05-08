export const dynamic = 'force-dynamic'

import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'
import { createGoogleOAuthClient, saveGoogleRefreshToken } from '@/lib/google-oauth'

const STATE_COOKIE = 'google_oauth_state'
const RETURN_TO_COOKIE = 'google_oauth_return_to'

function sanitizeReturnTo(value: string | null): string {
  if (!value) return '/settings'
  if (!value.startsWith('/')) return '/settings'
  if (value.startsWith('//')) return '/settings'
  return value
}

function clearOAuthCookies(res: NextResponse) {
  const expired = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  }
  res.cookies.set(STATE_COOKIE, '', expired)
  res.cookies.set(RETURN_TO_COOKIE, '', expired)
}

function buildRedirect(req: NextRequest, returnTo: string, status: string, reason?: string) {
  const url = new URL(returnTo, req.url)
  url.searchParams.set('google_oauth', status)
  if (reason) url.searchParams.set('reason', reason)
  return url
}

export async function GET(req: NextRequest) {
  const returnTo = sanitizeReturnTo(req.cookies.get(RETURN_TO_COOKIE)?.value ?? null)
  const expectedState = req.cookies.get(STATE_COOKIE)?.value ?? ''
  const state = req.nextUrl.searchParams.get('state') ?? ''
  const code = req.nextUrl.searchParams.get('code')
  const providerError = req.nextUrl.searchParams.get('error')

  if (providerError) {
    const res = NextResponse.redirect(buildRedirect(req, returnTo, 'error', providerError))
    clearOAuthCookies(res)
    return res
  }

  if (!expectedState || !state || state !== expectedState) {
    const res = NextResponse.redirect(buildRedirect(req, returnTo, 'error', 'state_mismatch'))
    clearOAuthCookies(res)
    return res
  }

  if (!code) {
    const res = NextResponse.redirect(buildRedirect(req, returnTo, 'error', 'missing_code'))
    clearOAuthCookies(res)
    return res
  }

  try {
    const oauth2 = createGoogleOAuthClient(req.nextUrl.origin)
    const { tokens } = await oauth2.getToken(code)
    const refreshToken = tokens.refresh_token?.trim()

    if (!refreshToken) {
      const res = NextResponse.redirect(buildRedirect(req, returnTo, 'error', 'missing_refresh_token'))
      clearOAuthCookies(res)
      return res
    }

    oauth2.setCredentials(tokens)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    let connectedEmail: string | null = null
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' })
      connectedEmail = profile.data.emailAddress ?? null
    } catch {
      connectedEmail = null
    }

    await saveGoogleRefreshToken(refreshToken, connectedEmail)

    const res = NextResponse.redirect(buildRedirect(req, returnTo, 'connected'))
    clearOAuthCookies(res)
    return res
  } catch {
    const res = NextResponse.redirect(buildRedirect(req, returnTo, 'error', 'token_exchange_failed'))
    clearOAuthCookies(res)
    return res
  }
}
