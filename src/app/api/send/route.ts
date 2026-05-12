export const dynamic = 'force-dynamic'

import crypto from 'node:crypto'
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

  // Generate a unique token for the response form link
  const responseToken = crypto.randomBytes(32).toString('hex')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  const responseLink = `${appUrl}/respond/${responseToken}`

  const renderedSubject = renderTemplate(subject, { name: toName.trim(), email: toEmail.trim() })
  const renderedBody    = renderTemplate(bodyTemplate, { name: toName.trim(), email: toEmail.trim(), responseLink })

  const signature = `
<br/>
<table cellpadding="0" cellspacing="0" width="560" style="font-family:Arial,sans-serif;">
  <!-- Main signature row -->
  <tr>
    <td colspan="3" style="padding-bottom:10px;border-bottom:2px solid #c8a94a;">&nbsp;</td>
  </tr>
  <tr>
    <!-- Name -->
    <td style="width:130px;vertical-align:middle;border-right:1px solid #cccccc;padding:10px 16px 10px 0;">
      <p style="margin:0;font-weight:bold;font-size:13px;color:#1a1a2e;">HR Department</p>
    </td>
    <!-- Logo -->
    <td style="width:160px;text-align:center;vertical-align:middle;padding:10px 16px;border-right:1px solid #cccccc;">
      <img src="http://tanseeqinvestment.com/wp-content/uploads/2019/08/tanseeq-investment_logo-tt-01.png"
           alt="Tanseeq Investment" width="120" style="display:block;margin:0 auto;" />
    </td>
    <!-- Company Details -->
    <td style="padding:10px 0 10px 16px;vertical-align:middle;font-size:12px;color:#444444;line-height:1.8;">
      <p style="margin:0;font-weight:bold;font-size:13px;color:#1a1a2e;">Tanseeq Investment LLC</p>
      <p style="margin:0;">P O Box: 3151, Dubai, UAE</p>
      <p style="margin:0;"><a href="mailto:hr-notify@tanseeqinvestment.com" style="color:#c8a94a;text-decoration:none;">hr-notify@tanseeqinvestment.com</a></p>
      <p style="margin:0;"><a href="http://www.tanseeqinvestment.com" style="color:#c8a94a;text-decoration:none;">www.tanseeqinvestment.com</a></p>
    </td>
  </tr>
  <!-- Tagline -->
  <tr>
    <td colspan="3" style="text-align:center;padding:8px 0;border-top:1px solid #e0c97a;border-bottom:1px solid #e0c97a;font-size:12px;color:#c8a94a;letter-spacing:2px;font-style:italic;">
      ~&nbsp;&nbsp;In Pursuit of Excellence&nbsp;&nbsp;~
    </td>
  </tr>
  <!-- 25 Years Banner -->
  <tr>
    <td colspan="3" style="padding-top:8px;">
      <img src="${appUrl}/25years-banner.png" alt="Celebrating 25 Years of Excellence" width="560" style="display:block;width:100%;max-width:560px;" />
    </td>
  </tr>
</table>`

  const finalBody = renderedBody + signature

  // Resolve sender: DB settings → env vars
  const sender = await getSenderConfig()
  const from   = formatFrom(sender.name, sender.email)

  const [provider, providerId] = await Promise.all([getEmailProvider(), getEmailProviderId()])

  const result = await provider.sendEmail({
    to:      toEmail.trim(),
    from,
    subject: renderedSubject,
    html:    finalBody,
  })

  const sent = await prisma.sentEmail.create({
    data: {
      templateId:        tplId,
      toName:            toName.trim(),
      toEmail:           toEmail.trim(),
      replyTo:           null,
      subject:           renderedSubject,
      body:              finalBody,
      provider:          providerId,
      providerMessageId: result.messageId || null,
      responseToken,
      status:            result.success ? 'sent' : 'failed',
      sentAt:            result.success ? new Date() : null,
      failedAt:          result.success ? null : new Date(),
      errorMessage:      result.error || null,
    },
  })

  return NextResponse.json({ success: result.success, id: sent.id, error: result.error || null })
}
