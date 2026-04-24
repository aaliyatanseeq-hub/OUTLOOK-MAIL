'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SaveIcon, LoaderIcon } from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string | null
  senderName: string
  senderEmail: string
  subject: string
  bodyTemplate: string
}

interface Props { existing?: Template }

export function TemplateForm({ existing }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: existing?.name || '',
    description: existing?.description || '',
    senderName: existing?.senderName || '',
    senderEmail: existing?.senderEmail || '',
    subject: existing?.subject || '',
    bodyTemplate: existing?.bodyTemplate || '',
  })

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = existing ? `/api/templates/${existing.id}` : '/api/templates'
      const method = existing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      router.push('/templates')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="card border-rose-500/30 bg-rose-500/5 text-rose-300 text-sm py-3 px-4">
          {error}
        </div>
      )}

      <div className="card space-y-4">
        <h3 className="font-semibold text-white text-sm">Template Details</h3>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Template name *</label>
          <input className="input w-full" placeholder="e.g. Welcome Email, Invoice Notification" required
            value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Description</label>
          <input className="input w-full" placeholder="When to use this template (optional)"
            value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-white text-sm">Sender</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Sender name *</label>
            <input className="input w-full" placeholder="Tanseeq Investment" required
              value={form.senderName} onChange={(e) => set('senderName', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Sender email *</label>
            <input className="input w-full" type="email" placeholder="noreply@company.com" required
              value={form.senderEmail} onChange={(e) => set('senderEmail', e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">Used as Reply-To. Actual From address is set in Settings.</p>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-white text-sm">Email Content</h3>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Subject *</label>
          <input className="input w-full" placeholder="Hello {{name}}, here is your update" required
            value={form.subject} onChange={(e) => set('subject', e.target.value)} />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Body *</label>
          <p className="text-xs text-slate-500 mb-2">
            Use {'{{name}}'} and {'{{email}}'} — they are replaced per recipient when sending.
          </p>
          <textarea
            className="input w-full font-mono text-sm resize-none"
            rows={10}
            placeholder={`Dear {{name}},\n\nThis is a message for you.\n\nBest regards,\nTanseeq Investment`}
            required
            value={form.bodyTemplate}
            onChange={(e) => set('bodyTemplate', e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="button-primary disabled:opacity-50">
          {saving ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
          {saving ? 'Saving…' : existing ? 'Update Template' : 'Save Template'}
        </button>
        <button type="button" onClick={() => router.back()} className="button-secondary">
          Cancel
        </button>
      </div>
    </form>
  )
}
