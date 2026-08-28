FROM node:22.22-alpine3.23 AS builder
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/promptpay/package.json packages/promptpay/
COPY packages/storage/package.json packages/storage/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY packages/config/ packages/config/
COPY packages/contracts/ packages/contracts/
COPY packages/db/ packages/db/
COPY packages/promptpay/ packages/promptpay/
COPY packages/storage/ packages/storage/
COPY apps/api/ apps/api/
RUN pnpm --filter @cida/api build

FROM node:22.22-alpine3.23 AS runner
WORKDIR /app
RUN addgroup -g 1001 -S cida && adduser -S cida -u 1001 -G cida
COPY --chown=cida:cida --from=builder /repo/apps/api/dist ./dist
COPY --chown=cida:cida --from=builder /repo/node_modules ./node_modules
USER cida
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=6 --start-period=10s CMD node -e "require('http').get('http://127.0.0.1:3000/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/index.js"]
