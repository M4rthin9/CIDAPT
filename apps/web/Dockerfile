FROM node:22.22-alpine3.23 AS builder
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY packages/config/ packages/config/
COPY packages/contracts/ packages/contracts/
COPY packages/db/ packages/db/
COPY apps/web/ apps/web/
RUN pnpm --filter @cida/web build

FROM node:22.22-alpine3.23 AS runner
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /app
RUN addgroup -g 1001 -S cida && adduser -S cida -u 1001 -G cida
COPY --from=builder /repo/apps/web/build ./build
COPY --from=builder /repo/apps/web/package.json ./
COPY --from=builder /repo/node_modules ./node_modules
USER cida
EXPOSE 3001
CMD ["node", "build"]
