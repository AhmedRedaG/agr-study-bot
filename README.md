# AGR Study

AGR Study is a Telegram academic-resource bot built with Node.js, strict TypeScript, grammY, and Turso (`@libsql/client`). It runs locally with long polling and on Vercel as a Telegram webhook. Student menus, academic structure, resource folders, archives, preferences, and in-progress interactions are stored in SQLite-compatible Turso tables.

## Architecture

- `src/config`: validates required environment variables and centralizes runtime configuration.
- `src/db`: shared Turso client and idempotent schema setup.
- `src/repositories`: parameterized persistence operations for academic content and users/sessions.
- `src/services`: domain-level orchestration for content and paced broadcasts.
- `src/bot`: grammY middleware, callback/action routing, inline keyboards, student views, and admin workflows.
- `api/webhook.ts`: Vercel HTTP handler using grammY's standard `Request`/`Response` webhook adapter.
- `scripts/init-db.ts` and `schema.sql`: initialize tables and the default content folders.

Repositories own SQL access; handlers translate Telegram updates into service/repository operations. The `user_sessions` table stores JSON workflow state with an expiration timestamp, so an admin upload or multi-step action remains available across stateless Vercel invocations. Callback data contains only short action names and numeric database IDs (not user-provided titles), remaining comfortably below Telegram's 64-byte limit.

## Requirements and configuration

- Node.js 20+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Turso database URL and auth token
- One or more Telegram administrator numeric IDs

Copy `.env.example` to `.env` for local work and fill in:

| Variable                    | Required               | Purpose                                                               |
| --------------------------- | ---------------------- | --------------------------------------------------------------------- |
| `BOT_TOKEN`                 | Yes                    | Telegram bot token                                                    |
| `ADMIN_IDS`                 | Yes                    | Comma-separated Telegram user IDs allowed to use `/admin`             |
| `TURSO_DATABASE_URL`        | Yes                    | Turso `libsql://...` database URL                                     |
| `TURSO_AUTH_TOKEN`          | Yes                    | Turso database auth token                                             |
| `WEBHOOK_SECRET_TOKEN`      | Production recommended | Validates Telegram's webhook secret header                            |
| `ARCHIVE_CHANNEL_ID`        | No                     | Optional private channel for upload metadata and a backup copy        |
| `REQUIRED_CHANNEL_ID`       | No                     | Channel ID/username used for optional force-subscribe verification    |
| `REQUIRED_CHANNEL_USERNAME` | No                     | Public channel username used to build the join button                 |
| `SUPPORT_CONTACT`           | No                     | Contact handle, email, or support URL shown in Contact Us             |
| `BROADCAST_DELAY_MS`        | No                     | Delay between broadcast recipients; defaults to 45 ms (minimum 35 ms) |

Keep tokens out of source control. The bot needs administrator access to the required channel to reliably verify membership. For upload backups, grant the bot permission to post in the archive channel.

## Local setup

```powershell
npm install
npm run db:init
npm run dev
```

`npm run dev` starts long polling. Do not run polling and the production webhook for the same bot token at the same time. Add the initial academic levels, terms, and courses from `/admin`; use `npm run db:init` to create the tables and seed standard folders.

## Deploy to Turso and Vercel

1. Create a Turso database and generate an auth token. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
2. Deploy this repository to Vercel. Add every required environment variable above to the Vercel project. Set `BOT_TOKEN`, `ADMIN_IDS`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a high-entropy `WEBHOOK_SECRET_TOKEN` for production.
3. Deploy with `vercel --prod`. The function at `/api/webhook` initializes the schema idempotently and validates Telegram's `X-Telegram-Bot-Api-Secret-Token` header when configured.
4. Register the webhook from a trusted terminal. Replace the placeholders locally; do not put the bot token in source control or shared logs:

```powershell
$body = @{
  url = "https://YOUR-VERCEL-DOMAIN/api/webhook"
  secret_token = "YOUR_WEBHOOK_SECRET_TOKEN"
  allowed_updates = @("message", "callback_query")
} | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" `
  -ContentType "application/json" -Body $body
```

Check webhook health with Telegram's `getWebhookInfo` API method. To switch back to local polling, remove the webhook with `deleteWebhook` first.

## Admin and content workflows

- `/admin` is restricted to `ADMIN_IDS`; `/cancel` exits the current prompt.
- Manage current (non-archived) levels, terms, and courses with the admin menus. Hidden current levels remain available to admins to restore, but archived levels and archived snapshot sources are filtered out of current-year menus.
- Manage dynamic folders (add, rename, hide/show, and reorder). New active folders appear in every course's student menu automatically. The seed contains Lectures, Sections, Summaries, Past Exams, and Books.
- Create an archive year such as `2024-2025`. Snapshotting a current level transactionally clones its terms, courses, and resource file references into that archive, then marks and hides the source level. Archived levels appear under that year and can be returned to current levels with **إعادة إلى الفرق الحالية**; the archive and active-level menus refresh after this action. Existing Telegram file IDs remain reusable. Admins can also create archived levels and populate their structure directly.
- Upload by selecting a level, term, course, and folder, then choose a single-file resource or a multi-part resource. Enter the shared title before sending files; multi-part uploads retain the message order and finish with `/done`. An individual caption can label a part. Telegram `file_id`, `file_unique_id`, file type, name, MIME type, caption, and uploader are stored. Optional archive-channel forwarding is best effort and reports failures in server logs; it does not undo a successful database save.
- Use **إدارة الملفات** in `/admin` to browse resources by level, term, course, and folder. Admins can rename a resource or part, append parts, replace a file while retaining its position/title, and delete either a part or an entire resource after confirmation. Student folders show paginated resource titles; selecting a multi-part title sends its files in order.
- Broadcast text or media to all known users or users who selected a specific level/term. Delivery is paced in a Vercel background task so the webhook can acknowledge Telegram promptly; blocked users are marked, and the admin receives delivered/blocked/failed counts when the send completes. The function timeout is configured to 300 seconds, subject to the limits of your Vercel plan.

Students can browse active and archived content, search current resources, set a preferred level and term, read About/Contact information, and send a message or suggestion to admins. In admin views, **القائمة الرئيسية** always returns to the admin dashboard; **واجهة الطالب / Start** is the dedicated action for opening the student menu. Empty menus have an explicit next-step message rather than failing.

## Database notes

`schema.sql` is the standalone schema and default-folder seed. `npm run db:init` applies the matching idempotent schema programmatically and inserts missing defaults. The bot also creates the schema and seeds any missing default folders on startup/webhook requests, which supports clean first deployment; applying `db:init` explicitly before launch is still recommended.

Archive snapshots are performed in one write transaction. Archived levels share the same levels/terms/courses/resources tables as current content, with `levels.archive_year_id` and `levels.is_archived` distinguishing them. Startup performs additive migrations for existing databases, including creating a resource group for each legacy file without changing its stored file ID, and marks legacy archived snapshots (including their hidden source level where identifiable). Current-level queries explicitly exclude both archive membership and the archive flag. User preference and broadcast audience selection are stored independently from browsing, so users can browse any level without changing their saved preference.

## Validation

```powershell
npm run typecheck
npm run build
```
