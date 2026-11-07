# EarthDex

A playable Traditional Chinese web demo implementing the confirmed core of the attached [v0.6 specification](docs/specification-v0.6.md). The web/TypeScript option in the draft is used to share one deterministic engine across the browser, local server and hosted Worker. The proposal for Flutter/FastAPI/PostgreSQL is not treated as a mandated stack.

## Run

Requires Node 24. Install with `npm ci`, then run `npm run dev`. The dev server uses a local SQLite database and private observation media under ignored `.sites-runtime/`. A fresh browser session gets its own HttpOnly session cookie. `npm test` runs engine and server integration tests; `npm run build` type-checks, builds React, and bundles a self-contained Cloudflare Worker into `dist/server/index.js`. `npm run check` runs the type checker.

Managed preview: `sites-preview start /workspace/sites/earthdex`. Ordinary local preview: `npm run dev`, then open the printed URL. Use HTTPS or localhost for camera access. The built-in camera captures one JPEG photo with preview and retake. No microphone is requested. No album input is accepted as field evidence.

## Implemented

- A 3×3 deterministic battle engine: arbitrary empty cells, fixed card orientation, strict opposing-edge comparison, simultaneous base flips, nine-turn board scoring, no ordinary chain reaction, event trace and exact replay.
- Explicit experimental skill registry, budget-constrained seeded generation, neutral fallback, armor, cooperation, corner ambush, camouflage, test-only flip chain, and a three-additional-wave cap.
- Five actually owned card instances, maximum two of a species and minimum three species. Definition, ownership, observations, dex unlocks and board controllers remain separate. Every fixture instance has a unique observation and grant reference. Live official card issuance is disabled.
- Server-driven themed AI at three reproducible strategy levels. PVP rooms with server-side turn validation, compare-and-swap revisions, durable state, two-second polling, session reconnect, and resignation.
- Server-validated quizzes for unknown enemy-origin species still controlled at complete match end. Wrong answers show learning content and rotate questions. Settlement and unlock retries are idempotent. Battle never mints or transfers cards.
- Twelve initial animal taxa, source-linked knowledge, Wikimedia portrait author/license records, search, filters, overlapping collections, and cosmetic collection completion badges.
- Camera-only single-photo capture, JPEG preview and retake, optional GPS accuracy, private photo storage, viewing, and observation/photo deletion. Previously saved videos remain viewable. Exact coordinates are not sent or stored. New photos remain unverified; saving a photo never automatically grants a card or a dex unlock.
- Distinct **demo explorer** and **fresh real profile**. Demo includes seven preconstructed fixture cards and observations for testing. This is not a production starter deck or a bypass of field collection rules. Real profiles start empty and cannot battle.

## Decisions deliberately pending

See [implementation notes](docs/IMPLEMENTATION.md) for the draft-to-implementation mapping, experimental choices and remaining production work. Formal GPS issuance, actual AI wildlife identification, reviewer operations, mobile native builds, global taxonomy ETL and venue verification are not represented as finished features.

## Persistence and hosting

Cloudflare Worker uses the `DB` D1 binding and `BUCKET` R2 binding. Hosted migrations are generated with `npm run db:generate` into the standard `drizzle/` directory. The same generated SQL is used by the local runtime and integration tests. For local use the same migration is applied once to SQLite automatically. All access is scoped to the server-derived platform identity, with separate `:demo` and `:real` namespaces. Local fallback sessions exist only in the dev adapter; production requires the platform's authenticated user header. Keep the Site owner-private unless its owner explicitly changes access. Another PVP player must have Site access; use separate browser sessions locally to test two people.

The static React build is embedded into the Worker for a self-contained deployment without asset bindings. The hosting manifest declares Site identity and storage. No secrets, observation media or local runtime files belong in source control or the artifact. Observation photos and legacy videos are private, not public assets.

## Reproducible balance exploration

`node --import tsx scripts/simulate.ts 100 normal` reports a seed range, strategy, exact deck species, sample size, first-player wins and Wilson 95% interval. The result describes this matchup only and must not be advertised as general fairness evidence. Seeded fixtures and initial match snapshots preserve historical card definitions even when a later generator version changes.

## Media

`src/media.json` records photo attribution, licenses and file source URLs. Individual species details and the guide display credits. Portraits are reference photographs, not user-submitted observation evidence. The illustrative hero is a source-attributed Taiwan forest photograph. Refreshing image sources is a deliberate development operation; the deployed app never calls Wikipedia for identification.
