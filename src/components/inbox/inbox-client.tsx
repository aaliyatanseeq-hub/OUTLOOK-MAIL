'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  InboxIcon,
  RefreshCwIcon,
  SearchIcon,
  MailOpenIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  LinkIcon,
  ClockIcon,
  UserIcon,
  XIcon,
  BellIcon,
} from 'lucide-react'
import { EmailFrame } from '@/components/ui/email-frame'

// Auto-sync interval: every 2 minutes
const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000

interface SentEmailRef {
  id: string
  toName: string
  toEmail: string
  subject: string
  body?: string
  sentAt: string | null
  template?: { name: string } | null
}

interface InboundEmail {
  id: string
  gmailId: string
  threadId: string | null
  sentEmailId: string | null
  fromName: string
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string | null
  bodyHtml: string | null
  snippet: string | null
  isRead: boolean
  receivedAt: string
  sentEmail: SentEmailRef | null
}

interface ListResponse {
  emails: InboundEmail[]
  total: number
  page: number
  pageSize: number
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffH = (now.getTime() - d.getTime()) / 3600000
  if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffH < 48) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function Avatar({ name, email }: { name: string; email: string }) {
  const letter = (name || email || '?')[0].toUpperCase()
  const colors = ['bg-violet-600', 'bg-blue-600', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-600']
  const idx = email.charCodeAt(0) % colors.length
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${colors[idx]}`}>
      {letter}
    </div>
  )
}

export default function InboxClient() {
  const [emails, setEmails] = useState<InboundEmail[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<InboundEmail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const [nextSyncIn, setNextSyncIn] = useState(AUTO_SYNC_INTERVAL_MS / 1000)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageSize = 20

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [])

  const fetchEmails = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      if (unreadOnly) params.set('unread', 'true')
      if (search) params.set('search', search)
      const res = await fetch(`/api/inbox?${params}`)
      const data: ListResponse = await res.json()
      setEmails(data.emails)
      setTotal(data.total)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }, [search, unreadOnly])

  useEffect(() => {
    fetchEmails(1)
  }, [fetchEmails])

  // Core sync logic — shared by manual button and auto-sync
  const runSync = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true)
    try {
      const res = await fetch('/api/inbox/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        if (!silent) showToast(`Sync error: ${data.error}`, 'error')
        return
      }
      if (data.checkedRecipients === 0) {
        if (!silent) showToast('No sent emails yet — send some first.', 'info')
        return
      }
      if (data.created > 0) {
        // New replies arrived — always show notification even in silent mode
        showToast(
          `${data.created} new repl${data.created === 1 ? 'y' : 'ies'} received!`,
          'success'
        )
        fetchEmails(1)
      } else if (!silent) {
        showToast(`No new replies from ${data.checkedRecipients} contacts`, 'info')
      }
    } finally {
      if (!silent) setSyncing(false)
    }
  }, [fetchEmails, showToast])

  // Manual sync button
  const handleSync = () => {
    setSyncing(true)
    runSync(false).finally(() => {
      setSyncing(false)
      setNextSyncIn(AUTO_SYNC_INTERVAL_MS / 1000)
    })
  }

  // Auto-sync every 2 minutes in the background
  useEffect(() => {
    // Countdown timer (updates every second)
    const countdown = setInterval(() => {
      setNextSyncIn(prev => {
        if (prev <= 1) return AUTO_SYNC_INTERVAL_MS / 1000
        return prev - 1
      })
    }, 1000)

    // Silent background sync
    const autoSync = setInterval(() => {
      runSync(true)
    }, AUTO_SYNC_INTERVAL_MS)

    return () => {
      clearInterval(countdown)
      clearInterval(autoSync)
    }
  }, [runSync])

  const openEmail = async (email: InboundEmail) => {
    setDetailLoading(true)
    setSelected(email)
    if (!email.isRead) {
      await fetch(`/api/inbox`, { method: 'PATCH', body: JSON.stringify({ id: email.id }), headers: { 'Content-Type': 'application/json' } })
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e))
    }
    // Fetch full detail (body HTML etc.)
    const res = await fetch(`/api/inbox/${email.id}`)
    if (res.ok) {
      const full: InboundEmail = await res.json()
      setSelected(full)
    }
    setDetailLoading(false)
  }

  const unreadCount = emails.filter(e => !e.isRead).length

  return (
    <div className="relative flex h-[calc(100vh-5rem)] overflow-hidden rounded-xl border border-slate-800/60">

      {/* ── Toast notification (top-right, floats above everything) ── */}
      {toast && (
        <div className={`absolute top-3 right-3 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all
          ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-700/60 text-emerald-200' :
            toast.type === 'error'   ? 'bg-rose-950 border-rose-700/60 text-rose-200' :
                                       'bg-slate-800 border-slate-700/60 text-slate-200'}`}
        >
          <BellIcon className="w-4 h-4 flex-shrink-0" />
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Left pane: message list ── */}
      <div className={`flex flex-col ${selected ? 'hidden lg:flex' : 'flex'} w-full lg:w-96 border-r border-slate-800/60 bg-slate-950/60`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <InboxIcon className="w-5 h-5 text-violet-400" />
              <h2 className="text-sm font-semibold text-slate-100">Replies</h2>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-xs font-semibold">{unreadCount}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-sync countdown */}
              <span className="text-[10px] text-slate-600" title="Auto-syncs every 2 minutes">
                next in {nextSyncIn}s
              </span>
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Sync now"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search messages…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setUnreadOnly(false)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${!unreadOnly ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              All
            </button>
            <button
              onClick={() => setUnreadOnly(true)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${unreadOnly ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              Unread
            </button>
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-1 p-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-800 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-800 rounded w-full" />
                    <div className="h-2.5 bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500 py-16">
              <InboxIcon className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium text-slate-400">No replies yet</p>
              <p className="text-xs text-slate-600 text-center px-4">When someone replies to an email you sent, it will appear here.</p>
              <button onClick={handleSync} className="text-xs text-violet-400 hover:text-violet-300 mt-1">
                Sync replies from Gmail →
              </button>
            </div>
          ) : (
            <div className="p-2">
              {emails.map(email => (
                <button
                  key={email.id}
                  onClick={() => openEmail(email)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all mb-1 group ${
                    selected?.id === email.id
                      ? 'bg-violet-600/20 border border-violet-600/40'
                      : 'hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Avatar name={email.fromName} email={email.fromEmail} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-slate-100' : 'font-medium text-slate-300'}`}>
                        {email.fromName || email.fromEmail}
                      </span>
                      <span className="text-[11px] text-slate-500 flex-shrink-0 ml-2">
                        {formatDate(email.receivedAt)}
                      </span>
                    </div>
                    <p className={`text-xs truncate mb-0.5 ${!email.isRead ? 'text-slate-200' : 'text-slate-400'}`}>
                      {email.subject}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{email.snippet ?? ''}</p>
                    {email.sentEmail && (
                      <div className="mt-1 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3 text-violet-400" />
                        <span className="text-[11px] text-violet-400 truncate">Reply to: {email.sentEmail.subject}</span>
                      </div>
                    )}
                  </div>
                  {!email.isRead && (
                    <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/60">
            <button
              disabled={page <= 1}
              onClick={() => fetchEmails(page - 1)}
              className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="text-xs text-slate-500">{page} / {Math.ceil(total / pageSize)}</span>
            <button
              disabled={page * pageSize >= total}
              onClick={() => fetchEmails(page + 1)}
              className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Right pane: message detail ── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          {/* Detail header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800/60">
            <button
              onClick={() => setSelected(null)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-100 truncate">{selected.subject}</h3>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCwIcon className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Sender meta */}
              <div className="px-6 py-4 border-b border-slate-800/40">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.fromName} email={selected.fromEmail} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{selected.fromName || selected.fromEmail}</span>
                      <span className="text-xs text-slate-500">&lt;{selected.fromEmail}&gt;</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <UserIcon className="w-3 h-3" />
                        To: {selected.toEmail}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <ClockIcon className="w-3 h-3" />
                        {new Date(selected.receivedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked outbound email banner — only shown for genuine replies */}
              {selected.sentEmail && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 flex items-start gap-3">
                  <LinkIcon className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-violet-300 mb-0.5">Reply to your email</p>
                    <p className="text-sm text-slate-300 truncate font-medium">{selected.sentEmail.subject}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1">
                      <span className="text-xs text-slate-500">Sent to: {selected.sentEmail.toName} ({selected.sentEmail.toEmail})</span>
                      {selected.sentEmail.template && (
                        <span className="text-xs text-slate-500">Template: {selected.sentEmail.template.name}</span>
                      )}
                      {selected.sentEmail.sentAt && (
                        <span className="text-xs text-slate-500">
                          Sent: {new Date(selected.sentEmail.sentAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Message body ── */}
              <div className="px-6 pt-5 pb-2">
                <p className="text-[11px] uppercase tracking-widest font-semibold text-violet-400 mb-3">
                  {selected.sentEmail ? 'Their Reply' : 'Message'}
                </p>
                <EmailFrame
                  html={selected.bodyHtml}
                  text={selected.bodyText}
                  snippet={selected.snippet}
                />
              </div>

              {/* ── Original email you sent — only shown for genuine replies ── */}
              {selected.sentEmail?.body && (
                <div className="px-6 pb-6 pt-3">
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-500 mb-3">Your Original Email</p>
                  <details className="group">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 flex items-center gap-1.5 list-none mb-2">
                      <ChevronRightIcon className="w-3.5 h-3.5 group-open:rotate-90 transition-transform flex-shrink-0" />
                      <span>Show original message</span>
                    </summary>
                    <EmailFrame html={selected.sentEmail.body} />
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Empty state when nothing selected */
        <div className="flex-1 flex-col items-center justify-center hidden lg:flex text-slate-600 gap-3">
          <MailOpenIcon className="w-12 h-12 opacity-20" />
          <p className="text-sm">Select a message to read</p>
        </div>
      )}
    </div>
  )
}
