import { NextResponse } from 'next/server'

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'))
  } catch {
    return {}
  }
}

export async function GET() {
  const tenantId = process.env.AZURE_TENANT_ID?.trim()
  const clientId = process.env.AZURE_CLIENT_ID?.trim()
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim()
  const mailbox = process.env.MS_GRAPH_MAILBOX?.trim()

  const missing: string[] = []
  if (!tenantId) missing.push('AZURE_TENANT_ID')
  if (!clientId) missing.push('AZURE_CLIENT_ID')
  if (!clientSecret) missing.push('AZURE_CLIENT_SECRET')
  if (!mailbox) missing.push('MS_GRAPH_MAILBOX')

  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      error: `Missing: ${missing.join(', ')} — add these to .env.local`,
    })
  }

  // Step 1: acquire OAuth2 client-credentials token
  let token: string
  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    )
    const tokenJson = await tokenRes.json().catch(() => ({}))

    if (!tokenRes.ok) {
      const errCode: string = tokenJson?.error ?? ''
      const errDesc: string = tokenJson?.error_description ?? `HTTP ${tokenRes.status}`
      return NextResponse.json({
        ok: false,
        step: 'token',
        error: errDesc,
        hint:
          errCode === 'invalid_client'
            ? 'Wrong AZURE_CLIENT_SECRET — regenerate it in Azure Portal → App registrations → Certificates & secrets.'
            : errCode === 'unauthorized_client'
              ? 'Client credentials flow is not enabled for this app, or the client secret has expired.'
              : 'Check AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET.',
      })
    }

    token = tokenJson.access_token as string
  } catch (err) {
    return NextResponse.json({
      ok: false,
      step: 'token',
      error: `Network error: ${err instanceof Error ? err.message : 'Cannot reach login.microsoftonline.com'}`,
    })
  }

  // Step 2: decode JWT — check roles without needing extra Graph call
  const payload = decodeJwtPayload(token)
  const roles: string[] = Array.isArray(payload.roles) ? (payload.roles as string[]) : []
  const hasMailSend = roles.includes('Mail.Send')
  const appId: string = (payload.appid as string) ?? clientId ?? ''
  const tenant: string = (payload.tid as string) ?? tenantId ?? ''

  if (!hasMailSend) {
    return NextResponse.json({
      ok: false,
      step: 'permissions',
      tokenAcquired: true,
      appId,
      tenant,
      roles: roles.length ? roles : ['(none — admin consent not granted)'],
      mailbox,
      error: 'Mail.Send permission is not in the token. Admin consent may not have been granted.',
      hint: 'Fix: Azure Portal → App registrations → [your app] → API permissions → Add "Mail.Send" (Application) → click "Grant admin consent for [org]". Wait 1–2 min then test again.',
    })
  }

  return NextResponse.json({
    ok: true,
    step: 'complete',
    tokenAcquired: true,
    mailbox,
    appId,
    roles,
    hasMailSend: true,
    hint: 'Token valid + Mail.Send granted. Ready to send emails via Microsoft Graph.',
  })
}
