FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/connectors/package.json ./packages/connectors/
COPY apps/server/package.json ./apps/server/
COPY turbo.json ./
RUN npm ci --include=dev

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/sdk/node_modules ./packages/sdk/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV LOG_LEVEL=info

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vertexhub

RUN mkdir -p /app/data && chown vertexhub:vertexhub /app/data

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER vertexhub

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
