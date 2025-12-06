# Kindred

A modern genealogy web application built with Next.js 15, featuring interactive family tree visualization, research tracking, and role-based access control.

## Features

- 🌳 Interactive family tree visualization with D3.js
- 👤 Detailed person profiles with life events and timelines
- 🔍 Search across people, places, and dates
- 📊 Research queue for tracking genealogy work
- 🏰 Notable relatives discovery (finds famous ancestors/cousins)
- 🛡️ Role-based access (admin, editor, viewer)
- 🎨 Customizable branding and settings
- 🔐 Google OAuth authentication
- 📧 Email invitations for family members (AWS SES)

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

### AWS App Runner (Recommended)

The project includes GitHub Actions workflows for automated deployment:

1. Push to `develop` branch for CI checks
2. Create PR to `main` for production deployment
3. Merge triggers automatic deployment to AWS App Runner

See `CONTRIBUTING.md` for the full workflow.

### Environment Variables for Production

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string with SSL |
| `NEXTAUTH_URL` | Production URL (e.g., https://family.yourdomain.com) |
| `NEXTAUTH_SECRET` | Random 32+ character secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `AUTH_TRUST_HOST` | Set to `true` for proxied environments |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and guidelines.

## License

MIT
