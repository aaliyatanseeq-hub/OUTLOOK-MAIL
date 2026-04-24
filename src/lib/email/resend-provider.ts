import { Resend } from 'resend'
import { EmailProvider, SendEmailOptions, SendEmailResult, WebhookEvent } from './provider'

export class ResendProvider implements EmailProvider {
  private getClient() {
    return new Resend(process.env.RESEND_API_KEY)
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const resend = this.getClient()
    try {
      const response = await resend.emails.send({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo,
        headers: options.headers,
      })

      if (response.error) {
        return {
          messageId: '',
          success: false,
          error: response.error.message || 'Unknown error',
        }
      }

      return {
        messageId: response.data?.id || '',
        success: true,
      }
    } catch (error) {
      return {
        messageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  handleWebhook(payload: any): WebhookEvent | null {
    // Resend webhook payload structure
    const { type, data } = payload

    if (!type || !data) {
      return null
    }

    // Map Resend event types to our event types
    let eventType: WebhookEvent['type'] | null = null
    
    switch (type) {
      case 'email.sent':
        eventType = 'sent'
        break
      case 'email.delivered':
        eventType = 'delivered'
        break
      case 'email.opened':
        eventType = 'opened'
        break
      case 'email.clicked':
        eventType = 'clicked'
        break
      case 'email.bounced':
        eventType = 'bounced'
        break
      case 'email.failed':
        eventType = 'failed'
        break
    }

    if (!eventType) {
      return null
    }

    return {
      type: eventType,
      messageId: data.email_id || data.message_id || '',
      timestamp: new Date(data.created_at || Date.now()),
      metadata: data,
    }
  }
}
