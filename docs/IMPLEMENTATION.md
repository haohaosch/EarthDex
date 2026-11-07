# EarthDex v0.2 implementation and changes from the draft

The user's latest directions supersede the original draft for card generation, photo identification and review flow. The original document remains in `specification-v0.6.md` as historical input, not as an instruction to block this work.

## Current behavior

- Taiwan-first catalog with 81 locally observable animal taxa, including ordinary, domestic and introduced animals. One legacy global taxon is retained for old matches. Scientific taxonomy import and rank normalization are not complete; the catalog includes familiar species/subspecies labels.
- Live-camera still-photo capture, preview and retake. The animal should be near the center of the frame; there is no album picker and no manual species dropdown.
- On-device BioCLIP image encoding, then server-side image/name reference ranking. Classification results are immediate. Uncertain results request a new photo; no human review queue exists in the new flow.
- Identified observations offer one knowledge question. Correct answer atomically records an owned card instance, dex unlock and collected status. A wrong answer rotates questions without requiring a new photo.
- Card abilities are generated only at collection time with server cryptographic randomness and stored as immutable per-instance snapshots. Same species can vary. The dex displays question marks until the player owns that species' card; a dex-only unlock reveals no ability values. Card reloading and battle entry reuse saved snapshots, never reroll them.
- Collection is idempotent per observation. Exact photo hashes are deduplicated within the player's namespace. A client-supplied observation ID or species name cannot create a card. Match outcomes still unlock only dex questions and never mint/transfer cards.
- Bright card frames distinguish mammals, birds, reptiles, amphibians, insects, fish and water animals. Scores use dark numerals on gold/ivory fields. Enemy/player territories are separately distinguished by red/cyan outlines. The interface uses an adventure-game palette, scan feedback and a new-card reveal.

## Engine and persistence

The deterministic battle engine remains a pure shared module. It validates alternating turns, distinct owned instances and five-card decks (max two of one species), compares all orthogonal enemies from a common snapshot, applies resistance after a successful comparison, commits simultaneously, limits explicit skill waves, and scores only the nine board cells. Replays retain actual card snapshots from that match.

`capture-0.2` uses a 28-point directional-plus-skill budget and values 1–10. Server-owned card generation has a fresh random seed per issuance; battle replay uses the saved seed/definition. Ecological tags filter skills; absent evidence uses a neutral skill. The old versioned deterministic generator remains available for engine fixtures. Legacy instances without snapshots retain their original v0.1 species abilities. New demo fixtures and collected cards store their own definitions.

Profiles and matches are separate D1 JSON aggregates protected by compare-and-swap revisions. The collection commit saves the observation, card instance and dex unlock in one profile row update. D1 schemas are generated under `drizzle/`; no tables are created from request handlers. No schema migration is needed for optional fields within profile JSON. Private photos remain in R2; old videos remain viewable. Public profile payloads strip internal storage keys and do not expose exact locations.

## What the model is and is not

See `MODEL.md` and `recognition-evaluation.json`. EarthDex's Taiwan classifier is built from licensed reference images and taxon-name vectors using a pre-trained BioCLIP encoder. It is not a visual model trained from scratch, not global species coverage, and not a guarantee of a correct identification. The small development calibration set does not measure field performance.

Only device features are compared by the server; the browser currently performs the expensive image encoder. Modified clients could send forged features. MIME/signature checks, authenticated ownership, exact-file duplicate detection and idempotency are implemented; sophisticated replay/device/anti-cheat detection is not. The application follows the user's requested direct-recognition workflow without presenting it as wildlife authenticity certification.

The draft's conflicting 1 km / 7 day GPS reward policy is not applied. No exact GPS coordinates are collected. Operational moderation, hardened server inference, sensitive location storage, privacy retention automation, native mobile builds, global ETL, venue integrations, matchmaking and taxonomic split/merge maintenance remain future work.

## Validation

`npm test` covers battle invariants, instance randomness and budget bounds, stable snapshots, legal decks, no battle minting, complete AI/PVP games, exact replay, direct identification/quiz/collection, retries, exact-file duplicates, photo ownership/deletion and legacy media. TypeScript checking is included in the production build.

Real ONNX encoder inference and reference ranking are exercised by the model-building scripts, with a disjoint reference/held-out image split for the calibration report. Model download provenance and counts are retained. Shared browser initialization still fails with “the gaas-browser node_repl sandbox cannot be disabled”, so visual, browser-WASM and actual device-camera QA could not be completed here. That limit is not represented as a passing browser test.
