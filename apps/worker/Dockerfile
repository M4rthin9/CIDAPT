FROM node:22.22-alpine3.23 AS builder
WORKDIR /repo
COPY . .
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile && pnpm --filter @cida/worker build

FROM node:22.22-alpine3.23 AS runtime
RUN addgroup -g 1001 -S worker && adduser -S worker -u 1001 -G worker
WORKDIR /app
# Mirror the repo layout: pnpm's dependency symlinks are relative, so a flattened
# /app/dist next to /app/node_modules cannot resolve them.
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /repo/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /repo/apps/worker/dist ./apps/worker/dist
USER worker
# The workspace packages (@cida/db, @cida/contracts) ship raw TypeScript source
# with extensionless imports that only resolve under a TS loader. tsx is a
# runtime dependency — without it `node` crashes at startup with
# ERR_MODULE_NOT_FOUND resolving those packages.
CMD ["node", "apps/worker/node_modules/tsx/dist/cli.mjs", "apps/worker/dist/index.js"]
