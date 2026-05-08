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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} from 'lucide-react'

interface SettingsData {
  active: 'smtp'
  source: 'db' | 'env'
  smtp: { configured: boolean; host: string | null; user: string | null; mailFrom: string | null }
  googleInbox: {
    configured: boolean
    source: 'db' | 'env' | 'none'
    connectedEmail: string | null
    tokenUpdatedAt: string | null
    encryptionEnabled: boolean
    oauthClientConfigured: boolean
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

  const [smtpTest, setSmtpTest] = useState<TestResult | null>(null)
  const [smtpTestState, setSmtpTestState] = useState<TestState>('idle')
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [googleOauthNotice, setGoogleOauthNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Sender config state
  const [senderName, setSenderName]   = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [senderSource, setSenderSource] = useState<'db' | 'env'>('env')
  const [savingSender, setSavingSender] = useState(false)
  const [senderSaved, setSenderSaved]   = useState(false)
  const [senderError, setSenderError]   = useState<string | null>(null)

  function normalizeSettings(data: Partial<SettingsData>): SettingsData {
    return {
      active: 'smtp',
      source: (data.source ?? 'env') as 'db' | 'env',
      smtp: data.smtp ?? { configured: false, host: null, user: null, mailFrom: null },
      googleInbox: data.googleInbox ?? {
        configured: false,
        source: 'none',
        connectedEmail: null,
        tokenUpdatedAt: null,
        encryptionEnabled: false,
        oauthClientConfigured: false,
      },
    }
  }

  async function loadSettings() {
    setLoadingSettings(true)
    try {
      const [settingsRes, senderRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings/sender'),
      ])
      const rawSettings = await settingsRes.json()
      setSettings(normalizeSettings(rawSettings))
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

    const params = new URLSearchParams(window.location.search)
    const oauthStatus = params.get('google_oauth')
    const reason = params.get('reason')
    if (!oauthStatus) return

    if (oauthStatus === 'connected') {
      setGoogleOauthNotice({
        type: 'success',
        message: 'Gmail inbox connected successfully. Future token updates will stay on backend.',
      })
      void loadSettings()
    } else {
      setGoogleOauthNotice({
        type: 'error',
        message: `Gmail reconnect failed${reason ? ` (${reason})` : ''}.`,
      })
    }

    params.delete('google_oauth')
    params.delete('reason')
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [])

  function startGoogleReconnect() {
    setConnectingGoogle(true)
    window.location.href = '/api/oauth/google/start?returnTo=/settings'
  }

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

  async function runSmtpTest() {
    setSmtpTestState('loading')
    setSmtpTest(null)
    try {
      const res = await fetch('/api/settings/test/smtp')
      setSmtpTest(await res.json())
    } catch (e) {
      setSmtpTest({ ok: false, error: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setSmtpTestState('done')
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

  const googleSourceLabel =
    settings.googleInbox.source === 'db'
      ? 'Stored in database'
      : settings.googleInbox.source === 'env'
      ? 'Using env fallback'
      : 'Not connected'
  const googleUpdatedLabel = settings.googleInbox.tokenUpdatedAt
    ? new Date(settings.googleInbox.tokenUpdatedAt).toLocaleString()
    : null

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

      {/* Active provider banner */}
      <div className="card flex items-center gap-3">
        <ServerIcon className="w-5 h-5 text-indigo-300 shrink-0" />
        <div>
          <p className="text-sm text-slate-300">
            Active provider: <span className="font-semibold text-white">Google SMTP (Gmail)</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            All emails are sent via Gmail SMTP using your App Password.
          </p>
        </div>
      </div>

      {/* Gmail inbox OAuth for reply sync */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-white text-sm">Gmail Inbox OAuth</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Used by Inbox Sync to read replies. Keeps refresh token on backend.
            </p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded border ${
              settings.googleInbox.configured
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/25'
            }`}
          >
            {settings.googleInbox.configured ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {googleOauthNotice && (
          <p
            className={`text-xs flex items-center gap-1 ${
              googleOauthNotice.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {googleOauthNotice.type === 'success' ? (
              <CheckCircle2Icon className="w-3.5 h-3.5" />
            ) : (
              <XCircleIcon className="w-3.5 h-3.5" />
            )}
            {googleOauthNotice.message}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-500">Token source</p>
            <p className="text-slate-200 mt-0.5">{googleSourceLabel}</p>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
            <p className="text-slate-500">Connected inbox</p>
            <p className="text-slate-200 mt-0.5">{settings.googleInbox.connectedEmail || 'Unknown'}</p>
          </div>
        </div>

        <div className="text-xs text-slate-500 space-y-1">
          <p>
            Last token update: <span className="text-slate-300">{googleUpdatedLabel ?? 'n/a'}</span>
          </p>
          {!settings.googleInbox.encryptionEnabled && (
            <p className="text-amber-300 flex items-start gap-1">
              <AlertTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Set <code className="bg-slate-800 px-1 rounded text-slate-200">GOOGLE_TOKEN_ENCRYPTION_KEY</code> to encrypt DB-stored refresh tokens.
            </p>
          )}
          {!settings.googleInbox.oauthClientConfigured && (
            <p className="text-rose-300">
              Missing <code className="bg-slate-800 px-1 rounded text-slate-200">GOOGLE_CLIENT_ID</code> or
              <code className="bg-slate-800 px-1 rounded text-slate-200 ml-1">GOOGLE_CLIENT_SECRET</code>.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startGoogleReconnect}
            disabled={connectingGoogle || !settings.googleInbox.oauthClientConfigured}
            className="button-primary disabled:opacity-50"
          >
            {connectingGoogle ? (
              <LoaderIcon className="w-4 h-4 animate-spin" />
            ) : (
              <ZapIcon className="w-4 h-4" />
            )}
            {connectingGoogle ? 'Redirecting...' : settings.googleInbox.configured ? 'Reconnect Gmail' : 'Connect Gmail'}
          </button>
          <span className="text-xs text-slate-500">
            Keeps working URL and updates backend token safely.
          </span>
        </div>
      </div>

      {/* SMTP card */}
      <div className="card space-y-4 border-indigo-400/40 bg-indigo-500/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-2 h-2 rounded-full shrink-0 ${settings.smtp.configured ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <h3 className="font-semibold text-white text-sm">Google SMTP (Gmail)</h3>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded">Active</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Sends via Gmail using an App Password and Nodemailer. 500 emails/day on free Gmail.
          </p>
        </div>
        <p className={`text-xs ${settings.smtp.configured ? 'text-slate-400' : 'text-rose-400'}`}>
          {settings.smtp.user
            ? `From: ${settings.smtp.mailFrom || settings.smtp.user} via ${settings.smtp.host}`
            : 'SMTP_HOST / SMTP_USER / SMTP_PASS not set in environment'}
        </p>
        <button
          onClick={runSmtpTest}
          disabled={smtpTestState === 'loading' || !settings.smtp.configured}
          className="button-secondary w-full justify-center disabled:opacity-50"
        >
          {smtpTestState === 'loading' ? (
            <LoaderIcon className="w-4 h-4 animate-spin" />
          ) : (
            <ZapIcon className="w-4 h-4" />
          )}
          {smtpTestState === 'loading' ? 'Testing…' : 'Test Connection'}
        </button>
        {smtpTest && <TestResultBox result={smtpTest} />}
      </div>

      {/* Env reference */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-white text-sm">Environment variables reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <p className="text-emerald-300 font-semibold">Gmail SMTP (sending)</p>
            <code className="block text-slate-400">SMTP_HOST=smtp.gmail.com</code>
            <code className="block text-slate-400">SMTP_PORT=587</code>
            <code className="block text-slate-400">SMTP_USER=you@gmail.com</code>
            <code className="block text-slate-400">SMTP_PASS=app-password</code>
            <code className="block text-slate-400">MAIL_FROM="Name &lt;you@gmail.com&gt;"</code>
          </div>
          <div className="space-y-1">
            <p className="text-cyan-300 font-semibold">Gmail Inbox OAuth (receiving)</p>
            <code className="block text-slate-400">GOOGLE_CLIENT_ID</code>
            <code className="block text-slate-400">GOOGLE_CLIENT_SECRET</code>
            <code className="block text-slate-400">GOOGLE_INBOX_EMAIL</code>
            <code className="block text-slate-400">GOOGLE_REFRESH_TOKEN (fallback)</code>
            <code className="block text-slate-400">GOOGLE_TOKEN_ENCRYPTION_KEY</code>
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
