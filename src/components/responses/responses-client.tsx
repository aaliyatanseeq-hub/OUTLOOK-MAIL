'use client'

import { useEffect, useState } from 'react'
import { DownloadIcon, RefreshCwIcon, CheckCircle2Icon, AlertTriangleIcon, ClockIcon, LoaderIcon, BellIcon, Trash2Icon } from 'lucide-react'
import ExcelJS from 'exceljs'

interface Response {
  id: string
  fromName: string
  fromEmail: string
  employeeId: string | null
  workPhone: string | null
  personalPhone: string | null
  parsedOk: boolean
  rawText: string | null
  receivedAt: string
  inboundEmail: { subject: string } | null
}

interface Stats {
  totalSent: number
  totalResponded: number
  parsedOk: number
  needsReview: number
  pending: number
}

export function ResponsesClient() {
  const [responses, setResponses] = useState<Response[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ok' | 'review' | 'pending'>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reminding, setReminding] = useState(false)
  const [remindResult, setRemindResult] = useState<{ sent: number; failed: number; message?: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/responses')
      const data = await res.json()
      setResponses(data.responses)
      setStats(data.stats)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function deleteResponse(id: string) {
    if (!confirm('Delete this response? The employee will be able to re-submit via their original link.')) return
    setDeletingId(id)
    try {
      await fetch('/api/responses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  async function sendReminders() {
    setReminding(true)
    setRemindResult(null)
    try {
      const res = await fetch('/api/responses/remind', { method: 'POST' })
      const data = await res.json()
      setRemindResult(data)
    } finally {
      setReminding(false)
    }
  }

  async function exportExcel() {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'EmailHub'
    wb.created = new Date()

    const ws = wb.addWorksheet('Employee Responses', {
      pageSetup: { fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', ySplit: 3 }],
    })

    // ── Title row ──────────────────────────────────────────────────────────
    ws.mergeCells('A1:G1')
    const titleCell = ws.getCell('A1')
    titleCell.value = `Employee Data Collection — Exported ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`
    titleCell.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(1).height = 28

    // ── Stats summary row ──────────────────────────────────────────────────
    ws.mergeCells('A2:G2')
    const statCell = ws.getCell('A2')
    const total     = responses.length
    const complete  = responses.filter(r => r.parsedOk).length
    const pending   = stats?.pending ?? 0
    statCell.value = `Total: ${total}   |   Complete: ${complete}   |   Needs Review: ${total - complete}   |   Pending (no reply): ${pending}`
    statCell.font  = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } }
    statCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF3' } }
    statCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(2).height = 20

    // ── Header row ─────────────────────────────────────────────────────────
    const headers = ['#', 'Full Name', 'Email Address', 'Employee ID', 'Work Phone', 'Personal Phone', 'Status', 'Received At']
    const headerRow = ws.getRow(3)
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = h
      cell.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'center' : 'left' }
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      }
    })
    headerRow.height = 22

    // ── Column widths ──────────────────────────────────────────────────────
    ws.columns = [
      { width: 5  },  // #
      { width: 24 },  // Name
      { width: 30 },  // Email
      { width: 16 },  // Emp ID
      { width: 18 },  // Work Phone
      { width: 18 },  // Personal Phone
      { width: 14 },  // Status
      { width: 20 },  // Received At
    ]

    // ── Data rows ──────────────────────────────────────────────────────────
    responses.forEach((r, idx) => {
      const row = ws.addRow([
        idx + 1,
        r.fromName,
        r.fromEmail,
        r.employeeId ?? '',
        r.workPhone ?? '',
        r.personalPhone ?? '',
        r.parsedOk ? 'Complete' : 'Needs Review',
        new Date(r.receivedAt).toLocaleString('en-GB'),
      ])

      const isEven = idx % 2 === 0
      const rowBg  = isEven ? 'FFFAFBFF' : 'FFF0F4FF'

      row.height = 18
      row.eachCell((cell, colNum) => {
        cell.font      = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } }
        cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'center' : 'left' }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
        cell.border    = {
          bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } },
          right:  { style: 'hair', color: { argb: 'FFCBD5E1' } },
        }
      })

      // Colour the Status cell
      const statusCell = row.getCell(7)
      if (r.parsedOk) {
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } }
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      } else {
        statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } }
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      }

      // Red text for missing fields
      ;[4, 5, 6].forEach(col => {
        const c = row.getCell(col)
        if (!c.value) {
          c.value = 'Missing'
          c.font  = { name: 'Calibri', size: 10, color: { argb: 'FFB91C1C' }, italic: true }
        }
      })
    })

    // ── Export ─────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href     = url
    a.download = `employee-responses-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = responses.filter(r => {
    if (filter === 'ok' && !r.parsedOk) return false
    if (filter === 'review' && r.parsedOk) return false
    const q = search.toLowerCase()
    if (q && !r.fromName.toLowerCase().includes(q) && !r.fromEmail.toLowerCase().includes(q) && !(r.employeeId ?? '').toLowerCase().includes(q)) return false
    return true
  })

  return (
    <div className="space-y-5">

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Emails Sent',  value: stats.totalSent,     color: 'text-slate-300' },
            { label: 'Responded',    value: stats.totalResponded, color: 'text-indigo-300' },
            { label: 'Complete',     value: stats.parsedOk,       color: 'text-emerald-300' },
            { label: 'Needs Review', value: stats.needsReview,    color: 'text-amber-300' },
            { label: 'No Response',  value: stats.pending,        color: 'text-rose-300' },
          ].map(s => (
            <div key={s.label} className="card text-center py-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search name, email or emp ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input flex-1 min-w-48"
        />
        <div className="flex gap-1">
          {(['all', 'ok', 'review'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {f === 'all' ? 'All' : f === 'ok' ? 'Complete' : 'Needs Review'}
            </button>
          ))}
        </div>
        <button onClick={load} className="button-secondary" title="Refresh">
          <RefreshCwIcon className="w-4 h-4" />
        </button>
        <button
          onClick={sendReminders}
          disabled={reminding || (stats?.pending ?? 0) === 0}
          className="button-secondary disabled:opacity-50"
          title="Send reminder to non-responders"
        >
          {reminding ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <BellIcon className="w-4 h-4" />}
          {reminding ? 'Sending…' : `Remind ${stats?.pending ?? 0} pending`}
        </button>
        <button onClick={() => exportExcel()} disabled={responses.length === 0} className="button-primary disabled:opacity-50">
          <DownloadIcon className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Reminder result */}
      {remindResult && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${
          remindResult.message
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
        }`}>
          <BellIcon className="w-4 h-4 shrink-0" />
          {remindResult.message
            ? remindResult.message
            : `Reminders sent: ${remindResult.sent} succeeded${remindResult.failed > 0 ? `, ${remindResult.failed} failed` : ''}.`}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
          <LoaderIcon className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-slate-500">
          <ClockIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No responses yet. Sync inbox after employees reply.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Name / Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Employee ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Work Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Personal Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">Received</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <>
                    <tr
                      key={r.id}
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-slate-200 font-medium">{r.fromName}</p>
                        <p className="text-xs text-slate-500">{r.fromEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                        {r.employeeId ?? <span className="text-rose-400">Missing</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {r.workPhone ?? <span className="text-rose-400">Missing</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {r.personalPhone ?? <span className="text-rose-400">Missing</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.parsedOk ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs">
                            <CheckCircle2Icon className="w-3.5 h-3.5" /> Complete
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-400 text-xs">
                            <AlertTriangleIcon className="w-3.5 h-3.5" /> Needs Review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(r.receivedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); deleteResponse(r.id) }}
                          disabled={deletingId === r.id}
                          title="Delete this response (employee can re-submit)"
                          className="text-slate-600 hover:text-rose-400 transition-colors disabled:opacity-40"
                        >
                          {deletingId === r.id
                            ? <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2Icon className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                    {expanded === r.id && r.rawText && (
                      <tr key={`${r.id}-raw`} className="border-b border-slate-800/50 bg-slate-900/50">
                        <td colSpan={6} className="px-4 py-3">
                          <p className="text-xs text-slate-400 mb-1 font-medium">Raw reply text:</p>
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-800 rounded p-3 max-h-40 overflow-y-auto">
                            {r.rawText}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Email template to copy */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-white text-sm">Email Template to Send Employees</h3>
        <p className="text-xs text-slate-400">Copy this into your email template body. Employees click Reply, fill the blanks, and send.</p>
        <pre className="text-xs text-slate-300 bg-slate-900 border border-slate-700 rounded-lg p-4 whitespace-pre-wrap select-all">
{`Dear {{name}},

As part of our records update, please reply to this email with your details filled in below:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMPLOYEE ID        : _______________
WORK PHONE         : _______________
PERSONAL PHONE     : _______________
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Simply click Reply, fill in the blanks, and click Send.
This will only take one minute.

Regards,
HR Department
Tanseeq Investment`}
        </pre>
      </div>
    </div>
  )
}
