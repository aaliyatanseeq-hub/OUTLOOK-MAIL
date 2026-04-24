import { prisma } from '@/lib/prisma'
import { HistoryTable } from '@/components/history/history-table'
import { MailIcon } from 'lucide-react'

export default async function HistoryPage() {
  const emails = await prisma.sentEmail.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { template: { select: { name: true } } },
  })

  const stats = {
    total: emails.length,
    sent: emails.filter((e) => e.status === 'sent').length,
    failed: emails.filter((e) => e.status === 'failed').length,
    delivered: emails.filter((e) => e.status === 'delivered').length,
    opened: emails.filter((e) => e.status === 'opened').length,
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Email History</h1>
        <p className="page-subtitle">All transactional emails sent from this app.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total',     value: stats.total,     color: '' },
          { label: 'Sent',      value: stats.sent,      color: 'text-blue-500'   },
          { label: 'Delivered', value: stats.delivered, color: 'text-emerald-600' },
          { label: 'Opened',    value: stats.opened,    color: 'text-amber-600'  },
          { label: 'Failed',    value: stats.failed,    color: 'text-rose-600'   },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {emails.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <MailIcon className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400">No emails sent yet.</p>
          <a href="/send" className="button-primary inline-flex">Send your first email</a>
        </div>
      ) : (
        <div className="card">
          <HistoryTable emails={emails} />
        </div>
      )}
    </div>
  )
}
