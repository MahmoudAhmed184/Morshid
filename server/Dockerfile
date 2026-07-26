# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS server-dependencies

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm ci --workspace server --include-workspace-root=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM server-dependencies AS build

COPY server ./server

RUN npm run build --workspace server

FROM server-dependencies AS migration

ENV NODE_ENV=production

COPY server/prisma ./server/prisma
COPY server/prisma.config.ts ./server/prisma.config.ts

WORKDIR /workspace/server

CMD ["npx", "prisma", "migrate", "deploy", "--config", "prisma.config.ts"]

FROM node:24-bookworm-slim AS production-dependencies

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm ci --omit=dev --workspace server --include-workspace-root=false

FROM node:24-bookworm-slim AS server

ENV NODE_ENV=production

WORKDIR /workspace

COPY --from=production-dependencies /workspace/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY --from=build /workspace/server/dist ./server/dist

RUN mkdir -p /workspace/storage/pdfs \
  && chown -R node:node /workspace/storage

USER node
WORKDIR /workspace/server

EXPOSE 4000

CMD ["node", "dist/main"]
