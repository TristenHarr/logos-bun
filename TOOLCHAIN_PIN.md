# TOOLCHAIN_PIN — the LOGOS toolchain

| Field | Value |
|---|---|
| Repo | git@github.com:Brahmastra-Labs/logicaffeine.git |
| Pinned commit | `d7c86c1bc55dc88abc38f08096192f86f9be82d0` |
| Pin date | 2026-07-13 |

Dual-mode dependency (§5):
- **Local dev**: `scripts/build.sh` uses the live sibling checkout via
  `LOGOS_WORKSPACE=/home/tristen/logicaffeine` + `cargo run -p logicaffeine-cli -- build`.
  The sibling working tree may be ahead of the pin (uncommitted G-task kernels are usable
  immediately); the pin formalizes at wave boundaries when the user commits logicaffeine
  and bumps `vendor/logicaffeine`.
- **Hermetic/CI**: builds from `vendor/logicaffeine` at the pinned commit.

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
