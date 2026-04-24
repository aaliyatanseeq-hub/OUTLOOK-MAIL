import { prisma } from '@/lib/prisma'
import InboxClient from '@/components/inbox/inbox-client'
import { InboxIcon, MailIcon, MailOpenIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const [total, unread] = await Promise.all([
    prisma.inboundEmail.count(),
    prisma.inboundEmail.count({ where: { isRead: false } }),
  ])

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Inbox</h1>
          <p className="text-sm text-slate-400 mt-0.5">Replies from people you emailed — click Sync to fetch latest</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-semibold text-slate-200">{total}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Unread</p>
            <p className="text-lg font-semibold text-violet-400">{unread}</p>
          </div>
        </div>
      </div>

      {/* Inbox client (list + detail) */}
      <InboxClient />
    </div>
  )
}
