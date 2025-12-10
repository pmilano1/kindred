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

# Copy startup script that runs migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start.sh ./scripts/

USER nextjs

EXPOSE 3000

ENV PORT=3000

# Run startup script (migrations + server)
CMD ["sh", "./scripts/start.sh"]

