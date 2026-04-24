import { prisma } from '@/lib/prisma'
import { SendEmailForm } from '@/components/send/send-email-form'
import { getSenderConfig, formatFrom } from '@/lib/email/from-address'

export const dynamic = 'force-dynamic'

export default async function SendPage({
  searchParams,
}: {
  searchParams: { templateId?: string }
}) {
  const [templates, sender] = await Promise.all([
    prisma.template.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, subject: true, bodyTemplate: true, senderName: true, senderEmail: true },
    }),
    getSenderConfig(),
  ])

  const fromAddress = formatFrom(sender.name, sender.email)

  return (
    <div className="page-shell max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Send Email</h1>
        <p className="page-subtitle">Send a transactional email to one recipient.</p>
      </div>
      <SendEmailForm templates={templates} defaultTemplateId={searchParams.templateId} fromAddress={fromAddress} />
    </div>
  )
}
