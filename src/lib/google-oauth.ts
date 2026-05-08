import crypto from 'node:crypto'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

const GOOGLE_REFRESH_TOKEN_KEY = 'google_oauth_refresh_token'
const GOOGLE_CONNECTED_EMAIL_KEY = 'google_oauth_connected_email'
const GOOGLE_INBOX_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const ENCRYPTED_PREFIX = 'enc:v1:'

export type GoogleRefreshTokenSource = 'db' | 'env' | 'none'

type GoogleStoredToken = {
  token: string | null
  source: GoogleRefreshTokenSource
  updatedAt: Date | null
}

function getEncryptionKey(): Buffer | null {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()
  if (!raw) return null
  return crypto.createHash('sha256').update(raw).digest()
}

function encryptRefreshToken(value: string): string {
  const key = getEncryptionKey()
  if (!key) return value

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

function decryptRefreshToken(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value

  const key = getEncryptionKey()
  if (!key) {
    throw new Error('Missing GOOGLE_TOKEN_ENCRYPTION_KEY required to decrypt stored Gmail OAuth token.')
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length)
  const parts = payload.split('.')
  if (parts.length !== 3) throw new Error('Stored Gmail OAuth token has invalid format.')

  const iv = Buffer.from(parts[0], 'base64url')
  const tag = Buffer.from(parts[1], 'base64url')
  const encrypted = Buffer.from(parts[2], 'base64url')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim()
  )
}

export function getGoogleOAuthScopes(): string[] {
  return [GOOGLE_INBOX_SCOPE]
}

export function createGoogleOAuthClient(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.')
  }

  const redirectUri = `${origin}/api/oauth/google/callback`
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function getGoogleRefreshToken(): Promise<GoogleStoredToken> {
  const tokenRow = await prisma.appSetting.findUnique({
    where: { key: GOOGLE_REFRESH_TOKEN_KEY },
  })

  if (tokenRow?.value) {
    try {
      return {
        token: decryptRefreshToken(tokenRow.value),
        source: 'db',
        updatedAt: tokenRow.updatedAt,
      }
    } catch {
      const envToken = process.env.GOOGLE_REFRESH_TOKEN?.trim() ?? ''
      if (envToken) {
        return {
          token: envToken,
          source: 'env',
          updatedAt: null,
        }
      }
      throw new Error('Stored Gmail OAuth token cannot be decrypted. Set GOOGLE_TOKEN_ENCRYPTION_KEY or reconnect Gmail.')
    }
  }

  const envToken = process.env.GOOGLE_REFRESH_TOKEN?.trim() ?? ''
  if (envToken) {
    return {
      token: envToken,
      source: 'env',
      updatedAt: null,
    }
  }

  return {
    token: null,
    source: 'none',
    updatedAt: null,
  }
}

export async function saveGoogleRefreshToken(token: string, email?: string | null) {
  const data = encryptRefreshToken(token.trim())

  const writes = [
    prisma.appSetting.upsert({
      where: { key: GOOGLE_REFRESH_TOKEN_KEY },
      update: { value: data },
      create: { key: GOOGLE_REFRESH_TOKEN_KEY, value: data },
    }),
  ]

  if (email?.trim()) {
    writes.push(
      prisma.appSetting.upsert({
        where: { key: GOOGLE_CONNECTED_EMAIL_KEY },
        update: { value: email.trim().toLowerCase() },
        create: { key: GOOGLE_CONNECTED_EMAIL_KEY, value: email.trim().toLowerCase() },
      }),
    )
  }

  await Promise.all(writes)
}

export async function getGoogleOAuthStatus() {
  const [tokenRow, emailRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: GOOGLE_REFRESH_TOKEN_KEY } }),
    prisma.appSetting.findUnique({ where: { key: GOOGLE_CONNECTED_EMAIL_KEY } }),
  ])

  const hasEnvToken = !!(process.env.GOOGLE_REFRESH_TOKEN?.trim())
  const hasDbToken = !!tokenRow?.value

  const source: GoogleRefreshTokenSource = hasDbToken ? 'db' : hasEnvToken ? 'env' : 'none'

  return {
    configured: source !== 'none',
    source,
    connectedEmail: emailRow?.value ?? process.env.GOOGLE_INBOX_EMAIL?.trim() ?? null,
    tokenUpdatedAt: tokenRow?.updatedAt?.toISOString() ?? null,
    encryptionEnabled: !!getEncryptionKey(),
  }
}

export async function getGoogleInboxEmail(): Promise<string> {
  const emailRow = await prisma.appSetting.findUnique({
    where: { key: GOOGLE_CONNECTED_EMAIL_KEY },
  })

  return (
    emailRow?.value?.trim().toLowerCase() ||
    process.env.GOOGLE_INBOX_EMAIL?.trim().toLowerCase() ||
    process.env.SMTP_USER?.trim().toLowerCase() ||
    ''
  )
}
