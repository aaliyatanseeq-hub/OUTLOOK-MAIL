export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchRepliesFromRecipients } from '@/lib/gmail-reader'
import { getGoogleInboxEmail } from '@/lib/google-oauth'

function getSyncErrorMeta(err: unknown): {
  message: string
  providerError: string
  providerDescription: string
  status?: number
  code?: number | string
} {
  const e = err as {
    message?: string
    code?: number | string
    status?: number
    response?: { data?: { error?: string; error_description?: string }; status?: number }
  }

  return {
    message: e?.message ?? 'Sync failed',
    providerError: e?.response?.data?.error ?? '',
    providerDescription: e?.response?.data?.error_description ?? '',
    status: e?.response?.status ?? e?.status,
    code: e?.code,
  }
}

function formatSyncError(err: unknown): string {
  const meta = getSyncErrorMeta(err)
  const providerError = meta.providerError
  const providerDescription = meta.providerDescription
  const baseMessage = meta.message

  if (providerError === 'invalid_grant' || baseMessage === 'invalid_grant') {
    return [
      'Google inbox authorization expired or was revoked.',
      'Reconnect Gmail from Settings -> Gmail Inbox OAuth,',
      'or update GOOGLE_REFRESH_TOKEN and redeploy.',
    ].join(' ')
  }

  return providerDescription || baseMessage
}

// POST /api/inbox/sync
// Only fetches Gmail messages FROM people we have previously emailed, not the whole inbox.
export async function POST() {
  try {
    const myEmail = await getGoogleInboxEmail()

    // Full allow-list: everyone we have successfully emailed (for cleanup + UI consistency).
    // Gmail search supports limited from:(a OR b ...) length, so we query the 50
    // most recently interacted recipients rather than arbitrary DB order.
    const allRecipients = await prisma.sentEmail.findMany({
      where: { status: { not: 'failed' } },
      select: { toEmail: true },
      distinct: ['toEmail'],
    })

    const allowList = allRecipients
      .map((r) => r.toEmail.toLowerCase().trim())
      .filter((e) => e && e !== myEmail)

    if (allowList.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: 0,
        message: 'No sent emails found to match replies against.',
      })
    }

    // 50 addresses we most recently emailed (based on max sent row per recipient).
    const grouped = await prisma.sentEmail.groupBy({
      by: ['toEmail'],
      where: { status: { not: 'failed' } },
      _max: { createdAt: true },
    })

    const queryRecipients = grouped
      .map((g) => ({
        email: g.toEmail.toLowerCase().trim(),
        lastAt: g._max.createdAt?.getTime() ?? 0,
      }))
      .filter((g) => g.email && g.email !== myEmail)
      .sort((a, b) => b.lastAt - a.lastAt)
      .slice(0, 50)
      .map((g) => g.email)

    // Remove previously stored inbound messages from non-history contacts.
    const { count: cleaned } = await prisma.inboundEmail.deleteMany({
      where: {
        fromEmail: { notIn: allowList, mode: 'insensitive' },
      },
    })

    const { messages, listTotal, queryUsed } = await fetchRepliesFromRecipients(
      queryRecipients,
      myEmail,
      100,
    )

    let created = 0
    let skipped = 0

    for (const msg of messages) {
      const existing = await prisma.inboundEmail.findUnique({
        where: { gmailId: msg.gmailId },
      })
      if (existing) {
        skipped++
        continue
      }

      // Link to the most recent outbound SentEmail sent TO this person,
      // BUT only if the message has an In-Reply-To header (genuine reply).
      // Fresh messages from the same contact are stored as standalone (sentEmailId: null).
      let matchId: string | null = null
      if (msg.inReplyTo) {
        const match = await prisma.sentEmail.findFirst({
          where: { toEmail: { equals: msg.fromEmail, mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
        })
        matchId = match?.id ?? null
      }

      await prisma.inboundEmail.create({
        data: {
          gmailId: msg.gmailId,
          threadId: msg.threadId,
          fromName: msg.fromName,
          fromEmail: msg.fromEmail,
          toEmail: msg.toEmail,
          subject: msg.subject,
          bodyText: msg.bodyText || null,
          bodyHtml: msg.bodyHtml || null,
          snippet: msg.snippet || null,
          receivedAt: msg.receivedAt,
          sentEmailId: matchId,
        },
      })
      created++
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      cleaned,
      checkedRecipients: queryRecipients.length,
      allowListSize: allowList.length,
      gmailListTotal: listTotal,
      gmailQueryUsed: queryUsed,
      mailboxHint: myEmail ? `${myEmail.slice(0, 3)}...@${myEmail.split('@')[1] ?? '?'}` : 'missing',
      queryRecipientsSample: queryRecipients.slice(0, 8),
    })
  } catch (err: unknown) {
    const meta = getSyncErrorMeta(err)
    console.error('[inbox/sync]', {
      message: meta.message,
      providerError: meta.providerError,
      providerDescription: meta.providerDescription,
      status: meta.status,
      code: meta.code,
    })
    return NextResponse.json(
      { error: formatSyncError(err) },
      { status: 500 },
    )
  }
}
