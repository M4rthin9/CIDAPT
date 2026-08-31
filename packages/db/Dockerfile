FROM node:22.22-alpine3.23 AS builder
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY packages/config/ packages/config/
COPY packages/db/ packages/db/

FROM node:22.22-alpine3.23 AS runner
WORKDIR /repo
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/package.json ./package.json
# Invoke drizzle-kit straight from the workspace bin. Going through `pnpm run`
# here would trigger pnpm's deps-status check, and that re-runs `pnpm install`
# against a tree that has no pnpm-workspace.yaml — which fails the one-shot.
WORKDIR /repo/packages/db
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["./node_modules/.bin/drizzle-kit migrate"]
