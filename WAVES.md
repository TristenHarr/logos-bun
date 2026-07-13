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
| 1 | Enforcement: P0.4, P0.2, P0.3, P0.5, P0.10, GIFT.2 (G2-early/G13/W1.6 gate-audit deferred → W2) | **✅ LOCKED** (2026-07-13T04:56Z) — Lane-A end-to-end chain PROVEN; all seams compose; assert-sink blocker fixed (parseAssertSink, verified nonzero); gate --full green. Enforcement layer live: L1-L8/L15-L17 + freeze. Artifacts: work/loops/W1-integration/ + W1.1/ |
| 2 | Harness completion: W1.6 gate-audit (meta-lock), P0.7 fuzz-driver, P0.8 bench 3σ, P0.9 drift-canary, P0.6 oracle-cache, P0.11 mutation, PORT.1/2, GIFT.3 | **IN PROGRESS**; W2.9 shim→.lg BLOCKED on G13/sibling |
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
| W1.1 | P0.4 ledger core + hash chain (KEYSTONE, serial) | **GREEN (fixed)** | 3 reviews → CHANGES-REQUIRED (3 BLOCKERs) → comprehensive fixer closed ALL 10: B1 gate reds on nonzero-exit not tag-sieve; B2 .merge-freeze consumed (l_freeze) + marker ban gates; B3 recent-window promotion; M1 priorState split (kills abs-self fixed-point + rel-GENESIS wipe); M2 .tsv.head ban + baseline enumeration; run-store verdict/ts validation; env-seam scrub; transition table for non-PASS rows; m4 all-zeros-sha ban; threat-model rewritten honest. Chain-helper exports UNCHANGED (W1.2/W1.7 safe). **Orchestrator consolidation: extended B1 fix to l4/l5 (same sieve bug in lane/assert lints).** Artifacts: work/loops/W1.1/review-{1,2,3-blast}.md + fixer report. Gate --full GREEN. |
| W1.2 | P0.2 runner fork + assert counts | GREEN (isolated) | runner.mjs (forked, exports sealRunStore via shared chain helper), 3-file toy + junit goldens, skip→fail (can't fake passes), L5 assert-parity in gate; runner→promote handshake proven. REVIEW pending |
| W1.3 | P0.3 patches + lane lint | GREEN (isolated) | 0001-bunexe-override + 0002-assert-counter (content-anchored), worktree.mjs (abs-path, vendor-pristine), lint-lanes (L4, over-inclusive). Empirically corrected harness line numbers + assert-counter seam. REVIEW pending |
| W1.4 | P0.5 comparators | GREEN | diffcli/normalize/treehash/exec-eq + goldens; verdict JSON carries normalizer audit trail; REVIEW pending |
| W1.5 | P0.10 workflow-ops | GREEN | commit.mjs (refusal codes 3/4/5/6), loop.mjs state machine, L8 lint live in gate; adversarial self-probe held; REVIEW pending |
| W1.6 | gate.sh v1 + gate-audit (serial, last) | QUEUED | integrates all |
| W1.7 | GIFT.2 gifts ledger | GREEN (isolated) | upstream-gifts.md/.tsv + gifts-lint (l17) + 3 templates grounded in real vendor/bun SECURITY.md/PR-template/CLAUDE.md; reused chain helper; security embargo scans ALL rows + pins y/n flag; 5 RED drivers ablation-verified. REVIEW pending. Foreign reds = W1.1 fixer + W1.2/W1.3 shims |
| W1.8 | G2-early subprocess+sha256 (logicaffeine) | QUEUED | hold: review verdicts + sibling-stream coordination |
| W1.9 | G13 largo test (logicaffeine) | QUEUED | **COORDINATE FIRST**: sibling stream has in-progress `BlockType::Test` in the tree — someone may already be building the test framework |

## Wave 2 tasks

| Card | Task | State | Note |
|---|---|---|---|
| W1.6 | gate-audit meta-lock + gate-manifest (L9) + --wave mode | IMPL | owns gate-manifest.json; VIOLATIONS_CAUGHT floor |
| W2.1 | P0.7 fuzz-driver + ddmin + regression bank (L13) | GREEN (isolated) | conformance/fuzz-driver.mjs + ddmin (proven terminating) + content-addressed bank + deterministic --replay; full loop proven (detect→minimize→bank→replay-red→fix→replay-green); l13 empty-guard. W1.6 gate-manifest fuzz guard satisfied. REVIEW pending |
| W2.2 | P0.8 bench runner + 3σ ratchet (L12), 4 metrics | GREEN (isolated) | bench/lib+run+verify+LEDGER.json; confirm-before-freeze + conservative win-lock proven; anti-deadlock (noise blip ≠ freeze) proven; chainDigest integrity seal; build-time baseline 115.9s. l12 wired. gate-manifest entry for W1.6: bench/LEDGER.json→"3σ verify (l12) wired". REVIEW pending |
| W2.3 | P0.9 drift-canary vs upstream HEAD | QUEUED | non-blocking lane; re-baseline ritual |
| W2.4 | P0.6 oracle artifact cache (sha-addressed) | QUEUED | formalize vendor-artifacts/ |
| W2.5 | P0.11 mutation scaffold (Stryker now; cargo-mutants→W4) | QUEUED | gate-manifest: shims/ needs mutants cfg |
| W2.8 | GIFT.3 gift review-gate wiring | QUEUED | pre-push lints; bun bd test steps = [USER] |
| PORT.1 | PORTING_RUST_TO_LOGOS.md (Rust→LOGOS idiom map) | QUEUED | adversarial doc-review before freeze |
| PORT.2 | SEMANTIC_TRAPS.tsv (trap classes + fuzz foci) | QUEUED | 1-based idx, WTF-16, value-vs-ref, depth |
| W2.9 | shim→.lg migration | **BLOCKED** | on G13 (sibling `## Test` stream) |

## Coordination hazards (active)

- **gate.sh is a hot multi-writer file.** W1.1-fixer (B1 `_ledger_gate` rewrite + env-scrub +
  freeze-check), W1.7 (l17, done), W1.2 (L5), W1.3 (L4) all edit it. Edit is exact-match so a
  stale-view append FAILS loudly rather than clobbering — but a **consolidation pass is required
  at Wave-1 close**: verify L1–L17 all present, the main check sequence calls every l-fn, and
  the fixer's B1 `_ledger_gate` (fail-on-nonzero-exit) survived. Do NOT mark Wave 1 GREEN
  without re-reading gate.sh end to end.
- **Sibling `## Test`-block stream in logicaffeine BLOCKS G13** (recon 2026-07-13): the sibling
  built the test LANGUAGE SURFACE (Stmt::TestDef/Expect/ExpectFail/ExpectOutput/Require AST +
  parse, whole pipeline) but NOT execution — interpreter TestDef is a no-op, no TestResult type.
  G13's own work (interpreter test execution + result sink) IS the sibling's territory →
  **G13 cannot launch in parallel** (STOP rule). Readiness signal = teach_lock + jones_fidelity
  green in logicaffeine. **tests-in-LOGOS (W2.9 shim→.lg migration) is gated on this.** USER
  coordination point: sequence the two streams; confirm if sibling scope includes `largo test`.
  The namespaced-types fix (W0.E-G) also shares lexer.rs with the sibling — flag at user commit.

## Durable spec-pin facts (empirically verified at bun-v1.3.14; the doc's numbers were stale)

- `test/harness.ts` `bunExe()` = lines **106-109** (doc said ~120); no env override → patch 0001.
- `test/bundler/expectBundled.ts` `BUN_EXE` = line **115** (doc said 147). Content-anchored.
- **Assert-counter seam**: `bun:test` `expect` is IMMUTABLE + directly imported → a harness-local
  `expect` wrapper counts ~zero (the obvious approach fails). Native per-file counter not
  exposed to JS at this pin. The ONE reachable seam = the matcher-object prototype
  (toBe/toContain writable:true) — wrap those; verified byte-matching bun's "N expect() calls".
  Sink env var = `BUN_ASSERT_COUNT_FILE` (NOT `BUN_ASSERT_SINK`). Flush via global afterAll.
- **W1.2↔W1.3 integration**: `preload.ts` strips env vars not in `bunEnv` → the runner MUST pass
  `BUN_EXE_OVERRIDE` through `bunEnv` (or run without preload's strip). Verify at review.
- worktree.mjs MUST use ABSOLUTE target paths — a relative target nests inside vendor/bun and
  dirties the oracle (L7). `--clean --all` + L7 24h sweep are the leak defenses; concurrent
  siblings share work/worktrees/ and can clean each other's scratch trees mid-run.

## Review plan (Wave-1 close, proportionate to §2.5 intent)

Keystone W1.1 got the full 3-review treatment (correct — it's THE foundation). For the 5 harness
infra cards (comparators/workflow-ops/runner/patches/gifts), each self-reported an adversarial
self-probe + flagged blind spots. Proportionate close: ONE cross-integration adversarial review
that (a) checks the cards COMPOSE (runner+patches BUN_EXE_OVERRIDE-through-bunEnv; ledger+runner+
gifts chain-helper reuse; gate.sh consolidation L1-L17), and (b) spot-attacks each card's flagged
blind spot — not 10 separate review agents (the duplicate-dispatch token waste makes that costly).

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
