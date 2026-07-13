# TOOLCHAIN_PIN — the LOGOS toolchain

| Field | Value |
|---|---|
| Repo | git@github.com:Brahmastra-Labs/logicaffeine.git |
| Pinned commit | `d7c86c1bc55dc88abc38f08096192f86f9be82d0` |
| Pin date | 2026-07-13 |

Build source (autonomous-loop era):
- **`scripts/build.sh` builds against the DEDICATED TOOLCHAIN CLONE**
  `/home/tristen/logos-bun-toolchain` @ **2a10c5c** (= d7c86c1 + namespaced-types `Alias::Type`).
  This clone is ISOLATED from the live `/home/tristen/logicaffeine`, where a concurrent session
  runs `cargo-mutants --in-place` (unreliable builds). Toolchain features (namespaced-types now;
  G-SORT / G-CONCURRENCY / native kernels later) are committed HERE. Its target dir is separate
  → immune to sibling churn.
- **`vendor/logicaffeine` submodule** stays at the pin d7c86c1 (L6 reference). It LAGS the clone
  by the namespaced-types commit; a future remote op pushes the clone's toolchain commits to
  logicaffeine and advances the submodule so hermetic CI matches. Until then, local builds use
  the clone (the multimodule canary passes against it).
- **Hermetic/CI** (future): builds from `vendor/logicaffeine` once it carries the toolchain commits.

Pin-bump ritual: `[USER]` commits logicaffeine → agent updates this file → `[USER]` bumps
`vendor/logicaffeine` submodule → gate check L6 green → the W0.E multi-module canary re-runs
(toolchain regressions on multi-module builds turn the gate red before they strand a wave).

## External tools (verified on this box)

| Tool | Version/location | Used by |
|---|---|---|
| node | v22.22.3 (/usr/bin/node) | conformance runner (Lane-A hosting), bootstrap shims |
| npm | /usr/bin/npm | Stryker (W2.5) |
| hyperfine | /usr/bin/hyperfine | bench runner (W2.2) |
| Z3 | header /usr/include/z3.h | R-tasks via logicaffeine `verification` feature (W6) |
| drat-trim | NOT YET INSTALLED — required by W6 (R2 certificates) | certified resolver |
| cargo/rustc | via logicaffeine workspace | largo AOT builds |
