FROM node:23-slim

WORKDIR /app

# OpenSSLのインストール
RUN apt-get update -y && apt-get install -y openssl procps

COPY package.json package-lock.json ./
RUN npm install

COPY . .

ENV DATABASE_URL="postgresql://postgres:password@postgres:5432/postgres?schema=public"
ENV PORT=4000
ENV FRONTEND_URL="http://localhost:3000"

EXPOSE 4000

CMD ["npm", "run", "start:dev"]
