# Multi-stage production image for FurkanSoğutma API.
# Build from repository root (monorepo lockfile):
#   docker build -f api/Dockerfile -t furkansogutma-api .

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN npm ci -w furkansogutma-api --include-workspace-root=false --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
COPY package.json package-lock.json ./
COPY api ./api
WORKDIR /app/api
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget \
  && addgroup -S app && adduser -S app -G app
COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN npm ci -w furkansogutma-api --omit=dev --include-workspace-root=false --ignore-scripts \
  && npm cache clean --force
COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/api/prisma ./api/prisma
# npm workspaces hoist @prisma/client to /app/node_modules; generate writes .prisma there
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
WORKDIR /app/api
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live || exit 1
CMD ["node", "dist/main.js"]
