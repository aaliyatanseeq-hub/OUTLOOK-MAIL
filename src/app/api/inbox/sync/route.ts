export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchRepliesFromRecipients } from '@/lib/gmail-reader'

// POST /api/inbox/sync
// Only fetches Gmail messages FROM people we have previously emailed — not the whole inbox.
export async function POST() {
  try {
    const myEmail = (
      process.env.GOOGLE_INBOX_EMAIL ||
      process.env.SMTP_USER ||
      ''
    ).toLowerCase().trim()

    // Full allow-list: everyone we have successfully emailed (for cleanup + UI consistency).
    // Gmail search only supports a limited `from:(a OR b OR …)` length, so we query the 50
    // most *recently* interacted recipients — not an arbitrary DB order (fixes missing new mail).
    const allRecipients = await prisma.sentEmail.findMany({
      where: { status: { not: 'failed' } },
      select: { toEmail: true },
      distinct: ['toEmail'],
    })

    const allowList = allRecipients
      .map(r => r.toEmail.toLowerCase().trim())
      .filter(e => e && e !== myEmail)

    if (allowList.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: 0,
        message: 'No sent emails found to match replies against.',
      })
    }

    // 50 addresses we most recently emailed (by last SentEmail row per recipient).
    // Scanning only the last N send *rows* can miss people if those rows repeat the same few recipients.
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

    // Clean up any previously stored emails from non-history contacts
    const { count: cleaned } = await prisma.inboundEmail.deleteMany({
      where: {
        fromEmail: { notIn: allowList, mode: 'insensitive' },
      },
    })

    // Fetch inbox messages from the recent-recipient subset (Gmail query cap)
    const { messages, listTotal, queryUsed } = await fetchRepliesFromRecipients(
      queryRecipients,
      myEmail,
      100,
    )

    let created = 0
    let skipped = 0

    for (const msg of messages) {
      // Skip if already stored (deduplication by Gmail message ID)
      const existing = await prisma.inboundEmail.findUnique({
        where: { gmailId: msg.gmailId },
      })
      if (existing) { skipped++; continue }

      // Link to the most recent outbound SentEmail sent TO this person
      const match = await prisma.sentEmail.findFirst({
        where: { toEmail: { equals: msg.fromEmail, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
      })

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
          sentEmailId: match?.id ?? null,
        },
      })
      created++
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      cleaned,
      /** Addresses included in the Gmail `from:(…)` search (max 50, most recent sends first). */
      checkedRecipients: queryRecipients.length,
      /** Total successful-send recipients in DB (allow-list size). */
      allowListSize: allowList.length,
      /** Gmail list() hits before per-message download (0 = no matching threads for this query). */
      gmailListTotal: listTotal,
      /** inbox = `in:inbox` search; relaxed = fallback without inbox (still excludes sent/drafts/trash/spam). */
      gmailQueryUsed: queryUsed,
      /**
       * Which mailbox we treat as “us” for self-send skip + env resolution.
       * Set GOOGLE_INBOX_EMAIL on Vercel to the same account as the Gmail OAuth token.
       */
      mailboxHint: myEmail
        ? `${myEmail.slice(0, 3)}…@${myEmail.split('@')[1] ?? '?'}`
        : 'missing — set GOOGLE_INBOX_EMAIL or SMTP_USER',
      /** First few query addresses (lowercase) — verify the sender you expect is in History `to` list. */
      queryRecipientsSample: queryRecipients.slice(0, 8),
    })
  } catch (err: any) {
    console.error('[inbox/sync]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Sync failed' },
      { status: 500 },
    )
  }
}
