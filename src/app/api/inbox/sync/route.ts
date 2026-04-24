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

    // Collect every unique email address we have ever sent to
    const sentRows = await prisma.sentEmail.findMany({
      where: { status: { not: 'failed' } },
      select: { toEmail: true },
      distinct: ['toEmail'],
    })

    const recipientEmails = sentRows
      .map(r => r.toEmail.toLowerCase().trim())
      .filter(e => e && e !== myEmail)    // exclude ourselves

    if (recipientEmails.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: 0,
        message: 'No sent emails found to match replies against.',
      })
    }

    // Clean up any previously stored emails from non-history contacts
    const { count: cleaned } = await prisma.inboundEmail.deleteMany({
      where: {
        fromEmail: { notIn: recipientEmails, mode: 'insensitive' },
      },
    })

    // Fetch only messages from those recipients
    const messages = await fetchRepliesFromRecipients(recipientEmails, myEmail, 100)

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
      checkedRecipients: recipientEmails.length,
    })
  } catch (err: any) {
    console.error('[inbox/sync]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Sync failed' },
      { status: 500 },
    )
  }
}
