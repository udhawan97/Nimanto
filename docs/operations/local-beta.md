# Run and operate the local beta

## Requirements

- Node.js 24, 25, or 26
- pnpm 11.20.0 through Corepack
- 1 GB of free disk space for dependencies, local data, and packet artifacts

## Start

On macOS, double-click `START-NIMANTO.command`.

Or run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open:

- workbench: `http://127.0.0.1:4300/workspace/`
- product website: `http://127.0.0.1:4300/`
- API health: `http://127.0.0.1:4310/health`
- OpenAPI explorer: `http://127.0.0.1:4310/docs`

The API binds to loopback by default. Do not change `NIMANTO_API_HOST` to a public interface without adding production authentication, secure cookies, TLS, and a reviewed deployment configuration.

## Private invitations

Public signup is disabled. A local administrator can issue a 72-hour, email-bound, single-use invitation with the private launch key:

```bash
nimanto_launch_key=$(tr -d '\n' < .nimanto-data/launch-secret)
curl --fail-with-body --silent --show-error \
  -H "content-type: application/json" \
  -H "x-nimanto-bootstrap-secret: $nimanto_launch_key" \
  -d '{"email":"candidate@example.com"}' \
  http://127.0.0.1:4310/v1/auth/invitations
```

Give only the intended candidate a URL shaped like `http://127.0.0.1:4300/workspace/#invite=RETURNED_TOKEN`. Nimanto removes the token from the address bar immediately. Acceptance creates an empty tenant-isolated workspace; the exact email must match. The admin API can revoke an unused invitation with `DELETE /v1/auth/invitations/{id}` and the same private-key header.

This beta uses invitation tokens and local cookie sessions. Passkeys, account recovery, TLS termination, and production hosted identity remain deployment gates.

## Docker self-hosting

The digest-pinned container runs the same static web workbench and API with public signup and demo login disabled:

```bash
docker compose up --build
```

Open `http://127.0.0.1:4300/`. Retrieve the generated admin key with `docker compose exec nimanto sh -c 'cat /data/launch-secret'`, then issue a private invitation as above. The named `nimanto-data` volume holds the database and artifacts. The image is built in CI; the v0.1.0 release has not been certified for internet exposure and should remain bound to loopback.

## Data locations

The default root is `.nimanto-data/`:

| Path                                         | Contents                                  |
| -------------------------------------------- | ----------------------------------------- |
| `.nimanto-data/database/`                    | PGlite PostgreSQL files                   |
| `.nimanto-data/artifacts/<tenant>/<packet>/` | JSON, TXT, DOCX, and PDF packet artifacts |
| `.nimanto-data/outbox/`                      | Explicitly executed local test messages   |
| `.nimanto-data/launch-secret`                | Mode-0600 private local launch key        |

Change the root with `NIMANTO_DATA_DIR=/absolute/path`. Do not place it inside a cloud-synced directory unless you accept that provider's retention and access model.

On POSIX systems Nimanto tightens runtime directories to `0700` and content files to `0600`, including an existing permissive database directory. Windows does not interpret POSIX mode bits as a complete ACL policy; keep the data root inside a private user profile and treat a reviewed Windows ACL installer as a future desktop-delivery gate.

## Back up and restore

Stop the API before copying `.nimanto-data/`. Restore by replacing the entire directory while the API is stopped. The beta does not claim online backups, point-in-time recovery, or schema downgrade support.

## Reset the synthetic workspace

Use **Data controls → Delete all data** and type the exact confirmation phrase. The deletion path removes database tenant rows, packet artifacts, local outbox files, and the session.

Deletion signs you out, so the receipt appears on the sign-in screen that follows. It states which outcome was reached and shows a seven-day status token with a copy control. Keep the token: it is the only way to check or resume this deletion, and it works without a session, so treat it like a password.

Two outcomes are possible, and the receipt distinguishes them:

| Receipt                                                            | Meaning                                                                                 | What to do                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------- |
| **Workspace deleted**                                              | Database records and local files are gone.                                              | Nothing.                     |
| **Database records removed — local file cleanup is still pending** | Tenant rows and your session are gone; packet or outbox files could not be removed yet. | Resume with the token below. |

```bash
curl --fail-with-body --silent --show-error \
  "http://127.0.0.1:4310/v1/deletion/status?token=YOUR_STATUS_TOKEN"
```

```bash
curl --fail-with-body --silent --show-error \
  -H "content-type: application/json" \
  -d '{"token":"YOUR_STATUS_TOKEN"}' \
  http://127.0.0.1:4310/v1/deletion/resume
```

Both routes are deliberately reachable without a session, because deletion has already removed yours.

Starting a new local session after deletion creates a fresh labeled synthetic workspace.

## Scheduled public-board refresh

Open **Role discovery → Schedule source** to add a Greenhouse, Lever, or Ashby public-board identifier and choose an hourly, six-hour, daily, or weekly cadence. The normal `pnpm dev` and macOS launcher start the worker with the API and website.

Each schedule can be run now, paused, resumed, or cancelled. A worker cycle claims at most three due schedules, imports at most 500 roles per source, deduplicates by provider job ID, and publishes deterministic explanations. Failures use bounded retry delays and become a visible dead letter after the fifth consecutive failure; **Resume** resets that retry budget.

The queue stores only provider and board identifiers. Scheduled work cannot prepare packets, approve, email, submit, or open any Slice 4 action. `pnpm dev:core` or `pnpm start` intentionally runs only the API and web processes for deterministic testing; `pnpm start:all` includes the worker.

## Verify

```bash
pnpm check
pnpm build
pnpm test:e2e
```

For a clean production-like static run:

```bash
pnpm build
pnpm start
```

## Troubleshooting

### The workbench says “Connect the local service”

Confirm `http://127.0.0.1:4310/health` returns `{"status":"ok"}`. If a different process owns port 4310, stop it or set matching `NIMANTO_API_PORT` and `NEXT_PUBLIC_NIMANTO_API_ORIGIN` values before rebuilding the web app.

### A packet is blocked

Run assurance and read its required findings. Common causes are no confirmed evidence, missing authorization wording, changed locked wording, or a prohibited outcome promise.

### Execute is disabled

The packet must be approved, the action must be separately approved, and the runtime switch must be on. The switch resets off whenever the API restarts.

### Gmail or Outlook is unavailable

Connected-account sending is not part of v0.2.0. Use the local test outbox or a user-opened deep link. See [provider boundaries](provider-setup.md).
