# FurkanSoğutma

E-commerce platform for FurkanSoğutma with three clients sharing one NestJS backend.

## Monorepo layout

```text
furkansogutma/
├── package.json   # npm workspaces root
├── api/           # NestJS REST API
├── web/           # Public storefront (Next.js — milestone 10)
├── admin/         # Admin panel (Next.js — milestone 9)
├── mobile/        # Android application (Kotlin / Compose)
├── docs/          # Architecture and project docs
└── README.md
```

## Architecture (planned)

```text
Android  ·  Web  ·  Admin
            ↓
        NestJS API
            ↓
     PostgreSQL / Redis
```

See [docs/architecture.md](docs/architecture.md) for details.

## Getting started (API)

From the monorepo root:

```bash
cp api/.env.example api/.env
npm install
npm run api:docker:up
npm run api:prisma:generate
npm run api:prisma:migrate:dev
npm run api:start:dev
```

## Getting started (Web)

```bash
cp web/.env.example web/.env.local
npm run api:start:dev   # terminal 1
npm run web:dev         # terminal 2 → http://localhost:3002
```

## Getting started (Admin)

```bash
cp admin/.env.example admin/.env.local
npm run api:start:dev   # terminal 1
npm run admin:dev       # terminal 2 → http://localhost:3001
```

Root scripts:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
npm run admin:dev
```

- API base: http://localhost:3000/api/v1  
- Health: http://localhost:3000/api/v1/health  
- Swagger: http://localhost:3000/api/docs  
- Admin: http://localhost:3001  

Full API documentation: [api/README.md](api/README.md)  
Admin documentation: [admin/README.md](admin/README.md)

## Current milestone

**Milestone 10 — Public Web Storefront** (current)

**Milestone 9 — Admin Panel foundation** (done)

Auth, RBAC-aware navigation, live dashboard totals from existing admin APIs, module list shells.

**Milestone 8 — Campaigns + Banners + Notifications** (done)

**Milestone 7 — Payments + Accounting** (done)

**Milestone 6 — Orders + Checkout** (done)

**Milestone 5 — Cart + Favorites + Alerts** (done)

**Milestone 4 — Inventory + Pricing** (done)

**Milestone 3 — Product catalog** (done)

**Milestone 2 — Auth + User + JWT + RBAC** (done)

**Milestone 1 — API foundation** (done)

## Next milestones

Admin CRUD UX depth, public web storefront, Android client, real FCM/payment/shipping.
