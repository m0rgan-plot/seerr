# Watchlists feature — implementation status

Plan: `~/.claude/plans/task-notification-task-id-a22be853913ab-curried-metcalfe.md`
Designs: Claude Design project `7c1ebdec-76d1-48e4-822c-168efe2a56ed`, `Watchlists.dc.html` (frames 1a-1l)
Branch: `worktree-cozy-finding-crane`

Legend: ☐ not started · 🟡 in progress · ✅ done · ⚠️ partial / needs follow-up · ⏳ blocked / pending verification

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Data skeleton: 5 ORM Records in `data/orm/`, `datasource.ts` glob extension, both migrations, repository integration tests | ✅ (postgres migration ⏳ unverified) |
| 2 | Domain layer: entities, value objects, errors, ports, `MediaListAccessPolicy`, `MediaListProgressCalculator`, 4 services + unit tests | ☐ |
| 3 | Data adapters: TypeORM repositories, mappers (+round-trip tests), `TmdbTvMetadataProvider`, `NotificationGatewayImpl`, composition point | ☐ |
| 4 | Backend presentation: wire types, Zod schemas, routes, mount, supertest tests | ☐ |
| 5 | Frontend domain + data: models, `dto.ts`, `mediaListsApi.ts`, mappers, SWR hooks | ☐ |
| 6 | List CRUD UI: both nav entries, `WatchlistsList`, `WatchlistCard`, create/edit/delete modals, empty state (1a/1b/1g/1k) | ☐ |
| 7 | Items + movies: `WatchlistDetail`, `AddMediaModal`, item card/row, filters, grid/rows toggle, `RequestButton`, drag-reorder (1c/1d/1j) | ☐ |
| 8 | Episode tracking: `WatchlistEpisodeTracker`, season rail, episode checklist, per-episode avatars (1e/1f) | ☐ |
| 9 | Collaboration: `ShareWatchlistModal`, `CollaboratorList`, role-gated UI, both notification types + `NotificationTypeSelector` (1h/1i) | ☐ |
| 10 | Cypress spec + `pnpm i18n:extract` | ☐ |

## Decisions log

- **2026-08-14** — Internal name is `MediaList`, not `Watchlist`: `server/entity/Watchlist.ts` already
  exists as a flat per-user Plex-synced marker at `/api/v1/watchlist`. UI copy still says "Watchlists".
- **2026-08-14** — No new global `Permission` bit. `User.permissions` is a 32-bit signed integer and the
  highest existing bit (`VIEW_BLOCKLIST`, 2^30) is one short of the ceiling; 2^31 does not fit. Access is
  per-resource via `MediaListCollaborator.role` instead.
- **2026-08-14** — Watched state is **per user**, not shared. Reversed an earlier "shared state" answer
  after design review: frame 1f says "Seen state is yours alone. Avatars show which collaborators have
  watched an episode", and headers read "You've seen 4 of 12". Per-user state is the only model where the
  seenBy badge is meaningful.
- **2026-08-14** — Season and show completion are **derived**, never stored, from episode rows vs live
  TMDB counts. Self-corrects when TMDB adds an episode to an already-complete season.
- **2026-08-14** — ORM models live in the feature's `data/orm/` layer, not the shared `server/entity/`
  folder, suffixed `Record` with explicit `@Entity('table_name')`. Requires one additive glob per config
  in `server/datasource.ts`. Raised by the user during plan review.
- **2026-08-14** — **No reciprocal `@OneToMany`** on `User`/`Media`. Adding them would make shared core
  entities import from this feature's data layer, inverting the dependency. TypeORM does not require
  bidirectional relations.
- **2026-08-14** — List visibility (frame 1g "Who can find it": Private / Visible to all Plex users)
  deferred to v2. Lists are private and invite-only; that section should be dropped from the design.
- **2026-08-14** — Manual item reordering kept in v1 (`position` column + reorder endpoint) even though no
  frame shows a drag affordance. Needs a design pass before milestone 7.
- **2026-08-14** — No admin oversight in v1: access is strictly owner-or-collaborator, no `Permission.ADMIN`
  bypass branch in the access policy.

- **2026-08-14** — Entity glob is `*Record.ts`, not `*.ts`. The first attempt (`data/orm/*.ts`) also
  matched `orm.test.ts`, so TypeORM loaded the test file as an entity: it pulled in `node:test`, leaked
  TAP output into every CLI command, and silently ran `synchronize()` during migration runs, which
  invalidated a verification pass. The `*Record` suffix doubles as the exclusion, and the production
  build confirms only the 5 Records match `dist/features/**/data/orm/*Record.js`.
- **2026-08-14** — The sqlite migration is hand-trimmed from the generated output. TypeORM emitted an
  unrelated `user_push_subscription` rebuild (pre-existing drift between that entity and its migration
  history, not caused by this feature) and created each new table twice, once bare and once with foreign
  keys, because sqlite cannot add constraints in place. Tables that do not exist yet can carry their
  foreign keys inline, so the kept version is one pass per table.
- **2026-08-14** — The postgres migration is hand-written: no postgres was reachable in this environment
  (docker daemon down, no local server). Constraint, index and primary-key names were extracted from
  TypeORM's own metadata for the postgres dialect rather than guessed, and they match the sqlite ones
  since TypeORM derives them from table and column names, not the driver.

## Milestone 1 verification (2026-08-14)

- `pnpm test` — 162 passed, 0 failed, including 9 new persistence tests. No regressions.
- `pnpm typecheck:server`, `pnpm exec eslint`, prettier — all clean.
- sqlite: all 54 migrations applied to a fresh DB; `migration:generate --dr` afterwards reports **zero**
  pending changes for any `media_list*` table (only the pre-existing `user_push_subscription` drift
  remains), proving the migration produces exactly the schema the entities describe. `migration:revert`
  removes all 5 tables and 12 indexes cleanly.
- `pnpm build:server` emits all 5 Records to `dist/features/mediaLists/data/orm/`, and exactly 5 files
  match the production glob.

## Open follow-ups

- **The postgres migration has never been executed.** Run `DB_TYPE=postgres pnpm migration:run` against a
  disposable Postgres, then `migration:generate --dr` to confirm it reports no `media_list` drift, before
  this reaches a Postgres deployment.
- Design pass needed for the drag-reorder affordance (blocks part of milestone 7).
- Frame 1g's "Who can find it" section should be removed from the design (deferred to v2).
- Confirm the existing `RequestButton` covers both the labelled (row) and icon-only (grid) variants
  before adding a new one.
- Frontend mapper unit tests have no runner today; plan keeps the frontend logic-free and relies on
  Cypress. Adding Vitest is an open option if mapper-level tests are wanted.
