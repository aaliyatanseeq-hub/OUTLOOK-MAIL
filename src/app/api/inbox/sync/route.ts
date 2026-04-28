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

    const recentSends = await prisma.sentEmail.findMany({
      where: { status: { not: 'failed' } },
      select: { toEmail: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const seen = new Set<string>()
    const queryRecipients: string[] = []
    for (const row of recentSends) {
      const e = row.toEmail.toLowerCase().trim()
      if (!e || e === myEmail || seen.has(e)) continue
      seen.add(e)
      queryRecipients.push(e)
      if (queryRecipients.length >= 50) break
    }

    // Clean up any previously stored emails from non-history contacts
    const { count: cleaned } = await prisma.inboundEmail.deleteMany({
      where: {
        fromEmail: { notIn: allowList, mode: 'insensitive' },
      },
    })

    // Fetch inbox messages from the recent-recipient subset (Gmail query cap)
    const messages = await fetchRepliesFromRecipients(queryRecipients, myEmail, 100)

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
    })
  } catch (err: any) {
    console.error('[inbox/sync]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Sync failed' },
      { status: 500 },
    )
  }
}
