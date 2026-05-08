import { gmail_v1, google } from 'googleapis'
import { getGoogleRefreshToken, saveGoogleRefreshToken } from '@/lib/google-oauth'

type GmailClientCandidate = {
  gmail: gmail_v1.Gmail
  source: 'db' | 'env'
}

function isInvalidGrant(err: unknown): boolean {
  const e = err as {
    message?: string
    response?: { data?: { error?: string } }
  }
  return e?.response?.data?.error === 'invalid_grant' || e?.message === 'invalid_grant'
}

function buildGmailClient(refreshToken: string, source: 'db' | 'env'): GmailClientCandidate {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  oauth2.setCredentials({ refresh_token: refreshToken })

  // If Google rotates refresh tokens, keep DB storage current automatically.
  if (source === 'db') {
    oauth2.on('tokens', (tokens) => {
      const next = tokens.refresh_token?.trim()
      if (!next) return
      void saveGoogleRefreshToken(next).catch(() => {
        // Ignore persistence failures here; sync can still continue with in-memory token.
      })
    })
  }

  return {
    gmail: google.gmail({ version: 'v1', auth: oauth2 }),
    source,
  }
}

async function getGmailClientCandidates(): Promise<GmailClientCandidate[]> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.')
  }

  const tokenState = await getGoogleRefreshToken()
  if (!tokenState.token) {
    throw new Error(
      'Missing Google OAuth refresh token. Connect Gmail in Settings or set GOOGLE_REFRESH_TOKEN.',
    )
  }

  const candidates: GmailClientCandidate[] = []
  candidates.push(buildGmailClient(tokenState.token, tokenState.source === 'db' ? 'db' : 'env'))

  // If DB token fails with invalid_grant, we can still fall back to env token.
  if (tokenState.source === 'db') {
    const envToken = process.env.GOOGLE_REFRESH_TOKEN?.trim()
    if (envToken && envToken !== tokenState.token) {
      candidates.push(buildGmailClient(envToken, 'env'))
    }
  }

  return candidates
}

export interface GmailMessage {
  gmailId: string
  threadId: string
  fromName: string
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string
  bodyHtml: string
  snippet: string
  inReplyTo: string | null // the Message-ID this email is replying to
  receivedAt: Date
}

// Parse name + email from a raw "From" header like "John Doe <john@example.com>"
function parseAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim() }
  return { name: '', email: raw.trim() }
}

// Decode base64url-encoded Gmail part data
function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

// Extract plain-text and HTML body parts recursively from a Gmail message payload
function extractBody(payload: any): { text: string; html: string } {
  if (!payload) return { text: '', html: '' }

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return { text: decodeBase64(payload.body.data), html: '' }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return { text: '', html: decodeBase64(payload.body.data) }
  }

  if (payload.parts) {
    let text = ''
    let html = ''
    for (const part of payload.parts) {
      const result = extractBody(part)
      if (result.text) text = result.text
      if (result.html) html = result.html
    }
    return { text, html }
  }

  return { text: '', html: '' }
}

/**
 * Fetch Gmail messages that are replies from people we sent emails to.
 *
 * Strategy:
 *  1. Build a Gmail search query: `from:(addr1 OR addr2 ...) in:inbox`
 *     so we only pull messages FROM recipients of our outbound emails.
 *  2. Additionally exclude any message whose From address matches our own
 *     sending address (avoids picking up echoes / self-send tests).
 *  3. The `In-Reply-To` header is captured so we can do precise matching later.
 *
 * @param recipientEmails - list of email addresses we have sent to
 * @param myEmail         - our own sending address (excluded from results)
 * @param maxResults      - max Gmail messages to fetch (default 100)
 */
export type FetchRepliesResult = {
  messages: GmailMessage[]
  /** How many message IDs Gmail returned from list() before filtering. */
  listTotal: number
  /** Which search query matched (inbox vs relaxed). */
  queryUsed: 'inbox' | 'relaxed'
}

function buildFromClause(recipientEmails: string[]): string {
  return recipientEmails
    .slice(0, 50)
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean)
    .join(' OR ')
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const part = await Promise.all(batch.map(fn))
    out.push(...part)
  }
  return out
}

export async function fetchRepliesFromRecipients(
  recipientEmails: string[],
  myEmail: string,
  maxResults = 100,
): Promise<FetchRepliesResult> {
  if (recipientEmails.length === 0) {
    return { messages: [], listTotal: 0, queryUsed: 'inbox' }
  }

  const fromClause = buildFromClause(recipientEmails)
  const my = myEmail.toLowerCase().trim()
  const clients = await getGmailClientCandidates()

  let lastError: unknown = null

  for (const client of clients) {
    try {
      // Primary: messages still in Inbox. Some accounts/labels behave oddly; fallback below.
      const inboxQuery = `from:(${fromClause}) in:inbox`
      let listRes = await client.gmail.users.messages.list({
        userId: 'me',
        q: inboxQuery,
        maxResults,
      })
      let messageRefs = listRes.data.messages ?? []
      let queryUsed: 'inbox' | 'relaxed' = 'inbox'

      if (messageRefs.length === 0) {
        // Incoming mail not tagged as inbox in search; exclude obvious non-inbound folders.
        const relaxedQuery = `from:(${fromClause}) -in:sent -in:drafts -in:trash -in:spam`
        listRes = await client.gmail.users.messages.list({
          userId: 'me',
          q: relaxedQuery,
          maxResults,
        })
        messageRefs = listRes.data.messages ?? []
        queryUsed = 'relaxed'
      }

      const listTotal = messageRefs.length
      if (messageRefs.length === 0) {
        return { messages: [], listTotal: 0, queryUsed }
      }

      // Batch fetches avoid Vercel timeouts and Gmail rate spikes vs one huge Promise.all.
      const messages = await mapInBatches(messageRefs, 12, async (ref) => {
        try {
          const msg = await client.gmail.users.messages.get({
            userId: 'me',
            id: ref.id!,
            format: 'full',
          })

          const headers: Record<string, string> = {}
          for (const h of msg.data.payload?.headers ?? []) {
            headers[h.name!.toLowerCase()] = h.value ?? ''
          }

          const from = parseAddress(headers.from ?? '')

          // Skip messages where we are the sender (self-loop / echo prevention)
          if (from.email.toLowerCase() === my) return null

          const toRaw = headers.to ?? myEmail
          const toEmail = parseAddress(toRaw).email || toRaw
          const subject = headers.subject ?? '(no subject)'
          const inReplyTo = headers['in-reply-to'] || null
          const dateMs = parseInt(msg.data.internalDate ?? '0', 10)
          const receivedAt = new Date(dateMs)
          const { text, html } = extractBody(msg.data.payload)

          return {
            gmailId: msg.data.id!,
            threadId: msg.data.threadId ?? '',
            fromName: from.name,
            fromEmail: from.email,
            toEmail,
            subject,
            bodyText: text,
            bodyHtml: html,
            snippet: msg.data.snippet ?? '',
            inReplyTo,
            receivedAt,
          } satisfies GmailMessage
        } catch {
          return null
        }
      })

      return {
        messages: messages.filter((m): m is GmailMessage => m !== null),
        listTotal,
        queryUsed,
      }
    } catch (err) {
      lastError = err
      if (!(client.source === 'db' && isInvalidGrant(err))) {
        throw err
      }
    }
  }

  if (lastError) throw lastError
  return {
    messages: [],
    listTotal: 0,
    queryUsed: 'inbox',
  }
}
