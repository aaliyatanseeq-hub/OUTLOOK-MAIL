import { prisma } from '@/lib/prisma'

/**
 * Resolves the "From" display name and email address.
 * Priority: DB (saved via Settings UI) → MAIL_FROM_ADDRESS/MAIL_FROM_NAME env vars
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

  // Fallback: MAIL_FROM_ADDRESS + MAIL_FROM_NAME env vars
  const envAddress = process.env.MAIL_FROM_ADDRESS?.trim() ?? ''
  const envName    = process.env.MAIL_FROM_NAME?.trim() ?? ''
  if (envAddress) {
    return { name: envName, email: envAddress }
  }

  return { name: '', email: '' }
}

/**
 * Builds the formatted "From" string for the email provider.
 * e.g. "Aaliya <aaliya@yourdomain.com>"
 */
export function formatFrom(name: string, email: string): string {
  return name ? `${name} <${email}>` : email
}
