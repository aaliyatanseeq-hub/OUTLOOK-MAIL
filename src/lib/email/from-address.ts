import { prisma } from '@/lib/prisma'

/**
 * Resolves the "From" display name and email address.
 * Priority: DB (saved via Settings UI) → MAIL_FROM env → SMTP_USER env
 */
export async function getSenderConfig(): Promise<{ name: string; email: string }> {
  const [nameRow, emailRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'sender_name' } }),
    prisma.appSetting.findUnique({ where: { key: 'sender_email' } }),
  ])

  if (nameRow?.value || emailRow?.value) {
    return {
      name:  nameRow?.value  ?? '',
      email: emailRow?.value ?? '',
    }
  }

  // Fallback: parse MAIL_FROM="Display Name <email@example.com>"
  const envFrom  = process.env.MAIL_FROM?.trim() ?? ''
  const envMatch = envFrom.match(/^(.*?)\s*<([^>]+)>$/)
  if (envMatch) {
    return { name: envMatch[1].trim(), email: envMatch[2].trim() }
  }

  // Last resort: bare SMTP_USER
  const smtpUser = process.env.SMTP_USER?.trim() ?? ''
  return { name: '', email: smtpUser }
}

/**
 * Builds the formatted "From" string for the email provider.
 * e.g. "Aaliya <afraaaliya471@gmail.com>"
 */
export function formatFrom(name: string, email: string): string {
  return name ? `${name} <${email}>` : email
}
