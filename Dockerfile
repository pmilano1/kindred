FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

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

RUN npm run build

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

USER nextjs

EXPOSE 3000

ENV PORT=3000

# Force binding to all interfaces - HOSTNAME env var doesn't work reliably
CMD ["node", "-e", "process.env.HOSTNAME='0.0.0.0'; require('./server.js')"]

