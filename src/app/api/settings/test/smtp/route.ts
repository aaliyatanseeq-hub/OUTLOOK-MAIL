export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getGraphAccessToken, isAzureConfigured, getAzureMailbox } from '@/lib/microsoft-graph'

// Tests Azure credentials by fetching an access token from Microsoft.
export async function GET() {
  const missing: string[] = []
  if (!process.env.AZURE_TENANT_ID?.trim()) missing.push('AZURE_TENANT_ID')
  if (!process.env.AZURE_CLIENT_ID?.trim()) missing.push('AZURE_CLIENT_ID')
  if (!process.env.AZURE_CLIENT_SECRET?.trim()) missing.push('AZURE_CLIENT_SECRET')

  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      error: `Missing: ${missing.join(', ')} — add these to your environment variables.`,
    })
  }

  const mailbox = getAzureMailbox()
  if (!mailbox) {
    return NextResponse.json({
      ok: false,
      error: 'Missing AZURE_INBOX_EMAIL or MAIL_FROM_ADDRESS — set the mailbox address.',
    })
  }

  try {
    // This will throw if credentials are wrong
    await getGraphAccessToken()

    return NextResponse.json({
      ok: true,
      hint: 'Azure credentials verified. Microsoft Graph API is ready.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const hint = msg.includes('401') || msg.includes('invalid_client')
      ? 'Invalid client credentials. Check AZURE_CLIENT_ID and AZURE_CLIENT_SECRET.'
      : msg.includes('tenant')
        ? 'Invalid tenant. Check AZURE_TENANT_ID.'
        : msg.includes('403') || msg.includes('Forbidden')
          ? 'Access denied. Ensure Mail.Send and Mail.Read permissions have admin consent in Azure Portal.'
          : undefined

    return NextResponse.json({ ok: false, error: msg, hint })
  }
}
