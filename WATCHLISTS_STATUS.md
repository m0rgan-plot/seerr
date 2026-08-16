# Watchlists feature — implementation status

Plan: `~/.claude/plans/task-notification-task-id-a22be853913ab-curried-metcalfe.md`
Designs: Claude Design project `7c1ebdec-76d1-48e4-822c-168efe2a56ed`, `Watchlists.dc.html` (frames 1a-1l)
Branch: `worktree-cozy-finding-crane`

Legend: ☐ not started · 🟡 in progress · ✅ done · ⚠️ partial / needs follow-up · ⏳ blocked / pending verification

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Data skeleton: 5 ORM Records in `data/orm/`, `datasource.ts` glob extension, both migrations, repository integration tests | ✅ |
| 2 | Domain layer: entities, value objects, errors, ports, `MediaListAccessPolicy`, `MediaListProgressCalculator`, 4 services + unit tests | ✅ |
| 3 | Data adapters: TypeORM repositories, mappers (+round-trip tests), `TmdbTvMetadataProvider`, `NotificationGatewayImpl`, composition point | ✅ |
| 4 | Backend presentation: wire types, Zod schemas, routes, mount, supertest tests | ✅ |
| 5 | Frontend domain + data: models, `dto.ts`, `mediaListsApi.ts`, mappers, SWR hooks | ✅ |
| 6 | List CRUD UI: both nav entries, shelves index, create/edit/delete modals, empty state (1b/1g/1k) | ✅ |
| 7 | Items + movies: `WatchlistDetail` poster grid, `AddMediaModal`, item card, filters, `RequestButton` (1c/1j). Drag-reorder still deferred | ✅ |
| 8 | Episode tracking: inline accordion, season rows, episode checklist (1e) | ✅ |
| 9 | Collaboration: `ShareWatchlistModal`, `CollaboratorList`, role-gated UI, both notification types registered (1h) | ✅ |
| 10 | Cypress spec + `pnpm i18n:extract` | ✅ |

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

- **2026-08-15** — Specials (season 0) are trackable but never block a show from reading as
  finished, and neither do announced seasons with no episodes yet. This mirrors how the
  existing request modal filters those seasons. Not previously specified, so worth a look.
- **2026-08-15** — Reorder accepts only a full permutation of the list and rejects anything
  else, so a stale client cannot silently drop items out of the ordering.
- **2026-08-15** — The owner cannot also hold a collaborator row, and cannot leave their own
  list. Handing a list over to someone else is not supported in v1.

- **2026-08-15** — `buildMediaListServices` accepts overrides for the two ports that reach
  outside the database (TMDB, notifications). `TheMovieDb` declares its methods as instance
  arrow properties, so they cannot be mocked on the prototype; injecting at the composition
  root is cleaner than monkey-patching an instance anyway.
- **2026-08-15** — An unrecognised value in the collaborator `role` column maps to read, not
  write. The column is a plain varchar, so a row written by hand or by an older build must
  fail closed rather than grant editing rights.
- **2026-08-15** — `toMediaListItem` takes the list id as an argument instead of reading it
  off the record. The alternative was declaring the foreign key column on the Record, which
  would have altered the verified schema for the sake of a convenience field.

- **2026-08-15** — New endpoints must be declared in `seerr-api.yml` or the request validator rejects
  them with a 404, whatever the handler does. Enforced now by `apiSpec.test.ts`.
- **2026-08-15** — `nullable: true` beside an `allOf` `$ref` is rejected by the validator. Nullable
  object references are plain `$ref` with the nullability described in prose, matching the rest of the
  spec, which pairs `nullable` only with a `type`.
- **2026-08-15** — The list index returns `previewItems` as bare tmdb ids rather than posters. Resolving
  artwork is the client's job everywhere else in this app, and doing it server-side would mean a TMDB
  fan-out per list.
- **2026-08-15** — Season counts are only fetched for shows the viewer has actually started, since a
  show with no watched episodes cannot be complete. A list of untouched series costs no TMDB calls.

- **2026-08-15** — Mutation hooks revalidate and rethrow rather than raising toasts. Copy belongs to
  the component that triggered the action, which keeps the data layer free of i18n.
- **2026-08-15** — Dates are parsed once in the frontend mappers, so no component handles an ISO
  string. This is most of what the frontend mapper layer earns.
- **2026-08-15** — Role helpers (`canEditItems`, `canManageCollaborators`, `canDeleteList`) live on the
  domain model and mirror the server access policy. They gate the UI only; every mutation is checked
  again server-side.

- **2026-08-15** — Reversed the earlier call that artwork is the client's job. Choosing the
  shelves index put poster strips on the list page, and resolving them in the browser would
  be one request per poster. `previewItems` now carries `posterPath`, resolved server-side
  through the same cached TMDB provider: identical TMDB cost, one response, shared cache.
  Preview is capped at seven, and a title with no art leaves a gap rather than failing.
- **2026-08-15** — Design directions chosen: 1b sectioned shelves for the index, 1c poster
  grid for the detail, 1e inline accordion for episodes, 1h per-row role dropdown for share.

- **2026-08-15** — `MediaArtworkProvider` became `MediaSummaryProvider`, returning title, poster
  and year together. The detail grid needs all three, and one TMDB call per title serves both
  the index strip and the grid.

- **2026-08-15** — Episode titles are fetched by the client from the existing tv season
  endpoint, and only once a season is expanded. The server returns which episodes are ticked;
  it has no reason to also carry their names.
- **2026-08-15** — Known nit: toggling an episode scrolls the detail page back to the top,
  because the item list re-renders on revalidation. Worth a look when the reorder design lands.

## Milestone 1 verification (2026-08-14)

- `pnpm test` — 162 passed, 0 failed, including 9 new persistence tests. No regressions.
- `pnpm typecheck:server`, `pnpm exec eslint`, prettier — all clean.
- sqlite: all 54 migrations applied to a fresh DB; `migration:generate --dr` afterwards reports **zero**
  pending changes for any `media_list*` table (only the pre-existing `user_push_subscription` drift
  remains), proving the migration produces exactly the schema the entities describe. `migration:revert`
  removes all 5 tables and 12 indexes cleanly.
- `pnpm build:server` emits all 5 Records to `dist/features/mediaLists/data/orm/`, and exactly 5 files
  match the production glob.

## Milestone 10 verification (2026-08-15)

- `cypress/e2e/watchlists.cy.ts`: **12 passing, 0 failing** against the built app.
- Covers both navigation entries, the empty state, create, rename, delete, artwork resolved
  from TMDB, marking a movie seen and filtering by it, season and episode tracking with the
  derived state, the reused request modal, sharing, and both collaborator roles.
- Three failures along the way, all in the spec rather than the product. The sidebar is
  `hidden lg:flex` and Cypress defaults narrower than that breakpoint, so the desktop entry
  needed a wider viewport; the async user picker needed typing before its options exist; and
  the collaborator assertion expected two rows when the owner is deliberately not a
  collaborator. The failure screenshot showed `POST 201` and both names rendered, which is
  what made the last one obvious.
- `pnpm i18n:extract` run: 112 keys, no stray literals in the watchlist components.
- 368 unit tests still green, typecheck and lint clean.

## Milestone 9 verification (2026-08-15)

- `pnpm test` 368 passed, typecheck and lint clean.
- The share modal matches frame 1h: user picker, role dropdown, invite, people with access
  with the owner listed separately, per-row role dropdowns and removal.
- Verified over HTTP with two real users: sharing records the inviter, a read collaborator
  views (200) but cannot add (403) while still recording their own watched state (204),
  promoting to write lets them add (201) but never delete (403), and the owner's Silo count
  stayed at 11/30 while the collaborator ticked their own episode.
- **Both notification types are now registered** in `NotificationTypeSelector`, which is what
  makes agents actually deliver them. The frontend keeps its own copy of the `Notification`
  enum, so `architecture.test.ts` now asserts the two enums match: a value on one side only
  is exactly how these would have shipped silently undeliverable.
- Deviation from the frame: collaborator rows show display names but not email addresses.
  `UserRef` deliberately excludes email, and putting it back would undo the guarantee that no
  sensitive field can travel out with a list.

## Milestone 8 verification (2026-08-15)

- `pnpm test` 367 passed, typecheck and lint clean.
- Verified in the browser with real data: the accordion opens inline under the poster grid,
  season rows show per-season progress and a bulk toggle, and expanding a season lists real
  episode titles and air dates. Ticking S2E1 moved the card ring to 11/30, the caption to
  "11 / 30 episodes" and the header to "You've seen 11 of 30" in one go.
- Also checked over HTTP: ticking two episodes gives 2/30 with the right refs, and marking
  season 1 gives 10/10 complete while the show correctly stays 10/30 incomplete.
- The progress endpoint now returns the watched episode refs alongside the derived rollup.
  The field is called `episodes`, not `watchedEpisodes`, because `ShowProgress` already uses
  that name for the count and a failing test showed how easily the two get confused.

## Milestone 7 verification (2026-08-15)

- `pnpm test` 367 passed, typecheck and lint clean, both routes registered by `next build`.
- Checked in a browser against the built app with real TMDB data: the grid renders posters,
  years, media badges, the seen toggle, the reused Request button and the seen-by avatars.
- Two problems the browser caught that tests did not. A series nobody had started showed a
  `0/0` progress ring, because the index optimisation that skips episode counts for unstarted
  series also applied to the detail page. Reading now splits by screen: the index resolves
  titles only for the seven preview items and skips unstarted series, while the detail page
  resolves every title and every episode total. Both are pinned by tests that count the
  lookups. The remove control was also a full sentence under each poster; it is a quiet
  "Remove" with the sentence kept as the accessible label.
- **Drag-reorder is still not built.** The reorder endpoint and its tests exist from
  milestone 4, but no frame shows a drag affordance, so the interaction still needs a design
  pass. Episode tracking is milestone 8, so the Episodes button currently explains that.

## Milestone 6 verification (2026-08-15)

- `pnpm test` 364 passed. Typecheck (both projects), lint and formatting clean. `next build`
  registers `/watchlists`.
- **Confirmed in a browser against the built app**, which is the only way several of these
  would have surfaced. The shelves render per frame 1b, the edit modal per 1g with the
  owner-only Delete, and editing a list updates its shelf live through the mutation hook.
- Two things only running it caught: `pnpm start` serves `dist/`, so the API 404s until
  `pnpm build:server` runs, and a seeded database made with `synchronize` cannot boot in
  production mode. Re-seed with `WITH_MIGRATIONS=true pnpm cypress:prepare`, which also
  exercises the sqlite migration in the real boot path.
- A new `MediaListViewService` unit test caught a flaw in the test double rather than the
  code: the fake repository's `findAccessibleTo` returned only owned lists, so it silently
  under-reported shared ones. The real implementation was always correct.

## Milestone 5 verification (2026-08-15)

- `pnpm test` 353 passed, `pnpm typecheck` (both projects) and lint clean. No UI yet, so nothing
  renders from this milestone.
- The frontend rule from the plan is now enforced from `architecture.test.ts`, which reads `src/`
  from the server suite because the frontend still has no runner of its own. Verified by dropping a
  component that imports axios and confirming a red test.
- The first version of that guard was too strict and failed on my own hooks. Hooks legitimately name
  the wire types to type their SWR call; the plan's rule is that they never *return* a DTO. The rule
  now checks that domain models stay transport-independent, and that components and pages touch
  neither `dto.ts` nor axios.

## Milestone 4 verification (2026-08-15)

- `pnpm test` — 351 passed, 0 failed. Typecheck, lint and formatting clean.
- **The endpoints were unreachable in the real app despite every test passing.** The server runs
  requests through `express-openapi-validator` with `validateRequests: true`, so a path absent from
  `seerr-api.yml` is rejected with a 404. Route tests mount the router directly and never see that.
  All 11 paths and 8 schemas are now declared, and `apiSpec.test.ts` walks the Express router stacks
  and fails if a registered route is undeclared, a declared route no longer exists, or a `$ref` does
  not resolve. The guard was checked by deleting a path from the spec and confirming a red test.
- **Fixed an information leak found by a failing test.** Sharing resolved the recipient before
  checking permission, so a non-owner could tell a real user id from an invented one by comparing
  404 with 403. The lookup moved behind the permission check and into the domain through a new
  `UserDirectory` port, which also stopped the route reaching into the user repository directly.
- Verified against a real Postgres in Docker: all 20 migrations apply, `migration:generate --dr`
  reports **"No changes in database schema were found"**, and the down path drops all five tables.
- Adapters exercised directly against Postgres too. The batch watch queries use raw column aliases,
  which is where sqlite and postgres most easily diverge; ids came back as numbers on both.
- Walked the whole API over HTTP against Postgres in the running app: create, add, duplicate 409,
  bad media type 400, mark seen, index counts, share, read-only collaborator refused an item but
  allowed their own watched state, delete refused, self-leave. Per-user semantics confirmed end to
  end: the owner reads `watched=false` while seeing the other member in `seenBy`.

## Milestone 3 verification (2026-08-15)

- `pnpm test` — 315 passed, 0 failed (50 new: 26 repository, 11 mapper, 6 notification,
  4 TMDB provider, 3 composition).
- Mappers 100% across the board. Repositories 99-100% line, 84-94% branch. The notification
  gateway went from 52% to 71% branch once it got a direct test.
- The composition test drives the real services over the real adapters and the real schema:
  share, add, revoke, delete, plus season derivation with the TMDB port substituted.
- `MEDIA_LIST_SHARED = 8192` and `MEDIA_LIST_ITEM_ADDED = 16384` added to the Notification
  enum. **Still to do in milestone 9**: register both in `NotificationTypeSelector`, or
  agents will never deliver them.

## Milestone 2 verification (2026-08-15)

- `pnpm test` — 265 passed, 0 failed (103 new: 95 domain, 7 architecture, 1 list query).
- Domain coverage 97-100% line and 89-96% branch. The few uncovered lines are multi-line
  function signatures, not logic.
- The domain layer imports no TypeORM, no entity, no Record and no Express. That rule is
  enforced by `architecture.test.ts` rather than left to review, and the guard was checked
  by temporarily adding a forbidden import and confirming the suite failed.
- Two product micro-decisions surfaced while building and are recorded below (specials,
  reorder validation).
- `assertCanView` was written and then deleted: nothing called it and it duplicated the
  check `listFor` already performs. Caught by the coverage pass.

## Post-implementation audit and follow-ups (2026-08-16)

The feature was audited after the fact against the original request, the plan, the
codebase conventions and CONTRIBUTING.md. Findings and the remediation plan live in
`~/.claude/plans/task-notification-task-id-a22be853913ab-curried-metcalfe.md`. Two
follow-up branches came out of it, both draft PRs off milestone 10:

- **PR #12, `fix/watchlists-12-server-bugs`** — six server defects. A TMDB failure in the
  season-count provider permanently 500'd any list holding an unresolvable title; the list
  owner never appeared in `seenBy`; duplicate add and share races returned 500 with the
  driver message instead of 409; a throwing notification agent turned a committed write
  into a 500; neither the email nor the web push agent could render the two watchlist
  notification types, so they were silently undeliverable; and `media_list_item` cascaded
  from `media`, so blocklisting a title deleted the list entry and every member's watch
  history. The last one carries a migration on both drivers, verified up and down against
  sqlite and a throwaway postgres 16.
- **PR #13, `feat/watchlists-11-review-fixes`** — the review remarks plus the frontend
  defects. Cards rebuilt on the app's own poster pattern (`cards-vertical`, hover overlay,
  `Common/Button` throughout), media-page links, add and share from the index, padded
  episode labels, release dates in search. The load-bearing fix underneath: every write
  blanked the SWR cache, because `refreshList` passed a third argument to `mutate` and so
  left the revalidate-only path, which is why the episode accordion collapsed on each tick.

Decisions taken during that work:

- **Watchlist cards do not use `RequestButton`.** It needs a full `Media` entity with its
  requests to decide what to offer, and a list carries a status and nothing more. Given
  less it unconditionally offers "Request", including for available titles. The cards use
  `RequestModal` directly, the way `TitleCard` does, through a shared
  `WatchlistRequestButton`. This closes the open question below about the two variants.
- **`media_list_item.media` is relaxed to `SET NULL` rather than dropped**, even though
  nothing read it before: availability on a list entry is the obvious next use, and
  re-adding the column later would cost another migration. It now feeds the status badge.
- **`nullable` beside a `$ref` in `seerr-api.yml` breaks the whole API at boot.** The
  correct-looking OpenAPI 3.0 idiom is rejected by `express-openapi-validator`, and the
  spec-parity test does not catch it because it never boots the server. Nullability on
  `$ref` fields is documented in the description instead.

Still open:

- Items and index endpoints are not paginated. The plan specified `?take&skip` mirroring
  `request.ts`; it was never built and never flagged. It cannot be retrofitted client-first
  either, since undeclared query parameters are a hard 400. Decide before the API is
  treated as stable.
- The N+1 on the index (per-list watch queries, up to 7 TMDB poster lookups per list with
  no cross-list dedupe) is understood and unaddressed.
- Upstreaming would require personally owning the code and rewriting the PR descriptions on
  the upstream template with the AI disclosure. Upstream bans AI-driven contributions
  outright, so this is a real constraint rather than a formality.
- Design pass needed for the drag-reorder affordance (blocks part of milestone 7).
- Frame 1g's "Who can find it" section should be removed from the design (deferred to v2).
- Frontend mapper unit tests have no runner today; plan keeps the frontend logic-free and relies on
  Cypress. Adding Vitest is an open option if mapper-level tests are wanted.
