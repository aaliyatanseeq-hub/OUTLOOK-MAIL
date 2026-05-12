import { EmailProvider } from './provider'
import { MicrosoftGraphProvider } from './microsoft-graph-provider'

export type EmailProviderId = 'microsoft-graph'

/** Always returns Microsoft Graph provider. */
export async function getEmailProviderId(): Promise<EmailProviderId> {
  return 'microsoft-graph'
}

export async function getEmailProvider(): Promise<EmailProvider> {
  return new MicrosoftGraphProvider()
}
