import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET() {
  const host = process.env.SMTP_HOST?.trim()
  const port = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const mailFrom = process.env.MAIL_FROM?.trim()

  const missing: string[] = []
  if (!host) missing.push('SMTP_HOST')
  if (!port) missing.push('SMTP_PORT')
  if (!user) missing.push('SMTP_USER')
  if (!pass) missing.push('SMTP_PASS')

  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      error: `Missing: ${missing.join(', ')} — add these to .env.local`,
    })
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    })

    // verify() checks the connection and auth — does NOT send any email
    await transporter.verify()

    return NextResponse.json({
      ok: true,
      host,
      port,
      user,
      mailFrom: mailFrom || user,
      hint: 'SMTP connection verified. Ready to send emails.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const hint =
      msg.includes('Invalid login') || msg.includes('Username and Password')
        ? 'Login failed. For Gmail: use an App Password (not your regular password). Go to myaccount.google.com → Security → 2-Step Verification → App passwords.'
        : msg.includes('ECONNREFUSED') || msg.includes('connect')
          ? `Cannot connect to ${host}:${port}. Check SMTP_HOST and SMTP_PORT.`
          : msg.includes('self signed') || msg.includes('certificate')
            ? 'TLS certificate issue. Try setting SMTP_PORT=587 for Gmail.'
            : undefined

    return NextResponse.json({ ok: false, error: msg, hint })
  }
}
