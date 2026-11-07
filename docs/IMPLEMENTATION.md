# v0.6 implementation notes

## Confirmed rules implemented

`engine/engine.ts` is pure and shared by all modes. It validates deck instances, alternating turns and empty cells, computes base comparisons from one snapshot, applies resistance only after a successful comparison, commits flips together, changes skill controller with the board controller, and records deterministic events. The first player places five cards, the second four; the leftover hand does not count toward score. Exact replay uses the persisted initial definitions, version, seed and move sequence.

`server/model.ts` separates owned instances, observation/grant references, dex unlock events, pending quizzes and deck selection. Fixtures are explicitly marked and isolated from real accounts. `server/api.ts` derives identity from the deployment gateway and applies revision checks. Quizzes never award cards. Neither PVP flips nor AI outcomes change card ownership. Settling a match twice does not duplicate statistics or quiz eligibility.

The minimum required species count is three (2+2+1). There is no real new-player loan or starter deck. The UI defaults to an explicit demo namespace solely to make this deliverable reviewable.

## Experimental configuration, not approved product rules

All proposal-dependent behavior is labeled `experimental-0.1`, documented in the guide, and lives in a replaceable registry. It is not promoted to a final official rule version.

- Budget 28, values 1–10, sorted eligible skill pool with uniform seeded selection; unknown traits get neutral 7/7/7/7.
- Placement → snapshot comparisons with modifiers → resistance → simultaneous commits → at most three additional skill waves. Each wave snapshots first and sorts source/target cells numerically. A card can trigger again in a later wave, bounded by three waves.
- Cooperation reads adjacent current allies, including a newly placed ally; +2 maximum. Camouflage defense +1. Ambush gives +2 only to the newly placed source at a corner (chain-only ripple sources cannot also have ambush because a card has one skill).
- Armor cancels its first eligible flip per match and never resets on control change. All current skill definitions explicitly use `resetOnFlip=false`. No skill moves/swaps positions or overrides strict-greater comparison.
- Test-only `ripple` skill creates comparison waves after capture; it is **not attached to a real animal**, so it makes no unsupported ecological claim.
- Fixed-seed first player, no move timeout, resignation yields a loss, no dex candidates for a resigned match. Online transport is polling, not WebSocket. Room visibility is scoped to participants. Reopening a stored room ID resumes it.
- Wrong quiz answers rotate between a species question and a safe-observation question; retries are unlimited. The small editorial question bank needs professional review before production.
- Series membership is the fixed v0.1 list. Historical badges are retained; there is no taxonomy migration or revocation flow yet.

## GPS and verification boundary

The conflict in Q1–Q3 is preserved as an unresolved product decision. `/api/grant` always returns 409; no official grant can be produced from a manual claim, video upload, quiz, AI or PVP match. Distance is implemented as a tested pure haversine function, **not used as reward eligibility**. Repeated submissions retain separate observation IDs; they create no cards.

The prototype requests optional browser location but only transmits accuracy. This avoids retaining sensitive exact coordinates before an approved location/reward policy and encryption design exist. A production observation location store, field grant transaction and anti-replay/GPS validations remain to be designed once the conflict is resolved. Therefore the official grant idempotency acceptance test is currently replaced with a stricter assertion that all grant retries are blocked and never mint cards.

The built-in camera records silent 5–15 second videos with one of three safe randomized prompts. It does not accept file uploads through UI. The server still treats every browser byte as untrusted; it does **not** claim browser recording or the prompt proves authenticity. MIME/size are bounded; actual media analysis, device attestation, deduplication, confidence thresholds, model inference and reviewer permissions are not implemented. Every uploaded video is saved as `manual_review`, never verified. Reviewers cannot be impersonated by the player; no player-accessible approve endpoint exists.

Private playback and deletion are authenticated and observation ownership checked. Files are on R2 in production and ignored filesystem storage locally. There is no public observation/coordinate sharing route. Production work includes encrypted sensitive-location storage, video scanning, retention jobs, per-account quotas, rate limiting, audit logs and operational review staffing. A 100-observation per-profile prototype cap is enforced, not a production abuse defense.

## Data and scope

Twelve hand-curated initial taxa are included. This is a limited Taiwan-first educational dataset with two global collection entries, not global taxonomy coverage. The sika deer and black bear entries use familiar Taiwan subspecies names; a production COL/GBIF import must explicitly model rank/parent species and normalize taxon identity before official species grants. External IDs, accepted-name changes, taxon splits/merges and large-scale ETL are not implemented.

Knowledge and ecological trait tags refer to the corresponding source-linked encyclopedia entries. All photo authors, licenses and source links are pinned in `src/media.json` and visible in-app. This is initial provenance, not a claim of comprehensive scientific curation or licensing audit.

Data is persisted as versioned JSON aggregates in a D1/SQLite profile table and an independent match table, with atomic optimistic updates. The logical entities are separated in typed models but are not a complete normalized PostgreSQL schema. This keeps the demo transport and persistence executable on the provided hosting runtime. PostgreSQL/PostGIS, native Flutter builds, global ETL, authorized zoo integrations, multiplayer matchmaking and operational moderation remain future modules.

## Verification

`npm test`: engine invariants, 500 generated-card checks, 20 seeded complete games/replays, server-owned deck validation, quiz retries/no card minting, blocked formal rewards, idempotent settlement, two-user PVP and reconnect, cross-origin rejection, private video ownership and deletion. `npm run build` includes strict TypeScript checking. The shared browser initialization failed with “the gaas-browser node_repl sandbox cannot be disabled”; the managed preview relay also timed out. No replacement browser path was used, so visual, device-camera and browser-interaction QA remain unverified in this environment.

The hosted D1 schema is declared in `server/schema.ts` and generated with Drizzle into `drizzle/` (including migration journal/snapshot). `migrations/0000_initial.sql` is the equivalent local bootstrap schema. Neither is executed during hosted request handling.
