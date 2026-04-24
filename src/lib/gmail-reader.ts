import { google } from 'googleapis'

// Build an authenticated Gmail API client using stored OAuth2 refresh token
function getGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: oauth2 })
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
  inReplyTo: string | null   // the Message-ID this email is replying to
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
export async function fetchRepliesFromRecipients(
  recipientEmails: string[],
  myEmail: string,
  maxResults = 100,
): Promise<GmailMessage[]> {
  if (recipientEmails.length === 0) return []

  const gmail = getGmailClient()

  // Build Gmail search query: only messages FROM our recipients
  // Gmail "from:" operator supports OR with spaces inside parens
  const fromClause = recipientEmails
    .slice(0, 50)                         // Gmail query has length limits
    .map(e => e.toLowerCase().trim())
    .join(' OR ')
  const query = `from:(${fromClause}) in:inbox`

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  })

  const messageRefs = listRes.data.messages ?? []
  if (messageRefs.length === 0) return []

  // Fetch full message details in parallel (batch of up to maxResults)
  const messages = await Promise.all(
    messageRefs.map(async (ref) => {
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: ref.id!,
          format: 'full',
        })

        const headers: Record<string, string> = {}
        for (const h of msg.data.payload?.headers ?? []) {
          headers[h.name!.toLowerCase()] = h.value ?? ''
        }

        const from = parseAddress(headers['from'] ?? '')

        // Skip messages where we are the sender (self-loop / echo prevention)
        if (from.email.toLowerCase() === myEmail.toLowerCase()) return null

        const toRaw = headers['to'] ?? myEmail
        const toEmail = parseAddress(toRaw).email || toRaw
        const subject = headers['subject'] ?? '(no subject)'
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
    }),
  )

  return messages.filter((m): m is GmailMessage => m !== null)
}
