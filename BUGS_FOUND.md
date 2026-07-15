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

### BUG-13 · BUN · 2026-07-13 · correctness
**What:** Bun's TOML parser doesn't decode the 8-digit `\UXXXXXXXX` unicode escape. `Bun.TOML.parse('x = "\U0001F600"').x` returns the literal string `"U0001F600"` (backslash dropped, `U`+digits left as text) instead of 😀; `"\U00000041"` returns `"U00000041"` instead of `"A"`. The 4-digit `\uXXXX` escape works fine — only the uppercase 8-digit `\U` (a required TOML 1.0 feature) is broken. **Where:** `src/parsers/toml/lexer.rs:849` `decode_escape_sequences` — the escape set is JS/C-style (it even has `\v` + octal, which TOML doesn't define) and omits the TOML `\U` case. **Found by:** differential fuzz Bun.TOML vs @iarna/toml (2000 docs → 175 value-mismatches; minimized + spec-verified). **Impact:** any TOML string with a `\U` astral-plane escape parses to garbage — silent data corruption in configs/lockfiles. **Status:** open → gift pipeline (G-2); public/tweetable; upstream filing USER-driven. **Tweet:** Bun bug #2, found the same day as #1 🎯 — its TOML parser handles `é` (4-digit unicode escape) but not `\U0001F600` (8-digit, for emoji & astral chars, required by the TOML spec). It just leaves the text as literal "U0001F600". Your emoji in a config file silently become gibberish.

### BUG-14 · BUN · 2026-07-13 · correctness
**What:** In a TOML multiline basic string, a line-ending backslash should trim the newline AND all leading whitespace of the next line (TOML 1.0: "trimmed along with all whitespace up to the next non-whitespace character"). Bun trims only the newline, keeping the indentation: `Bun.TOML.parse('x = """a\\<newline>    b"""').x` returns `"a    b"` instead of `"ab"`. (With no indent on the continuation line, bun is correct — so it's specifically the leading-whitespace trim that's missing.) **Where:** `src/parsers/toml/lexer.rs:849` `decode_escape_sequences<ALLOW_MULTILINE>` — the line-continuation branch eats the newline but not the following spaces. **Found by:** the same TOML differential fuzz; minimized + spec-verified vs @iarna/toml. **Impact:** every indented multiline string with line continuations gets spurious spaces — corrupts embedded scripts/text in TOML configs. **Status:** open → gift pipeline (G-3); public/tweetable; upstream filing USER-driven. **Tweet:** Bun TOML bug #3: multiline strings with a line-ending "\" are supposed to swallow the newline AND the next line's indentation. Bun keeps the indentation. Your neatly-indented multiline config value comes out full of spaces you didn't write. Differential testing against the spec finds these in minutes.

### BUG-15 · BUN · 2026-07-13 · correctness
**What:** Bun's TOML parser mishandles the spec's special float values. `Bun.TOML.parse("a = inf").a`
returns the STRING `"inf"` (should be the float `Infinity`); `"a = nan"` returns `"nan"` (should be
`NaN`); and `"a = +inf"` / `"a = -inf"` are outright REJECTED (`Expected t_numeric_literal but found
inf`) even though signed infinities are valid TOML 1.0. **Where:** bun `src/parsers/toml/lexer.rs`
(the numeric-literal path doesn't recognize inf/nan; the bareword falls through to a string).
**Found by:** TOML differential fuzz (Bun.TOML vs @iarna/toml) once float generation was added;
minimized + spec-verified. **Impact:** any TOML using `inf`/`nan` (thresholds, sentinels) silently
becomes a string or fails to parse. **Status:** open → gift pipeline (G-4); public/tweetable.
**Tweet:** Bun TOML bug: `x = inf` should give you the float Infinity (it's in the TOML spec).
Bun gives you the *string* "inf". And `x = -inf` doesn't parse at all. Special float values —
inf, nan, and their signs — are broken.

### BUG-16 · BUN · 2026-07-13 · correctness  ⭐ significant
**What:** **Bun's `Bun.TOML.parse` has NO support for TOML date/time types** — a core category of
the TOML 1.0 spec. All four are rejected with parse errors: `a = 1979-05-27` (local date) →
`Expected key but found -`; `a = 07:32:00` (local time) → `Expected key but found :`;
`a = 1979-05-27T07:32:00Z` (offset datetime) and local datetime → rejected. Bun lexes `1979` as a
number, then chokes on the `-`. @iarna (and every conformant parser) returns Date values.
**Where:** bun `src/parsers/toml/lexer.rs` — no date/time literal recognition in the number path.
**Found by:** the same TOML fuzz (dates added to the generator → 663/3000 valid docs rejected, all
date-containing). **Impact:** major — you cannot parse ANY real-world TOML containing a timestamp
(extremely common in configs/manifests) with Bun.TOML; it throws. **Status:** open → gift pipeline
(G-5); public/tweetable. **Tweet:** Bigger Bun TOML find: it can't parse dates. At all. `x =
2024-01-01` — a plain TOML date, in the spec since day one — throws a parse error. Bun reads the
year as a number and trips over the dash. Any config with a timestamp is unparseable by Bun.TOML.

---

### BUG-17 · TOOLCHAIN · 2026-07-13 · gap
**What:** LOGOS has no user-facing way to set the process exit code — no `Exit`/`exit(code)`
statement or builtin in the language surface (the only `process::exit` is internal, for the
resident-server loop). Every `.lg` program exits 0. **Where:** logicaffeine language surface
(no Exit token/stmt/builtin). **Found by:** attempting to make the logos-bun CLI match bun's
exit codes (bun: 0 success, 1 script-not-found, etc.). **Status:** open → G-task (CLI I/O
primitives); blocks P1 exit-code conformance. **Tweet:** To rebuild Bun's CLI in our language
we need to... set the exit code. `exit(1)`. Our language can't do that yet — every program
exits 0. Rebuilding a real command-line tool keeps surfacing the boring-but-essential
primitives you never think about until you're missing one.

### BUG-18 · TOOLCHAIN · 2026-07-13 · gap
**What:** LOGOS has no stderr output — `Show` writes stdout, and there's no stderr/eprint
builtin. bun (like every CLI) writes errors to stderr; a faithful port can't. **Where:**
logicaffeine builtins/language surface. **Found by:** the same CLI-conformance attempt (bun's
`error: Script not found "x"` goes to stderr). **Status:** open → same G-task. **Tweet:** Second
missing CLI primitive found rebuilding Bun: our language can only print to stdout. Every real
program sends errors to stderr so they don't corrupt piped output. Another "obvious" thing a
language needs before it can host a serious tool.

---

### BUG-19 · BUN · 2026-07-13 · correctness (leniency)
**What:** Bun's TOML parser accepts a **duplicate table definition**, which TOML 1.0 forbids
("You cannot define any table more than once. Doing so is invalid."). `Bun.TOML.parse("[t]\nx =
1\n[t]\ny = 2")` silently merges to `{"t":{"x":1,"y":2}}` instead of erroring; @iarna (and every
conformant parser) rejects it. **Where:** bun TOML parser (`src/parsers/toml.rs` — no
already-defined-table check). **Found by:** TOML error-path conformance probe (spec-required
rejections). **Impact:** a typo'd or merge-conflicted duplicate `[section]` in a config is
silently accepted instead of flagged — masks real mistakes. Lower severity than the
value-corruption TOML bugs (accepts-invalid vs wrong-value). **Status:** open → gift pipeline
(G-6); public/tweetable. **Tweet:** Bun TOML bug #5: it lets you define the same `[table]`
twice. The spec says that's a hard error (probably a copy-paste mistake!). Bun just silently
merges them, so your duplicated config section passes without a peep.

---

### BUG-20 · TOOLCHAIN · 2026-07-13 · gap (FIXED)
**What:** LOGOS had **no string-splitting builtin** — only `parseInt`/`parseFloat`/`chr` and
char indexing existed, so no parser could turn `"1.2.3"` into its parts. Every real component
port (semver, url, ini, path) is a parser and dead-in-the-water without `split`. **Where:**
`logicaffeine_system` had no `text::split`; `map_native_function` had no mapping. **Found by:**
starting the semver port (P2.1) — the first line of `parseVersion` needed it. **Status:**
**FIXED** (toolchain b9f9928): `split(s, sep) -> Seq of Text` (LogosSeq, Rust `str::split`
semantics — empty sep → whole string, trailing sep → trailing empty piece); verified end-to-end
parsing a version string. **Tweet:** Porting a parser to a language with no `split()` is a
speedrun into a wall. Added it to LOGOS as a native builtin — `split("1.2.3", ".")` → the pieces
— and the semver port could finally start. (n/a — our toolchain, not a bun bug.)

### BUG-21 · TOOLCHAIN · 2026-07-13 · gap (FIXED)
**What:** LOGOS **rejected `Less`/`Greater` (and any comparative/superlative word) as an enum
variant / identifier name.** The lexer eagerly maps them to comparison-operator tokens
(`Less` → `Comparative("Little")`, discarding the surface form), so the discovery pass silently
skipped them (unregistered variant) and `expect_identifier` errored on `a new Less` / `When Less`
with "I expected a name here". This blocked the natural `Ordering` enum — `Less`/`Equal`/`Greater`,
the three-way result every `compare()`, sort, and JS `<`/`>` returns. Violates the project's
identifier-freedom mandate (no keyword should block an identifier position). **Where:**
`analysis/discovery.rs::consume_noun_or_proper` + `parser/mod.rs::expect_identifier`. **Found by:**
the semver port — writing `Ordering` with the idiomatic Rust variant names. **Status:** **FIXED**
(toolchain 6e36198): freed `Comparative`/`Superlative` at both identifier surfaces, keyed on the
raw lexeme ("Less", not the lemma) so declaration/constructor/pattern agree; NL comparative
parsing (`is less than`) untouched. Locked by `e2e_enum_comparison_word_variants`; 173
enum/inspect/degree tests green. **Tweet:** Tried to name an enum variant `Less` in LOGOS and got
"I expected a name here" — the word was reserved for `<`. Fixed it: comparison words are now free
to be identifiers too, so `Ordering` = `Less | Equal | Greater` just works. (n/a — our toolchain.)

---

### BUG-22 · TOOLCHAIN · 2026-07-13 · gap (FIXED)
**What:** LOGOS parsed the strict worded inequalities (`is greater than` → `>`, `is less than` →
`<`) and the terse `is at least`/`is at most`, but **not the natural inclusive phrasing** `is
greater than or equal to` / `is less than or equal to`. `greater than` consumed only through
`than`, so the trailing `or equal to` was left for the right-operand parse to choke on
(`ExpectedExpression`). **Where:** `parser/mod.rs::parse_condition`. **Found by:** the semver
port — `if length of parts is greater than or equal to n`. **Status:** **FIXED** (toolchain
9763a91): an optional `or equal to` tail after `than` promotes `Gt→GtEq` / `Lt→LtEq`; bare
`than` stays strict; a real trailing boolean `or` (after the operand) still parses. Locked by
`e2e_worded_{greater,less}_than_or_equal_to`. **Tweet:** LOGOS knew "is greater than" and "is at
least" but tripped on the phrasing everyone actually writes — "is greater than or equal to."
Fixed: the full English `>=`/`<=` now parse, strict-vs-inclusive kept exact. (n/a — our toolchain.)

### BUG-23 · TOOLCHAIN · 2026-07-13 · gap (FIXED)
**What:** LOGOS recognized bare `is not X` (`!=`) and `is equal to X` (`==`) but **not their
composition** `is not equal to X`, nor the negated inequalities `is not greater/less than X`.
`is not equal to b` parsed `is not` → `!=` then choked on `equal to b` (`ExpectedKeyword ":"`).
**Where:** `parser/mod.rs::parse_condition` (the `not` branch). **Found by:** the semver port —
`if majorA is not equal to majorB`. **Status:** **FIXED** (toolchain e425b28): `not` now composes
with the following inequality — `not equal to`→`!=`, `not greater than [or equal to]`→`<=`/`<`,
`not less than [or equal to]`→`>=`/`>`; bare `is not X` unchanged. Locked by
`e2e_worded_not_{equal_to,greater_than,less_than}`. **Tweet:** "is not equal to" — the most
natural way to say `!=` — didn't parse in LOGOS (only the terse "is not"). Fixed, and the whole
negated-inequality family came with it: "not greater than" = `<=`, and so on. (n/a — our toolchain.)

### BUG-24 · TOOLCHAIN · 2026-07-13 · gap (OPEN)
**What:** **Cross-module FUNCTION calls don't resolve.** A `[Link](file:./mod.lg)` import shares
the module's *types* (`Module::Type` constructors work, per the multimodule canary), but calling
a function defined in an imported module fails both ways: `Module::fn(...)` → codegen "cannot find
type Module", and unprefixed `fn(...)` → "cannot find function". So a leaf util written as its own
`.lg` module can't be called from `main.lg`. **Where:** module loader / codegen namespace wiring
(`logicaffeine_compile` loader + discovery). **Found by:** the semver port — tried `src/semver.lg`
+ `Semver::compareVersions`. **Workaround:** inlined semver into `src/main.lg` (self-contained,
tested, differential-verified). **Status:** open — the toolchain fix (splice imported-module
functions into the callable namespace, or wire `Module::fn` codegen) is the next module-system
increment; also note BUG-11 (link-less / multi-line prose abstracts parsed as code) recurred and
still forces canary-shaped or title-only headers. **Tweet:** (n/a — our toolchain; blocks clean
module separation, worked around by inlining.)

---

### BUG-25 · TOOLCHAIN · 2026-07-14 · gap (FIXED)
**What:** semver prerelease ordering (SemVer §11) needed three string primitives LOGOS lacked:
`substringAfter(s, sep)` (the tail past the FIRST delimiter — prerelease extraction, correct even
when the tail recurses the delimiter), `compareText(a, b)` (lexicographic byte compare → -1/0/1,
the alphanumeric-identifier rule), and `isDigits(s)` (numeric-identifier test). **Where:**
`logicaffeine_system::text` + `map_native_function`. **Found by:** the semver prerelease-ordering
increment. **Status:** **FIXED** (toolchain af97110) — locked by a new `text::tests` module.
**Tweet:** Semver's prerelease rules (`1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta`) need a real
string toolkit. Added `substringAfter`/`compareText`/`isDigits` to LOGOS as native builtins — the
parser's bread and butter. (n/a — our toolchain.)

### BUG-26 · TOOLCHAIN · 2026-07-14 · gap (FIXED)
**What:** semver range/`satisfies` parsing needed two more primitives: `startsWith(s, prefix)`
(the comparator-operator sniff — `^ ~ >= <= > < =`) and `toText(n)` (Int→decimal, inverse of
`parseInt`, to rebuild a version bound like `^1.2.3`'s `<2.0.0` upper). **Where:**
`logicaffeine_system::text` + `map_native_function`. **Found by:** the `satisfies` increment.
**Status:** **FIXED** (toolchain 08e6c04) — locked by `text::tests`. **Tweet:** (n/a — toolchain.)

### BUG-12 · BUN · GENERALIZED + OUR PORT IS CORRECT (2026-07-14)  ⭐⭐
**Update — bigger than first thought.** Now that our LOGOS satisfies matches node-semver over
~30k pairs, we turned the fuzzer AROUND on bun (`fuzz/semver/bun-hunt.mjs`: Bun.semver.satisfies vs
node-semver over valid pairs). Result: **~8.5% of realistic multi-conjunct ranges disagree** (≈510
/ 6000 per seed, stable across seeds) — one root cause. Bun's range is a two-comparator `{left,
right}` model, so it **drops ANY bare exact-version conjunct that doesn't fit** — not just the
trailing one. Confirmed classes (bun=true, node+ours=false): `>1.13.1 3.2.12`, `<6.17.8 4.12.3`,
`>=2.4.5 4.2.1`, `2.0.0 3.7.2` (two bare exacts → 2nd dropped), `<=5.1.13 4.2.1 >3.16.3` (exact in
the MIDDLE of 3), `>=7.19.19 8.0.17 <9.9.4`. Our LOGOS port returns the correct `false` on ALL of
them (three-way verified: ours = node-semver ≠ bun). **The reimplementation is materially more
correct than the original — a real dependency-resolution soundness bug in bun.** Pinned in
`fuzz/semver/satisfies-diff.mjs` (BUG-12 lock) + the standing hunt lane `bun-hunt.mjs`.
**Tweet:** Rewrote bun's semver in a natural-language language, then pointed the fuzzer back at
bun: it fails ~8.5% of realistic ranges. `satisfies("2.0.0", "2.0.0 3.7.2")` → bun says TRUE (it
just... drops the `3.7.2`). Any `>=X Y` floor+pin range is unsound. Our rewrite + node-semver agree: false.

### BUG-27 · OURS · 2026-07-14 · correctness (FIXED, caught by our own fuzz)
**What:** our `satisfies` had a `range == "*"` / `range == ""` fast-path returning true
unconditionally — but under SemVer §11, a PRERELEASE version does not satisfy `*` (which desugars
to `>=0.0.0`, a comparator with no prerelease at the version's tuple). So `satisfies("1.2.3-alpha",
"*")` wrongly returned true. **Where:** `src/main.lg` `satisfies` shortcut. **Found by:**
fuzz/semver/satisfies-diff.mjs the moment prerelease versions entered the corpus — differential
fuzzing earning its keep. **Status:** **FIXED** (commit below) — removed the shortcuts so `*`/`""`
flow through `testSet`, which applies the special rule (`testSet` already handled it correctly).
**Tweet:** Fuzzing our own semver rewrite against node-semver caught a bug the moment we added
prereleases: `1.2.3-alpha` should NOT match `*`. Differential fuzzing is the gift that keeps giving.

### BUG-28 · BUN · 2026-07-14 · finding (non-determinism — rescopes "byte-exact --help")
**What:** `bun --help` (and no-args) is **non-deterministic** — it randomizes the EXAMPLE package
/binary names on each run (`bun x prettier` one run, `bun x vite` the next; `bun add hono` /
`bun add react` / `bun add @zarfjs/zarf`). Two runs in different seconds differ; same-second runs
match, so it's a wall-clock-seeded random pick from a bundled package list. **Impact on the port:**
a "byte-exact --help" conformance target is **impossible by design** — the oracle's own output
isn't stable, so no reimplementation could match it byte-for-byte. P1 conformance is therefore
scoped to the DETERMINISTIC surface (version flags byte-exact, unknown-command byte-exact, subcommand
NOTIMPL→stderr+exit1, help-banner structural match) — all green in `red/p1/cli-surface.test.mjs`.
**Where:** bun help renderer (random example selection). **Found by:** capturing `--help` for a
golden and seeing it change between captures. **Tweet:** TIL `bun --help` is non-deterministic — it
rolls random example package names every run (`bun add react` vs `bun add hono`). Cute, but it means
you literally cannot snapshot-test bun's help output. Found this while rebuilding bun's CLI in LOGOS.

---

_Live count: 28 (⭐⭐×1 [BUG-12 generalized] + ⭐×6 BUN [semver + 5 TOML] + 1 finding [--help
non-determinism], 13 toolchain [**8 FIXED**; BUG-11 is module-path-only — single-file prose
abstracts WORK], 8 ours [all fixed]). P1 CLI conformance COMPLETE for the deterministic surface
(31-command dispatch + NOTIMPL→stderr+exit1 + byte-exact version/unknown-command; byte-exact --help
is impossible per BUG-28). bun's JSON parser fuzzed CLEAN (4000 edge cases, 0 diffs — spec-correct).
bun's TOML parser: 5 bugs (\U escape, multiline-ws, inf/nan, no-dates, duplicate-table); bun's
semver `satisfies` drops trailing exact conjuncts (BUG-12). Fuzz lanes: fuzz/semver/ (port-diff +
satisfies-diff + diff), fuzz/toml/, fuzz/json/ (clean), fuzz/stringwidth/ (ruled out). **P2.1
SEMVER — COMPLETE: compareVersions (full SemVer §11) + satisfies (FULL node-semver RANGE parity)
PORTED + GREEN:** in `src/main.lg` via `bun __semver-compare` / `__semver-satisfies`,
differential-verified vs node-semver — **compare ~17k pairs / satisfies ~30k pairs (^ ~ >= <= > < =,
exact, `*`, partial x-ranges `1.x`/`1.2.x`/`^1.x`/`~1.x`/`>=1.x`, AND, OR `||`, hyphen ranges, AND
the prerelease-version-in-range special rule), 0 diffs**, incl. the full §11 prerelease chain AND
the BUG-12 lock (we're correct where bun is wrong). Toolchain fixes this campaign: exitWith/eputs
(592ec80), split (b9f9928), comparative-identifiers (6e36198), worded `>=`/`<=` (9763a91), worded
negations (e425b28), substringAfter/compareText/isDigits (af97110), startsWith/toText (08e6c04).
The version RESOLVER (`maxSatisfying`/`minSatisfying`) is ALSO ported + green: a single-pass
fold over `satisfies` (recursion-threaded to dodge loop-var shadowing) — so it needs NO sort
(G-SORT is NOT on the semver critical path after all). Differential-verified vs node-semver:
2500 candidate lists × (max+min) across 5 seeds, 0 diffs (fuzz/semver/resolve-diff.mjs), incl.
prerelease-exclusion (`1.0.0-alpha` not picked for `^1.0.0`). **The whole semver module bun's
installer needs — compare, satisfies, maxSatisfying, minSatisfying — is now LOGOS-native and
node-semver-faithful.** **P2.2 GLOB (full fnmatch core) STARTED + GREEN:** a segment-level
`glob(pat, text)` matcher — `*` (any run), `?` (one char), `[...]` char classes (ranges `a-z`,
negation `[!..]`/`[^..]`, combined), literals — recursive backtracking, PURE LOGOS (no new natives;
just char-indexing + `compareText` + recursion). Exposed via `bun __glob`; differential-fuzzed vs
minimatch (`{dot:true}`, fs-special `.`/`..`/empty segments excluded — those are minimatch's
filesystem rules, not fnmatch): **~17.5k pairs across 12 seeds, ~55% match, 0 diffs**
(fuzz/glob/match-diff.mjs). **GLOBSTAR `**` + `/`-aware multi-segment matching ALSO DONE + GREEN**
(`globPath` via `matchSegs`, `bun __glob-path`): `**` matches zero-or-more path segments (a middle
`**` may match zero; a TRAILING `**` requires ≥1 — the fuzz caught that exact rule, `a/**` matches
`a/b` not `a`), non-`**` segments match one via the single-segment core, `*` never crosses `/`.
~7.3k pairs across 6 seeds vs minimatch, 0 diffs (fuzz/glob/path-diff.mjs). The full practical glob
grammar (`* ? [...] **`) is LOGOS-native; only brace expansion `{a,b}` remains. **P1.3 BUNFIG TOML
(value extractor) STARTED + GREEN:** a pure-`.lg` `tomlGet(doc, dottedKey)` — top-level + `[table]`
+ `[a.b]` nested sections, string/int/bool values, table-scoped dotted-key lookup (recursion-
threaded table state) — PURE LOGOS (startsWith/substringAfter/split/chr, no new natives). Exposed
via `bun __toml-get`; differential-fuzzed vs @iarna/toml (the same reference that found bun's 5 TOML
bugs): **~49k lookups across 10 seeds, 0 diffs** (fuzz/toml/get-diff.mjs), now with REAL-WORLD
FORMATTING — arbitrary indentation, any spacing around `=`, full-line + inline `#` comments, blank
lines (on 2 new natives: `trim`/`substringBefore`, c57e2b1). Correctly scopes keys to their table
(`port` under `[install.cache]` ≠ top-level). Subset: arrays/inline-tables/floats deferred._

### BUG-29 · TOOLCHAIN · 2026-07-14 · gap (worked around)
**What:** LOGOS's `+` string-concat codegen mis-lowers a NESTED concat inside a **tail-call
argument**: the TCE (tail-call-elimination) arg path wraps only the outermost `+` in `format!`,
leaving an inner `String + String` (two variables) as raw Rust `a + b` — which doesn't compile
(`E0308`, Rust needs `String + &str`). A single `+`, or a concat anchored by a string literal,
lowers fine; only nested variable-to-variable concat in a tail-recursive call breaks. **Where:**
`logicaffeine_compile::codegen::tce` (arg materialization uses `codegen_expr_with_async` without
the string-concat flattening the normal path's `collect_string_concat_operands` does). **Found
by:** base64Encode (a tail-recursive accumulator building 4-char groups). **Status:** worked
around with a `concat(a,b)` native (a call sidesteps the `+` codegen); proper fix = thread the
string-aware codegen into the TCE arg path (high blast radius — all tail-recursive fns — so
deferred to a focused unit). **Tweet:** (n/a — our toolchain.)

### BUG-30 · TOOLCHAIN · 2026-07-14 · gap (FIXED)
**What:** base64 (and any byte/bit work) needs `ord` (char→code, inverse of `chr`) — LOGOS had
`chr` but no inverse. **Where:** `logicaffeine_system::text`. **Found by:** the base64 port.
**Status:** **FIXED** (toolchain baf0905): `ord(s)` (Unicode scalar of first char, -1 for empty;
byte value for ASCII) + `concat` (BUG-29 workaround). **Tweet:** (n/a — toolchain.)

### BUG-31 · TOOLCHAIN · 2026-07-14 · gap (FIXED)
**What:** `before` cannot be used as a variable name — `Let before be f(x).` fails to parse
(`ParseError { ExpectedIdentifier }` **at `before`**), while the byte-identical `Let a be f(x).`
compiles. Isolated by a controlled A/B (two functions differing only in the bound name): the
temporal preposition `before` (and, by the same mechanism, `after`/`during`/`until`/`since`) is a
reserved English function-word that the imperative `Let`/argument surface never freed — even though
the identifier-freedom pass already frees 30+ other keywords there. The failure MISREPORTS as a
`.`-in-string or keyword-in-string bug because the parser, having choked on the reserved word,
resyncs on the next sentence-ish boundary (a later `" . length"` string), so the reported span
walks forward function by function. **Where:** `logicaffeine_language` parser identifier surfaces
(the `expect_identifier`/`Let`-binding + call-argument arms the identifier-freedom battery covers).
**Found by:** porting the jsint object machinery (`resolveObjDot`'s `before`/`afterDot` locals) —
and it had ALSO silently broken a pre-existing, never-committed `resolveProps` (`.length` support)
that used `before`, which had therefore never compiled. **Status:** **FIXED** (toolchain 4e7c9e6):
freed `TokenType::Before`/`::After` at BOTH imperative identifier surfaces — the binding arm
(`expect_identifier`) and the expression-atom arm (`parse_primary_expr_inner`) — beside the
prepositions/particles already freed there; both are only reached where an identifier is required
(binding arm is Imperative-mode-guarded), so declarative "Before X, Y" clauses keep precedence.
Locked by two `parser::tests` (one frees `before`, one guards `if` still errors); regression clean
(language lib 227/227, temporal NL 32/32, e2e `before`+`after` program computes correctly). The
bun-side locals stay renamed (clean names). **Tweet:** Rewriting Bun's JS engine in our own
English language, a variable named `before` wouldn't parse — the word is a reserved preposition our
identifier-freedom pass had missed. The compiler thought I was starting a subordinate clause. Human
languages make *great* programming languages and *hilarious* footguns. 🐛

### BUG-33 · TOOLCHAIN · 2026-07-15 · gap (worked around)
**What:** Adding a SECOND call site to a self-recursive function that takes a `Seq of Text`
parameter breaks the codegen's argument-passing inference: the emitted Rust types the recursive
self-calls' `tokens.clone()` as `&[String]` while the function signature expects
`LogosSeq<String>` (`E0308`). One call site infers owned-Seq passing correctly; a second call site
flips the inference and the recursion no longer type-checks. **Where:** `logicaffeine_compile` codegen
(Seq parameter passing / clone lowering). **Found by:** teaching `jsEval` unary minus — adding a
`jsEvalAdd(tokens, 1, …)` branch beside the existing `jsEvalAdd(tokens, 2, …)` call broke
`jsEvalAdd`'s own recursion codegen. **Status:** worked around (kept `jsEvalAdd` at ONE call site
via a `jsEvalNorm` wrapper; the leading-sign case prepends `"0 "` and routes through the same
wrapper); proper fix = make Seq-parameter passing inference call-site-count-independent (toolchain).
**Tweet:** (n/a — our toolchain.)

### BUG-32 · OURS · 2026-07-14 · gap (known limitation, scoped)
**What:** jsint's statement splitter (`splitTop`) treats only a top-level `;` as a statement
boundary — a block-closing `}` is NOT one. So JS that ends a statement with a block and starts the
next without a semicolon (`if(c){...}return x`) is mis-read as a single statement (`execIf`
consumes the `if`, silently drops the trailing `return x`). The whole existing test corpus already
writes the semicolon (`if(c){...};return x`), so this had never surfaced until the function-
expression fuzzer generated the bare form. **Where:** `splitTop` / `runBlockStr` in
`src/main.lg`. **Found by:** the funcexpr fuzzer (`if(n>t){return 100}return 0`). **Status:** scoped
around (the fuzzer + corpus use the explicit `;`); proper fix = make a top-level `}` that closes a
control-flow block a statement boundary — which needs disambiguating a *block* `}` from an *object-
literal* `}` (the classic JS statement/expression brace ambiguity), a dedicated increment. **Tweet:**
(n/a — our engine, a scoped interpreter limitation.)

---

**P2 LEAF — BASE64 (RFC 4648 encode) PORTED + GREEN:** `base64Encode` in pure LOGOS — the
3-byte→4-char bit-arithmetic done with integer `//` and `%` (no bitwise needed), all three padding
cases, recursion-threaded accumulator built via `concat`. Exposed via `bun __base64`;
differential-fuzzed vs Node `Buffer.toString('base64')`: **~8k strings across 4 seeds, 0 diffs.
base64 DECODE also done (`b64Index` char→6-bit via range arithmetic, `base64Decode`, `bun
__base64-decode`): encode matches Node + decode ROUND-TRIPS + decode matches Node over ~4.5k
strings (fuzz/base64/encode-diff.mjs). New byte/bit capability for LOGOS (`ord`), the substrate
hashes + wire codecs reuse. Subset: ASCII in (UTF-8-multibyte/binary next). **P2 LEAF — HEX (toHex/fromHex,
Buffer hex codec) ALSO DONE:** byte↔nibble arithmetic in pure LOGOS, encode matches Node + decode
round-trips over ~7.5k strings (fuzz/hex/codec-diff.mjs). Remaining toolchain gaps: cross-module
functions (BUG-24), TCE nested-concat (BUG-29), atomics. **P2 leaves shipped: semver, glob, TOML,
base64, hex — all pure LOGOS, all differential-verified.** **P7 THE JS ENGINE — FIRST SLICE:** the
`jsint` definitional interpreter begins — `jsEval` evaluates JS arithmetic expressions (`+ - * %`)
with correct operator precedence + left-to-right associativity + PARENTHESIZED subexpressions
(nested grouping) + the COMPARISON tier (< > <= >= == === != !==) + the LOGICAL tier (&& || short-circuit) + the
TERNARY conditional (? : right-associative) in pure LOGOS — the COMPLETE JS expression operator
ladder (recursion-threaded two-tier
evaluator, no parser stack). Exposed via `bun __js-eval`; differential-fuzzed vs Node's
own `eval()`: **~48k expressions (arith + nested parens + comparisons + && || + ternary) across 23 seeds, 0 diffs** (fuzz/jsint/arith-diff.mjs). **INTERPRETER MILESTONE: jsRun is now a real PROGRAM interpreter** — `let` bindings + variables + sequential statements (`;`), threading an environment; variable references resolve inside any expression (arith/comparison/logical/ternary). Differential-fuzzed vs Node eval: ~7.5k whole programs across 5 seeds, 0 diffs (fuzz/jsint/program-diff.mjs). Same loop-var shadowing gotcha bit the substitution pass — fixed by branching the recursion. **TURING-COMPLETE: jsint now runs CONTROL FLOW** — `while` loops with brace-delimited multi-statement bodies + assignment (mutation), on a brace-aware top-level statement splitter (splitTop tracks `{ }` depth, only breaks statements at depth-0 `;`). Runs real algorithms — sum(1..5)=15, factorial(6)=720, accumulators — differential-fuzzed vs Node eval: ~4k while-loop programs across 4 seeds, 0 diffs (fuzz/jsint/loop-diff.mjs). GOTCHA: LOGOS strings use `{ }` for interpolation, so literal braces are chr(123)/chr(125). IF/ELSE also done (nested, via a brace-matching body extractor braceBody + brace-aware block splitter runBlockStr — arbitrary nesting: if-in-while, if/else-in-while, if-in-if all correct). ~5k control-flow programs vs Node, 0 diffs. jsint = full expression ladder + variables + statements + while + if/else with nesting = a Turing-complete JS interpreter in pure LOGOS, ~65k+ differential checks vs Node, 0 diffs. **REAL-JS TOKENIZER done: jsExec accepts actual (unspaced) JavaScript source** — normJs is a char-scanner spacing out operators (3-char ===/!== → 2-char ==/<=/&&/|| → 1-char, brace-aware), collapseWs cleans up, then the interpreter runs it. `let s=0;let i=1;while(i<=5){s=s+i;i=i+1};s` → 15, factorial → 720, all as real minified JS. ~3.2k minified programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/tokenize-diff.mjs). GOTCHA: LOGOS number-words — a var named `two`/`three` parses as 2/3; renamed. **FUNCTIONS + RECURSION done: jsint runs recursive JS functions** — definitions, parameter binding, `return` (incl. return-from-nested-if-block via an env `__ret` flag), recursion (factorial, fibonacci), and multiple/nested calls in expressions (`fib(n-1)+fib(n-2)`). Functions live in the env (body `;` encoded to chr(2) to survive the `;`-separated env; marked with chr(1)); resolveCalls reduces innermost `f(args)` calls (and grouping parens) before evaluation. Differential-fuzzed vs Node: ~2.4k function/recursion programs across 4 seeds, 0 diffs (fuzz/jsint/function-diff.mjs). GOTCHAS: `from`/`to` are reserved LOGOS prepositions (renamed params); indexing a Seq inside a recursive call's own arg list moves it (stage in a Let). MULTI-PARAMETER functions too (max(a,b), f(a,b,c), recursive pow(b,e)=1024) — bindParams binds a comma-separated param list, each arg evaluated in the caller's scope. FOR loops too (desugared to while via the init/cond/update triple; splitTop now tracks ( ) depth so the header's ; isn't split): nested for, for-with-if, for-in-function all correct (sumTo(100)=5050). **STRINGS done — jsint now has a VALUE MODEL (numbers + strings):** string literals (a tokenizer inStr pass keeps them whole, internal spaces→chr(4)), + concatenation with number coercion, equality/inequality, lexical < >, and strings flowing through ternaries/loops/functions (string args + returns: greet('bob')='hi bob'). String values are tagged (chr(3) prefix); the comparison LEAF (evalValue/cmpVals) routes string-vs-number so the ternary/logical/numeric structure is untouched — numeric regression clean. ~2.8k string programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/string-diff.mjs). ARRAYS too — the value model now spans numbers + strings + ARRAYS: [e,e,e] literals and a[i] indexing (constant + variable index), arrays through loops/ternaries/expressions, string arrays. Arrays are tagged (chr(5) prefix, elements chr(6)-joined); a resolveArrays pass (parallel to the call pass) reduces innermost [ ] — indexing if preceded by an array value, else a literal build; materialize renders an array as its comma-joined elements (Array.toString). ~2.8k array programs vs Node, 0 diffs (fuzz/jsint/array-diff.mjs). OBJECTS too — the value model now spans numbers + strings + arrays + OBJECTS: {k:v,...} literals, o.k dot access, o["k"] bracket access, nested objects (o.k1.k2), objects-in-arrays (a[i].k), values from variables/expressions, missing key → undefined, bare object → [object Object]. Objects are tagged (chr(7) prefix; entries chr(6)-joined, key/value split by chr(8)); a resolveObjects pass reduces innermost { } BEFORE the array/dot passes so nesting composes, resolveObjDot resolves o.k, and the array bracket pass dispatches obj["k"] vs arr[i] by receiver tag. ~2.8k object programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/object-diff.mjs). GOTCHA: `before` is a reserved English preposition (BUG-31 — can't name a var `before`); GOTCHA: reducing an inner object must NOT trim the prefix or the ` : ` key/value spacing collapses (nested obj → parseInt("") panic). `.length` too — the `.length` property on strings AND arrays (element count / char count), via a resolveProps pass; works bare, in arithmetic/comparisons/ternaries, and as a for-loop bound (`for(let i=0;i<a.length;i=i+1)` — the shape nearly every real array algorithm uses). ~2.4k .length programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/length-diff.mjs). Locking `.length` surfaced a latent VALUE-MODEL bug: string values kept internal spaces as REAL spaces, so a string variable substituted into the space-delimited expression got mis-split by the `.length`/dot passes (`"the bun".length` var → wrong) — and the same bit object/array access holding multi-word strings. FIXED by keeping spaces as chr(4) in string values END-TO-END (litToStr no longer decodes; only the final output paths — jsExec/__js-run/__js-eval — decode chr(4)→space), so a value with spaces is always a single token through every pass. FUNCTION EXPRESSIONS too — first-class function VALUES: `let f = function(params){body}` assigns an anonymous function to a variable, then `f(args)` calls it, reusing the same chr(1)-tagged-value + callFn machinery as named `function f(){}` (params bound in the caller scope, body run to `return`). funcValueOf builds the value; bindAssign intercepts a `function (`-leading RHS directly (bypassing the space-splitting expression passes, which a spaces-in-body function value can't survive). Multi-param, bodies with locals + control flow, string args/returns, and self-recursion (the name is in scope at call time) all work. ~2.4k function-expression programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/funcexpr-diff.mjs). KNOWN LIMITATION (BUG-32): statements are `;`-separated — a block-closing `}` is NOT yet a statement boundary, so `if(c){...}return x` needs the explicit `if(c){...};return x` (the whole existing corpus already uses this). Higher-order (passing/returning functions) + true lexical capture are the next increments (both need the spaces-in-body function value to be inlinable — an opaque-token re-encoding). `typeof` too — the `typeof` operator over the whole value model: number / string / boolean (`true`/`false` now first-class values, not just comparison results) / object (both arrays AND objects, matching JS). resolveTypeof reduces `typeof <value>` to the tag's type string; typeOfTag evaluates the operand first (so it works on literals + variables + members + elements) and inspects the tag. Fixed a sibling of the object nested-prefix bug in the process: resolveArrays TRIMMED its prefix (needed for a[i] index detection) but that glued a word before an array literal (`typeof [1,2]` → `typeof␀…` → panic) — split into a trimmed prefix (detection) + a raw prefix (space-preserving literal build). ~2k typeof programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/typeof-diff.mjs). NEGATIVE NUMBERS too — unary minus on literals + parenthesized values, negatives stored in variables/arrays, negatives through arithmetic/comparisons/ternaries/function args+returns. jsEval routes a SPACED leading `- ` (a source `-5` normalizes to `- 5`) through `0 - …`; a glued `-5` (toText of a computed negative) is already a valid parseInt operand and flows the normal single-call-site path (BUG-33 forced the one-call-site design). ~2k negative programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/negative-diff.mjs). (String coercion of a negative — `"x"+-1` — was an edge here; now FIXED, see the string-coercion note below.) `null` and `undefined` too — now first-class bare-token values: `null`/`undefined` literals, stored in variables, their typeof (null→"object", undefined→"undefined"), and the two structural sources of undefined — a missing object key (o.missing) and an out-of-bounds array index (a[N]) — both now yield a REAL undefined (fixing a latent bug where a missing key was a chr3-tagged "undefined" STRING, so typeof mis-reported "string"). String(null)="null", String(undefined)="undefined". ~1.6k null/undefined programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/nullundef-diff.mjs). logical NOT `!` too — `!bool`, `!(comparison)`, numeric truthiness (`!5`=false, `!0`=true), `!null`/`!undefined`, and `!` feeding a `&&` chain or a ternary condition. notOf implements JS falsiness (false/0/""/null/undefined→true, else false); a leading `! ` in jsEvalCmp negates the recursively-evaluated operand. ~1.6k NOT programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/not-diff.mjs). (`!(a&&b)` — the &&-split isn't paren-aware — and `!""` stay out of scope.) COMPOUND ASSIGNMENT too — `+=` / `-=` / `*=` (now 2-char tokens in isOp2, desugared in execStmt to `x = x <op> rhs`): bare updates, self-reference (`x*=x`), chained, string concat (`s+="b"`), and — the workhorse — compound assignment inside for-loop UPDATES and BODIES (accumulators like `for(let i=1;i<=n;i+=1){s+=i}`). ~2k compound programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/compound-diff.mjs). INCREMENT/DECREMENT `++`/`--` too — 2-char isOp2 tokens desugared in execStmt to `x = x ± 1` (postfix AND prefix collapse to the same statement effect — concatenating the text around `++` recovers the var name either way). The headline: `for(let i=0;i<n;i++)` and `for(let i=n;i>0;i--)` — the CANONICAL JS loop forms now run (the corpus had been writing `i=i+1`). ~2k inc/dec programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/incdec-diff.mjs). (Used as a statement; the postfix-value form `y=x++` is out of scope.) FULL STRING COERCION now — the `+` operator coerces EVERY non-string operand to a string when concatenating: numbers, NEGATIVES (`"x"+-1`="x-1", was "x- 1"), parenthesized arithmetic (`"x"+(2*3)`="x6"), booleans (`"v"+true`="vtrue"), arrays (`"a"+[1,2]`="a1,2"). concatTerms now sends a string term (chr3) down the direct materialize path and EVALUATES every other term via evalValue first (no infinite recursion — only non-string terms hit evalValue). The string fuzzer's concat chain now exercises all five coercion kinds. ★ HIGHER-ORDER FUNCTIONS + LEXICAL CLOSURES — THE ENGINE CROWN ★ Function values are now a fully OPAQUE spaceless token: encFn maps space/`{`/`}`/`(`/`)`/`[`/`]`/`,`/`;` to control chars (16-23, 2), decFn inverts inside callFn. Because the token has none of the chars any pipeline pass looks for, a function now SURVIVES substitution — so it can be assigned to another variable (`let g=f`), PASSED as an argument (`ap(add,3,4)`=7), and RETURNED from a function; an inline function value is called directly (resolveCalls dispatches a chr(1) lastTok) and `mk()()` chains. LEXICAL CAPTURE: when a function expression is created (bindAssign or a `return`), the defining env is substituted into its body — so `adder(x){return function(y){return x+y}}` closes over x: `adder(5)(3)`=8 (makeAdder), `mul(3)(6)`=18, triple-nested `f3(a)(b)(c)` all correct. Value-capture at creation (live-mutable capture / counters = a separate item). Fixed a latent bug in the process: no-arg functions (`function(){…}`) panicked because bindParams called jsEvalIn("") on the empty arg → parseInt("") — now the empty param is skipped. ~2k higher-order/closure programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/hof-diff.mjs); all 18 fuzzers green. `else if` CHAINS too — execIf had run an `else if` block UNCONDITIONALLY (treated it as a plain `else`, so `if(x>8)…else if(x>3)…else…` gave the middle arm even when x=1); now when the text after `else` starts with `if `, execIf RECURSES on that nested if, so a multi-arm `if / else if / … / else` selects the first matching arm exactly like JS (2-, 3-, 4-arm chains). ~2k else-if-chain programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/elseif-diff.mjs). JS TRUTHINESS now — boolOf had called ONLY the literal "true" truthy, so `if(5)`, `while(x)`, `5?a:b` all mis-evaluated (a truthy number read as false); boolOf now implements JS falsiness (false/0/""/empty-string/null/undefined → false, everything else → true), so if/while/ternary conditions accept any value like JS (`if(5)`→then, `while(x){x--}` counts down, `5?10:20`→10). ~2k truthiness programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/truthy-diff.mjs). (Operand-returning `&&`/`||` — our && yields a boolean — stays a separate value-model item.) LAZY TERNARY — the recursion base case now works. resolveCalls resolved EVERY call eagerly, including the one in a NOT-taken ternary branch, so `n<=1?1:n*f(n-1)` never bottomed out (infinite recursion → crash). jsEvalIn now handles a top-level ` ? ` LAZILY (evaluate the condition, then only the taken branch — so calls in the dead branch never fire), making the canonical functional recursions terminate: factorial, FIBONACCI (`fib(n)=n<2?n:fib(n-1)+fib(n-2)`), triangular, power-of-two, all via ternary. ~1.6k ternary-recursion programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/ternaryrec-diff.mjs). jsint = a real JS engine with numbers (incl. negatives)/strings (full coercion)/booleans/null/undefined/arrays/objects + .length + typeof + `!` + truthiness + `+=`/`-=`/`*=`/`++`/`--` + first-class functions + HIGHER-ORDER + CLOSURES + lazy ternary, while/for/if/else-if/else, recursion (via if OR ternary), ~120k differential checks vs Node, 0 diffs. COMPUTED OBJECT VALUES now — an object value can be an arbitrary expression, not just a literal: `{a:o.a+1}` (member access), `{first:a[0],last:a[1]}` (array index), `{y:o.x+10,z:o.x}` (mixed) all evaluate. buildObj now runs each value through evalResolved — the shared post-substitute pipeline (resolveObjects→Arrays→Props→ObjDot→Typeof→jsEvalTernary), also extracted from jsEvalIn so both use one code path. Object fuzzer now exercises computed values; still 0 diffs across 4 seeds. jsint = a real JS engine with numbers (incl. negatives)/strings (full coercion)/booleans/null/undefined/arrays/objects (computed values) + .length + typeof + `!` + truthiness + `+=`/`-=`/`*=`/`++`/`--` + first-class functions + HIGHER-ORDER + CLOSURES + lazy ternary, while/for/if/else-if/else, recursion (via if OR ternary), ~120k differential checks vs Node, 0 diffs. OBJECT VALUES CAN NOW HOLD ARRAYS — `{k:[1,2]}` reads back correctly (`o.k`="1,2"), incl. multi-field objects with an array value (`{a:[1,2,3],b:9}`). Two fixes: (1) a bracket-depth-aware entry splitter (splitObjEntries) so the object's own entry split doesn't break on the array's comma; (2) objects now use chr(11) as the entry separator (was chr(6), which COLLIDED with the array element separator chr(6) — an array value's chr(6) split the object's entries). OPERAND-RETURNING `&&`/`||` now — jsAndVal/jsOrVal return the DECIDING OPERAND, not a coerced boolean, exactly like JS: `&&` returns the first falsy operand or the last (`5&&10`=10, `0&&5`=0), `||` the first truthy or the last (`0||5`=5, `5||10`=5), with `||` grouping above `&&`. The idioms work: `x||99` (default value), `n||"default"` (string default), `x&&x*2`, `2&&0||9`=9. Comparison operands still yield "true"/"false" (no regression). ~2k &&/|| operand programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/logic-diff.mjs). STRING METHODS begin — `s.charAt(i)` and `s.indexOf(sub)`. A resolveMethods pass runs BEFORE resolveCalls (which would otherwise consume the `(args)`): it recognizes `<recv> . charAt (i)` / `<recv> . indexOf (sub)`, evaluates receiver + arg through jsEvalIn, and dispatches — charAt = the i-th char (chr(3) string; "" out of range), indexOf = the first byte position or -1 (via substringBefore length, chr(4)-space-consistent). Literal + variable receivers, in/out-of-range charAt, found/not-found indexOf, and charAt results fed into concat all match. ~2k string-method programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/strmethod-diff.mjs). slice/toUpperCase/toLowerCase/includes/startsWith/endsWith/repeat/trim too — the resolveMethods pass now dispatches TEN string methods: charAt, indexOf, slice (char range, b capped), toUpperCase/toLowerCase (ASCII case via ord/chr, chr(4)-space preserved so "Hi There".toUpperCase()="HI THERE"), includes (indexOf≠−1), startsWith/endsWith (endsWith via a tail slice), repeat, and trim (a chr(4)-aware strTrim, since our string spaces are chr(4) which LOGOS's native trim doesn't see — "  spaced out  ".trim()="spaced out", internal space kept). The recursive char loops stage `item i of s` in a Let (and strRepeat stages the concat) to dodge the E0382 Seq-move. ~2k string-method programs (all 10 methods) across 4 seeds vs Node, 0 diffs (fuzz/jsint/strmethod-diff.mjs). `split` too — `s.split(sep)` returns a real array (`"a,b,c".split(",")`="a,b,c" as an array; `.split(",")[1]`="b" — split-THEN-index works because resolveMethods produces the array inline before resolveArrays runs; `.split(" ")` splits on chr(4)-spaces; `p.length` on the result = the element count). ELEVEN string methods total. ~2k string-method programs (all 11) across 4 seeds vs Node, 0 diffs (fuzz/jsint/strmethod-diff.mjs; `split("")`→per-char differs from LOGOS split, scoped out). array `.join(sep)` too — joins an array's materialized elements by a custom separator, so the everyday `s.split(a).join(b)` transform works (`"a,b,c".split(",").join("-")`="a-b-c", `"one two three".split(" ").join("_")`="one_two_three") plus `arr.join(sep)` on a variable array. (An array LITERAL immediately joined — `[1,2].join()` — is out of scope: resolveMethods runs before resolveArrays builds the literal, so a multi-token `[...]` receiver isn't yet a value; split/variable receivers are single tokens.) `replace(a,b)` too — first-occurrence replace like JS (`"hello".replace("l","L")`="heLlo", `"aaa".replace("a","b")`="baa", `"path/to/file".replace("/","-")`="path-to/file", no-match returns the string), via substringBefore + b + substringAfter. TWELVE string/array methods now. ~2k string-method programs (all 12) across 4 seeds vs Node, 0 diffs (fuzz/jsint/strmethod-diff.mjs). jsint = a real JS engine with numbers (incl. negatives)/strings (full coercion + methods)/booleans/null/undefined/arrays (+ join)/objects (computed + array values) + .length + typeof + `!` + truthiness + operand-`&&`/`||` + `+=`/`-=`/`*=`/`++`/`--` + charAt/indexOf/slice/toUpperCase/toLowerCase/includes/startsWith/endsWith/repeat/trim/split/join/replace + first-class functions + HIGHER-ORDER + CLOSURES + lazy ternary, while/for/if/else-if/else, recursion (via if OR ternary), ~136k differential checks vs Node, 0 diffs. KNOWN (deeper, next-session) limitations: member-THEN-index (`o.k[1]` — needs a unified postfix resolver), multi-entry NESTED objects (flat-encoding nesting), capturing a FUNCTION value into a closure body, live-mutable closures, more string methods (slice/split/replace/toUpperCase). Next: those + more of the JS type system. This is the
seed the Futamura projections will eventually specialize into a JIT. Next: parens, a real tokenizer
(drop the space requirement), comparisons/booleans, variables → statements. Remaining toolchain
gaps: cross-module functions (BUG-24), TCE nested-concat (BUG-29), atomics._
