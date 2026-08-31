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
# The repo layout has to be mirrored, not flattened: pnpm links every dependency
# as a relative symlink (apps/api/node_modules/hono -> ../../node_modules/.pnpm/...,
# @cida/* -> ../../../packages/*), so moving dist up to /app breaks resolution.
COPY --chown=cida:cida --from=builder /repo/node_modules ./node_modules
COPY --chown=cida:cida --from=builder /repo/packages ./packages
COPY --chown=cida:cida --from=builder /repo/apps/api/node_modules ./apps/api/node_modules
COPY --chown=cida:cida --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --chown=cida:cida --from=builder /repo/apps/api/dist ./apps/api/dist
# tsc only emits .js; the invoice template is a data file and would otherwise be
# missing at dist/templates, so issuing a tax invoice would throw ENOENT.
COPY --chown=cida:cida --from=builder /repo/apps/api/src/templates ./apps/api/dist/templates
USER cida
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=6 --start-period=10s CMD node -e "require('http').get('http://127.0.0.1:3000/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
# The workspace packages (@cida/db, @cida/contracts, ...) ship raw TypeScript
# source with extensionless imports (exports -> ./src/*.ts) that only resolve
# under a TS loader. tsx is a runtime dependency, so run the compiled entry
# through it; plain `node` cannot resolve those packages and the API would crash
# at startup with ERR_MODULE_NOT_FOUND.
CMD ["node", "apps/api/node_modules/tsx/dist/cli.mjs", "apps/api/dist/index.js"]
