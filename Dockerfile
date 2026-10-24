# syntax=docker/dockerfile:1

# The image holds only static files and no secrets. Service URLs (backend.url,
# email.url, storage.url and so on) come from the host shell at runtime, so one
# image works for every region. FRAME_ANCESTORS sets which origins may embed it.

# Node 25 no longer bundles corepack, so it is installed first.
FROM node:25.2.0-alpine AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN rm -f /usr/local/bin/yarn /usr/local/bin/yarnpkg && npm install -g corepack@0.34.0 --no-fund --no-audit && corepack enable

WORKDIR /src/files

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && rm -f dist/assets/*.map dist/CNAME

# Runtime stage: unprivileged nginx (uid 101) on port 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine-slim

USER root
RUN mkdir -p /etc/nginx/snippets && chown 101:101 /etc/nginx/snippets
USER 101

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chmod=755 docker/40-shellui-frame-ancestors.sh /docker-entrypoint.d/40-shellui-frame-ancestors.sh
COPY --from=build /src/files/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
