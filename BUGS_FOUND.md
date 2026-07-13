# BUGS_FOUND — the logos-bun campaign bug diary (tweetable)

Append-only. Every confirmed bug — in **BUN** (upstream gold), the **LOGOS TOOLCHAIN**, or
**OURS** (caught by our own adversarial review) — gets an entry. BUN bugs also flow into the
formal `conformance/upstream-gifts.tsv` pipeline; security-class BUN findings are `EMBARGOED`
(no tweet until coordinated per BAKE_A_BUN §9.4 invariant 10). Each entry ends with a
ready-to-post `Tweet:` line.

Template:
```
### BUG-N · CATEGORY · YYYY-MM-DD · SEV(crash|correctness|gap|minor)
What / Where / Found-by / Status
Tweet: <=280 chars
```

---

### BUG-1 · TOOLCHAIN · 2026-07-13 · gap
**What:** LOGOS could intern a cross-module type as `Geometry::Point` but the lexer had no `::`
— so you literally could not *write* the name you could import. The import feature was missing
its other half. **Where:** logicaffeine lexer + codegen. **Found by:** the multi-module build
canary, on its very first fire. **Status:** fixed (lexer glue + `rust_type_ident` sanitizer).
**Tweet:** Day 1 of rewriting Bun in our own language: the very first multi-module build caught
that you could *import* a type across files but not *name* it — the compiler could think it but
not speak it. Our canary found it in the first hour. 🐛

### BUG-2 · OURS · 2026-07-13 · correctness
**What:** Our conformance gate — the thing that's supposed to make rule-breaking impossible —
was a *text-match sieve*: it only failed on three specific substrings, so a lint that crashed
or reported any *other* violation was silently credited as passing. The enforcer wasn't
enforcing. **Where:** `scripts/gate.sh` `_ledger_gate`. **Found by:** 3 independent adversarial
reviewers, each handed only the diff and told "assume it's wrong." **Status:** fixed (fail on
nonzero exit, not substring). **Tweet:** We built a gate to make cheating impossible. Then we
paid 3 reviewers to break it — and they did: it only checked for 3 magic words, so every *other*
kind of violation sailed through green. The enforcer wasn't enforcing. Always adversarially test
your guardrails. 🔒

### BUG-3 · OURS · 2026-07-13 · correctness
**What:** The *same* text-match-sieve bug survived in two sibling gate checks (lane + assert-
parity lints) after we fixed the main one. **Where:** `gate.sh` l4/l5. **Found by:** manual
consolidation grep. **Status:** fixed. **Tweet:** Fixed a bug in our gate. Then found the exact
same bug hiding in two more places nobody reviewed. Bugs travel in packs — grep for the pattern,
not the instance.

### BUG-4 · OURS · 2026-07-13 · correctness
**What:** The test runner read the assertion-count sink with `parseInt(wholeFile)` on a
`"/path/to/test\t4"` string → `NaN` → **0**, so every real test recorded "0 assertions executed"
— silently disarming the whole anti-skip mechanism on exactly the lane it exists to protect.
Two agents built the two halves; each tested its own side; only end-to-end composition exposed
it. **Where:** `conformance/runner.mjs`. **Found by:** cross-integration review. **Status:**
fixed (`parseAssertSink`). **Tweet:** Our anti-cheating check counted how many assertions each
test ran. Turns out it parsed the count wrong and recorded 0 for *every* real test. The
guardrail was green and doing nothing. Integration tests > unit tests for seams.

### BUG-5 · OURS · 2026-07-13 · gap
**What:** We pinned the wrong Bun. The `bun-v1.3.14` release we grabbed for the oracle is the
*pre-rewrite Zig* Bun (1290 .zig, 0 .rs); the Rust rewrite our whole thesis targets is the
unreleased 1.4.0-dev. Two independent doc agents discovered it while grounding citations.
**Where:** `SPEC_PIN.md` / oracle choice. **Found by:** the PORT-doc agents. **Status:** fixed
(re-baselining to the Rust source + a from-source 1.4.0 build). **Tweet:** Plot twist rewriting
Bun in our language: we grabbed the latest *released* Bun as our reference… and our own tooling
noticed it was still the old Zig codebase, not the Rust rewrite we're actually chasing. The
oracle was the wrong universe.

### BUG-6 · TOOLCHAIN · 2026-07-13 · gap
**What:** LOGOS has no usable `sort` (it's a "proposed" language feature). Bun's semver — the
first thing we port and the backbone of dependency resolution — *sorts candidate versions*.
**Where:** LOGOS stdlib. **Found by:** PORT completeness review reading the real semver crate.
**Status:** open (G-SORT task). **Tweet:** To rewrite Bun's package manager we need to sort
version numbers. Our language… can't sort yet. Sometimes "rewrite X in Y" really means "first
teach Y to do the boring thing everyone assumes exists." 😅

### BUG-7 · TOOLCHAIN · 2026-07-13 · gap
**What:** Bun's installer is a thread-pool + atomic-shared-counter engine
(`pending_tasks: AtomicU32`). LOGOS has actors + merge-based CRDTs but *no atomic shared
counter* — its value-semantic (copy-on-write) model actively fights the pattern. **Where:**
LOGOS runtime. **Found by:** PORT completeness review. **Status:** open (G-CONCURRENCY task).
**Tweet:** Bun installs packages with a pool of threads sharing an atomic counter. Our language
is built on copy-on-write value semantics — the exact opposite. Porting the installer means
bridging two philosophies of "shared state." This is the fun part.

### BUG-8 · OURS · 2026-07-13 · minor
**What:** The frozen PORT prep-docs would have stranded the first porters: they covered
error-handling/strings exhaustively but never mentioned 3-way comparison (`Ordering`),
`sort`'s absence, install concurrency, or labeled-break — the exact shapes semver/glob/install
open with. Also 5 citation line-drifts. **Where:** `PORTING_RUST_TO_LOGOS.md` /
`SEMANTIC_TRAPS.tsv`. **Found by:** the docs' own adversarial review round. **Status:** fixed
(H1–H4 + M1/M2 added; frozen). **Tweet:** We wrote the "how to port Bun's Rust to our language"
guide, then adversarially reviewed it *before* using it. Good thing — it forgot to explain how
to compare two things or loop with a label. Review your plans like you review your code.

### BUG-9 · TOOLCHAIN · 2026-07-13 · minor
**What:** Building Bun 1.4.0 from source demands **clang 21.1.x** exactly; the box shipped
clang 18.1.3, and the build refused to start. **Where:** Bun build prerequisites. **Found by:**
the oracle-build script's version gate. **Status:** fixed (installed clang-21/lld-21 from the
LLVM apt channel). **Tweet:** Before you can rewrite Bun you have to *build* Bun, and Bun wants
one exact clang version and nothing else. The bar to even reach the starting line is real.

### BUG-10 · OURS · 2026-07-13 · minor
**What:** Re-baselining the oracle from Bun 1.3.14 → 1.4.0 broke two of our own tests that had
the version hardcoded: the walking-binary stub printed `"1.3.14"`, and a diffcli self-test's
sed-wrapper corrupted the literal string `1.3.14` (which no longer appears, so it corrupted
nothing → the "detect a divergence" test detected none). **Where:** `src/main.lg`,
`red/p0/comparators/fixtures/diffcli/wrapped-sed.sh`. **Found by:** the gate, immediately after
the re-baseline. **Status:** fixed (stub → 1.4.0; sed made version-*agnostic* so it can never
be defanged by a future re-baseline). **Tweet:** Swapped our reference Bun from 1.3.14 to 1.4.0
and instantly two of our own tests turned red — both had the version number baked in. The lesson
that never gets old: hardcoded constants are future bugs with a delay timer. ⏲️

### BUG-11 · TOOLCHAIN · 2026-07-13 · correctness
**What:** In LOGOS at the pinned toolchain (v0.10.1), a `.lg` module whose title is followed by
a **link-less prose abstract paragraph** (e.g. "The bun toolkit, reborn in LOGOS.") fails to
parse — the abstract silently corrupts parsing of the `## Main` body that follows (garbage
`ExpectedStatement` deep in the code). An abstract *with* markdown import-links parses fine;
title-only parses fine; only pure prose breaks it. The newer (unreleased) tree had already
fixed this. **Where:** logicaffeine parser / `scan_dependencies` abstract handling. **Found by:**
building the first real port code (the CLI stub) against the pinned toolchain. **Status:** open
(worked around: title-only stub; a toolchain fix is a candidate G-task). **Tweet:** Found a
compiler bug in our own language the moment we built the first real file of the Bun port: a
plain-English description paragraph at the top of a file silently corrupted parsing of the code
*below* it. The docs literally can't hurt the code — except here they could. 🙃

### BUG-12 · BUN · 2026-07-13 · correctness  ⭐ FIRST BUN BUG
**What:** Bun's `semver.satisfies` silently DROPS a trailing exact-version comparator in a
space-separated (AND) range that begins with an inequality. `Bun.semver.satisfies("2.0.0",
">1.0.0 3.0.0")` returns **true** — and so does every version >1.0.0 (1.5.0, 2.9.9, 4.0.0, …).
The range `>1.0.0 3.0.0` means ">1.0.0 AND =3.0.0", whose intersection is exactly {3.0.0}; only
3.0.0 should satisfy it. Bun evaluates only the leading `>1.0.0` and ignores the `3.0.0`.
Controls: exact-version-*first* (`3.0.0 >1.0.0`) evaluates correctly, so it's specifically the
*trailing* exact conjunct that's lost; `>1.0.0 <5.0.0 3.0.0` also drops the `3.0.0`.
**Where:** bun `src/semver/SemverRange.rs` — a range is modeled as a two-comparator `{left,right}`
pair, which can't represent "inequality AND exact" and drops the exact. Reproduced on the
from-source-built Rust bun 1.4.0-canary.1+43ee03834. **Found by:** differential fuzzing bun's
`Bun.semver` vs node-semver (the reference implementation) — 10k structure-aware pairs, 80
valid-input disagreements, all one root cause. **Impact:** real — a package.json range like
`>=1.0.0 2.3.4` (floor + pin) would let bun accept ANY version ≥1.0.0, a dependency-resolution
correctness hole. **Status:** open → gift pipeline (conformance/upstream-gifts.tsv G-1); NOT
security (public/tweetable); upstream duplicate-search + filing are USER-driven (§9.4 inv 11/20).
**Tweet:** First real Bun bug found while rewriting it in our language 🎯 — its semver thinks
version 2.0.0 satisfies the range ">1.0.0 3.0.0". That range means "greater than 1.0.0 AND
exactly 3.0.0" — only 3.0.0 should match. Bun silently ignores the "3.0.0" and matches
everything above 1.0.0. Differential testing against a reference impl catches what single-impl
fuzzing can't.

---

_Live count: 12 (⭐ 1 BUN, 4 toolchain, 7 ours). Found by running our port head-to-head against
real Bun — the differential-fuzz gold starts here. Fuzz lane: fuzz/semver/._
