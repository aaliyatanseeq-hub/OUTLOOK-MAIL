# EmailHub - Email Campaign Manager

A modern, clean, production-ready email campaign management platform built with Next.js, TypeScript, Tailwind CSS, and Prisma.

## Features

- ✉️ **Campaign Management** - Create and manage email campaigns with custom templates
- 👥 **Recipient Management** - Add recipients manually or via CSV upload
- 📋 **Email Preview** - Live preview of rendered emails with personalization
- 🚀 **Bulk Sending** - Send personalized emails to all recipients in a campaign
- 📊 **Real-time Tracking** - Monitor email delivery, opens, clicks, and bounces
- 🔌 **Provider Abstraction** - Easy switch between email providers (Resend, Postmark, etc.)
- 🎨 **Modern UI** - Premium dashboard design with dark theme
- 📈 **Analytics Dashboard** - Campaign statistics and performance metrics

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Email Provider**: Resend (with abstraction for others)
- **Validation**: Zod
- **UI Icons**: Lucide React
- **Date Handling**: date-fns

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Resend API key (get one at https://resend.com)

## Setup

### 1. Clone and Install

```bash
cd "email-campaign-app"
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your environment variables:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/email_app_db"

# Email Provider
RESEND_API_KEY="re_your_api_key_here"
# From address Resend accepts (see "Resend sender domain" below)
RESEND_FROM_EMAIL="onboarding@resend.dev"

# Optional
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Resend sender domain

Resend only sends from addresses you are allowed to use:

- **Quick local test:** use `RESEND_FROM_EMAIL=onboarding@resend.dev` in `.env.local`. Email is only delivered to the address on your Resend account (see [Resend docs](https://resend.com/docs)).
- **Production:** add your domain at [resend.com/domains](https://resend.com/domains), complete DNS verification, then set `RESEND_FROM_EMAIL` to something like `noreply@yourdomain.com`.

You **cannot** use `@gmail.com`, `@yahoo.com`, etc. as the From domain through Resend without verifying those domains (Gmail is not verifiable this way for bulk sending). The app uses `RESEND_FROM_EMAIL` as the real From header and keeps the campaign “sender email” as **Reply-To** so recipients can still reply to your normal inbox.

### 3. Database Setup

Initialize the Prisma database:

```bash
npx prisma migrate dev --name init
```

This will:
- Create all tables in PostgreSQL
- Generate Prisma Client

### 4. Seed Sample Data (Optional)

Load sample campaign and recipients:

```bash
npm run seed
```

This creates a demo campaign with sample recipients and email statuses for testing.

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## Usage

### Creating a Campaign

1. Go to **Campaigns** → **New Campaign**
2. Fill in campaign details:
   - Campaign title
   - Sender name and email
   - Email subject
   - Email body template (supports HTML and placeholders)
3. Add placeholders like `{{name}}` and `{{email}}`
4. Click **Continue to Recipients**

### Adding Recipients

Add recipients in two ways:

#### Manual Entry
1. Enter recipient name and email
2. Click **Add**

#### CSV Upload
1. Prepare CSV with columns: `name`, `email`
2. Upload the file
3. Review and confirm

### Sending Emails

1. After adding recipients, click **Continue to Preview**
2. Review email rendering for different recipients
3. Use navigation arrows to preview for each recipient
4. Click **Send to [X] Recipients**
5. Emails are sent immediately

### Tracking

Navigate to **Tracking** or click **Track** on a campaign:
- View all sent emails
- Filter by status (sent, delivered, opened, clicked, bounced, failed)
- See timestamps for key events
- View error messages for failed emails

### Dashboard

The dashboard shows:
- Total campaigns and recipients
- Email statistics (sent, delivered, opened, clicked, failed)
- Recent campaigns table

## Email Template Placeholders

Available placeholders in email templates:

- `{{name}}` - Recipient name
- `{{email}}` - Recipient email address

Example:

```html
<h1>Hello {{name}},</h1>
<p>Welcome to our platform!</p>
<p>We'll send updates to {{email}}</p>
```

## Webhook Integration (Resend)

The app automatically receives email status updates from Resend via webhooks.

### Setup Resend Webhooks

1. Go to Resend dashboard → Webhooks
2. Create webhook with endpoint: `https://yourdomain.com/api/webhooks/resend`
3. Subscribe to events:
   - Email sent
   - Email delivered
   - Email opened
   - Email clicked
   - Email bounced
   - Email failed

Status updates happen automatically when webhooks arrive.

## Architecture

### Key Components

- **Email Provider Abstraction** (`src/lib/email/provider.ts`)
  - Interface for email providers
  - Easy to implement new providers (Postmark, SendGrid, etc.)

- **Template Rendering** (`src/lib/template.ts`)
  - Safe placeholder replacement
  - Extracts placeholders from templates

- **Validation** (`src/lib/validation.ts`)
  - Email validation
  - CSV parsing with error handling

### File Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── campaigns/
│   │   └── tracking/
│   ├── api/
│   │   ├── campaigns/
│   │   └── webhooks/
│   └── globals.css
├── components/
│   ├── dashboard/
│   ├── campaigns/
│   └── tracking/
├── lib/
│   ├── email/
│   ├── prisma.ts
│   ├── template.ts
│   └── validation.ts
└── types/
```

### Database Schema

**Campaign**
- id, title, senderName, senderEmail
- subject, bodyTemplate
- createdAt, updatedAt

**Recipient**
- id, campaignId, name, email

**EmailMessage**
- id, campaignId, recipientId
- provider, providerMessageId
- renderedSubject, renderedBody
- status (pending, sent, delivered, opened, clicked, bounced, failed)
- sentAt, deliveredAt, openedAt, clickedAt, failedAt
- errorMessage

**WebhookEvent**
- id, campaignId, provider
- providerMessageId, eventType
- payloadJson, receivedAt

## Common Tasks

### Adding a New Email Provider

1. Create new file: `src/lib/email/postmark-provider.ts`
2. Implement `EmailProvider` interface
3. Update `src/lib/email/resend-provider.ts` export or create factory
4. Add new environment variables as needed

Example:

```typescript
export class PostmarkProvider implements EmailProvider {
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    // Implementation
  }

  handleWebhook(payload: any): WebhookEvent | null {
    // Implementation
  }
}
```

### Exporting Data

Connect email messages to your analytics:

```typescript
const messages = await prisma.emailMessage.findMany({
  where: { campaignId: 'campaign-id' },
  include: { recipient: true },
})
```

### API Routes

All API routes are in `src/app/api/`:

- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns` - List campaigns
- `GET /api/campaigns/[id]` - Get campaign
- `POST /api/campaigns/[id]/recipients` - Add recipients
- `POST /api/campaigns/[id]/send` - Send campaign emails
- `POST /api/webhooks/resend` - Handle Resend webhooks

## Development

### Running Tests

```bash
npm run build
```

### Database Management

View/edit database:

```bash
npm run db:studio
```

Reset database:

```bash
npx prisma migrate reset
```

### Build for Production

```bash
npm run build
npm start
```

## Performance Notes

- Emails are sent synchronously per recipient
- For large campaigns (1000+ recipients), consider implementing a queue (Bull, Resque)
- Webhook processing is async-safe
- Database indexes on common query fields for fast lookups

## Future Enhancements

- [ ] Email queue for large campaigns
- [ ] Multiple sender addresses
- [ ] Template library
- [ ] A/B testing
- [ ] Advanced scheduling
- [ ] Multi-provider support UI
- [ ] Email automation workflows
- [ ] Team collaboration
- [ ] User authentication
- [ ] API rate limiting

## Troubleshooting

### Database Connection Error

Check:
- PostgreSQL is running
- DATABASE_URL is correct
- Network access to database

### Resend API Errors

Check:
- RESEND_API_KEY is valid
- API key has correct permissions
- `RESEND_FROM_EMAIL` (or `EMAIL_FROM`) is set to an address Resend allows: `onboarding@resend.dev` for testing, or an address on a domain you verified at [resend.com/domains](https://resend.com/domains)
- If you see “domain is not verified”, you are using a public mailbox domain (e.g. gmail.com) as From — use a verified domain or `onboarding@resend.dev` instead

### Emails Not Sending

Check:
- Provider API key in environment
- Recipient email is valid
- Campaign has recipients
- Check error messages in tracking page

## Support

For issues and questions:
1. Check existing GitHub issues
2. Review logs in browser console
3. Check server logs

## License

MIT

## Credits

Built with ❤️ for modern email marketing.
