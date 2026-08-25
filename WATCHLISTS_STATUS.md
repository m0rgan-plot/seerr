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
| 11 | Pin an item: `pinnedAt` column + migrations, domain/data/presentation backend, frontend domain + data layer. Presentation UI deferred to a `/design` pass | ✅ |
| 12 | Pin presentation UI: `WatchlistPinToggle`, merged pin/watched badge+button into one toggle picto on both the grid card and the poster strip, Remove relocated to the bottom action bar, Cypress coverage | ✅ |
| 13 | Pin/polish feedback round: live reorder-on-pin fix, hover states, bigger toggles, added-date moved detail-only, title/year on the shelf strip, compact Request button, pin always visible with a new pin glyph, status dot removed from the shelf, `seenBy` line removed, Dropdown ghost-item purple fixed | ✅ |
| 14 | Paginate the detail page's item list: `findPageInList` (SQL pagination when `filter=all`, in-memory page-after-filter/sort otherwise), `sortBy=title` moved server-side, `useSWRInfinite` + scroll-triggered fetch on `WatchlistDetail`, `seenCount` returned separately from the page since it must span the whole list, `seerr-api.yml` + supertest + unit test coverage. Plan: `~/.claude/plans/melodic-percolating-marshmallow.md` | ✅ |

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

- **2026-08-25** — Title sort cannot move into SQL: `Media` has no `title` column (it is always
  resolved live from TMDB). `findPageInList` only pages the pinned-first / position-ascending
  order; a `sortBy=title` or non-`all` filter request falls back to resolving the whole list once
  and paging the in-memory result, since watched-state filtering already depended on data
  (episode/season progress) no SQL WHERE clause can express either.
- **2026-08-25** — Reverted an initial choice to make the default page order newest-added-first.
  `/reorder` and `position` are a real, tested v1 feature (see the 2026-08-14 decision above), and
  `GET /items` with no `sortBy` is its only observable order today (no drag affordance exists in
  the UI yet). Flipping the default direction would have silently broken that contract to match a
  client-side preference (`WatchlistDetail`'s now-removed local `sortItems`) that was never
  reconciled with reorder in the first place. Default order stays pinned-first, then position
  ascending, exactly matching `findByList`.
- **2026-08-25** — `seenCount` is returned separately from the item page, computed over the whole
  list (via a `withSummaries: false` pass, no TMDB calls) rather than derived from the loaded
  items client-side. Once the item list pages, `items.length` on the client no longer means "every
  item," so the "seen N of M" line would otherwise undercount M as soon as a second page exists.

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

## Open follow-ups

- **From review (2026-08-15), for a follow-up PR:** clicking a title on the watchlist detail
  page should open that media's page; the "Mark seen" and "Episodes" buttons do not match the
  height of the reused "Request" button.

- Design pass needed for the drag-reorder affordance (blocks part of milestone 7).
- Frame 1g's "Who can find it" section should be removed from the design (deferred to v2).
- Confirm the existing `RequestButton` covers both the labelled (row) and icon-only (grid) variants
  before adding a new one.
- Frontend mapper unit tests have no runner today; plan keeps the frontend logic-free and relies on
  Cypress. Adding Vitest is an open option if mapper-level tests are wanted.

## PR #24 follow-ups (2026-08-23/24)

- **Index sort wasn't actually broken** — the "shared lists stay first" report turned out to be a
  second, real bug: adding or removing an item never bumped the owning `MediaList.updatedAt`
  (only name/description edits did, via TypeORM's `@UpdateDateColumn` on `save()`). The default
  "Last Modified" sort therefore never reflected list activity. Fixed with a `touch(id)` method on
  `MediaListRepository`, called from `MediaListItemService.add()`/`remove()`.
- **`AddMediaModal` now cross-references the list's current items** (`useMediaListItems`) so a
  search result already on the list reads "Added" and is disabled as soon as it renders, not only
  after being clicked once.
- **`AddToWatchlistButton` recovered and wired in.** This component (a dropdown on the movie/tv
  detail page to add the title to any editable list) existed as uncommitted work in a sibling
  worktree (`peaceful-herding-hopper`, branch `feat/watchlists-add-to-watchlist-button`) — built but
  never committed to any PR branch. Copied over, wired into `MovieDetails`/`TvDetails`, i18n
  extracted.
- **Closed the gap above with a new endpoint**, `GET /mediaLists/membership?tmdbId=&mediaType=`,
  since no batched way to ask "which of my lists already hold this title" existed. Backend:
  `MediaListItemRepository.findListIdsContaining(listIds, tmdbId, mediaType)` (a single `DISTINCT
  listId` query scoped to a candidate set — the caller's own accessible lists from
  `MediaListService.listsFor`, never every list in the database), exposed as
  `MediaListItemService.listIdsContaining(userId, tmdbId, mediaType)`. Frontend:
  `useMediaListMembership(tmdbId, mediaType)` returns a `Set<number>` of list ids, which
  `AddToWatchlistButton` now merges with its own session-added set — a list reads "Added" the
  moment the dropdown opens, matching what `AddMediaModal` already does, including across a full
  page reload (covered by a new Cypress case).

## Add to Watchlist button: redesign + click-to-remove (2026-08-24)

Explored the button's look with `/design` (three directions, static mockups, reproduced against the
real action row's tokens) and the user picked the icon-only compact direction — same size/border as
the Blocklist and Plex-Watchlist icon buttons it sits between, a `Tooltip` for discoverability, the
existing `Dropdown` component's built-in chevron rather than a separate corner badge.

Mid-review the user also asked for a real behavior change: clicking a list that already has the
title should remove it, not sit there disabled. That needed the item id, not just a yes/no, so the
membership endpoint's shape changed:

- `MediaListMembership` is now `{ items: { listId, itemId }[] }`, not `{ listIds: number[] }`.
- `MediaListItemRepository.findListIdsContaining` → `findItemsContaining`, selecting `item.id` and
  `item.listId` directly (no `DISTINCT` needed — `(list, tmdbId, mediaType)` is already unique).
- `MediaListItemService.listIdsContaining` → `itemsContaining`, same signature otherwise.
- `useMediaListMembership` now returns a `Map<number, number>` (listId → itemId) instead of a
  `Set<number>`.
- `AddToWatchlistButton` layers two session-only overrides on top of that map — an add records the
  id the server just handed back (so it can be removed again without waiting on a refetch), a
  remove records a plain override (nothing left to look up). A 409 duplicate still means the
  membership snapshot was stale, so it now triggers a revalidate instead of guessing an item id.
- Also fixed while in there: adding a title never toasted success (only failure/duplicate did) —
  spotted because removing suddenly did and the asymmetry was obvious. Both now toast.

Verification: full server suite (402 tests) green, `tsc`/`eslint` clean both projects, `pnpm
i18n:extract` picked up the new `added` toast key. Cypress `watchlists.cy.ts` updated: the two
existing media-page cases switched their assertion from `aria-disabled` (which now only reflects an
in-flight request, not "already added") to a `data-added` attribute on the item row, plus a new case
that adds then removes the same title from the media page and checks the API count drops back to 0.

## A write collaborator couldn't see who else had access (2026-08-24)

Reported directly: added to a list as a collaborator, no way to see who else was on it -- the
detail page showed nothing about collaborators at all for a non-owner, not even the owner's name.

- **Root cause was frontend-only.** The backend already permitted it: `GET
  /:mediaListId/collaborators` asserts `viewList`, which every accepted member (read or write)
  passes -- only `MediaListAccessPolicy`'s `manageCollaborators` action is owner-only. But
  `WatchlistDetail`'s only path to that data was the Share button, gated by
  `canManageCollaborators(list.role)` (owner-only), so a collaborator never fetched or rendered it.
- **Fixed by giving the detail page its own read-only avatar row**, reusing
  `WatchlistSharedWithAvatars` (already shipped, unconditional, on the shelf) rather than opening
  management UI to non-owners. That needed `sharedWith`/`sharedWithCount` on the single-list GET
  response, which didn't carry them before (only the summary/shelf DTO did) -- moved both fields up
  from `MediaListSummary` onto the base `MediaList` type/DTO/schema, with `toMediaListDto` taking an
  optional `sharedWith` array (create/update responses default to `[]`; a just-created list has none
  and an update's SWR revalidate fetches the real value moments later anyway).
- **`sharedWith` on the shelf and `sharedWith` on the detail page turned out to need different
  data**, not just different rendering. The shelf's existing value (from `summariesFor`) is
  collaborators only -- the owner is deliberately never a collaborator row -- which reads fine
  narrated as "who did I, the owner, share this with." A collaborator asking "who's in this list"
  needs the owner too. Added `MediaListViewService.sharedWithFor(listId)`: owner plus accepted-only
  collaborators (accepted-only via the same batched `findByLists` the index already uses, not
  `findByList`, which would have leaked pending invitees who haven't joined). The membership-scoped
  variant of "everyone with access" (`membersFor`, owner + collaborators of any status) already
  existed for a different job -- seen-by badges -- and stayed untouched.
- The response is list-scoped, not viewer-relative: sharedWith is the same array regardless of who
  asks. Excluding the viewer's own face is `WatchlistSharedWithAvatars`'s job client-side, same as
  it already did on the shelf.
- Added `data-testid="watchlist-shared-with-avatar"` to each avatar link (there was nothing to hook
  a Cypress assertion to before) and a case covering the exact reported scenario: a write
  collaborator sees the owner's avatar with no Share button in sight.

Verification: full server suite (404 tests, +2) green, `tsc`/`eslint` clean both projects. New
route-level tests cover sharedWith from both the owner's and the collaborator's point of view, and
that a pending (not yet accepted) invitee never appears in it.

**Follow-up, same day:** the shelf (index page) had the identical gap and I'd left it alone,
reasoning it was already unconditional and therefore fine. It wasn't -- `summariesFor`'s `sharedWith`
was still collaborators-only (never the owner), so a collaborator who is the *only* collaborator on
someone else's list saw an empty avatar row there too: the one "other" in the raw array was their
own face, filtered out client-side by `WatchlistSharedWithAvatars`, leaving nothing. Reported
directly after the detail-page fix shipped. Same one-line fix as `sharedWithFor`: prepend `list.owner`
to the array `summariesFor` already builds, no new query -- the owner is already on hand as part of
`list` for every iteration. Backward compatible for the owner's own shelf row: the client-side
self-exclusion now removes the owner entry instead of nothing, netting the same displayed avatars as
before. Route and service tests updated/added for both endpoints; the Cypress case now checks the
shelf row before the detail page in one test rather than two.

## Pin an item to the top of a list (2026-08-24)

Branch `feat/media-lists-pin`, off `feat/media-lists-collaboration-and-polish`. Backend and frontend
domain/data layers only — no UI. Presentation goes through `/design` before it's implemented.

- **Storage is a nullable `pinnedAt` timestamp on `media_list_item`**, not a boolean, so the same value
  doubles as the tie-breaker when more than one item is pinned (pinning again refreshes it, which is
  what keeps the most recently pinned item ahead of one pinned earlier). New sqlite/postgres migrations
  (`AddMediaListItemPinnedAt`) match the `AddMediaListDeletedAt` pattern; verified by running the sqlite
  migration chain end to end against a scratch db and inspecting `pinnedAt`'s resulting column info.
- **Pin is list-level, not per-user**, unlike watched state: everyone with access sees the same pinned
  titles in the same order. Gated by the existing `editListItems` permission (same as add/remove/reorder),
  so the route lives in `mediaListItemRoutes.ts` as `POST`/`DELETE /items/:itemId/pinned`, not in
  `mediaListWatchRoutes.ts`, which is deliberately reachable by read-only collaborators for their own
  state.
- **Ordering is pinned-first, most recently pinned first, then the existing manual `position` order**,
  both on the detail page (`MediaListItemRepository.findByList`) and the shelf preview
  (`MediaListViewService.summariesFor`'s recency sort). NULL ordering isn't consistent between sqlite and
  postgres (DESC sorts NULLs first vs. last by driver default), so the repository query spells out
  `CASE WHEN pinnedAt IS NULL THEN 1 ELSE 0 END` instead of relying on either driver's default.
- **No notification and no list `touch()` on pin/unpin.** Reorder doesn't bump the list's `updatedAt`
  either (see the "Index sort" fix above, which only covers add/remove), so pin follows that precedent
  rather than add()'s.
- Verification: full server suite (412 tests) green, `tsc`/`eslint`/`prettier` clean on both server and
  client, sqlite migration chain runs clean from a scratch db.

## Pin presentation UI (2026-08-24)

Explored the pin badge with `/design` first (three directions: badge, corner ribbon, bare icon on
poster — see the published mockup). Mid-review the user caught a real problem in that first pass: the
pin badge and the pin action button were two separate elements showing the same picto at once once an
item was both pinned and hovered, and the existing "watched" badge/button had the identical duplication
already living in the shipped code. Asked to fix both together and reorganize where Remove goes.

- **One picto per state, and it doubles as the toggle**, everywhere pin or watched appears: filled and
  always visible once true (so a pinned or watched title is still recognizable without hovering
  anything — that requirement is why the plain badge couldn't just become hover-only), a quiet gray
  outline of the same glyph that only appears on reveal otherwise, no second button anywhere restating
  it. New `WatchlistPinToggle` component (bookmark outline/solid from `@heroicons/react`, since Heroicons
  has no thumbtack icon) is shared between the grid card and the poster strip; the watched toggle is
  inlined per component instead, since it already differed between the two (and the poster strip has no
  quick toggle for TV completion, just like the grid does) -- extracting it would have forced one shape
  onto two different reveal mechanisms for no shared benefit.
- **TV completion stays a passive, non-interactive badge**, never a toggle, on both the grid card and the
  strip: the app has no single-tap "mark this whole series watched" today (only per-episode, via the
  episode tracker), so nothing was invented there. Only a movie's watched picto is a toggle; a series'
  pin picto still is, since pinning isn't per-episode.
- **Two reveal mechanisms, not one.** The grid card already drives its hover reveal off React state
  (`showDetail`, since touch needs a tap-then-navigate-on-second-tap sequence a CSS `:hover` can't
  express) -- `WatchlistPinToggle`'s `revealed` prop plugs into that directly. The poster strip instead
  reveals off a real `:hover` on a `group` ancestor for a mouse (cheap, no state needed) plus a `tapped`
  boolean for touch, so the component grew a `revealOnGroupHover` flag that layers `group-hover:` classes
  on top of `revealed` rather than replacing it.
- **Remove moved into the bottom action bar** (next to Episodes and Request on the grid card; next to
  Request on the poster strip), now that the top corners are reserved purely for state (type, pin,
  watched) rather than a mix of state and actions. This was the harder half of the ask -- previously
  Remove lived in the same hover-revealed column as the now-removed pin/seen buttons.
- **Cypress fallout**: two existing assertions queried `watchlist-item-seen` as a separate element after
  clicking `watchlist-item-seen-toggle` -- both testids now point at the one merged element, so they
  assert `aria-pressed` on it instead. Added a case that pins and unpins a title on the detail page and
  checks the list re-sorts each time, and folded a "no pin picto for a read-only collaborator" check into
  the existing sharing test rather than duplicating its setup in a new one.
- Verified live in a browser, not just typechecked: seeded a throwaway list via the API against a
  freshly `cypress:prepare`'d dev server, logged in as the seeded admin, and clicked through pin/unpin
  and mark-seen on both the detail grid and the shelf strip. Caught one real bug this way that neither
  `tsc` nor `eslint` could have: the poster strip's "Added &lt;date&gt;" label shares the hover overlay's
  top-left corner with the new pin chip and collided with it once the chip stopped being conditional on
  `item.watched` -- fixed with `mt-5` on the label's row to clear the chip.
- Verification: `tsc`/`eslint`/`prettier` clean on the client, `pnpm i18n:extract` picked up the new
  `WatchlistPinToggle.pin`/`.unpin` and `pinfailed` keys.

## Pin/polish feedback round (2026-08-24)

Direct feedback on the shipped pin feature, then a second round of feedback mid-fix. Both addressed on
the same branch.

- **Root cause of "pinning doesn't move the item up": `WatchlistDetail`'s client-side `sortItems` ignored
  `pinnedAt` entirely.** The backend already returns pinned-first order, but the "Added Date"/"Title" sort
  the detail page applies on top of that re-sorts the *whole* array by the chosen criterion, discarding the
  server's pinned-first grouping outright. The existing Cypress pin test happened to keep passing through
  this bug because both seeded titles landed in the same second -- sqlite's `CURRENT_TIMESTAMP` is
  second-resolution -- so the "added" comparator's tie let `Array.sort`'s stability silently preserve the
  server's order. Fixed by splitting `sortItems` into a pinned group (sorted by `pinnedAt` desc, always
  first) and an unpinned group (sorted by whatever the user picked), concatenated. Cypress now also checks
  the pin survives switching to the "Title" sort, which the timestamp tie could never have caught.
- **Hover states and size**: `WatchlistPinToggle`'s pinned (amber) branch and the movie watched-toggle's
  watched (green) branch had no `hover:` classes at all -- only the unpinned/unwatched gray branch did.
  Added `hover:border-*-300 hover:bg-*-400` to both. Bumped both toggles up one notch: grid 20px→24px,
  strip 17px→20px (and their icons proportionally), matching sizes between the pin toggle and the
  seen-toggle/passive-badge in the same corner.
- **Added-date moved from the shelf to the detail page.** The poster strip's hover overlay showed
  "Added &lt;date&gt; [by &lt;name&gt;]"; the detail grid card showed nothing. Posters are small on the
  shelf, so that line now lives only on `WatchlistItemCard` (added `useUser`/`Avatar`, mirroring what the
  strip used to do), and the shelf strip shows title + year instead -- previously absent from
  `MediaListPreviewItem` entirely, so `year` was added end-to-end: `MediaListViewService.buildPreview`,
  the `MediaListPreviewItem` wire type, `toMediaListSummaryDto`, `seerr-api.yml`, the frontend `MediaListRef`
  model and `toMediaListSummary` mapper. Sized to match the same year-then-title treatment used everywhere
  else a poster overlay shows a title (`TitleCard`, the detail grid card) after an initial pass with small
  inline text read as inconsistent with the rest of the app.
- **Request button is icon-only on the shelf strip.** A tile only has room for one primary action's label
  now that Remove sits beside it; `WatchlistRequestButton` grew a `compact` prop (icon + `Tooltip`, no
  `<span>` label), passed only from `WatchlistPosterStrip`. The detail grid card keeps the labelled button.
- **Second round, mid-fix**: pin bookmark always visible rather than reveal-gated (`WatchlistPinToggle`
  lost its `revealed`/`revealOnGroupHover` props entirely -- a pin is something to notice and reach for,
  not just confirm after already hovering); swapped the Heroicons bookmark for an inlined pushpin SVG
  (heroicons has no thumbtack, so this is a raw `<path>` from svgrepo's "office pin", colored via
  `currentColor` so the existing amber/gray classes still apply to one shape instead of two icon
  components); dropped the "N other member(s) has seen this" line from the detail card entirely; removed
  the passive status dot from the shelf strip (kept on the detail card); and fixed `Dropdown.Item`'s
  `ghost` variant, which rendered a solid indigo-to-purple gradient on hover -- nobody had ever opted into
  it before (`AddToWatchlistButton` was the first `ghost` caller), so it was dead, wrong code. Changed to
  a plain `hover:bg-gray-700` matching the ghost container's own dark/gray look, and `AddToWatchlistButton`
  now passes `buttonType="ghost"` on its `Dropdown.Item`s.
- Verification: full server suite (415 tests) green, `tsc`/`eslint`/`prettier` clean on both projects,
  `pnpm i18n:extract` dropped `WatchlistItemCard.seenbyothers` and moved the `addedon`/`addedby` keys from
  `WatchlistPosterStrip` to `WatchlistItemCard`. Cypress `watchlists.cy.ts` run green (12/12) against a
  restarted dev server -- the first run hit an unrelated stale-turbopack 404 on the detail route after a
  long-lived dev server had absorbed several `nodemon` restarts from earlier `seerr-api.yml` edits;
  restarting `pnpm dev` fixed it and confirmed nothing in this change touched routing. Also checked live in
  a browser: pinning a title now visibly reorders it to the front immediately, even under "Title" sort;
  the shelf strip shows title/year and no date/avatar; the detail card shows the added-date/avatar and no
  "other member" line; the pin glyph is the new pushpin, always visible, amber when pinned; and the "Add to
  Watchlist" dropdown on a media page no longer shows a purple row.

**Third round, same day**: the shelf strip's status dot went back and forth once more once the reasoning
behind it was made explicit -- "remove the status badge" turned out to mean the *big* labelled pill
(`WatchlistRequestButton`'s `Badge`, which already only ever showed on `!requestable`), not the little dot.
Reverted the dot's removal and gave it back its old bottom-right spot, hover-faded the same way it always
was so it still yields that corner to Remove/Request on reveal, but now wrapped in a `Tooltip` +
`WatchlistStatusLegend` (it never had one before, since the badge's own tooltip was the only way to reach
the legend). `WatchlistRequestButton` gained a `compact`-gated condition so the big pill only ever renders
on the detail page now; the strip relies on the dot alone.

- **Shelf row is a single click target to the list.** `WatchlistShelf`'s outer container is now
  `role="link"`/`tabIndex`/`onClick` → `router.push`, styled with a hover background, rather than only the
  title text being a `Link`. Everything nested that already has its own destination -- the title link
  itself, the Share/Edit buttons, the shared-with avatars' profile links, and the entire poster strip (its
  own item links, pin/watched toggles, Remove, Request, the Add tile) -- stops the click from bubbling to
  the row via `e.stopPropagation()` on a wrapping element, so its own action wins instead of also
  navigating to the list. Three of those wrappers needed `eslint-disable-next-line` for
  `jsx-a11y/no-static-element-interactions` + `jsx-a11y/click-events-have-key-events`, matching the same
  disable already used for an identical propagation-guard div in `SlideOver`.
- **Pin icon shrunk within its (still enlarged) button** -- grid 14px→12px, strip 12px→10px -- the button
  itself stayed at the bumped size from the first round.
- **"Add to Watchlist" tooltip no longer lingers over the opened dropdown items.** The app's `Tooltip`
  tracks hover across its whole wrapped subtree, and the items list renders as a sibling of the trigger
  button inside that same wrapped `<div>`, so hovering the list kept the tooltip up. Replaced it with a
  native `title` attribute passed straight through `Dropdown`'s prop spread onto `Menu.Button` -- scoped to
  the button element only, which is what the custom Tooltip could not offer here.
- Verification: `tsc`/`eslint`/`prettier` clean on the client. Checked live in a browser: the shelf row
  navigates to the list from empty space but a poster click still goes to the title's own page and Share
  still opens its modal in place; the pin badge's glyph is visibly smaller inside the same-size button; and
  the status dot with its legend tooltip is back on the strip, unchanged on the detail page.
