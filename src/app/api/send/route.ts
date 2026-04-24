import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmailProvider, getEmailProviderId } from '@/lib/email/get-email-provider'
import { getSenderConfig, formatFrom } from '@/lib/email/from-address'
import { renderTemplate } from '@/lib/template'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { templateId, toName, toEmail, customSubject, customBody } = body

  if (!toEmail?.trim() || !toName?.trim()) {
    return NextResponse.json({ error: 'toName and toEmail are required' }, { status: 400 })
  }

  let subject      = customSubject?.trim()
  let bodyTemplate = customBody?.trim()
  let tplId: string | null = templateId || null

  if (templateId) {
    const tpl = await prisma.template.findUnique({ where: { id: templateId } })
    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    subject      = subject      || tpl.subject
    bodyTemplate = bodyTemplate || tpl.bodyTemplate
    tplId        = tpl.id
  }

  if (!subject || !bodyTemplate) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 })
  }

  const renderedSubject = renderTemplate(subject,      { name: toName.trim(), email: toEmail.trim() })
  const renderedBody    = renderTemplate(bodyTemplate, { name: toName.trim(), email: toEmail.trim() })

  // Resolve sender: DB settings → env vars
  const sender = await getSenderConfig()
  const from   = formatFrom(sender.name, sender.email)

  const [provider, providerId] = await Promise.all([getEmailProvider(), getEmailProviderId()])

  const result = await provider.sendEmail({
    to:      toEmail.trim(),
    from,
    subject: renderedSubject,
    html:    renderedBody,
  })

  const sent = await prisma.sentEmail.create({
    data: {
      templateId:        tplId,
      toName:            toName.trim(),
      toEmail:           toEmail.trim(),
      replyTo:           null,
      subject:           renderedSubject,
      body:              renderedBody,
      provider:          providerId,
      providerMessageId: result.messageId || null,
      status:            result.success ? 'sent' : 'failed',
      sentAt:            result.success ? new Date() : null,
      failedAt:          result.success ? null : new Date(),
      errorMessage:      result.error || null,
    },
  })

  return NextResponse.json({ success: result.success, id: sent.id, error: result.error || null })
}
