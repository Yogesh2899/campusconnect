# Thapar Connect

A campus collaboration app for students, faculty, and administrators. Students can find faculty, request meetings, view their calendar, and message meeting participants. Faculty can manage availability and meeting requests. Administrators can manage accounts, announcements, and audit reports.

## Project structure

Run application commands from this `code/` directory.

| Path | Contents |
| --- | --- |
| `app/` | Next.js pages, role dashboards, directory, calendars, and API routes |
| `components/` | Shared login, navigation, and interface components |
| `lib/` | Authorization, enrollment, meetings, email, and database access |
| `prisma/` | PostgreSQL schema and versioned migrations |
| `public/` and `assets/` | Website images and the faculty directory PDF |
| `scripts/` | Optional seeding and directory PDF generation |
| `tests/` | Integration tests for authentication and role workflows |
| `vercel.json` | Production build, migration, and cron configuration |

## Run locally

Use Node.js 24, pnpm 12.3.4, and a separate PostgreSQL database for local development.

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm dev
```

On PowerShell, use `Copy-Item .env.example .env` for the first command. Fill in the environment values before running migrations or starting the app.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL. Use TLS for a hosted database. |
| `BETTER_AUTH_URL` | Exact application origin, such as `http://localhost:3000`. |
| `BETTER_AUTH_SECRET` | Random authentication secret containing at least 32 bytes of entropy. |
| `BREVO_API_KEY` and `EMAIL_FROM` | Server-side Brevo credentials and a verified sender for email codes and invitations. |
| `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` | Optional Google sign-in. Configure the callback as `<BETTER_AUTH_URL>/api/auth/callback/google`. |
| `CRON_SECRET` | Server-side secret for the scheduled roster worker. |
| `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` | Optional local bootstrap settings for `pnpm db:seed`. Use a unique password and remove the bootstrap settings after provisioning. |
| `DEPARTMENT_NAME` | Optional department for `pnpm db:seed`. |

The app uses Better Auth for sessions, Prisma for PostgreSQL access, and Brevo for email. Student registration verifies institutional mailboxes. Faculty activate through the directory or an authorized invitation. Administrator access requires a password and a session-bound email code.

## Test and deploy

Run `pnpm typecheck` and `pnpm build`. For integration tests, start the app with a disposable local PostgreSQL database, set `CAMPUS_TEST_DATABASE=disposable`, and run `pnpm test` with the same environment configuration. The integration suite creates test records.

For Vercel, set the project root directory to `code`, select the Next.js preset, and configure Node.js 24. Save deployment values in Vercel Environment Variables. Use a separate database and origin for previews. The production build uses `DATABASE_URL_UNPOOLED` for migrations when provided.

The DCSE directory migration includes faculty and coordinator reference data. Live student accounts, roster files, and audit records are stored separately from the repository.
