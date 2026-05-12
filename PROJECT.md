# EmailHub — Complete Project Documentation

> Internal HR email campaign app for Tanseeq Investment LLC.  
> Stack: Next.js 14 · TypeScript · Prisma · PostgreSQL (Neon) · Microsoft Graph API · TailwindCSS · Tiptap

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Project Structure](#2-project-structure)
3. [Database Schema](#3-database-schema)
4. [Backend — API Routes](#4-backend--api-routes)
5. [Frontend — Pages & Components](#5-frontend--pages--components)
6. [Core Library Code](#6-core-library-code)
7. [Email Flow — End to End](#7-email-flow--end-to-end)
8. [Response Form Flow — End to End](#8-response-form-flow--end-to-end)
9. [Key Concepts You Must Know](#9-key-concepts-you-must-know)
10. [Environment Variables](#10-environment-variables)
11. [Deployment](#11-deployment)
12. [What's Left To Do](#12-whats-left-to-do)

---

## 1. What This App Does

HR sends bulk emails to employees (500+) asking them to confirm:
- Employee ID
- Work Phone Number
- Personal Phone Number

Each email contains a **unique personal link** (`/respond/[token]`).  
The employee clicks → sees their name pre-filled → fills 3 fields → confirms → submits.  
Data goes straight into the database. HR sees a live dashboard of who responded.  
Non-responders can be re-emailed with one button click.

---

## 2. Project Structure

```
src/
├── app/
│   ├── (dashboard)/           ← All authenticated dashboard pages
│   │   ├── layout.tsx         ← Sidebar + nav shell
│   │   ├── dashboard/         ← Stats overview
│   │   ├── send/              ← Send emails (manual / CSV / Excel)
│   │   ├── inbox/             ← View inbound Outlook replies
│   │   ├── history/           ← All sent emails log
│   │   ├── responses/         ← Employee form responses + reminder
│   │   ├── templates/         ← Create/edit email templates
│   │   └── settings/          ← Azure config + sender config
│   │
│   ├── respond/[token]/       ← PUBLIC page — employee response form
│   │   └── page.tsx
│   │
│   └── api/
│       ├── send/              ← POST: send email, generate token
│       ├── inbox/             ← GET: list inbound emails
│       │   ├── sync/          ← POST: pull new replies from Outlook
│       │   └── [id]/          ← GET: single email detail
│       ├── respond/[token]/   ← GET: load employee info / POST: submit form
│       ├── responses/
│       │   └── remind/        ← POST: send reminders to non-responders
│       ├── history/           ← GET: sent email history
│       ├── templates/         ← CRUD for email templates
│       ├── settings/          ← GET: Azure config status
│       │   ├── sender/        ← GET/POST: sender name + email
│       │   └── test/smtp/     ← GET: test Azure credentials
│       └── oauth/google/      ← (legacy, unused — kept for reference)
│
├── components/
│   ├── dashboard/             ← Stats cards
│   ├── inbox/                 ← Inbox list + email reader
│   ├── responses/             ← Responses table + remind button
│   ├── send/                  ← Send form (manual/CSV/Excel)
│   ├── settings/              ← Settings panel
│   ├── templates/             ← Template editor
│   └── ui/
│       ├── email-frame.tsx    ← Safe HTML email renderer (iframe)
│       ├── rich-text-editor.tsx ← Tiptap WYSIWYG editor
│       └── theme-toggle.tsx
│
├── lib/
│   ├── prisma.ts              ← Prisma client singleton
│   ├── template.ts            ← {{placeholder}} renderer
│   ├── reply-parser.ts        ← Parse structured text replies
│   ├── microsoft-graph.ts     ← Azure token + Graph API helpers
│   ├── outlook-reader.ts      ← Fetch inbox messages from Graph API
│   └── email/
│       ├── provider.ts        ← EmailProvider interface
│       ├── get-email-provider.ts ← Returns MicrosoftGraphProvider
│       ├── microsoft-graph-provider.ts ← Sends email via Graph API
│       ├── smtp-provider.ts   ← SMTP fallback (unused, kept for reference)
│       └── from-address.ts    ← Resolves sender name + email
│
prisma/
└── schema.prisma              ← Database models
```

---

## 3. Database Schema

### `Template`
Reusable email templates with `{{name}}`, `{{email}}`, `{{responseLink}}` placeholders.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String | e.g. "Records Update Email" |
| description | String? | Optional note |
| senderName | String | Display name |
| senderEmail | String | From address |
| subject | String | Email subject |
| bodyTemplate | String (Text) | HTML body with placeholders |

---

### `SentEmail`
Every individual email sent by the app.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| templateId | String? | FK → Template |
| toName | String | Recipient name |
| toEmail | String | Recipient email |
| subject | String | Rendered subject |
| body | String (Text) | Rendered HTML body |
| provider | String | "microsoft-graph" |
| providerMessageId | String? | Graph API message ID |
| **responseToken** | String? (unique) | 64-char hex token for the response form link |
| **respondedAt** | DateTime? | Set when employee submits the form |
| status | String | sent / failed / delivered / opened / bounced |
| sentAt | DateTime? | When successfully sent |
| failedAt | DateTime? | When failed |
| errorMessage | String? | Error detail if failed |

**Key design decision:** `responseToken` is unique and random (32 random bytes → 64 hex chars). One token per email sent. Once `respondedAt` is set, the form rejects any further submission for that token.

---

### `InboundEmail`
Emails received in the Outlook inbox (synced manually or auto every 2 min).

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| messageId | String (unique) | Outlook Graph message ID — deduplication key |
| threadId | String? | Conversation/thread ID |
| sentEmailId | String? | FK → SentEmail (linked if In-Reply-To matched) |
| fromName | String | Sender display name |
| fromEmail | String | Sender email |
| toEmail | String | Recipient (our mailbox) |
| subject | String | Email subject |
| bodyText | String? | Plain text body |
| bodyHtml | String? | HTML body |
| snippet | String? | Short preview |
| isRead | Boolean | Read/unread state |
| receivedAt | DateTime | When received |

---

### `EmployeeResponse`
Parsed employee data — populated either via form submission or reply email parsing.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| inboundEmailId | String? (unique) | FK → InboundEmail (if from email reply) |
| fromEmail | String | Employee email |
| fromName | String | Employee name |
| employeeId | String? | Parsed: EMPLOYEE ID |
| workPhone | String? | Parsed: WORK PHONE |
| personalPhone | String? | Parsed: PERSONAL PHONE |
| rawText | String? | Original reply text |
| parsedOk | Boolean | true if all 3 fields extracted |
| receivedAt | DateTime | When received/submitted |

---

### `AppSetting`
Key-value store for runtime settings saved via the UI.

| Key | Value |
|---|---|
| `sender_name` | Display name saved from Settings page |
| `sender_email` | From address saved from Settings page |

---

## 4. Backend — API Routes

### `POST /api/send`
Sends a single email to one recipient.

**What it does:**
1. Validates `toName` + `toEmail`
2. Loads template from DB if `templateId` provided
3. Generates a **64-char random `responseToken`** using `crypto.randomBytes(32).toString('hex')`
4. Builds `responseLink = ${APP_URL}/respond/${responseToken}`
5. Renders subject + body with `renderTemplate()` — replaces `{{name}}`, `{{email}}`, `{{responseLink}}`
6. Resolves sender via `getSenderConfig()` (DB → env fallback)
7. Sends via `MicrosoftGraphProvider.sendEmail()`
8. Saves `SentEmail` record to DB with the `responseToken`
9. Returns `{ success, id, error }`

**Key concept — bulk sending:** The frontend calls this endpoint once per recipient in a sequential loop (not parallel) to avoid throttling the Graph API.

---

### `GET /api/respond/[token]`
Called by the response form page on load to get employee info.

- Looks up `SentEmail` by `responseToken`
- Returns `{ toName, toEmail, alreadySubmitted, submittedAt }`
- Returns 404 if token doesn't exist

---

### `POST /api/respond/[token]`
Called when employee submits the form.

**What it does:**
1. Looks up `SentEmail` by `responseToken`
2. Returns 409 if `respondedAt` is already set (duplicate prevention)
3. Validates `employeeId`, `workPhone`, `personalPhone` server-side
4. Checks if an `EmployeeResponse` already exists for that email (extra dedup)
5. Creates `EmployeeResponse` record with `parsedOk: true`
6. Sets `SentEmail.respondedAt = new Date()`
7. Returns `{ success: true }`

---

### `POST /api/inbox/sync`
Pulls new replies from the Outlook inbox into the DB.

**What it does:**
1. Checks Azure is configured
2. Gets all recipient emails from `SentEmail` (the allow-list)
3. Calls `fetchOutlookReplies()` — fetches last 100 inbox messages from Graph API
4. Filters to only messages FROM known recipients
5. Deduplicates by `messageId`
6. For each new message: creates `InboundEmail`
7. If body contains `EMPLOYEE ID` / `WORK PHONE` / `PERSONAL PHONE` — also runs `parseEmployeeReply()` and creates `EmployeeResponse`
8. Returns `{ created, skipped, cleaned }`

---

### `POST /api/responses/remind`
Sends reminder emails to all non-responders.

**What it does:**
1. Queries `SentEmail` where `responseToken IS NOT NULL` AND `respondedAt IS NULL`
2. For each: sends a reminder email with their personal link embedded
3. Returns `{ sent, failed, total }`

---

### `GET /api/responses`
Returns all `EmployeeResponse` rows + stats for the dashboard.

**Stats returned:**
- `totalSent` — distinct email addresses sent to
- `totalResponded` — total responses
- `parsedOk` — responses where all 3 fields are clean
- `needsReview` — responses with missing/unparseable fields
- `pending` — `totalSent - totalResponded`

---

### `GET/PATCH/DELETE /api/inbox`
- **GET:** paginated list of inbound emails with search + unread filter
- **PATCH:** mark message(s) as read
- **DELETE:** purge emails from non-history contacts

---

### `GET /api/settings`
Returns Azure configuration status — whether credentials are set, mailbox address.

### `GET /api/settings/test/smtp`
Tests Azure credentials by fetching an access token. Returns `{ ok, error?, hint? }`.

### `GET/POST /api/settings/sender`
Gets or saves the sender name + email to `AppSetting` table.

---

## 5. Frontend — Pages & Components

### `/respond/[token]` — Employee Response Form (PUBLIC)
The most important new page. No authentication. No login.

**Stages:**
1. `loading` — fetches employee info from API
2. `not-found` — invalid/expired token
3. `already-submitted` — token already used
4. `form` — the actual form
5. `confirm` — review screen before final submit
6. `success` — thank you screen

**What makes it special:**
- Employee's name + email shown read-only — they know it's meant for them
- All 3 fields required with inline error messages
- Confirm screen shows exactly what will be submitted
- On success: permanently locked (any re-visit shows "Already submitted")
- Warning at bottom: "This link is personal to you — do not share it"

---

### `/send` — Send Email Form
Three input modes:
- **Manual** — single name + email
- **CSV** — upload CSV file, parsed client-side by PapaParse
- **Excel** — upload .xlsx/.xls, parsed by SheetJS (xlsx)

CSV/Excel column names accepted: `name`, `Name`, `NAME`, `email`, `Email`, `EMAIL`, `e-mail`.

Sends sequentially (one at a time with progress bar) to avoid throttling.

---

### `/inbox` — Inbox
Two-pane email client UI.
- Left: message list with search, unread filter, pagination
- Right: full email body rendered safely in an iframe (`EmailFrame` component)
- Auto-syncs from Outlook every 2 minutes silently
- Shows countdown to next sync
- Toast notifications for new replies

---

### `/responses` — Responses Dashboard
- Stats cards: Sent / Responded / Complete / Needs Review / No Response
- Filter: All / Complete / Needs Review
- Search by name, email, employee ID
- Click any row to expand and see raw reply text
- **"Remind X pending" button** — sends reminders to everyone who hasn't responded
- Export to Excel button (uses SheetJS)
- Email template copy box at bottom

---

### `/templates` — Template Manager
Create/edit email templates with the Tiptap rich text editor.
Templates support `{{name}}`, `{{email}}`, `{{responseLink}}` placeholders.

---

### `/settings` — Settings
- Sender name + email (saved to DB, overrides env vars)
- Azure connection status (configured / not configured)
- "Test Azure Connection" button — live credential test

---

## 6. Core Library Code

### `src/lib/microsoft-graph.ts`
Pure fetch-based Microsoft Graph API helper. No SDK.

**Token caching:** Access tokens are cached in memory with a 30-second expiry buffer:
```typescript
let cachedToken: string | null = null
let tokenExpiresAt = 0
// Re-fetches only when token is within 30 seconds of expiry
```

**Auth flow:** Client Credentials (app-to-app, no user login needed):
```
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
grant_type=client_credentials
scope=https://graph.microsoft.com/.default
```

---

### `src/lib/outlook-reader.ts`
Fetches inbox messages from Graph API.

**Strategy:** Fetches last 100 inbox messages, filters in code for messages FROM known recipients. Graph API's filter syntax doesn't support complex OR queries combined with orderby, so filtering is done in JavaScript after fetching.

**Self-loop prevention:** Skips any message where `fromEmail === our mailbox email`.

---

### `src/lib/reply-parser.ts`
Parses structured text replies like:
```
EMPLOYEE ID        : TQ-1045
WORK PHONE         : +971 4 123 4567
PERSONAL PHONE     : +971 55 987 6543
```

Uses regex patterns flexible on spacing/casing. Strips quoted reply thread ("On Mon, ... wrote:") before parsing so it doesn't accidentally parse the original email we sent.

---

### `src/lib/template.ts`
Simple placeholder renderer:
```typescript
renderTemplate("Dear {{name}}", { name: "Aaliya" })
// → "Dear Aaliya"
```

Uses `split(placeholder).join(value)` instead of regex to avoid escaping issues.

---

### `src/lib/email/from-address.ts`
Resolves the "From" sender config with this priority:
1. DB (`sender_name` + `sender_email` in `AppSetting`)
2. `MAIL_FROM_ADDRESS` + `MAIL_FROM_NAME` env vars
3. Empty string fallback

---

### `src/lib/email/microsoft-graph-provider.ts`
Implements the `EmailProvider` interface. Sends via:
```
POST /users/{mailbox}/sendMail
```
Parses "Name \<email\>" format from the `from` field. Always saves to Sent Items (`saveToSentItems: true`).

---

### `src/lib/prisma.ts`
Singleton Prisma client to avoid connection pool exhaustion in Next.js development (hot reload creates new instances):
```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

---

## 7. Email Flow — End to End

```
HR opens /send
  ↓
Selects template (optional) + enters recipient(s)
  ↓
Clicks "Send"
  ↓
POST /api/send called per recipient
  ↓
  ├── crypto.randomBytes(32) → responseToken (unique 64-char hex)
  ├── responseLink = APP_URL + /respond/ + token
  ├── renderTemplate(body, { name, email, responseLink })
  ├── getSenderConfig() → resolves From address
  ├── MicrosoftGraphProvider.sendEmail()
  │     └── POST https://graph.microsoft.com/v1.0/users/{mailbox}/sendMail
  └── prisma.sentEmail.create({ responseToken, status: 'sent', ... })
  ↓
Email arrives in employee's inbox
```

---

## 8. Response Form Flow — End to End

```
Employee receives email
  ↓
Clicks unique link: https://yourapp.com/respond/{64-char-token}
  ↓
/respond/[token]/page.tsx loads
  ↓
GET /api/respond/[token]
  └── prisma.sentEmail.findUnique({ where: { responseToken: token } })
  └── Returns { toName, toEmail, alreadySubmitted }
  ↓
If alreadySubmitted → shows "Already submitted" screen (END)
  ↓
Employee fills form: employeeId + workPhone + personalPhone
  ↓
Clicks "Review & Submit" → confirm screen shown
  ↓
Clicks "Confirm & Submit"
  ↓
POST /api/respond/[token]
  ├── Re-checks respondedAt (race condition protection)
  ├── Server-side validation of all 3 fields
  ├── prisma.employeeResponse.create({ parsedOk: true, ... })
  └── prisma.sentEmail.update({ respondedAt: new Date() })
  ↓
Success screen shown. Token is now permanently locked.
  ↓
HR dashboard /responses shows updated stats instantly.
```

---

## 9. Key Concepts You Must Know

### Microsoft Graph API — Client Credentials Flow
Unlike Gmail OAuth (user login), Graph API with Client Credentials is **app-to-app**.
Your Azure app acts as itself, accessing the shared mailbox `hr-notify@tanseeqinvestment.com` without any user needing to be logged in.

Required Azure permissions (Application type, not Delegated):
- `Mail.Send` — to send emails
- `Mail.Read` — to read inbox

These must be granted **Admin Consent** in Azure Portal → App Registrations → your app → API Permissions.

---

### Token-Based Unique Links
Each `SentEmail` row gets a `responseToken` — 32 random bytes encoded as 64 hex characters.  
Probability of collision: astronomically low (2^256 possibilities).

The token IS the authentication. Anyone who has the link can submit once. This is intentional — no employee login required. The trade-off is: if someone shares their link, someone else could submit for them. Mitigated by showing "This link is personal to you — do not share it."

---

### Prisma ORM
Prisma is a type-safe database toolkit.
- `schema.prisma` defines your models
- `prisma db push` syncs schema to DB without migrations (good for development)
- `prisma generate` regenerates the TypeScript client after schema changes
- Never use `db push` in production with important data — use `prisma migrate` instead

---

### Next.js App Router
This app uses the **App Router** (not Pages Router).
- `app/(dashboard)/` — route group, shared layout, doesn't affect URL
- `app/respond/[token]/` — dynamic segment, `token` available via `useParams()`
- `app/api/*/route.ts` — API endpoints, exported as `GET`, `POST`, etc.
- `'use client'` at top of file = React client component (runs in browser)
- No `'use client'` = Server component (runs on server, can use prisma directly)

---

### `export const dynamic = 'force-dynamic'`
Added to every API route. Tells Next.js: **never cache this response**. Critical for data routes where you always want fresh DB data.

---

### Deduplication Strategy (Two Layers)
1. **Token layer:** `SentEmail.respondedAt` is set on first submission. `POST /api/respond/[token]` returns 409 if already set.
2. **Email layer:** Before creating `EmployeeResponse`, checks if a row with that `fromEmail` already exists. Prevents the same person from submitting via two different sent emails.

---

### Sequential Bulk Sending
When sending to 500 people, the frontend loops sequentially (one at a time with `await`), not `Promise.all`. This is intentional:
- Graph API has rate limits (~10,000 requests per 10 minutes, but burst limits exist)
- Sequential avoids overwhelming the API
- Progress bar (`Sending 47/500...`) keeps HR informed

---

## 10. Environment Variables

All variables go in `.env.local` (never committed to git).

```env
# PostgreSQL — Neon pooled connection URL
DATABASE_URL="postgresql://..."

# Azure AD App Registration credentials
AZURE_TENANT_ID=         # Directory (tenant) ID from Azure Portal
AZURE_CLIENT_ID=         # Application (client) ID
AZURE_CLIENT_SECRET=     # Client secret value (not ID)

# The shared mailbox this app sends from and reads
AZURE_INBOX_EMAIL=hr-notify@tanseeqinvestment.com
MAIL_FROM_ADDRESS=hr-notify@tanseeqinvestment.com
MAIL_FROM_NAME="Outlook Mail Sender"

# Your deployed app URL — embedded in email links
# Must be updated to production URL before sending real emails
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

**Critical:** `NEXT_PUBLIC_APP_URL` must be your **public** URL (not localhost) when sending real emails to employees. The response link embedded in emails is built from this value.

---

## 11. Deployment

### Platform: Vercel
The app is already connected to Vercel (`.vercel/project.json` exists).

**Deploy steps:**
```bash
git add .
git commit -m "your message"
git push
# Vercel auto-deploys on push, OR:
npx vercel --prod
```

**Add env vars in Vercel:**  
Dashboard → your project → Settings → Environment Variables → add all vars from section 10.

**Custom domain (recommended):**  
Vercel → your project → Settings → Domains → add `hr.tanseeqinvestment.com`  
Then add a CNAME record in your DNS: `hr` → `cname.vercel-dns.com`

---

## 12. What's Left To Do

| Task | Priority | Notes |
|---|---|---|
| Deploy to Vercel + set env vars | HIGH | Employees can't use localhost links |
| Set `NEXT_PUBLIC_APP_URL` to production URL | HIGH | Must be done before sending real emails |
| Custom domain (`hr.tanseeqinvestment.com`) | MEDIUM | Removes phishing suspicion |
| Pre-announcement email from HR manager | MEDIUM | "Tomorrow you'll get an HR email" |
| Update email template with `{{responseLink}}` | HIGH | Without this, links won't be in emails |
| Test end-to-end with 1 real employee first | HIGH | Before blasting 500 |
| Azure admin consent for Mail.Send + Mail.Read | HIGH | Without this, no emails send/receive |
| Use `prisma migrate` instead of `db push` in prod | LOW | Safer for production schema changes |
| Add export of `SentEmail` + `EmployeeResponse` combined | LOW | For payroll/HR systems |
