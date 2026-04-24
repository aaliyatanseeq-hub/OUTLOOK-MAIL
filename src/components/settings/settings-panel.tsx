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

type ProviderId = 'smtp' | 'resend' | 'microsoft'

interface SettingsData {
  active: ProviderId
  source: 'db' | 'env'
  smtp: { configured: boolean; host: string | null; user: string | null; mailFrom: string | null }
  resend: { configured: boolean; fromEmail: string | null }
  microsoft: { configured: boolean; mailbox: string | null }
}

interface TestResult {
  ok: boolean
  error?: string
  hint?: string
  [key: string]: unknown
}

type TestState = 'idle' | 'loading' | 'done'

function TestResultBox({ result }: { result: TestResult }) {
  const rows = Object.entries(result).filter(([k]) => !['ok', 'error', 'hint'].includes(k))
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
        {result.ok ? 'Connection successful' : 'Connection failed'}
      </div>
      {result.error && <p className="text-rose-300 text-xs leading-relaxed">{result.error}</p>}
      {result.hint && (
        <p className="text-amber-300 text-xs leading-relaxed flex gap-1">
          <AlertTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {result.hint}
        </p>
      )}
      {rows.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-400 truncate text-xs capitalize">
                {k.replace(/([A-Z])/g, ' $1')}
              </dt>
              <dd className="text-slate-200 truncate text-xs">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [switching, setSwitching] = useState<ProviderId | null>(null)

  const [smtpTest, setSmtpTest] = useState<TestResult | null>(null)
  const [smtpTestState, setSmtpTestState] = useState<TestState>('idle')

  const [resendTest, setResendTest] = useState<TestResult | null>(null)
  const [resendTestState, setResendTestState] = useState<TestState>('idle')

  const [msTest, setMsTest] = useState<TestResult | null>(null)
  const [msTestState, setMsTestState] = useState<TestState>('idle')

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
      setSettings(await settingsRes.json())
      const s = await senderRes.json()
      setSenderName(s.name ?? '')
      setSenderEmail(s.email ?? '')
      setSenderSource(s.source)
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

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

  async function switchProvider(provider: ProviderId) {
    setSwitching(provider)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      await loadSettings()
    } finally {
      setSwitching(null)
    }
  }

  async function runTest(provider: ProviderId) {
    const setTest = provider === 'smtp' ? setSmtpTest : provider === 'resend' ? setResendTest : setMsTest
    const setState = provider === 'smtp' ? setSmtpTestState : provider === 'resend' ? setResendTestState : setMsTestState
    setState('loading')
    setTest(null)
    try {
      const res = await fetch(`/api/settings/test/${provider}`)
      setTest(await res.json())
    } catch (e) {
      setTest({ ok: false, error: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setState('done')
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

  const providers: Array<{
    id: ProviderId
    name: string
    description: string
    configured: boolean
    detail: string | null
    testState: TestState
    testResult: TestResult | null
  }> = [
    {
      id: 'smtp',
      name: 'Google SMTP (Gmail)',
      description: 'Send via Gmail using an App Password and nodemailer. Best for company emails. No domain setup needed.',
      configured: settings.smtp.configured,
      detail: settings.smtp.user
        ? `From: ${settings.smtp.mailFrom || settings.smtp.user} via ${settings.smtp.host}`
        : 'SMTP_HOST / SMTP_USER / SMTP_PASS not set',
      testState: smtpTestState,
      testResult: smtpTest,
    },
    {
      id: 'resend',
      name: 'Resend',
      description: 'Transactional email API with full open/click/bounce webhook tracking.',
      configured: settings.resend.configured,
      detail: settings.resend.fromEmail ? `From: ${settings.resend.fromEmail}` : 'RESEND_API_KEY not set',
      testState: resendTestState,
      testResult: resendTest,
    },
    {
      id: 'microsoft',
      name: 'Microsoft Graph',
      description: 'Send via Microsoft 365 org mailbox. Requires Azure app + Mail.Send permission.',
      configured: settings.microsoft.configured,
      detail: settings.microsoft.mailbox ? `Mailbox: ${settings.microsoft.mailbox}` : 'MS_GRAPH_MAILBOX not set',
      testState: msTestState,
      testResult: msTest,
    },
  ]

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
              From .env
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          This name and email will appear as the sender in all outgoing emails. Overrides <code className="bg-slate-800 px-1 rounded text-slate-300">MAIL_FROM</code> in your .env file.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Display Name</label>
            <input
              type="text"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="e.g. Aaliya"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">From Email Address</label>
            <input
              type="email"
              value={senderEmail}
              onChange={e => setSenderEmail(e.target.value)}
              placeholder="e.g. aaliya@gmail.com"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {senderEmail && (
          <p className="text-xs text-slate-500">
            Emails will be sent as: <span className="text-slate-300 font-medium">
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

      {/* Active provider */}
      <div className="card flex items-center gap-3">
        <ServerIcon className="w-5 h-5 text-indigo-300 shrink-0" />
        <div>
          <p className="text-sm text-slate-300">
            Active provider:{' '}
            <span className="font-semibold text-white capitalize">
              {settings.active === 'smtp' ? 'Google SMTP (Gmail)' : settings.active}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              ({settings.source === 'db' ? 'set via UI' : 'from env var'})
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Switch below to change which provider sends your campaigns.
          </p>
        </div>
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {providers.map((p) => {
          const isActive = settings.active === p.id
          const isSwitching = switching === p.id
          const isLoading = p.testState === 'loading'

          return (
            <div
              key={p.id}
              className={`card space-y-4 transition-colors ${isActive ? 'border-indigo-400/40 bg-indigo-500/5' : ''}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${p.configured ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  />
                  <h3 className="font-semibold text-white text-sm">{p.name}</h3>
                  {isActive && (
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>
              </div>

              <p className={`text-xs ${p.configured ? 'text-slate-400' : 'text-rose-400'}`}>
                {p.detail}
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => runTest(p.id)}
                  disabled={isLoading || !p.configured}
                  className="button-secondary w-full justify-center disabled:opacity-50"
                >
                  {isLoading ? (
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <ZapIcon className="w-4 h-4" />
                  )}
                  {isLoading ? 'Testing…' : 'Test Connection'}
                </button>

                {!isActive && (
                  <button
                    onClick={() => switchProvider(p.id)}
                    disabled={isSwitching || !p.configured}
                    className="button-primary w-full justify-center disabled:opacity-50"
                  >
                    {isSwitching ? (
                      <LoaderIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2Icon className="w-4 h-4" />
                    )}
                    {isSwitching ? 'Switching…' : 'Set as Active'}
                  </button>
                )}

                {isActive && (
                  <div className="text-xs text-center text-indigo-300 py-1">
                    ✓ Currently active
                  </div>
                )}
              </div>

              {p.testResult && <TestResultBox result={p.testResult} />}
            </div>
          )
        })}
      </div>

      {/* Env reference */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-white text-sm">Environment variables reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <p className="text-emerald-300 font-semibold">Google SMTP</p>
            <code className="block text-slate-400">SMTP_HOST=smtp.gmail.com</code>
            <code className="block text-slate-400">SMTP_PORT=587</code>
            <code className="block text-slate-400">SMTP_USER=you@gmail.com</code>
            <code className="block text-slate-400">SMTP_PASS=app-password</code>
            <code className="block text-slate-400">MAIL_FROM="Name &lt;you@gmail.com&gt;"</code>
          </div>
          <div className="space-y-1">
            <p className="text-indigo-300 font-semibold">Resend</p>
            <code className="block text-slate-400">RESEND_API_KEY</code>
            <code className="block text-slate-400">RESEND_FROM_EMAIL</code>
            <code className="block text-slate-400">RESEND_WEBHOOK_SECRET</code>
          </div>
          <div className="space-y-1">
            <p className="text-violet-300 font-semibold">Microsoft Graph</p>
            <code className="block text-slate-400">AZURE_TENANT_ID</code>
            <code className="block text-slate-400">AZURE_CLIENT_ID</code>
            <code className="block text-slate-400">AZURE_CLIENT_SECRET</code>
            <code className="block text-slate-400">MS_GRAPH_MAILBOX</code>
          </div>
        </div>
      </div>

      {/* Gmail App Password guide */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-white text-sm">How to get a Gmail App Password</h3>
        <ol className="space-y-1.5 text-xs text-slate-400">
          <li className="flex gap-2"><span className="text-emerald-400 font-semibold shrink-0">1.</span> Go to <code className="text-slate-300 bg-slate-800 px-1 rounded">myaccount.google.com</code> → Security</li>
          <li className="flex gap-2"><span className="text-emerald-400 font-semibold shrink-0">2.</span> Enable <span className="text-white">2-Step Verification</span> (required)</li>
          <li className="flex gap-2"><span className="text-emerald-400 font-semibold shrink-0">3.</span> Search for <span className="text-white">"App passwords"</span> → Create new → name it "Email App"</li>
          <li className="flex gap-2"><span className="text-emerald-400 font-semibold shrink-0">4.</span> Copy the 16-character password (e.g. <code className="text-slate-300 bg-slate-800 px-1 rounded">bbxi kesa cgjt vfrb</code>)</li>
          <li className="flex gap-2"><span className="text-emerald-400 font-semibold shrink-0">5.</span> Set <code className="text-slate-300 bg-slate-800 px-1 rounded">SMTP_PASS</code> to this value in <code className="text-slate-300 bg-slate-800 px-1 rounded">.env.local</code></li>
        </ol>
        <p className="text-xs text-amber-300">Gmail free limit: 500 emails/day. Use for internal or small campaigns only.</p>
      </div>
    </div>
  )
}
