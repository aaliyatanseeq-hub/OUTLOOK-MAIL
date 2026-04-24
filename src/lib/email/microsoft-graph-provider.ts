import { EmailProvider, SendEmailOptions, SendEmailResult, WebhookEvent } from './provider'

let tokenCache: { token: string; expiresAtMs: number } | null = null

async function getAppAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const tenantId = process.env.AZURE_TENANT_ID?.trim()
  const clientId = process.env.AZURE_CLIENT_ID?.trim()
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim()

  if (!tenantId || !clientId || !clientSecret) {
    return { ok: false, error: 'Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET' }
  }

  if (tokenCache && Date.now() < tokenCache.expiresAtMs - 60_000) {
    return { ok: true, token: tokenCache.token }
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg =
      typeof json.error_description === 'string'
        ? json.error_description
        : typeof json.error === 'string'
          ? json.error
          : `Token request failed (${res.status})`
    return { ok: false, error: msg }
  }

  const accessToken = json.access_token as string | undefined
  const expiresIn = Number(json.expires_in) || 3600

  if (!accessToken) {
    return { ok: false, error: 'No access_token in token response' }
  }

  tokenCache = { token: accessToken, expiresAtMs: Date.now() + expiresIn * 1000 }
  return { ok: true, token: accessToken }
}

function parseFromHeader(from: string): { displayName?: string; address: string } {
  const trimmed = from.trim()
  const m = trimmed.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/)
  if (m) {
    const name = m[1]?.trim()
    return { displayName: name || undefined, address: m[2].trim() }
  }
  return { address: trimmed }
}

export class MicrosoftGraphProvider implements EmailProvider {
  handleWebhook(): WebhookEvent | null {
    return null
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const mailbox = process.env.MS_GRAPH_MAILBOX?.trim()
    if (!mailbox) {
      return { messageId: '', success: false, error: 'Missing MS_GRAPH_MAILBOX (sender UPN, e.g. noreply@company.com)' }
    }

    const tokenResult = await getAppAccessToken()
    if (!tokenResult.ok) {
      return { messageId: '', success: false, error: tokenResult.error }
    }

    const parsed = parseFromHeader(options.from)
    const fromAddress = (parsed.address || '').toLowerCase()
    const mailboxLower = mailbox.toLowerCase()
    const displayName =
      fromAddress === mailboxLower && parsed.displayName ? parsed.displayName : undefined

    const message: Record<string, unknown> = {
      subject: options.subject,
      body: { contentType: 'HTML', content: options.html },
      toRecipients: [{ emailAddress: { address: options.to } }],
    }

    if (displayName) {
      message.from = { emailAddress: { name: displayName, address: mailbox } }
    }

    if (options.replyTo) {
      message.replyTo = [{ emailAddress: { address: options.replyTo } }]
    }

    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    })

    if (res.status === 202 || res.status === 200) {
      return { messageId: '', success: true }
    }

    const errJson = await res.json().catch(() => ({}))
    const graphMsg =
      errJson?.error?.message ||
      errJson?.error_description ||
      (typeof errJson?.error === 'string' ? errJson.error : null) ||
      `Graph sendMail failed (${res.status})`

    return { messageId: '', success: false, error: String(graphMsg) }
  }
}
