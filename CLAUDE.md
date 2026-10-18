# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Backend API server for "Đặc sản ba miền" (regional specialties e-commerce), written in TypeScript on Express 5 / Node.js, backed by MySQL (via `mysql2/promise`). Backend-only repo — do not add frontend work here. Entry point: `src/server.ts`. Source lives in `src/`; compiled output goes to `dist/`.

## Purpose

This is a school capstone project (repo path `DO-AN` = "Đồ án"), not a production company codebase. It's the API for a regional-specialties food marketplace: browse/list products by region (Bắc/Trung/Nam) and type (fresh `tai_cho` vs dried/preserved `do_kho`), cart, checkout, order-status tracking, PayPal payment, product reviews, and shop-wide feedback, plus an admin back-office (user/product management, revenue stats). It talks to a real deployed frontend (`regional-specialties.vercel.app` / `regional-specialties-fe.up.railway.app`) and real third-party services (MySQL on Railway, PayPal **sandbox**, Gmail SMTP) — but several behaviors are demo-oriented shortcuts rather than production-grade design (see below). Treat this as a learning/demo project: prioritize matching existing patterns and not breaking the deployed FE integration over introducing "proper" enterprise patterns unprompted.

For a full walkthrough of every business flow (cart/checkout, payment, order-status lifecycle, reviews, etc.) see [docs/BUSINESS_FLOWS.md](docs/BUSINESS_FLOWS.md).

## Commands

- Install dependencies: `yarn`
- Start dev server (auto-reload via ts-node-dev): `yarn dev`
- Compile TypeScript: `yarn build`
- Run compiled build: `yarn start` (runs `dist/server.js`, requires `yarn build` first)

There is no configured lint or test script/framework in this repo — don't assume `yarn test` or `yarn lint` exist.

API testing is done manually with Bruno (`.bru` collections), not an automated test suite.

## Architecture

Classic layered Express structure, one feature per file across three parallel folders:

- `src/routes/*.router.ts` / `*.routes.ts` — defines endpoints and wires middleware → controller for one feature area (products, orders, auth, paypal, upload, etc.). Routes are mounted in `src/server.ts`.
- `src/controllers/*.controller.ts` — request handlers containing the actual business logic and raw SQL queries (no ORM/query builder — queries are written directly against `db` from `src/database.ts` using parameterized `?` placeholders).
- `src/model/*.model.ts` — plain TypeScript interfaces describing DB row shapes (not active-record classes).

Other key pieces:
- `src/database.ts` — exports the shared `mysql2` connection pool (`db`) and `testConnection()`, called once at startup in `server.ts`.
- `src/middlewares/authMiddleware.ts` — verifies the `Bearer <JWT>` header, decodes it, and attaches `req.user`. Exports the `AuthRequest` type that controllers/other middleware extend to type `req.user`.
- `src/middlewares/isAdmin.ts` and `verifyAdmin.ts` — two near-duplicate role checks (both require `req.user.role === "admin"`); routes use one or the other, not both.
- `src/email.service.ts` — nodemailer transporter + `sendEmail()` helper, used by controllers that need to notify users (forgot password, order status, etc.).
- `src/cron/update.status.automatic.ts` — `node-cron` job that auto-advances order status (`Đã xác nhận` → `Đang giao` → `Hoàn thành`) for orders registered via `addPendingOrder()`; runs in-process, state is an in-memory object (not persisted, resets on server restart).
- Static file serving: `upload/` (product images, mounted at `/uploads`) and `public/avatars/` (user avatars, mounted at `/avatars` and `/public`) are created on boot if missing and served via `express.static`.

### Request flow conventions

- Auth: `authMiddleware` (JWT decode) is applied per-route, then `verifyAdmin`/`isAdmin` for admin-only routes. Public GET endpoints (e.g. product listing) skip auth entirely.
- Most tables use Vietnamese column/table names (`sanpham`, `donhang`, `khachhang`, `TrangThai`, `MaSP`, etc.) — match existing naming when adding queries, don't translate to English.
- Soft deletes are used for products (`is_deleted` / `deleted_at` flags) rather than hard `DELETE`; preserve this pattern for related entities.
- `server.ts` mounts each router with an inline logging middleware (`console.log("🔥 Vào được ...")`) before the router itself — this is intentional existing debug logging, follow the same pattern when adding a new route group rather than silently omitting it.
- CORS in `server.ts` allows only a fixed list of origins (local dev ports + deployed FE URLs); adding a new frontend origin requires updating that list explicitly.

### Config

- `tsconfig.json` declares path aliases (`@controllers/*`, `@models/*`, `@routes/*`, etc.) but **no code currently uses them** — imports are relative (`../database`, `../model/...`). Don't introduce alias imports without also confirming Node's runtime resolution (ts-node-dev/tsc) is set up to honor them, since nothing currently does.
- Env vars (see `.env`, gitignored) cover DB connection (`DB_HOST/PORT/USER/PASS/NAME`), `JWT_SECRET`, mail (`EMAIL_USER/PASS`), PayPal sandbox (`PAYPAL_CLIENT_ID/SECRET`, `PAYPAL_API_ENDPOINT`), and `BASE_URL`/`BACKEND_URL`/`FRONTEND_URL` used to build PayPal return/redirect URLs.

## Important caveats for future changes

Known rough edges found by reading the code — be aware of these before "fixing" something that looks like a bug, and flag to the user if a task touches one of these areas (full detail in [docs/BUSINESS_FLOWS.md § 5](docs/BUSINESS_FLOWS.md#5-tóm-tắt-các-known-issues-đáng-lưu-ý-khi-phát-triển-tiếp)):

- **Two independent cart implementations** exist over the same data (`chitietdonhang` rows keyed by fake `MaDonHang = CART_<user_id>`): `order.detail.controller.ts` (`/api/order-detail`, transactional + stock-locking) and `order.controller.ts`'s cart methods (`/api/orders/cart`, no transaction). Know which one a given FE call is hitting before changing cart behavior.
- **Uploaded file destination mismatch**: `POST /api/upload` and `POST /api/imgproduct` write into an `uploads/` folder, but `server.ts` only serves static files from `upload/` (singular) at the `/uploads` URL path — those two upload flows likely 404 on the returned URL. Only `/api/upload/avatar` (→ `public/avatars/`) is wired correctly end-to-end.
- **`reset_token` generated but never checked** — `resetPassword` only validates `tempPassword` against the current `users.password` hash (the mailed temp password *is* the live password) and an expiry timestamp; the token itself is dead code.
- **`PUT/DELETE /api/reviews/:reviewId`** (product reviews) have no `authMiddleware` — anyone who knows a `reviewId` can edit/delete it.
- **Order-status cron** (`src/cron/update.status.automatic.ts`) auto-advances `Đã xác nhận → Đang giao → Hoàn thành` on hardcoded **5s / 15s** timers, with state kept in an in-memory object — doesn't survive a server restart, and PayPal-paid orders (set to `Đã xác nhận` directly in `paypal.controller.ts`) never get registered with it, so they never auto-advance.
- `JWT_SECRET` has an insecure code fallback (`"defaultsecret"`) if the env var is missing — don't rely on that fallback existing as a safety net; a missing `.env` should be treated as a real misconfiguration, not "it'll still work."
- Deletion is inconsistent by entity: products use soft-delete (`is_deleted`/`deleted_at`), but users and orders use hard `DELETE` — don't assume one pattern applies project-wide.
