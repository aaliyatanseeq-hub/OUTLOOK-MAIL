/**
 * Microsoft Graph API helper — Client Credentials flow.
 * Uses AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET env vars.
 * No SDK needed — plain fetch calls.
 */

export interface GraphTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

export interface GraphMessage {
  id: string
  internetMessageId: string | null
  conversationId: string | null
  subject: string
  bodyPreview: string
  receivedDateTime: string
  isRead: boolean
  body: {
    contentType: 'html' | 'text'
    content: string
  }
  from: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  internetMessageHeaders?: Array<{ name: string; value: string }>
}

// ── Token cache (in-memory, per Vercel function lifetime) ─────────────────────
let cachedToken: string | null = null
let tokenExpiresAt = 0

export function isAzureConfigured(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID?.trim() &&
    process.env.AZURE_CLIENT_ID?.trim() &&
    process.env.AZURE_CLIENT_SECRET?.trim()
  )
}

export function getAzureMailbox(): string {
  return (
    process.env.AZURE_INBOX_EMAIL?.trim() ||
    process.env.MAIL_FROM_ADDRESS?.trim() ||
    ''
  )
}

/**
 * Fetch a Client Credentials access token from Azure AD.
 * Caches the token in memory until it expires.
 */
export async function getGraphAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt - 30_000) {
    return cachedToken
  }

  const tenantId = process.env.AZURE_TENANT_ID?.trim()
  const clientId = process.env.AZURE_CLIENT_ID?.trim()
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim()

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Azure credentials. Required: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET'
    )
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Azure token request failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as GraphTokenResponse
  cachedToken = data.access_token
  tokenExpiresAt = now + data.expires_in * 1000
  return cachedToken
}

/**
 * Generic Graph API GET helper.
 */
export async function graphGet<T>(path: string): Promise<T> {
  const token = await getGraphAccessToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph GET ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

/**
 * Generic Graph API POST helper.
 */
export async function graphPost(path: string, payload: unknown): Promise<void> {
  const token = await getGraphAccessToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph POST ${path} failed (${res.status}): ${text}`)
  }
}
