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
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["corepack enable && corepack prepare pnpm@11.22.0 --activate && pnpm --filter @cida/db migrate"]
