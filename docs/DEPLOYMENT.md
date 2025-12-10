# Deployment Guide

This document explains how Kindred deploys and how database migrations work using **industry standard patterns**.

## Deployment Flow

```
GitHub Push → GitHub Actions → Docker Build → AWS App Runner → Deployment
```

### 1. GitHub Actions (CI/CD)

When you push to `main`:
1. GitHub Actions workflow triggers
2. Runs tests and linting
3. Builds Docker image
4. Pushes to GitHub Container Registry (ghcr.io)
5. Triggers AWS App Runner deployment

### 2. Docker Build

The `Dockerfile` creates a production-ready Next.js standalone build:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
COPY . .
RUN npm run build  # Creates .next/standalone

# Production stage
FROM node:20-alpine AS runner
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/migrate.js ./
COPY --from=builder /app/lib/migrations.ts ./lib/
CMD ["sh", "-c", "node migrate.js && node server.js"]
```

### 3. Startup Sequence (Industry Standard Pattern)

When the container starts on App Runner:

```
node migrate.js
    ↓
lib/migrations.ts (runMigrations)
    ↓
Database migrations execute
    ↓
Exit code 0 (success) → node server.js (Next.js server starts)
    ↓
Exit code 1 (failure) → Container fails, deployment aborted
```

**Key Point:** The server does NOT start until migrations complete successfully.

This follows the **same pattern** used by:
- **Prisma**: `npx prisma migrate deploy && node server.js`
- **Drizzle ORM**: `node migrate.js && node server.js`

## Database Migrations

### How Migrations Work

1. **Migration files** are defined in `lib/migrations.ts`
2. **Version tracking** uses `schema_migrations` table
3. **Advisory locks** prevent concurrent migrations (10 second timeout)
4. **Automatic execution** on every deployment via `migrate.js`

### Industry Standard Pattern

We use the same migration pattern as **Prisma** and **Drizzle ORM**:

✅ **Separate migration step** before starting the app
✅ **Platform-agnostic** (works on any Node.js environment)
✅ **Fail-fast** (server won't start if migrations fail)
✅ **No framework magic** (pure Node.js, no reliance on Next.js features)

### Migration Process

```javascript
// migrate.js (simplified)
const { runMigrations } = require('./lib/migrations');

async function main() {
  const success = await runMigrations(pool);

  if (success) {
    process.exit(0);  // Success - Docker will start server
  } else {
    process.exit(1);  // Failure - Docker will abort deployment
  }
}
```

**Docker CMD:**
```bash
node migrate.js && node server.js
```

If `migrate.js` exits with code 1, the `&&` operator prevents `server.js` from starting.

### Adding New Migrations

1. Edit `lib/migrations.ts`
2. Add new migration object to `migrations` array:

```typescript
{
  version: 16,
  name: 'add_new_feature',
  up: async (pool: Pool) => {
    await pool.query(`
      ALTER TABLE people ADD COLUMN new_field TEXT;
    `);
    return ['Added new_field to people table'];
  },
}
```

3. Commit and push to `main`
4. GitHub Actions deploys
5. Migration runs automatically on App Runner startup

### Migration Status

Check migration status:

**Admin Dashboard:**
- Go to `/admin`
- See "Database" status card

**GraphQL:**
```graphql
query {
  migrationStatus {
    currentVersion
    latestVersion
    migrationNeeded
  }
}
```

**Database:**
```sql
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
```

### Troubleshooting

**Migrations not running?**

Check App Runner logs for these messages:

```
[Migrate] Starting migration process...
[Migrate] Current database version: 13
[Migrate] Latest migration version: 15
[Migrate] Found 2 pending migrations
[Migrate] Running migration 14: create_indexes
[Migrate] ✓ Migration 14 complete
[Migrate] Running migration 15: email_settings
[Migrate] ✓ Migration 15 complete
[Migrate] ✓ All migrations complete
```

If you don't see these messages:
- Verify `migrate.js` is in the Docker image
- Check Dockerfile CMD is `["sh", "-c", "node migrate.js && node server.js"]`
- Ensure `lib/migrations.ts` is being copied to the standalone output

**Migration failed?**

If a migration fails:
1. Server won't start (by design)
2. App Runner will show deployment as failed
3. Check logs for error details
4. Fix the migration code
5. Push a new commit to trigger redeployment

**Rollback a migration?**

Migrations don't have automatic rollback. To revert:
1. Write a new migration that undoes the change
2. Deploy the new migration

Example:
```typescript
// Migration 16 added a column
{ version: 16, up: async (pool) => {
  await pool.query('ALTER TABLE people ADD COLUMN new_field TEXT');
}}

// Migration 17 removes it
{ version: 17, up: async (pool) => {
  await pool.query('ALTER TABLE people DROP COLUMN new_field');
}}
```

## Environment Variables

Required for deployment:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Public URL of deployment | `https://family.yourdomain.com` |
| `NEXTAUTH_SECRET` | Random 32+ char secret | `openssl rand -base64 32` |

Optional:

| Variable | Description |
|----------|-------------|
| `INITIAL_ADMIN_PASSWORD` | Bootstrap admin on first run |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |

## AWS App Runner Configuration

App Runner is configured via Terraform in `terraform/apprunner.tf`:

- **Auto-scaling:** 1-10 instances
- **CPU/Memory:** 1 vCPU, 2 GB RAM
- **Health check:** `/api/health`
- **Environment:** Secrets from AWS Secrets Manager

To update configuration:
```bash
cd terraform
terraform plan
terraform apply
```

## Deployment Checklist

Before deploying:

- [ ] All tests pass locally (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] New migrations added to `lib/migrations.ts`
- [ ] Environment variables updated in AWS Secrets Manager (if needed)

After deploying:

- [ ] Check App Runner deployment status
- [ ] Verify migrations ran (check logs)
- [ ] Test the deployed app
- [ ] Check admin dashboard shows correct migration version

## Related Files

- `instrumentation.ts` - Migration execution logic
- `scripts/start.sh` - Startup script that calls instrumentation
- `lib/migrations.ts` - Migration definitions
- `Dockerfile` - Container build configuration
- `.github/workflows/deploy.yml` - CI/CD pipeline

