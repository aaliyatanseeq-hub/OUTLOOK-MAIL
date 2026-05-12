/**
 * Reads inbox messages from Microsoft 365 via the Microsoft Graph API.
 */

import { graphGet, getAzureMailbox, type GraphMessage } from './microsoft-graph'

export interface OutlookMessage {
  /** Graph message ID — used as unique key for deduplication */
  messageId: string
  /** Conversation/thread ID */
  conversationId: string | null
  fromName: string
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string | null
  bodyHtml: string | null
  snippet: string
  receivedAt: Date
  /** Value of In-Reply-To internet message header (present only for genuine replies) */
  inReplyTo: string | null
}

export interface FetchOutlookResult {
  messages: OutlookMessage[]
  totalFetched: number
}

interface GraphMessageList {
  value: GraphMessage[]
  '@odata.nextLink'?: string
}

/**
 * Fetch messages from the Outlook inbox that were sent FROM any of the given recipient emails.
 * Filters out messages sent by the mailbox itself (self-loop prevention).
 */
export async function fetchOutlookReplies(
  recipientEmails: string[],
  maxResults = 100,
): Promise<FetchOutlookResult> {
  if (recipientEmails.length === 0) {
    return { messages: [], totalFetched: 0 }
  }

  const mailbox = getAzureMailbox()
  if (!mailbox) {
    throw new Error('No mailbox configured. Set AZURE_INBOX_EMAIL or MAIL_FROM_ADDRESS in env.')
  }

  const myEmail = mailbox.toLowerCase().trim()

  // Graph API does not support complex OR filters on from/emailAddress/address
  // combined with $orderby. Instead: fetch recent inbox messages and filter in code.
  const allowSet = new Set(recipientEmails.map((e) => e.toLowerCase().trim()))

  const select = [
    'id',
    'internetMessageId',
    'conversationId',
    'subject',
    'bodyPreview',
    'receivedDateTime',
    'isRead',
    'body',
    'from',
    'toRecipients',
    'internetMessageHeaders',
  ].join(',')

  const path =
    `/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages` +
    `?$select=${encodeURIComponent(select)}` +
    `&$orderby=${encodeURIComponent('receivedDateTime desc')}` +
    `&$top=${Math.min(maxResults, 100)}`

  const data = await graphGet<GraphMessageList>(path)
  const rawMessages = data.value ?? []

  const messages: OutlookMessage[] = []

  for (const msg of rawMessages) {
    const fromEmail = msg.from?.emailAddress?.address?.toLowerCase().trim() ?? ''
    const fromName = msg.from?.emailAddress?.name ?? fromEmail

    // Skip self-sent messages
    if (fromEmail === myEmail) continue

    // Only keep messages from known contacts (history recipients)
    if (!allowSet.has(fromEmail)) continue

    const toEmail =
      msg.toRecipients?.[0]?.emailAddress?.address?.toLowerCase().trim() ?? myEmail

    // Extract In-Reply-To from internet message headers
    let inReplyTo: string | null = null
    if (msg.internetMessageHeaders) {
      const h = msg.internetMessageHeaders.find(
        (h) => h.name.toLowerCase() === 'in-reply-to'
      )
      inReplyTo = h?.value ?? null
    }

    const bodyHtml =
      msg.body?.contentType?.toLowerCase() === 'html' ? msg.body.content : null
    const bodyText =
      msg.body?.contentType?.toLowerCase() === 'text' ? msg.body.content : null

    messages.push({
      messageId: msg.id,
      conversationId: msg.conversationId ?? null,
      fromName,
      fromEmail,
      toEmail,
      subject: msg.subject ?? '(no subject)',
      bodyHtml,
      bodyText,
      snippet: msg.bodyPreview ?? '',
      receivedAt: new Date(msg.receivedDateTime),
      inReplyTo,
    })
  }

  return { messages, totalFetched: rawMessages.length }
}
