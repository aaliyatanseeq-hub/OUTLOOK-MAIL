'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface SentEmail {
  id: string
  toName: string
  toEmail: string
  subject: string
  status: string
  provider: string
  sentAt: Date | null
  failedAt: Date | null
  deliveredAt: Date | null
  openedAt: Date | null
  errorMessage: string | null
  template: { name: string } | null
}

const STATUS = {
  sent:      { label: 'Sent',      cls: 'badge-status-sent' },
  delivered: { label: 'Delivered', cls: 'badge-status-delivered' },
  opened:    { label: 'Opened',    cls: 'badge-status-opened' },
  clicked:   { label: 'Clicked',   cls: 'badge-status-delivered' },
  bounced:   { label: 'Bounced',   cls: 'badge-status-failed' },
  failed:    { label: 'Failed',    cls: 'badge-status-failed' },
}

export function HistoryTable({ emails }: { emails: SentEmail[] }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return emails.filter((e) => {
      const matchStatus = filter === 'all' || e.status === filter
      const q = search.toLowerCase()
      const matchSearch = !q || e.toName.toLowerCase().includes(q) || e.toEmail.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [emails, filter, search])

  const counts = useMemo(() => ({
    all: emails.length,
    sent: emails.filter(e => e.status === 'sent').length,
    delivered: emails.filter(e => e.status === 'delivered').length,
    opened: emails.filter(e => e.status === 'opened').length,
    failed: emails.filter(e => e.status === 'failed').length,
  }), [emails])

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="input flex-1"
          placeholder="Search by name, email, subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'sent', 'delivered', 'opened', 'failed'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors capitalize ${
                filter === s
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}>
              {s} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['Recipient', 'Subject', 'Template', 'Status', 'Sent', 'Note'].map((h) => (
                <th key={h} className="text-left py-3 px-3 text-xs uppercase tracking-wide font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-500">No emails match this filter.</td></tr>
            ) : filtered.map((e) => {
              const s = STATUS[e.status as keyof typeof STATUS] || STATUS.sent
              const time = e.sentAt || e.failedAt
              return (
                <tr key={e.id} className="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-3">
                    <p className="text-slate-200 font-medium">{e.toName}</p>
                    <p className="text-slate-500 text-xs">{e.toEmail}</p>
                  </td>
                  <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{e.subject}</td>
                  <td className="py-3 px-3 text-slate-500 text-xs">{e.template?.name || '—'}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${s.cls}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-xs whitespace-nowrap">
                    {time ? formatDistanceToNow(new Date(time), { addSuffix: true }) : '—'}
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-xs max-w-xs truncate">
                    {e.errorMessage || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
