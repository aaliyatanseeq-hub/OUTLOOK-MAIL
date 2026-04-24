import { EmailProvider } from './provider'
import { MicrosoftGraphProvider } from './microsoft-graph-provider'
import { ResendProvider } from './resend-provider'
import { SmtpProvider } from './smtp-provider'
import { prisma } from '@/lib/prisma'

export type EmailProviderId = 'smtp' | 'resend' | 'microsoft'

function normalise(raw: string): EmailProviderId {
  const v = raw.toLowerCase().trim()
  if (v === 'microsoft' || v === 'graph' || v === 'm365') return 'microsoft'
  if (v === 'resend') return 'resend'
  return 'smtp' // default
}

/** Reads from DB first (runtime-switchable), falls back to EMAIL_PROVIDER env var. */
export async function getEmailProviderId(): Promise<EmailProviderId> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'active_email_provider' },
    })
    if (setting?.value) return normalise(setting.value)
  } catch {
    // DB unavailable — fall through to env
  }
  return normalise(process.env.EMAIL_PROVIDER || 'smtp')
}

export async function getEmailProvider(): Promise<EmailProvider> {
  const id = await getEmailProviderId()
  if (id === 'microsoft') return new MicrosoftGraphProvider()
  if (id === 'resend') return new ResendProvider()
  return new SmtpProvider()
}
