import { EmailProvider } from './provider'
import { SmtpProvider } from './smtp-provider'

export type EmailProviderId = 'smtp'

/** Always returns smtp — the only active provider. */
export async function getEmailProviderId(): Promise<EmailProviderId> {
  return 'smtp'
}

export async function getEmailProvider(): Promise<EmailProvider> {
  return new SmtpProvider()
}
