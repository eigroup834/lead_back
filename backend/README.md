# Backend — Exhibitor CRM API

Node + Express + TypeScript + Prisma (PostgreSQL) + Redis + BullMQ.

## Prerequisites (no Docker)
- Node 20+
- PostgreSQL 14+ running locally with database `exhibitor_db` (user `postgres`, password `1234`)
- Redis running on `localhost:6379`
- (Optional) SQL Server source DB exposing `dbo.exhi_reg` for live lead sync

## Quickstart
```bash
cd backend
cp .env.example .env            # then edit secrets
npm install
npm run prisma:generate
npm run migrate                 # creates all tables (dev)
npm run seed                    # permissions, roles, matrix, super admin
npm run dev                     # API on :4000   (http://localhost:4000/api/docs)
npm run dev:worker              # queues + 5-min lead sync (separate terminal)
```

Default login (from seed): `admin@exhibitor.local` / `Admin@12345`.

## Create the database (psql)
```bash
psql -U postgres -h localhost -c "CREATE DATABASE exhibitor_db;"
```

## Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | API with hot reload (tsx) |
| `npm run dev:worker` | BullMQ workers + sync scheduler |
| `npm run migrate` | Prisma migrate (dev) |
| `npm run migrate:deploy` | Prisma migrate (prod) |
| `npm run seed` | Seed RBAC + admin |
| `npm run build` | Compile to `dist/` (tsc + tsc-alias) |
| `npm start` / `npm run start:worker` | Run compiled API / worker |

## Production (PM2)
```bash
npm ci && npm run build && npm run migrate:deploy && npm run seed
pm2 start ecosystem.config.js
```

## Layout
See the root `README.md` (section 2) for the full module/folder map. Each feature
in `src/modules/<feature>` follows `route → controller → service → repository`.
