export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchOutlookReplies } from '@/lib/outlook-reader'
import { getAzureMailbox, isAzureConfigured } from '@/lib/microsoft-graph'
import { parseEmployeeReply } from '@/lib/reply-parser'

function formatSyncError(err: unknown): string {
  const e = err as { message?: string }
  const msg = e?.message ?? 'Sync failed'

  if (msg.includes('401') || msg.includes('InvalidAuthenticationToken')) {
    return 'Azure authentication failed. Check AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.'
  }
  if (msg.includes('403') || msg.includes('Forbidden')) {
    return 'Graph API access denied. Ensure Mail.Read permission is granted with admin consent in Azure Portal.'
  }
  if (msg.includes('mailbox') || msg.includes('AZURE_INBOX_EMAIL')) {
    return 'No mailbox configured. Set AZURE_INBOX_EMAIL or MAIL_FROM_ADDRESS in env.'
  }
  return msg
}

// POST /api/inbox/sync
// Fetches Outlook inbox messages FROM people we have previously emailed.
export async function POST() {
  try {
    if (!isAzureConfigured()) {
      return NextResponse.json(
        { error: 'Azure credentials not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.' },
        { status: 503 },
      )
    }

    const myEmail = getAzureMailbox().toLowerCase().trim()

    // Full allow-list: everyone we have successfully emailed.
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

    // 50 most recently emailed unique recipients for the Graph query.
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

    // Remove previously stored messages from non-history contacts.
    const { count: cleaned } = await prisma.inboundEmail.deleteMany({
      where: {
        fromEmail: { notIn: allowList, mode: 'insensitive' },
      },
    })

    const { messages, totalFetched } = await fetchOutlookReplies(queryRecipients, 100)

    let created = 0
    let skipped = 0

    for (const msg of messages) {
      // Deduplicate by Outlook message ID
      const existing = await prisma.inboundEmail.findUnique({
        where: { messageId: msg.messageId },
      })
      if (existing) {
        skipped++
        continue
      }

      // Link to most recent outbound SentEmail only for genuine replies (has In-Reply-To header).
      let matchId: string | null = null
      if (msg.inReplyTo) {
        const match = await prisma.sentEmail.findFirst({
          where: { toEmail: { equals: msg.fromEmail, mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
        })
        matchId = match?.id ?? null
      }

      const inbound = await prisma.inboundEmail.create({
        data: {
          messageId: msg.messageId,
          threadId: msg.conversationId,
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

      // Try to parse as structured employee response (if body contains the template fields)
      const rawText = msg.bodyText || msg.snippet || ''
      if (rawText && /EMPLOYEE\s*ID|WORK\s*PHONE|PERSONAL\s*(PHONE|NUMBER|MOBILE)/i.test(rawText)) {
        // Only create one response per employee email
        const alreadyParsed = await prisma.employeeResponse.findFirst({
          where: { fromEmail: { equals: msg.fromEmail, mode: 'insensitive' } },
        })
        if (!alreadyParsed) {
          const parsed = parseEmployeeReply(rawText)
          await prisma.employeeResponse.create({
            data: {
              inboundEmailId: inbound.id,
              fromEmail: msg.fromEmail,
              fromName: msg.fromName,
              employeeId: parsed.employeeId,
              workPhone: parsed.workPhone,
              personalPhone: parsed.personalPhone,
              rawText,
              parsedOk: parsed.parsedOk,
              receivedAt: msg.receivedAt,
            },
          })
        }
      }

      created++
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      cleaned,
      checkedRecipients: queryRecipients.length,
      allowListSize: allowList.length,
      outlookTotal: totalFetched,
      mailboxHint: myEmail ? `${myEmail.slice(0, 4)}...@${myEmail.split('@')[1] ?? '?'}` : 'missing',
    })
  } catch (err: unknown) {
    console.error('[inbox/sync]', err)
    return NextResponse.json(
      { error: formatSyncError(err) },
      { status: 500 },
    )
  }
}
