FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init

FROM base AS deps

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate

FROM base AS builder

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

FROM base AS runner

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER appuser

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]
