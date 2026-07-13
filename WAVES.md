# WAVES — campaign state (canonical; gate.sh results are appended here)

Execution plan: see the approved wave plan (mirrored from
`~/.claude/plans/we-want-to-make-glowing-corbato.md` at bootstrap). Master spec:
`BAKE_A_BUN.md`. Rule: Wave N+1 may not start until `scripts/gate.sh --wave N` exits 0.

Task states: `QUEUED → RED → IMPL → REVIEW → FIX → GREEN → LOCKED → SWEPT`.
`[USER]` marks user-driven steps.

## Wave table

| Wave | Content | Status |
|---|---|---|
| 0 | Bootstrap: repo, pins, oracle, P0.1, multi-module smoke, gate.sh v0 | **GREEN** (gate --wave 0, 2026-07-13T03:20Z) |
| 1 | Enforcement: P0.4, P0.2, P0.3, P0.5, P0.10, GIFT.2, gate-audit + **G2-early, G13 largo-test (tests-in-LOGOS)** | IN PROGRESS |
| 2 | Harness completion: P0.7, P0.8, P0.9, P0.6, P0.11, PORT.1/2, GIFT.3, **W2.9 shim→.lg migration (L16)** | QUEUED |
| 3 | First product: G9 TOML (upstream), P1.1–P1.4, PORT.3 trial | QUEUED |
| 4 | P2 leaf fan-out; cargo-mutants; G11 opens | QUEUED |
| 5 | P3 batch (G1+G12,G2,G3,G4+G5,G7,G10) + registry snapshot + P4 core | QUEUED |
| 6 | P4 completion: R1–R3, S1, gauntlet, first bench locks | QUEUED |
| 7 | P5 parser | QUEUED |
| 8 | P6 bundler + M0 + M1 hybrid | QUEUED |
| 9 | P7 engine (9a seed / 9b completion / 9c projections) | QUEUED |
| 10 | P8 test runner / run / shell | QUEUED |
| 11 | P9 grind → SH-1 → win-matrix → M5 flip | QUEUED |
| 12 | P10 closeout X1–X6 | QUEUED |

## Wave 0 tasks

| Card | Task | State | Note |
|---|---|---|---|
| W0.A | repo init + hooksPath + submodules | GREEN | vendor/bun @ 0d9b296 (bun-v1.3.14), vendor/logicaffeine @ d7c86c1 |
| W0.B | oracle acquisition (fetch-oracle.sh, SPEC_PIN fill) | GREEN | sha256 9fd36f87…ad74, version `1.3.14`, 1731 test files at tag |
| W0.C | constitution (CLAUDE.md, pins, WAVES.md, BAKE_A_BUN.md copy) | GREEN | 10 L15 anchors |
| W0.D | P0.1 walking binary (Largo.toml, main.lg, build.sh, gate.sh v0) | GREEN | binary-name PASS; `bun --version` byte-exact vs oracle; build 115.9s (G11 datum) |
| W0.E | multi-module smoke (permanent toolchain canary) | GREEN | canary found + drove the `Alias::Type` fix upstream (lexer glue + rust_type_ident codegen sanitizer; 8/8 new tests, 23/23 neighbors, 268/268 language crate). 2 adversarial reviewers in flight; **pin-bump ritual pending**: `[USER]` commits logicaffeine after review verdicts, then TOOLCHAIN_PIN + vendor/logicaffeine bump + canary re-run |

## Wave 1 tasks

| Card | Task | State | Note |
|---|---|---|---|
| W1.1 | P0.4 ledger core + hash chain (KEYSTONE, serial) | IMPL | schema is everyone's interface |
| W1.2 | P0.2 runner fork + assert counts | QUEUED | waits on SCHEMA.md freeze |
| W1.3 | P0.3 patches + lane lint | QUEUED | waits on SCHEMA.md freeze |
| W1.4 | P0.5 comparators | IMPL | independent of ledger schema |
| W1.5 | P0.10 workflow-ops | IMPL | independent |
| W1.6 | gate.sh v1 + gate-audit (serial, last) | QUEUED | integrates all |
| W1.7 | GIFT.2 gifts ledger | QUEUED | joins W1.1 chain mechanism |
| W1.8 | G2-early subprocess+sha256 (logicaffeine) | QUEUED | hold: review verdicts + sibling-stream coordination |
| W1.9 | G13 largo test (logicaffeine) | QUEUED | **COORDINATE FIRST**: sibling stream has in-progress `BlockType::Test` in the tree — someone may already be building the test framework |

## Findings log

- 2026-07-13 · W0.E-G: first-ever end-to-end multi-module largo build exposed the missing
  half of the import feature — namespaced type references don't parse
  (ParseError ExpectedStatement at `::`). Registry side exists (merge_registry interns
  `Alias::Type`); lexer/parser/codegen side absent. Fix in flight upstream, RED-first.
- 2026-07-13 · R2 confirmed live: every largo project recompiles the runtime path-deps in
  its own target dir (toy ≈ minutes, root repeats it). G11 (incremental largo) evidence.
- 2026-07-13 · Test-file count at bun-v1.3.14 tag = 1,731 (vs 1,881 at dev 43ee038, vs
  ~1,941 in the doc) — ledger counts reality at pin.

## Deferred user decisions

- Distribution posture / public binary name (blocks shipping only).
- License clearance for gifts (blocks GIFT.4 only).
- GIFT.1 fork creation (needed before Wave 4 fuzz lanes file anything).
- drat-trim install (needed by Wave 6 R2).

## Gate log

(appended by gate.sh runs)
