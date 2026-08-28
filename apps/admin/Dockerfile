# The admin SPA is static: this image only builds `dist/` and hands it to the
# `admin_static` volume Caddy serves from. It runs to completion and exits
# rather than staying up as a long-lived service.
FROM node:22.22-alpine3.23 AS builder
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY apps/admin/package.json apps/admin/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY packages/config/ packages/config/
COPY packages/contracts/ packages/contracts/
COPY apps/admin/ apps/admin/
RUN pnpm --filter @cida/admin build

FROM alpine:3.23.5 AS publisher
WORKDIR /dist
COPY --from=builder /repo/apps/admin/dist/ ./
# Replace the volume contents so a redeploy cannot leave stale hashed assets behind.
CMD ["sh", "-c", "rm -rf /srv/admin/* && cp -r /dist/. /srv/admin/ && echo 'admin SPA published to /srv/admin'"]
