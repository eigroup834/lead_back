# Frontend — Exhibitor CRM

React 18 + TypeScript + Vite + Redux Toolkit + RTK Query + MUI v6 + Recharts.

## Quickstart
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173  (proxies /api -> http://localhost:4000)
```
Start the backend first (`cd backend && npm run dev`). Log in with the seeded
admin: `admin@exhibitor.local` / `Admin@12345`.

## Build
```bash
npm run build    # type-check + production bundle into dist/
npm run preview  # preview the production build
```

## Architecture
- **State/data**: a single RTK Query `api` slice (`src/app/api.ts`) with a custom
  `baseQuery` that injects the access token and transparently refreshes it on 401
  using the httpOnly refresh cookie (`src/app/baseQuery.ts`).
- **Auth**: `App.tsx` performs a silent refresh on boot; routes are guarded by
  `RequireAuth` + `RequirePermission` (`src/routes/guards.tsx`).
- **RBAC UI**: the sidebar and pages are filtered by the user's permission set
  via `usePermissions()` — the same keys the backend enforces.
- **Code splitting**: every route is `React.lazy`-loaded; vendor chunks are split
  in `vite.config.ts`.
- **Theming**: light/dark MUI theme in `src/theme`, toggled from the header and
  persisted to localStorage.

## Key screens
`Dashboard` (stat cards + Recharts line/pie/bar + leaderboard) ·
`Lead Management` (server-side cursor pagination, filters, global search, column
visibility, bulk select + assign) · `Lead Details` (info, status timeline,
assignment history, activity timeline, follow-ups, notes) · `Follow-ups` ·
`Users` · `Roles` (editable permission matrix) · `Audit Logs` · `Reports`
(queued export with job polling).
