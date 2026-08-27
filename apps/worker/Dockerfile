FROM node:22.22-alpine3.23 AS builder
WORKDIR /repo
COPY . .
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @cida/worker build

FROM node:22.22-alpine3.23 AS runtime
RUN addgroup -g 1001 -S worker && adduser -S worker -u 1001 -G worker
WORKDIR /app
COPY --from=builder /repo/apps/worker/dist ./dist
COPY --from=builder /repo/node_modules ./node_modules
USER worker
CMD ["node", "dist/index.js"]
