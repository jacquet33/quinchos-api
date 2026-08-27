# ═══════════════════════════════
# QuinchosAPI - Dockerfile Production
# ═══════════════════════════════

FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci || npm install

# Generar Prisma Client
RUN npx prisma generate

# Compilar TypeScript
COPY . .
RUN npm run build

# ─── Production Stage ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Solo lo necesario
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Instalar tsx para seed (si se necesita)
RUN npm install -g tsx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

EXPOSE 3000

CMD ["node", "dist/server.js"]
