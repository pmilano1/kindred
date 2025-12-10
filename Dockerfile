# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Use BuildKit cache mount for npm cache
RUN --mount=type=cache,target=/root/.npm npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables
# Note: DATABASE_URL must NOT be set at build time - Next.js will inline it
ARG NEXTAUTH_URL
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

# Do NOT set DATABASE_URL here - it must only exist at runtime

# Use BuildKit cache mount for Next.js build cache
RUN --mount=type=cache,target=/app/.next/cache npm run build

# Compile migrations.ts to migrations.js for production use
RUN npx tsc lib/migrations.ts --outDir lib --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install wget for healthcheck
RUN apk add --no-cache wget

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy migration runner (industry standard pattern: separate migration step)
# This follows the same pattern as Prisma's "migrate deploy" and Drizzle ORM
COPY --from=builder --chown=nextjs:nodejs /app/migrate.js ./
COPY --from=builder --chown=nextjs:nodejs /app/lib/migrations.js ./lib/

USER nextjs

EXPOSE 3000

ENV PORT=3000
# HOSTNAME must be 0.0.0.0 for App Runner health checks to reach the container
ENV HOSTNAME=0.0.0.0

# Industry standard deployment pattern:
# 1. Run migrations (exits with error if migrations fail)
# 2. Start the server (only if migrations succeeded)
#
# HOSTNAME=0.0.0.0 must be set at runtime (not just ENV) because
# AWS App Runner/ECS override the HOSTNAME env var with the container's
# internal DNS name, causing Next.js to bind to that instead of all interfaces.
CMD ["sh", "-c", "node migrate.js && HOSTNAME=0.0.0.0 node server.js"]

