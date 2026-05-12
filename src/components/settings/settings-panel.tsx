'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2Icon,
  XCircleIcon,
  LoaderIcon,
  ZapIcon,
  AlertTriangleIcon,
  ServerIcon,
  UserIcon,
  SaveIcon,
} from 'lucide-react'

interface SettingsData {
  active: 'microsoft-graph'
  source: 'env'
  microsoftGraph: {
    configured: boolean
    mailbox: string | null
  }
}

interface TestResult {
  ok: boolean
  error?: string
  hint?: string
  [key: string]: unknown
}

type TestState = 'idle' | 'loading' | 'done'

function TestResultBox({ result }: { result: TestResult }) {
  return (
    <div
      className={`rounded-md border p-4 text-sm space-y-2 mt-3 ${
        result.ok
          ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-200'
          : 'bg-rose-500/8 border-rose-500/25 text-rose-200'
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {result.ok ? (
          <CheckCircle2Icon className="w-4 h-4 text-emerald-400" />
        ) : (
          <XCircleIcon className="w-4 h-4 text-rose-400" />
        )}
        {result.ok ? 'Microsoft Graph API is ready' : 'Connection failed'}
      </div>
      {result.error && <p className="text-rose-300 text-xs leading-relaxed">{result.error}</p>}
      {result.hint && (
        <p className="text-amber-300 text-xs leading-relaxed flex gap-1">
          <AlertTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {result.hint}
        </p>
      )}
    </div>
  )
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)

  const [graphTest, setGraphTest] = useState<TestResult | null>(null)
  const [graphTestState, setGraphTestState] = useState<TestState>('idle')

  // Sender config state
  const [senderName, setSenderName]   = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [senderSource, setSenderSource] = useState<'db' | 'env'>('env')
  const [savingSender, setSavingSender] = useState(false)
  const [senderSaved, setSenderSaved]   = useState(false)
  const [senderError, setSenderError]   = useState<string | null>(null)

  async function loadSettings() {
    setLoadingSettings(true)
    try {
      const [settingsRes, senderRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings/sender'),
      ])
      const rawSettings = await settingsRes.json()
      setSettings(rawSettings as SettingsData)
      const s = await senderRes.json()
      setSenderName(s.name ?? '')
      setSenderEmail(s.email ?? '')
      setSenderSource(s.source)
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => {
    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveSender() {
    setSavingSender(true)
    setSenderError(null)
    setSenderSaved(false)
    try {
      const res = await fetch('/api/settings/sender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: senderName, email: senderEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSenderError(data.error ?? 'Failed to save')
      } else {
        setSenderSaved(true)
        setSenderSource('db')
        setTimeout(() => setSenderSaved(false), 3000)
      }
    } finally {
      setSavingSender(false)
    }
  }

  async function runGraphTest() {
    setGraphTestState('loading')
    setGraphTest(null)
    try {
      const res = await fetch('/api/settings/test/smtp')
      setGraphTest(await res.json())
    } catch (e) {
      setGraphTest({ ok: false, error: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setGraphTestState('done')
    }
  }

  if (loadingSettings) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-12">
        <LoaderIcon className="w-4 h-4 animate-spin" />
        Loading settings…
      </div>
    )
  }

  if (!settings) return <p className="text-rose-400">Failed to load settings.</p>

  const { microsoftGraph } = settings

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Sender configuration ── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-indigo-300 shrink-0" />
          <h3 className="font-semibold text-white text-sm">Sender Configuration</h3>
          {senderSource === 'db' && (
            <span className="text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded">
              Saved
            </span>
          )}
          {senderSource === 'env' && (
            <span className="text-xs bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded">
              From env
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Display name and address shown in outgoing emails. Overrides <code className="bg-slate-800 px-1 rounded text-slate-300">MAIL_FROM_ADDRESS</code> in your env.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Display Name</label>
            <input
              type="text"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="e.g. TQ Helpdesk"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">From Email Address</label>
            <input
              type="email"
              value={senderEmail}
              onChange={e => setSenderEmail(e.target.value)}
              placeholder="e.g. hr-notify@tanseeqinvestment.com"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {senderEmail && (
          <p className="text-xs text-slate-500">
            Emails will appear from:{' '}
            <span className="text-slate-300 font-medium">
              {senderName ? `${senderName} <${senderEmail}>` : senderEmail}
            </span>
          </p>
        )}

        {senderError && (
          <p className="text-xs text-rose-400 flex items-center gap-1">
            <XCircleIcon className="w-3.5 h-3.5" /> {senderError}
          </p>
        )}

        <button
          onClick={saveSender}
          disabled={savingSender || !senderEmail.trim()}
          className="button-primary disabled:opacity-50"
        >
          {savingSender ? (
            <LoaderIcon className="w-4 h-4 animate-spin" />
          ) : senderSaved ? (
            <CheckCircle2Icon className="w-4 h-4" />
          ) : (
            <SaveIcon className="w-4 h-4" />
          )}
          {savingSender ? 'Saving…' : senderSaved ? 'Saved!' : 'Save Sender'}
        </button>
      </div>

      {/* Active provider banner */}
      <div className="card flex items-center gap-3">
        <ServerIcon className="w-5 h-5 text-indigo-300 shrink-0" />
        <div>
          <p className="text-sm text-slate-300">
            Active provider:{' '}
            <span className="font-semibold text-white">Microsoft Graph API (Outlook)</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Emails are sent and received via Microsoft 365 using Azure app credentials. No SMTP password needed.
          </p>
        </div>
      </div>

      {/* Microsoft Graph config card */}
      <div className="card space-y-4 border-indigo-400/40 bg-indigo-500/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-2 h-2 rounded-full shrink-0 ${microsoftGraph.configured ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <h3 className="font-semibold text-white text-sm">Microsoft Graph API</h3>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded">Active</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Send and receive email via Microsoft 365 using Azure client credentials. No daily send limit.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-500">Status</p>
            <p className="text-slate-200 mt-0.5">{microsoftGraph.configured ? 'Credentials configured' : 'Not configured'}</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-500">Mailbox</p>
            <p className="text-slate-200 mt-0.5 truncate">{microsoftGraph.mailbox ?? 'Not set'}</p>
          </div>
        </div>

        {!microsoftGraph.configured && (
          <p className="text-xs text-rose-300 flex items-start gap-1">
            <AlertTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Missing Azure credentials. Set <code className="bg-slate-800 px-1 rounded text-slate-200 mx-1">AZURE_TENANT_ID</code>,{' '}
            <code className="bg-slate-800 px-1 rounded text-slate-200 mx-1">AZURE_CLIENT_ID</code> and{' '}
            <code className="bg-slate-800 px-1 rounded text-slate-200 mx-1">AZURE_CLIENT_SECRET</code> in your environment.
          </p>
        )}

        <button
          onClick={runGraphTest}
          disabled={graphTestState === 'loading' || !microsoftGraph.configured}
          className="button-secondary w-full justify-center disabled:opacity-50"
        >
          {graphTestState === 'loading' ? (
            <LoaderIcon className="w-4 h-4 animate-spin" />
          ) : (
            <ZapIcon className="w-4 h-4" />
          )}
          {graphTestState === 'loading' ? 'Testing…' : 'Test Azure Connection'}
        </button>
        {graphTest && <TestResultBox result={graphTest} />}
      </div>

    </div>
  )
}
