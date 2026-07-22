# Exhibitor Lead Management CRM

Enterprise-grade Lead Management CRM designed to scale to **1M+ leads** and **100+ concurrent users** across multiple teams and departments.

> Monorepo: `backend/` (Node + Express + TypeScript + Prisma + PostgreSQL + Redis + BullMQ) and `frontend/` (React + Redux Toolkit + RTK Query + MUI + Recharts).

---

## 1. High-Level Architecture

```
                         ┌────────────────────────────────────────────┐
                         │                 Nginx (TLS)                  │
                         │     /  -> frontend (static)  /api -> 4000    │
                         └───────────────┬──────────────────────────────┘
                                         │
        ┌────────────────────────────────┼───────────────────────────────┐
        │                                │                                │
┌───────▼────────┐              ┌────────▼─────────┐             ┌────────▼────────┐
│  React SPA     │   REST/JSON  │  Express API     │   Prisma    │  PostgreSQL     │
│  RTK Query     │◄────────────►│  (PM2 cluster)   │◄───────────►│  exhibitor_db   │
│  MUI / Recharts│   JWT auth   │  RBAC middleware │   pool      │  (1M+ leads)    │
└────────────────┘              └───┬───────┬──────┘             └─────────────────┘
                                    │       │
                          cache /   │       │  enqueue jobs
                          sessions  │       │
                              ┌─────▼──┐ ┌──▼───────────┐        ┌──────────────────┐
                              │ Redis  │ │ BullMQ Queues│        │  SQL Server      │
                              │ cache  │ │ sync/export/ │◄──────►│  dbo.exhi_reg    │
                              │ ratelmt│ │ notify       │  pull  │  (source website)│
                              └────────┘ └──────┬───────┘        └──────────────────┘
                                                │
                                         ┌──────▼───────┐
                                         │ Workers (PM2)│  cron: every 5 min sync
                                         └──────────────┘
```

**Clean / layered architecture** per module: `route → middleware → controller → service → repository → Prisma`. Cross-cutting concerns (auth, RBAC, audit, rate-limit, error handling) live in middleware; async work (sync, exports, notifications) lives in `queues/jobs/workers`; scheduling in `cron/`.

---

## 2. Backend Folder Structure

```
backend/src
├── app.ts                 # Express app wiring (no listen)
├── server.ts              # HTTP bootstrap + graceful shutdown
├── worker.ts              # BullMQ worker bootstrap (separate process)
├── config/                # env, prisma, redis, logger, swagger
├── middleware/            # auth, rbac, error, rate-limit, audit, validate
├── modules/               # vertical slices (auth, users, roles, leads, ...)
│   └── <feature>/         #   <feature>.route|controller|service|repository|validator
├── routes/                # route aggregator (v1)
├── services/              # shared/cross-module services (cache, token, mssql)
├── repositories/          # shared base repository helpers
├── queues/                # BullMQ queue + worker definitions
├── jobs/                  # job processors (sync, export, notification)
├── events/                # domain event bus + handlers
├── cron/                  # schedulers (lead sync, followup sweep)
├── validators/            # shared Zod schemas
├── utils/                 # pagination, errors, crypto, response
├── types/                 # shared TS types & Express augmentation
└── prisma/                # schema.prisma + seed.ts + migrations
```

## 3. Frontend Folder Structure

```
frontend/src
├── app/          # store config, RTK Query base api
├── routes/       # route table + guards (RequireAuth, RequirePermission)
├── layouts/      # AppLayout (sidebar + header + breadcrumbs)
├── pages/        # route-level screens (Dashboard, Leads, LeadDetails, ...)
├── features/     # redux slices + RTK Query endpoints per domain
├── components/   # reusable UI (DataTable, Charts, StatCard, ...)
├── hooks/        # usePermissions, useDebounce, useColumnVisibility
├── services/     # axios instance, token refresh interceptor
├── store/        # typed hooks
├── theme/        # MUI theme (light/dark), palette, typography
├── constants/    # enums, permission keys, menu config
└── utils/        # formatters, exporters
```

---

## 4. REST API Surface (v1, prefix `/api/v1`)

| Area | Method & Path | Permission |
|------|---------------|-----------|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` | public / authed |
| Users | `GET/POST /users` · `GET/PATCH/DELETE /users/:id` | `user.view` / `user.create` / `user.update` |
| Roles | `GET/POST /roles` · `PATCH /roles/:id/permissions` | `role.manage` |
| Permissions | `GET /permissions` | `role.manage` |
| Departments | `GET/POST /departments` | `department.manage` |
| Leads | `GET /leads` (cursor) · `GET /leads/:id` · `PATCH /leads/:id` · `POST /leads/:id/status` | `lead.view` / `lead.edit` |
| Assignments | `POST /leads/assign` · `POST /leads/assign/bulk` · `POST /leads/assign/auto` | `lead.assign` |
| Notes | `GET/POST /leads/:id/notes` | `lead.view` |
| Activities | `GET/POST /leads/:id/activities` | `lead.view` |
| Followups | `GET /followups` · `POST /leads/:id/followups` · `PATCH /followups/:id` | `lead.view` |
| Dashboard | `GET /dashboard/summary` · `/dashboard/funnel` · `/dashboard/trends` | `dashboard.view` |
| Team perf | `GET /dashboard/team-performance` · `/dashboard/leaderboard` | `analytics.view` |
| Reports | `POST /reports/export` (queued) · `GET /reports/:jobId` | `report.export` |
| Audit | `GET /audit-logs` | `audit.view` |
| Sync | `GET /sync/logs` · `POST /sync/run` | `lead.sync` |
| Notifications | `GET /notifications` · `PATCH /notifications/:id/read` | authed |

Full schemas served at `GET /api/docs` (Swagger UI).

---

## 5. Authentication Flow (JWT + Refresh Rotation)

1. `POST /auth/login` → bcrypt-verify password → issue **access token** (15 min, stateless) + **refresh token** (7 days). Refresh token is random, **hashed** and stored in `refresh_tokens`, returned as an **httpOnly, SameSite=Strict** cookie.
2. Each request: `Authorization: Bearer <access>` → `authMiddleware` verifies signature/expiry → loads permission set (cached in Redis) → attaches `req.user`.
3. `POST /auth/refresh` → validates the cookie token against its hash → **rotates** it (revoke old, issue new, detect reuse → revoke whole family) → new access token.
4. `POST /auth/logout` → revoke refresh token family + bust permission cache.

Permission checks: `requirePermission('lead.assign')` middleware reads the cached permission set; row-level scoping (executive sees only own leads) is enforced in the repository via the user's `level`/`id`.

---

## 6. Environment Variables (`backend/.env`)

```
NODE_ENV=development
PORT=4000
API_PREFIX=/api/v1

# Local app DB (Prisma)
DATABASE_URL=postgresql://postgres:1234@localhost:5432/exhibitor_db?schema=public&connection_limit=20&pool_timeout=20

# External source DB (SQL Server: dbo.exhi_reg)
SOURCE_DB_TYPE=mssql
SOURCE_DB_HOST=localhost
SOURCE_DB_PORT=1433
SOURCE_DB_NAME=website_db
SOURCE_DB_USER=sa
SOURCE_DB_PASSWORD=changeme
SOURCE_DB_ENCRYPT=true

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=replace-with-64-char-random
JWT_REFRESH_SECRET=replace-with-64-char-random
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# Security
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
BCRYPT_ROUNDS=12

# Sync
SYNC_CRON=*/5 * * * *
SYNC_BATCH_SIZE=500

# Storage
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=./storage
```

---

## 7. Database Indexing Strategy

Indexed columns (per spec) on `leads`: `email`, `mobile`, `status`, `assignedUserId`, `createDate`, `eventName`, `country`, plus `sourceId (unique)` for dedup and composite `(status, assignedUserId)` / `(country, status)` for filtered list queries. `lead_followups`: `(followupDate, status)`, `assigneeId`. `audit_logs`: `(userId, createdAt)`, `module`. `lead_activities`: `(leadId, activityDate)`. All large, append-only tables (`leads`, `lead_activities`, `audit_logs`) are **range-partition-ready** by `createdAt` (see `prisma/partitioning.sql`).

---

## 8. Caching & Queue Strategy (Redis + BullMQ)

- **Redis cache**: permission sets per user (`perm:{userId}`), dashboard aggregates (`dash:summary` TTL 60s), reference lists (countries/events). Write paths bust the relevant keys.
- **Rate limiting**: sliding window in Redis (`rate-limit-redis`).
- **Queues**: `sync` (incremental import), `export` (large CSV/Excel/PDF), `notification` (email/whatsapp/sms/push). Workers run in a separate PM2 process (`worker.ts`) so API latency is unaffected.

---

## 9. Lead Sync Architecture (every 5 min, incremental, no full scan)

```
cron(*/5) ──► sync queue ──► sync worker
                               1. read sync_state.lastSyncedId / lastSyncedDate
                               2. SELECT TOP N * FROM dbo.exhi_reg
                                  WHERE id > @lastSyncedId ORDER BY id  (batched)
                                  └─ via mssql pool (read-only)
                               3. upsert into leads ON CONFLICT(sourceId) DO NOTHING
                               4. advance sync_state, write sync_logs row
                               5. new leads → status NEW, emit lead.created event
```

Idempotent (unique `sourceId`), resumable (cursor in `sync_state`), observable (`sync_logs`), and back-pressure safe (batched `SYNC_BATCH_SIZE`).

---

## 10. Deployment (no Docker) — Nginx + PM2

```
# build
cd backend && npm ci && npm run build && npx prisma migrate deploy && npm run seed
cd ../frontend && npm ci && npm run build      # outputs dist/

# run (PM2)
pm2 start backend/ecosystem.config.js          # api (cluster) + worker
pm2 save && pm2 startup
# serve frontend/dist + reverse-proxy /api via nginx (see deploy/nginx.conf)
```

---

## 11. Production Scaling Strategy

- **API**: PM2 cluster mode (1 process/core) behind Nginx; stateless (JWT) → horizontal scale.
- **DB**: PgBouncer connection pooling, read replica for analytics, range partitioning + BRIN on `createdAt`, materialized views for dashboard aggregates refreshed by cron.
- **Workers**: scale `sync`/`export`/`notification` concurrency independently; isolate from API.
- **Cache**: Redis for hot reads + rate limit; Redis Cluster when needed.
- **Frontend**: code-splitting per route, memoized selectors, virtualized tables, CDN for static assets.
- **Observability**: Winston JSON logs, `/metrics` Prometheus endpoint, health/readiness probes.

---

## 12. Security Implementation

bcrypt (12 rounds) · short-lived access JWT + rotating refresh tokens (reuse detection) · Helmet · strict CORS · Redis rate limiting · Zod input validation + sanitization · Prisma parameterized queries (SQL-injection safe) · httpOnly/SameSite cookies (CSRF) · RBAC + permission middleware · full audit logging.

---

## 13. Roadmap

- **Phase 0 (done)** — schema, config, auth/RBAC, leads + sync foundation.
- **Phase 1** — assignment engine, activities, followups, dashboard.
- **Phase 2** — reporting/exports, audit UI, notifications (in-app).
- **Phase 3** — skill/territory-based assignment, email/WhatsApp channels, S3 storage, read replicas, materialized views.
- **Phase 4** — multi-tenant, SSO/SAML, mobile app, predictive lead scoring.

See `docs/ERD.md` for the entity-relationship diagram.
