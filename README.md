# Kindred

[![CI](https://github.com/pmilano1/kindred/actions/workflows/ci.yml/badge.svg)](https://github.com/pmilano1/kindred/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-158%20passing-brightgreen)](https://github.com/pmilano1/kindred)

A modern, self-hostable genealogy web application built with Next.js 15, featuring interactive family tree visualization, research tracking, and role-based access control.

## Features

- 🌳 Interactive family tree visualization with D3.js
- 👤 Detailed person profiles with life events and timelines
- 🔍 Global search across people, places, and dates
- 📊 Research queue for tracking genealogy work
- 🏰 Notable relatives discovery (finds famous ancestors/cousins)
- 🛡️ Role-based access control (admin, editor, viewer)
- 🎨 Customizable branding, themes, and settings
- 🔐 Multiple auth options (Google OAuth, local passwords)
- 📧 Email invitations (AWS SES or SMTP)
- 🐳 Docker-ready for self-hosting
- 🔑 API key support for integrations

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Google Cloud project (for OAuth)

### 1. Clone and Install

```bash
git clone https://github.com/pmilano1/kindred.git
cd kindred
npm install
```

### 2. Set Up PostgreSQL Database

Create a PostgreSQL database:

```bash
# Create database
psql -U postgres -c "CREATE DATABASE genealogy;"
psql -U postgres -c "CREATE USER genealogy WITH PASSWORD 'your-password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE genealogy TO genealogy;"
```

The application will create the necessary tables on first run. See the `migrations/` directory for schema details.

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy the Client ID and Client Secret

### 4. Create Environment File

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Database
DATABASE_URL=postgresql://genealogy:your-password@localhost:5432/genealogy

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-32-char-string

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Configure Site Settings

1. Log in with your Google account (first user becomes admin)
2. Go to Admin → Site Settings
3. Configure your family name and branding

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin panel (users, settings)
│   ├── api/                # API routes (GraphQL, auth, health)
│   ├── person/[id]/        # Person detail pages
│   ├── tree/               # Family tree visualization
│   └── research/           # Research queue
├── components/             # React components
├── lib/                    # Utilities
│   ├── graphql/            # GraphQL schema, resolvers, dataloaders
│   ├── auth.ts             # NextAuth configuration
│   └── pool.ts             # PostgreSQL connection
├── __tests__/              # Jest tests
└── public/                 # Static assets
```

## Deployment

### Docker (Self-Hosting)

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/genealogy \
  -e NEXTAUTH_URL=https://family.yourdomain.com \
  -e NEXTAUTH_SECRET=your-secret-key \
  -e INITIAL_ADMIN_PASSWORD=changeme \
  ghcr.io/pmilano1/kindred:latest
```

On first startup with `INITIAL_ADMIN_PASSWORD` set, an admin user is created:
- **Email:** `admin@kindred.local` (override with `INITIAL_ADMIN_EMAIL`)
- **Password:** Your `INITIAL_ADMIN_PASSWORD` value
- You'll be prompted to change the password on first login

### Docker Compose

```yaml
services:
  kindred:
    image: ghcr.io/pmilano1/kindred:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://genealogy:password@db:5432/genealogy
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: generate-a-random-secret
      INITIAL_ADMIN_PASSWORD: changeme
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: genealogy
      POSTGRES_PASSWORD: password
      POSTGRES_DB: genealogy
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### AWS App Runner

The project includes GitHub Actions workflows for automated deployment:

1. Push to `develop` branch for CI checks
2. Create PR to `main` for production deployment
3. Merge triggers automatic deployment to AWS App Runner

See `CONTRIBUTING.md` for the full workflow.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Public URL of your deployment |
| `NEXTAUTH_SECRET` | Yes | Random 32+ character secret |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `INITIAL_ADMIN_PASSWORD` | No | Bootstrap admin password (first run only) |
| `INITIAL_ADMIN_EMAIL` | No | Bootstrap admin email (default: admin@kindred.local) |
| `AUTH_TRUST_HOST` | No | Set to `true` for proxied environments |

### Email Configuration (Optional)

Email is used for user invitations. Choose one provider:

**AWS SES:**
```env
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
EMAIL_FROM=noreply@yourdomain.com
```

**SMTP:**
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

> 💡 **No email configured?** Use `INITIAL_ADMIN_PASSWORD` to bootstrap the first admin user without email.

## GraphQL API

Kindred exposes a GraphQL API for data access and integrations.

### GraphQL Playground

Access the interactive GraphQL playground at:
```
http://localhost:3000/api/graphql
```

Open this URL in your browser to explore the schema, run queries, and test mutations.

### API Key Authentication

For programmatic access, create an API key in Admin → API Keys:

```bash
curl -X POST https://your-domain.com/api/graphql \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"query": "{ stats { total_people total_families } }"}'
```

### Example Queries

```graphql
# Get recent people
query {
  recentPeople(limit: 10) {
    id
    name_full
    birth_year
    birth_place
  }
}

# Search for people
query {
  search(query: "John", first: 20) {
    edges {
      node {
        id
        name_full
      }
    }
    totalCount
  }
}
```

## Database Migrations

Kindred uses version-controlled database migrations to manage schema changes. Migrations run automatically on every deployment.

### How Migrations Work

1. **Migration files** are defined in `lib/migrations.ts`
2. **On deployment**, `scripts/start.sh` explicitly calls `instrumentation.ts`
3. **Migrations run** before the server starts accepting requests
4. **Server starts** only if migrations succeed

### Why Explicit Execution?

Next.js has an `instrumentation.ts` feature that's supposed to run automatically on server startup, but it doesn't work reliably on all deployment platforms (especially AWS App Runner). To guarantee migrations run, we explicitly call the instrumentation hook from our startup script.

**Deployment Flow:**
```
Docker Build → scripts/start.sh → instrumentation.ts → Migrations → Server Start
```

### Migration Status

Check migration status in the admin dashboard at `/admin` or via GraphQL:

```graphql
query {
  migrationStatus {
    currentVersion
    latestVersion
    migrationNeeded
  }
}
```

### Manual Migration (if needed)

If you need to run migrations manually:

```bash
# Connect to your database
psql $DATABASE_URL

# Check current version
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;

# Migrations are defined in lib/migrations.ts
# They run automatically on deployment, but you can trigger them by restarting the app
```

### Troubleshooting

**Migrations not running?**
- Check App Runner logs for `[Instrumentation]` messages
- Verify `scripts/start.sh` is being executed (look for `[Startup]` logs)
- Ensure `DATABASE_URL` is set correctly

**Migration failed?**
- Server won't start if migrations fail (by design)
- Check logs for error details
- Fix the issue and redeploy

## Data Management

> 📝 **Note:** Kindred currently manages genealogy records through the GraphQL API. This is great for bulk imports, scripting, and integration with other tools. A full-featured UI for adding and editing people, families, and events is on the roadmap—stay tuned!

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and guidelines.

## License

MIT
