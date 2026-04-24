import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim()

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY is not set in .env.local' })
  }
  if (!fromEmail) {
    return NextResponse.json({ ok: false, error: 'RESEND_FROM_EMAIL is not set in .env.local' })
  }
  if (!apiKey.startsWith('re_')) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY looks incorrect — should start with "re_"' })
  }

  const fromDomain = fromEmail.split('@')[1] || ''
  const isTestSender = fromEmail.toLowerCase() === 'onboarding@resend.dev'

  // Try /domains — full-access keys succeed, send-only keys return 403, invalid keys return 401
  let domainsStatus: number | null = null
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    domainsStatus = res.status

    if (res.status === 401) {
      return NextResponse.json({
        ok: false,
        error: 'API key is invalid or revoked (Resend returned 401). Re-generate your key at resend.com/api-keys.',
      })
    }

    if (res.status === 403) {
      // Key is valid but send-only — can't read domains, but CAN send emails
      return NextResponse.json({
        ok: true,
        keyValid: true,
        keyType: 'send-only (restricted)',
        fromEmail,
        fromDomain,
        domainStatus: isTestSender ? 'resend-test-address' : 'cannot verify — restricted key',
        senderReady: true,
        hint: isTestSender
          ? 'Using Resend test address (onboarding@resend.dev). Can only send to your own Resend account email. To send to anyone, verify a domain at resend.com/domains and update RESEND_FROM_EMAIL.'
          : `Key is valid (send-only). Ensure domain "${fromDomain}" is verified at resend.com/domains. You need a full-access key to check domain status here.`,
      })
    }

    if (res.ok) {
      const json = await res.json().catch(() => ({}))
      const domains: Array<{ name: string; status: string }> = json?.data ?? []
      const domainEntry = domains.find(
        (d) => d.name.toLowerCase() === fromDomain.toLowerCase()
      )
      const senderReady = isTestSender || domainEntry?.status === 'verified'

      return NextResponse.json({
        ok: true,
        keyValid: true,
        keyType: 'full access',
        fromEmail,
        fromDomain,
        domainStatus: domainEntry?.status ?? 'not_added_yet',
        senderReady,
        domainsConfigured: domains.length,
        hint: senderReady
          ? 'All good — ready to send.'
          : `Domain "${fromDomain}" is not verified. Add DNS records at resend.com/domains.`,
      })
    }
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: `Network error reaching Resend API: ${err instanceof Error ? err.message : 'Unknown'}`,
      domainsStatus,
    })
  }

  return NextResponse.json({ ok: false, error: `Unexpected Resend API response (HTTP ${domainsStatus})` })
}
