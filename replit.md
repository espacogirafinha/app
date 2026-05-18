# Espaço Girafinha — Reservation Management System

## Overview

A full-stack web application for managing party reservations at Espaço Girafinha, a children's party venue. Built as a pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/girafinha), wouter routing, Tailwind CSS, shadcn/ui components
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

- **Dashboard**: Stats overview (total revenue, paid/pending), upcoming events list, search, urgent payment alerts
- **Reservations**: Full CRUD, search/filter by name/phone/status, Export CSV, WhatsApp link generation, mark as paid
- **Calendar**: Monthly calendar view with color-coded payment status (green=paid, yellow=partial, red=unpaid), capacity indicators, clickable day modals
- **Reports**: Monthly summary, pack analysis with pie chart, revenue insights (avg per booking, best month, month comparison), line/bar/pie charts (Recharts), smart insights
- **Task Checklist**: Per-reservation preparation tasks. Default tasks auto-created on reservation creation (varies by pack: "Só Espaço" → 3 tasks, "Pack Completo" → 6 tasks). Modal-based UI to toggle, add, delete tasks. Progress bar (X/Y tarefas) on cards/rows. Dashboard alert "Festa próxima com tarefas por concluir" for events within 2 days with incomplete tasks. Mobile-friendly full-screen modal.
- **Pack system**: 4 predefined packs with suggested prices, manual override supported
- **WhatsApp**: Pre-filled confirmation message link and payment reminder variant
- **Responsive**: Sidebar navigation on desktop, bottom navigation on mobile (4 tabs: Dashboard, Reservas, Calendário, Relatórios). Mobile UX optimized for iPhone Pro Max (430px) with 44px+ tap targets, stacked modal buttons, and viewport-safe layouts.
- **Authentication**: Single-user private login (email + bcrypt-hashed password from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars). Express session stored in Postgres (`user_sessions` table). All `/api/*` routes protected except `/api/auth/*`. Frontend has AuthProvider + Gate that shows login page when unauthenticated. Logout button in sidebar (desktop) and top header (mobile).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Project Structure

```
artifacts/
  girafinha/          # React frontend (preview at /)
  api-server/         # Express API server (preview at /api)
lib/
  api-spec/           # OpenAPI spec (source of truth)
  api-client-react/   # Generated React Query hooks
  api-zod/            # Generated Zod schemas for server validation
  db/                 # Drizzle ORM schema and DB client
```

## DB Schema

- `reservations` table: customer info, event details, pack, pricing, timestamps
- `tasks` table: id, reservation_id (FK with cascade delete), title, completed, sort_order, created_at
- `user_sessions` table: managed by `connect-pg-simple` (sid, sess, expire). Created manually via SQL since esbuild does not bundle the package's `table.sql` asset.

## API Endpoints

- `GET/POST /api/reservations` — list & create
- `GET/PATCH/DELETE /api/reservations/:id` — get, update, delete
- `GET /api/dashboard/stats` — aggregate stats
- `GET /api/dashboard/upcoming` — upcoming reservations
- `GET /api/dashboard/calendar?year=&month=` — calendar grouped data
- `GET/POST /api/reservations/:id/tasks` — list/create tasks for a reservation
- `PATCH/DELETE /api/tasks/:taskId` — update (toggle completed, edit title) or delete a task
- `GET /api/tasks/summary?reservationIds=1,2,3` — bulk progress summary (total/completed counts)
- `GET /api/reports?year=&month=` — reports & analytics (monthly summary, pack stats, trend, insights)
- `POST /api/auth/login` — body `{email, password}`; sets httpOnly session cookie
- `POST /api/auth/logout` — destroys session
- `GET /api/auth/me` — returns `{email}` if authenticated, 401 otherwise
