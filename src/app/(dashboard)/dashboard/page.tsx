import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { SendIcon, HistoryIcon, PlusIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function DashboardPage() {
  const [totalEmails, templates, recentEmails] = await Promise.all([
    prisma.sentEmail.count(),
    prisma.template.count(),
    prisma.sentEmail.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { template: { select: { name: true } } },
    }),
  ])

  const [sent, delivered, opened, failed] = await Promise.all([
    prisma.sentEmail.count({ where: { status: 'sent' } }),
    prisma.sentEmail.count({ where: { status: 'delivered' } }),
    prisma.sentEmail.count({ where: { status: 'opened' } }),
    prisma.sentEmail.count({ where: { status: 'failed' } }),
  ])

  const STATUS_CLS: Record<string, string> = {
    sent:      'badge-status-sent',
    delivered: 'badge-status-delivered',
    opened:    'badge-status-opened',
    failed:    'badge-status-failed',
  }

  return (
    <div className="page-shell">
      <div className="flex items-start justify-between">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Transactional email overview.</p>
        </div>
        <Link href="/send" className="button-primary">
          <SendIcon className="w-4 h-4" />
          Send Email
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Sent', value: totalEmails, color: '' },
          { label: 'In Transit', value: sent,        color: 'text-blue-500'    },
          { label: 'Delivered',  value: delivered,   color: 'text-emerald-600' },
          { label: 'Opened',     value: opened,      color: 'text-amber-600'   },
          { label: 'Failed',     value: failed,      color: 'text-rose-600'    },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/send" className="card flex items-center gap-4 hover:border-indigo-400/40 hover:bg-indigo-500/5 transition-colors group">
          <div className="w-10 h-10 rounded-md bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center shrink-0">
            <SendIcon className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm group-hover:text-indigo-200 transition-colors">Send Email</p>
            <p className="text-xs text-slate-500">Compose and send to one recipient</p>
          </div>
        </Link>
        <Link href="/templates/new" className="card flex items-center gap-4 hover:border-slate-600 transition-colors group">
          <div className="w-10 h-10 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <PlusIcon className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">New Template</p>
            <p className="text-xs text-slate-500">{templates} template{templates !== 1 ? 's' : ''} saved</p>
          </div>
        </Link>
        <Link href="/history" className="card flex items-center gap-4 hover:border-slate-600 transition-colors group">
          <div className="w-10 h-10 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <HistoryIcon className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Email History</p>
            <p className="text-xs text-slate-500">{totalEmails} email{totalEmails !== 1 ? 's' : ''} sent</p>
          </div>
        </Link>
      </div>

      {/* Recent emails */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Recent Emails</h2>
          <Link href="/history" className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors">View all →</Link>
        </div>
        {recentEmails.length === 0 ? (
          <div className="card text-center py-12 space-y-3">
            <p className="text-slate-400">No emails sent yet.</p>
            <Link href="/send" className="button-primary inline-flex">Send your first email</Link>
          </div>
        ) : (
          <div className="card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Recipient', 'Subject', 'Template', 'Status', 'Sent'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs uppercase tracking-wide font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentEmails.map((e) => {
                  const cls = STATUS_CLS[e.status] || STATUS_CLS.sent
                  const time = e.sentAt || e.failedAt
                  return (
                    <tr key={e.id} className="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4">
                        <p className="text-slate-200">{e.toName}</p>
                        <p className="text-slate-500 text-xs">{e.toEmail}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{e.subject}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{e.template?.name || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border capitalize ${cls}`}>{e.status}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {time ? formatDistanceToNow(new Date(time), { addSuffix: true }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
