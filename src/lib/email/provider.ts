// Email provider abstraction interface

export interface SendEmailOptions {
  to: string
  from: string
  subject: string
  html: string
  replyTo?: string
  headers?: Record<string, string>
}

export interface SendEmailResult {
  messageId: string
  success: boolean
  error?: string
}

export interface WebhookEvent {
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  messageId: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>
  handleWebhook(payload: any): WebhookEvent | null
}
