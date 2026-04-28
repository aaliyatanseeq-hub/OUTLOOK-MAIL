/**
 * Generates EmailHub-Gmail-Deep-Dive.docx in the project root.
 * Run: node scripts/generate-deep-dive-doc.mjs
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, PageBreak,
} from 'docx'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'EmailHub-Gmail-Deep-Dive.docx')

const ACCENT = '2563EB'
const HEADER_BG = '1E3A5F'
const ALT_ROW = 'F0F4FF'
const CODE_BG = 'F3F4F6'

function h1(t) {
  return new Paragraph({
    text: t,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT } },
    run: { color: '111827', bold: true },
  })
}

function h2(t) {
  return new Paragraph({
    text: t,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    run: { color: '1E3A5F' },
  })
}

function h3(t) {
  return new Paragraph({
    text: t,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    run: { color: ACCENT },
  })
}

function p(text, opts = {}) {
  const { bold = false, italics = false, color = '374151', size = 22 } = opts
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, bold, italics, color, size })],
  })
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, color: '374151', size: 20 })],
  })
}

function codeBlock(lines) {
  const paras = [
    new Paragraph({
      spacing: { before: 80, after: 40 },
      shading: { type: ShadingType.SOLID, color: CODE_BG },
      indent: { left: 200 },
      children: [new TextRun({ text: 'Source excerpt:', bold: true, size: 18, color: '6B7280' })],
    }),
  ]
  for (const line of lines) {
    paras.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        shading: { type: ShadingType.SOLID, color: CODE_BG },
        indent: { left: 200 },
        children: [new TextRun({ text: line, font: 'Consolas', size: 16, color: '1F2937' })],
      }),
    )
  }
  return paras
}

function callout(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    shading: { type: ShadingType.SOLID, color: 'DBEAFE' },
    indent: { left: 120, right: 120 },
    children: [new TextRun({ text, italics: true, color: '1E40AF', size: 20 })],
  })
}

function tbl(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: HEADER_BG },
        children: [
          new Paragraph({
            children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })],
          }),
        ],
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      }),
    ),
  })
  const dataRows = rows.map(
    (row, i) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? 'FFFFFF' : ALT_ROW },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(cell), size: 19, color: '1F2937' })],
                }),
              ],
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
            }),
        ),
      }),
  )
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  })
}

const children = []

// ── Cover ─────────────────────────────────────────────────────
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 500, after: 200 },
    children: [
      new TextRun({
        text: 'EmailHub — Gmail Deep-Dive',
        bold: true,
        size: 52,
        color: HEADER_BG,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: 'Code, Flows, and File-by-File Reference', size: 26, color: '6B7280' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [
      new TextRun({
        text: 'Focus: Gmail SMTP (Nodemailer) + Gmail API (googleapis). Resend/Microsoft mentioned only where the factory routes traffic.',
        size: 20,
        color: '9CA3AF',
        italics: true,
      }),
    ],
  }),
)

children.push(
  h1('How to use this document'),
  p('Each section maps user-visible behaviour to exact files and functions. Code excerpts are copied from the repository at generation time so you can trace logic line-by-line in Word or your editor.'),
  bullet('Part A — End-to-end flows (send path, inbox path) with numbered steps.'),
  bullet('Part B — Database schema and how each table is read/written.'),
  bullet('Part C — Every TypeScript source file: role, key exports, and which API or page calls it.'),
  bullet('Part D — Environment variables, build config, and deployment notes.'),
  callout('Regenerate this file after major code changes: node scripts/generate-deep-dive-doc.mjs'),
)

// ── Architecture ─────────────────────────────────────────────
children.push(
  h1('Part A — System architecture (Gmail-only mental model)'),
  h2('A.1 High-level diagram (text)'),
  p('Browser (React client components)'),
  p('   |  fetch("/api/...")'),
  p('   v'),
  p('Next.js Route Handlers under src/app/api/**/route.ts'),
  p('   |  Prisma → PostgreSQL (Template, SentEmail, InboundEmail, AppSetting)'),
  p('   |  getEmailProvider() → SmtpProvider → Nodemailer → smtp.gmail.com (outbound)'),
  p('   |  fetchRepliesFromRecipients() → Gmail API → users.messages.list/get (inbound)'),
  p('   v'),
  p('JSON responses back to the browser; UI updates state (lists, toasts, iframe email body).'),
  h2('A.2 Send-email sequence (numbered)'),
  tbl(
    ['#', 'Layer', 'File / function', 'What happens'],
    [
      ['1', 'UI', 'send-email-form.tsx — handleSend', 'Form submit; manual or bulk loop.'],
      ['2', 'UI', 'send-email-form.tsx — sendOne', 'POST /api/send with templateId, toName, toEmail, customSubject, customBody.'],
      ['3', 'API', 'api/send/route.ts — POST', 'Parse JSON; validate toName + toEmail.'],
      ['4', 'API', 'api/send/route.ts', 'If templateId: prisma.template.findUnique; merge subject/bodyTemplate.'],
      ['5', 'API', 'api/send/route.ts', 'Require final subject + bodyTemplate or return 400.'],
      ['6', 'Lib', 'template.ts — renderTemplate', 'Replace {{name}}, {{email}} (any key in data object).'],
      ['7', 'Lib', 'from-address.ts — getSenderConfig + formatFrom', 'DB sender_name/sender_email or parse MAIL_FROM or SMTP_USER.'],
      ['8', 'Lib', 'get-email-provider.ts', 'Read active_email_provider from AppSetting; return SmtpProvider for smtp.'],
      ['9', 'Lib', 'smtp-provider.ts — sendEmail', 'createTransporter; sendMail with from/to/subject/html.'],
      ['10', 'External', 'Gmail SMTP', 'Delivers message to recipient.'],
      ['11', 'API', 'api/send/route.ts', 'prisma.sentEmail.create with status sent/failed, providerMessageId, timestamps.'],
      ['12', 'UI', 'send-email-form.tsx', 'Shows success/error; clears fields or shows bulk results.'],
    ],
  ),
  callout(
    'Implementation detail: SmtpProvider recomputes `from` as MAIL_FROM || SMTP_USER || options.from before calling sendMail. If MAIL_FROM is set, it overrides the formatted string from formatFrom() in the route. Keep MAIL_FROM aligned with Settings → sender email to avoid confusion.',
  ),
  ...codeBlock([
    '// src/app/api/send/route.ts (core send + persist)',
    'const renderedSubject = renderTemplate(subject, { name: toName.trim(), email: toEmail.trim() })',
    'const renderedBody    = renderTemplate(bodyTemplate, { name: toName.trim(), email: toEmail.trim() })',
    'const sender = await getSenderConfig()',
    'const from   = formatFrom(sender.name, sender.email)',
    'const [provider, providerId] = await Promise.all([getEmailProvider(), getEmailProviderId()])',
    'const result = await provider.sendEmail({ to: toEmail.trim(), from, subject: renderedSubject, html: renderedBody })',
    'await prisma.sentEmail.create({ data: { replyTo: null, ... } })',
  ]),
  h2('A.3 Inbox sync + read sequence (numbered)'),
  tbl(
    ['#', 'Layer', 'File / function', 'What happens'],
    [
      ['1', 'UI', 'inbox-client.tsx', 'On mount: fetchEmails; intervals for countdown + POST /api/inbox/sync every 2 min.'],
      ['2', 'UI', 'inbox-client.tsx — runSync', 'POST /api/inbox/sync; if created>0 toast + refresh list.'],
      ['3', 'API', 'api/inbox/sync/route.ts — POST', 'myEmail = GOOGLE_INBOX_EMAIL || SMTP_USER.'],
      ['4', 'API', 'api/inbox/sync/route.ts', 'Distinct toEmail from SentEmail where status !== failed → recipient allow-list.'],
      ['5', 'API', 'api/inbox/sync/route.ts', 'deleteMany InboundEmail where fromEmail not in allow-list (cleanup).'],
      ['6', 'Lib', 'gmail-reader.ts — fetchRepliesFromRecipients', 'OAuth2 + messages.list(q) + messages.get(full).'],
      ['7', 'Lib', 'gmail-reader.ts', 'Parse headers, skip if From equals myEmail, extract body via extractBody recursive.'],
      ['8', 'API', 'api/inbox/sync/route.ts', 'For each msg: skip if gmailId exists; findFirst SentEmail by toEmail = msg.fromEmail; create InboundEmail.'],
      ['9', 'UI', 'inbox-client.tsx — openEmail', 'PATCH /api/inbox to mark read; GET /api/inbox/[id] for full body + sentEmail include.'],
      ['10', 'UI', 'email-frame.tsx', 'srcDoc iframe with isolated CSS; resize to content height.'],
    ],
  ),
  ...codeBlock([
    '// src/lib/gmail-reader.ts — Gmail search + fetch',
    'const query = `from:(${fromClause}) in:inbox`',
    'await gmail.users.messages.list({ userId: "me", q: query, maxResults })',
    'await gmail.users.messages.get({ userId: "me", id: ref.id, format: "full" })',
  ]),
  callout(
    'Allow-list nuance: GET /api/inbox uses getHistoryEmails() from ALL SentEmail rows (any status). Sync uses only non-failed sends to build recipientEmails. Both restrict displayed/stored inbox to addresses you have emailed.',
  ),
)

// ── Database ─────────────────────────────────────────────────
children.push(
  h1('Part B — Database schema (Prisma)'),
  p('File: prisma/schema.prisma. Datasource: PostgreSQL via DATABASE_URL.'),
  h2('B.1 Template'),
  tbl(
    ['Field', 'Notes'],
    [
      ['id', 'cuid primary key'],
      ['name, description', 'Admin-facing labels'],
      ['senderName, senderEmail', 'Stored on template; not used as Reply-To for SMTP (replyTo null on send).'],
      ['subject, bodyTemplate', 'May contain {{placeholders}}; rendered server-side.'],
      ['emails', 'Relation SentEmail[]'],
    ],
  ),
  h2('B.2 SentEmail'),
  tbl(
    ['Field', 'Notes'],
    [
      ['templateId', 'Optional FK Template'],
      ['toName, toEmail', 'Recipient; inbox linking uses toEmail'],
      ['subject, body', 'Rendered content stored for history'],
      ['provider', 'smtp | resend | microsoft'],
      ['status', 'sent | failed | delivered | opened | ...'],
      ['replies', 'InboundEmail[]'],
    ],
  ),
  h2('B.3 InboundEmail'),
  tbl(
    ['Field', 'Notes'],
    [
      ['gmailId', 'Unique; dedupe key'],
      ['sentEmailId', 'Optional FK to matched outbound'],
      ['fromEmail', 'Must be in history allow-list for GET list'],
      ['bodyHtml / bodyText', 'Parsed from Gmail payload'],
    ],
  ),
  h2('B.4 AppSetting'),
  tbl(
    ['key', 'value meaning'],
    [
      ['active_email_provider', 'smtp | resend | microsoft'],
      ['sender_name', 'From display name (Settings UI)'],
      ['sender_email', 'From email (Settings UI)'],
    ],
  ),
  h2('B.5 Prisma client bootstrap'),
  ...codeBlock([
    '// src/lib/prisma.ts',
    'export const prisma = globalForPrisma.prisma || createPrismaClient()',
    '// Dev: singleton on global to avoid hot-reload connection explosion',
  ]),
)

// ── File inventory ───────────────────────────────────────────
children.push(
  h1('Part C — Complete file reference (every .ts / .tsx / schema)'),
  p('Below: path → responsibility → primary entry points (who imports or HTTP method).'),
  tbl(
    ['Path', 'Role', 'Called from / triggers'],
    [
      ['prisma/schema.prisma', 'DB models & relations', 'prisma migrate/db push; all APIs'],
      ['next-env.d.ts', 'Next.js TS ambient types', 'Compiler'],
      ['tailwind.config.ts', 'Tailwind theme', 'Build'],
      ['next.config.js', 'eslint.ignoreDuringBuilds, typescript.ignoreBuildErrors', 'next build'],
      ['src/app/layout.tsx', 'Root layout, theme script on body', 'All pages'],
      ['src/app/page.tsx', 'redirect("/dashboard")', '/'],
      ['src/app/globals.css', 'Light/dark [data-theme] overrides', 'Global'],
      ['src/app/(dashboard)/layout.tsx', 'Sidebar, unread badge fetch', 'All dashboard routes'],
      ['src/app/(dashboard)/dashboard/page.tsx', 'Server: stats + recent SentEmail', '/dashboard'],
      ['src/app/(dashboard)/send/page.tsx', 'Server: templates + getSenderConfig', '/send'],
      ['src/app/(dashboard)/templates/page.tsx', 'Template list UI', '/templates'],
      ['src/app/(dashboard)/templates/new/page.tsx', 'New template page', '/templates/new'],
      ['src/app/(dashboard)/templates/[id]/page.tsx', 'Edit template page', '/templates/:id'],
      ['src/app/(dashboard)/history/page.tsx', 'History page shell', '/history'],
      ['src/app/(dashboard)/inbox/page.tsx', 'Inbox page → InboxClient', '/inbox'],
      ['src/app/(dashboard)/settings/page.tsx', 'Settings + SettingsPanel', '/settings'],
      ['src/app/api/send/route.ts', 'POST send email', 'Send form'],
      ['src/app/api/templates/route.ts', 'GET list, POST create', 'Templates UI'],
      ['src/app/api/templates/[id]/route.ts', 'GET/PUT/DELETE one template', 'Template editor'],
      ['src/app/api/history/route.ts', 'GET SentEmail list + filters', 'History table'],
      ['src/app/api/inbox/route.ts', 'GET list, PATCH read, DELETE cleanup', 'InboxClient'],
      ['src/app/api/inbox/[id]/route.ts', 'GET detail + mark read', 'InboxClient detail'],
      ['src/app/api/inbox/sync/route.ts', 'POST Gmail sync', 'InboxClient + manual'],
      ['src/app/api/settings/route.ts', 'GET/POST active provider + config flags', 'SettingsPanel'],
      ['src/app/api/settings/sender/route.ts', 'GET/POST sender name/email', 'SettingsPanel, getSenderConfig'],
      ['src/app/api/settings/test/smtp/route.ts', 'GET verify SMTP', 'Settings test button'],
      ['src/app/api/settings/test/resend/route.ts', 'GET test Resend', 'Settings'],
      ['src/app/api/settings/test/microsoft/route.ts', 'GET test Graph', 'Settings'],
      ['src/lib/prisma.ts', 'Prisma singleton', 'All server code'],
      ['src/lib/template.ts', 'renderTemplate, getPlaceholdersFromTemplate', 'send route, editors'],
      ['src/lib/gmail-reader.ts', 'fetchRepliesFromRecipients, Gmail parse', 'inbox/sync'],
      ['src/lib/email/provider.ts', 'EmailProvider types', 'All providers'],
      ['src/lib/email/smtp-provider.ts', 'Nodemailer Gmail SMTP', 'getEmailProvider'],
      ['src/lib/email/resend-provider.ts', 'Resend API (optional)', 'getEmailProvider'],
      ['src/lib/email/microsoft-graph-provider.ts', 'Graph send (optional)', 'getEmailProvider'],
      ['src/lib/email/get-email-provider.ts', 'Factory + normalise ids', 'send route, settings'],
      ['src/lib/email/from-address.ts', 'getSenderConfig, formatFrom', 'send page, send route'],
      ['src/components/send/send-email-form.tsx', 'Compose UI, CSV/XLSX, bulk POST loop', 'Send page'],
      ['src/components/templates/template-form.tsx', 'Create/edit template fields', 'Template pages'],
      ['src/components/templates/delete-template-button.tsx', 'Delete template action', 'Templates'],
      ['src/components/history/history-table.tsx', 'History filters + table', 'History page'],
      ['src/components/inbox/inbox-client.tsx', 'Inbox list/detail, sync, toast', 'Inbox page'],
      ['src/components/settings/settings-panel.tsx', 'Provider + sender forms', 'Settings page'],
      ['src/components/dashboard/stats-card.tsx', 'Stat card', 'Dashboard'],
      ['src/components/dashboard/stats-grid.tsx', 'Stats layout', 'Dashboard'],
      ['src/components/ui/rich-text-editor.tsx', 'TipTap editor', 'Send form, templates'],
      ['src/components/ui/email-frame.tsx', 'iframe srcDoc email render', 'InboxClient'],
      ['src/components/ui/theme-toggle.tsx', 'localStorage theme', 'Dashboard layout'],
    ],
  ),
)

// ── Deep modules ─────────────────────────────────────────────
children.push(
  h1('Part C (continued) — Module deep dives with code'),
  h2('C.1 template.ts — placeholder engine'),
  p('renderTemplate loops Object.entries(data) and replaces every {{key}} with String(value). Null/undefined keys are skipped.'),
  ...codeBlock([
    'export function renderTemplate(template: string, data: TemplateData): string {',
    '  let result = template',
    '  Object.entries(data).forEach(([key, value]) => {',
    '    if (value === null || value === undefined) return',
    '    const placeholder = `{{${key}}}`',
    '    result = result.split(placeholder).join(String(value))',
    '  })',
    '  return result',
    '}',
  ]),
  h2('C.2 from-address.ts — sender resolution'),
  p('Priority: AppSetting sender_name + sender_email → parse MAIL_FROM "Name <email>" → SMTP_USER as bare email.'),
  ...codeBlock([
    'export async function getSenderConfig(): Promise<{ name: string; email: string }> {',
    '  const [nameRow, emailRow] = await Promise.all([',
    "    prisma.appSetting.findUnique({ where: { key: 'sender_name' } }),",
    "    prisma.appSetting.findUnique({ where: { key: 'sender_email' } }),",
    '  ])',
    '  if (nameRow?.value || emailRow?.value) {',
    '    return { name: nameRow?.value ?? "", email: emailRow?.value ?? "" }',
    '  }',
    '  // ... MAIL_FROM regex, then SMTP_USER',
    '}',
  ]),
  h2('C.3 smtp-provider.ts — transporter + sendMail'),
  p('createTransporter reads SMTP_* env vars; secure=true only when port===465; tls.rejectUnauthorized=false.'),
  ...codeBlock([
    'const info = await transporter.sendMail({',
    '  from,  // MAIL_FROM || SMTP_USER || options.from',
    '  to: options.to,',
    '  replyTo: options.replyTo,',
    '  subject: options.subject,',
    "  text: options.html?.replace(/<[^>]*>/g, '') ?? '',",
    '  html: options.html,',
    '})',
  ]),
  h2('C.4 get-email-provider.ts — provider selection'),
  p('normalise() maps graph/m365→microsoft. getEmailProviderId reads DB then EMAIL_PROVIDER env. getEmailProvider instantiates class.'),
  h2('C.5 gmail-reader.ts — OAuth + MIME walk'),
  p('getGmailClient(): OAuth2 with GOOGLE_CLIENT_ID/SECRET + refresh token. extractBody() recurses payload.parts. parseAddress() handles "Name <email>".'),
  h2('C.6 api/inbox/route.ts — allow-list query'),
  p('getHistoryEmails: distinct toEmail from all SentEmail. GET where fromEmail in historyEmails; optional unread + search OR across fromEmail/fromName/subject/snippet.'),
  h2('C.7 send-email-form.tsx — client behaviour'),
  p('Modes: manual | csv | excel. parseRows accepts columns name/Name/EMAIL etc. sendOne POSTs JSON. Bulk: sequential await in for-loop with progress state. Local renderTpl duplicates {{name}}/{{email}} for preview only.'),
  h2('C.8 inbox-client.tsx — auto-sync'),
  p('AUTO_SYNC_INTERVAL_MS = 120000. Two intervals: 1s countdown, 2m silent runSync(true). openEmail PATCH then GET detail.'),
  h2('C.9 email-frame.tsx — security'),
  p('sandbox="allow-same-origin allow-popups" — scripts blocked; links may open. contentDocument used to read scrollHeight for resize.'),
  h2('C.10 Root layout + theme'),
  p('layout.tsx: inline script reads localStorage theme before paint. theme-toggle.tsx sets body dataset.theme and persists key "theme".'),
  h2('C.11 Dashboard page'),
  p('Server component: parallel counts for statuses; recentEmails take 8 with template name; links to /send, /history.'),
  h2('C.12 Settings API GET'),
  p('Returns active provider, smtp/resend/microsoft configured flags. Note: default env in GET uses resend if unset — ensure DB or EMAIL_PROVIDER=smtp for Gmail-only deployments.'),
)

children.push(
  h1('Part D — Environment variables & build'),
  h2('D.1 Required for Gmail send'),
  tbl(
    ['Name', 'Purpose'],
    [
      ['DATABASE_URL', 'PostgreSQL connection string'],
      ['SMTP_HOST', 'smtp.gmail.com'],
      ['SMTP_PORT', '587 (or 465 SSL)'],
      ['SMTP_USER', 'Gmail account'],
      ['SMTP_PASS', 'Gmail App Password'],
      ['MAIL_FROM', 'Optional; also overrides SmtpProvider from if set'],
      ['EMAIL_PROVIDER', 'smtp (recommended) or rely on DB active_email_provider'],
    ],
  ),
  h2('D.2 Required for Gmail inbox sync'),
  tbl(
    ['Name', 'Purpose'],
    [
      ['GOOGLE_CLIENT_ID', 'OAuth client'],
      ['GOOGLE_CLIENT_SECRET', 'OAuth secret'],
      ['GOOGLE_REFRESH_TOKEN', 'Offline access'],
      ['GOOGLE_INBOX_EMAIL', 'Mailbox userId "me" should match this account'],
    ],
  ),
  h2('D.3 npm scripts (package.json)'),
  tbl(
    ['Script', 'Command'],
    [
      ['dev', 'next dev'],
      ['build', 'prisma generate && next build'],
      ['postinstall', 'prisma generate'],
      ['db:push', 'prisma db push'],
    ],
  ),
  h2('D.4 next.config.js'),
  p('ignoreDuringBuilds for eslint; ignoreBuildErrors for typescript — reduces CI friction; fix types in-repo over time.'),
)

children.push(
  h1('Part E — API quick reference (HTTP)'),
  tbl(
    ['Method + path', 'Body / query', 'Response'],
    [
      ['POST /api/send', 'templateId?, toName, toEmail, customSubject?, customBody?', '{ success, id, error }'],
      ['GET /api/inbox', '?page&unread&search', '{ emails, total, page, pageSize }'],
      ['PATCH /api/inbox', '{ id } or { ids: [] }', '{ success }'],
      ['DELETE /api/inbox', '—', '{ deleted }'],
      ['GET /api/inbox/:id', '—', 'InboundEmail + sentEmail'],
      ['POST /api/inbox/sync', '—', '{ created, skipped, cleaned, checkedRecipients }'],
      ['GET/POST /api/settings/sender', 'name, email on POST', 'sender fields + source'],
      ['GET /api/settings/test/smtp', '—', '{ ok, hint, error }'],
    ],
  ),
  callout(
    'This document was generated by scripts/generate-deep-dive-doc.mjs. Re-run after code changes to keep Word and repo in sync.',
  ),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [
      new TextRun({
        text: 'EmailHub · Gmail SMTP + Gmail API · Next.js App Router · Prisma',
        size: 18,
        color: '9CA3AF',
        italics: true,
      }),
    ],
  }),
)

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22 } },
    },
  },
  sections: [{ children }],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync(OUT, buffer)
console.log('Wrote', OUT)
