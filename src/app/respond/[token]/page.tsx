'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2Icon, AlertTriangleIcon, LoaderIcon, SendIcon, ShieldCheckIcon } from 'lucide-react'

interface EmployeeInfo {
  toName: string
  toEmail: string
  alreadySubmitted: boolean
  submittedAt: string | null
}

interface FormErrors {
  employeeId?: string
  workPhone?: string
  personalPhone?: string
}

type Stage = 'loading' | 'not-found' | 'already-submitted' | 'form' | 'confirm' | 'success'


const TANSEEQ_LOGO = 'data:image/png;base64,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'

export default function RespondPage() {
  const { token } = useParams<{ token: string }>()
  const [stage, setStage]   = useState<Stage>('loading')
  const [info, setInfo]     = useState<EmployeeInfo | null>(null)
  const [employeeId, setEmployeeId]     = useState('')
  const [workCode, setWorkCode]             = useState('+971')
  const [workCustomCode, setWorkCustomCode] = useState('')
  const [workNumber, setWorkNumber]         = useState('')
  const [personalCode, setPersonalCode]             = useState('+971')
  const [personalCustomCode, setPersonalCustomCode] = useState('')
  const [personalNumber, setPersonalNumber]         = useState('')
  const [errors, setErrors]   = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const resolvedWorkCode     = workCode === 'other'     ? workCustomCode.trim()     : workCode
  const resolvedPersonalCode = personalCode === 'other' ? personalCustomCode.trim() : personalCode
  const workPhone     = workNumber.trim()     ? `${resolvedWorkCode} ${workNumber.trim()}`     : ''
  const personalPhone = personalNumber.trim() ? `${resolvedPersonalCode} ${personalNumber.trim()}` : ''

  useEffect(() => {
    fetch(`/api/respond/${token}`)
      .then(r => r.json())
      .then((data) => {
        if (data.error) { setStage('not-found'); return }
        setInfo(data)
        setStage(data.alreadySubmitted ? 'already-submitted' : 'form')
      })
      .catch(() => setStage('not-found'))
  }, [token])

  function digitsOnly(v: string) { return v.replace(/\D/g, '') }

  function validate(): boolean {
    const e: FormErrors = {}
    const empId = employeeId.trim()

    if (!empId) {
      e.employeeId = 'Employee ID is required.'
    } else if (empId.length < 5) {
      e.employeeId = 'Employee ID must be at least 5 characters.'
    } else if (empId.length > 6) {
      e.employeeId = 'Employee ID must not exceed 6 characters.'
    }

    if (workCode === 'other' && !workCustomCode.trim()) {
      e.workPhone = 'Please enter your country code.'
    } else if (!workNumber.trim()) {
      e.workPhone = 'Work phone number is required.'
    } else if (digitsOnly(workNumber).length < 7) {
      e.workPhone = 'Please enter a valid work phone number.'
    } else if (digitsOnly(workNumber).length > 12) {
      e.workPhone = 'Phone number is too long.'
    }

    if (personalNumber.trim()) {
      if (personalCode === 'other' && !personalCustomCode.trim()) {
        e.personalPhone = 'Please enter your country code.'
      } else if (digitsOnly(personalNumber).length < 7) {
        e.personalPhone = 'Please enter a valid personal phone number.'
      } else if (digitsOnly(personalNumber).length > 12) {
        e.personalPhone = 'Phone number is too long.'
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) setStage('confirm')
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/respond/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employeeId.trim(),
          workPhone,
          personalPhone,
        }),
      })
      const data = await res.json()
      if (res.status === 409 || data.error) {
        setStage('already-submitted')
      } else if (data.success) {
        setStage('success')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-slate-400">
          <LoaderIcon className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      </Shell>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────
  if (stage === 'not-found') {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <AlertTriangleIcon className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-semibold text-white">Invalid Link</h2>
          <p className="text-slate-400 text-sm">This link is invalid or has already been used. Please contact the HR Department if you require assistance.</p>
        </div>
      </Shell>
    )
  }

  // ── Already submitted ────────────────────────────────────────────────
  if (stage === 'already-submitted') {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <CheckCircle2Icon className="w-14 h-14 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-semibold text-white">Already Submitted</h2>
          <p className="text-slate-400 text-sm">
            Your details have already been recorded.
            {info?.submittedAt && (
              <> Submitted on {new Date(info.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.</>
            )}
          </p>
          <p className="text-slate-500 text-xs">If you believe this is an error, please contact the HR Department.</p>
        </div>
      </Shell>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <CheckCircle2Icon className="w-14 h-14 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-semibold text-white">Submission Successful</h2>
          <p className="text-slate-300 text-sm">Your details have been securely submitted to the HR Department.</p>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-left text-sm space-y-2 mt-2">
            <Row label="Employee ID"    value={employeeId} />
            <Row label="Work Phone"     value={workPhone} />
            {personalPhone && <Row label="Personal Phone" value={personalPhone} />}
          </div>
          <p className="text-slate-500 text-xs pt-2">You may now close this window.</p>
        </div>
      </Shell>
    )
  }

  // ── Confirm screen ───────────────────────────────────────────────────
  if (stage === 'confirm') {
    return (
      <Shell>
        <div className="space-y-5 w-full">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-white">Confirm Your Details</h2>
            <p className="text-slate-400 text-sm">Please review carefully before submitting. This cannot be changed once submitted.</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3 text-sm">
            <Row label="Name"           value={info?.toName ?? ''} />
            <Row label="Email"          value={info?.toEmail ?? ''} />
            <Row label="Employee ID"    value={employeeId} />
            <Row label="Work Phone"     value={workPhone} />
            <Row label="Personal Phone" value={personalPhone || '—'} />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStage('form')}
              className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
              {submitting ? 'Submitting…' : 'Confirm & Submit'}
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="space-y-5 w-full">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto">
            <span className="text-indigo-300 text-xl font-bold">
              {(info?.toName || '?')[0].toUpperCase()}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-white">Dear {info?.toName?.split(' ')[0]},</h2>
        </div>

        {/* Notice box */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-4 h-4 text-indigo-400 shrink-0" />
            <p className="text-xs font-semibold text-slate-300 tracking-wide">Employee Records Verification</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            As part of our periodic records maintenance, kindly verify and submit your current contact details. Please ensure the information provided is accurate and up to date.
          </p>
        </div>

        {/* Identity — read-only */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-3 text-sm">
          <p className="text-slate-500 text-xs mb-0.5">Submitting as</p>
          <p className="text-slate-200 font-medium">
            {info?.toName}
            <span className="text-slate-500 font-normal mx-2">·</span>
            <span className="text-slate-400">{info?.toEmail}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleReview} className="space-y-4">

          {/* Employee ID */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">
              Employee ID <span className="text-rose-400">*</span>
              <span className="text-slate-500 text-xs font-normal ml-2">(5–6 characters)</span>
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              maxLength={6}
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-800 border text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors ${errors.employeeId ? 'border-rose-500' : 'border-slate-700'}`}
            />
            {errors.employeeId && <p className="text-xs text-rose-400">{errors.employeeId}</p>}
          </div>

          {/* Work Phone */}
          <PhoneField
            label="Work Phone Number"
            required
            code={workCode}
            onCodeChange={setWorkCode}
            customCode={workCustomCode}
            onCustomCodeChange={setWorkCustomCode}
            number={workNumber}
            onNumberChange={setWorkNumber}
            error={errors.workPhone}
          />

          {/* Personal Phone */}
          <PhoneField
            label="Personal Phone Number"
            required={false}
            code={personalCode}
            onCodeChange={setPersonalCode}
            customCode={personalCustomCode}
            onCustomCodeChange={setPersonalCustomCode}
            number={personalNumber}
            onNumberChange={setPersonalNumber}
            error={errors.personalPhone}
          />

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            Review & Submit
          </button>
        </form>

        <p className="text-center text-xs text-slate-600">
          This submission is associated with <span className="text-slate-500">{info?.toEmail}</span>.
        </p>
      </div>
    </Shell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        {/* Header: logo + department label */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <img
            src={TANSEEQ_LOGO}
            alt="Tanseeq Investment"
            className="h-8 w-auto object-contain"
          />
          <div>
            <p className="text-xs font-semibold text-slate-300 tracking-wide">Tanseeq Investment LLC</p>
            <p className="text-xs text-slate-500">HR Department</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function PhoneField({
  label, required, code, onCodeChange, customCode, onCustomCodeChange, number, onNumberChange, error,
}: {
  label: string
  required: boolean
  code: string
  onCodeChange: (v: string) => void
  customCode: string
  onCustomCodeChange: (v: string) => void
  number: string
  onNumberChange: (v: string) => void
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-300">
        {label}
        {required
          ? <span className="text-rose-400 ml-1">*</span>
          : <span className="text-slate-500 text-xs font-normal ml-2">(optional)</span>}
      </label>
      <div className={`flex rounded-xl border overflow-hidden transition-colors ${error ? 'border-rose-500' : 'border-slate-700 focus-within:border-indigo-500'}`}>
        {/* Country code selector — compact, styled */}
        <div className="relative shrink-0">
          <select
            value={code}
            onChange={e => onCodeChange(e.target.value)}
            className="h-full appearance-none bg-slate-800 text-slate-200 text-sm pl-3 pr-7 outline-none cursor-pointer border-r border-slate-700 min-w-[96px]"
          >
            <option value="+971">🇦🇪 +971</option>
            <option value="+966">🇸🇦 +966</option>
            <option value="other">Other</option>
          </select>
          {/* chevron */}
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">▾</span>
        </div>

        {/* Custom code input — only when "Other" is selected */}
        {code === 'other' && (
          <input
            type="text"
            value={customCode}
            onChange={e => onCustomCodeChange('+' + e.target.value.replace(/[^\d]/g, ''))}
            placeholder="+XXX"
            maxLength={5}
            className="w-16 bg-slate-800 text-slate-100 text-sm px-2 py-2.5 outline-none border-r border-slate-700 text-center"
          />
        )}

        {/* Phone number input */}
        <input
          type="tel"
          value={number}
          onChange={e => onNumberChange(e.target.value.replace(/[^\d\s\-]/g, ''))}
          className="flex-1 bg-slate-800 text-slate-100 text-sm px-3 py-2.5 outline-none min-w-0"
        />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-200 text-right font-medium">{value}</span>
    </div>
  )
}
