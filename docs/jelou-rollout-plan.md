# Skillbox for Jelou — rollout plan

Goal: an internal skills library on Fly.io (org `jelou-ops`), behind Google login restricted to `@jelou.ai`,
where anyone at Jelou connects their agent with **one command**, and publishing or updating a skill reaches
everyone immediately.

## Shape

```
Jelou member ──Google @jelou.ai──▶ Web panel ──▶ "Connect my agent" ──▶ one-time code
                                                                            │
Terminal:  curl -fsSL https://skills.jelou.dev/install | sh -s -- <code>  ◀─┘
                   │
                   ├─ Claude Code (CLI + Claude Desktop's Code tab)
                   ├─ Codex (CLI + desktop app + IDE extension)
                   └─ Cursor
                        │
                        ▼
                /mcp with a personal key ──▶ live skills (no local copies)
```

| Role | Who | Can |
|---|---|---|
| **Admin** | Alexander (listed in `SKILLBOX_ADMIN_EMAILS`) | Everything: create, edit, archive skills, approve proposals, revoke keys |
| **Author** | Whoever the admin marks | Propose new skills or changes; the admin approves |
| **Member** | Any `@jelou.ai` | Read skills, create and revoke **their own** keys |

`SKILLBOX_ADMIN_TOKEN` stays as break-glass access if Google login fails.

---

## Phase 0 — Cleanup (done 2026-09-18)

- [x] Deleted `jelou-internal-hub` (org `jelou`): app, machine, volume and secrets.
- [x] Google OAuth client saved in `.env.local` (gitignored). Its redirect URI still points at
      `jelou-internal-hub.fly.dev`; it changes in Phase 2.

## Phase 1 — Deploy on Fly (done 2026-09-18)

Everything lives in **one Fly app**, `jelou-ops-skills`: no separate database, no external providers.

- [x] **Database: PGlite** (Postgres compiled to WASM, in the Bun process) on a Fly volume.
  - `src/server/db.ts` uses `postgres.js` when `DATABASE_URL` is set (local dev, Compose) and PGlite in
    `SKILLBOX_DATA_DIR` otherwise. Without either, PGlite runs in memory, which is how `bun test` runs.
  - PGlite has a single backend: a global `db` query issued inside an open transaction would wait for
    it forever, so queries from the same async context join the transaction (`AsyncLocalStorage`).
  - `fsync` is on (PGlite disables it by default) and memory settings are small (`shared_buffers` 16MB).
  - The server closes the database on `SIGINT`/`SIGTERM`; Fly stops idle machines with `SIGINT`.
  - `initdb` peaks above 1GB, so the image carries an initialized template (Dockerfile target `fly`),
    and `deploy/fly/start.sh` copies it to an empty volume. At runtime the app uses ~250MB of 512MB.
- [x] `fly.toml`: region `iad`, `shared-cpu-1x` / 512MB, one volume (1GB, 14 days of snapshots),
      `auto_stop_machines = "stop"`, `min_machines_running = 0`. **Always one machine**: PGlite cannot
      be shared. Idle cost is the volume (~$0.15/GB-month); a cold start takes ~6s.
- [x] Secret `SKILLBOX_ADMIN_TOKEN` (stored locally in `.env.fly`, gitignored).
- [x] Verified: `/healthz` over HTTPS, 401 without a key, a key on the `jelou-read` profile lists and
      searches skills over `/mcp`, and a revoked key gets 401. Auto-stop and wake verified.
- [ ] Domain: `fly certs add skills.jelou.dev` + DNS record (same pattern as `tooling.jelou.dev`), then
      set `SKILLBOX_ORIGIN`. Today it is `https://jelou-ops-skills.fly.dev`.
- [ ] GitHub Actions deploy on push to `main` (`.github/workflows/fly-deploy.yml`) needs the repo secret
      `FLY_API_TOKEN` (a deploy token scoped to this app).

## Phase 2 — Google login for `@jelou.ai`

Same pattern as `internal-tooling` (restricted domain).

Status (2026-09-18): implemented (`src/server/google-auth.ts`, People page, tests in
`tests/google-auth.test.ts`). Configuration: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`SKILLBOX_GOOGLE_DOMAIN=jelou.ai`, `SKILLBOX_ADMIN_EMAILS`. The redirect URI
`<SKILLBOX_ORIGIN>/api/auth/google/callback` must be registered in Google Cloud Console.

1. `users` table (`email`, `name`, `role: admin|author|member`, `created_at`). First login creates the user
   as `member`; emails in `SKILLBOX_ADMIN_EMAILS` become `admin`.
2. `sessions` gets a `user_email` column; `authenticate()` returns the principal for the user's role
   instead of always `ADMIN`.
3. Routes `GET /api/auth/google` and `/api/auth/google/callback` (OAuth + PKCE, `hd=jelou.ai`).
   **The server checks** `email_verified` and the `jelou.ai` domain: `hd` is only a hint to Google.
4. Login screen: "Sign in with Google"; admin-token login moves to a secondary link.
5. Google Cloud Console: add the redirect `https://skills.jelou.dev/api/auth/google/callback` and remove
   the `jelou-internal-hub` one. Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
6. Panel: a member sees the catalog (read-only) and "Connect my agent". Admins see everything.

**Done when:** a `@jelou.ai` account signs in and sees the catalog, a `@gmail.com` account is rejected,
and the admin sees the full administration.

## Phase 3 — Personal keys ("Connect my agent")

1. `clients` gets `owner_email`. Default profile `jelou-read` (all skills, read-only); authors get one
   that can propose.
2. "Connect my agent" page: the user names the device ("MacBook"), the page creates a key tied to their
   email, lists their keys (name, last use) and lets them revoke. Limit: 5 active per person.
3. Besides the key, the page issues a **one-time install code** (expires in 10 minutes) that goes in the
   command, so the key never lands in shell history or a URL.
4. Admin: sees every key with its owner and can revoke any.

## Phase 4 — One-command installer

```sh
curl -fsSL https://skills.jelou.dev/install | sh -s -- <code>
```

1. `GET /install` serves a short `sh`: checks for `node` or `bun`, downloads `skillbox.mjs` and
   `package.mjs` to `~/.local/share/skillbox/` and runs `skillbox setup <code>`.
2. `skillbox setup` (new, in Node; **not** Python: macOS system Python has no `tomllib`) does what
   `scripts/install-client.py` does today:
   - Exchanges the code for the key → `~/.config/skillbox/config.json` (mode 0600).
   - Installs the `skills-library` skill in `~/.agents/skills/` and links it into `~/.claude/skills/` and
     `~/.cursor/skills/`.
   - Registers the MCP server in every client it finds, through the **stdio bridge** with
     `SKILLBOX_CONFIG` (desktop apps do not inherit shell variables, so an env var does not work):
     - Claude Code → `~/.claude.json` (also read by Claude Desktop's Code tab).
     - Codex → `~/.codex/config.toml` (shared by CLI, desktop app and IDE).
     - Cursor → `~/.cursor/mcp.json`.
   - Backs up every file it touches and tests the connection (`tools/list` + `search_skills`).
   - Installs the `skillbox` command in `~/.local/bin`.
3. New CLI commands:
   - `skillbox update`: downloads the CLI and the `skills-library` skill again from the server.
   - `skillbox doctor`: checks the key, the connection and which clients are configured.
   - `skillbox uninstall`: removes client configuration and restores backups.

**Done when:** on a clean Mac, a `@jelou.ai` user goes from login to their first skill loaded in Claude
Code and Codex in under 2 minutes.

## Phase 5 — Publishing and updating skills

Already exists (unchanged):

- **CLI:** `skillbox publish ./folder id <current-revision|new>`. The expected revision prevents
  overwriting someone else's change.
- **MCP:** `upsert_skill` (write permission) and `propose_skill_update` (authors).
- **Panel:** editor, history, restore, proposal review.

To add:

1. **`skillbox-publisher` skill**, stored in the library itself and visible only to admins and authors.
   It teaches the agent to:
   - validate the folder (`SKILL.md` with `name` and `description`, no secrets, no absolute paths);
   - `skillbox load <id>` to get the current revision, or `new` if the skill does not exist;
   - publish (admin) or propose (author) with a clear message about what changed.

   Optional (the MCP tools can already write), but it makes everyone publish the same way.
2. **Initial load:** `bun scripts/import.ts` with the chosen skills (see Open decisions).

Consumers have **nothing to update**: the agent reads the library live. Only skills downloaded with
`skillbox fetch` (the ones with scripts) are refreshed with `skillbox fetch <id>`.

## Phase 6 (later) — Claude Desktop (chat) and claude.ai

These cannot use the MCP server with a fixed key. For now:

- `skillbox export --zip <id>` builds one ZIP per skill.
- An owner of the Claude organization uploads it in **Organization settings → Skills**, and it shows up
  for the whole org.
- It is a snapshot: every change must be uploaded again. Only for skills worth it.

Later: OAuth in skillbox (on the same Google login) to add it as a custom connector.

## Operations

- **Backups:** daily Fly volume snapshots (14 days), plus a weekly skills `export` to a private repo.
  `pg_dump` does not apply to PGlite.
- **Rotation:** changing `SKILLBOX_ADMIN_TOKEN` makes stored credentials unreadable (see
  `docs/deployment.md`); rotate it only on purpose.
- **Offboarding:** revoke the person's keys in the panel; their Google account stops working when they
  leave Jelou.

## Open decisions

1. **Domain:** `skills.jelou.dev`?
2. **Initial load:** which skills go first? (the `jelou-*` ones?)
3. **Authors:** who starts with permission to propose?
4. **Claude owner:** who uploads the ZIPs to claude.ai if we do Phase 6?
