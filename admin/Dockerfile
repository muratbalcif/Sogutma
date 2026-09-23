# Multi-stage production image for FurkanSoğutma Admin (Next.js standalone).
# Build from repository root:
#   docker build -f admin/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 \
#     -t furkansogutma-admin .
#
# NEXT_PUBLIC_* are baked in at build time — never pass secrets as build args.
# Admin embeds POS sell UI from workspace package furkansogutma-pos (transpilePackages).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY admin/package.json ./admin/
COPY api/package.json ./api/
COPY pos/package.json ./pos/
RUN npm ci -w furkansogutma-admin --include-workspace-root=false

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/admin/node_modules ./admin/node_modules
COPY package.json package-lock.json ./
COPY pos ./pos
COPY admin ./admin

ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN test -n "$NEXT_PUBLIC_API_BASE_URL" || (echo "NEXT_PUBLIC_API_BASE_URL is required" && exit 1)
RUN npm run build -w furkansogutma-admin
# Fail if a localhost API URL leaked into the production admin bundle.
RUN ! grep -R "localhost:3000" admin/.next/static admin/.next/server \
  || (echo "ERROR: localhost:3000 found in admin production bundle" && exit 1)

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0
RUN apk add --no-cache wget \
  && addgroup -S app && adduser -S app -G app

# outputFileTracingRoot = monorepo root → standalone layout includes admin/
COPY --from=build /app/admin/.next/standalone ./
COPY --from=build /app/admin/.next/static ./admin/.next/static
COPY --from=build /app/admin/public ./admin/public

USER app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/ >/dev/null || exit 1
CMD ["node", "admin/server.js"]
