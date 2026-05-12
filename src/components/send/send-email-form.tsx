'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  SendIcon, LoaderIcon, CheckCircle2Icon, XCircleIcon,
  EyeIcon, UploadIcon, UserIcon, FileTextIcon,
  FileSpreadsheetIcon, Trash2Icon, AlertCircleIcon, XIcon,
} from 'lucide-react'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

interface Template {
  id: string
  name: string
  description: string | null
  subject: string
  bodyTemplate: string
  senderName: string
  senderEmail: string
}

interface Recipient { name: string; email: string; error?: string }
interface SendResult { name: string; email: string; success: boolean; error?: string }

type InputMode = 'manual' | 'csv' | 'excel'

function renderTpl(text: string, name: string, email: string) {
  return text.split('{{name}}').join(name || '{{name}}').split('{{email}}').join(email || '{{email}}')
}

function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

function parseRows(rows: Record<string, string>[]): Recipient[] {
  return rows
    .filter((r) => Object.values(r).some(Boolean))
    .map((r) => {
      const email = (r['email'] || r['Email'] || r['EMAIL'] || r['e-mail'] || '').trim()
      const name  = (r['name']  || r['Name']  || r['NAME']  || r['full name'] || r['Full Name'] || '').trim()
      const error = !email ? 'Missing email' : !isValidEmail(email) ? 'Invalid email' : undefined
      return { name: name || email.split('@')[0], email, error }
    })
}

export function SendEmailForm({ templates, defaultTemplateId, fromAddress }: { templates: Template[]; defaultTemplateId?: string; fromAddress?: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<InputMode>('manual')
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplateId || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // Manual
  const [toName, setToName] = useState('')
  const [toEmail, setToEmail] = useState('')

  // File upload
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')

  // Sending state
  const [sending, setSending] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [results, setResults] = useState<SendResult[]>([])
  const [singleResult, setSingleResult] = useState<{ success: boolean; error?: string } | null>(null)

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  useEffect(() => {
    if (selectedTemplate) {
      setSubject(selectedTemplate.subject)
      setBody(selectedTemplate.bodyTemplate)
    }
  }, [selectedTemplateId])

  // ── File parsing ──────────────────────────────────────────────
  function handleFile(file: File) {
    setFileError('')
    setRecipients([])
    setFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv') {
      Papa.parse<Record<string, string>>(file, {
        header: true, skipEmptyLines: true,
        complete(result) { setRecipients(parseRows(result.data)) },
        error(err) { setFileError(err.message) },
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
        setRecipients(parseRows(rows))
      }
      reader.readAsBinaryString(file)
    } else {
      setFileError('Only .csv, .xlsx, and .xls files are supported.')
    }
  }

  function onFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Send ──────────────────────────────────────────────────────
  async function sendOne(name: string, email: string, attempt = 1): Promise<SendResult> {
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId || null,
          toName: name, toEmail: email,
          customSubject: subject,
          customBody: body,
        }),
      })
      // Retry once on 429 (Graph API rate limit) after a short back-off
      if (res.status === 429 && attempt < 3) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
        await new Promise(r => setTimeout(r, retryAfter * 1000))
        return sendOne(name, email, attempt + 1)
      }
      const json = await res.json()
      return { name, email, success: json.success, error: json.error }
    } catch (err) {
      return { name, email, success: false, error: err instanceof Error ? err.message : 'Network error' }
    }
  }

  function handleReviewClick(e: React.FormEvent) {
    e.preventDefault()
    setShowPreviewModal(true)
  }

  async function handleSend() {
    setShowPreviewModal(false)
    setSending(true)
    setResults([])
    setSingleResult(null)

    if (mode === 'manual') {
      const r = await sendOne(toName, toEmail)
      setSingleResult({ success: r.success, error: r.error })
      if (r.success) { setToName(''); setToEmail('') }
    } else {
      const valid = recipients.filter((r) => !r.error)
      setProgress({ done: 0, total: valid.length })
      const res: SendResult[] = []
      for (let i = 0; i < valid.length; i++) {
        const r = await sendOne(valid[i].name, valid[i].email)
        res.push(r)
        setProgress({ done: i + 1, total: valid.length })
        // Throttle: ~3 emails/sec to stay well within Graph API limits
        if (i < valid.length - 1) await new Promise(resolve => setTimeout(resolve, 350))
      }
      setResults(res)
      setProgress(null)
    }
    setSending(false)
  }

  const validRecipients = recipients.filter((r) => !r.error)
  const invalidRecipients = recipients.filter((r) => r.error)
  const previewName  = mode === 'manual' ? toName  : (validRecipients[0]?.name  || 'Employee')
  const previewEmail = mode === 'manual' ? toEmail : (validRecipients[0]?.email || 'employee@example.com')
  const previewHtml  = renderTpl(body, previewName, previewEmail)

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length

  return (
    <div className="space-y-4">

      {/* Template picker */}
      <div className="card !p-4 space-y-2">
        <label className="block text-xs uppercase tracking-wide font-semibold text-slate-500">Template (optional)</label>
        <select className="input w-full text-sm" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
          <option value="">— Start from scratch —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-md w-fit">
        {([
          { id: 'manual', label: 'Manual', icon: UserIcon },
          { id: 'csv',    label: 'CSV',    icon: FileTextIcon },
          { id: 'excel',  label: 'Excel',  icon: FileSpreadsheetIcon },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setMode(id); setRecipients([]); setFileName(''); setFileError(''); setResults([]) }}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
              mode === id
                ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleReviewClick} className="card !p-0 overflow-hidden !backdrop-blur-none">

        {/* ── Recipient area ── */}
        {mode === 'manual' ? (
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800">
            <span className="text-sm font-medium text-slate-400 w-16 shrink-0">To</span>
            <input
              type="text" required placeholder="Full name"
              className="bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none w-36"
              value={toName} onChange={(e) => setToName(e.target.value)}
            />
            <span className="text-slate-700">·</span>
            <input
              type="email" required placeholder="email@example.com"
              className="bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none flex-1 min-w-48"
              value={toEmail} onChange={(e) => setToEmail(e.target.value)}
            />
          </div>
        ) : (
          <div className="border-b border-slate-800">
            {/* Drop zone */}
            {!fileName ? (
              <div
                className="m-4 border-2 border-dashed border-slate-700 rounded-md px-6 py-10 text-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onFileDrop}
                onClick={() => fileRef.current?.click()}
              >
                <UploadIcon className="w-7 h-7 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300 font-medium text-sm">Drop your file here or click to browse</p>
                <p className="text-slate-600 text-xs mt-1">Supports .csv, .xlsx, .xls — columns: <code className="bg-slate-800 px-1 rounded">name</code> and <code className="bg-slate-800 px-1 rounded">email</code></p>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              </div>
            ) : (
              <div className="px-5 py-3 space-y-3">
                {/* File info bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {mode === 'excel' ? <FileSpreadsheetIcon className="w-4 h-4 text-emerald-400" /> : <FileTextIcon className="w-4 h-4 text-blue-400" />}
                    <span className="text-slate-200 font-medium">{fileName}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-emerald-300 text-xs">{validRecipients.length} valid</span>
                    {invalidRecipients.length > 0 && <span className="text-rose-300 text-xs">{invalidRecipients.length} skipped</span>}
                  </div>
                  <button type="button" onClick={() => { setFileName(''); setRecipients([]); setFileError('') }}
                    className="text-slate-600 hover:text-rose-400 transition-colors">
                    <Trash2Icon className="w-4 h-4" />
                  </button>
                </div>

                {fileError && (
                  <div className="flex items-center gap-2 text-rose-300 text-sm bg-rose-500/5 border border-rose-500/20 rounded px-3 py-2">
                    <AlertCircleIcon className="w-4 h-4 shrink-0" /> {fileError}
                  </div>
                )}

                {/* Preview table */}
                {recipients.length > 0 && (
                  <div className="border border-slate-800 rounded overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800/60 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 text-slate-400 font-semibold">#</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-semibold">Name</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-semibold">Email</th>
                          <th className="text-left py-2 px-3 text-slate-400 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.map((r, i) => (
                          <tr key={i} className={`border-t border-slate-800 ${r.error ? 'opacity-50' : ''}`}>
                            <td className="py-1.5 px-3 text-slate-500">{i + 1}</td>
                            <td className="py-1.5 px-3 text-slate-300">{r.name || '—'}</td>
                            <td className="py-1.5 px-3 text-slate-300">{r.email || '—'}</td>
                            <td className="py-1.5 px-3">
                              {r.error
                                ? <span className="text-rose-400">{r.error}</span>
                                : <span className="text-emerald-400">✓ Ready</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* From — read-only, shows actual sending address */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800">
          <span className="text-sm font-medium text-slate-400 w-16 shrink-0">From</span>
          <span className="text-sm text-slate-300 flex-1">{fromAddress || 'Not configured — set MAIL_FROM in .env.local'}</span>
          <span className="text-xs text-slate-600 shrink-0">via SMTP</span>
        </div>

        {/* Subject */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800">
          <span className="text-sm font-medium text-slate-400 w-16 shrink-0">Subject</span>
          <input type="text" required placeholder="Your subject line…"
            className="bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none flex-1 font-medium"
            value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        {/* Rich text body */}
        <div className="border-b border-slate-800">
          <RichTextEditor
            value={body} onChange={setBody}
            placeholder="Write your message. Use {{name}} and {{email}} as placeholders."
            minHeight={260}
          />
        </div>

        {/* Placeholder hint */}
        <div className="px-5 py-2 border-b border-slate-800 bg-slate-900/30">
          <p className="text-xs text-slate-600">
            Placeholders: <code className="text-slate-500 bg-slate-800 px-1 rounded">{'{{name}}'}</code> and <code className="text-slate-500 bg-slate-800 px-1 rounded">{'{{email}}'}</code> — replaced per recipient on send.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900/20">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={sending || (mode !== 'manual' && validRecipients.length === 0)}
              className="button-primary disabled:opacity-50 px-5 gap-2"
            >
              {sending
                ? <><LoaderIcon className="w-4 h-4 animate-spin" />
                    {progress
                      ? `Sending ${progress.done}/${progress.total}… (~${Math.ceil((progress.total - progress.done) * 0.35)}s left)`
                      : 'Sending…'}
                  </>
                : <><EyeIcon className="w-4 h-4" />
                    {mode === 'manual'
                      ? 'Preview & Send'
                      : `Preview & Send to ${validRecipients.length} recipient${validRecipients.length !== 1 ? 's' : ''}`}
                  </>
              }
            </button>
          </div>
          <p className="text-xs text-slate-600">via Microsoft Graph</p>
        </div>
      </form>

      {/* ── Single result ── */}
      {singleResult && (
        <div className={`card flex items-start gap-3 py-4 ${singleResult.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
          {singleResult.success ? <CheckCircle2Icon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : <XCircleIcon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
          <div>
            <p className={`font-medium text-sm ${singleResult.success ? 'text-emerald-300' : 'text-rose-300'}`}>
              {singleResult.success ? 'Email sent successfully' : 'Failed to send'}
            </p>
            {singleResult.error && <p className="text-xs text-slate-400 mt-0.5">{singleResult.error}</p>}
            {singleResult.success && (
              <button onClick={() => router.push('/history')} className="text-xs text-indigo-300 underline mt-1">View in History →</button>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk results ── */}
      {results.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
              <CheckCircle2Icon className="w-4 h-4" /> {successCount} sent
            </div>
            {failCount > 0 && (
              <div className="flex items-center gap-2 text-rose-300 text-sm font-medium">
                <XCircleIcon className="w-4 h-4" /> {failCount} failed
              </div>
            )}
            <button onClick={() => router.push('/history')} className="ml-auto text-xs text-indigo-300 underline">View History →</button>
          </div>

          {failCount > 0 && (
            <div className="border border-slate-800 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-800/60">
                  <tr>
                    <th className="text-left py-2 px-3 text-slate-400">Recipient</th>
                    <th className="text-left py-2 px-3 text-slate-400">Status</th>
                    <th className="text-left py-2 px-3 text-slate-400">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {results.filter(r => !r.success).map((r, i) => (
                    <tr key={i} className="border-t border-slate-800">
                      <td className="py-1.5 px-3 text-slate-300">{r.name} · {r.email}</td>
                      <td className="py-1.5 px-3 text-rose-400">Failed</td>
                      <td className="py-1.5 px-3 text-slate-500">{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Preview Modal ── */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div>
                <p className="text-sm font-semibold text-white">Email Preview</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mode === 'manual'
                    ? 'This is exactly what the recipient will receive.'
                    : `Showing preview for first recipient. Will send to ${validRecipients.length} people.`}
                </p>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Email metadata */}
            <div className="px-6 py-3 border-b border-slate-800 space-y-2 shrink-0 bg-slate-900/60">
              {[
                { label: 'From',    value: fromAddress || '—' },
                { label: 'To',      value: mode === 'manual' ? (toName ? `${toName} <${toEmail}>` : toEmail || '—') : `${validRecipients[0]?.name} <${validRecipients[0]?.email}>` },
                { label: 'Subject', value: renderTpl(subject, previewName, previewEmail) || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3 text-sm">
                  <span className="text-slate-500 w-14 shrink-0">{label}</span>
                  <span className="text-slate-200 font-medium truncate">{value}</span>
                </div>
              ))}
            </div>

            {/* Rendered email body */}
            <div className="overflow-y-auto flex-1 bg-white rounded-b-xl">
              <div
                className="p-6 text-sm text-slate-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 shrink-0 bg-slate-900/80 rounded-b-2xl">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {sending ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
                {mode === 'manual' ? 'Confirm & Send' : `Confirm & Send to ${validRecipients.length} recipient${validRecipients.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
