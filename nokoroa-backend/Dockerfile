FROM node:23-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl procps

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:23-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl procps && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/src/main.js"]
