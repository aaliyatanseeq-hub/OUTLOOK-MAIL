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

const COUNTRY_CODES = [
  { label: '🇦🇪  +971', value: '+971' },
  { label: '🇸🇦  +966', value: '+966' },
  { label: 'Other',    value: 'other' },
]

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

  function phoneError(code: string, number: string, label: string): string | undefined {
    const d = digitsOnly(number)
    if (!number.trim()) return `${label} is required.`
    if (code === '+971') {
      // UAE: 8 digits (landline e.g. 41234567) or 9 digits (mobile e.g. 501234567)
      if (d.length < 8) return 'UAE numbers must be at least 8 digits.'
      if (d.length > 9) return 'UAE numbers must not exceed 9 digits.'
    } else if (code === '+966') {
      // KSA: 9 digits (mobile e.g. 501234567)
      if (d.length < 8) return 'KSA numbers must be at least 8 digits.'
      if (d.length > 9) return 'KSA numbers must not exceed 9 digits.'
    } else {
      if (d.length < 7)  return 'Please enter a valid phone number.'
      if (d.length > 12) return 'Phone number is too long.'
    }
    return undefined
  }

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
    } else {
      const err = phoneError(workCode === 'other' ? workCustomCode : workCode, workNumber, 'Work phone number')
      if (err) e.workPhone = err
    }

    if (personalNumber.trim()) {
      if (personalCode === 'other' && !personalCustomCode.trim()) {
        e.personalPhone = 'Please enter your country code.'
      } else {
        const err = phoneError(personalCode === 'other' ? personalCustomCode : personalCode, personalNumber, 'Personal phone number')
        if (err && err !== 'Personal phone number is required.') e.personalPhone = err
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
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">Tanseeq Investment — HR Department</span>
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
        <div className="relative shrink-0 border-r border-slate-700">
          <select
            value={code}
            onChange={e => onCodeChange(e.target.value)}
            className="appearance-none bg-slate-800 text-slate-200 text-sm pl-3 pr-7 py-2.5 outline-none cursor-pointer h-full"
          >
            {COUNTRY_CODES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">▾</span>
        </div>
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
        <input
          type="tel"
          value={number}
          onChange={e => onNumberChange(e.target.value.replace(/[^\d\s\-]/g, ''))}
          className="flex-1 bg-slate-800 text-slate-100 text-sm px-3 py-2.5 outline-none"
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
