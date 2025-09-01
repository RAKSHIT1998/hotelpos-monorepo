# --- deps ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
COPY prisma ./prisma
RUN npx prisma generate || true

# --- runtime ---
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
CMD ["/bin/sh","-lc","if [ -f prisma/schema.prisma ] && [ -n \"$DATABASE_URL\" ]; then npx prisma migrate deploy || npx prisma db push || true; fi; node src/index.mjs"]
