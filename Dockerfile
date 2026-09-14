# 1. Dipendenze
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 2. Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disabilita telemetria Next.js durante la build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 3. Runner di produzione
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Crea utente non-root per sicurezza
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Crea la cartella dati e assegna i permessi corretti per il salvataggio dei file JSON
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copia gli asset statici e il pacchetto standalone compilato
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]