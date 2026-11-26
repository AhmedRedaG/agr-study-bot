# Project instructions — AGR Study Bot

Telegram academic-resource bot (grammY + Turso/libsql, strict ESM TypeScript). Arabic student UI. Local long polling; Vercel webhook in production.

## Commands and verification

- `npm install`; `npm run dev` (`tsx watch src/index.ts`, long polling); `npm run db:init` (schema + default folders); `npm run start` (`node dist/src/index.js`).
- `npm run typecheck` (`tsc --noEmit`) and `npm run build` (`tsc` → `dist/`) are the only verification steps — there are no test, lint, or formatter scripts. Run both after TypeScript changes. Do not edit `dist/` or `node_modules/`.

## Setup and secrets

- Copy `.env.example` to `.env`; required: `BOT_TOKEN`, `ADMIN_IDS` (comma-separated Super Admin Telegram IDs), `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. `WEBHOOK_SECRET_TOKEN` is recommended in production.
- `src/config/env.ts` imports `dotenv/config` and validates/coerces at import time; missing or invalid variables throw before handlers run. `BROADCAST_DELAY_MS` is clamped to at least 35 ms.
- `.env` is gitignored — never commit tokens or paste them into logs/chat.
- Never run local polling and the production webhook with the same bot token at the same time.

## Architecture and ownership

- `src/config/env.ts` — env parsing; `src/db/client.ts` — shared libsql client; `src/db/schema.ts` — `ensureSchema()` applies idempotent DDL once per process (no folder seed).
- `src/repositories/` is the only SQL owner (`study-repository.ts`, `user-repository.ts`, `admin-role-repository.ts`); parameterized queries only, `idOf()` for inserted IDs. `src/services/` owns validation and rules (`study-service.ts`, `access-service.ts`, paced `broadcast-service.ts`, `background-tasks.ts`).
- `src/bot/index.ts` — grammY handlers, middleware, `routeCallback` / `routeAdminCallback` / `routeUploadCallback` / `routeManageCallback`, and `show()`; `src/bot/keyboards.ts` — inline keyboards; `src/types/domain.ts` — snake_case DB row types, `AdminState`, and Role/Scope types.
- `src/index.ts` (polling) and `api/webhook.ts` (Vercel, `/api/webhook`) both await `ensureSchema()` and `registerBotCommands()` at startup. Handlers translate updates into service/repository calls: keep new SQL in repositories and new validation in services.

## Runtime/infra gotchas

- `api/webhook.ts` uses the Node-style handler (`IncomingMessage`/`ServerResponse`, `webhookCallback(bot, "http")`, `config.api.bodyParser = false`); the README's `Request`/`Response` description is stale. It checks `X-Telegram-Bot-Api-Secret-Token` when configured; `vercel.json` sets a 300 s function timeout.
- `withBackgroundScheduler(waitUntil, ...)` uses `AsyncLocalStorage` so `scheduleBackgroundTask()` hands long jobs to Vercel `waitUntil`; with no scheduler it only logs rejections. Use it for long work in webhook invocations.
- `registerBotCommands()` rethrows on failure and both entrypoints await it — do not assume command registration is best-effort. Archive-channel backup failures, by contrast, are caught and logged after the DB write succeeds.
- Keep DDL in sync between `schema.sql` and the `schema` string in `src/db/schema.ts`; there are no migrations, so schema changes assume a fresh DB. Default folders are seeded only by `schema.sql` / `scripts/init-db.ts` via `npm run db:init` — `ensureSchema()` does not seed them.

## Code conventions

- ESM with `module: NodeNext` — relative imports must use `.js` extensions (e.g. `../db/client.js`) even in `.ts` files.
- Strict TS with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; prefer explicit guards over non-null assertions.
- TypeScript uses camelCase; DB columns and domain row interfaces use snake_case. User-facing strings are Arabic; use `escapeHtml()` with HTML parse mode.
- Callback data is short colon-delimited (`area:action:id:...:page`) with action names and numeric IDs only — never user-provided titles. `show()` throws when `callback_data` exceeds Telegram's 64 bytes.
- Multi-step admin flows live in `AdminState`, stored as JSON in `user_sessions` (default TTL 30 min; multipart uploads re-save with a 1 h TTL after each part) and handled by `handleState`. `/cancel` clears/resolves state; `/done` finishes uploads.
- RBAC: `ADMIN_IDS` are always Super Admins; Content Admins live in `admin_roles` + `admin_role_scopes` and are managed from the Super Admin **مشرفو المحتوى** panel. Granting uses the `grant-admin` `AdminState` wizard (id → name → optional phone/Telegram username/notes, with `adm:staffskip:<field>` buttons) and stores profile details in `admin_roles`. Use `AccessService` (`canAccessAdmin`, `canManageCourse`, `manageable*`) for every admin route. Structural actions (`adm:` except home/student/upload/resources), broadcasts, and role management require `isSuperAdmin`; `up:` and `mg:` routes must verify `canManageCourse` server-side, not just hide buttons.
- Content model: current levels have `archive_year_id IS NULL AND is_archived = 0`; archived snapshots share the same tables and reuse Telegram file IDs. Departments belong to a level; courses belong to a term, with `department_id NULL` meaning a shared course. Always exclude archived content from current-year queries.
