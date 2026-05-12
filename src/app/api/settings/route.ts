export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { isAzureConfigured, getAzureMailbox } from '@/lib/microsoft-graph'

export async function GET() {
  const azureConfigured = isAzureConfigured()
  const mailbox = getAzureMailbox()

  return NextResponse.json({
    active: 'microsoft-graph',
    source: 'env',
    microsoftGraph: {
      configured: azureConfigured,
      mailbox: mailbox || null,
    },
  })
}
