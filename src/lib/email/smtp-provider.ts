import nodemailer from 'nodemailer'
import type { EmailProvider, SendEmailOptions, SendEmailResult, WebhookEvent } from './provider'

function createTransporter() {
  const host = process.env.SMTP_HOST?.trim()
  const port = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()

  if (!host || !port || !user || !pass) {
    throw new Error(
      'Missing SMTP config. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.local'
    )
  }

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465, // true only for port 465 (SSL); 587 uses STARTTLS
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  })
}

export class SmtpProvider implements EmailProvider {
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const transporter = createTransporter()

      // Use MAIL_FROM env if set, otherwise fall back to SMTP_USER
      const from =
        process.env.MAIL_FROM?.trim() ||
        process.env.SMTP_USER?.trim() ||
        options.from

      const info = await transporter.sendMail({
        from,
        to: options.to,
        replyTo: options.replyTo,
        subject: options.subject,
        text: options.html?.replace(/<[^>]*>/g, '') ?? '',
        html: options.html,
      })

      return {
        messageId: info.messageId ?? '',
        success: true,
      }
    } catch (err) {
      return {
        messageId: '',
        success: false,
        error: err instanceof Error ? err.message : 'SMTP send failed',
      }
    }
  }

  // SMTP has no inbound webhook — no-op
  handleWebhook(_payload: unknown): WebhookEvent | null {
    return null
  }
}
