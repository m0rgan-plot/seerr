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

## PR #14, `feat/watchlists-13-hover-and-mark-seen-polish` (2026-08-16)

Live-server feedback on PR #13's build surfaced four more frontend defects. Rather than
adding them to #13 directly, `fix/watchlists-12-server-bugs` was rebased onto
`feat/watchlists-11-review-fixes` (no conflicts — the two textual overlaps the audit
flagged in `MediaListViewService.ts` and `TypeOrmMediaListItemRepository.ts` merged
cleanly), and this branch stacks on top of the rebased #12 rather than on #11 directly.
Local only so far: rebase and new branch are not yet pushed, pending confirmation before
force-pushing #12's already-published history.

- **Card border/ring only visible at the rounded corners.** `WatchlistItemCard`'s idle
  ring state was missing the `shadow` class that `TitleCard` carries; added it to match
  `TitleCard` exactly (`ring-1` + `shadow`). What looked like "still broken" after that
  fix was screenshot-tooling artifact, not the real page: automated screenshots compress
  a 1px ring into near-invisibility, so a round of live-DOM experiments chased the width
  up to `ring`/`ring-2` before a direct user comparison against the Movies grid confirmed
  the real browser renders `ring-1` fine and the wider rings actually looked heavier than
  Movies. Settled on byte-for-byte parity with `TitleCard`'s ring classes — trust a direct
  reference-page comparison over screenshot pixel-peeping for hairline CSS.
- **Poster strip had no hover scale, and its `overflow-hidden` row clipped the ring.**
  `WatchlistItemCard` (the detail grid) already had `scale-105` wired through
  `showDetail`, matching `TitleCard`, because its ancestors are all `overflow: visible`.
  `WatchlistPosterStrip` sits in a `flex ... overflow-hidden` row (needed so an
  oversubscribed shelf clips instead of wrapping), which ate the ring and any hover
  growth with zero clearance. Added `hover:scale-105` plus `p-1` on the row so the ring
  and the scaled-up hover state both have room without touching the clip boundary.
- **"Mark as seen" button had no visible hover.** It used `buttonType="success"` when
  watched, whose hover (`bg-green-500/80` → `bg-green-500`) is nearly imperceptible against
  an already-solid green fill. Switched both the card and the strip to a plain `ghost`
  button, matching the Remove/Trash button beside it, whose hover (border-gray-600 →
  border-gray-200) is clearly visible. The green success fill was redundant anyway: watched
  state already persists as the corner checkmark badge.
- **Eye/eye-slash icon read as show/hide, not mark-as-seen.** Replaced both icons with a
  single `CheckIcon` in both components, used unconditionally — no second "selected" icon
  variant, since the action is the checkmark and the persistent watched state lives in the
  corner badge, not on the button.

Verified in the browser against a rebuild (`pnpm build` + server restart): ring visible on
all four sides, strip posters now enlarge on hover, the seen-toggle button's border
brightens on hover exactly like the trash button, and both card types show a plain
checkmark regardless of watched state. `tsc --noEmit` and `eslint` on the changed files are
clean; no unit or Cypress spec references the removed icons or button types (only the
stable `data-testid`s).

**Aside, resolved:** list 23 renamed itself to "Sunday Night Thriller" and new lists kept
appearing mid-session with no corresponding local action. Turned out to be the user
testing the same running dev server live in their own browser tab throughout this
session, not a bug — explains the flurry of rapid-fire feedback too.

## PR #14 continued: chip status, sort-by-recency, and more polish (2026-08-16)

Kept iterating against the same running server as the user tested live.

- **Status now reads as a chip, not a button.** The "Processing"-style label that fills
  the Request button's spot (added earlier this branch) was a hand-styled div that looked
  clickable. Rebuilt on `Common/Badge` — the same component `SettingsBadge` uses for
  "Experimental" — with `badgeType` mapped per `MediaStatus` (yellow/pending, indigo/
  processing, green/available & partially available, red/blocklisted). The redundant
  corner `StatusBadgeMini` (small circle with a status icon, including the clock the user
  called out) is gone from both card types now that the chip carries the same
  information more clearly. Trade-off worth knowing: that corner badge was the only
  always-visible status signal; the chip only shows on hover (desktop) or not at all on
  touch, since it lives inside the same hover-revealed action row the Request button
  always used. Not fixed — flagging in case it matters for mobile users browsing a
  shared list they can't edit.
- **`MediaListItem` gained `updatedAt`**, threaded through every layer (domain entity →
  mapper → DTO → `seerr-api.yml` → frontend model → frontend mapper) the same way
  `MediaList.updatedAt` already existed. The underlying DB column
  (`MediaListItemRecord.updatedAt`, a bare `@UpdateDateColumn`) was already there and
  already had the right semantics for free: watched state lives in a separate
  `MediaListItemWatchRecord`/`MediaListEpisodeWatchRecord` table per user, so nothing
  about ticking an episode ever touches the item row. Only `add()` and `applyOrder()`
  (reorder) save it. That is exactly the sort semantics chosen: **items sort newest
  add-or-reorder first**, and marking something seen never reshuffles the grid.
  `WatchlistDetail` now sorts client-side on this field; no pagination or API-shape
  change needed since the endpoint already returns every item unpaginated.
- **"+Add" tile moved to the front of the poster strip**, ahead of the previewItems,
  matching where a newly-added title will land once the list re-sorts to show it.
- **Add Media dialog now names the list** it's adding to (`mediaListName` prop threaded
  from both call sites) — was silent about which list was open.
- **Add Media dialog result titles now link out** (`target="_blank"`) to the title's
  media page, so browsing search results doesn't require leaving the dialog.
- **Share dialog's user picker went stale across an open list.** `UserSelector` uses
  `react-select`'s `cacheOptions`, which persists for the component's lifetime; a user
  created after the picker first loaded wouldn't appear until something remounted it.
  `ShareWatchlistModal` now bumps its remount key on every `show` transition, not just
  after a successful invite.
- **Sort control added to "My Lists"** (last modified / title / created, default last
  modified), client-side only — the index endpoint already returns every owned list
  unpaginated, same reasoning as the item sort above.
- **The three-dot options button read as a menu but opened a dialog.** Swapped
  `EllipsisVerticalIcon` for `PencilIcon` on `WatchlistShelf`'s edit entry point, since
  that's the only thing it does.

**Deferred, by the user's own choice, to a separate planned pass** — both need domain/
data-layer work and interact with the index N+1 the audit already flagged:

- **Invites as a real pending state.** Design agreed for later: a "Shared with Me →
  Invites" section at the top of the Watchlists index, styled like Discover's "Recent
  Requests" cards — no poster grid, just the list name/owner and two icon actions
  (check to accept, cross to reject). Rejecting is final for now: no un-reject, the owner
  would just re-invite. Needs a `pending` collaborator state (today `share()` grants
  access immediately), an accept/reject endpoint pair, and hiding a list from "Shared
  with Me" until accepted.
- **Per-list "shared with" avatars on the index.** Showing collaborators directly on each
  `WatchlistShelf` row (not just inside the Share modal) needs the index response to
  carry them, which means either a new per-list query in `summariesFor` (worsening the
  already-flagged N+1) or a batched collaborator lookup — a real backend design question,
  not a prop threading exercise.

## PR #14 continued again: status color system, delete confirm, mobile parity (2026-08-16)

- **Ring width settled on exact parity with `TitleCard`** (`ring-1`), not a heavier one.
  The earlier "still just corners" reports turned out to be screenshot-tooling artifact
  (JPEG compression erases a 1px line; a real browser renders it fine) — confirmed once
  the user compared this page against Movies directly in their own browser and asked for
  `ring-1` back after a `ring`/`ring-2` detour. Lesson recorded: trust a live
  reference-page comparison over automated screenshot pixel-peeping for hairline CSS.
- **Status color system centralized** in `src/components/Watchlists/statusPresentation.ts`
  — `statusBadgeTypes`, `statusDotClass`, `statusMessages`, `STATUS_LEGEND_ORDER` — so the
  hover chip, the always-on corner dot, and the color legend can't drift apart. Partially
  Available got its own color (gray, via `Badge`'s `light` type) instead of sharing green
  with Available.
- **Corner dot is back**, redesigned: a plain colored circle (no icon, no button) at the
  poster's bottom-right, replacing the clock-bearing `StatusBadgeMini` that was removed
  earlier this branch. Purely visual — `WatchlistStatusDot` — since the interactive,
  tooltip-bearing element turned out to need to be the chip, not the dot: the dot
  disappears the instant a hover would reveal the chip, so a tooltip trigger placed on it
  was reachable for only a few pixels of the transition. Moved to wrap the chip instead
  (`WatchlistRequestButton`, chip inside a `<button>` inside `Tooltip`), which is also
  what stays on screen long enough to actually read.
- **Color legend on hover**, `WatchlistStatusLegend`: a dot-and-label row per status,
  reusing the same `statusPresentation` maps. `delayShow: 1000` on the tooltip config so
  it doesn't flash on every passing hover.
- **Badge chip was too tall and its text wasn't vertically centered.** The caller was
  forcing `h-7` onto `Badge`, which has no `align-items` of its own; extra height above
  the text's own line-height just sat unclaimed at the top. Moved sizing to a wrapping
  `<button>` (also now the tooltip trigger) and gave `Badge` `items-center !h-auto py-1`,
  so it sizes to its own content and centers properly regardless of what height the
  caller's slot wants.
- **Delete needs confirming.** Both remove entry points (`WatchlistItemCard`'s trash
  button, `WatchlistPosterStrip`'s) now open `RemoveWatchlistItemModal` — reuses the
  existing `Modal` component the way `DeleteWatchlistModal` does for whole lists — instead
  of removing on the first click. The strip only has tmdb ids and art, no title text, so
  the modal's copy falls back to a generic phrasing when no title is passed.
- **Strip's remove icon changed from an X to a trash can**, matching the detail grid's
  button and reading less like "dismiss/cancel" and more like the destructive action it is.
- **Mobile had no way to reach mark-seen/remove/request in the poster strip at all.** The
  action overlay was gated `canAdd && !isTouch`, so touch devices never got it — hover
  literally cannot fire there. Fixed properly (not by leaving it always-on, which was
  tried and reverted): the strip now tracks which poster was tapped
  (`tappedKey`) and reveals that one's actions in place of navigating, mirroring how
  `TitleCard`/`WatchlistItemCard` already treat a tap as an `onClick`-driven reveal on the
  detail grid. A second tap (or a tap on a different poster) proceeds to navigate/reveal
  as normal.
- **Strip couldn't scroll**, so a list with enough preview items to overflow a narrow
  viewport just clipped them via `overflow-hidden`. Switched to `overflow-x-auto`.

Verified in the browser against a rebuild: `tsc --noEmit` and `eslint` clean across both
projects, all 373 server tests still green (no server-side behavior changed beyond the
additive `updatedAt` field from the previous round). Mobile-specific behavior (tap-reveal,
touch detection) could not be verified live — this session's browser automation is a real
desktop Chrome without touch emulation, and resizing the window does not change what
`useIsTouch()` reports. Worth a manual pass on an actual phone or with Chrome's device
toolbar before calling it done.

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

## PR #17, `feat/watchlists-17-shared-with-badges` (2026-08-16)

Built the "shared with" avatars on `WatchlistShelf` flagged as deferred in the PR #14
log above, off `feat/watchlists-13-hover-and-mark-seen-polish`. The brief was explicit
that this must not deepen F4's documented index N+1 (`summariesFor`: 1 + 4N queries for
N lists today).

- **Query strategy: one batched `IN (...)` lookup, not a per-list query.** Added
  `MediaListCollaboratorRepository.findByLists(listIds): Promise<Map<number,
  Collaborator[]>>`, implemented in `TypeOrmMediaListCollaboratorRepository` as a single
  `find({ where: { list: { id: In(listIds) } }, relations: { user, invitedBy, list } })`
  and grouped into a map by `record.list.id`. `MediaListViewService.summariesFor` calls
  it once before the per-list `Promise.all`, then reads from the map inside the loop.
  Net effect on the index: **+1 query total, not +N** — `summariesFor` is now 2 + 4N
  rather than 1 + 4N. Mirrors the existing `findMovieWatchesForItems` /
  `findEpisodeWatchesForItems` batched-by-itemIds pattern in
  `TypeOrmMediaListWatchRepository`, which was the precedent to follow. A domain test
  (`MediaListViewService.test.ts`) asserts `findByLists` is called exactly once across
  two lists via a call-recording fake, and an integration test
  (`repositories.test.ts`) exercises the real batched query against sqlite.
- **Wire shape: minimal `MediaListUser` (id, displayName, avatar), capped and counted.**
  `UserRef` already carried exactly the avatar-rendering fields with nothing sensitive
  (no email, matching the milestone 9 decision), so no new type was needed — reused the
  same `toUser` mapper collaborators already use. Server caps `sharedWith` at 5 entries
  per list (`SHARED_WITH_LIMIT` in `toResponseDto.ts`) since this goes out on every list
  on the index; `sharedWithCount` carries the true total so the client's "+N" overflow
  chip is accurate even when the server held some back. The domain layer
  (`MediaListSummary.sharedWith`) itself carries the full, uncapped list — capping is a
  presentation-layer decision, not a domain one.
- **Threaded end to end**: `MediaListCollaboratorRepository` → `MediaListViewService`
  (`MediaListSummary.sharedWith: UserRef[]`) → `toResponseDto.ts`
  (`sharedWith`/`sharedWithCount`) → `seerr-api.yml` (`MediaListSummary` schema,
  both fields required) → `mediaListInterfaces.ts` → frontend `dto.ts` (no change, as
  expected — it's a blanket re-export) → `src/domain/mediaLists/models/MediaList.ts` →
  `mediaListMappers.ts` → `WatchlistShelf`.
- **UI reused the existing avatar convention instead of inventing one.**
  `CollaboratorList`'s inline `Avatar` (circular, cropped `CachedImage`, plain grey
  circle fallback when no avatar URL) was extracted to
  `src/components/Watchlists/Avatar` with a `size` prop (`sm`/`md`) so both
  `CollaboratorList` (unchanged visually, still `md`) and the new
  `WatchlistSharedWithAvatars` (`sm`, overlapping via `-ml-2` + a `ring-2 ring-gray-800`
  border to separate them against the poster strip) share one fallback path. Renders
  next to `WatchlistRoleBadge` — same row, secondary signal. Self is not filtered out of
  the list on a "Shared with Me" row (a viewer is also a collaborator row), matching
  `CollaboratorList`'s own behavior of listing every collaborator regardless of viewer,
  for consistency over cleverness. Nothing renders when `sharedWith` is empty (an
  unshared owned list).
- New `react-intl` keys added via `defineMessages` and extracted with `pnpm
  i18n:extract`: `WatchlistSharedWithAvatars.more`, `WatchlistSharedWithAvatars.sharedwith`.

Verification: `tsc --noEmit` clean on both projects, `eslint` clean on every touched
file, `pnpm test` 377 passed / 0 failed (up from the 373 baseline; 4 new tests: 2
domain-level call-count + value tests, 2 repository-level batched-query tests), `pnpm
build` clean. **Could not verify live in the browser**: this worktree had no seeded
dev database, and `pnpm cypress:prepare` (the normal way to get one, with
`admin@seerr.dev` / `test1234` and a second seeded user) was blocked by this
environment's command classifier as a DB-affecting action, even with nothing yet to
wipe. Relied on typecheck/lint/test/build passing plus a read-through of the full data
path (repository → service → mapper → schema → frontend mapper → component) instead.
Worth a manual browser pass before merging, per the original brief's own fallback
instructions.
