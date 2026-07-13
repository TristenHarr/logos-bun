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
| 2 | Harness completion | **6/8 COMMITTED** (fcc9ffa+ede1bb5): W1.6 gate-audit, W2.1 fuzz, W2.2 bench, W2.3 drift, W2.5 mutation, W2.8 GIFT.3 — all green, gate 17 checks. REMAINING: W2.4 oracle-cache (low-value), PORT.1/2 (Wave-4 prep, not urgent), review-pairs on the 6 (owed per §2.5, non-blocking — gate+meta-lock enforce). W2.9 shim→.lg BLOCKED on sibling G13 |
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
| W1.6 | gate-audit meta-lock + gate-manifest (L9) + --wave mode | GREEN (isolated) | 20 planted violations each caught (floor=20); gap-hunted (specificity probes + B1 EISDIR); hermetic; --wave mode + gate-manifest.json. Committed fcc9ffa. REVIEW pending |
| W2.1 | P0.7 fuzz-driver + ddmin + regression bank (L13) | GREEN (isolated) | conformance/fuzz-driver.mjs + ddmin (proven terminating) + content-addressed bank + deterministic --replay; full loop proven (detect→minimize→bank→replay-red→fix→replay-green); l13 empty-guard. W1.6 gate-manifest fuzz guard satisfied. REVIEW pending |
| W2.2 | P0.8 bench runner + 3σ ratchet (L12), 4 metrics | GREEN (isolated) | bench/lib+run+verify+LEDGER.json; confirm-before-freeze + conservative win-lock proven; anti-deadlock (noise blip ≠ freeze) proven; chainDigest integrity seal; build-time baseline 115.9s. l12 wired. gate-manifest entry for W1.6: bench/LEDGER.json→"3σ verify (l12) wired". REVIEW pending |
| W2.3 | P0.9 drift-canary vs upstream HEAD | GREEN (isolated) | drift-canary.mjs (DRIFT=upstream∖baseline∖covered), non-gating (always exit 0), drift.tsv ≠ ledger shape; verified 1731 count vs SPEC_PIN; added ratchet_ledgers helper (excludes drift.tsv from l1/l4/l5 — CONSOLIDATION CHECK). REVIEW pending |
| W2.4 | P0.6 oracle artifact cache (sha-addressed) | QUEUED | formalize vendor-artifacts/ |
| W2.5 | P0.11 mutation scaffold (Stryker now; cargo-mutants→W4) | QUEUED | gate-manifest: shims/ needs mutants cfg |
| W2.8 | GIFT.3 gift review-gate wiring | GREEN (isolated) | preflight.mjs (mechanized vs [USER]-emitted split, never fakes user steps), reuses W1.7 via appendGiftRows (refuse-before-write), L18 distinct readiness check + empty-guard; classify seeds ledger. Fixed W2.5's broken gate-audit control; floor 20→21. REVIEW pending |
| PORT.1 | PORTING_RUST_TO_LOGOS.md (Rust→LOGOS idiom map) | **FROZEN 2026-07-13** (post-review; edits require an incident) | Doc-review closed by fixer: 5 accuracy citation fixes + completeness adds §5.3 Ordering (H1), §5.4 matches!/OR-patterns/ranges (M1/M2), §3 no-sort (H2) + labeled-break/no-Continue (H4), §10.5 concurrency (H3), §10.6 M3/M4/M5 fast-follow. Header line = FROZEN. |
| PORT.2 | SEMANTIC_TRAPS.tsv (trap classes + fuzz foci) | **FROZEN 2026-07-13** (post-review; edits require an incident) | Doc-review closed by fixer: TRAP-02/TRAP-12 citation fixes; TRAP-11/12/13 fuzz-focus relabeled AUDIT/differential-harness (not corpus fuzzers); +TRAP-18 Ordering (H1), +TRAP-19 labeled-break/no-Continue (H4), +TRAP-20 matches!/OR-pattern/range (M1/M2). Now 20 rows, all 7-col. Header line = FROZEN. |
| W2.9 | shim→.lg migration | **BLOCKED** | on G13 (sibling `## Test` stream) |

## ⚠️⚠️ ORACLE-LANGUAGE FINDING (PORT.1+PORT.2, 2026-07-13) — USER DECISION PENDING

vendor/bun @ bun-v1.3.14 (my pin) is **ZIG** (1290 .zig, 0 .rs) — the PRE-rewrite release.
The Rust rewrite (§0 thesis "Rust→LOGOS") is logicaffeine/bun @ 43ee038 = v1.4.0-dev, **1516
.rs, UNRELEASED** (only bun-v1.3.x tags exist, all Zig). My oracle choice (1.3.14 release
binary) was made before knowing 1.3.14 is Zig. CONSEQUENCES: conformance (Lane A/B/C, the
test-suite hijack — the CORE) works with EITHER (source+binary+tests are self-consistent at
1.3.14; PROVEN by the Lane-A smoke). But: PORT docs are Zig→LOGOS (both agents self-corrected
+ grounded in real .zig); §8 shims would link Zig-via-C-ABI not Rust-path-dep (Wave 4); §1.1's
"Rust toolkit 80K LOC" describes 1.4.0 not the pin. DECISION: stay Zig-1.3.14 (released,
consistent, proven, zero setup — but "Zig→LOGOS" not the stated thesis) VS re-pin to
Rust-1.4.0-43ee038 (matches thesis+§1.1+easy Rust shims — but must BUILD bun from source,
bootstrapped by the 1.3.14 binary we already have; heavy first build incl. WebKit). PORT docs
are DONE but Zig-grounded → if Rust chosen, they redo. Asked user 2026-07-13.

## ⚠️ TOOLCHAIN CHURN — logos-bun product builds BLOCKED (2026-07-13 05:57)

The sibling's **`cargo-mutants --in-place`** is running on the live logicaffeine tree — it
SPLICES mutants into source files, tests, reverts. So `scripts/build.sh` (which uses
LOGOS_WORKSPACE=live logicaffeine) is UNRELIABLE right now: a build may catch a spliced mutant
or a mid-revert state → the multimodule canary reds intermittently. **All logos-bun product-code
work (Wave 3 P1 skeleton, PORT.3 semver trial, Wave 4+) is BLOCKED until the sibling's
cargo-mutants + G13 reach a stable compiling checkpoint.** Node-based harness work (PORT docs,
reviews, W2.4) is UNAFFECTED. Options to unblock product code: (a) wait for mutants to finish;
(b) USER pauses the sibling; (c) build against pinned vendor/logicaffeine — but that lacks the
namespaced-types fix, so the canary would parse-fail instead → needs the logicaffeine commit +
pin bump FIRST. Recommended: do toolchain-independent work now; resume product code when the
tree is stable + the namespaced-types fix is committed + pin bumped.

## Coordination hazards (active)

- **gate.sh is a hot multi-writer file.** W1.1-fixer (B1 `_ledger_gate` rewrite + env-scrub +
  freeze-check), W1.7 (l17, done), W1.2 (L5), W1.3 (L4) all edit it. Edit is exact-match so a
  stale-view append FAILS loudly rather than clobbering — but a **consolidation pass is required
  at Wave-1 close**: verify L1–L17 all present, the main check sequence calls every l-fn, and
  the fixer's B1 `_ledger_gate` (fail-on-nonzero-exit) survived. Do NOT mark Wave 1 GREEN
  without re-reading gate.sh end to end.
- **Sibling session is ACTIVELY BUILDING G13** (confirmed 2026-07-13 05:25 via process+mtime
  recon): NEW files `apps/logicaffeine_cli/src/commands/test.rs` (the `largo test` command) +
  `crates/logicaffeine_compile/src/testrun.rs` (test execution) modified in the last hour, plus
  a running cargo-mutants campaign (25 rustc). So G13/tests-in-LOGOS is NOT ours to build — the
  sibling is doing it. **Do NOT build G13.** When the sibling reaches a compiling checkpoint,
  `largo test` + testrun.rs exist → W2.9 (shim→.lg migration) unblocks. **The E0063 mid-edit
  breaks the LIVE toolchain → multimodule canary RED under --full (TRANSIENT).** logos-bun
  harness cards are node-based, unaffected; --quick green. Wave-2 `--wave 2` close waits on the
  sibling toolchain compiling. Watch signal: `cargo check -p logicaffeine-cli` clean in the live
  tree (only when no sibling build is active — rule 11). The namespaced-types fix (W0.E-G) shares
  lexer.rs with this sibling — flag at user commit.

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

## Toolchain-gap G-tasks discovered by PORT doc-review (2026-07-13) — upstream logicaffeine

The PORT completeness review found the EARLIEST ports need LOGOS primitives that DON'T EXIST:
- **G-SORT**: LOGOS has no usable `sort` (QUICKGUIDE marks it proposed). P2 semver + the P4
  install resolver sort candidate versions. Either upstream a real sort primitive, or every
  port hand-writes selection sort. R7-STOP: blocks P2 semver.
- **G-CONCURRENCY**: bun's installer is ThreadPool+Batch+MiniEventLoop+atomics; LOGOS has only
  actor+CRDT-Shared, NO atomic-shared-counter analog (value-COW fights it). P4 install's
  pending_task_count/finished_installing pattern needs upstream LOGOS concurrency primitives.
  R7-STOP: blocks P4 install core. (Note: the deterministic runtime EXISTS —
  logicaffeine_runtime scheduler/channels — so this may be a surfacing/mapping task, not a
  from-scratch build. Investigate before carding.)
Both are pre-Wave-4/Wave-5 upstream work. Not blocking now (harness phase); flagged early so
the pin bump + G-tasks are sequenced before the ports that need them.

## Deferred user decisions

- Distribution posture / public binary name (blocks shipping only).
- License clearance for gifts (blocks GIFT.4 only).
- GIFT.1 fork creation (needed before Wave 4 fuzz lanes file anything).
- drat-trim install (needed by Wave 6 R2).

## Gate log

(appended by gate.sh runs)
