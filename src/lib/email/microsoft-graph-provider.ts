import type { EmailProvider, SendEmailOptions, SendEmailResult, WebhookEvent } from './provider'
import { graphPost, getAzureMailbox } from '@/lib/microsoft-graph'

export class MicrosoftGraphProvider implements EmailProvider {
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const mailbox = getAzureMailbox()
      if (!mailbox) {
        throw new Error(
          'No mailbox configured. Set AZURE_INBOX_EMAIL or MAIL_FROM_ADDRESS in env.'
        )
      }

      // Parse display name and address from "Name <email>" or plain "email"
      const fromMatch = options.from?.match(/^(.*?)\s*<(.+)>$/)
      const fromAddress = fromMatch ? fromMatch[2].trim() : (options.from?.trim() ?? mailbox)
      const fromName = fromMatch ? fromMatch[1].trim() : ''

      await graphPost(`/users/${encodeURIComponent(mailbox)}/sendMail`, {
        message: {
          subject: options.subject,
          body: {
            contentType: 'HTML',
            content: options.html,
          },
          from: {
            emailAddress: {
              address: fromAddress,
              name: fromName || fromAddress,
            },
          },
          toRecipients: [
            {
              emailAddress: {
                address: options.to,
                name: options.to,
              },
            },
          ],
          ...(options.replyTo
            ? {
                replyTo: [
                  { emailAddress: { address: options.replyTo } },
                ],
              }
            : {}),
        },
        saveToSentItems: true,
      })

      return {
        messageId: `graph-${Date.now()}`,
        success: true,
      }
    } catch (err) {
      return {
        messageId: '',
        success: false,
        error: err instanceof Error ? err.message : 'Graph API send failed',
      }
    }
  }

  // Graph API webhooks not used — no-op
  handleWebhook(_payload: unknown): WebhookEvent | null {
    return null
  }
}
