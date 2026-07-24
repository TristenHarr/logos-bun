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

### BUG-34 · OURS · 2026-07-15 · correctness (FIXED)
**What:** A global function (`parseInt`/`Number`/`String`/`Boolean`) applied to an INDEXED or
MEMBER argument — `parseInt(nums[i])`, `parseInt(o.v)` — returned empty. `resolveCalls` evaluated
the argument with a PARTIAL pipeline (`jsEvalTernary(substitute(resolveCalls(inner)))`), which never
runs `resolveArrays`/`resolveObjDot`, so `nums[i]` reached `parseInt` unresolved. Every isolated
fuzzer passed (they call globals on literals/variables); only the integration suite composed a
global with an array index. **Where:** `resolveCalls` isGlobalFn branch, `src/main.lg`. **Found by:**
`fuzz/jsint/realprograms-diff.mjs` (a `parseInt(nums[i])` accumulator loop). **Status:** FIXED — route
the argument through the full `jsEvalIn` pipeline (commit 865ecd0). **Tweet:** Wrote a JS engine in an
English programming language. 26 single-feature fuzzers, 0 diffs vs Node. Then I ran 25 *real* multi-
feature programs — and `parseInt(arr[i])` came back empty. Isolation lies; integration tells the truth.

### BUG-35 · OURS · 2026-07-15 · correctness (FIXED)
**What:** An EMPTY array reported `.length` = 1 instead of 0 (and `.map`/`.filter` over it produced a
phantom element). `arrElements` decodes an array value by `split(content, chr(10))`, but Rust's
`str::split` returns `[""]` for empty input — so a genuinely empty array (`content == ""`) decoded to
one empty element. A real one-element array holding the empty string (`"".split(",")` → `[""]`) is
distinguishable because its element carries the `chr(3)` string tag, so `content` is non-empty. **Where:**
`arrElements`, `src/main.lg`. **Found by:** `fuzz/jsint/chain-diff.mjs` (a chain sliced an array past its
end — `"x".split(",").slice(1,3).length` — expecting 0). **Status:** FIXED — `arrElements` returns
`[] of Text` when the decoded content is empty; real `[""]` stays length 1. **Tweet:** Fuzzed method
chains in my English-written JS engine against Node. It found that my empty arrays had length 1 —
because Rust's `"".split(x)` is `[""]`, not `[]`. The classic empty-split trap, caught by a differential fuzzer.

### BUG-36 · TOOLCHAIN · 2026-07-15 · crash (worked around)
**What:** A recursive LOGOS function that returns `Int` and carries an `Int` depth/index counter it
recurses on (`f(toks, i + 1, depth - 1)`) triggers a codegen constant-specialization that SPECULATIVELY
propagates the seed constants through the recursion and emits a specialized Rust `fn` whose name embeds a
NEGATIVE constant — `fn blockEndIdx_s1_2_s2_-1(...)` — which is not a valid Rust identifier, so the
generated crate fails to compile (`error: missing parameters for function definition`). The speculative
path (depth 0 → depth −1) is guarded and never taken at runtime, but the specializer explores it anyway.
The existing depth-tracking functions (`braceBody`/`splitTop`/`balancedArg`) never hit this because they
also thread a GROWING `Text` accumulator, which is not constant-foldable and disables the specializer for
the whole function. **Where:** `logicaffeine_compile` codegen (constant specialization / function-name
mangling), `src/main.rs:263` in the generated crate. **Found by:** writing the arrow-function desugarer's
Int-returning paren/brace-matching helpers (`matchOpenLeft`/`exprBodyEnd`/`blockEndIdx`). **Status:** worked
around (thread a growing `Text` guard arg through each helper — same shape as `braceBody`); proper fix =
skip constant-specialization for identifier mangling when a propagated constant is negative, or mangle
negatives to a valid identifier fragment (toolchain). **Tweet:** Wrote arrow functions for my English-
language JS engine. The compiler crashed generating `fn foo_s2_-1()` — it speculatively specialized my
recursion into a function named with a negative number. Rust identifiers can't contain `-`. Beautiful bug.

### BUG-37 · OURS · 2026-07-15 · correctness (FIXED)
**What:** `jsEvalIn` detected a ternary with `hasSep(expr, " ? ")` — a non-depth-aware substring
scan — so a `?` nested INSIDE a function body or parentheses was mistaken for a top-level ternary of
the WHOLE expression. `a.map(x=>x==2?9:0)` split at the body's `?`, evaluating the garbage prefix
`a.map(function(x){return x==2` as the condition and collapsing the array. Any ternary-body reducer/
mapper (`(m,x)=>x>m?x:m`) or a ternary in a call argument hit this. **Where:** `jsEvalIn` ternary branch,
`src/main.lg`. **Found by:** the reduce work — `a.reduce((m,x)=>x>m?x:m,0)` returned empty. **Status:**
FIXED — a token-level, depth-aware split: `topTernaryQ` finds the first `?` at paren/brace/bracket depth
0, and `topColon` finds its matching `:` with a ternary-nesting counter, so a `?` inside a group is
ignored AND nested unparenthesized ternaries (`a?b?c:d:e`) parse right-associatively like JS. Strictly
more correct than the old first-`:` scan. **Tweet:** My English-written JS engine's `arr.reduce((m,x)=>x>m?x:m,0)`
returned nothing. The `?` in the reducer body was being read as a ternary over the *entire program*.
Fixed with a depth-aware split — which, as a bonus, made nested `a?b?c:d:e` parse correctly too.

### BUG-38 · OURS · 2026-07-15 · correctness (FIXED)
**What:** An empty array LITERAL `[]` was not represented as an array value at all — `let a=[];a.length`
returned empty (not 0), `typeof []` returned empty (not "object"), and pushing to a freshly-`[]` array
did nothing. `resolveArrays` built the literal via `buildArr(split(inner, ","), …)`, but for empty inner
content Rust's `"".split(",")` is `[""]`, so `[]` became a malformed one-element build that collapsed to
the empty string. (An array emptied by `.pop()` was fine — it went through the `arrElements` path already
fixed in BUG-35.) **Where:** `resolveArrays`, `src/main.lg`. **Found by:** implementing `push`/`pop` —
`let a=[];a.push(1)` produced nothing. **Status:** FIXED — `resolveArrays` emits a clean `chr5+chr15`
empty array when the literal's inner content is empty, before the `buildArr` split path. **Tweet:** Added
push/pop to my English-written JS engine and `let a=[];a.push(1)` did nothing. The bug: an empty array
literal `[]` wasn't an array at all — `"".split(",")` is `[""]`, not `[]`. The empty-split trap, third time.

### BUG-39 · OURS · 2026-07-15 · correctness (FIXED)
**What:** A string VALUE containing a structural character — `[ ] { } ( )` — did not round-trip.
`"{a:1}".length` returned empty, `let s="[x]";s+"!"` returned empty, etc. Only SPACES were protected
inside string values (encoded as chr(4)); the brackets/braces/parens stayed literal, so when a string
value was substituted back into an expression, the array/object/paren passes (`resolveArrays`,
`resolveObjects`, `evalParens`) mis-read the string's own characters as syntax. **Where:** string
tokenization + output decode, `src/main.lg`. **Found by:** verifying the prerequisite for `JSON.stringify`
(whose output is bracket-heavy) — a batch of URL/JSON-ish string probes. **Status:** FIXED — `normJs`
now encodes `[ ] { } ( )` inside a string to chr(24)–chr(29) (mirroring the chr(4)-space scheme), and a
new `decodeStr` restores them (plus spaces) at every output boundary (`__js`/`__js-run`/`__js-eval`).
A companion bug in `desugarTemplates` surfaced (the template-brace-depth tracker counted `}` inside a
STRING literal in `${…}`, closing the interpolation early) — fixed with a string-skip mode. **Tweet:**
My English-written JS engine choked on `"{a:1}".length`. Strings were protected against spaces but not
their own brackets/braces — so a string value got re-parsed as syntax. The same fix that tamed spaces,
now for `[]{}()`.

### BUG-40 · OURS · 2026-07-15 · correctness (FIXED)
**What:** When an OBJECT-valued variable's name equals a property/key that is being accessed or
declared, `substitute` replaces the property/key token with the whole object value and corrupts it:
`let a={a:5};a.a` → undefined (should be 5); `let a={a:5};let b={a:4};b.a` → empty. It does NOT bite
number/string-valued variables (`let a=5;let o={a:1};o.a` → 1) — only object (and presumably array)
values, because those expand to a multi-tag string that a `. <name>` or `<name> :` position can't
survive. **Where:** `substitute` / the member-access + object-literal passes, `src/main.lg`. **Found by:**
the object-spread fuzzer, which happened to name a variable the same as a key. **Status:** FIXED —
`substTokens` now skips a token in PROPERTY position (right after `.`) and in KEY position (right after
`{`/`,` and right before `:`), so a variable never bleeds into a member slot. Ternary `a ? b : c` is
untouched because `b` isn't preceded by `{`/`,`. Locked by `fuzz/jsint/collide-diff.mjs` (variables
deliberately named the same as the keys they access). **Tweet:** Found a gnarly one in my English-written JS engine:
`let a={a:5}; a.a` returned undefined. A variable whose NAME matched its own KEY got substituted into
the key slot. Numbers were fine; objects weren't — they expand to a tagged blob a key slot can't hold.

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
own `eval()`: **~48k expressions (arith + nested parens + comparisons + && || + ternary) across 23 seeds, 0 diffs** (fuzz/jsint/arith-diff.mjs). **INTERPRETER MILESTONE: jsRun is now a real PROGRAM interpreter** — `let` bindings + variables + sequential statements (`;`), threading an environment; variable references resolve inside any expression (arith/comparison/logical/ternary). Differential-fuzzed vs Node eval: ~7.5k whole programs across 5 seeds, 0 diffs (fuzz/jsint/program-diff.mjs). Same loop-var shadowing gotcha bit the substitution pass — fixed by branching the recursion. **TURING-COMPLETE: jsint now runs CONTROL FLOW** — `while` loops with brace-delimited multi-statement bodies + assignment (mutation), on a brace-aware top-level statement splitter (splitTop tracks `{ }` depth, only breaks statements at depth-0 `;`). Runs real algorithms — sum(1..5)=15, factorial(6)=720, accumulators — differential-fuzzed vs Node eval: ~4k while-loop programs across 4 seeds, 0 diffs (fuzz/jsint/loop-diff.mjs). GOTCHA: LOGOS strings use `{ }` for interpolation, so literal braces are chr(123)/chr(125). IF/ELSE also done (nested, via a brace-matching body extractor braceBody + brace-aware block splitter runBlockStr — arbitrary nesting: if-in-while, if/else-in-while, if-in-if all correct). ~5k control-flow programs vs Node, 0 diffs. jsint = full expression ladder + variables + statements + while + if/else with nesting = a Turing-complete JS interpreter in pure LOGOS, ~65k+ differential checks vs Node, 0 diffs. **REAL-JS TOKENIZER done: jsExec accepts actual (unspaced) JavaScript source** — normJs is a char-scanner spacing out operators (3-char ===/!== → 2-char ==/<=/&&/|| → 1-char, brace-aware), collapseWs cleans up, then the interpreter runs it. `let s=0;let i=1;while(i<=5){s=s+i;i=i+1};s` → 15, factorial → 720, all as real minified JS. ~3.2k minified programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/tokenize-diff.mjs). GOTCHA: LOGOS number-words — a var named `two`/`three` parses as 2/3; renamed. **FUNCTIONS + RECURSION done: jsint runs recursive JS functions** — definitions, parameter binding, `return` (incl. return-from-nested-if-block via an env `__ret` flag), recursion (factorial, fibonacci), and multiple/nested calls in expressions (`fib(n-1)+fib(n-2)`). Functions live in the env (body `;` encoded to chr(2) to survive the `;`-separated env; marked with chr(1)); resolveCalls reduces innermost `f(args)` calls (and grouping parens) before evaluation. Differential-fuzzed vs Node: ~2.4k function/recursion programs across 4 seeds, 0 diffs (fuzz/jsint/function-diff.mjs). GOTCHAS: `from`/`to` are reserved LOGOS prepositions (renamed params); indexing a Seq inside a recursive call's own arg list moves it (stage in a Let). MULTI-PARAMETER functions too (max(a,b), f(a,b,c), recursive pow(b,e)=1024) — bindParams binds a comma-separated param list, each arg evaluated in the caller's scope. FOR loops too (desugared to while via the init/cond/update triple; splitTop now tracks ( ) depth so the header's ; isn't split): nested for, for-with-if, for-in-function all correct (sumTo(100)=5050). **STRINGS done — jsint now has a VALUE MODEL (numbers + strings):** string literals (a tokenizer inStr pass keeps them whole, internal spaces→chr(4)), + concatenation with number coercion, equality/inequality, lexical < >, and strings flowing through ternaries/loops/functions (string args + returns: greet('bob')='hi bob'). String values are tagged (chr(3) prefix); the comparison LEAF (evalValue/cmpVals) routes string-vs-number so the ternary/logical/numeric structure is untouched — numeric regression clean. ~2.8k string programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/string-diff.mjs). ARRAYS too — the value model now spans numbers + strings + ARRAYS: [e,e,e] literals and a[i] indexing (constant + variable index), arrays through loops/ternaries/expressions, string arrays. Arrays are tagged (chr(5) prefix, elements chr(6)-joined); a resolveArrays pass (parallel to the call pass) reduces innermost [ ] — indexing if preceded by an array value, else a literal build; materialize renders an array as its comma-joined elements (Array.toString). ~2.8k array programs vs Node, 0 diffs (fuzz/jsint/array-diff.mjs). OBJECTS too — the value model now spans numbers + strings + arrays + OBJECTS: {k:v,...} literals, o.k dot access, o["k"] bracket access, nested objects (o.k1.k2), objects-in-arrays (a[i].k), values from variables/expressions, missing key → undefined, bare object → [object Object]. Objects are tagged (chr(7) prefix; entries chr(6)-joined, key/value split by chr(8)); a resolveObjects pass reduces innermost { } BEFORE the array/dot passes so nesting composes, resolveObjDot resolves o.k, and the array bracket pass dispatches obj["k"] vs arr[i] by receiver tag. ~2.8k object programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/object-diff.mjs). GOTCHA: `before` is a reserved English preposition (BUG-31 — can't name a var `before`); GOTCHA: reducing an inner object must NOT trim the prefix or the ` : ` key/value spacing collapses (nested obj → parseInt("") panic). `.length` too — the `.length` property on strings AND arrays (element count / char count), via a resolveProps pass; works bare, in arithmetic/comparisons/ternaries, and as a for-loop bound (`for(let i=0;i<a.length;i=i+1)` — the shape nearly every real array algorithm uses). ~2.4k .length programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/length-diff.mjs). Locking `.length` surfaced a latent VALUE-MODEL bug: string values kept internal spaces as REAL spaces, so a string variable substituted into the space-delimited expression got mis-split by the `.length`/dot passes (`"the bun".length` var → wrong) — and the same bit object/array access holding multi-word strings. FIXED by keeping spaces as chr(4) in string values END-TO-END (litToStr no longer decodes; only the final output paths — jsExec/__js-run/__js-eval — decode chr(4)→space), so a value with spaces is always a single token through every pass. FUNCTION EXPRESSIONS too — first-class function VALUES: `let f = function(params){body}` assigns an anonymous function to a variable, then `f(args)` calls it, reusing the same chr(1)-tagged-value + callFn machinery as named `function f(){}` (params bound in the caller scope, body run to `return`). funcValueOf builds the value; bindAssign intercepts a `function (`-leading RHS directly (bypassing the space-splitting expression passes, which a spaces-in-body function value can't survive). Multi-param, bodies with locals + control flow, string args/returns, and self-recursion (the name is in scope at call time) all work. ~2.4k function-expression programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/funcexpr-diff.mjs). KNOWN LIMITATION (BUG-32): statements are `;`-separated — a block-closing `}` is NOT yet a statement boundary, so `if(c){...}return x` needs the explicit `if(c){...};return x` (the whole existing corpus already uses this). Higher-order (passing/returning functions) + true lexical capture are the next increments (both need the spaces-in-body function value to be inlinable — an opaque-token re-encoding). `typeof` too — the `typeof` operator over the whole value model: number / string / boolean (`true`/`false` now first-class values, not just comparison results) / object (both arrays AND objects, matching JS). resolveTypeof reduces `typeof <value>` to the tag's type string; typeOfTag evaluates the operand first (so it works on literals + variables + members + elements) and inspects the tag. Fixed a sibling of the object nested-prefix bug in the process: resolveArrays TRIMMED its prefix (needed for a[i] index detection) but that glued a word before an array literal (`typeof [1,2]` → `typeof␀…` → panic) — split into a trimmed prefix (detection) + a raw prefix (space-preserving literal build). ~2k typeof programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/typeof-diff.mjs). NEGATIVE NUMBERS too — unary minus on literals + parenthesized values, negatives stored in variables/arrays, negatives through arithmetic/comparisons/ternaries/function args+returns. jsEval routes a SPACED leading `- ` (a source `-5` normalizes to `- 5`) through `0 - …`; a glued `-5` (toText of a computed negative) is already a valid parseInt operand and flows the normal single-call-site path (BUG-33 forced the one-call-site design). ~2k negative programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/negative-diff.mjs). (String coercion of a negative — `"x"+-1` — was an edge here; now FIXED, see the string-coercion note below.) `null` and `undefined` too — now first-class bare-token values: `null`/`undefined` literals, stored in variables, their typeof (null→"object", undefined→"undefined"), and the two structural sources of undefined — a missing object key (o.missing) and an out-of-bounds array index (a[N]) — both now yield a REAL undefined (fixing a latent bug where a missing key was a chr3-tagged "undefined" STRING, so typeof mis-reported "string"). String(null)="null", String(undefined)="undefined". ~1.6k null/undefined programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/nullundef-diff.mjs). logical NOT `!` too — `!bool`, `!(comparison)`, numeric truthiness (`!5`=false, `!0`=true), `!null`/`!undefined`, and `!` feeding a `&&` chain or a ternary condition. notOf implements JS falsiness (false/0/""/null/undefined→true, else false); a leading `! ` in jsEvalCmp negates the recursively-evaluated operand. ~1.6k NOT programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/not-diff.mjs). (`!(a&&b)` — the &&-split isn't paren-aware — and `!""` stay out of scope.) COMPOUND ASSIGNMENT too — `+=` / `-=` / `*=` (now 2-char tokens in isOp2, desugared in execStmt to `x = x <op> rhs`): bare updates, self-reference (`x*=x`), chained, string concat (`s+="b"`), and — the workhorse — compound assignment inside for-loop UPDATES and BODIES (accumulators like `for(let i=1;i<=n;i+=1){s+=i}`). ~2k compound programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/compound-diff.mjs). INCREMENT/DECREMENT `++`/`--` too — 2-char isOp2 tokens desugared in execStmt to `x = x ± 1` (postfix AND prefix collapse to the same statement effect — concatenating the text around `++` recovers the var name either way). The headline: `for(let i=0;i<n;i++)` and `for(let i=n;i>0;i--)` — the CANONICAL JS loop forms now run (the corpus had been writing `i=i+1`). ~2k inc/dec programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/incdec-diff.mjs). (Used as a statement; the postfix-value form `y=x++` is out of scope.) FULL STRING COERCION now — the `+` operator coerces EVERY non-string operand to a string when concatenating: numbers, NEGATIVES (`"x"+-1`="x-1", was "x- 1"), parenthesized arithmetic (`"x"+(2*3)`="x6"), booleans (`"v"+true`="vtrue"), arrays (`"a"+[1,2]`="a1,2"). concatTerms now sends a string term (chr3) down the direct materialize path and EVALUATES every other term via evalValue first (no infinite recursion — only non-string terms hit evalValue). The string fuzzer's concat chain now exercises all five coercion kinds. ★ HIGHER-ORDER FUNCTIONS + LEXICAL CLOSURES — THE ENGINE CROWN ★ Function values are now a fully OPAQUE spaceless token: encFn maps space/`{`/`}`/`(`/`)`/`[`/`]`/`,`/`;` to control chars (16-23, 2), decFn inverts inside callFn. Because the token has none of the chars any pipeline pass looks for, a function now SURVIVES substitution — so it can be assigned to another variable (`let g=f`), PASSED as an argument (`ap(add,3,4)`=7), and RETURNED from a function; an inline function value is called directly (resolveCalls dispatches a chr(1) lastTok) and `mk()()` chains. LEXICAL CAPTURE: when a function expression is created (bindAssign or a `return`), the defining env is substituted into its body — so `adder(x){return function(y){return x+y}}` closes over x: `adder(5)(3)`=8 (makeAdder), `mul(3)(6)`=18, triple-nested `f3(a)(b)(c)` all correct. Value-capture at creation (live-mutable capture / counters = a separate item). Fixed a latent bug in the process: no-arg functions (`function(){…}`) panicked because bindParams called jsEvalIn("") on the empty arg → parseInt("") — now the empty param is skipped. ~2k higher-order/closure programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/hof-diff.mjs); all 18 fuzzers green. `else if` CHAINS too — execIf had run an `else if` block UNCONDITIONALLY (treated it as a plain `else`, so `if(x>8)…else if(x>3)…else…` gave the middle arm even when x=1); now when the text after `else` starts with `if `, execIf RECURSES on that nested if, so a multi-arm `if / else if / … / else` selects the first matching arm exactly like JS (2-, 3-, 4-arm chains). ~2k else-if-chain programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/elseif-diff.mjs). JS TRUTHINESS now — boolOf had called ONLY the literal "true" truthy, so `if(5)`, `while(x)`, `5?a:b` all mis-evaluated (a truthy number read as false); boolOf now implements JS falsiness (false/0/""/empty-string/null/undefined → false, everything else → true), so if/while/ternary conditions accept any value like JS (`if(5)`→then, `while(x){x--}` counts down, `5?10:20`→10). ~2k truthiness programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/truthy-diff.mjs). (Operand-returning `&&`/`||` — our && yields a boolean — stays a separate value-model item.) LAZY TERNARY — the recursion base case now works. resolveCalls resolved EVERY call eagerly, including the one in a NOT-taken ternary branch, so `n<=1?1:n*f(n-1)` never bottomed out (infinite recursion → crash). jsEvalIn now handles a top-level ` ? ` LAZILY (evaluate the condition, then only the taken branch — so calls in the dead branch never fire), making the canonical functional recursions terminate: factorial, FIBONACCI (`fib(n)=n<2?n:fib(n-1)+fib(n-2)`), triangular, power-of-two, all via ternary. ~1.6k ternary-recursion programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/ternaryrec-diff.mjs). jsint = a real JS engine with numbers (incl. negatives)/strings (full coercion)/booleans/null/undefined/arrays/objects + .length + typeof + `!` + truthiness + `+=`/`-=`/`*=`/`++`/`--` + first-class functions + HIGHER-ORDER + CLOSURES + lazy ternary, while/for/if/else-if/else, recursion (via if OR ternary), ~120k differential checks vs Node, 0 diffs. COMPUTED OBJECT VALUES now — an object value can be an arbitrary expression, not just a literal: `{a:o.a+1}` (member access), `{first:a[0],last:a[1]}` (array index), `{y:o.x+10,z:o.x}` (mixed) all evaluate. buildObj now runs each value through evalResolved — the shared post-substitute pipeline (resolveObjects→Arrays→Props→ObjDot→Typeof→jsEvalTernary), also extracted from jsEvalIn so both use one code path. Object fuzzer now exercises computed values; still 0 diffs across 4 seeds. jsint = a real JS engine with numbers (incl. negatives)/strings (full coercion)/booleans/null/undefined/arrays/objects (computed values) + .length + typeof + `!` + truthiness + `+=`/`-=`/`*=`/`++`/`--` + first-class functions + HIGHER-ORDER + CLOSURES + lazy ternary, while/for/if/else-if/else, recursion (via if OR ternary), ~120k differential checks vs Node, 0 diffs. OBJECT VALUES CAN NOW HOLD ARRAYS — `{k:[1,2]}` reads back correctly (`o.k`="1,2"), incl. multi-field objects with an array value (`{a:[1,2,3],b:9}`). Two fixes: (1) a bracket-depth-aware entry splitter (splitObjEntries) so the object's own entry split doesn't break on the array's comma; (2) objects now use chr(11) as the entry separator (was chr(6), which COLLIDED with the array element separator chr(6) — an array value's chr(6) split the object's entries). OPERAND-RETURNING `&&`/`||` now — jsAndVal/jsOrVal return the DECIDING OPERAND, not a coerced boolean, exactly like JS: `&&` returns the first falsy operand or the last (`5&&10`=10, `0&&5`=0), `||` the first truthy or the last (`0||5`=5, `5||10`=5), with `||` grouping above `&&`. The idioms work: `x||99` (default value), `n||"default"` (string default), `x&&x*2`, `2&&0||9`=9. Comparison operands still yield "true"/"false" (no regression). ~2k &&/|| operand programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/logic-diff.mjs). STRING METHODS begin — `s.charAt(i)` and `s.indexOf(sub)`. A resolveMethods pass runs BEFORE resolveCalls (which would otherwise consume the `(args)`): it recognizes `<recv> . charAt (i)` / `<recv> . indexOf (sub)`, evaluates receiver + arg through jsEvalIn, and dispatches — charAt = the i-th char (chr(3) string; "" out of range), indexOf = the first byte position or -1 (via substringBefore length, chr(4)-space-consistent). Literal + variable receivers, in/out-of-range charAt, found/not-found indexOf, and charAt results fed into concat all match. ~2k string-method programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/strmethod-diff.mjs). slice/toUpperCase/toLowerCase/includes/startsWith/endsWith/repeat/trim too — the resolveMethods pass now dispatches TEN string methods: charAt, indexOf, slice (char range, b capped), toUpperCase/toLowerCase (ASCII case via ord/chr, chr(4)-space preserved so "Hi There".toUpperCase()="HI THERE"), includes (indexOf≠−1), startsWith/endsWith (endsWith via a tail slice), repeat, and trim (a chr(4)-aware strTrim, since our string spaces are chr(4) which LOGOS's native trim doesn't see — "  spaced out  ".trim()="spaced out", internal space kept). The recursive char loops stage `item i of s` in a Let (and strRepeat stages the concat) to dodge the E0382 Seq-move. ~2k string-method programs (all 10 methods) across 4 seeds vs Node, 0 diffs (fuzz/jsint/strmethod-diff.mjs). `split` too — `s.split(sep)` returns a real array (`"a,b,c".split(",")`="a,b,c" as an array; `.split(",")[1]`="b" — split-THEN-index works because resolveMethods produces the array inline before resolveArrays runs; `.split(" ")` splits on chr(4)-spaces; `p.length` on the result = the element count). ELEVEN string methods total. ~2k string-method programs (all 11) across 4 seeds vs Node, 0 diffs (fuzz/jsint/strmethod-diff.mjs; `split("")`→per-char differs from LOGOS split, scoped out). array `.join(sep)` too — joins an array's materialized elements by a custom separator, so the everyday `s.split(a).join(b)` transform works (`"a,b,c".split(",").join("-")`="a-b-c", `"one two three".split(" ").join("_")`="one_two_three") plus `arr.join(sep)` on a variable array. (An array LITERAL immediately joined — `[1,2].join()` — is out of scope: resolveMethods runs before resolveArrays builds the literal, so a multi-token `[...]` receiver isn't yet a value; split/variable receivers are single tokens.) `replace(a,b)` too — first-occurrence replace like JS (`"hello".replace("l","L")`="heLlo", `"aaa".replace("a","b")`="baa", `"path/to/file".replace("/","-")`="path-to/file", no-match returns the string), via substringBefore + b + substringAfter. TWELVE string/array methods now. ~2k string-method programs (all 12) across 4 seeds vs Node, 0 diffs (fuzz/jsint/strmethod-diff.mjs). GLOBAL FUNCTIONS now — parseInt / Number / String / Boolean, dispatched in resolveCalls AFTER the user-function + inline-function lookup (so a user fn of the same name still wins — declarer-wins): parseInt/Number coerce to an integer (`parseInt("42")+8`=50, `Number("17")*2`=34), String coerces to a chr(3) string (`String(5)+"!"`="5!"), Boolean applies JS truthiness (`Boolean(0)`=false, `Boolean(5)`=true, `Boolean("")`=false). ~2k global-function programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/globals-diff.mjs). Math.max/Math.min/Math.abs too — matched by the literal `Math . fn (` pattern in resolveMethods (the "Math" is part of the match, so no receiver value is needed), over the integer engine: `Math.max(3,7)`=7, `Math.min(3,7)`=3, `Math.abs(-5)`=5, nested `Math.min(Math.max(1,5),10)`=5, variable + expression args. Reuses the existing minInt (declared once — the semver one), adds maxInt/absInt. ~2k Math programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/math-diff.mjs). ARRAY indexOf/includes now — the indexOf/includes methods DISPATCH by the receiver value's tag: a chr(5) array searches by ELEMENT (`[10,20,30].indexOf(20)`=1, not the char index), a chr(3) string searches by substring as before (`"hello".indexOf("ll")`=2). A shared idxOf helper picks arrIndexOf vs strIndexOf; `"a,b,c".split(",").indexOf("b")`=1 (split-produced array). ~2k array programs (now incl. indexOf/includes) across 4 seeds vs Node, 0 diffs; string indexOf/includes unchanged (no regression). ARRAY slice too — `.slice(a,b)` dispatches by tag like indexOf: a chr(5) array returns a sub-ARRAY of elements (`[10,20,30,40].slice(1,3)`="20,30", b capped, slice-then-index `[1,2,3].slice(1,3)[0]`=2), a chr(3) string returns a substring as before. A shared sliceOf helper picks arrSlice vs strSlice. ~2k array programs (now incl. slice) across 4 seeds vs Node, 0 diffs; string slice unchanged. jsint = a real JS engine with numbers (incl. negatives)/strings (full coercion + methods)/booleans/null/undefined/arrays (+ join, indexOf, includes, slice, reverse)/objects (computed + array values) + .length + typeof + `!` + truthiness + operand-`&&`/`||` + `+=`/`-=`/`*=`/`++`/`--` + string/array methods + parseInt/Number/String/Boolean + Math.max/min/abs + first-class functions + HIGHER-ORDER + CLOSURES + lazy ternary, while/for/if/else-if/else, recursion (via if OR ternary), and ★ HIGHER-ORDER ARRAY METHODS `.map`/`.filter` ★ — `a.map(f)` applies a named function value to each element, `a.filter(f)` keeps the truthy ones: `[1,2,3].map(dbl)`="2,4,6", `[1..6].filter(even)`="2,4,6", chained `a.map(inc).join("-")`. The mapper is a named function value that can itself be a CLOSURE, so map/filter compose with the closure machinery. This retires the E0382 fear (it was a theory, never built): the fix is `concat(fnval,"")` / `concat(env,"")` per element — native concat BORROWS, so it returns a fresh copy, and the LOGOS callFn consumes the copy while the originals still pass to the recursive loop. ~1.6k map/filter programs across 4 seeds vs Node, 0 diffs (fuzz/jsint/mapfilter-diff.mjs). ~148k differential checks total. INLINE function args to map/filter now work too — `a.map(function(x){return x*2})`="2,4,6", `a.filter(function(x){return x>3})`, chained `a.map(function(x){return x*x}).join("-")`="1-4-9" — via balancedArg (a paren-depth walk that finds the method's matching `)` PAST the function's own `(params)`) + fnArgVal (a `function (`-leading arg → funcValueOf, so it can capture the outer env; else jsEvalIn for a named fn). Named function args still work — map/filter are now fully general (real JS style). MEMBER-THEN-INDEX now works too — `o.k[i]` (`o.k0[1]`=8, `o.a[2]+o.a[0]`), the SECOND flagged "deep" item, resolved not by a rewrite but by a FIXPOINT: resolveAccess repeats (resolveObjDot then resolveArrays) until stable. member-then-index needs objdot-first, index-then-member (`a[1].k0`) needs arrays-first — the fixpoint gives BOTH: whichever resolves this pass exposes the receiver for the next. `o.arr.length` and nested `o.k1.k2` still work; all 26 fuzzers green (strict improvement). MULTI-ENTRY NESTED OBJECTS now work too — `{p:{x:1,y:2}}` (`o.p.x+o.p.y`=3), triple-nested `{a:{b:{c:5}}}`, deeply-nested-with-siblings — the flagged flat-encoding-nesting deep item, resolved with OBJECT CLOSE MARKERS: buildObj now wraps the object chr(7)…chr(14), and objGet strips the trailing chr(14) then splits entries via splitObjEntriesDepth (a chr(7)/chr(14)-depth-aware split of chr(11), so an inner object's chr(11) at depth>0 no longer collides with the outer's). ~3 functions changed; all 26 fuzzers green (strict improvement — the current object encoding tests still pass). NESTED ARRAYS `[[1,2],[3,4]]` now work too — `a[1][0]`=3, `o.m[1][0]`=3 (object holding a nested array, deep access) — via the mirror-image ARRAY CLOSE MARKERS: every array is now chr(5)…chr(15), and a shared arrElements(v) helper (strip trailing chr(15) + splitArrElemsDepth = chr(5)/chr(15)-depth-aware split of chr(6)) replaced the raw `split(substringAfter(v,chr5),chr6)` at all ~9 read sites (arrGet/matArr/propLength/arrIndexOf/arrSlice/arrReverse/arrMap/arrFilter/arrJoin); all 6 build sites wrap chr(15). An atomic ~15-site refactor — all 26 fuzzers green across 3 seeds (strict improvement). ALL FOUR structural "deep" items (map/filter, member-then-index, nested objects, nested arrays) now DONE; only live-mutable closures (needs shared mutable state the pure string model lacks) remains. Math.pow/sign/floor/ceil/round too — pow via a powInt loop (`Math.pow(2,10)`=1024), sign (`Math.sign(-7)`=-1), floor/ceil/round are integer-identity (int engine); ~2k Math programs across 4 seeds vs Node, 0 diffs. (Nested Math with a DIFFERENT inner fn — `Math.max(Math.pow(...))` — needs balanced-arg extraction like map/filter; same-family nesting `Math.min(Math.max(...))` works.) KNOWN (deeper, next-session) limitations: member-THEN-index (`o.k[1]` — needs a unified postfix resolver), multi-entry NESTED objects (flat-encoding nesting), capturing a FUNCTION value into a closure body, live-mutable closures, more string methods (slice/split/replace/toUpperCase). Next: those + more of the JS type system. ★ INTEGRATION SUITE — the holistic proof the engine COMPOSES ★ Every fuzzer above tests ONE feature in isolation; the real question is whether 36 features co-exist in a real program. fuzz/jsint/realprograms-diff.mjs is a fixed battery of 25 realistic multi-feature programs — a filter→map→join pipeline, a curried `adder(10)(32)`, a triple-nested closure `f3(a)(b)(c)`, `fib(12)`/`fact(6)`/`sum(50)` (both if- and ternary-recursion), object→array→object access (`data.users[1]`), nested-object dot chains (`cfg.db.port`), max/sum/odd-count array loops, `split→map→join` string transforms, a `parseInt(nums[i])` accumulator loop — each run through logos-bun `__js` AND Node `eval` and required to AGREE. All 25 pass. Building it FOUND + FIXED a real interaction bug the isolated fuzzers missed: a GLOBAL fn (parseInt/Number/String/Boolean) applied to an INDEXED or MEMBER argument (`parseInt(nums[i])`, `parseInt(o.v)`) returned empty, because resolveCalls evaluated the argument with a PARTIAL pipeline (jsEvalTernary — no array/member resolution); the fix routes the argument through the full jsEvalIn. It also surfaced three surface-sugar gaps (each worked around with an intermediate variable, all documented for a focused pass): (1) a method call directly on an array LITERAL (`[1,2,3].filter(...)` — resolveMethods runs before the literal is a value), (2) method CHAINING where a method's receiver is itself a method call (`s.toUpperCase().indexOf(...)` — resolveMethods matches by branch order, not leftmost position), (3) nested Math with a DIFFERENT inner fn (`Math.max(Math.abs(...))` — needs the same balanced-arg extraction map/filter already use). ~160k differential checks vs Node, 0 diffs; 27 fuzzers green. ★ METHOD CHAINING — `a.f().g().h()` ★ The first surfaced sugar gap is now CLOSED: a chain like `s.toUpperCase().indexOf("WORLD")` or `arr.filter(f).map(g).join("-")` resolves LEFT-TO-RIGHT. The bug was that `resolveMethods` dispatched by BRANCH ORDER (indexOf is checked before toUpperCase), so in a chain it fired the higher-priority method first and read the preceding method's `)` as the receiver. The fix converts dispatch from priority-order to POSITION-order: a `leftmostMethod` helper (a fold of `betterMarker`/`mpos` over the 16 method markers) finds the marker that occurs earliest in the string, and every string/array branch now guards `If lm is equal to "<marker>"` — so the leftmost method always resolves first, exposing a value receiver for the next. (Math stays inner-first — its same-family nesting `Math.min(Math.max(...))` relies on it, and different-fn nesting is a separate balanced-arg gap.) A dedicated fuzzer (`fuzz/jsint/chain-diff.mjs`) generates random TYPE-TRACKED chains of 2–5 methods (string→string→…→number/bool, with split→array→join excursions) and diffs each vs Node: ~3k chain programs across 6 seeds, 0 diffs. Building it found + fixed BUG-35 (empty arrays reported length 1, because Rust's `"".split(x)` is `[""]`). The integration suite now uses REAL chains (no intermediate-var workarounds). ~163k differential checks vs Node, 0 diffs; 28 fuzzers green. ★ ARROW FUNCTIONS — `x => x*2` ★ Modern JS's defining syntax now runs, and it reuses ALL the existing function machinery: a `desugarArrows` pass in `normalizeJs` rewrites every arrow to the engine's existing `function ( params ) { … }` form BEFORE the interpreter sees it, so closures/HOF/map/filter/recursion all work on arrows for free. `=>` became a single operator token (`isOp2`); the desugarer finds params by scanning LEFT of ` => ` (a bare identifier, or a `( … )` list via a paren-matcher) and the body by scanning RIGHT (a `{ … }` block via a brace-matcher, else an expression up to the first depth-0 `,`/`)`/`]`/`}`/`;` — then wraps expression bodies in `return`). Every form works: single-param (`x=>x*2`), paren-params (`(a,b)=>a+b`), no-params (`()=>42`), block bodies (`x=>{let y=x*2;return y+1}`), CURRIED (`a=>b=>a+b` → nested closures), ternary bodies, value-capture of outer vars, and arrows passed straight to `.map`/`.filter`. A dedicated fuzzer (`fuzz/jsint/arrow-diff.mjs`) generates random arrow forms (all six shapes + map/filter arrows) and diffs each vs Node: ~3k programs across 6 seeds, 0 diffs. Building the desugarer's Int-returning paren/brace matchers surfaced BUG-36 (a toolchain codegen crash: it speculatively specialized the recursion into a Rust `fn` named with a NEGATIVE constant — worked around by threading a growing `Text` guard, the same shape `braceBody` uses). The integration suite now runs arrow pipelines (`a.filter(x=>x%2==0).map(x=>x*x).join("-")`). ~166k differential checks vs Node, 0 diffs; 29 fuzzers green. ★ `const`/`var` + `Array.reduce` + depth-aware ternary ★ `const` and `var` now bind exactly like `let` (three statement keywords → the same `bindAssign`), so real modern JS — which almost never writes `let` at top level — runs at all (decl-diff.mjs, ~2k mixed let/const/var programs, 0 diffs). `Array.reduce(fn, init)` completes the functional-array family: a two-arg reducer (arrow OR function expression) folds over the array via a new `callFn2` that binds both params directly (so accumulator/element values with commas survive), with the fn/init split by the depth-aware `exprBodyEnd` so an inline reducer's own commas/braces don't confuse the arg boundary (reduce-diff.mjs, ~2k folds — sum/product/max/min/conditional + filter→reduce + map→reduce, 0 diffs). Wiring reduce surfaced BUG-37, a PRE-EXISTING correctness bug the isolated fuzzers had never hit: `jsEvalIn` detected ternaries with a non-depth-aware `hasSep(expr, " ? ")`, so a `?` inside a function body (`(m,x)=>x>m?x:m`) was mistaken for a top-level ternary of the whole expression and collapsed it. FIXED with a token-level depth-aware split (`topTernaryQ` finds the first depth-0 `?`, `topColon` finds its matching `:` with a ternary-nesting counter) — which also made nested unparenthesized ternaries (`a?b?c:d:e`) parse right-associatively like JS, strictly more correct than the old first-`:` scan. ~170k differential checks vs Node, 0 diffs; 31 fuzzers green. ★ `for…of` LOOPS ★ The modern iteration form now runs — `for (let x of arr) { … }` and `for (const x of arr) { … }` over array literals, variables, and split-produced arrays, with `+=`/`*=` accumulators, conditionals, and NESTED for-of all correct. `execFor` branches on ` of ` in the header (a classic `for(init;cond;update)` has no ` of `); `execForOf` binds the loop variable to each element of `arrElements(<the array value>)` per iteration, threading the env and honoring an early `return`. A dedicated fuzzer (`fuzz/jsint/forof-diff.mjs`) generates random for-of loops (sum/product/count/string-concat + nested + split-produced) and diffs each vs Node: ~2.4k programs across 6 seeds, 0 diffs. ~173k differential checks vs Node, 0 diffs; 32 fuzzers green. ★ ARRAY MUTATION `push`/`pop` ★ The imperative array-building idiom — the natural partner to for-of — now runs: `a.push(x)` and `a.pop()` are handled as STATEMENTS in `execStmt` (the dominant real-code case: building an array in a loop), rebinding the variable to a new array value (`arrPush` appends via `arrElements`+`joinChr6`, `arrPop` drops the last element). The classic accumulator `let out=[];for(…){if(…){out.push(x)}}` works, as do push-in-for-of, expression args (`a.push(2*3)`), and build→map→join chains. Wiring push surfaced BUG-38: an empty array LITERAL `[]` wasn't an array value at all (`[].length` empty, `typeof []` empty) — `resolveArrays` built it via `"".split(",")` = `[""]` (the empty-split trap yet again), collapsing to the empty string; FIXED by emitting a clean `chr5+chr15` empty array for empty literal content. A dedicated fuzzer (`fuzz/jsint/pushpop-diff.mjs`) builds/shrinks arrays imperatively (push in classic-for and for-of with conditionals + expression args, pop, then join/length/map) and diffs each vs Node: ~2.4k programs across 6 seeds, 0 diffs. (Statement-form push/pop only — the expression-value forms `let n=a.push(x)` and member-target `o.arr.push(x)` remain scoped out.) ~176k differential checks vs Node, 0 diffs; 33 fuzzers green. ★ `Object.keys` / `Object.values` / `Object.entries` ★ Object reflection now runs, matched by the literal `Object . <fn> (` pattern (like `Math.*`, no receiver): `objKeys` collects each entry's key (chr(3)-tagged string) into a chr(5) array, `objValues` its values, `objEntries` a `[key, value]` sub-array per entry — all in INSERTION order (both engines preserve declaration order, so results match exactly). They compose with everything downstream: `Object.keys(o).length`, `Object.values(o).reduce((s,x)=>s+x,0)`, `Object.entries(o).map(e=>e[0]).join(",")`, and — the synergy with the fresh for-of — `for (const k of Object.keys(o)) { … }`. Works on object literals as the argument too (`Object.keys({p:1,q:2}).length` — the literal is evaluated as the arg, unlike an array-literal RECEIVER which is still gap#1). A dedicated fuzzer (`fuzz/jsint/objkeys-diff.mjs`) generates random objects and observes them via keys/values/entries + join/length/reduce/filter/map/for-of: ~2.4k programs across 6 seeds, 0 diffs. ~179k differential checks vs Node, 0 diffs; 34 fuzzers green. ★ STRING UTILITY METHODS — padStart / padEnd / substring / charCodeAt + String.fromCharCode ★ The formatting/char-code layer real code leans on: `"5".padStart(3,"0")`="005", `"7".padEnd(4,"-")`="7---" (multi-char pads truncate to fit), `substring(a,b)` (with the JS swap-if-a>b), `charCodeAt(i)` (via `ord`, with our chr(4)-space→32 mapping), and the global `String.fromCharCode(65,66)`="AB" (variadic, code 32→our chr(4) space; codes evaluated as expressions). Four new method markers joined the `leftmostMethod` position-order dispatch; `String.fromCharCode` matches the literal `String . fromCharCode (` prefix like `Object.*`. A dedicated fuzzer (`fuzz/jsint/strutil-diff.mjs`) exercises all five over random strings: ~2.4k programs across 6 seeds, 0 diffs. The fuzzer caught a real divergence — out-of-range `charCodeAt` returns 0, not JS's `NaN` (our engine doesn't model NaN yet) — so it's scoped to in-range indices and the NaN gap is noted. Two RECEIVER gaps also confirmed (both worked around with an intermediate variable, same family as array-literal-receiver gap#1): a method on a PARENTHESIZED expression `(""+n).padStart(…)` and a nested method call inside another call's args `String.fromCharCode("A".charCodeAt(0)+1)` both hit the naive-`)` extraction / last-token-receiver assumption. ~181k differential checks vs Node, 0 diffs; 35 fuzzers green. ★ BALANCED RECEIVER EXTRACTOR — closes the whole receiver-gap family at once ★ Three separately-reported gaps (array-LITERAL receiver `[1,2,3].map(…)`, PARENTHESIZED-expression receiver `(""+n).padStart(…)` / `("a"+"b").toUpperCase()`, and — as a bonus — INDEX/MEMBER receiver `arr[i].toUpperCase()` / `o.s.toUpperCase()`) all shared ONE root cause: every method branch extracted the receiver as `recv = last space-token of bef`, which is `]`/`)` for a group and drops the base for an index. The fix is a single principled helper: `recvStart` walks LEFT from the end of `bef` over balanced groups (`matchGroupLeft`, generic over `()`/`[]`/`{}`) and member-`.` chains, stopping at an operator/delimiter (`isStopTok`) — so it returns the true START of the receiver whether that's a literal `[…]`, a `(…)` group, an index `a[i]`, a member chain `a.b`, or a bare token. `recvExpr`/`recvPrefix` slice `bef` at that point; a single `replace_all` routed ALL 21 method branches through them. Strictly behavior-preserving for the existing single-token cases (an operator/prefix before the receiver still stops it) and it newly evaluates group/index/member receivers by handing the whole receiver expression to `jsEvalIn`. A dedicated fuzzer (`fuzz/jsint/receiver-diff.mjs`) exercises array-literal + index + paren-expr receivers across map/filter/reduce/join/slice/toUpperCase/length/padStart: ~2.4k programs across 6 seeds, 0 diffs. The integration suite now uses direct literal receivers (`[1,2,3,4,5,6].filter(x=>x%2==0).map(x=>x*x).join("-")`) and paren receivers (`(""+n).padStart(3,"0")`) with no workarounds. (`recvStart` is seeded with a RUNTIME index so it dodges the BUG-36 specializer without a guard.) ~184k differential checks vs Node, 0 diffs; 36 fuzzers green. ★ TEMPLATE LITERALS `` `hi ${name}` `` ★ Modern JS's string-interpolation syntax now runs, desugared to concatenation in a `desugarTemplates` pass that runs FIRST in `normalizeJs` (before `normJs`), so the interpreter only ever sees `"…" + ( … ) + "…"`. A char-level state machine (normal / in-template-text / in-`${}`-expression) converts a backtick to `"`, a `${` to `" + (`, and its brace-depth-matched `}` back to `) + "` — so `` `a${x}b` `` becomes `"a" + (x) + "b"`. Because the interpolated pieces are just parenthesized expressions handed back to the normal pipeline, EVERYTHING composes inside `${}`: variables, arithmetic (`` `sum=${a+b}` ``), method calls (`` `up:${s.toUpperCase()}` ``), member access (`` `${user.name}` ``), and — thanks to the depth-aware ternary — conditionals (`` `${x>3?"big":"small"}` ``). Brace-depth tracking means object literals in interpolation work too. A dedicated fuzzer (`fuzz/jsint/template-diff.mjs`) mixes literal text with interpolated vars/arithmetic/ternaries/method-calls: ~2.4k programs across 6 seeds, 0 diffs. (Nested templates and backtick-in-text stay scoped out.) ~187k differential checks vs Node, 0 diffs; 37 fuzzers green. ★ HOF predicate array methods `.some` / `.every` / `.find` ★ The predicate family completing map/filter/reduce: `.some(fn)`→true if any element satisfies, `.every(fn)`→true if all, `.find(fn)`→the first matching element or `undefined`. Each takes an arrow OR function-expression predicate (via `balancedArg` + `fnArgVal`, same as filter), short-circuits, and composes downstream (`[1,2,3].map(x=>x*2).every(x=>x%2==0)`). Three new `leftmostMethod` markers + three dispatch branches mirroring the filter branch exactly. A dedicated fuzzer (`fuzz/jsint/findsome-diff.mjs`) exercises all three over random arrays with varied predicates: ~2.3k programs across 6 seeds, 0 diffs (find-miss-plus-arithmetic → NaN is skipped, not modeled). ~189k differential checks vs Node, 0 diffs; 38 fuzzers green. ★ STRUCTURAL-CHAR STRINGS (BUG-39 fix) ★ String VALUES can now hold `[ ] { } ( )` and round-trip (`"{a:1}".length`=5, `let s="[x]";s+"!"`="[x]!", `` `arr[${n}]` ``="arr[5]"). Only spaces had been protected (chr(4)); the bracket/brace/paren chars stayed literal, so a substituted string value got re-parsed as syntax by the array/object/paren passes. FIXED by encoding them inside strings to chr(24)–chr(29) in `normJs` (same scheme as chr(4) spaces) and decoding at every output boundary via a new `decodeStr`. Fixing it exposed + fixed a companion bug: `desugarTemplates` counted a `}` inside a STRING literal in `${…}` as closing the interpolation (now it has a string-skip mode). A dedicated fuzzer (`fuzz/jsint/strbracket-diff.mjs`) throws random bracket/brace/paren-laden strings through length/charAt/concat/methods/templates: ~2.4k programs across 6 seeds, 0 diffs. This unblocks `JSON.stringify` (next). ~191k differential checks vs Node, 0 diffs; 39 fuzzers green. ★ `JSON.stringify` — BYTE-EXACT serialization ★ The single most-used API in real JS/bun now serializes the whole value model, matched by the literal `JSON . stringify (` prefix: `jsonStringify` recurses over the tags — a chr(3) string → `"…"` (with `"`/`\` escaped via `jsonEscape`), a chr(5) array → `[…]` of comma-joined stringified elements, a chr(7) object → `{"key":value,…}` in INSERTION order, and numbers/booleans/null pass through — emitting the structural `[]{}` as their chr(24)–chr(27) ENCODED forms so the result is a proper string value that round-trips (`JSON.stringify(o)+"!"`, `.length`) and decodes to real `[]{}` at output. Byte-for-byte identical to Node across numbers, strings, arrays, nested objects, objects-holding-arrays, arrays-of-objects, and booleans/null. A dedicated fuzzer (`fuzz/jsint/json-diff.mjs`) generates random nested JSON-serializable values and requires byte-exact agreement (key order, quoting, separators): ~2.4k programs across 6 seeds, 0 diffs. (JSON.parse is the natural next step.) ~194k differential checks vs Node, 0 diffs; 40 fuzzers green. ★ `.concat` + `Array.isArray` ★ `a.concat(b)` merges two arrays into a new one (`arrConcat` via `arrElements`+`joinChr6`), dispatched by receiver tag so `"ab".concat("cd")`="abcd" does string concatenation instead (`concatOf`); `Array.isArray(x)` is a global type predicate (literal `Array . isArray (` prefix, true iff the value is chr(5)-tagged). Both compose downstream (`a.concat([3,4]).map(x=>x+1).join("-")`). A dedicated fuzzer (`fuzz/jsint/concat-diff.mjs`): ~2k programs across 5 seeds, 0 diffs. ~196k differential checks vs Node, 0 diffs; 41 fuzzers green. ★ `.at(i)` with NEGATIVE indexing ★ The modern relative-index accessor over arrays AND strings, dispatched by receiver tag: `[10,20,30].at(-1)`=30, `"hello".at(-1)`="o", `a.at(0)`, out-of-range → `undefined`. `arrAt`/`strAt` map a negative `i` to `length + i` and bounds-check both ends; `atOf` picks array-vs-string by the chr(5) tag. A dedicated fuzzer (`fuzz/jsint/at-diff.mjs`) throws in-range and negative indices at arrays and strings: ~2k programs across 5 seeds, 0 diffs. ~198k differential checks vs Node, 0 diffs; 42 fuzzers green. ★ `.flat()` ★ Flattens a nested array by one level — `[[1,2],[3,4]].flat()`=[1,2,3,4] — leaving scalars in place and dropping empty sub-arrays, via `arrFlatLoop` (splice a chr(5) element's own `arrElements`, else keep the element). Composes downstream (`a.flat().map(x=>x*2)`). A dedicated fuzzer (`fuzz/jsint/flat-diff.mjs`): ~2k programs across 5 seeds, 0 diffs. ~200k differential checks vs Node, 0 diffs; 43 fuzzers green. ★ STRING ESCAPE SEQUENCES `\"` `\\` `\n` ★ String literals now honor escapes: `"a\"b".length`=3, `"a\"b"`→`a"b`, `"a\\b"`→`a\b`, and JSON.stringify RE-ESCAPES them (`JSON.stringify("a\"b")`=`"a\"b"`, `{"msg":"he\"llo"}`). `normJs` consumes a `\`+next inside a string and emits a single protected placeholder (`\"`→chr(127), `\\`→chr(30), `\n`→chr(31)); `decodeStr` restores them at output; `jsonEscape` re-escapes them for JSON. GOTCHA that cost two builds: the first placeholder choices (chr(13) CR, chr(12) FF) were WHITESPACE — `trim()` silently ate a trailing `\"`; the second (chr(129)/chr(130)) were MULTI-BYTE in UTF-8 so `item i of`/`length of` miscounted — the fix is single-byte, non-whitespace control codes (chr(127) is the only free one, so `\t` is best-effort as a real tab, scoped out of the fuzzer). A dedicated fuzzer (`fuzz/jsint/escape-diff.mjs`) mixes letters + escapes through length/concat/JSON.stringify: ~2.4k programs across 6 seeds, 0 diffs. This is the last prerequisite before JSON.parse. ~202k differential checks vs Node, 0 diffs; 44 fuzzers green. ★ `JSON.parse` — the round-trip completes ★ A recursive-descent parser over the encoded value content: `jsonParse` dispatches on the first char (chr(26) object / chr(24) array / chr(127) string / else number/bool/null), `jsonSplitTop` does a depth- and string-aware split of the top-level commas, and `jsonBuildObj`/`jsonBuildArr` recurse to build chr(7)/chr(5)-tagged values. The input's quote delimiters are normalized (chr(34)→chr(127)) up front so the parser speaks one quote. Building it forced closing the arg-side of gap#3 for the JSON branches: `JSON.parse(JSON.stringify(x))` (the deep-clone idiom) fed a nested `)` to the old `substringBefore(")")` extraction and mis-cut — switched to `balancedArg`, so both JSON globals now take nested-call args. Now `JSON.parse(JSON.stringify(o)).b.c[1]`, `Object.keys(JSON.parse(s)).length`, and full deep-clone round-trips all work. A dedicated fuzzer (`fuzz/jsint/jsonparse-diff.mjs`) round-trips random JSON-serializable values through `JSON.stringify(JSON.parse(<literal>))` — the source literal produced by `JSON.stringify(json)` so its quotes are correctly escaped (exercising `\"` too): ~2.4k programs across 6 seeds, 0 diffs. (Compact JSON; inter-token whitespace + escaped-quotes-inside-parsed-strings scoped out.) ~204k differential checks vs Node, 0 diffs; 45 fuzzers green. ★ NESTED-CALL ARGUMENTS (gap#3 closed — the arg-side symmetry) ★ The balanced RECEIVER extractor had a mirror gap on the ARGUMENT side: every `Math.*`/`Object.*`/`String.*`/single-arg-string-method branch cut its argument with the naive first-`)` (`substringBefore(aft, ")")`), so a call whose argument was itself a call — `Math.max(Math.abs(-8),3)`, `String.fromCharCode("A".charCodeAt(0)+1)`, `Object.keys(JSON.parse(s))` — mis-cut at the inner `)`. Swept ~60 sites to two balanced helpers: `methodArg` (=`balancedArg`) and `methodRest` (slices past the matching `)`). A fuzzer then caught the deeper case — a 2-arg call whose arg is itself a 2-arg call (`Math.max(Math.min(9,9),Math.abs(-4))`) — where the naive `split(",")` breaks on the INNER comma; fixed with a depth-aware `splitArgs2` (top-level comma only) for the fixed-arity methods and a variadic `splitArgsN` for `String.fromCharCode` (over-swept once — the variadic case fed an empty arg to `parseInt` and panicked; caught and split back out). A dedicated fuzzer (`fuzz/jsint/nestedargs-diff.mjs`) throws deeply-nested Math/String/charCodeAt calls: ~2.4k programs across 6 seeds, 0 diffs. With the receiver side (recvStart) and now the arg side both balanced, the naive-extraction gap family is fully closed. ~207k differential checks vs Node, 0 diffs; 46 fuzzers green. ★ EXPONENT `**` ★ Right-associative, binds tighter than `* / + -`: `2**10`=1024, `2**3**2`=512 (=2^(3^2)), `2*3**2`=18, `1+2**3`=9. Added as an `isOp2` token, and resolved in a PRE-PASS `resolvePow` before the additive engine (`jsEvalNorm`): it reduces the RIGHTMOST `**` first (via `lastMatchIdx`) — which yields right-associativity — computing each `base ** exp` over the existing `powInt` and splicing the result back into the token string, repeating until none remain. Two bugs on the way: BUG-33 struck again (passing a Seq PARAMETER to `joinRange` twice mis-typed the clone as `&[String]`; fixed by having `powReduce` take the string and split to a LOCAL Seq, which the codegen handles); and the splice produced a DOUBLE space when the left side was empty (`3**2+1` → ` 9  + 1` → an empty token broke `jsEvalAdd`), fixed by collapsing with `joinNonEmpty`. A dedicated fuzzer (`fuzz/jsint/exp-diff.mjs`) mixes `**` with `+ - *` and precedence: ~2.4k programs across 6 seeds, 0 diffs (negative/fractional exponents → floats, out of scope for the integer engine). ~209k differential checks vs Node, 0 diffs; 47 fuzzers green. ★ WHITESPACE-TOLERANT `JSON.parse` ★ Real JSON (package.json, API bodies) has insignificant whitespace between tokens; the parser was compact-only. Added `encTrim` (strips leading/trailing encSpace/encNewline — the encoded forms of the whitespace) and threaded it through `jsonParse` (each value), the object/array inner-content empty checks, and each object key — so `JSON.parse('{ "a" : 1 , "b" : 2 }')` and pretty-printed multi-line JSON parse correctly. Whitespace INSIDE a string stays significant (it lies between the encQuote delimiters, which encTrim never crosses): `JSON.parse('{ "msg" : "hi there" }').msg`="hi there". The `jsonparse-diff.mjs` fuzzer now injects whitespace around `:`/`,`/`{}`/`[]` in half its inputs: ~2.4k programs across 6 seeds, 0 diffs. ~211k differential checks vs Node, 0 diffs; 47 fuzzers green. ★ `switch` STATEMENTS ★ Completes the control-flow set (if/else-if/while/for/for-of + switch): `execSwitch` evaluates the discriminant (via `methodArg` so a computed `switch(2+1)` works), splits the body into clauses at each `case `/`default ` label, finds the first clause whose evaluated `case` value strictly equals the discriminant (tag-comparison, so `case "1"` ≠ `case 1`), and runs from there with FALL-THROUGH (concatenate every clause's statements from the match onward) up to the first `break`; falls to `default` when no case matches. Matched/default/fall-through/break, numeric + string + computed discriminants all agree with Node. BUG-33 struck twice more (a Seq local reused across calls can't `concat("")`-clone → re-`split` a fresh Seq per call; and `item i of clauses` inside a recursive call's own arg list moves the Seq → stage in a `Let`). A dedicated fuzzer (`fuzz/jsint/switch-diff.mjs`): ~2.4k programs across 6 seeds, 0 diffs. ~213k differential checks vs Node, 0 diffs; 48 fuzzers green. ★ ARRAY SPREAD `[...a]` ★ A `...expr` element in an array literal splices the elements of expr's array in place: `[1,...a,4]`, `[...a,...b]`, `[...a]` (clone), and empty-array spread (contributes nothing). `...` became an `isOp3` token (so it survives as one unit, distinct from a member `.`); `buildArr` detects a `...`-leading element, pulls its `arrElements`, and joins them into the accumulator. The separator logic switched from index-based (`i==1`) to `acc==""` — because a spread can contribute zero-or-many elements at any position, so "is this the first contribution?" can't be inferred from the index (safe because every real value, even the empty string `chr(3)`, is non-empty). Composes with everything: `[1,...a].map(x=>x*2)`, `[...head,3,...tail].reduce(...)`. A dedicated fuzzer (`fuzz/jsint/spread-diff.mjs`) throws front/middle/end/multiple spreads mixed with scalars: ~2.4k programs across 6 seeds, 0 diffs. (Call spread `f(...args)` and object spread `{...o}` remain follow-ups.) ~215k differential checks vs Node, 0 diffs; 49 fuzzers green. ★ OBJECT SPREAD `{...o, k: v}` ★ A `...expr` entry splices the object's own entries; the primary use is merging/overriding (`{...defaults, ...overrides}`). Overriding needs JS's dedupe semantics — a repeated key keeps its FIRST position but LAST value — so `buildObj` now runs a `dedupObj` pass (walk entries, emit each key once at first occurrence with its last value via `objScanLast`), which ALSO fixed duplicate-key literals (`{a:1,a:2}`→`{a:2}`) and made `objScan` last-wins. `{...a,...b}`, `{...a,y:2}` (override or add), `{...a}` (clone) all agree byte-for-byte with Node incl. key order. Building it exposed BUG-40 (pre-existing, unrelated: an object-valued variable whose name matches a property/key it's accessed by gets substituted into the key slot — `let a={a:5};a.a`→undefined; numbers are fine, objects aren't) — logged, fuzzers avoid the collision. A dedicated fuzzer (`fuzz/jsint/objspread-diff.mjs`) merges/overrides/clones and checks byte-exact via JSON.stringify: ~2.4k programs across 6 seeds, 0 diffs. (Call spread `f(...args)` remains a follow-up.) ~217k differential checks vs Node, 0 diffs; 50 fuzzers green. ★ FIX BUG-40 — variable/member name collisions ★ `substitute` walked every token and replaced any that matched a variable — including tokens in a KEY slot (`{ m : 1 }`) or a PROPERTY slot (`o . m`). For numbers it happened to stay consistent (key and property both became the same literal), but an object-valued variable expanded to a multi-tag blob and the key-vs-lookup paths mangled it differently, so `let a={a:5};a.a` returned undefined. Fixed by making `substTokens` position-aware: a token right after `.` (property) or right after `{`/`,` and right before `:` (key) is left alone. Ternary `a?b:c` is safe (its `b` isn't preceded by `{`/`,`). Now any variable can share a name with a key/property. A dedicated fuzzer (`fuzz/jsint/collide-diff.mjs`) deliberately names variables the same as the keys they access (`let a={a:5};a.a`): ~2.2k programs across 6 seeds, 0 diffs. ~219k differential checks vs Node, 0 diffs; 51 fuzzers green. ★ CALL SPREAD `f(...args)` ★ The third spread form (array + object already done): a `...arr` argument in a call to a user function expands to that array's elements as positional arguments, mixable with fixed args and multiple spreads — `add(...xs)`, `f(1,...t)`, `f(1,...m,3)`, `f(...p,...q)`. `resolveCalls` now runs `expandSpreadArgs` on the argument string first: a fast guard returns it unchanged when there's no `...` (every normal call), otherwise it depth-aware-splits the args and replaces each `...expr` with the array's comma-joined elements before the callee binds them. A dedicated fuzzer (`fuzz/jsint/callspread-diff.mjs`): ~2.4k programs across 6 seeds, 0 diffs. (`Math.max(...arr)` still needs variadic Math + method-path spread — a follow-up.) ~221k differential checks vs Node, 0 diffs; 52 fuzzers green. ★ `??` NULLISH COALESCING ★ `a ?? b` yields a unless a is null/undefined, then b — and unlike `||` it KEEPS 0, "", and false. Added as an isOp2 token with a jsNullishVal handler in jsEvalLogic (before ||/&&); the depth-aware ternary is untouched since `??` is its own token, not a `?`. nullish-diff.mjs: ~2.4k programs across 6 seeds, 0 diffs; 53 fuzzers green. ★ LOGICAL ASSIGNMENT `||=` `&&=` `??=` ★ The short-circuiting compound assignments: `x ||= y` assigns only if x is falsy, `x &&= y` only if truthy, `x ??= y` only if null/undefined (keeping 0/""/false) — three isOp3 tokens desugared in execStmt like `+=`/`*=`. Simple-variable targets (member targets `o.p ||= v` need member assignment, a separate gap). `logassign-diff.mjs`: ~2.4k across 6 seeds, 0 diffs; 54 fuzzers green, ~225k differential checks. ★ OPTIONAL CHAINING `a?.b` ★ If the receiver is null/undefined the access is undefined and the rest of the chain short-circuits (`o?.a?.b`); otherwise it behaves like `.`. `?.` is an isOp2 token; `resolveOptChain` (in the access fixpoint) rewrites `?.` to `.` for a non-nullish receiver and yields `undefined` (consuming the property) for a nullish one — so `undefined ?. x` stays undefined and folds the chain. Composes with `??` (`o?.b ?? "def"`). `optchain-diff.mjs`: ~2.4k across 6 seeds, 0 diffs; 55 fuzzers green, ~227k checks. ★ MEMBER / INDEX ASSIGNMENT — `o.p = v`, `a[i] = v` ★ Objects and arrays can now be MUTATED in place: `o.a = 9` updates an existing property, `o.c = 3` adds a new one, `a[i] = v` replaces an element — the write forms real state-building code leans on. `execStmt`'s ` = ` handler now detects a member target (LHS holds ` . `) or an index target (LHS holds `[`): a member write rebinds the variable to `objSet(current, key, newValue)` (update-in-place via `dedupObj`, or append the entry when the key is new), an index write to `arrSetIdx(current, idx, newValue)` (rebuild with the idx-th element replaced). Both evaluate the RHS through the full `jsEvalIn` pipeline, so read-modify-write (`o.n = o.n + i`) and computed indices work. The canonical imperative idioms run: build an object by assignment (`let o={};o.x=1;o.y=2;o.x+o.y`=3), accumulate into a field across a loop (`for(…){o.n=o.n+i}`=3), replace array elements in a loop (`for(let i=0;i<3;i++){a[i]=i*i}`="0,1,4"), and JSON.stringify round-trips the mutated object. Two E0382 Seq-move gotchas on the way: the two branches shared `Let` names (renamed to distinct `mVar`/`mCur`/… vs `iVar`/`iIdx`/…), and `arrSetLoop`'s target branch used `newval` twice (clone the recursion arg via `concat(newval,"")`, native concat borrows → fresh copy). A dedicated fuzzer (`fuzz/jsint/memberassign-diff.mjs`) mutates objects/arrays then observes via JSON.stringify / join / arithmetic: ~3k programs across 6 seeds, 0 diffs. SCOPED LIMITATIONS (each a documented separate item): the model is VALUE-semantic — correct for mutate-then-use-the-SAME-variable (exactly what these programs do) but not ALIASING (`let p=o;p.x=1;o.x` — needs true reference semantics); member-COMPOUND (`o.a ||= 5`, `o.a += 1`) still routes through the simple-variable compound branch (the compound/logical-assign ops must become member-target-aware next); and only SINGLE-level member writes (nested `o.a.b = v` is out). ~230k differential checks vs Node, 0 diffs; 56 fuzzers green. ★ MEMBER / INDEX COMPOUND ASSIGNMENT — `o.p += v`, `a[i] *= v`, `o.p ||= v`, `o.p++` ★ The documented follow-up to member assignment closes cleanly with a single SHIFT-LEFT: a compound assignment `L op= R` is ALWAYS `L = L binop R`, whatever `L` is — so `execStmt` now runs a `memberCompoundRewrite` guard that, when the target is a member/index (`isMemberTarget` = LHS holds ` . ` or `[`), rewrites the statement to its plain `L = L binop R` form and RE-DISPATCHES through `execStmt` — which already routes member/index `=` targets (via `objSet`/`arrSetIdx`). One guard + two helpers; the eight operators (`+=` `-=` `*=` `||=` `&&=` `??=` `++` `--`) all fall out for free, and — critically — PLAIN-variable compounds fall straight through untouched (the guard only fires on a member/index LHS), so `compound-diff`/`logassign-diff` see zero change. This retires the last scoped miss from the member-assignment increment: `o.a ||= 5` now correctly yields 5 (was a no-op writing a garbage `"o . a"` var). Every form agrees with Node: arithmetic compounds (`o.a += 5`, `a[i] *= 3`), the short-circuiting logical-assigns with their keep-truthy/keep-falsy/keep-non-null semantics (`o.a ||= 9`, `o.a &&= 3`, `o.a ??= 42`), read-modify-write accumulation into a field across a loop (`for(…){o.n += i}`=10), and member `++`/`--`. A dedicated fuzzer (`fuzz/jsint/membercompound-diff.mjs`) mutates object/array targets with all eight ops then observes via JSON.stringify / join / read: ~3k programs across 6 seeds, 0 diffs. (The value-semantic/aliasing and nested `o.a.b op= v` limitations carry over from member assignment.) ~233k differential checks vs Node, 0 diffs; 57 fuzzers green. ★ `Array.prototype.sort` — comparator + the lexicographic-default gotcha, expression + in-place ★ Sorting — THE canonical array operation — now runs, reusing the HOF machinery. With a comparator (`arr.sort((a,b)=>…)`), a STABLE insertion sort inserts each element before the first existing element the comparator ranks it strictly after (`callFn2` runs the two-arg comparator, `< 0` ⇒ before), so ascending (`a-b`), descending (`b-a`), and arbitrary-key comparators work and compose downstream (`.sort(cmp).map(f).join("-")`). WITHOUT a comparator, JS sorts LEXICOGRAPHICALLY on `String(x)` — the infamous `[10,2,1].sort()` = `[1,10,2]` gotcha — which the engine faithfully reproduces (default mode compares `materialize`d values via `compareText`), so numbers sort as strings and words sort naturally. And — the semantics real code leans on — `sort` MUTATES IN PLACE: a bare `a.sort(…)` STATEMENT rebinds the variable to the sorted array (an `execStmt` handler mirroring push/pop, guarded to a simple-name receiver with no trailing chain), so `a.sort(); a.join(",")` observes the sorted `a`; as an EXPRESSION it returns the sorted array and chains. Wiring it needed one E0382 fix (in the insertion loop `el` was both moved into the recursion and re-borrowed for the append — cloned both uses; the element is dead once placed). A dedicated fuzzer (`fuzz/jsint/sort-diff.mjs`) throws ascending/descending/default-numeric/default-string/in-place/sort-then-index/sort-then-map at random arrays: ~3k programs across 6 seeds, 0 diffs. (Stable; the comparator runs on the integer engine, so float/NaN comparator returns are out of scope; an in-place nested-member receiver `o.items.sort()` carries the same nested limitation as member assignment.) ~236k differential checks vs Node, 0 diffs; 58 fuzzers green. ★ DESTRUCTURING DECLARATIONS — `const {a, b} = o`, `const [x, ...rest] = arr` ★ The single most pervasive modern-JS binding form (bun's own source destructures on nearly every line) now runs. `bindAssign` detects a pattern LHS — a name starting with `{` (object pattern) or `[` (array pattern) — and, instead of binding one variable, evaluates the RHS once and binds each pattern variable from it: an OBJECT pattern binds each `key` to `objGet(value, key)` and honors RENAMING (`{a: x}` binds `x` to the `a` field), an ARRAY pattern binds each position to `arrGet(value, i)`, supports the REST element (`[first, ...rest]` binds `rest` to `arrSlice(value, i, ∞)`), and tolerates ELISION (`[, second]` — an empty slot is skipped). Works under `let`/`const`/`var` alike (all three route through `bindAssign`), over object/array literals AND variables, with number/string/array/nested-object field values, and the bound names flow into everything downstream (`const {name, version} = pkg; \`${name}@${version}\``). Because a no-default pattern contains no inner ` = `, the existing `substringBefore(assign, " = ")` split cleanly separates pattern from initializer — no new parser surface. Wiring it hit the by-now-familiar arg-eval-order E0382 (the RHS value was moved into the bind-loop recursion before the same iteration's field read borrowed it — cloned the recursion arg). A dedicated fuzzer (`fuzz/jsint/destructure-diff.mjs`) throws object/renamed/array/triple/rest/from-a-variable patterns under random let/const/var at random values: ~3k programs across 6 seeds, 0 diffs. SCOPED: destructuring a MISSING key/index yields a correct `undefined` (proven — `[a,b,c]=[1,2]`→`1|2|undefined`), but using that `undefined` in ARITHMETIC hits the pre-existing NaN gap (the integer engine has no NaN and panics parsing `undefined` — the same crash `o.missing + 1` already produces, orthogonal to destructuring, a documented model-redesign item); DEFAULTS (`{a = 1}`), NESTED patterns (`{a: {b}}`), and parameter-position destructuring are documented follow-ups. ~239k differential checks vs Node, 0 diffs; 59 fuzzers green. ★ DESTRUCTURING DEFAULTS — `const {a = 1} = o`, `const [x = 0] = arr` ★ The follow-up completes the feature: a pattern element may carry a default that applies only when the source value is `undefined` (a missing key / short array / present-but-undefined). Wiring it needed a real split upgrade — a pattern WITH a default contains an inner ` = ` (the default's), so the naive `substringBefore(assign, " = ")` would cut the pattern at the wrong `=`. Fixed with `topEqIdx`, a bracket-depth-aware scan that finds the ASSIGNMENT `=` at depth 0 (the default's `=` lives at depth ≥ 1 inside the `{}`/`[]` and is skipped); pattern-field splitting likewise moved to a `{}`/`[]`/`()`-depth-aware `patFieldSplit` so a default value's own commas don't split a field. Each field then honors `key = default` and — the full form — rename-plus-default `{x: v = 7}`, via `defaultOr(cur, defExpr, env)` = `cur === undefined ? eval(defExpr) : cur`. Present values win, missing values fall to the default (`{a = 5}` from `{b:1}` → 5; `[a = 1, b = 2]` from `[9]` → `a=9, b=2`; `{name = "anon"}` from `{name:"bun"}` → "bun"). The depth-aware split is scoped to pattern LHS only — plain assignments keep the original fast split, untouched. The `destructure-diff.mjs` fuzzer now mixes object/array/rename defaults (present and absent) into its corpus: ~3k programs across 6 seeds, 0 diffs. (NESTED patterns and parameter-position destructuring remain the follow-ups.) ~242k differential checks vs Node, 0 diffs; 59 fuzzers green. ★ FUNCTION PARAMETER DESTRUCTURING — `function f({a, b})`, `({a, b}) => …`, the options-object idiom ★ The destructuring machinery now reaches the place real APIs use it most: a parameter can be an object or array pattern (`function connect({host, port})`), with field defaults (`{a, b = 1}`), renaming (`{a: x}`), and — folded in — plain simple-parameter defaults (`function f(a, b = 10)`). Three coordinated fixes made it work: (1) `callFn` now splits BOTH the parameter list AND the argument list with the bracket-aware `patFields` (not bare `,`) — so a pattern param `{a, b}` and an object-literal argument `{a:1, b:2}` each survive as ONE unit instead of being shredded at their internal commas (this also fixed a latent bug: passing an object/array literal as an argument to ANY user function was previously broken); (2) `funcValueOf` now locates the body brace AFTER the parameter list's closing `)` (it had grabbed the FIRST `{`, which for a pattern param is the pattern's own brace, not the body's); (3) `bindParams` binds a `{`-or-`[`-leading param by destructuring the argument value via `destructureObj`/`destructureArr` (reusing the exact declaration machinery + `defaultOr`), handles a simple-param default, and — via a new `argAt` — treats a MISSING argument as `undefined` (JS semantics; this also retired a latent out-of-bounds crash when a function was called with fewer args than params — a missing arg used to panic on `item i of args`, now it's `undefined` and defaults fill in). Object/array/rename/field-default params, arrow-param destructuring, simple-param defaults (present and absent), and mixed `f(a, {b, c})` all agree with Node. A dedicated fuzzer (`fuzz/jsint/paramdestructure-diff.mjs`): ~3k programs across 6 seeds, 0 diffs. (Whole-param pattern defaults `{a} = {}` and nested param patterns remain follow-ups; a missing arg with no default used in ARITHMETIC still hits the NaN gap.) ~245k differential checks vs Node, 0 diffs; 60 fuzzers green. ★ MEMBER-TARGET ARRAY MUTATION — `o.items.push(x)`, `state.list.pop()`, `a[i].push(x)` ★ The in-place mutation story now reaches nested state — the natural idiom of building an array inside an object field (or an array element) in a loop. The keystone is a single SHIFT-LEFT: a new `assignTarget(target, value, env)` helper writes a value to ANY assignable target — a bare variable (`envSet`), a member `o.key` (`objSet`), or an index `a[i]` (`arrSetIdx`) — and `push`/`pop` now compute the new array (`arrPush`/`arrPop` over the CURRENT value read via `jsEvalIn` of the receiver, so a `o.items` receiver reads through the object) and hand it to `assignTarget`. So `o.items.push(3)`, `s.list.push(i*i)` inside a for-loop, `o.xs.pop()`, and even an array-element receiver `a[0].push(9)` all mutate the right cell. The same `assignTarget` DRY-replaced the inline member/index write in the `=` handler — one write-to-target path now serves `=`, `push`, and `pop` (and the compound rewrites that route through `=`), so the assignment fuzzers still pass unchanged. A dedicated fuzzer (`fuzz/jsint/memberpush-diff.mjs`) builds/shrinks arrays held in object fields and array elements, in and out of loops: ~3k programs across 6 seeds, 0 diffs. (Single-level receiver — a two-level nested `o.a.b.push(x)` carries the same nested-member limitation as nested assignment.) ~248k differential checks vs Node, 0 diffs; 61 fuzzers green. ★ COMMON METHOD COMPLETIONS — `String.replaceAll` + `Array.findIndex` ★ Two everyday methods that were missing: `replaceAll` (replace EVERY occurrence, where only first-occurrence `replace` existed — a real gap real code hits constantly) and `findIndex` (the index of the first element a predicate accepts, or −1 — the index-returning sibling of `find`). `strReplaceAll` scans the ORIGINAL string left-to-right, appending `before + replacement` and recursing on the remainder AFTER the match — so it never re-scans the replacement (no infinite loop even when the replacement contains the search), matching JS. `arrFindIndex` mirrors `arrFind` but returns `i - 1` (0-based) or −1. Two new `leftmostMethod` markers + two dispatch branches (position-order dispatch handles the `replace`-is-a-prefix-of-`replaceAll` / `find`-of-`findIndex` overlap cleanly — the marker requires the method name immediately followed by ` (`, so `replaceAll (` never matches `replace (`). Both compose and chain (`"path/to/file".replaceAll("/","-").toUpperCase()`, `a.findIndex(x => x % 2 === 0)`). A dedicated fuzzer (`fuzz/jsint/methods2-diff.mjs`) throws random replaceAll (incl. remove-all and chained) + findIndex (found/not-found) at random strings/arrays: ~3k programs across 6 seeds, 0 diffs. (Empty search string for replaceAll — JS inserts between every char — is scoped out.) ~251k differential checks vs Node, 0 diffs; 62 fuzzers green. ★ `Object.fromEntries` + `Object.assign` — completing the Object.* static family ★ `Object.fromEntries(pairs)` builds an object from an array of `[key, value]` pairs — the inverse of `Object.entries`, so `Object.fromEntries(Object.entries(o))` round-trips and `Object.fromEntries(entries.map(e => [e[0], e[1]*2]))` transforms. `Object.assign(target, ...sources)` merges all its object arguments left-to-right (later keys win) into a fresh object and returns it — the merge idiom `Object.assign({}, defaults, overrides)`. `objFromEntries` folds each pair via `objSet` (key `materialize`d, value kept); `objAssign` evaluates each argument object and folds its entries via `objSet` (which dedups first-position/last-value, giving JS override semantics). Both are literal-prefix dispatches like `Object.keys`. Building `assign` surfaced a real bug — the arguments were split with `splitArgsN` (paren-depth only), so a multi-key object-literal argument `{a:9, b:2}` was shredded at its internal comma (parse-`b`-as-int panic); FIXED by switching to the bracket-aware `patFields` (the same `{}`/`[]`/`()`-depth splitter destructuring uses), so object-literal arguments survive whole. A dedicated fuzzer (`fuzz/jsint/objstatics-diff.mjs`) merges/overrides/round-trips random objects (byte-exact via JSON.stringify, insertion key order): ~3k programs across 6 seeds, 0 diffs. (Value-semantic — `assign` returns the merged object correctly; it does not mutate the `target` variable in place, the same aliasing limitation as elsewhere.) ~254k differential checks vs Node, 0 diffs; 63 fuzzers green. ★ `Array.from` + `Array.of` — the construction / range-building family ★ `Array.of(...)` is the variadic array literal (`Array.of(5)` = `[5]`, unlike `Array(5)`). `Array.from(source[, mapFn])` builds an array from an ARRAY (a copy), a STRING (its chars, encoding-preserving), or an array-like `{length: n}` (`[undefined]×n`) — and, with the optional `(element, index)` mapFn, powers the ubiquitous range idiom `Array.from({length: n}, (_, i) => expr)` = `[0,1,4,9,…]`. `arrFromBase` dispatches the source by tag; `arrFromMapLoop` calls the mapFn per element with the index. The mapFn form needed a robust indexed call: `callFnIdx` binds the element to the first param and the index to the SECOND only when the mapFn actually declares two (so a single-param `x => x*2` and a two-param `(_, i) => i` both work, without the shredding a comma-joined `el,idx` args string would cause on string values). Both compose downstream (`Array.from({length:4}, (_,i)=>i+1).reduce((a,b)=>a+b, 0)`, `Array.from(str).map(...)`). A dedicated fuzzer (`fuzz/jsint/arrayfrom-diff.mjs`) throws range/mapped/string/array-copy Array.from + variadic Array.of: ~3k programs across 6 seeds, 0 diffs. ~257k differential checks vs Node, 0 diffs; 64 fuzzers green. ★ `for…in` LOOPS ★ Completing the loop set (classic-for / for-of / for-in): `for (let k in obj) { … }` iterates the object's enumerable KEYS in insertion order as strings, and `for (let i in arr)` iterates the index strings `"0".."n-1"`. `execFor` branches on ` in ` in the header (a classic `for(init;cond;update)` has no ` in `, a for-of has ` of ` and is checked first); `execForIn` binds the loop var to each key of `forInKeys(value)` — `objKeys` for an object, generated index strings for an array — and reuses the same `forOfLoop` driver, so the key (a string) reads through `o[k]`. The idioms work: concat keys, `for (const k in o) { t += o[k] }` (sum values), collect keys into an array via push, count. A dedicated fuzzer (`fuzz/jsint/forin-diff.mjs`) sums/collects/counts over random objects + array index iteration under let/const: ~3k programs across 6 seeds, 0 diffs. ~260k differential checks vs Node, 0 diffs; 65 fuzzers green. ★ `Array.flatMap` + a `leftmostMethod` REFACTOR that removed a latent depth landmine ★ `flatMap(f)` maps each element then flattens ONE level — `arrFlatMap` simply composes the existing `arrMap` + `arrFlat`, and (like JS) a scalar-returning callback flattens too. But adding its dispatch marker made `leftmostMethod`'s deeply-NESTED `betterMarker(expr, m, betterMarker(expr, m, …))` chain — one call per method marker, ~31 deep — finally blow the LOGOS parser's AST depth ceiling (`AstTooDeep depth 33 > max 32`). Rather than shave a marker, the chain was REWRITTEN into the natural shape: a flat `[…markers…]` Seq literal folded by a tail-recursive `leftmostOf` that tracks the running best (smallest `mpos`), earliest-in-list winning ties. Same leftmost-position dispatch semantics, now O(markers) with constant AST depth — so the method table can grow without limit (a real ceiling that would have blocked every future method is gone). The refactor is behavior-identical: all method chaining/dispatch fuzzers stay green. A dedicated fuzzer (`fuzz/jsint/flatmap-diff.mjs`) throws duplicate-expand/identity/scalar/split-expand/filter-then-flatMap: ~3k programs across 6 seeds, 0 diffs. ~263k differential checks vs Node, 0 diffs; 66 fuzzers green. ★★ THE NaN MODEL — the last crash class, eliminated ★★ Arithmetic on a non-numeric operand PANICKED (`Cannot parse 'undefined' as Int` — a hard `Result::unwrap` crash), and it was reachable by ordinary-if-buggy programs: a missing destructured key or a missing function argument used in math (`let {a,b,c}={a:1,b:2}; a+b+c`, `function f(a,b){return a+b}; f(1)`, `o.missing + 1`). NaN is now a first-class bare-token value `NaN` woven through every path: (1) the arithmetic value path (`arithValue`) first COERCES `null→0`, `true→1`, `false→0` (JS numeric coercion), then — if any operand token is non-numeric (`undefined`, a prior `NaN`, a function, anything not an int or an arithmetic operator, via `isIntStr`/`isArithOp`/`arithBadTok`) — yields `NaN` instead of calling `parseInt`; so `1+undefined`=NaN, `0/0`=NaN, `null+5`=5, `true+1`=2, and NaN PROPAGATES (`x+5` where x is NaN = NaN); (2) `cmpVals` no longer `parseInt`-panics — it falls back to string comparison for non-numeric operands, so `undefined < 5`=false and `undefined == undefined`=true come out right; (3) the four equality operators special-case NaN via `eitherNaN` — NaN is never equal to anything, so `x === x`=false and — the canonical NaN detector — `x !== x`=true when x is NaN (and stays correct, `n === n`=true, for real numbers); (4) `boolOf(NaN)`=false (NaN is falsy); `typeof NaN`="number" (already correct, falls through). A dedicated fuzzer (`fuzz/jsint/nan-diff.mjs`) throws undefined-arithmetic / missing-key / missing-arg / propagation / null+bool coercion / self-check / falsiness / typeof: ~3k programs across 6 seeds, 0 diffs. (Scoped edge: the loose-equality specials `undefined == null` → JS true, ours false — a rare corner of `==` semantics, noted.) The engine no longer crashes on ANY arithmetic — the model-redesign item that had been deferred all campaign is DONE. ~266k differential checks vs Node, 0 diffs; 67 fuzzers green. ★ NESTED MEMBER TARGETS — `o.a.b = v`, `o.a.b.c = v`, `o.a.b.push(x)`, `o.p.q += n` ★ Writing through a multi-level member path had been the standing limitation across every member mutation (assignment, compound, push all `substringBefore(target, " . ")`-split at the FIRST dot, so `o.a.b` wrote a garbage `"a . b"` key). Because they ALL route through the shared `assignTarget`, ONE fix closes them together: a recursive `objSetPath(objval, segs, i, v)` descends the whole `.`-path — read each intermediate object (`objGet`), recurse to set the deepest key, then rebuild each level outward with `objSet` — value-semantically. So `o.a.b.c = 42`, nested push `o.a.b.push(2)`, nested compound `o.p.q.r += 10`, add-a-key-at-depth `o.a.c = 2`, and nested-accumulate-in-a-loop (`for(…){ o.s.count += i }`) all work, byte-exact. Single-level writes are the length-1 path (identical behavior — regression clean). A dedicated fuzzer (`fuzz/jsint/nestedmember-diff.mjs`) mutates 2- and 3-level object paths via set / push / compound / loop: ~3k programs across 6 seeds, 0 diffs. (An intermediate key that doesn't exist — `o.x.y = v` with `o.x` undefined — JS throws; ours is undefined-behavior there, a malformed-program edge. Mixed member/index paths `a[i].k = v` beyond one level remain a follow-up.) ~269k differential checks vs Node, 0 diffs; 68 fuzzers green. ★ COMPUTED PROPERTY KEYS `{[k]: v}` + MULTI-DECLARATION `let a=1, b=2` ★ A dynamic object key — `{[key]: v}`, `{[a+b]: v}`, `{["k"+i]: v}` — now evaluates its `[expr]` to the actual key: by the time `buildObj` runs, variables in the key are already substituted, so `objKeyOf` detects a `[`-leading key part and evaluates the bracketed expression (`evalResolved` + `materialize`) instead of taking it literally. Testing it surfaced a real PRE-EXISTING gap the fresh NaN model had just turned from a crash into a visible `NaN`: `let a=1, b=2` — comma-separated MULTI-DECLARATION — only ever bound the first variable (`b` was left undefined, so a later `a+b` was NaN). Fixed in `bindAssign`: split the declaration on top-level commas with the bracket-aware `patFields` (so an object/array/function-literal RHS with its own commas stays ONE declaration) and bind each via `bindOne` (the former single-binding body). So `let a=1, b=2, c=3`, `let a=[1,2], b=[3]`, `let f=function(a,b){…}, g=3`, and object literals `let o={a:1,b:2}` (comma is not a declaration separator) all bind correctly, and computed arithmetic keys `{[a+b]: v}` now work because both operands are bound. (Two arg-order E0382s along the way — clone the recursion arg / compute the bound env in a Let first, the by-now-familiar pattern.) Wiring the multi-decl split then caught a THIRD bug (a regression the integration suite flagged): the bracket-aware comma splitter `patFieldSplit` was not STRING-aware, so `let nums = "10,20,30".split(",")` split at the commas INSIDE the string literal. Fixed by giving `patFieldSplit` a quote-toggle (a `"` flips string mode; inside a string, commas/brackets are literal) — and the same latent bug lived in the object-literal entry splitter `splitObjEntries`, so it got the identical fix (now `{a: "1,2", b: 3}` and `Object.assign({}, {a: "p,q"})` keep their comma-bearing string values whole). A dedicated fuzzer (`fuzz/jsint/compkeys-diff.mjs`) mixes string/arithmetic/concat computed keys, 2- and 3-variable declarations, multi-decl arrays, AND comma-in-string declarations + object values: ~3k programs across 6 seeds, 0 diffs. ~272k differential checks vs Node, 0 diffs; 69 fuzzers green. ★ `try` / `catch` / `throw` (same-scope) ★ Exception control flow now runs, mirroring the existing `return` mechanism: `throw expr` sets an env `__throw` flag (to the thrown VALUE), and every loop/block guard now halts on `hasHalt` = `hasReturn OR hasThrow` (so a throw unwinds statement execution exactly like a return); `execTry` runs the try block and, if it threw, binds the `catch (e)` parameter to the thrown value, clears the flag, and runs the catch block. So a direct `throw`, throw-skips-the-rest-of-the-try, a throw from a nested `if`, a throw inside a loop body caught per-iteration, the caught value's use (`e.length`), and custom catch-param names all agree with Node. A dedicated fuzzer (`fuzz/jsint/trycatch-diff.mjs`): ~3k programs across 6 seeds, 0 diffs. DOCUMENTED LIMITATION: a throw inside a CALLED FUNCTION does not propagate to the caller's `catch` — `callFn` returns the function's `__ret` value, and the expression-evaluation return path is env-less, so the callee's `__throw` can't thread back up without making the whole eval pipeline throw-aware (a real architectural change; same-scope throw is the shipped subset). `finally` is also a follow-up. ~275k differential checks vs Node, 0 diffs; 70 fuzzers green. ★ `Number.isNaN` / `Number.isInteger` / `Number.isFinite` ★ The type-predicate statics that pair with the fresh NaN model — and, unlike the coercing global `isNaN`, these do NO coercion: `Number.isNaN(x)` is true ONLY for the actual NaN value (so `Number.isNaN("NaN")`=false — a string is not the NaN number, and `Number.isNaN(1+undefined)`=true), and `Number.isInteger` / `Number.isFinite` are true for a real integer but false for NaN AND for a numeric STRING (`Number.isInteger("5")`=false). Literal-prefix dispatches like `Array.isArray`, reusing the NaN model's `isIntStr`. A dedicated fuzzer (`fuzz/jsint/numberstatics-diff.mjs`) throws int / NaN / numeric-string / arithmetic arguments at all three: ~3k programs across 6 seeds, 0 diffs. ~278k differential checks vs Node, 0 diffs; 71 fuzzers green. ★ VARIADIC `Math.max` / `Math.min` + SPREAD ★ The 2-argument `Math.max`/`Math.min` are now fully variadic AND spread-aware — `Math.max(a, b, c, …)`, and the everyday `Math.max(...arr)` / `Math.min(...arr)` max-of-an-array idiom, plus mixed `Math.max(x, ...arr, y)`. The dispatch runs the argument text through `expandSpreadArgs` (reused from call spread — expands each `...expr` to the array's comma-joined elements), splits with the paren-aware `splitArgsN`, and folds `maxFold`/`minFold` over all the evaluated arguments. Nested Math (`Math.max(Math.min(…), …)`) and the plain 2-arg form still work, and it composes with map (`Math.max(...arr.map(f))`). A dedicated fuzzer (`fuzz/jsint/mathvariadic-diff.mjs`) throws variadic-literal / spread-array / mixed / 2-arg / map-then-spread / nested-Math programs: ~3k programs across 6 seeds, 0 diffs. ~281k differential checks vs Node, 0 diffs; 72 fuzzers green. ★ `String.trimStart` / `String.trimEnd` ★ The one-sided whitespace trims: `trimStart` drops only leading spaces (trailing + internal kept), `trimEnd` only trailing — reusing the exact `trimHeadIdx`/`trimTailIdx` scan `.trim` uses (over our encSpace-encoded spaces). Two `leftmostMethod` markers + dispatch branches; position-order dispatch cleanly handles `trim` being a prefix of `trimStart`/`trimEnd` (the marker requires the name immediately followed by ` (`). Chaining `s.trimStart().trimEnd()` equals `s.trim()`. A dedicated fuzzer (`fuzz/jsint/trimside-diff.mjs`) brackets the result to expose kept spaces across trimStart/trimEnd/trim: ~3k programs across 6 seeds, 0 diffs. ~284k differential checks vs Node, 0 diffs; 73 fuzzers green. ★ `Array.prototype.fill` ★ `arr.fill(value)` replaces every element with `value`. Works as an EXPRESSION (returns the filled array, chains — `[1,2,3].fill(0)`, `Array.from({length:n}).fill(0)` the array-init idiom) AND as an in-place STATEMENT (`a.fill(v)` rebinds the variable, an `execStmt` handler mirroring `sort`/`push`). `arrFillLoop` builds `n` copies of the value; length is preserved. A dedicated fuzzer (`fuzz/jsint/fill-diff.mjs`) throws expression/in-place/init-idiom/chain-after-map/string-value fills: ~3k programs across 6 seeds, 0 diffs. (Ranged `fill(v, start, end)` is out of scope. Probing fill surfaced a separate PRE-EXISTING gap for a future increment: `.map`/`.filter` don't pass the element INDEX to the callback — `[…].map((x, i) => i)` sees `i` as undefined, because `arrMap` calls the single-arg `callFn`; `Array.from`'s mapper is index-aware via `callFnIdx`, so switching the array HOFs to `callFnIdx` would close it.) ~287k differential checks vs Node, 0 diffs; 74 fuzzers green. ★ HOF ELEMENT INDEX — `map`/`filter`/`find`/`findIndex`/`some`/`every` `(x, i) => …` ★ Closing the gap the `fill` probe surfaced last entry: the array higher-order methods now pass the element INDEX as the callback's second argument. All six loops (`arrMapLoop`/`arrFilterLoop`/`arrSomeLoop`/`arrEveryLoop`/`arrFindLoop`/`arrFindIndexLoop`) switched from the single-argument `callFn` to the index-aware `callFnIdx` (the same helper `Array.from`'s mapper uses), passing the loop's 0-based position — and because `callFnIdx` binds the second parameter ONLY when the callback declares it, single-parameter callbacks (`x => x*2`, `x => x>1`) are completely unchanged. So `[10,20,30].map((x,i)=>i)`=`[0,1,2]`, `arr.map((x,i)=>x+i)`, `arr.filter((x,i)=>i%2===0)`, `findIndex`/`some`/`every` with an index predicate all agree with Node, and the previously-broken `Array.from({length:3}).fill(0).map((x,i)=>i)` now yields `0,1,2`. A dedicated fuzzer (`fuzz/jsint/hofindex-diff.mjs`) mixes index-using and single-param callbacks across the HOFs: ~3k programs across 6 seeds, 0 diffs. (reduce's 3rd index arg needs a `callFn3` — a follow-up.) ~290k differential checks vs Node, 0 diffs; 75 fuzzers green. ★★★ `bun run file.js` — THE LOGOS BUN NOW EXECUTES REAL JAVASCRIPT FILES ★★★ jsint graduated from a test hook (`__js`) to the actual PRODUCT surface: `bun run <file.js>` (and bare `bun <file.js>`) reads a JavaScript file and runs it end-to-end through the LOGOS engine, with `console.log` printing to stdout — byte-for-byte identical to Node. Two tiny toolchain natives made it possible (added to logos-bun-toolchain, the same env.rs + codegen/program.rs pattern as `eputs`/`exitWith`): `readFile(path)` (a plain-Text file slurp) and `puts(s)` (stdout write, NO auto-newline, flushed — the faithful sink, since a `console.log` line already carries its own `\n`). On the LOGOS side: a `console.log(...)` statement handler (`doConsoleLog`) evaluates its arguments, space-joins their `materialize`d + `decodeStr`'d text, and `puts` them with a trailing newline in REAL time during execution; `jsRunFile` slurps → `normalizeJs` → `runBlock`s the whole program (so `console.log` side-effects fire in order); and the CLI dispatch routes `run` / a `looksLikeScript` (`.js`/`.mjs`/`.cjs`/`.ts`) argument to it. A real multi-feature program — recursion (`fib`), destructuring-with-defaults, template literals, HOF chains (`.map().filter()`), member mutation in a loop, `try/catch`, `Array.from`, `Math.max(...spread)` — runs byte-identical to Node. Wiring the whole-file fuzzer immediately caught two more instances of the string/bracket-splitter bug class: `console.log([a,b].map(…))` (array-literal argument) and `Math.max(...[a,b])` (array-literal spread) both split at the literal's internal commas — fixed by switching `doConsoleLog` and `expandSpreadArgs` from the paren-only `splitArgsN` to the bracket+quote-aware `patFields`. A dedicated whole-program fuzzer (`fuzz/jsint/runfile-diff.mjs`) WRITES each generated program to a temp `.js` and runs it through `bun run file.js` AND `node file.js`, requiring byte-identical stdout: ~720 whole programs across 6 seeds, 0 diffs. (`console.log` of objects/arrays uses `String()` semantics, not Node's fancy `util.inspect` — a noted formatting limitation.) ~293k differential checks vs Node, 0 diffs; 76 fuzzers green. ★ `console.error` / `console.warn` / `console.info` — the rest of the console ★ Completing the console API for real scripts: `console.info` prints to STDOUT (same as `log`, via `puts`), while `console.error` and `console.warn` print to STDERR (via `eputs`) — so a program's diagnostics land on the right stream, exactly like Node. `doConsoleErr` mirrors `doConsoleLog` but routes to `eputs`; four `console . <fn> (` statement handlers dispatch. The whole-file fuzzer now emits to BOTH streams and compares stdout AND stderr (joined with a `\x01` sentinel): `console.log`/`info` → stdout, `console.error`/`warn` → stderr, byte-identical to Node on each. ~720 whole programs across 6 seeds, 0 diffs. ~296k differential checks vs Node, 0 diffs; 76 fuzzers green. ★ `process.exit([code])` ★ A running script can now terminate itself with an exit code: `process.exit(3)` stops execution immediately and exits the process with status 3; `process.exit()` exits 0. `doExit` evaluates the (optional) argument and calls the `exitWith` native (which diverges via `std::process::exit`), so statements after it never run — matching Node's output AND exit code byte-for-byte (`process.exit(3)` → "before exit" on stdout, code 3, nothing after; `process.exit()` inside a taken branch → code 0, the rest skipped). ~296k differential checks vs Node, 0 diffs; 76 fuzzers green. ★ `process.argv` — scripts read their CLI arguments ★ First step of the approved "grind to M5" plan (product-win interleave): `bun run script.js foo bar` now exposes `process.argv` to the script as `[execPath, scriptPath, "foo", "bar"]`, so the everyday `process.argv.slice(2)` / `process.argv[2]` / `process.argv.length` / `for (const a of process.argv.slice(2))` idioms work byte-identical to Node on argv[2..] (the user args). The run dispatch builds an argv array value (`argvBuild` over the CLI `arguments` Seq — called directly with the real Seq, dodging the BUG-33 forwarded-Seq-param mis-type) and `jsRunFile` binds a `process` object (`{argv: […]}`) into the program's initial env, so member/index/method access resolves normally. Building it surfaced + fixed a real PRE-EXISTING bug: one-argument `.slice(2)` (no end) crashed — the handler `parseInt`'d an empty end → `NaN` → panic; fixed with `sliceEnd`, which defaults a missing end to the full length (`arr.slice(2)`, `str.slice(1)` now work). The whole-file fuzzer (`runfile-diff.mjs`) now passes random CLI args and asserts `process.argv.slice(2)` matches Node: ~720 programs across 6 seeds, 0 diffs (stdout+stderr). ~299k differential checks vs Node, 0 diffs; 76 fuzzers green. (`process.env` is the next product step.) ★ `process.env` — scripts read environment variables ★ `process.env.X` now reads env vars: a `resolveProcessEnv` pass (run FIRST in jsEvalIn, before substitute rewrites the `process` binding) rewrites `process . env . KEY` to the value-model string of a new plain-Text `getEnv` native (env::var, "" if unset), with `encodeRaw` protecting spaces/brackets so a real env value flows through the engine. So `process.env.NODE_ENV`, `process.env.X || "default"`, and method chains on the value (`.toUpperCase()`) all work byte-identical to Node. (Whole-`process.env`-as-object, bracket access `process.env[k]`, and the unset→undefined vs "" edge are noted follow-ups.) ~299k differential checks vs Node, 0 diffs; 76 fuzzers green. ★★ E0 STARTED — the mutable object HEAP primitive (the keystone for reference semantics) ★★ The approved grind-to-M5 plan makes an object-identity/aliasing value model the critical path: jsint today is value-semantic (`let p=o` copies o s blob, so a mutation through p can t be seen through o, and `{}===\{}` can t be false), which structurally blocks classes/Map-Set/async and thus test262. E0 lands incrementally under the 76-fuzzer net; step one is the SEAM, added additively so the working engine is untouched: a thread-local mutable HEAP in the toolchain (`heap_alloc`/`heap_get`/`heap_set` in logicaffeine_system::env, mapped in codegen) where an object s blob will live behind a HANDLE, mutated write-through. A `__heap-probe` proves the primitive: alloc "v1" → COPY the handle (`let alias=h`) → `heapSet(alias,"v2")` → `heapGet(h)`=**"v2"** (a value-copy model would return "v1"), i.e. a copied handle shares the mutable cell = real aliasing. Purely additive: all 76 fuzzers stay green. NEXT: migrate object construction/access/mutation/=== to handles, re-greening the object fuzzers, then arrays, then delete the string-container path. ~299k differential checks vs Node, 0 diffs; 76 fuzzers green. Classic-for / for-of / for-in, all three spread forms (array/object/call), all HOF (map/filter/reduce/some/every/find/findIndex/flatMap), sort, Array.from/of, destructuring (declarations + defaults + PARAMETERS), multi-declaration, computed keys, Object statics (keys/values/entries/fromEntries/assign), NaN, JSON both ways, switch, exponent, templates, escapes, and member/index MUTATION (plain + compound + method, NESTED) now run — the engine executes genuinely idiomatic modern JavaScript, written entirely in an English programming language. This is the
seed the Futamura projections will eventually specialize into a JIT. Remaining toolchain
gaps: cross-module functions (BUG-24), TCE nested-concat (BUG-29), atomics._

---

**P7 ENGINE — E0 HEAP VALUE MODEL (objects → reference semantics):** the jsint value model
was flat tagged Text with *value* semantics — `let p = o` copied the blob, so a write through
`p` was invisible through `o`, and `{} === {}` could never be false. That is a structural
dead-end for classes, Map/Set-by-identity, and an async event loop (thousands of tests).
E0 introduces a real **heap**: an object becomes a HANDLE (`tagRef + heapId`, `tagRef = chr(2)`)
into a native thread-local `Vec<String>` heap (`heap_alloc`/`heap_get`/`heap_set` in the
toolchain's `logicaffeine_system::env`); the mutable blob lives in the cell; a member write is a
write-**through** (`heapSet`), so every alias sees it and identity is real. Every object
constructor now allocates a handle (`newObjRef` — object literals, `JSON.parse`, `Object.assign`,
`Object.fromEntries`, `process`), every reader `derefObj`s the handle first, and the nine
`is-object` identity checks moved from `startsWith(v, tagObj())` to `isRef(v)`. `Object.assign`
was rewritten to mutate and **return the target** (same identity), matching JS. **Two bugs found
& fixed along the way:** (1) `tagRef` was first `chr(12)` (form-feed) — whitespace that `trim()`
silently ate, mangling `chr12+id` → `id` (aliasing → NaN, `typeof {}` → number); moved to the
non-whitespace `chr(2)`. (2) the empty-object `{}` fast-path and `JSON.parse`'s empty/built-object
paths emitted a raw blob instead of a handle, so `typeof {}` → number and `JSON.stringify(JSON.parse("{...}"))`
→ NaN; all wrapped in `newObjRef`. Locked by a new `alias-diff` fuzzer (write-through, add-through-alias,
self/alias/distinct identity, nested-object aliasing, 3-way alias chains, `Object.assign`-returns-target)
— **77 jsint fuzzers × 3 seeds = 231 runs, 0 diffs vs Node.** Objects are now genuine references;
arrays (E0 phase 2) are next on the same heap.

---

**P7 ENGINE — E0 HEAP VALUE MODEL (arrays → reference semantics):** the array half of the
E0 rewrite, on the SAME native heap as objects — a value handle `tagRef + heapId` (tagRef =
chr(2)) can point at an object blob OR an array blob, so `derefObj`/`newObjRef` are heap-generic
and `newArr` is just the array-side alias. Landed in three fuzzer-gated substeps: **(1) readers +
detection** — `arrElements` derefs the handle (so every array reader — index, `.length`,
map/filter/reduce/slice/join/… — works on a ref for free), and the 13 array-detection
`startsWith(v, tagArr())` sites became `isArrRef` while the 8 object-detection `isRef` sites
became `isObjRef` (the `objSet` write-through gate stays `isRef`); **(2) constructors** — 26
value-producing array constructors (literals, map/filter/slice/concat/flat/from/of/reverse-as-value,
`Object.keys`/`values`/`entries`, `String.split`, `JSON.parse` arrays, `process.argv`) wrap their
blob in `newArr`, so every array value is a fresh identity; **(3) mutators** — push/pop/`[i]=`/
reverse/fill/sort write the new blob THROUGH the handle (`mutArr` → `heapSet`, return the same
ref), so an alias (`let b=a; b.push(x); a`) sees it. Locked by a new `arralias-diff` fuzzer
(push/pop/index/reverse/fill/sort through an alias, alias vs distinct identity, member-array
aliasing, `Array.isArray`, `typeof`). **78 jsint fuzzers × 3 seeds = 234 runs, 0 diffs vs Node.**
**Bugs found & fixed:** (1) the mechanical `isRef → isObjRef` sweep broke `evalValue` — its
`isRef(trim(expr))` early-return is a load-bearing *prefix* check that hands any expression
*starting* with a ref (e.g. `‹ref› . a`) to `resolveObjDot`; `isObjRef` strictly derefs, so a
ref-plus-trailing failed → fell to arithmetic → NaN, silently breaking every parenthesized /
template-literal member access (`(u.a)`, `` `${u.name}` ``). Rule banked: convert to
`isObjRef`/`isArrRef` only at clean-VALUE dispatch sites, never at expression-prefix sites. (2)
once arrays were refs, `resolveObjDot`'s `isRef(recv)` stole `.length` from arrays via
`objGet(array,"length")` → undefined; scoped it to `isObjRef` (object dot-access only; arrays
route to `resolveProps`/`resolveArrays`). (3) `Array.isArray` still tag-matched the raw blob →
`isArrRef`. (4) `reverse` had no statement handler (sort/fill/push/pop did) so a bare
`a.reverse();` never rebound the var — added one. Objects AND arrays are now genuine
references; E0 is complete. E1 (classes/prototypes) is next.

---

**P7 ENGINE — E1 FOUNDATION (object methods + `this` + `new` constructors):** the building
blocks for classes, on top of the E0 heap. **(1) Method calls with `this`** — a function-valued
property called as `obj.method(args)` now dispatches through a new `callMethod` that binds `this`
to the receiver's heap ref, so `this.x` reads and `this.x = v` writes the receiver's own slots
(write-through the handle — the mutation persists and every alias sees it). Wiring it took four
coordinated fixes: (a) a method-invoke branch in `resolveCalls` (`recv . name (args)` → evaluate
recv, if it's an object ref with a function-valued property, `callMethod` with `this`=recv); (b)
`resolveCalls` was *stripping the parens off a `function(){}` embedded in an object literal* (its
bare-paren fallthrough turned `function ( ) {…}` into `function  {…}`, which `funcValueOf` then
couldn't parse) → added a `function`-definition branch that encodes it opaquely (`chr1`) in place;
(c) `objValOf` builds a real function value for a `function`-valued object property; (d) `execStmt`'s
fallthrough was `Return env` — **silently dropping bare call statements**, so `obj.setMethod(v);`
never ran — now it evaluates any call-containing expression statement for its side effects. **(2)
`new F(args)`** — a `new` branch in `resolveCalls` allocates a fresh empty heap object, runs the
constructor with `this` bound to it (so `this.x = …` populates the instance), and yields the
instance: distinct identity per `new`, independent state, constructor-assigned methods callable.
**(3) User-method / built-in collision** (caught by the methodthis fuzzer — a user method literally
named `push`): a "user-method-shadows-builtin" guard at the top of `resolveMethods` (if the leftmost
method marker's receiver is an object ref with a function-valued property of that name, dispatch the
user method) plus `isArrRef` guards on the push/pop/sort/fill/reverse *statement* handlers — so
`obj.push(v)` calls the user method while `arr.push(v)` stays the built-in. Essential for classes,
whose methods can have any name. Locked by two new fuzzers, `methodthis-diff` and `ctor-diff`.
**80 jsint fuzzers × 3 seeds = 240 runs, 0 diffs vs Node.** Noted scope for now: a method embedded in
an object/array literal binds `this`+params but not outer locals (assignment/return closures still
capture); `class` sugar, `extends`/`super`/`instanceof`/static are the next E1 increments.

---

**P7 ENGINE — E1.3 CLASS SYNTAX (`class` desugar):** `class C { constructor(p){…} m(q){…} }` is
desugared (a `desugarClass`/`classWalk` pass in `normalizeJs`, after arrows) into a constructor
function whose methods are assigned onto `this` — `function C (p) { this.m = function(q){…} ; <ctor
body> }` — so the E1-foundation machinery (`new`, `callMethod`, `this` write-through) carries it
with no new runtime. `classWalk` peels one `name (params) {body}` member at a time using
`braceBody`'s accumulated length to find each matching `}` and the remainder; the `constructor`
member supplies the function's params + body, every other member becomes a `this.name = function`
assignment. Verified: field init, single/multiple methods, mutating methods, array fields with
`push`, distinct per-instance identity+state. **Three bugs fixed:** (1) **LOGOS treats a literal
`{`/`}` inside a string literal as string interpolation** — the emitted braces had to be built via
`chr(123)`/`chr(125)`, not written inline (a `.lg`-authoring gotcha worth remembering). (2) the
desugar emitted the constructor function with no `;` before the following statement — BUG-32 (a
block-closing `}` is not a statement boundary here) — so `function C(){…} let c = …` was mis-split;
the desugar now emits a `;`. (3) **a latent E0-era precedence bug** surfaced by class methods like
`peri(){return 2*(this.w+this.h)}`: `resolveCalls`'s bare-paren fallthrough evaluated a
parenthesized subexpression with a *partial* pipeline (`jsEvalTernary`, no member resolution) and
inlined the un-collapsed result, so `2*(o.w+o.h)` became `2*3+5` = 11 instead of 16 — now it
evaluates the paren inner through the full `jsEvalIn` (member resolution + arithmetic collapse) to
an atomic value, fixing member-access-inside-parens under outer arithmetic everywhere, not just in
classes. Locked by a new `class-diff` fuzzer. **81 jsint fuzzers × 3 seeds = 243 runs, 0 diffs vs
Node.** `extends`/`super`/`instanceof`/static/getters are the remaining E1 increments.

---

**P7 ENGINE — E1.4 CLASS INHERITANCE (`instanceof`, `extends`, `super`):** **instanceof** — a
class instance carries a class-ancestry chain (e.g. "B,A", most-derived first) in a native
class-tag SIDE TABLE keyed by heap handle (`class_tag_set`/`class_tag_get` in the toolchain's
`logicaffeine_system::env`, local-only), so the tag never leaks into `Object.keys`/`JSON.stringify`;
`new C()` stamps `instanceChain(C)` and a depth-aware `resolveInstanceof` (top-level `instanceof`
only — a parenthesized one is handled when the paren interior evaluates) tests chain membership. A
non-object left operand has no chain → false. **extends/super** — `class B extends A {…}` desugars to
`function B(…){ __super__ A (superArgs) ; <B methods> <B ctor body minus super> }` with the parent
recorded as `__super_B = "A"` (drives `instanceChain`, so `b instanceof A` holds through any depth).
`super(args)` is rewritten to `__super__ A (args)` and run FIRST via an `execStmt` handler that
invokes the parent constructor with THIS (`callMethod`), populating inherited fields+methods
through the heap handle; the child's own method assignments come AFTER, so a child method OVERRIDES
the parent's. Multi-level inheritance recurses naturally (parent ctor runs its own `__super__`).
**Bugs fixed:** BUG-36 struck again (an Int-returning depth scanner `topInstanceofIdx` tripped the
constant-specializer → E0308) — added a growing `Text` guard like `topTernaryQ`; and `__super_B`
stores a tagged string value, so `instanceChain` must `materialize` the parent name or the chain
gets a `\x03A` that never matches `A`. Locked by a new `classinherit-diff` fuzzer. **82 jsint
fuzzers × 3 seeds = 246 runs, 0 diffs vs Node.** Remaining E1: `static` methods, getters/setters,
private `#fields` — then E2 (async/Promise).

---

**P7 ENGINE — E1.5 STATIC METHODS:** a `static m(){…}` class member belongs to the class, not the
instance. The class desugar's `classWalk` now threads a `statics` accumulator: a `static` member is
emitted as a class-definition-time binding `__static_<Class>_<m> = function(…){…}` (rather than a
`this.m = …` instance assignment), and `resolveCalls` gains a branch that, before the object-method
check, dispatches `Class.m(args)` to that binding when it exists. So static factories
(`static of(v){ return new A(v) }`), static helpers, and mixing static + instance methods on one
class all work; `A.of(7).x`, `a.m() + A.k()` verified against Node. Locked by a new
`classstatic-diff` fuzzer. **83 jsint fuzzers × 3 seeds = 249 runs, 0 diffs vs Node.** getters/setters
and private `#fields` remain; the class model (methods, `this`, `new`, `extends`, `super`,
`instanceof`, `static`) now covers the overwhelming majority of real class usage.

---

**P7 ENGINE — E1.6 GETTERS/SETTERS (accessor properties):** `class T { get x(){…} set x(v){…} }`
completes the class feature set. An accessor member desugars to a `this.__get_x = function(){…}` /
`this.__set_x = function(v){…}` slot. Member ACCESS routes through a new `getMember` (used by
`resolveObjDot`): a plain property returns directly, but an absent one whose `__get_<prop>` slot is
a function invokes the getter with `this` bound (so `t.celsius` runs the getter body); the extra
lookup only fires on an otherwise-undefined property, keeping the hot path cheap. Member ASSIGN
routes through `assignTarget`: if the receiver has a `__set_<prop>` function it invokes it via
`callSetter`, which binds the setter's single parameter DIRECTLY to the already-evaluated RHS (no
re-evaluation) and runs the body with `this`. Verified: plain + computed getters, setter→getter
round-trips, getters inside larger expressions. Locked by a new `classaccessor-diff` fuzzer.
**84 jsint fuzzers × 3 seeds = 252 runs, 0 diffs vs Node.** The class model is now essentially
complete — methods, `this`, `new`, `extends`, `super`, `instanceof`, `static`, get/set — leaving
only private `#fields` (rare) before E2 (async/Promise). Scope: a getter body binds `this`+params
but not outer locals (uncommon for accessors).

---

**P7 ENGINE — E2.1 PROMISE FOUNDATION (Promise.resolve/reject, .then, chaining, microtask
ordering):** the first slice of async. The engine is synchronous, so a Promise is a heap object
carrying `__pstate` (fulfilled/rejected/pending), `__pvalue`, and `__preactions` (reactions
registered by a `.then` that ran before the promise settled). `Promise.resolve(v)` yields a
fulfilled promise (or v itself if already a promise); `Promise.reject(e)` a rejected one.
`p.then(f)`: if p is fulfilled, a microtask holding (f, value, result-promise-id) — a heap object
referenced by id on a native FIFO **microtask queue** (`mt_push`/`mt_pop`, thread-local VecDeque in
the toolchain, local-only) — is enqueued; if p is pending, a {fn,res} reaction is appended to its
`__preactions`. `jsRun`/`jsRunFile` **drain** the queue after the main script: each job runs its
callback on its value and `settlePromise`s the job's result promise, which enqueues that promise's
own reactions — so **chained `.then().then()` resolves in order and microtask ordering is exact**
(`Promise.resolve().then(f); g()` runs g before f; verified `[2,1]`, `[a,b,c]`, 3-deep chains).
**Bug found & fixed:** `console.log` was statement-only, so an arrow callback `x=>console.log(x)`
(desugared to `return console.log(x)`) printed nothing — added a `console.log` case to the `return`
handler (a general fix for any callback logging), NOT to `resolveMethods` (which would have fired
on `console.log` inside un-executed function bodies, printing prematurely). Locked by a new
`promise-diff` fuzzer (whole programs diffed vs Node via `bun run`). **85 jsint fuzzers, 0 diffs.**
Next: `new Promise(executor)`, `.catch`/`.finally`, `Promise.all`, then `async`/`await`.

---

**P7 ENGINE — E2.2 `new Promise(executor)`:** wrapping a callback API as a promise. `new
Promise((resolve, reject) => {…})` allocates a pending promise, then runs the executor
synchronously with `resolve`/`reject` bound to **sentinel tokens** `__PRES__<id>` / `__PREJ__<id>`
(id = the promise's heap handle). When the executor calls `resolve(v)` / `reject(e)`, `resolveCalls`
recognizes the sentinel (checking the *value* of the callee — `envGet(env, name)` — since it runs
before substitution) and `settlePromise`s that promise; single- and double-parameter executors both
work (`bindReject` binds the second only when present). Chaining and `.then` on the result work as
in E2.1. Verified: `new Promise(res=>res(42)).then(log)` → 42, 2-param, chained, `let p = new
Promise(...)`. `promise-diff` fuzzer extended with `new Promise` cases. **85 fuzzers, 0 diffs.**
`.catch`/`.finally`/`Promise.all` and `async`/`await` remain.

---

**P7 ENGINE — E2.3 async/await:** modern async syntax on the synchronous-drain model. `await p`
is handled in `jsEvalIn` (a leading-`await ` prefix): it evaluates the operand, and if the result
is a promise it **drains the microtask queue** (settling any pending `.then` chain), then reads the
promise's `__pvalue` — so `await Promise.resolve(x).then(f)` yields the fully-resolved value; a
non-promise operand is its own value. `async` adds no new control flow here, so `stripAsync`
(a `normalizeJs` step, after `normJs` so string spaces are already chr4-encoded and untouched)
removes it: `async function` → `function`, `async (` / `async x =>` → the plain arrow. An async
function then runs like any function and `await` extracts its awaited values inline. Verified:
`await Promise.resolve`, multiple sequential awaits, `await` of another async function's return,
`await` of a `.then` chain, and `async () => {…}` arrows — all match Node. `promise-diff` fuzzer
extended with async/await programs. **85 fuzzers, 0 diffs.** Scope: `asyncFn().then(...)` (result
used without `await`) doesn't yet auto-wrap the return in a promise; `.catch`/`.finally`/
`Promise.all` and generators (E3) are next.

---

**P7 ENGINE — E2.4 `.catch` / `.finally` (reaction model):** to handle rejection paths the promise
reaction was generalized from a single `fn` to `{onF, onR, onFin, res}`. `settlePromise` now passes
its state to `reactOne`, which fires the matching handler: a fulfilled promise runs `onF` (or passes
its value straight through to the reaction's result promise when there is none); a rejected promise
runs `onR` (or propagates the rejection) — so a rejection flows through `.then` to a downstream
`.catch`. `.then(f)` registers `{onF:f}`, `.catch(f)` registers `{onR:f}`. `.finally(f)` is
transparent: `onFin` runs `f` for its side effect against a throwaway promise and settles the result
with the *original* state+value (a settled promise is mirrored directly; a pending one registers an
`onFin` reaction). Verified: `Promise.reject(e).catch`, rejection-through-`.then`-to-`.catch`,
`new Promise(rej).catch`, `.finally` after both resolve and reject and mid-chain (value passes
through). `promise-diff` fuzzer extended with catch/finally programs. **85 fuzzers, 0 diffs.**
`Promise.all`/`.race`/`.allSettled` and generators (E3) remain.

---

**P7 ENGINE — E2.5 `Promise.all`:** `Promise.all([...])` drains the microtask queue so every element
settles, then fulfills with an array of the resolved values **in order** (a non-promise element is
its own value), or rejects with the first rejection reason found. Verified: all-resolve →
value array, non-promise elements, elements that are pending `.then` chains (drained), and a mixed
array with a rejection routing to `.catch`. `promise-diff` fuzzer extended with `Promise.all`
programs. **85 fuzzers, 0 diffs.** The Promise surface is now broad — `resolve`/`reject`/`then`/
chaining/`new Promise`/`async`/`await`/`catch`/`finally`/`all` — with exact microtask ordering.
`Promise.race`/`allSettled`/`any` and generators (E3) remain.

---

**P7 ENGINE — E3 GENERATORS (`function*` / `yield` / `.next()` / for-of / spread):** the engine has
no coroutines, so generators use an **eager-collect** model. `function* g(params){ body }` desugars
(`desugarGenerators` in `normalizeJs`) to a normal function that brackets its body with `__GENRESET`
(push a fresh yield buffer onto a native STACK — `gen_reset`/`gen_push`/`gen_snapshot`, thread-local
in the toolchain, local-only; a stack so a generator running another nests) and `return __GENMAKE`
(pop the buffer and package the collected yields as a generator object `{__gen_values, __gen_idx}`).
`yield X` is an `execStmt` case that pushes `X` onto the active buffer. `.next()` (a `resolveMethods`
case gated on `isGenerator`) advances `__gen_idx` through the heap handle, returning `{value, done}`;
`for-of` and spread route through a new `iterElements` (a generator yields `__gen_values`, an array
yields itself). This runs any FINITE generator, including loop-driven ones
(`function* range(n){ while(i<n){ yield i; i=i+1 } }` → 0..n-1); an infinite `while(true) yield`
can't be pre-collected (noted). Verified: fixed + computed + loop yields, `.next().done` exhaustion,
for-of, and `[...g()]` spread — all match Node. New `generator-diff` fuzzer. **86 jsint fuzzers,
0 diffs.** E4 regex, E5 (Map/Set/Symbol/BigInt/Date/bitwise), E6 modules remain.

---

**P7 ENGINE — E4.1 REGEX (backtracking matcher + `new RegExp`/`.test`/`.match`):** JS regex needs
backreferences/lookahead that Rust's `regex` crate lacks, so the matcher is **hand-rolled in LOGOS**.
`matchHere` recursively matches a pattern position against a text position with greedy `* + ?`
backtracking (`starBacktrack` counts how many atoms match then retries longest-first); an atom is a
literal, `.`, an escape (`\d \w \s` + `\D \W \S`), or a `[...]` class (ranges + `^` negation). `^`
anchors at `reTest`; `$` is checked in `matchHere`. Exposed to JS as a RegExp heap object
(`{__regex_src, __regex_flags}`): `new RegExp(src)`, `re.test(str)` (a `resolveMethods` case gated on
`isRegex`), and `str.match(re)` (returns `[match]` or `null`). **Bug found & fixed:** string values
carry their structural chars (`[ ] \ .`) chr-**encoded** (chr24-30), but the matcher expects the
literal chars — so the pattern and the subject are `decodeStr`'d before matching (`new
RegExp("[a-z]+").test("abc")` was false until then). Verified: literals, `^\d+$`, `[a-z]+`/`[A-Z]`,
`a.c`, `colou?r`, `\d+` extraction via `.match(...)[0]`, `null` on no match — all vs Node. New
`regex-diff` fuzzer (bun-run whole programs). **87 jsint fuzzers, 0 diffs.** E4.2 = regex literals
`/pat/flags`, `.replace(re,…)`, `.split(re)`, alternation `|`, groups `()`, `{n,m}`.

---

**P7 ENGINE — integer division (`/`):** a latent gap — `/` was in the arithmetic op list
(`isArithOp`) but was neither spaced by the tokenizer (`isOp1`) nor computed by `jsEvalAdd`, so
`4/2` was `NaN`. Added `/` to `isOp1` (so `4/2` tokenizes to `4 / 2`) and a `/` case to `jsEvalAdd`
alongside `*`/`%`. The engine is integer-based, so `/` is **integer division** — exact for the
common divisible cases (`100/4`→25, `6/2/3`→1, `3*4/2`→6) but truncating otherwise (`5/2`→2, not
2.5 — a float value type is a separate future feature). New `division-diff` fuzzer restricted to
exact divisions (a = b·k). Verified division mixed with `+ - *` under precedence. **88 jsint
fuzzers, 0 diffs.** (Regex *literals* `/pat/flags` were attempted but reverted — the `__REGEXLIT`
opaque-token encoding didn't survive normalization for special-char patterns, and the `/` division
tokenizer change must land first; regex literals are a focused follow-up on top of `new RegExp`.)

---

**P7 ENGINE — E5 BITWISE (`& | ^ ~ << >> >>>`) + a LOGOS compiler fix:** JS bitwise operators
coerce operands to 32-bit signed ints. Added seven native i32 ops (`js_band`/`js_bor`/`js_bxor`/
`js_bnot`/`js_shl`/`js_shr`/`js_ushr`, local-only toolchain) and four precedence tiers wired into
the eval chain: `jsEvalLogic → jsEvalBitOr(|) → jsEvalBitXor(^) → jsEvalBitAnd(&) → jsEvalShift
(<< >> >>>) → jsEvalCmp` (JS precedence `| < ^ < &`; shift is nominally tighter than comparison but
placed here for one clean chain — shift-with-comparison is rare); `~` (unary NOT) is handled in
`jsEvalCmp` beside `!`. `&`/`|`/`^`/`~` added to `isOp1`, `<<`/`>>` to `isOp2`, `>>>` to `isOp3` so
the tokenizer spaces them. Verified `5&3`→1, `5|2`→7, `~5`→-6, `1<<4`→16, `255>>>4`→15, precedence
`5&3|8`→9, `6&3^1`→3 — all vs Node. **Compiler bug fixed:** the new tiers tripped LOGOS's automatic
function memoization, whose codegen `insert(key, __memo_result)` then `return __memo_result` moved
the value twice (E0382); fixed the generator to `insert(key, __memo_result.clone())` — a general fix
for any memoized function. New `bitwise-diff` fuzzer. **89 jsint fuzzers, 0 diffs.** Map/Set/Symbol/
BigInt/Date and regex literals remain.

---

**E5 Map/Set + a latent left-associativity `+` bug (2026-07-22).** Added `Map` and `Set` to jsint.
Both are heap objects with parallel-array storage: a `Map` carries `__map_keys`/`__map_vals`
(insertion order, update-in-place), a `Set` carries `__set_vals` (dedup on construct+`add`). Keys and
members compare by `materialize` so `1` and `"1"` stay distinct the way Node does. Methods `new Map()`
/`new Set([…])`/`.set`/`.get`/`.has`/`.add` dispatch in `resolveMethods` gated on `isMap`/`isSet` (so a
user object with its own `.get`/`.set`/`.has` still routes through the ordinary member path — the
user-method-shadows-builtin guard runs first), and `.size` is answered in `getMember`. Building the
`collections-diff` fuzzer immediately surfaced something the string engine had hidden for months:
`console.log(7+9+"/"+2)` printed **`79/2`** instead of `16/2`. **The `+` operator was not
left-associative.** `evalValue`'s string branch did `hasStr(expr) → tagStr + concatTerms(split(expr,
" + "))`, and `concatTerms` *materialized every term and glued them as strings* — so the instant any
operand in a `+` chain was a string, the whole chain (including a purely numeric prefix like `7+9`)
collapsed to concatenation. JS folds `+` strictly left-to-right, numeric until the first string
operand: `((7+9)+"/")+2 = (16+"/")+2 = "16/"+2 = "16/2"`. Rewrote `concatTerms` as a genuine left
fold with a `plusStep` that keeps the running value numeric (integer add) until either side is a
string, then switches to concat for the rest; dropped the erroneous outer `tagStr` wrap in
`evalValue` (the fold now returns a correctly-tagged value). `5+3+"x"`→`8x`, `"a"+1+2+"b"+3+4`→
`a12b34`, `1+2+3`→`6`, `"total: "+(10+20)`→`total: 30` — all vs Node. New `collections-diff` fuzzer.
**90 jsint fuzzers, 270 runs across seeds 1–3, 0 diffs; gate GREEN.** Symbol/BigInt/Date and regex
literals remain.

---

**E4.2 regex literals `/pat/flags` (2026-07-22).** The regex *engine* has existed and been fuzzer-
locked since E4.1 (`new RegExp`/`.test`/`.match`), but the literal *syntax* was missing — real JS
writes `/\d+/.test(x)`, not `new RegExp("\\d+")`. Added a `desugarRegexLits` pass that runs *first*
in `normalizeJs`, on raw source, rewriting each `/pat/flags` literal to `new RegExp("escaped-pat")`
so it flows through the already-tested `new RegExp (` handler and matcher. The hard part is the
classic lexing ambiguity: a `/` starts a regex only in *expression position* — after an operator /
open-bracket / comma / statement boundary (`rxRegexPos`), or an expression keyword like `return`,
`typeof`, `yield` (`rxKeyBefore`, word-boundary checked) — otherwise it is division. The scanner
tracks `'`/`"`/backtick string context (so a `/` inside a string is never a regex), copies `//` and
`/* */` comments through untouched, and captures the pattern honoring `\`-escapes and `[...]` classes
(where `/` is literal). The pattern is emitted as an ordinary double-quoted string literal with `\`
doubled and `"` escaped, so it survives normJs's string-encoding and `decodeStr` restores it. Flags
are dropped (the matcher currently ignores them). `/abc/.test`, `/[a-z]+/`, `/\d+/`, `/^h/`, `let
r=/a.c/`, `return /\d/.test(x)` — all agree with Node; division (`10/2`, `x/4/5`, `(6+4)/2`) is
untouched. **Two pre-existing limitations surfaced (NOT regex bugs, confirmed with the explicit
`new RegExp` form and with non-regex programs):** (1) `.test`/`.match` inside a `.map`/`.filter`
callback returns wrong results — `["zz","b2"].map(x=>new RegExp("z").test(x))` is `[false,false]`
not `[true,false]` (a regex-`.test`-in-callback scoping bug, next to fix); (2) `function f(){…}stmt`
on a *single line* drops the trailing statement (a statement-splitter bug — a newline fixes it).
New `regexlit-diff` fuzzer (argument / assignment / return positions + division survival). **91
jsint fuzzers, 273 runs across seeds 1–3, 0 diffs; gate GREEN.**

---

**Method dispatch reached into un-executed callback bodies (2026-07-22).** Landing regex literals
surfaced that `arr.filter(x=>/re/.test(x))` — one of the most common JS idioms — returned wrong
results, and it reproduced with the explicit `new RegExp(...)` form and with Map/Set ops, so it was
a general dispatcher bug, not a regex one. Root cause: `resolveMethods` handles `.test`/`.match`,
`new Map`/`new Set`/`new RegExp`, and the Map/Set ops (`.set`/`.get`/`.has`/`.add`) with fixed-order
`If substringBefore(expr, " . X (") …` checks that fire on ANY textual occurrence — *before* the
leftmost-method dispatch that the array/string method family (`.map`/`.filter`/`.includes`/…) goes
through. So for `["zz","b2"].map(x=>new RegExp("z").test(x))`, the inner `.test` (and `new RegExp`)
resolved at capture time with `x` unbound and baked `return false` into the closure body, instead of
letting `.map` capture the closure opaquely and run the regex per element. (`.includes` in a callback
worked precisely because it's in the position-ordered leftmostOf family.) Fix: guard those bare-
occurrence handlers with `markerInBody`, which reports whether the marker's occurrence sits inside a
FUNCTION body. The first cut counted raw `{`/`}` depth — but that also deferred `.test`/`.get` inside
OBJECT LITERALS (`{r:/\d/.test("5")}`), which have no enclosing HOF, so the handler never fired and
`resolveMethods` recursed forever → stack overflow. The real guard (`fnBraceStack`) walks the prefix
tokens tracking a stack of brace KINDS — `F` for a `function ( … ) {` body brace (a 4-state machine
skips the name and param list), `O` for every other `{` (object literal / block / control body) — and
defers only when an `F` is still open. Now `arr.filter(x=>/\d/.test(x))`, `.map`, `.some`, `.every`
match Node; object literals, `if`-blocks, function declarations, and all top-level regex/Map/Set usage
are untouched. KNOWN-STILL-OPEN (separate, pre-existing, reproduces with a named callback too):
`arr.map(x=>m.get(x))` where `m` is a free Map var returns NaN — inline closures capture free vars via
`substitute` at capture time and that path doesn't carry Map/Set heap handles; proper lexical closures
are a later fix. New `hofregex-diff` fuzzer. **92 jsint fuzzers, 276 runs across seeds 1–3, 0 diffs;
gate GREEN.**

---

**Sync HOF callbacks now resolve outer heap-ref free vars by name (2026-07-22).** `arr.map(x=>obj[x])`,
`arr.filter(x=>set.has(x))`, `arr.map(x=>lookup.get(x))` — reading an OUTER array / object / Map / Set
from inside a callback — all returned NaN/empty. Value free vars (`x=>x>threshold`, `x=>x*factor`)
worked, which pinpointed the cause: `fnArgVal` captured every callback via `funcValueOf(substitute(s,
env))`, and `substitute` bakes each free var's VALUE into the body. Baking a number is fine, but baking
a heap ref inline yields `<ref>[x]` / `<ref>.get(x)`, whose base is a raw ref that index/method dispatch
resolves by NAME (only dot-property access handles an inline ref) → NaN (or, once the callback-body
guard deferred `.get`, a stack overflow). The key realisation: a SYNC higher-order callback runs
immediately, and `callFnIdx`/`callFn2` execute its body in the *enclosing* env — so its free vars can
just resolve by name at call time; baking is unnecessary there. (It's necessary only for the async
`.then`/`.catch`/`.finally` reactions, which drain LATER when the defining env is gone.) Added
`fnArgValRaw` (= `funcValueOf(s)` with no `substitute`) and pointed the 10 sync HOFs at it —
`map`/`filter`/`some`/`every`/`find`/`findIndex`/`reduce`/`sort`/`flatMap`/`Array.from(x, fn)` — while
`.then`/`.catch`/`.finally`/`new Promise` keep `fnArgVal`. Now outer array/object/Map/Set reads inside
sync callbacks match Node; value closures, returned-from-a-function closures, aliasing, sort/reduce,
and regex-in-callback all unaffected. New `refclosure-diff` fuzzer. **93 jsint fuzzers, 0 diffs; gate
GREEN.** STILL-OPEN (separate): a callback that MUTATES an outer ref (`arr.forEach(x=>out.push(x))`) —
`forEach` isn't implemented yet; and a NAMED callback storing a ref free var still bakes at assignment.

---

**Array.prototype.forEach (2026-07-22).** `forEach` was entirely missing — `[1,2,3].forEach(f)` was a
no-op. Added it as a sync HOF alongside `.map`/`.filter`: `.forEach (` joined the leftmostOf marker
list and got a dispatch branch, and `arrForEach`/`arrForEachLoop` run the callback per element (value
+ index) for side effects and return `undefined`, using `fnArgValRaw` so the body executes in the
enclosing env. Because of that, a statement-body callback mutating an OUTER heap ref persists through
the handle: `let o=[]; a.forEach(x=>{o.push(x*2)});` fills `o`, and `a.forEach((k,i)=>{m.set(i,x)})`
populates an outer Map. Element+index, `String(forEach(...))==="undefined"`, and console.log side
effects all match Node. New `foreach-diff` fuzzer. **94 jsint fuzzers, 0 diffs; gate GREEN.** Two
pre-existing gaps this surfaced but did NOT fix (both reproduce OUTSIDE forEach): (1) `.push` in
EXPRESSION position — `let n=a.push(2)` yields garbage `2 . push 2 …` (push is a statement-only
handler; the arrow expression body `x=>a.push(x)` hits this); (2) reassigning an outer SCALAR from a
callback (`sum=sum+x`) doesn't propagate — the callback env is a copy. Both logged for follow-up.

---

**Array.push in expression position + multiple args (2026-07-22).** `push` only worked as a bare
statement (`arr.push(x)`); in EXPRESSION position it fell through to garbage — `let n=a.push(2)` →
`2 . push 2 …`, and `x=>a.push(x)` (an arrow's expression body) never mutated. And multi-arg
`a.push(1,2,3)` fed the whole `1,2,3` to `jsEvalIn` as one value → NaN. Added a `. push (` handler to
the position-ordered leftmostOf family (NOT a bare-occurrence handler — so an inner `.push` inside a
callback body stays hidden until the enclosing `.map`/`.filter` captures the closure, and it can't
fire twice): it pushes each arg via a new `arrPushAll` (which mutates the array's heap slot in place
through the handle, so aliases see it) and returns the new length, matching JS. The statement handler
now also routes through `arrPushAll` so `a.push(1,2,3)` works. `let n=a.push(2)` → `2,1,2`,
`console.log(a.push(v))`, `forEach(x=>o.push(x*2))`, and multi-arg push all match Node; statement push,
aliasing, and push-then-sort unaffected. New `pushexpr-diff` fuzzer. **95 jsint fuzzers, 0 diffs; gate
GREEN.** Note: a BARE `arr.map(x=>o.push(x))` statement (map for a push side effect — an anti-pattern;
use forEach) still drops the mutation, a pre-existing bare-expression-statement quirk, not a push bug.

---

**Regex String.replace / String.split + flag preservation + comma-in-string arg fix (2026-07-22).**
`str.replace(/re/, x)` and `str.split(/re/)` ignored the regex (materialised it to "[object Object]"
and treated it as a literal string). Completed the regex surface: (1) FLAGS now flow through — the
literal desugar emits `new RegExp("pat","flags")` (was dropping flags) and the `new RegExp (` handler
reads the 2nd arg, so `/re/g` stores `g`. (2) `reReplaceLoop` rebuilds the DECODED string replacing
matches with the replacement (first match, or all under `g`; a zero-width match stops the global loop
so it can't spin); `.replace` branches on `isRegex(arg1)`. (3) `reSplit` reuses `reReplaceLoop` —
replace every match with a chr(0) sentinel, then `strSplit` on it; `.split` branches on `isRegex`.
`"a1b2".replace(/\d/g,"X")`→`aXbX`, `"CamelCase".replace(/[A-Z]/g,"_")`→`_amel_ase`,
`"a1b22".split(/\d+/)` all match Node; string `.replace`/`.split`, `.test`, `.match` unaffected. **A
latent arg-splitting bug fell out:** patterns with a comma (`/[,;]/`, `/,/`) infinite-looped or split
wrong because `commaDepthSplit` (which splits call args) tracked paren depth but NOT string quotes, so
the comma inside `new RegExp("[,;]", "")`'s string literal was treated as an arg separator → the
pattern truncated to `[` (unterminated class → stack overflow). Added chr(34) quote-tracking to
`commaDepthSplit` (escaped quotes are already chr(127), so a raw chr(34) always marks a real
boundary) — now ANY string arg containing a comma (`f("a,b", c)`) splits correctly, not just regexes.
New `regexops-diff` fuzzer. **96 jsint fuzzers, 0 diffs; gate GREEN.** Deferred: `$&`/`$1` replacement
patterns and capture groups (literal replacement only for now).

---

**parseInt/Number crash + NaN ordering comparisons (2026-07-22).** `parseInt("42px")` PANICKED —
`globalCall` routed both `parseInt` and `Number` straight to the native `parseInt`, which aborts on any
non-integer text (`Cannot parse '42px' as Int`). A crash is worse than a wrong value. Replaced with
pure-LOGOS parsers matching JS: `jsParseIntText` is lenient — trim, optional sign, take the leading
digit run, ignore the tail (`"42px"`→42, `"3 apples"`→3), NaN with no leading digit; `jsNumberText` is
strict — the whole trimmed string must be numeric (`"42px"`→NaN), `""`→0, and a leading `+` is stripped
(`"+5"`→5). Both `decodeStr` the value first so chr-encoded string spaces (`"  17  "`) are seen as real
whitespace. Building the fuzzer then caught a second, deeper bug it now exposes constantly: **NaN
ordering comparisons returned true.** `NaN > 10` was `true` (should be `false`) — `==`/`===`/`!=`/`!==`
already had `eitherNaN` guards but `<`/`>`/`<=`/`>=` did not, so they fell to `cmpVals` which
string-compared `"NaN"`. Added the `eitherNaN`→`false` guard to all four ordering operators (any
comparison with a NaN operand is false in JS). `parseInt("abc")>10`→false, normal comparisons intact.
New `parseint-diff` fuzzer. **97 jsint fuzzers, 0 diffs; gate GREEN.** (`Number("3.5")`→NaN is the
known integer-only-engine float gap, not a Number bug; parseInt radix `parseInt("ff",16)` unhandled.)

---

**Negative / out-of-bounds array index + slice PANICKED (2026-07-22).** `a[-1]` and `[1,2,3].slice(-1)`
aborted the process — `index out of bounds: the len is 3 but the index is 18446744073709551615`. The
1-based `item` builtin computes `i-1` as usize, so any index that reaches it as 0 or negative wraps to
usize::MAX and panics. `a[i]` went through `arrGet`, which guarded the UPPER bound but not the lower
(so `idx=-1` → `item 0`), and `.slice(-1)` fed `a+1 = 0` straight into `arrSliceLoop`. Fixed to JS
semantics: `arrGet` returns `undefined` for a negative index (a negative bracket index is a property
miss, NOT from-the-end — that's only `.at()`/`.slice()`); a new `normSliceIdx(idx, n)` clamps slice
bounds to `[0, n]` and reads negatives from the end (`n+idx` floored at 0), applied in both `arrSlice`
and `strSlice`. `a[-1]`/`a[10]` → `undefined`, `[1,2,3].slice(-1)` → `[3]`, `slice(1,-1)`,
`slice(-99)` (clamped), `"hello".slice(-2)` → `lo`, all match Node; normal indexing/slicing intact.
New `negindex-diff` fuzzer. **98 jsint fuzzers, 0 diffs; gate GREEN.** (Non-crash DIFFs still open,
logged: string bracket `s[-1]`→garbage not undefined; `"5"*"x"`→5 not NaN; `charCodeAt` oob→0 not NaN;
`(10).toString(2)` radix.)

---

**String bracket indexing s[i] (2026-07-22).** `"hello"[0]` returned the WHOLE string, `"hello"[10]`
too, and a variable `s[0]` produced garbage — `resolveArrays` handled array and object receivers but
had no STRING branch, so `s[i]` fell through to array-literal construction (treating `[0]` as a new
array). Added string handling to `resolveArrays` for both a tagStr value (resolved variable) and a
`"…"` literal, via a new `strIndexChar(s, i)` that returns the one-char string at `i` (on the chr-
encoded content, same length, decoded at output) or `undefined` for a negative / out-of-range index
(unlike `.charAt`, which returns `""`). `"hello"[0]`→`h`, `[10]`/`[-1]`→`undefined`, `s[1]+s[4]`→`eo`,
and the ubiquitous `for(i<s.length){r+=s[i]}` character walk all match Node; array/object indexing and
array literals unaffected. New `strindex-diff` fuzzer. **99 jsint fuzzers, 0 diffs; gate GREEN.**

---

**One-line statement packing after a `}` (2026-07-22).** A block's closing `}` immediately followed by
the next statement with NO `;` — `function f(){}g()`, `for(…){…}return x`, `if(…){…}foo()` — dropped
everything after the `}`. `splitTop` only cut statements at a depth-0 `;`, so the trailing statement
was swallowed into the preceding block's "statement" and never executed. This recurred all session
(minified/terse/packed source hits it constantly, and it kept tripping the fuzzers). Fixed `splitTop`
to also insert a boundary after a `}` that closes to depth 0 — UNLESS `splitContinues` says the same
statement continues: the next token is `else`/`catch`/`finally`/`while` (do-while), an operator / `.` /
`(` / `[` consuming the value, a `;` (already splits), or end of input. So `function f(){}g()` →
`f(){}` | `g()`, `for(){}log()` splits, but `if(){}else{}`, `try{}catch{}`, `let o={a:1}`,
`x=>{…}`, and `a.map(x=>x).join()` chains stay whole. All match Node. New `oneliner-diff` fuzzer.
**100 jsint fuzzers, 300 runs across seeds 1–3, 0 diffs; gate GREEN.**

---

**Number.toString(radix) (2026-07-22).** `(255).toString(16)` returned NaN — there was no `.toString`
handler at all, so even `(255).toString()` failed. Added a `. toString (` dispatch (position-ordered
leftmostOf family) backed by `intToRadix(n, radix)`: renders an integer in base 2..36 (digits 0-9 then
a-z), default base 10 is the decimal text, negatives keep a leading `-`; a non-number receiver falls
back to its string form (`"hi".toString()`→`hi`). `(255).toString(16)`→`ff`, `(10).toString(2)`→`1010`,
`(3735928559).toString(16)`→`deadbeef`, `(-15).toString(16)`→`-f` all match Node. New `tostring-diff`
fuzzer. **101 jsint fuzzers, 0 diffs; gate GREEN.**

---

**More native-parseInt panics: charCodeAt() / substring(neg) / Math.floor (2026-07-22).** A second
crash-hunt found three more `Cannot parse '…' as Int` aborts, all from a method handler passing a
missing / negative / NaN argument to the native `parseInt`: `"hi".charCodeAt()` (no arg → NaN),
`"abc".substring(-1)` (empty 2nd arg → NaN), and `Math.floor(3.7)` (the float literal is NaN in this
integer-only engine). Added `safeInt(text)` — parses via `jsParseIntText`, so NaN/empty/non-numeric →
0 and a trailing fraction truncates — and routed the fragile handlers through it. `charCodeAt` now uses
`safeInt` for the index (0 when omitted) and a new `charCodeStr` that returns `NaN` for a negative /
out-of-range index (was 0); `substring` clamps each index to `[0,len]` via a new `clampIdx` (a negative
becomes 0 — NOT from-end like slice — with a>b swapped and b defaulting to len); `Math.floor`/`ceil`/
`round` render via `jsParseIntText` (identity on integers, `NaN` on NaN — they can't crash and they
never claimed float precision this engine lacks). `charCodeAt()`→104, `charCodeAt(5)`→NaN,
`substring(-1)`→`abc`, `substring(3,1)`→`el` (swap), `substring(-2,3)`→`hel`, `Math.floor(5)`→5, all
match Node. New `strnumsafe-diff` fuzzer. **102 jsint fuzzers, 0 diffs; gate GREEN.**

---

**String methods: substr / codePointAt / lastIndexOf (2026-07-22).** Three common String methods were
missing — `"hello".substr(1,2)`, `"a".codePointAt(0)`, and `"abcabc".lastIndexOf("b")` all returned the
whole string (no handler → fell through). Added: `substr(start,len)` via `strSubstr` (start may be
negative = from end, `length` chars clamped to the string, defaults to the rest — legacy semantics,
distinct from `substring`); `codePointAt(i)` == `charCodeAt` for the BMP but yielding `undefined` (not
NaN) for an out-of-range index (`codePointStr`); `lastIndexOf(sub)` via `strLastIndexOf`/`lastIdxScan`
(scan backward from the last candidate start, 0-based index or -1). `substr(-2)`→`lo`, `substr(-3,2)`→
`ll`, `codePointAt(1)` of "AB"→66, `codePointAt(5)` oob→undefined, `lastIndexOf("b")` of "abcabc"→4,
`lastIndexOf("z")`→-1 all match Node; substring/indexOf/charCodeAt unaffected. New `strmethods2-diff`
fuzzer. **103 jsint fuzzers, 0 diffs; gate GREEN.**

---

**Crash-hunt #3: slice()/pad/at/charAt/repeat/Math native-parseInt panics + padStart default fill
(2026-07-22).** `[1,2,3].slice()` (no args) aborted, and the same `Cannot parse '…' as Int` panic
lurked in every method handler that fed a possibly missing/NaN argument to the native `parseInt`:
`slice`, `at`, `charAt`, `repeat`, `padStart`/`padEnd` (start), `Math.max`/`min` (both the first arg
AND the variadic `maxFold`/`minFold` loop), `Math.abs`/`pow`/`sign`, and `String.fromCharCode`. Routed
all of them through `safeInt` (NaN/empty→0). Separately, the padStart/padEnd DEFAULT fill was wrong —
`"5".padEnd(3)` gave `5Na` (it materialised the empty 2nd arg into "NaN"); a new `padFill` returns a
single `encSpace()` when the fill is omitted (a raw space would be eaten as a token separator in the
normalized expression, which is why the earlier attempt under-padded), so `"5".padEnd(3)`→`5  `,
`"5".padStart(3)`→`  5`. `slice()`→whole copy, `charAt()`/`at()`→index 0, `Math.max(3,7,2)`→7 all match
Node; explicit-arg forms (`padStart(3,"0")`→`005`, `Math.pow(2,10)`→1024) unaffected. New
`argsafe2-diff` fuzzer. **104 jsint fuzzers, 0 diffs; gate GREEN.** (`Math.abs("x")`→0 vs NaN and
`Math.max(3,"y")`→3 vs NaN are NaN-coercion DIFFs, not crashes — logged.)

---

**Close the native-parseInt crash class: array-index assignment / process.exit / slice-end
(2026-07-22).** The last user-facing sites feeding native `parseInt` a possibly non-integer value:
`a["x"]=9` (a non-numeric computed index in an assignment target — `Cannot parse 'x' as Int`),
`process.exit("x")`, and the `sliceEnd` helper (the end arg of slice/substr). Routed all three through
`safeInt`. `a["x"]=9` no longer aborts (`a.length` stays 3, matching Node's numeric-`.length` view);
`a[1]=9`/`a[i]=9` unaffected; slice/substring/substr end args unaffected. Only the (already type-guarded)
`toString(radix)` argument still calls native parseInt, and it can't reach it with non-numeric text.
The whole "handler hands native parseInt user text → panic" class — hunted across 3 sweeps this session
(global parseInt/Number, negative index/slice, charCodeAt/substring/Math.floor, slice()/pad/at/charAt/
repeat/Math.*, and now these) — is closed. **104 jsint fuzzers, 0 diffs; gate GREEN.**

---

**Single-quoted strings + comma-inside-string array-literal crash (2026-07-22).** Single-quoted string
literals were entirely broken — `'abc'`/`let x='hi'` evaluated to NaN — because the tokenizer only
recognized `"` as a string delimiter (which also made `JSON.parse('{"y":9}')` look broken; it was the
single-quoted argument). Added a `convertQuotes` pre-pass (first in `normalizeJs`) that flips `'…'`→
`"…"`: a literal `"` inside becomes `\"`, a `\'` becomes a bare `'`, other escapes and double/backtick
strings pass through. `'abc'`, `'a'+'b'`, `{k:'v'}`, `['x','y'].join('-')`, `'it\'s'`, `'say "hi"'`,
and `JSON.parse` of single-quoted JSON all match Node. The fuzzer then surfaced a PRE-EXISTING crash it
now exercises: an array literal with a comma INSIDE a string element — `["abc","a,b,c"]` — stack-
overflowed, because the array builder split the inner text on raw commas (mangling the string into `"a`
/ `b` / `c"`). Fixed by routing the array-element split through `splitArgsN`/`commaDepthSplit`, and
extending `commaDepthSplit` to track `[]` and `{}` depth (it already tracked `()` + string quotes) — so
commas inside strings, nested arrays, and nested objects no longer split. `["abc","a,b,c"]`,
`[[1,2],[3]]`, `[{a:1},{a:2}]` all correct; function-arg splitting, `Map.set("k","a,b")`, `Math.max`,
`reduce` unaffected. New `squote-diff` fuzzer. **105 jsint fuzzers, 0 diffs; gate GREEN.**

---

**Iteration & spread over Set / Map / string + for-of destructuring (2026-07-22).** `iterElements`
(the engine of spread `[...x]` and `for-of`) only knew arrays and generators, so `[...set]`→empty,
`new Map([["a",1]])`→empty (size 0), `for (const c of "abc")`→nothing, and a destructuring loop var
`for (const [k,v] of …)`→`NaN=NaN` even over a plain array. Extended `iterElements` to yield a Set's
values (`__set_vals`), a Map's `[k,v]` entries (new `mapEntriesArr`), and a string's characters (new
`strToCharArr`, on the chr-encoded content so it round-trips). Wired `new Map([[k,v],…])` to populate
via a new `mapFromEntries`. And made the for-of/for-in loop variable destructure — `bindLoopVar` routes
an `[…]`/`{…}` pattern through `destructureArr`/`destructureObj`, a plain name binds directly.
`[...set]`, `[..."hello"]`, `new Map([...])`, `for (const c of str)`, `for (const [k,v] of map)` /
arrays / `Object.entries` all match Node; plain for-of, array spread, existing Set/Map ops unaffected.
New `iterspread-diff` fuzzer. **106 jsint fuzzers, 0 diffs; gate GREEN.**

---

**Uninitialized `let x;` is now undefined (2026-07-22).** A declaration with no initializer bound the
variable to NaN (and `typeof x`→"number") — `bindOne` fell through to its `name = … = … rhs` split,
found no ` = `, and evaluated the bare name `x` (unset) → NaN. So `let x; x ?? d` gave NaN instead of
`d`, and `x === undefined` was false. Added a guard: when the assignment text contains no ` = `, bind
the name to `"undefined"`. `let x`→undefined, `typeof x`→"undefined", `x ?? d`→d, `x === undefined`→
true, `let a,b; a=1; b=2`→3 (multi-declare), and later assignment (`let x; x=5`) all match Node;
initialized declarations, destructuring, and object/array literals unaffected. Locked with new cases in
`decl-diff`. **106 jsint fuzzers, 0 diffs; gate GREEN.**

---

**ES2022 class fields (public + private #) (2026-07-22).** A class body field declaration —
`class A { p = 5; … }` or `#p = 5` or a bare `x;` — was mis-parsed (`classWalk` only understood
methods, so it grabbed the NEXT method's parens/braces → NaN / garbage like `vthis.n=v`). Added field
detection: a member whose name is a plain identifier (not constructor/get/set/static/async) NOT
followed by `(` is a field. `x = expr ;` initializes to expr, a bare `x ;` to undefined; both become
`this . x = …` accumulated into a new `fields` thread that `superFirst` injects into the constructor
AFTER `super`. A `#private` name is just an unusually-spelled property key, so private fields work with
zero extra logic. `class A{p=5}`, multiple fields, `#p=5`, field + explicit constructor (`n=0;
constructor(v){this.n=v}`), private mutation (`#x=this.#x+1`), and reference-typed field values
(`items=[]` then push) all match Node; methods, constructors, `extends`/`super`, `static`, and
getters unaffected. New `classfields-diff` fuzzer. **107 jsint fuzzers, 0 diffs; gate GREEN.** (Field
values containing a top-level `;` — e.g. an inline `function(){…;…}` field — aren't split yet; simple/
literal/arrow/array/object values, the overwhelming majority, are.)

---

**break / continue + braceless `if` (2026-07-22).** `break` and `continue` were NO-OPS — a loop with
`if (i===2) break` ran all iterations, and `continue` never skipped. The loops only checked `hasHalt`
(return/throw); there was no break/continue mechanism at all, AND braceless `if (c) stmt` (without
`{}`) didn't run its consequent (which is where the `break` usually lives). Fixed both: (1) `break`/
`continue` set `__break`/`__continue` env flags (like `__ret`); `runBlock` stops the rest of a block on
them; each loop (`for`/`while`/`for-of`/`for-in`) catches them after the body — break clears the flag
and stops, continue clears it and advances (running the `for` update). They don't propagate through a
call, unlike return. (2) `execIf` now extracts the condition with `balancedArg` (so `if (f(x))` nested
parens survive) and, when what follows the `)` isn't `{`, runs a braceless single-statement consequent
via `execStmt`, with inline `else` honored; `splitTop` keeps `; else` together so a braceless
`if (c) a; else b` isn't torn apart (it was stack-overflowing). `if (i===2) break`, `if (x%2===0)
continue`, `while(){…break}`, `for-of` break/continue, and braceless if/else-if chains all match Node;
braced ifs, else-if, loops without break, assignments unaffected. New `breakcont-diff` fuzzer. **108
jsint fuzzers, 0 diffs; gate GREEN.** (Labeled `break label` to an OUTER loop still breaks only the
innermost — logged.)

---

**reduce-without-init / `in` operator / split("") / parseFloat crash (2026-07-22).** Four bounded gaps
from a broad probe: (1) `[1,2,3].reduce((a,b)=>a+b)` with NO initial value gave NaN — it seeded the
accumulator with an empty (→NaN) init; a new `arrReduceNoInit` seeds with element 0 and starts at
element 1. (2) The `in` operator was unhandled (`"x" in o` returned `"x"`) — added to `jsEvalCmp`:
`key in obj` → object has that property, `idx in arr` → in range. (3) `"Hello".split("")` returned the
whole string, not its characters — `strSplit` now yields `strToCharArr` for an empty separator. (4)
`parseFloat(...)` was entirely unhandled → infinite recursion → STACK OVERFLOW; registered it as a
global (via `jsParseIntText`, so it no longer crashes — the fractional part is truncated pending the
float model). `reduce((a,b)=>a+b)`→6, `"x" in {a,b}` object, `1 in [..]` array, `split("")` chars,
`parseFloat("42")`→42 all match Node; reduce-with-init, other splits, `<`/`>`, and variable for-in
unaffected. New `reduceinop-diff` fuzzer. **109 jsint fuzzers, 0 diffs; gate GREEN.** (Pre-existing,
logged: `for (const k in {inline object})` iterates nothing — inline-object for-in target; a variable
target works. And parseFloat/`toFixed`/`0.1+0.2` need the float model.)

---

**Map.keys() / values() / entries() iterators (2026-07-22).** `[...m.keys()]` was empty and
`for (const [k,v] of m.entries())` iterated nothing — the Map had no iterator methods. Added `.keys`,
`.values`, `.entries` handlers (gated on `isMap`, markerInBody-guarded like the other Map ops): keys
and values return an array built from `__map_keys`/`__map_vals`, entries reuses `mapEntriesArr`.
`[...m.keys()]`, `[...m.values()]`, and `for (const [k,v] of m.entries())` in insertion order all match
Node; `m.get`/`m.has`/`m.size`, `Object.keys`, and an object with a `get`/`keys` property key
unaffected. New `mapiter-diff` fuzzer. **110 jsint fuzzers, 0 diffs; gate GREEN.** (Surfaced but not
fixed: `m.size` inside a larger `+` concat after a spread — `.size` isn't resolved in that term
position; logged.)

---

**FLOATS — IEEE-754 number model (2026-07-22).** THE biggest conformance gap: the engine was
integer-only, so `1/2`→0, `0.1+0.2`→NaN, `3.14*2`→NaN, and any decimal literal was rejected. Closed it
with a native f64 seam that keeps the exact-integer fast path intact: (1) a new `js_arith_f64` in the
toolchain — a recursive-descent evaluator over the spaced token stream (`+ - * / % **`, parens, unary)
computing in IEEE-754 f64, the same doubles V8 uses, formatted JS-style (whole values drop the `.0`;
`Infinity`/`-Infinity`/`NaN` spelled the JS way; else Rust's shortest round-trip Display, which matches
V8). (2) `normJs` now keeps a `.` between two digits as a decimal point (was spacing it into a member-
access dot, splitting `3.5`→`3 . 5`). (3) `arithValue` routes any expression with a `/` or a decimal
literal to `jsArithF64`; pure integer `+ - *` stays on the exact i64 `evalParens` (so big-int products
stay precise). Now `1/2`→0.5, `0.1+0.2`→`0.30000000000000004` (bit-exact), `10/3`→`3.3333333333333335`,
`9.99*3`→`29.97`, `1/3+1/3+1/3`→1, `1/0`→`Infinity`, `0/0`→`NaN`, `[1,2,3].map(x=>x/2)`→`0.5,1,1.5`, all
match Node; integer arithmetic, `2**10`, `1000000*1000000`, modulo unaffected. New `float-diff` fuzzer
(2400 random float expressions/3 seeds, 0 diffs). **111 jsint fuzzers, 0 diffs; gate GREEN.** Toolchain
`js_arith_f64` added (env.rs + program.rs, LOCAL). Remaining float polish: `toFixed`/`toPrecision`,
`parseFloat` fractional part, e-notation for very large/small magnitudes, `Math.sqrt`/`sin`/etc.

---

**Float follow-ups: parseFloat / toFixed / Math on floats (2026-07-22).** With the f64 model in place,
completed the number surface: `parseFloat` now returns the real float (was truncating to int) via a
native `js_parse_float` (leading-decimal prefix, trailing junk ignored, whitespace + sign + exponent);
`Number.toFixed(n)` via native `js_to_fixed` (fixed-point, clamped 0..100, IEEE-754 rounding — so
`(1.005).toFixed(2)`→`1.00` exactly like V8); and `Math.floor`/`ceil`/`round`/`trunc`/`abs`/`sqrt`/`sign`
via native `js_math1` computing in f64 (previously they truncated via `jsParseIntText`, so `Math.floor(
-1.5)`→-1 not -2, and `sqrt` didn't exist). `parseFloat("42.5abc")`→42.5, `(3.14159).toFixed(2)`→3.14,
`Math.floor(-1.5)`→-2, `Math.round(-2.5)`→-2, `Math.sqrt(2)`→1.4142135623730951 all match Node; integer
`Math.floor(5)`/`abs(-7)`/`max`, `parseInt` unaffected. New `mathfloat-diff` fuzzer. **112 jsint
fuzzers, 0 diffs; gate GREEN.** Toolchain `js_parse_float`/`js_to_fixed`/`js_math1` added (LOCAL).

---

**Math surface completed over floats: constants + pow/max/min + transcendentals (2026-07-22).**
Finished the Math library on the f64 model: constants `Math.PI`/`E`/`SQRT2`/`SQRT1_2`/`LN2`/`LN10`/
`LOG2E`/`LOG10E` (resolved to their f64 literals, so `2*Math.PI`→`6.283185307179586`); `Math.pow` via
native `js_math2` (`pow(2,0.5)`→`1.4142135623730951`, `pow(2,10)`→1024); variadic `Math.max`/`min` now
fold in f64 (`max(1.5,2.5,0.5)`→2.5, was truncating to 2); `Math.hypot`/`atan2` via `js_math2`; and the
unary `log`/`log2`/`log10`/`log1p`/`exp`/`expm1`/`sin`/`cos`/`tan`/`asin`/`acos`/`atan`/`sinh`/`cosh`/
`tanh`/`cbrt` family via a generic `mathUnary1`→`js_math1` dispatch. Constants, `pow` (integer result),
`max`/`min`, and `sqrt` of perfect squares are bit-exact with V8 (new `mathfns-diff` fuzzer). **113
jsint fuzzers, 0 diffs; gate GREEN.** KNOWN 1-ULP LIMIT: the transcendentals (hypot/atan2/sin/cos/tan/
log/exp/atan/cbrt) on arbitrary inputs can differ from V8 in the last bit — IEEE-754 doesn't mandate
correctly-rounded transcendentals and Rust's libm ≠ V8's fdlibm; matching exactly would need bundling
fdlibm. Toolchain `js_math2`/`js_math_maxmin` + extended `js_math1` added (LOCAL).

---

**String.replace(regex, function) — a function replacer (2026-07-22).** `str.replace(/re/g, m => …)`
gave garbage — arg 2 was always treated as a literal string. Added `reReplaceFn`/`reReplaceFnLoop`:
each match invokes the callback (via `callFnIdx`, match bound to param 1, offset to param 2) and its
returned string is spliced in (first match, or all under `g`). The handler now takes the function path
both for an inline `m => …` (captured with `fnArgValRaw`) and for a variable holding a function (a
`chr(1)` value). Fixing it surfaced a real encoding bug in the regex-replace family: `reReplace`/
`reReplaceFn`/`reSplit` operate on DECODED text but were returning DECODED content wrapped in a string
tag — so any structural character (`[]`/`()`/`{}`/space) in the result leaked and got re-tokenized
(`m=>"["+m+"]"`→undefined). Added `encodeStr` (the inverse of `decodeStr`) and re-encode the result, so
a value built from decoded text is a well-formed jsint string. `"a1b2c3".replace(/\d/g, m=>"["+m+"]")`→
`a[1]b[2]c[3]`, `c=>c.toUpperCase()`, named replacers, and structural-char wraps all match Node; literal
`.replace`, `.split`, and brackets in the SUBJECT unaffected. New `replacefn-diff` fuzzer. **114 jsint
fuzzers, 0 diffs; gate GREEN.** (Arithmetic on the match — `m => m*2` — still needs string→number
coercion, a separate gap.)

---

**Symbol primitives (2026-07-22).** `Symbol("x")` STACK-OVERFLOWED — an unknown call recursing. Added
Symbol as a unique heap value: `newSymbol(desc)` is a heap object carrying a `__symbol` description, so
identity works (`===` compares the handle — `s===s` true, `Symbol("a")===Symbol("a")` false), and a new
`isSymbol` gives `typeof` → `"symbol"`. Handled in `resolveMethods` (`Symbol (` → `newSymbol`, empty
description allowed). `typeof Symbol()`→`symbol`, `s===s`→true, two `Symbol()`→`!==`, all match Node;
`typeof` for number/string/object/array/function and Map ops unaffected. New `symbol-diff` fuzzer.
**115 jsint fuzzers, 0 diffs; gate GREEN.** (Symbol-keyed object properties `o[sym]=…`, well-known
symbols like `Symbol.iterator`, and `Symbol.for` are a later concern — the common `typeof`/identity
uses work.)

---

**BigInt — arbitrary-precision integers (2026-07-22).** `10n+20n` was NaN, `typeof 5n` was "number".
Added BigInt backed by the toolchain's arbitrary-precision `base::BigInt`: a native `js_bigint_eval`
is a recursive-descent evaluator over the spaced token stream (`+ - * / % **`, parens, unary; operands
are decimal digits with an optional trailing `n`) — `/` truncates toward zero, `%` is the remainder,
and precision is unbounded (`2n**100n`→`1267650600228229401496703205376n`, exact). A BigInt VALUE is a
`tagBig`-tagged decimal string; `arithValue` routes any expression containing a BigInt token to
`bigintEval` (integers and floats keep their own paths). `typeof` reports "bigint"; `BigInt(n)`
constructs; `console.log` prints the trailing-`n` inspect form (`materialize`/`String(10n)` drop it, as
in JS). The tag byte is `chr(0)` — the only free NON-whitespace control byte; the first pick (`chr(12)`,
form-feed) was silently eaten by `trim` when a BigInt variable was re-resolved, so `console.log(x)`
showed `5` not `5n`. `10n+20n`→`30n`, `2n**100n`, `9007199254740993n+1n`, `20n/3n`→`6n`, `-5n+2n`→`-3n`,
`let x=5n;x*x`→`25n`, `typeof 5n`→`bigint`, `BigInt(42)`→`42n`, `String(30n)`→`30` all match Node;
integer/float arithmetic, split, and everything else unaffected. New `bigint-diff` fuzzer. **116 jsint
fuzzers, 0 diffs; gate GREEN.** Toolchain `js_bigint_eval` added (LOCAL). (Bitwise BigInt ops and
BigInt↔Number mixing errors are a later concern.)

---

**Date — the deterministic UTC surface (2026-07-22).** `new Date(ms)` and its getter family did not
exist. Added a Date object as a heap object carrying a `__date_ms` millisecond timestamp, backed by two
toolchain natives: `js_date_now` (wall-clock ms) and `js_date_field(ms, field)` — a manual epoch→civil-
date conversion (Howard Hinnant's algorithm, no chrono dependency) that extracts any UTC calendar field.
`new Date(ms)` / `new Date()` construct; `Date.now()` reads the clock; `getTime`/`valueOf` return the raw
ms; the whole `getUTC*` family (FullYear/Month/Date/Day/Hours/Minutes/Seconds/Milliseconds) and
`toISOString`/`toJSON` render bit-exact — leap years, century non-leaps (2100 is NOT a leap year), and
negative pre-epoch timestamps all land correctly (`new Date(-1)`→`1969-12-31T23:59:59.999Z`,
`new Date(1700000000000).toISOString()`→`2023-11-14T22:13:20.000Z`, `new Date(1582934400000)`→Feb 29
2020). `typeof new Date()`→"object". Two dispatch seams were needed: `resolveMethods` gained a Date
branch (an `isDateObj` receiver routes its method through `dateMethod`), and — the subtle one — the Date
method names had to be added to `leftmostMethod`'s positional allowlist, or `d.getTime()` returned NaN
because the leftmost-method scan never recognized the call at all (the object was built fine;
`d.__date_ms` read `5` — only the *method* dispatch was gated). `Date.now()` is wall-clock so only its
`typeof`/relational shape is fuzzed; every UTC field is diffed over a ~1938→2200 range including
negatives. New `date-diff` fuzzer (1515 programs/5 seeds, 0 diffs). **117 jsint fuzzers, 0 diffs; full
sweep GREEN.** Toolchain `js_date_now`/`js_date_field` added (LOCAL). (`Date.UTC`, local-TZ getters, the
string-argument `new Date("...")` parser, and `console.log(dateObj)` ISO rendering are later concerns.)

---

**E6 — ES modules: import / export, multi-file resolution (2026-07-22).** The engine ran a single
file; `import`/`export` were unhandled (→ NaN). Added a full ESM layer as a source transform + a runtime
module registry. FIVE toolchain natives (LOCAL): `path_dir`/`path_resolve` (join + textual `.`/`..`
normalization + node/bun extension probing: `.js`/`.mjs`/`.cjs`/`.ts` and `/index.*`) and a thread-local
module cache (`module_cache_get`/`_has`/`_set`). A module's imports resolve and its dependencies evaluate
DEPTH-FIRST and exactly ONCE (the cache keyed by resolved path is both the once-guard and the cycle
break — set to empty before the body runs), then the body runs with `export` keywords stripped, then the
exported names are lifted into an exports env (the same `name=val;` shape env already uses). Because the
object heap is a shared thread-local, an exported object/array is a HANDLE that stays valid when bound
into the importer — no serialization across the module boundary. Handled: named `import { a, b as c }`,
default (`import x`), namespace (`import * as ns`), mixed default+named, side-effect `import "./x"`;
`export const/let/var/function/class`, `export { a, b as c }`, `export default` (expr / anon-fn / arrow /
named-fn / class), re-export `export { x as y } from "./m"`, and `export * from "./m"`. Multi-line
`import { … } from "…"` is folded to one logical line first (`joinImportLines`, quote-counting for
completion). SUBTLE FIX: `export default function NAME(){}` first went to `const __default__ = function
NAME(){}` → NaN, because a NAMED function EXPRESSION assigned to a const is a pre-existing engine gap;
fixed by emitting it as a real function DECLARATION (`function NAME(){}`, which works) and mapping the
default export to `NAME` via `defaultBindingName`. Verified: transitive chains, diamond shared-dep
(evaluated once — one `SHARED-INIT` print), nested-subdir + `./`-relative-within-subdir resolution,
object/array exports with method calls on the far side, imports used inside functions. New `module-diff`
fuzzer writes a random multi-file GRAPH per iteration (leaf/mid/entry, 6 shapes) and diffs `bun run` vs
`node` (600 graphs/5 seeds, 0 diffs). Plain no-module scripts run byte-identical (the module path is a
no-op when there are no import/export lines). **118 jsint fuzzers, full sweep + pre-push gate GREEN.**
The named function EXPRESSION gap (`const f = function g(){}`) remains a separate known engine item.

---

**Named function expressions (2026-07-22).** `const f = function g(x){return x*2}` returned NaN, while the
anonymous `const f = function(x){…}` worked — surfaced while wiring `export default function NAME(){}`.
Root cause was narrow: `funcValueOf` already keys off the FIRST `(`, so the name `g` was always
transparent to it; the only blocker was the five value-position guards testing `startsWith(s, "function
(")`, which reject a name between `function` and `(`. Added `isFnLiteral` (accepts anonymous `function (`
OR a named `function NAME (` — third space-token is `(`) and swapped it in at all five sites (fnArgVal,
fnArgValRaw, the regex `.replace(re, fn)` arg, assignment RHS, and `return`). Now `const f = function
g(x){…}`, `arr.map(function sq(x){…})`, and `return function inner(x){…}` all match Node; anonymous
exprs / arrows / declarations unchanged. New `namedfnexpr-diff` fuzzer. **119 jsint fuzzers, full sweep
GREEN.** (Self-reference by the expression's own name inside its body — `function fact(n){…fact(n-1)…}`
as an expression — is a separate rarer item; the name is currently dropped, not bound in the body scope.)

---

**Object method shorthand + accessors (2026-07-22).** `{ m(){…} }`, `{ get x(){…} }`, `{ set x(v){…} }`
returned NaN/undefined. The eval order is resolveMethods → resolveCalls → resolveObjects, so a bare
`name ( )` inside an object literal was consumed by resolveCalls as a function CALL before resolveObjects
could ever build the object — a first attempt to encode it inside resolveObjects failed for exactly this
reason (wrong layer, reverted). The correct fix is a normalizeJs desugar (`desugarObjMethods`) that runs
BEFORE any evaluation: it rewrites `name ( params ) {` → `name : function ( params ) {`, `get x (` →
`__get_x : function (`, `set x (` → `__set_x : function (`, after which the existing function-expression
encoding and the `__get_`/`__set_` getMember/callSetter slots (already used by class accessors) handle
everything. Disambiguation is a brace-kind scan: a `{` in value position (prev token ∈ `= ( [ , : return
? || &&`) opens an OBJECT (`o` frame), otherwise a BLOCK (`b`); `(`/`[` push `p`. A method key sits
directly inside an `o` frame right after that `{` or a top-level `,` (atKeyPos). Misreading a block as an
object only MISSES a rewrite (harmless — resolveObjects still builds real objects); the dangerous inverse
(a real `foo()` call rewritten) needs a value-context token immediately before `{`, which a statement- or
`)`-terminated block never has — so calls, `if`/`for` blocks, IIFEs, and `{get: 1}`/`{set: 2}` used as
ORDINARY keys are all untouched (verified). New `objmethod-diff` fuzzer (1000 programs/5 seeds, 0 diffs);
full 120-fuzzer sweep GREEN. Two PRE-EXISTING gaps surfaced during testing and are NOT regressions (they
reproduce with the explicit `key: function` form): a method call on a NESTED object property
(`o.a.m()` → leaks the raw body) and `this.items.reduce(fn, init)` inside a method (returns the init,
callback not applied). Those are separate engine items, logged for a future increment.

---

**Nested-object / index method calls (2026-07-22).** `o.a.m()`, `arr[0].m()`, `o.a.b.deep()` returned the
raw function body / NaN, while `x.m()` (plain-variable receiver) worked. The user-method dispatch in
resolveCalls took only the SINGLE token immediately before the method (`item(len-2)` = `a`) as the
receiver and evaluated THAT, instead of the whole receiver expression `o.a`. Fixed by resolving the
receiver boundary with recvStart/joinRange — the exact backward-scan recvExpr already uses (it walks back
over `.`-chains and matches `]`/`)` groups) — so the receiver becomes the full `o . a` (or `arr [ 0 ]`),
and the consumed-prefix is recomputed from that same start index. Single-level `o.m()`, class methods,
statics (`C.of()`), and `new C().g()` are unchanged (for them the full receiver IS the single token). New
`nestedmethod-diff` fuzzer (1000 programs/5 seeds, 0 diffs); full 121-fuzzer sweep GREEN. SEPARATE
pre-existing bug still open (NOT this fix, reproduces in class methods too): an array LITERAL or
array-valued PARAM inside a METHOD body doesn't dispatch array methods — `{s(){return [1,2,3].join("-")}}`
→ NaN, though `.length`/`[i]` on it work, string methods work, and `.join` on a split-RESULT (a heap ref)
works, and the same body inside a plain `function` works. The divergence is callMethod (which binds
`this`) vs callFn; the array literal/param isn't reaching arrJoin as a heap ref there. Logged for a
dedicated increment.

---

**Array methods inside method bodies (2026-07-22).** `{ s(){ return [1,2,3].join("-") } }`,
`this.items.reduce(...)`, `arr.map(...)` on a parameter — every array method returned NaN/empty when it
sat inside an object-literal OR class method body, though it worked in a plain `function`, and
`.length`/`[i]`/`.push` on the same array worked. Instrumentation pinned it exactly: inside the method
the builtin-method dispatch received the WHOLE object-literal text and resolved the `.join` sitting
inside the still-unencoded function body at object-CONSTRUCTION time — `recv` came out as `return [ 1 ,
2 , 3 ]`, evaluating to an empty array. Plain `function` declarations dodge this because `defineFn`
encodes their body to an opaque chr(1) blob before any method resolution runs. The builtin-method
dispatch (the leftmostMethod family: join/map/filter/reduce/sort/some/every/find/…) was missing the same
`markerInBody` guard the `.test`/`.match`/Map handlers already use. Added one line right after the
leftmost method is chosen: if that method's leftmost occurrence sits inside a function body
(`markerInBody`, via the fnBraceStack F/O/P brace-kind walk), return the expression unchanged so the
method stays opaque until resolveCalls encodes the function; the array method then resolves normally when
callMethod actually runs the body at call time. Fixes array methods in every method context (object,
class, `this.field`, param, chained `sort().join()`); plain-function bodies unchanged. New
`methodarray-diff` fuzzer (1000 programs/5 seeds, 0 diffs); full 122-fuzzer sweep GREEN. This closes both
pre-existing gaps flagged in the two prior entries (they were the same root cause).

---

**Rest parameters (2026-07-22).** `function f(...xs)` / `function f(a, ...rest)` didn't work — `bindParams`
had no `...` case, so `...xs` bound a single parameter literally named `... xs` (with the dots) to one arg;
`xs.length` came out wrong and `xs.join` empty. Added a rest branch: a parameter whose trimmed text starts
with `...` binds the name after the dots to an array gathered from the caller's args at that index through
the end (`restArgs`, which allocates a real heap array so map/reduce/join/length all work), and an
argument-less call (`f()` → the single empty arg token `patFields("")` produces) yields an empty array,
not a spurious one. Fixes `f(...xs)`, `f(a, ...rest)`, `f(a, b, ...more)`, spread of the rest back out
(`Math.max(...ns)`), and array methods over the rest; fixed params, defaults, and destructuring patterns
are unchanged. New `restparam-diff` fuzzer (1000 programs/5 seeds, 0 diffs); full 123-fuzzer sweep GREEN.
KNOWN OPEN (separate, logged): rest params on object/class METHODS — `{m(...xs){…}}` — still bind wrong;
the array is correct when returned whole (`return xs` → 3 elements) but member access inside the method
body (`xs.length`, `typeof xs`) reads wrong, a callMethod/`this`-context interaction distinct from the
plain-function path.

---

**Error constructors + `finally` (2026-07-22).** `new Error("...")` STACK-OVERFLOWED — even `let e = new
Error("hi")` on its own — because `Error` was an unknown constructor and the `new` path recursed forever
(the same failure class `Symbol()` once had). Real code throwing errors crashed the whole runtime. Added
`new Error(msg)` plus `TypeError`/`RangeError`/`SyntaxError`/`ReferenceError` as builtins in resolveMethods
(each guarded by markerInBody like `new Map`/`new Set`): a heap object carrying a `message` string and a
`name`, so `throw new Error(m)` / `e.message` / `e.name` / `` `${e.name}: ${e.message}` `` all work.
Separately, `execTry` had NO `finally` support at all — `try{…}finally{…}` never ran the finally, and
`try{…}catch{…}finally{…}` dropped it. Added `runFinally`: it clears the halt flags so the finally body
executes, runs it, then restores the pending `return`/`throw` from the try/catch — unless the finally
itself returns/throws, which supersedes (JS semantics), so `function g(){try{return 1}finally{cleanup()}}`
runs cleanup then returns 1. New `errortry-diff` fuzzer (1000 programs/5 seeds, 0 diffs); full 124-fuzzer
sweep GREEN. STILL OPEN (logged): a `throw` inside a CALLED function doesn't propagate to an outer
try/catch — `function f(){throw new Error("x")} try{f()}catch(e){…}` misses it — because callFn/callMethod
return only the value, not the pending `__throw`; threading exception state through the value-return path
is a separate increment.

---

**Exceptions across call boundaries (2026-07-22).** A `throw` inside a called function never reached an
outer `try/catch` — `function f(){throw new Error("x")} try{f()}catch(e){…}` silently missed it — because
callFn/callMethod hand back only the return VALUE, so the callee's `__throw` env flag died with its frame.
Direct `throw` in a try worked; a throw one call-frame deep did not. Fixed with a thread-local pending-throw
channel (four natives: throwSet/throwGet/throwPending/throwClear), mirroring the heap/microtask
thread-locals: when a body leaves `__throw` set, callFn/callMethod stash the thrown value there
(maybePropagateThrow); after every statement, runBlock drains it back into THAT block's env as `__throw`
(drainPendingThrow), where the ordinary halt + try/catch machinery resumes. It chains through any depth
(g→f→try) and composes with finally. One nuance handled: a throwing call nested inside a side-effecting one
in the same statement — `console.log(chk(-1))` — used to print a spurious value before the throw drained;
doConsoleLog now checks throwPending after formatting and skips the output. Direct throws, no-throw calls,
recursion (`fib(10)` = 55), and returned values are all unchanged. New `throwprop-diff` fuzzer (1000
programs/5 seeds, 0 diffs); full 125-fuzzer sweep GREEN. Toolchain pending-throw natives added (LOCAL).

---

**Rest parameters on methods (2026-07-22).** The prior rest-param fix worked for plain functions but
`{m(...xs){…}}` / class `m(...xs){…}` still bound wrong — `xs.length` read the length of the *name string*
(`"items".length` = 5), because the method's decoded parameter string came back EMPTY. Root cause:
object/class method bodies are encoded through resolveCalls' function-def branch (not `funcValueOf` /
`defineFn` like plain functions), and that branch encoded the parameter list from `inner` — which
resolveCalls had already run `expandSpreadArgs` over, mistaking the rest *parameter* `... xs` for a spread
*argument* and expanding it to nothing. Fixed by encoding the RAW parameter text (`item np of pieces`,
before spread expansion) in the function-def branch; a definition's parameter list is never a spread-arg,
so this is strictly correct and leaves normal params identical. Now method/class rest params bind a real
array (`xs.length`/`join`/`reduce`/`[i]`, mixed `a, ...rest`) exactly like function rest params; spread
ARGUMENTS at call sites (`f(...arr)`) are unchanged. Extended `restparam-diff` fuzzer with method/class
shapes (1000 programs/5 seeds, 0 diffs); full 125-fuzzer sweep GREEN.

---

**Calling a function from an array element / computed property (2026-07-22).** `arr[i]()`, `arr[i](args)`,
`obj[key]()` never invoked the function — they leaked the raw body. This had masqueraded as a "closure /
HOF-returning-a-function" bug: `[1,2,3].map(x=>()=>x*10); fns[1]()` produced `return2*10`, and instrumenting
callFnIdx proved the map callback returns a perfectly-baked fn value — the failure was purely `fns[1]()`.
resolveCalls recognized a callee only when it was a bare variable NAME (`envGet(env, lastTok)`); for
`a[0]()` the token before `(` is `]`, an index expression, so no dispatch fired. Fixed by resolving the
callee's boundary with recvStart/joinRange (the same backward `]`/`)`-group scan that fixed nested method
calls): evaluate `a[0]` to its fn value and call it, recomputing the consumed prefix from the callee start.
Also added a fast path for a callee that is already an inline chr(1) fn value. Now `arr[i]()`, curried
`map(x=>y=>x+y)` then `fns[i](n)`, and dynamic dispatch tables `ops[names[i]](a,b)` all work; plain index
reads, nested indexing `a[1][0]`, and method calls are unchanged. New `callfromindex-diff` fuzzer (1000
programs/5 seeds, 0 diffs); full 126-fuzzer sweep GREEN. (A separate PRE-EXISTING crash remains, unrelated
to this fix and not touched by it: a bracket index whose expression contains a member access —
`m[m.length-1]` — panics on the Int parse; `let i=m.length-1; m[i]` works. Logged for a dedicated fix.)

---

**Bracket index with a member access (2026-07-22).** The ubiquitous last-element idiom `arr[arr.length-1]`
(and `s[s.length-1]`, `a[a.length-2]`, `o[keys[i]]`, `grid[grid.length-1][0]`) PANICKED the whole runtime
("Cannot parse '… . length - 1' as Int"). resolveArrays evaluated the index through the shallow evalValue
and then parseInt, but resolveArrays runs BEFORE resolveProps in evalResolved, so a `.length` inside the
brackets was still unresolved when parseInt hit it. Arithmetic indices (`m[1+1]`) and temp-var indices
(`let i=m.length-1; m[i]`) worked, hiding it. Fixed by evaluating the index through the FULL evalResolved
chain (new evalIndex helper) at all four index sites (array, object, string-value, string-literal) — the
index's variables are already substituted to their values by that point, so evalResolved needs no env, and
it resolves `.length`/nested indices/arithmetic uniformly before the parse. Plain, arithmetic, temp-var,
nested (`a[1][0]`), and string-key indices are unchanged. New `indexexpr-diff` fuzzer (1000 programs/5
seeds, 0 diffs); full 127-fuzzer sweep GREEN.

---

**KNOWN-OPEN — increment/decrement in EXPRESSION position (2026-07-23).** `++x`/`x++`/`--x`/`x--`
work only as standalone STATEMENTS (`for(;;i++)`, `x++;` — both green). As value-producing
EXPRESSIONS they are broken: `console.log(x++)` -> NaN (and x never changes), `let y=++x` -> y=NaN
x unchanged, `while(x<3){console.log(++x)}` -> INFINITE LOOP printing NaN (x stays 0), and `a[++i]`
-> runtime PANIC. ROOT CAUSE: env is FUNCTIONAL — `envSet(env,n,v)` returns a NEW env string
(`n=v;`+env), while the substitution-based expression evaluator (jsEvalIn/evalValue) returns only a
Text VALUE, so any mutation performed while evaluating an expression is discarded. Statement-form
increment works precisely because it runs through execStmt which threads the new env forward.
Statement-level HOISTING is NOT a sound fix — JS's evaluation order is observable (`f(x++) + x` uses
old-x then new-x; a hoist can't reproduce that), so a partial hoist would silently miscompile the
interleaved cases. PROPER FIX (E0-scale, deserves its own focused session): a MUTABLE scalar binding
store (reuse the existing heapAlloc/heapGet/heapSet native seam that already backs objects/arrays) so
`let`/`var` scalars live in mutable cells and `++`/`--` mutate at the point of evaluation, the value
flowing out naturally. Then wire the four increment surfaces (prefix/postfix x, member `o.p++`, index
`a[i]++`) to read-modify-write the cell. Also closes the `a[++i]` panic. HIGH VALUE — extremely common
JS. Discovered when a stale 6-hour `while(++x)` probe was found pinning a CPU core.

---

**`++`/`--` in expression position (2026-07-23).** `let y=++x`, `console.log(++x)`, and `a[i++]` returned
NaN or PANICKED (`parseInt('NaN')`) — prefix/postfix increment worked only as a bare `x++;` statement, not
as a value-producing expression, because the value evaluator is value-returning and can't mutate the outer
env. Resolved at the STATEMENT level, ahead of every other execStmt handler: `incDecEnv` threads the env
forward applying each `++`/`--` left-to-right, and `incDecRewrite` (threading the same env) substitutes
each increment's value in place — prefix yields the NEW value, postfix the OLD — producing a
`++`/`--`-free statement that the ordinary handlers then run against the already-incremented env; a bare
`x++` falls out as a value-only no-op plus the env bump, subsuming the old whole-statement handler. Routing
is gated by `needsIncDec`→`hasSimpleIncDec`, which matches ONLY a simple-scalar increment and (via
`prevIsDot`) excludes member targets `o.c++`/`a[i]++` so they stay on the memberCompoundRewrite path;
control-flow headers (`for`/`while`/`if`/`switch`) are excluded so their own increment handling is
untouched. The old whole-statement `++`/`--` handlers were removed. Implementation note: the first cut had
execStmt tail-call a separate `execIncDec` which tail-called back into execStmt — the TCE codegen merged
the two functions and collided their differently-named params (`stmt` vs `s`); inlining the rewrite as
execStmt self-recursion fixed it. Now `++x`/`x++`/`--x`/`x--` work in assignment RHS, call args, indices
(`a[i++]`, `a[++i]`), and loop bodies (`r.push(i++)`, `f=f*n--`); bare and member increments, `+=`, and
for-loops unchanged. New `incexpr-diff` fuzzer (1000 programs/5 seeds, 0 diffs); full 131-fuzzer sweep
GREEN. (This is campaign task E-INC. Persistent mutable CLOSURE capture — `()=>++c` surviving across calls
— remains separate: it needs shared cells, not just expression-position increment.)

---

**KNOWN-OPEN — braceless loop bodies never execute (2026-07-23).** A `for`/`while` whose body is a
SINGLE statement WITHOUT braces runs the body ZERO times:
`for(let i=0;i<3;i++)s.push(i)` -> s stays `[]` (Node: `[0,1,2]`); `let t=0;for(let i=0;i<3;i++)t=t+i`
-> t stays `0` (Node 3); `let n=0;while(n<3)n=n+1` -> INFINITE LOOP (body never runs so n never
changes; Node terminates at 3). ISOLATION (6 differential probes): the BRACED forms
(`for(...){s.push(i)}`) work; a braceless `if(true)console.log("x")` works; the braceless-loop failure
reproduces WITH `i=i+1` in place of `i++`, so it is NOT the increment operator (E-INC / b949d82) — it
is the loop-body extraction not handling the no-brace single-statement body for `for`/`while`
specifically (the `if` path already handles it). VALUE: braceless loop bodies are extremely common;
this silently drops work and can hang. LIKELY FIX SITE: wherever the for/while executor slices its
body — mirror whatever the braceless-`if` handler does (take the next single statement when the char
after the header's `)` is not `{`). Found by a differential sweep while validating E-INC; NOT fixed
here because src/main.lg was under active concurrent edit at the time (engine owner: please pick up).

---

**BUG-HUNT BATCH — coercion / equality / scoping (2026-07-23).** A differential sweep of
under-fuzzed surfaces (read-only vs Node, no engine edit — engine under concurrent edit) turned up a
cluster of real, verified correctness bugs. Prioritized for the engine owner; each repro is
`bun run` vs `node -e`.

**P0 — CRASH.**
- `+"7"` (unary plus on a string) → **stack overflow / abort** (Node: `7`). Unary-plus ToNumber on a
  string token recurses without a base case. Also implies `+x` numeric coercion of any string arg is
  unsafe.

**P0 — `===` / `!==` ignore TYPE for number-vs-numeric-string.**
- `1 === "1"` → `true` (want `false`); `2 !== "2"` → `false` (want `true`). But `1===1`, `"a"==="a"`,
  `true===1`→false, `NaN===NaN`→false, `null===undefined`→false all CORRECT. ROOT: numbers are plain
  text, strings are chr(3)-tagged; strict-eq must be materializing BOTH (stripping the tag) then
  comparing text, so `1` and `"1"` collapse to `"1"==="1"`. FIX: strict-eq compares the RAW tagged
  form (or checks type tags first) — chr(3)+"1" must not equal bare "1". High test262 impact.

**P1 — arithmetic `-` `*` `/` don't ToNumber a string operand (return the LEFT operand).**
- `"5"-2`→`5` (want 3); `"3"*2`→`3` (want 6); `"10"/2`→`10` (want 5). (`+` concat and `2+true`→3 are
  fine.) The non-`+` arithmetic ops skip ToNumber coercion of string operands.

**P1 — array/object `+` ToPrimitive coercion produces garbage.**
- `[1,2,3]+""` → `"2 + \"\""` (want `"1,2,3"`); `[]+[]` → `"2 + 3"` (want `""`); `[]+{}` → `"3 + 2"`
  (want `"[object Object]"`). `+` with an array/object operand doesn't run ToPrimitive/Array.join.

**P1 — loose `==` gaps (null/undefined + ToNumber of bool/"").**
- `null==undefined`→`false` (want true); `0==""`→`false` (want true); `false==0`→`false` (want true).
  (`1=="1"`, `"5"==5` CORRECT — numeric-string `==` works; the gaps are the null≈undefined rule and
  ToNumber(false)=0 / ToNumber("")=0.)

**P1 — `let` block scoping in `for`.**
- Per-iteration binding missing: `for(let i…){f.push(()=>i)}` → all closures return the FINAL value
  (`3,3,3`) instead of `0,1,2`. A fresh `i` binding per iteration is required (`var` correctly gives
  `3,3,3`). Also `let i` in the for-header LEAKS: after the loop `typeof i` → `"number"` (want
  `"undefined"`) — the loop `let` isn't scoped to the loop.

**P2 — misc.**
- `(1e21).toString()` → `NaN` (want `"1e+21"`) — large-magnitude number formatting.
- `Number.prototype.toLocaleString` missing.

Found via bug-hunt track (task #1) while the engine was under concurrent edit; NOT fixed here.
Each would make a clean RED differential fuzzer (`coercion-diff`, `stricteq-diff`, `letscope-diff`)
once the engine owner lands fixes.

---

**BUG-HUNT BATCH 2 — strings/regex/errors/methods (2026-07-23).** Continued differential sweep
(read-only vs Node) of more under-fuzzed surfaces. All verified clean.

**P0 — CRASH.**
- `/(\d+)-(\d+)/.exec("12-34")` → **stack overflow / abort** (Node: match with `[1]="12" [2]="34"`).
  regex `.exec` with capture groups recurses without termination.

**P0 — property access on null/undefined does NOT throw.**
- `let z=null; z.x` → no error (Node: `TypeError: Cannot read properties of null`); same for
  `undefined.foo`. A `try{null.x}catch(e){…}` never enters the catch — the whole guard silently
  no-ops. Big: this is the single most common runtime TypeError, and many test262/real programs
  depend on it throwing.

**P1 — control-flow / higher-order gaps.**
- Optional catch binding: `try{throw 5}catch{…}` (no `(e)`) does not run the catch body (Node ES2019
  allows the binding-less form). `catch(e){…}` works.
- `[1,2,3].map(String)` → `["","",""]` (Node `["1","2","3"]`). Passing a BUILTIN function value
  (`String`, `Number`, `Boolean`…) as a HOF callback fails; an arrow `map(x=>String(x))` works — the
  builtin isn't callable through the callback dispatch.

**P1 — regex.**
- Global match returns only the FIRST hit: `"a1b2c3".match(/\d/g)` → `["1"]` (Node `["1","2","3"]`).
  The `/g` flag isn't iterating all matches in `String.prototype.match`.
- `String.prototype.replace(/(b)/,"[$1]")` → no substitution at all (Node `"a[b]c"`). `$1`/`$&`
  capture-reference templates in `replace` are unsupported (and the replace silently no-ops).

**P1 — string length is UTF-8 BYTES, not UTF-16 code units.**
- `"café".length` → `5` (Node `4`). Non-ASCII characters count their byte length; affects `.length`,
  indexing, slicing, iteration of any non-ASCII string. Architectural (string representation).

**P2 — missing / broken builtins.**
- `Object.is(a,b)` → `NaN` (missing; needs the SameValue algorithm incl. `-0`/`NaN`).
- `String.prototype.split(sep, limit)` → the `limit` arg is ignored (`"a-b-c".split("-",2)` → 3 elems).
- `Number.prototype.toPrecision(n)` → `NaN` (missing).
- Integer-key ordering: `Object.keys({2:1,1:2,10:3})` → insertion order `["2","1","10"]`; JS sorts
  integer keys ascending → `["1","2","10"]`. Affects keys/values/entries/JSON/for-in on numeric keys.
- `(1e21).toString()` → `NaN` (Node `"1e+21"`); large-magnitude / exponential formatting.
- `Number.prototype.toLocaleString` missing.

**Note (not a bug):** `console.log([1,2,3])` renders `1,2,3` vs Node's `[ 1, 2, 3 ]` — a console
array-inspect FORMATTING difference (util.inspect), distinct from value correctness. Flagged low-pri
in case byte-exact stdout parity is wanted later.

~13 defects here + the 11 in the prior batch = a prioritized correctness backlog for the engine
owner. Found via bug-hunt track (task #1); read-only, main.lg under concurrent edit so not fixed.

---

**BUG-HUNT BATCH 3 — control-flow / operators / hoisting (2026-07-23).** Verified clean vs Node.

**P0 — `do…while` body never executes.**
- `let k=0; do{k=k+1}while(false); console.log(k)` → `0` (Node `1`); `do{n=n+1}while(n<3)` → `0`
  (Node `3`). The do-while body runs ZERO times (even WITH braces) — the statement handler evaluates
  the `while` guard first / never enters the body. Common loop form; distinct from the braceless-loop
  bug (this one is braced).

**P0 — function declarations are not hoisted.**
- `f(); function f(){return 7}` → `NaN` (Node `7`). Calling a `function` decl BEFORE its textual
  position fails; `function f(){…}; f()` works. Function hoisting is pervasive in real code (mutual
  recursion, helpers-below-usage).

**P1 — `instanceof` fails for BUILT-IN constructors.**
- `[1] instanceof Array` → `false`; `new Date() instanceof Date` → `false` (Node `true`). A USER class
  `new A() instanceof A` → `true`. Built-in prototype chains (Array/Date/…) aren't recognized by
  `instanceof`.

**P1 — labeled continue/break.**
- `outer: for(…){ for(…){ if(j===1) continue outer; s+=i } }` → `""` (Node `"012"`). Labeled
  `continue`/`break` to an outer loop label isn't handled (produces empty / wrong control flow).

**P1 — `void` operator.**
- `typeof void 0` → `"number 0"` (Node `"undefined"`). `void expr` doesn't evaluate-and-discard to
  `undefined`; it leaks a garbage token.

(Correct in this sweep: `switch` fallthrough, ternary + nested ternary, `in`, `%`, `~`, `&&`/`||`,
bitwise `&`, `??`, `??=`, duplicate object literal key = last-wins, user-class `instanceof`.)

Batch totals across the 2026-07-23 hunt: ~30 verified correctness defects (2 stack-overflow crashes,
null/undefined no-throw, do-while/hoisting/instanceof/labeled-flow, === type-blindness, arithmetic
& ToPrimitive coercion, /g match + replace-$1, UTF-8 length, let-scoping, + ~10 missing/partial
builtins). All read-only finds (bug-hunt track #1); main.lg under concurrent edit → documented, not
fixed. Each is a ready-made RED differential-fuzzer target once the engine owner lands fixes.

---

**BUG-HUNT BATCH 4 — classes/destructuring/JSON/array (2026-07-23, hunt closing).** Verified vs Node.
Yield is dropping sharply (~2 defects/batch vs ~11 in batch 1) — the engine is largely complete in
these areas; this batch closes the sweep.

**P1 — `super.method()` (super method call).**
- `class B extends A{ m(){ return super.m()+1 } }` → `NaN` (Node `2`). `super()` constructor calls
  work; `super.<method>()` dispatch to the parent prototype does not.

**P1 — nested destructuring patterns.**
- `let [[a],[b]] = [[1],[2]]` → `a`/`b` = NaN (Node `1`/`2`); `let {a:{b}} = {a:{b:7}}` → `b` = NaN
  (Node `7`). One level of array/object destructuring works (`[a,b]`, `{x,y}`, rest, defaults); a
  NESTED pattern inside it is not recursed.

**P1 — `JSON.stringify` doesn't drop `undefined` values.**
- `JSON.stringify({a:undefined,b:1})` → `{"a":undefined,"b":1}` (Node `{"b":1}`). A property whose
  value is `undefined` must be OMITTED (and produces INVALID JSON as emitted — `undefined` is not a
  JSON token). Same rule: `undefined` array elements → `null`, top-level `undefined` → no output.

**P2 — `Array.prototype.fill(value, start)` with a start index.**
- `[1,2,3].fill(0,1)` → `[NaN,NaN,NaN]` (Node `[1,0,0]`). The single-arg `fill(v)` works; the
  start/end range form corrupts (fills the whole array with NaN instead of the sub-range).

(Correct in this sweep: super() ctor, static methods, private fields, class getters, single-level
array/object/rest/default destructuring, template literals + interpolation, generators + spread,
spread-call, JSON parse/stringify of nested/quotes/null/bool, padStart, Math.round/floor/isInteger,
toFixed, charCodeAt, fromCharCode, slice/indexOf/sort-cmp/includes/Array.from/flat.)

**HUNT SUMMARY (2026-07-23):** ~35 verified correctness defects across 4 categories-batches. The
engine is strong on happy-path OOP/functional/collection/JSON code; the gaps cluster in (a) VALUE
SEMANTICS — coercion, ToPrimitive, strict-eq type identity, UTF-16 length; (b) STATEMENT FORMS —
do-while, function hoisting, labeled flow, braceless bodies; (c) THROW behavior — null/undefined
member access; (d) a long tail of partial builtins. Two stack-overflow crashes (`+"str"`,
`exec`-with-groups) are the only hard-fail P0s. This backlog (task #32) + the parser (task #29) are
the concrete route from 93.94% toward ≥99%.

---

**BUG-HUNT BATCH 5 — numeric-edge + property-descriptor CRASHES (2026-07-23).** Hunting genuinely
un-touched areas (arithmetic edge cases, `Object.*` descriptor ops) surfaced FOUR more process
crashes — new areas, new crash clusters (so the hunt was not yet exhausted). Verified clean vs Node.

**P0 — CRASHES (process panic / stack overflow).**
- `10 % 0` (integer modulo by zero) → **panic** (Node `NaN`). Also `7%0`. Rust `%` on 0 divisor.
- `2 ** -1` / `4 ** -2` (integer base, NEGATIVE integer exponent) → **panic** (Node `0.5` / `0.0625`).
  `2**0.5` (fractional exp) and `Math.pow(2,-1)` both WORK — the `**` operator takes an integer-pow
  path that overflows/panics on a negative exponent. Fix: fall to float pow when exp<0 or non-integer.
- `Object.defineProperty(o,"x",{value:5})` → **stack overflow** (Node `5`).
- `Object.getOwnPropertyDescriptor({a:1},"a")` → **stack overflow** (Node `{value:1,…}`).

These four join the earlier two (`+"str"`, `/re/.exec()` with groups) → **6 hard crashes total**, the
highest-priority robustness fixes (a JS engine must never abort on `10%0` or `2**-1`).

**P1/P2 — Object descriptor gaps.**
- `Object.freeze(o)` / `Object.isFrozen(o)` → `NaN` (missing; isFrozen should be true after freeze).
- `Object.getPrototypeOf({})===Object.prototype` → `false` (getPrototypeOf doesn't return the real
  prototype object).
- Getter with side effects re-read: `let o={get x(){c++;return c}}; o.x;o.x;o.x` → `NaN` (Node `3`);
  a side-effecting getter accessed repeatedly misbehaves (simple no-side-effect getters work).

(Correct in this sweep: `1/0`→Infinity, `-1/0`→-Infinity, `0/0`/`Inf-Inf`/`sqrt(-1)`→NaN,
`2**0.5`, `Math.pow`, `MAX_SAFE_INTEGER+1`; Map/Set dup-key/size/keys/has; `Object.keys().length`;
`delete o.a` then `"a" in o`→false; regex `/g` replace; split-on-empty; indexOf/lastIndexOf.)

**Updated crash tally for task #32: 6 P0 crashes** — `+"str"`, `exec`-with-groups, `%0`, `**`-neg-exp,
`defineProperty`, `getOwnPropertyDescriptor`. Fix these first (each is a one-spot guard: NaN/float-
path/implement-the-method). Read-only find; main.lg under concurrent edit.

---

**BUG-HUNT BATCH 6 — bitwise/hex/Error/JSON-parse (2026-07-23).** Verified clean (binary stable
between the concurrent session's builds — NB: the shared debug binary is periodically wiped mid-
rebuild, so probes must sanity-check `1+1` first; several apparent failures were exec-of-missing-
binary, not engine bugs, and were discarded).

**P0 — 3 more CRASHES (→ 9 total).**
- `~3.7` (bitwise NOT of a NON-INTEGER) → **panic** (Node `-4`). `~3` (integer) works. `~`/`~~` need
  ToInt32 (truncate) before the bitwise op; a fractional operand panics. `~~x` (common float-trunc
  idiom) hits this.
- `0xFF | 0x100` → **panic** (Node `511`). Two root causes: (1) the hex literal `0x100` (256) parses
  to **NaN** — `0xFF` works but `0x100`+ fail (hex-literal parse breaks at ≥ 3 hex digits / ≥ 256);
  (2) a bitwise op with a NaN operand then panics (should ToInt32(NaN)=0). `255|256` (decimal) → 511
  correct.
- `new Error("x").toString()` and `String(new Error("x"))` → **stack overflow** (Node `"Error: x"`).
  `err.message` works; `Error.prototype.toString` (`name: message`) recurses/overflows.

**P1 — correctness.**
- `0x100` hex literal → `NaN` (want 256) — hex literals beyond `0xFF` don't parse (also feeds the
  bitwise crash above).
- `JSON.parse("{bad")` → no throw (Node throws `SyntaxError`, so a `try/catch` guard catches). Invalid
  JSON is not validated — parse silently returns nothing instead of throwing.
- `[3,2,1].reduceRight(fn)` → unimplemented (returns raw text).
- `new Array(3)` → `NaN` (want an array of length 3) — the `Array(len)` constructor form.

(Correct in this sweep: `1<<31`, `-1>>>0`, `256<<24`, `255|256`, `255|0`, string/`null>=0`/`undefined<1`
comparisons, `[…].sort()`, `concat`, `Date.now`, `new RangeError().message`.)

**Running crash tally (task #32): 9 P0 crashes** — `+"str"`, `exec`-groups, `%0`, `**`-neg-exp,
`defineProperty`, `getOwnPropertyDescriptor`, `~`-float, bitwise-with-NaN (`0x100`), `Error.toString`.
All are one-spot guards (ToInt32/ToNumber/NaN-clamp/implement-method). Read-only, main.lg concurrent.

---

**BUG-HUNT BATCH 7 — regex features / array iterators / tagged templates (2026-07-23).** Verified
clean (binary sanity-checked). Un-hunted areas again yielded clusters + a 10th crash.

**P0 — CRASH (→ 10 total).**
- Tagged template literals: `` f`hello` `` and `` f`n${9}` `` → **stack overflow** (Node `"hello"`,
  `"n9"`). The tagged-template call form isn't handled and recurses. (Plain template literals
  `` `n${9}` `` work — it's the TAG-function application that crashes.)

**P1 — regex engine missing core features (cluster).**
- Alternation `|`: `/cat|dog/.test("dog")` → `false` (want `true`). **Common; high impact.**
- Non-capturing group `(?:…)`: `/(?:ab)+/.test("abab")` → `false` (want `true`).
- Lookahead `(?=…)`: `/a(?=b)/.test("ab")` → `false` (want `true`).
- (Char classes `[0-9]+`, anchors `^…$`, `split(/re/)` all work.) The backtracking engine handles
  literals/classes/quantifiers/anchors but not alternation / groups(non-capturing) / lookahead.

**P1 — array index iterators.**
- `[1,2,3].keys()` → empty (want `0,1,2`); `[1,2,3].entries()` → empty (want `[[0,1],[1,2],[2,3]]`);
  `for(const [i,x] of arr.entries())` yields nothing. `Array.prototype.keys/entries/values` (the
  index-iterator protocol) unimplemented. (`Object.entries` works.)

**P1 — replace with multiple capture refs.**
- `"a1b2".replace(/([a-z])(\d)/g,"$2$1")` → unchanged (want `"1a2b"`). Confirms + extends the batch-2
  `$1` finding: multi-group `$2$1` templates unsupported (replace no-ops).

**P2 — missing string statics/methods.**
- `String.fromCodePoint(97)` → `NaN` (want `"a"`); `"a".localeCompare("b")` → doesn't return negative
  (want `<0`). (`codePointAt` works.)

**Running tally (task #32): ~53 verified defects, 10 P0 crashes** (added: tagged-template). Regex
alternation and array iterators are the highest-impact new items (both common). Read-only find;
main.lg under concurrent edit.

---

**BUG-HUNT BATCH 8 — Map/Set operations + arguments object (2026-07-23).** Verified clean. Map/Set
are heavily used and their mutation/iteration is substantially broken.

**P0 — CRASH (→ 11 total).**
- `new Map([["a",1],["b",2]]).delete("a")` then `[...m.keys()]` → **stack overflow** (Node keys `"b"`).
  `Map.prototype.delete` (or key-iteration after a delete) recurses/overflows.

**P1 — Map/Set mutation & iteration.**
- `Set.prototype.delete` is a NO-OP: `new Set([1,2,3]).delete(2)` leaves `[1,2,3]` (want `[1,3]`), and
  returns `NaN` (want `true`).
- `Map.prototype.forEach` / `Set.prototype.forEach` never invoke the callback:
  `new Map([["a",1],["b",2]]).forEach((v,k)=>…)` → nothing (want `a1b2`); Set.forEach sum → `0`
  (want `3`). (Map/Set `.set`/`.add`/`.get`/`.has`/`.size`/construction + spread `[...m]` all work;
  only delete + forEach are broken.)

**P1 — the `arguments` object is broken.**
- `function f(){return arguments[0]+arguments[1]}; f(3,4)` → `NaN` (want `7`); `arguments.length`
  → `9` (want the real arg count). The magic `arguments` binding isn't populated with the call args.
  (Named params, `...rest`, defaults, extra args, destructured params all work — so use `...args`;
  but legacy `arguments` fails.)

**P2 — missing.**
- `WeakMap` — `new WeakMap().set(k,5).get(k)` → `NaN` (unimplemented; task #26).
- `Number.prototype.toExponential` → `NaN` (missing).

(Correct: default/rest/destructured params, extra-arg tolerance, Set/Map set/add/get/has/size/spread,
toFixed, toString(radix), parseInt-whitespace, Array.isArray/of/flat(depth)/findIndex.)

**Running tally (task #32): ~60 verified defects, 11 P0 crashes** (added Map.delete). Map/Set delete
+ forEach and the `arguments` object are the impactful new items. Read-only; main.lg concurrent.

---

**BUG-HUNT BATCH 9 — generators-advanced / freeze / matchAll / async-return (2026-07-23).** Verified.

**P1 — generator advanced protocol (cluster; basic `yield` works).**
- `yield*` delegation: `function*g(){ yield*[1,2]; yield 3 }` → `[NaN,3]` (Node `[1,2,3]`) — the
  delegated iterable isn't spread.
- Generator `return` value: `function*g(){ yield 1; return 9 }` → `it.next()` after the yield gives
  `NaN` (Node `9`) — the `return` value isn't delivered as the final `{value}`.
- Bidirectional `next(arg)`: `function*g(){ let x=yield 1; yield x }; it.next(); it.next(5)` → `x` is
  `undefined` (Node `5`) — a value passed INTO `next()` isn't bound to the `yield` expression.
  (Simple `yield`/`[...g()]` iteration works; the advanced protocol does not.)

**P1 — `Object.freeze` is a NO-OP.**
- `Object.freeze(o); o.a=2` → `o.a` becomes `2` (Node `1`). freeze doesn't prevent mutation (and
  `isFrozen` → NaN, batch 5). Frozen-object semantics unenforced.

**P1 — `async function` return value not resolved.**
- `async function f(){return 5}; f().then(v=>console.log(v))` → nothing (Node `5`). An async
  function's plain return isn't wrapped so `.then` fires. (`await`, `Promise.resolve().then` chains
  work — so the microtask engine is fine; the async-fn RETURN→resolve bridge is the gap.)

**P1 — `matchAll`.**
- `[..."a1b2".matchAll(/(\d)/g)].length` → `4` (Node `2`). matchAll over-yields (likely per-char, not
  per-match).

(Correct: Object.assign, object spread independence, Object.values, Object.fromEntries, `replace`
first-literal, `at(-1)`, `repeat(0)`, `padStart` default, `Promise.resolve().then` chain, `await`.)

**Running tally (task #32): ~66 verified defects, 11 P0 crashes.** Generator-advanced + async-fn-
return + Object.freeze-noop are the notable new items. Read-only; main.lg concurrent.

---

**`++`/`--` inside a function body (2026-07-23).** A follow-on to E-INC: `function g(){let x=5;x++;return
x}` returned 5 (and `return ++x` → NaN), because the statement-level increment rewrite fired on the WHOLE
function-DECLARATION statement and rewrote the `x++` sitting INSIDE the function body — at definition
time, in the outer scope where `x` doesn't exist, so `x++` became `NaN` right there in the stored body.
(Top-level `x++` and loop-update `i++` dodged it; this is the same class as the markerInBody method-
dispatch bug.) Fixed by threading a brace-depth through hasSimpleIncDec / incDecEnv / incDecRewrite: a
`++`/`--` is only recognized and rewritten at brace-depth 0, so anything inside a `{ … }` function/block
body is left untouched (emitted verbatim) to be handled when that body actually runs. Increments in parens
/ brackets (`a[i++]`, `f(i++)`) stay at depth 0 and still rewrite. Now `x++`/`++x` work inside function
and method bodies, `for(…;i++){ r*=i }` factorials work, and a function expression `let f=function(){let
c=0;return ++c}` returns fresh values per call. New function-body cases added to `incexpr-diff`; full
131-fuzzer sweep GREEN. (Also refactored the six function-call sites to shared fnParams/fnBody value
parsers. A persistent-mutable-CLOSURE capture attempt — heap-boxed captured env — was prototyped and got
the accumulator `acc(); a(5); a(3)` → 8 working, but it turned the counter `()=>++c` from NaN into a
stack-overflow (a regression) and touches the core call path, so it was reverted to the known-good baking
model; it is scoped as a dedicated increment now that this in-function-`++` prerequisite is fixed.)

---

**Cluster A — ToNumber at the numeric-operator boundary (2026-07-23, 16th engine fix).** `-`/`*`/`/`/`%`
are ALWAYS numeric in JS: a string operand is coerced via ToNumber. jsint didn't — `"5" - 2` returned
the LEFT operand (`"5"`, because `litToStr` extracted the quoted `5` and silently dropped the ` - 2`),
and `10 - "4"` (string on the right) **stack-overflowed** (`termValue` fell back to `evalValue`, which
re-entered `hasStr`→`concatTerms`→`termValue` forever). Also broke string VARIABLES in arithmetic
(`let x="5"; x-2` → the literal text `5 - 2`). **Fix:** (1) `termValue` now routes a term carrying a
top-level `-`/`*`/`/`/`%`/`**` to `arithValue` directly (breaking the recursion), keeping a pure string
literal / array / opaque-fn as-is; the tagStr short-circuit sits BELOW `hasTopArithOp` because a
resolved string value stores its internal spaces as `encSpace` — so a REAL space after a `<tagStr>`
value means a trailing operator (`<tagStr>5 - 2`), while a genuine string value (`<tagStr>a‹encSpace›-‹encSpace›b`)
has none and stays a string. (2) A `coerceStrLits` pre-pass in `arithValue` replaces every `"..."`
literal with its ToNumber value BEFORE tokenizing on spaces, so a whitespace-padded numeric string
(`" 3 "` → 3) survives (its spaces would otherwise shatter it across tokens). (3) `coerceNumTok` runs
`jsStrToNum` on a `<tagStr>` operand. `jsStrToNum` = decode (encSpace→space) → trim → strict
`isNumericStr` (`5`/`-3`/`3.14`/`.5`/`5.`, all-or-nothing so `"42px"`→NaN) → else NaN; `""`→0. The `+`
concat path (`concatTerms`/`plusStep`) is untouched — `"5"+2`→"52" stays. Closed: `"5"-2`=3,
`10-"4"`=6, `"6"*2`=12, `7/"3"`=2.333…, `" 3 "-1`=2, `"abc"-1`=NaN, string-var arith, chains. New
`tonumber-diff` fuzzer (2400 checks/6 seeds incl. the substitution path + concat regression guards).
Still OPEN in Cluster A: unary `+"str"` (needs precedence-aware handling, `+"7"+3` = `(+"7")+3`) and
loose `==`/`!=` coercion (`0==""`, `false==0`, `null==undefined` — the `cmpVals` textual-compare path,
separate from arithmetic). GOTCHA banked: **string-internal spaces are `encSpace` (chr(4)), so the
native `trim` no-ops on them — decode before any numeric parse** (cost me a debug cycle: `trim("3 ")`
looked broken but the "space" was chr(4)).

**Cluster A — loose equality `==`/`!=` (2026-07-23, 17th engine fix).** `==` did a plain `cmpVals`
(materialized textual/int compare) with no type coercion, so `0 == ""`, `false == 0`,
`null == undefined`, `true == 1`, `0 == false`, `"" == false`, `1 == true`, `"1" == true` all wrongly
returned `false`. **Fix:** the real Abstract Equality Comparison in a new `looseEqVal` (jsEvalCmp's
`==` branch now calls it, `!=` negates it): same type → strict (`sameTypeEq`: numbers via `numEqTxt`,
else materialized compare); `null`≈`undefined` **and only each other** (`null == 0` stays false);
`boolean` → ToNumber then recurse; `number`↔`string` → compare as numbers (reuses the Cluster-A
`jsToNumberOf`/`jsStrToNum`). `NaN` equals nothing; object identity unchanged. New `jsType` classifier
+ `looseeq-diff` fuzzer (2400 checks/6 seeds across null/undefined/bool/number/string/NaN/whitespace-
string mixes). `5.0 == 5`→true, `" 1 " == 1`→true. **Cluster A arithmetic + equality now DONE; only
unary `+"str"` (precedence-aware crash) remains open.**

**Cluster A — unary `+"str"` (2026-07-23, 18th engine fix; Cluster A CLOSED).** `+"7"` stack-overflowed
(unary `+` is excluded from the arithmetic-operator set — correctly, since binary `+` is concat — so
the `+ "7"` term fell through `termValue` to `evalValue` and looped). Unary minus already worked
(`-"7"`→-7, because `-` IS an arith op). **Fix:** a leading unary `+` (not `++`) is ToNumber, which is
exactly what `arithValue` does to its operand — so `termValue` strips the leading `+` and routes the
rest to `arithValue`. Precedence is automatic: `concatTerms` already split on ` + `, so `+"7" + 3`
arrives as the separate term `+"7"` (→7) then `+ 3` → 10; `+"7" - 2` → 5; `+"abc"`→NaN; `+""`→0;
`3 + +"7"`→10. tonumber-diff fuzzer extended with unary-plus + precedence cases (2400/6 seeds). Full
sweep green. **NOTE (separate pre-existing bug, NOT this fix):** `typeof +"7"` / `typeof -"7"` panic
(`Cannot parse '+' as Int`) — typeof doesn't parenthesize a unary-prefixed operand; `typeof (+"7")`
works. Filed for a future typeof fix.

**`typeof` of a unary-prefixed operand (2026-07-23, 19th engine fix).** `typeof` grabbed only the first
space-token as its operand, so a unary prefix broke it: `typeof -5` **panicked** (`jsEval("-")`),
`typeof !0` leaked the operand (`"number 0"` instead of `"boolean"`), `typeof ~5`→`"number 5"`. **Fix:**
`resolveTypeof` now consumes the full unary-prefix chain (`!-3` = `!(-3)`) plus its one primary via
`typeofOperandLen`, evaluates that unary expression, and classifies the value with a shared `typeOfVal`
(refactored out of `typeOfTag`). Also `arithValue` strips a leading unary `+` (`stripUnaryPlus`) — it
is ToNumber, the identity in a numeric context — so the native integer evaluator never chokes on a bare
`+` prefix (`+-3`→-3, `typeof +-3`→"number"). `typeof -5`/`!0`/`~5`/`+"7"`/`!-3` all correct now.
`typeofunary-diff` fuzzer (unary prefixes over number/string/bool operands + `typeof` precedence vs
binary `+`). Known limit (pathological, not real-world, not fuzzer-reachable): quadruple-nested
alternating signs `+-+-5` still panics — the flattened integer evaluator folds only one leading sign.

**Cluster B — array ToPrimitive in `+` (2026-07-23, 20th engine fix).** An array/object on the LEFT of
`+` collapsed to its heap id — `[1,2,3] + ""`→`0 + ""`, `[[1],[2]] + ""`→`2 + ""` (2 = the outer
array's id) — while the right side worked (`"" + [1,2,3]`→"1,2,3"). **Root cause:** `evalValue`'s
`isRef` early-return fired whenever the expression merely *started* with a ref (`chr(2)`), so
`<ref> + ""` was returned whole as a "ref" and then materialized to `id + ""` (tag stripped). Fixed by
taking that early-return only for a BARE ref (no trailing space). Second gap: `[1] + 1` / `[]+[]` /
`5+[1]` have no string literal, so they routed to `arithValue`→NaN; but `+` with an array/object
operand is string-concatenation (ToPrimitive). `plusStep`'s fallback already does the right
materialized concat, so `evalValue` now routes a `+` expression containing a ref to `concatTerms`.
`[1,2]+[3,4]`→"1,23,4", `[1]+1`→"11", `[]+[]`→"", `[1]+[2]+[3]`→"123", `[1,2]+{}`→"1,2[object Object]"
all correct; arithmetic without refs unaffected (`1+2`→3, `"5"-2`→3). `toprimitive-diff` fuzzer (2400
checks/6 seeds, arrays+numbers+strings). **Object-specific follow-ups (separate, NOT this fix):** a
leading `{}` parses as a BLOCK not an object literal (`{} + 1`→1 in Node) and `("r=" + ({} + []))`
still crashes (ERR:101) — object-literal parsing, distinct from array ToPrimitive.

**Relational coercion + `isNaN`/`isFinite`/`Number` decimals (2026-07-23, 21st engine fix).** Three
numeric-coercion gaps found by a broad probe: (1) **`isNaN("x")` stack-overflowed** — `isNaN` wasn't a
recognized global so the call recursed. (2) `10 > "5"`→false — relational `<`/`>`/`<=`/`>=` did a plain
textual/int `cmpVals`, no ToNumber. (3) `Number("3.14")`→NaN — `Number()` used `jsNumberText` (ints/hex
only). **Fix:** `isNaN`/`isFinite` added to `isGlobalFn`+`globalCall` (`isNaN(x)`=ToNumber(x) is NaN;
`isFinite` via `isFiniteNum`); `Number()` now routes non-radix input through `jsToNumberOf`→`jsStrToNum`
(decimals, whitespace, `""`→0) while keeping hex. Relational operators use the Abstract Relational
Comparison (`relCmp`): both-strings→lexicographic, else ToNumber both and compare numerically
(`numCmpVal` = int-exact or the sign of the native f64 difference, so `10.5 > 9.5` isn't decided by
text); `relIsNaN` returns the false-on-NaN result. `10 > "5"`→true, `"5" > "10"`→true (lexicographic),
`10 > "abc"`→false, `Number("3.14")`→3.14, `isNaN("x")`→true. New `relcoerce-diff` fuzzer (2400
checks/6 seeds). Full sweep green.

**`Array(...)` constructor (2026-07-23, 22nd engine fix).** `Array(3)`→NaN, `new Array(3)`
**stack-overflowed** — the constructor was unimplemented (only `Array.of`/`from`/`isArray` existed). Its
notorious overload: a single numeric arg is the LENGTH (n empty slots, rendered undefined), any other
arg list is the elements (like `Array.of`). `arrCtor` implements it; wired boundary-safely — `Array`
goes through the token-based `globalCall`/`isGlobalFn` (so `getArray()` is NOT mis-matched as a suffix)
and `new Array (` gets its own `resolveMethods` branch beside `new Set (`. `Array(3).length`→3,
`Array(3).fill(0)`→"0,0,0", `new Array(3).fill(7)`→"7-7-7", `Array(1,2,3)`→"1,2,3", `Array("x")`→1
element, `Array.isArray(Array(3))`→true. New `arrayctor-diff` fuzzer (2400 checks/6 seeds). Full sweep
green. (Separate gaps noted for later: `"café".length` returning byte-count not code-units.)

**Bare global-fn as an array callback (2026-07-23, 23rd engine fix).** `["1","2"].map(Number)`→empty,
`[0,1,2].filter(Boolean)`→empty, `.map(String)`→garbage — the callback machinery only understood
arrow/function literals, so a bare global (`Number`/`String`/`Boolean`/`parseFloat`) had no params/body
and each call returned "". Fixed at the shared resolvers `fnArgVal`/`fnArgValRaw` (which feed all ~20
higher-order callback sites — map/filter/forEach/some/every/find/reduce/sort/Array.from): a bare unary
global is `synthGlobalCb`'d into the closure `(__cbx) => <name>(__cbx)`, so it rides the ordinary
closure-application path. `parseInt` is deliberately EXCLUDED (as a callback its 2nd arg is the index =
radix — the famous `map(parseInt)` gotcha). `map(Number)`→numbers, `filter(Boolean)`→truthy,
`map(parseFloat)`→floats; arrow callbacks unaffected. New `fncallback-diff` fuzzer (2400 checks/6
seeds). Full sweep green.

**`String.split(sep, limit)` (2026-07-23, 24th engine fix).** The optional 2nd argument (result-length
cap) was ignored — `"a,b,c".split(",", 2)`→`["a","b","c"]` (want `["a","b"]`). The dispatch took the
whole `methodArg` as the separator; now it `splitArgsN`'s the args, uses arg 1 as the separator, and
`splitLimit`/`arrTake` cap the result to arg 2 (both string and regex separators). `split(",", 2)`→"a|b",
`split(",", 0)`→[], over-limit and no-limit unchanged. New `splitlimit-diff` fuzzer (2400 checks/6
seeds). Full sweep green. (Also found, deferred: `5..toString()` stack-overflows — the double-dot
number-method syntax.)

**`Math.max()`/`Math.min()` with no arguments (2026-07-23, 25th engine fix).** Returned NaN; the correct
identity elements are `-Infinity` (max) and `Infinity` (min) — so e.g. a running `Math.max(acc, x)` fold
seeded from `Math.max()` works. Added an empty-args guard to both dispatch branches. Variadic/negative
args unchanged. New `mathminmax-diff` fuzzer (0..3 args incl. empty). Full sweep green.

**`Math.*` inside a function/callback body (2026-07-23, 26th engine fix).** `[1,5].map(x=>Math.max(x,3))`
→`[NaN,NaN]`, `reduce((a,b)=>Math.max(a,b))`→NaN, `(x=>Math.max(x,5))(2)`→NaN — **the same for an
explicit `function(x){return Math.max(x,3)}`, so it was a function-*body* bug, not arrow-specific.** The
Math dispatches in `resolveMethods` (max/min/abs/sqrt/trunc/hypot/atan2/pow/sign/floor/ceil/round + the
`mathUnary1` transcendentals) run BEFORE the map/reduce dispatch that extracts the callback, and — unlike
`new Map(`/`new Set(` — they lacked a `markerInBody` guard, so a `Math.*` sitting inside a closure body
got resolved at closure-CREATION time with the callback param still unbound (→NaN baked in). Constant-arg
Math (`x=>Math.max(4,1)`) survived by luck; param-referencing (`Math.floor(x+0.5)`) did not. Fixed by
adding the `markerInBody` guard to every Math function branch (and to `mathUnaryTry`), so an in-body
`Math.*` is skipped and resolves at call time with the param bound. `map(x=>Math.floor(x))`,
`reduce((a,b)=>Math.max(a,b))`, `map(x=>Math.sin(x))` all correct; direct Math + non-Math callbacks
unaffected. New `mathcallback-diff` fuzzer (2400 checks/6 seeds). Full sweep green.

**Every standalone static inside a callback body (2026-07-23, 27th engine fix).** The Math-in-callback
fix predicted a whole class: ANY receiver-less static dispatched in `resolveMethods` (which runs before
the callback is extracted) corrupts a closure body the same way. Confirmed broken:
`map(o=>Object.keys(o))`/`Object.values`/`Object.entries`/`Object.assign`/`Object.fromEntries`,
`map(o=>JSON.stringify(o))`, `map(a=>Array.isArray(a))`/`Array.of`/`Array.from`,
`filter(x=>Number.isInteger(x))`/`isNaN`/`isFinite`/`isSafeInteger`/`parseInt`/`parseFloat`,
`map(c=>String.fromCharCode(c))` — all NaN/false (`Number(x)`/`String(x)` were fine, they go through the
token-based `globalCall`, not `resolveMethods`). Added the `markerInBody` guard to all ~25 receiver-less
statics (Object/JSON/Array/Number/String/Promise/Reflect), matching Math. `map(o=>Object.keys(o).length)`,
`map(o=>JSON.stringify(o))`, `filter(x=>Number.isInteger(x))` all correct now; direct static calls
unaffected. New `staticcallback-diff` fuzzer (2400 checks/6 seeds). Full sweep green. **Doctrine: a
receiver-less static marker in `resolveMethods` MUST carry a `markerInBody` guard.**

**Destructuring parameter in a callback (2026-07-23, 28th engine fix).** `.map(([a,b])=>a+b)`→NaN,
`.map(({n,v})=>n+v)`→NaN, `Object.entries(o).map(([k,v])=>k+v)`→NaN — a destructuring pattern in a
map/filter/find/some/every/forEach callback param wasn't destructured. A NAMED function
(`let f=([a,b])=>…; f([1,2])`→3) worked because `callFn` uses `bindParams` (destructuring-aware), but
`callFnIdx` (the per-element applier for those methods) bound `item 1 of params` — the whole pattern —
as one variable name. Added `bindParamVal`, which honors a `[…]`/`{…}` pattern via the same
`destructureArr`/`destructureObj` the named path uses, and routed `callFnIdx`'s element + index binding
through it. `map(([a,b])=>a+b)`, `map(({a})=>a)`, `filter(([a,b])=>a<b)`, `map(([a,...r])=>…)` (rest)
all correct; plain-param callbacks unaffected. New `destructcb-diff` fuzzer (2400 checks/6 seeds). Full
sweep green. (Nested patterns like `[a,[b,c]]` remain unsupported — a pre-existing `destructureArr`
limitation that also affects `let [x,[y,z]]=…`, not this fix.)

**`Object.freeze` / `Object.isFrozen` (2026-07-23, 29th engine fix).** Both were undispatched → NaN, so
the ubiquitous `const F = Object.freeze({…})` then `F.prop` gave NaN. Added both (guarded per the
receiver-less-static doctrine): `Object.freeze(x)` returns `x` (objects, arrays, primitives), and
`Object.isFrozen` of a plain object is `false`. `Object.freeze({a:1}).a`→1, `Object.freeze([1,2]).length`
→2, `Object.keys(Object.freeze({a,b}))`→2 (freeze adds no hidden field), works in a callback. New
`objfreeze-diff` fuzzer (1200 checks). Full sweep green. **Honest limitation:** we do NOT enforce
immutability (a write to a frozen object still mutates) and `Object.isFrozen` doesn't track actual
frozen-ness — enforcement is a separate feature; this locks the common return-value contract.

**Destructuring parameter in a `reduce` callback (2026-07-23, 30th engine fix).** The #28 fix covered
`callFnIdx` (map/filter/find/some/every/forEach) but not `callFn2`, which `reduce`/`reduceRight` use for
their (accumulator, element) pair — so `[[1,2],[3,4]].reduce((a,[x,y])=>a+x+y,0)`→NaN and
`Object.entries(o).reduce((s,[k,v])=>s+v,0)`→NaN. Routed `callFn2`'s two bindings through the same
`bindParamVal`. `reduce((s,[a,b])=>…)`, `reduce((s,{a})=>…)`, `reduceRight((a,[x,y])=>…)` all correct;
plain reduce + Math-in-reduce unaffected. Extended `destructcb-diff` with reduce cases (2400 checks/6
seeds). Full sweep green.

**`String.match` with the global flag (2026-07-23, 31st engine fix).** `"a1b2c3".match(/\d/g)` returned
only the FIRST match (`["1"]`, `.length` 1) instead of all matches (`["1","2","3"]`) — the dispatch
always used `reFind` (first-only) and ignored the `g` flag. Added `reFindAll` (walks left-to-right past
each match via `reSearchStart`/`reMatchEnd`, the same iteration `reReplaceLoop` uses, with a zero-width
guard) and a global branch that checks `reHasG(__regex_flags)`. `match(/\d/g)`→all digits,
`match(/\w+/g)`→all words, no-match→null; non-global `match` (first-only) unchanged. New
`matchglobal-diff` fuzzer (2400 checks/6 seeds). Full sweep green.

**Object computed/string-key assignment `o[key]=v` (2026-07-23, 32nd engine fix; crash).** `let o={};
o["k"]=9; o["k"]` **panicked** and `o[1]=5; o[1]`→undefined — the assign path always treated a bracket
target as an ARRAY index: it `safeInt`'d the key (panic on a non-numeric key) and called `arrSetIdx` on
the object. Dot assignment (`o.k=v`) and array-index assignment (`a[0]=v`) already worked. Fixed
`assignTarget`'s bracket branch to evaluate the key and branch on the receiver: an object ref →
`objSet(materialize(key), v)` (string/computed key), else the array path (`arrSetIdx(safeInt(key))`).
This unblocks the ubiquitous **reduce group/count accumulator** — `reduce((o,w)=>{o[w]=(o[w]||0)+1;return
o},{})` and `reduce((o,x)=>{o[x]=x*x;return o},{})` now work — plus dynamic-key writes `o[k]=v`. New
`objbracket-diff` fuzzer (2400 checks/6 seeds). Full sweep green. (Known separate limitation: assigning
`o[k]=v` to an object held by a *free* variable inside a `forEach` callback — `["x"].forEach(k=>g[k]=1)`
— doesn't persist to the outer `g`; a deeper closure-mutation issue, distinct from this assign-path fix.)

**`indexOf(sub, fromIndex)` (2026-07-23, 33rd engine fix).** The optional 2nd argument (start position)
was ignored — `"abcabc".indexOf("c",3)`→-1 (want 5). Split the args and route to `idxOfFrom`. The
fuzzer then caught the string-vs-array asymmetry for a NEGATIVE fromIndex: **`String.indexOf` clamps a
negative to 0**, but **`Array.indexOf` counts it from the end** (`len+fromIndex`, floored at 0) —
`"ab".indexOf("b",-1)`→1 but `[1,2].indexOf(2,-1)`→-1. Implemented both (`clampStart` for strings,
`normStart` for arrays). Also fixed a pre-existing edge: `s.indexOf("")`→0 (was -1). `indexOf(c,3)`,
`indexOf(c,-2)`, array `indexOf(x,-1)` all correct; no-fromIndex form unchanged. New `indexoffrom-diff`
fuzzer (2400 checks/6 seeds). Full sweep green.

**`new Set(string)` (2026-07-23, 34th engine fix).** `new Set("aabbc").size`→0 — `newSetFrom` used
`arrElements`, which is empty for a string, so only arrays worked. A Set accepts any iterable, and a
string iterates its characters. Routed the argument through `arrFromBase` (which already turns a string
into a char array for `Array.from`), so `new Set("aabbc")`→{a,b,c} (size 3), `[...new
Set("mississippi")]`→"misp". Array construction unchanged. New `setfromstr-diff` fuzzer (1200 checks).
Full sweep green.

**`Array.flat(depth)` (2026-07-23, 35th engine fix).** `flat` ignored its depth argument entirely —
`arrFlatLoop` flattened exactly ONE level, so `flat(2)`/`flat(Infinity)` under-flattened (and
`flat(Infinity).length`→3 vs `.join`→"1,2,3,4" was the tell: depth-1 left a nested array that `join`
stringified but `length` counted as one). Added `arrFlatDepth`/`arrFlatDepthLoop` (splice an array
element only while depth>0, its contents flattened at depth-1; a depth-0 array element stays nested) and
`flatDepthArg` (default 1, `Infinity`→1e6). `flat(Infinity)` fully flattens, `flat(2)`/`flat(0)` exact.
`flatMap`/`arrFlat` (always one level) unchanged. New `flatdepth-diff` fuzzer (2400 checks/6 seeds). Full
sweep green.

**Semicolon inside a string literal (2026-07-23, 36th engine fix; crash).** `";".length`→0 (want 1),
`"a;b".length`→2 (want 3), `"a;b"` **crashed**, and `"a=1;b=2".split(";").map(s=>s.split("=")[1])` (the
ubiquitous key-value parse) **stack-overflowed** — the statement splitter `splitTop` tracked `{`/`(`/`}`/`)`
depth but NOT string literals, so a `;` inside a string at depth 0 was turned into a statement boundary
(the arg `";"` survived only by being inside `(...)`). Made `splitTop` string-aware via a
mutually-recursive `splitTopStr` walker that copies string contents verbatim (a raw `chr(34)` hands
control back; escaped quotes are already `encQuote`-encoded). `";".length`→1, `"a=1;b=2".split(";")`,
`"CSS: a{color:red;}"` all correct. New `semiinstr-diff` fuzzer (2400 checks/6 seeds). Full sweep green.
**Deeper root still open (documented):** a `;`-containing value carried through a `let` variable or a
function RETURN is corrupted by the env representation itself — the env is stored as
`name=value;name=value`, so a value with `;` (or `=`) breaks `envScan(split(env,";"))`. That is a
fundamental env-encoding fix (escape the separators in stored values), out of scope for this splitter
fix. `encFn` also maps `;`→`chr(2)` which collides with the ref tag — noted for the same future work.

**`({}).toString()` — RE-INVESTIGATED, still deferred (2026-07-23).** Attacked again per the completion
directive. Root now understood: `.toString(` when it's the LEFTMOST (only) method marker and sits inside
a function body (`(function(){let o={};return o.toString()})()`) is picked by `leftmostMethod` at the
OUTER level with a broken receiver (`(function(){…return o`) → the `urecv` eval panics. A `markerInBody`
guard on the top-guard block did NOT fix it — `fnBraceStack` mis-tracks the function body when nested
OBJECT braces (`let o={}`) are present, so the marker isn't recognized as in-body. Plus `({}).toString()`
adds the separate object-in-parens receiver crash. Both need deeper work (fix `fnBraceStack` for nested
`{}`, and the `({expr})` receiver path); reverted clean rather than ship a partial fix. The common form
`[…].map(x=>x.toString())` and user-class `toString` both work.

**`String.replaceAll` with a regex argument (2026-07-23, 37th engine fix).** `"aaa".replaceAll(/a/g,"b")`
→"aaa" (no replacement) — the dispatch materialized the first argument as a literal string, so a regex
was never applied (string-pattern `replaceAll` and `replace(/…/g)` both already worked). Now it checks
`isRegex` and routes to the same global `reReplace` as `.replace`, forcing the `g` flag. `replaceAll(/[0-9]/g,
"#")`, `replaceAll(/\d+/g,"N")`, `replaceAll(/\./g,"/")` all correct; string-pattern `replaceAll`
unchanged. New `replaceallre-diff` fuzzer (2400 checks/6 seeds). Full sweep green. (Capture-group `$1`
backrefs / matching a regex WITH `(…)` groups remain a separate bigger item — the regex engine doesn't
track capture groups, Cluster G.)

**`structuredClone` (2026-07-23, 38th engine fix).** Unimplemented → NaN (and crashed on a string).
Added a recursive deep-copy over the heap-ref model (`deepClone`): an array/object gets a fresh handle
with each element/value deep-cloned, a primitive copies as-is; wired via `globalCall`/`isGlobalFn`.
Verified independence: `let c=structuredClone(o); c.a=9` leaves `o.a` untouched, and a nested
`c[0][0]=9` leaves the source's nested array untouched. `structuredClone({a:{b:2}})`, `[{a:1},{b:2}]`,
primitives all correct. New `structclone-diff` fuzzer (1800 checks/6 seeds, deep-shape equality). Full
sweep green.

**Nested array destructuring (2026-07-23, 39th engine fix).** `let [x,[y,z]]=[1,[2,3]]`→NaN, and
`.map(([a,[b,c]])=>…)` — a nested pattern in a destructuring position wasn't recursed into (it was bound
as a variable literally named `[y,z]`). Two fixes: `destructArrLoop` now recurses on a `[…]`/`{…}` field
via `destructureArr`/`destructureObj` on that element; and `destructureArr`'s inner extraction drops the
matching closing bracket instead of `substringBefore(…,"]")` (which stopped at the FIRST `]` and
truncated a nested-FIRST pattern like `[[a,b],c]`→`[a,b`). `[x,[y,z]]`, `[[a,b],c]`, `[[[x]]]`,
`[a,{b}]`, nested in a callback, and rest all correct; flat destructuring unchanged. This also removes
the "nested patterns unsupported" caveat from the callback-destructuring fixes. New `nestdestruct-diff`
fuzzer (1800 checks/6 seeds, random nesting). Full sweep green.

**Closure free-var OBJECT / ARRAY mutation (2026-07-23, 40th engine fix).** Mutating a captured
free-var object or array from inside a callback / IIFE / named fn silently no-op'd:
`(function(){let g={}; [1].forEach(x=>{g.a=1}); return g.a})()`→`undefined`,
`(function(){let g={x:0}; (function(){g.x=5})(); return g.x})()`→`0`,
`["x","y"].forEach(k=>{g[k]=1})`, `forEach(x=>{g.sum=g.sum+x})`, alias writes, `a[i]=…` in a
callback — all lost. `a.push(…)` through a free var already worked (that gave the lead: heap
mutation persists, only `=` assignment didn't). Two compounding causes, both fixed:
1. **`assignRecv`** — a free var captured into a function-expression/arrow body is substituted to its
   VALUE at definition time (`funcValueOf(substitute(rhs,env))`), so inside the body the assignment
   *base* arrives already as a heap **ref token**, not a name. `assignTarget` resolved it with
   `envGet(env, base)` (a NAME lookup) → miss → `objSet` built a fresh non-ref blob and never
   `heapSet` the shared object → the write died with the discarded callback env. Now a ref-token base
   is resolved to itself and mutates the shared heap object directly (heapSet is the persistence; the
   env write-back is skipped for a ref base — the binding it would touch is not a live name). Named
   function *declarations* already worked because `defineFn` does NOT substitute the body, so `g`
   stayed a name and resolved via the inherited env at call time — that asymmetry was the tell.
2. **`hasTopSep`** (depth-aware separator test) — a bare call-*statement* whose function body contains
   ` = ` (e.g. `(function(){g.x=5})()`, `arr.forEach(x=>{g.x=1})`) was misread as a top-level
   assignment by `execStmt`'s depth-**blind** ` = `/`+=`/… scans, so the whole statement was treated
   as `LHS = RHS` and the call never ran. (The `.push(`/`.sort(`/… branches self-protect via an
   `isArrRef` guard and fall through, which is why push worked but `=` didn't.) The 8 assignment-op
   guards in `execStmt` now use `hasTopSep`, which tokenizes and matches the operator only at
   bracket/paren/brace depth 0. New `closuremut-diff` fuzzer (3000 checks/6 seeds: bare IIFE, arrow /
   named-fn / `function`-expr callbacks, bracket-build, running-sum, `+=`, pre-sized array-by-index,
   alias, `.map` side-effect). Full sweep green (336/336, 2 seeds).

Surfaced while probing (pre-existing, NOT regressions — each now RUNS and exposes a separate gap
instead of silently doing nothing): **(a)** sparse-array grow — `a[2]=9` on `a=[5]`→`undefined`
(`arrSetIdx`/`arrSetLoop` only overwrite existing indices, never extend); **(b)** function-declaration
**hoisting** — a `function f(){…}` used before its textual declaration is not hoisted (→`NaN`);
**(c)** arrow **default params** — `((a=1,b=2)=>a+b)()`→`NaN`; **(d)** bracket-key-with-dot dispatch —
`a[a.length-1]=9` is misrouted to the dot-assign path because `assignTarget`'s `hasSep(target," . ")`
guard fires on the `.` *inside* the bracket key (fix staged: `hasSep`→`hasTopSep` on that guard).

**Computed bracket-key assignment targets (2026-07-23, 41st engine fix).** Two bugs in the
`assignTarget` bracket path, both in *how the target is parsed*:
1. **Dispatch** — `a[a.length-1]=9` wrote nothing (`→` array unchanged). The entry guard
   `hasSep(target," . ")` saw the `.` *inside* the bracket key (`a.length`) and routed the whole
   statement to the dot-assign path, where `base` parsed as `a [ a` → dead write. Fixed by making
   that guard depth-aware (`hasTopSep`): a `.` nested inside `[…]` no longer counts as a top-level
   member assignment, so the statement correctly takes the bracket branch.
2. **Key extraction** — surfaced by the new `bracketkey-diff` fuzzer: `a[a[0]+1]=v` wrote `a[1]`
   instead of `a[2]`. The key was pulled with `substringBefore(substringAfter(target,"["),"]")`, which
   stops at the *first* `]` — the inner `a[0]`'s — truncating the key to `a[0`. New `balancedBrk`
   helper (the `[…]` analogue of `balancedArg`) walks to the *matching* `]`, so a computed key
   containing its own bracket is evaluated whole (`a[0]+1` → `2`). Same "stops at first `]`" class as
   the earlier nested-destructuring fix. `a[a.length-1]`, `a[a[0]+1]`, `a[b[0]+1]`, method-call keys
   (`o[k.toLowerCase()]`), `for`-loop `a[i]=i*i`, string-concat keys all correct; simple `a[i]`/`o[k]`
   unchanged. Bracket *reads* already balanced correctly. New `bracketkey-diff` fuzzer (2400 checks/6
   seeds). Full sweep green. (Still open in the same area: mixed access `a[i].b=v` / `a.b[i]=v`, and
   the identical first-`]` truncation in the `delete a[…]` path — both pre-existing, out of scope.)

**Sparse-array grow on out-of-bounds assignment (2026-07-23, 42nd engine fix).** `let a=[5]; a[2]=9`
left `a` unchanged (`.length`→1, `a[2]`→undefined) — `arrSetLoop` walks only the *existing* elements,
so an index past the end never inserted. JS grows the array and fills the gap with `undefined` holes:
`[5]`+`a[2]=9`→`[5,,9]` (length 3, `a[1]`→undefined, `join(",")`→`"5,,9"`). `arrSetIdx` now measures
`curLen` and, when `idx > curLen-1`, routes to a new `arrGrowSet` (re-join existing els via
`joinArrEls`, append `idx-curLen` `undefined` slots via `arrAppendN`, then the value at `idx`);
in-bounds writes keep the fast `arrSetLoop` path. Our engine already renders an explicit `undefined`
element exactly like a hole (`join` emits empty, `length` counts it), so growth is byte-identical to
Node. This also completes the closure case `[…].forEach((x,i)=>{a[i]=…})` building an array from `[]`
(needs the grow *and* the 40th-fix free-var mutation together). `a[2]=9` on `[5]`, `a[3]=1` on `[]`,
`a[5]=6` on `[1]`→`"1,,,,,6"`, out-of-order writes, grow-then-overwrite all match Node; in-bounds
`a[i]=v`/`push`/`a.length` unchanged. Codegen note: reusing a `Seq of Text` local across two calls
made LOGOS pass it as a borrowed slice (type mismatch) and tripped E0382 — fixed by binding
`item i of els` to a `Let` first and passing fresh `arrElements(…)` calls (owned Seq), with the
reusable value being the `Int` `curLen`. New `sparsegrow-diff` fuzzer (2400 checks/6 seeds). Full
sweep green.

**Default parameters when ALL args are omitted (2026-07-23, 43rd engine fix).** `((a=1,b=2)=>a+b)()`
→`NaN` and `(function(a=5){return a})()`→`NaN`. Partial omission already worked (`(a=1,b=2)=>…`
called `(10)`→`12`, trailing `(a,b=3)`→ default fires; explicit `undefined`→ default fires) — the
default machinery (`bindParams` → `defaultOr(argAt(...), defExpr)`) was fine. The gap was `argAt`: a
call `f()` tokenizes to a single *empty* arg field, and `argAt` returned `jsEvalIn("")` (empty
string) instead of `undefined`, so `defaultOr` (which fires only on `"undefined"`) saw a "present"
arg and skipped the default → the param became `""` → arithmetic `NaN`. Trailing params defaulted
correctly only because their index was truly past `length`. Fix: `argAt` treats an empty positional
slot (`trim(item i of args) == ""`) as `undefined`. Semantically correct everywhere (an empty slot =
no argument; elisions too), and a real empty-string literal is a non-empty token (`""`), so it does
NOT collide — verified `((a="x")=>a)("")`→`""` (binds the empty string, default does NOT fire).
`((a=1,b=2)=>a+b)()`→3, `(function(a=5){})()`→5, `((a="hi")=>a)()`→"hi", default referencing an
earlier param `(function(x,y=x*2){return y})(5)`→10, and `((a)=>a)()`→undefined all match Node;
partial-supply + explicit-arg cases unchanged. New `defaultparam-diff` fuzzer (2400 checks/6 seeds,
incl. the empty-string-literal guard). Full sweep green.

**Function-declaration hoisting (2026-07-23, 44th engine fix).** A `function NAME(…){…}` used before
its textual position returned `NaN` — declarations weren't hoisted, so a forward reference (and any
mutually-recursive pair) saw no binding. New `hoistFns` pre-pass binds every top-level function
declaration in a block into the env *before* the statements run, applied in `runBlockStr` (function
bodies + `if`/`for`/`while`/`try` blocks) and `runModuleBody` (the `bun run file.js` top level). It
uses `defineFn`, which does NOT substitute the body, so a sibling hoisted function (or any free name)
resolves via the inherited env at call time — mutual recursion works. `(function(){return f(3);
function f(n){return n+1}})()`→4, mutual `isEven`/`isOdd`, `fact(n)` used before its own declaration,
helper called inside a loop before declaration, and top-level `greet(); function greet(){…}` /
`console.log(fact(5)); function fact(){…}` via `bun run` (→120) all match Node; declared-first,
function expressions (`let f=()=>…`), object methods, and closures unchanged. Codegen: reuse of a
`Seq of Text` local across two calls forces a borrowed-slice type — so `runBlockStr`/`runModuleBody`
bind the split *text* once (`flat`) and call `split(concat(flat,""),chr(10))` twice (two owned Seqs),
one for `hoistFns`, one for `runBlock`. New `hoisting-diff` fuzzer (2400 checks/6 seeds, all
IIFE-wrapped). Full sweep green.

Discovered while probing (pre-existing, NOT caused by the hoisting change — reverting all of it still
reproduced): in the **`__js` inline REPL path only**, a program whose LAST statement is `console.log(…)`
(or a bare statement-form) crashes with a stack overflow / returns `NaN`, because `runProgram`
evaluates the trailing statement with `jsEvalIn` (expression semantics) and `console.log` as an
expression recurses in `resolveCalls`. The real `bun run file.js` path (`runModuleBody`→`runBlock`)
is unaffected — `console.log("plain")` in a file prints correctly. Deferred: `runProgram` should run a
trailing statement-form via `execStmt` (side effect, value `undefined`) rather than `jsEvalIn`.

**`__js` REPL trailing statement-form + top-level hoisting (2026-07-23, 45th engine fix).** Closes the
gap flagged in #44. `runProgram` evaluated a program's LAST statement with `jsEvalIn` so the REPL can
surface an expression's value (`5+3`→8), but a *statement-form* is not an expression: `console.log(…)`
recursed to a stack overflow, and `let`/`if`/`for`/`function`/assignment all returned `NaN` (a trailing
`function f(){…}` even mis-executed its body). New `isStmtForm` predicate (console.\*/`process.exit`/
declarations/control-flow/`delete`/`break`/`continue`/inc-dec/top-level assignment) routes a trailing
statement-form through `execStmt` (side effect, value `undefined`), keeping `jsEvalIn` for genuine
expressions. With the trailing statement now handled correctly, top-level hoisting was re-enabled in
`jsRun` (safe only once the trailing declaration stopped mis-executing). `console.log("x")`→prints x
(no crash), `if`/`for` bodies run, a trailing `function f(){…}` defines without running its body, and
top-level `greet(); function greet(){…}`→"hoisted", `let x=dbl(5); function dbl(){…}; x`→10,
`console.log(fact(5)); function fact(){…}`→120 all match Node via `__js`; every expression last-line
(`5+3`, IIFE, `.map().join()`, default-params) still returns its value unchanged. Full sweep green —
the fuzzers observe expression values, so none is affected by the trailing-statement-form change.

Also fixed a **class ↔ hoisting** interaction the hoisting pre-pass introduced (a latent break in the
#44 hoisting that the fuzzers hadn't exercised — `classstatic-diff` runs only top-level `__js`, which
was un-hoisted until this fix, so it stayed green). A class desugars to `__static_C_m = function… ;
function C(…){…}` with the statics BEFORE the constructor: they rely on `C` being undefined until the
ctor line runs, so `new C` in a static resolves at call time. Hoisting `function C` bound `C` early,
so the static's function-literal RHS substitute-captured the constructor value and `new C` broke
(`class A{…static of(v){return new A(v)}}; A.of(8).x`→NaN — in every hoisting path: function body,
`bun run` file, and `__js`). JS classes are NOT hoisted (TDZ), so `hoistFns` now skips a `function C`
whose block also carries a `__static_C_`/`__super_C` marker (`hasClassMarker`) — a class constructor,
not a real function declaration. Class statics, static-calling-static, `extends`+`super`, and instance
methods all work again alongside genuine forward-referenced function declarations. New
`classhoisting-diff` fuzzer (1800 checks/6 seeds) locks the interaction; `classstatic-diff` also guards
it. Final full sweep green.

**Mixed member-access assignment targets (2026-07-23, 46th engine fix).** Assignments through a target
that MIXES dot and bracket access silently no-op'd: `a[i].b=v`, `o.list[i]=v`, `o.a.b[i]=v`, `a[i][j]=v`,
`o.items[i].n=v` (`a[0][1]=9`→NaN). `assignTarget` handled only a pure dot chain (`objSetPath`, which
splits on ` . ` and can't cross a bracket) or a single leading bracket (`ivar` before the FIRST `[`,
ignoring later segments). Rewritten around one idea: **split the target at its LAST top-level access
operator into a container expression + final key, evaluate the container to its heap ref, and write
the slot in place.** Because objects/arrays are always heap refs, the write heapSets and is visible
through the original binding — no path-rebuild needed. `lastTopDotIdx`/`lastTopBrkIdx` find the final
depth-0 `.`/`[` (a `.`/`[` inside a bracket key stays at depth>0), `assignContainer` resolves a bare
name via envGet / a substituted free-var ref-token to itself / any compound path via jsEvalIn, and
`assignWriteback` rebinds only a bare-identifier container. This subsumes and preserves every earlier
assignment fix: pure dot chains, single/computed/nested-bracket keys (`a[a[0]+1]`), sparse grow, free-var
callback mutation (ref-token container), `__set_` accessors, and class statics. `a[0].b`→9,
`o.list[1]`→9, `o.a.b[0]`→9, `a[0][1]`→9, `o.items[0].n`→42 all match Node. Codegen: a `Seq of Text`
value may be passed to a consuming call only once (else it degrades to a borrowed slice), so the
scanners use one recursive call per branch (via `isOpenDelim`/`brkRecord` record helpers) and the
join helpers take the target Text + Int indices and re-`split` fresh per `joinRange`. New
`mixedassign-diff` fuzzer (2400 checks/6 seeds). Full sweep green. (Still open: the identical first-`]`
truncation in the `delete a[…]` path.)

**`delete` through deep / nested / mixed access targets (2026-07-23, 47th engine fix).** Closes the
`delete` gap noted in #46. The `delete` handler truncated a dot target at the FIRST `.` (`delete o.x.y`
removed a literal `x . y` key → object unchanged) and a bracket target at the FIRST `]`
(`delete a[0][1]` / `delete o.list[i]` removed the wrong slot). Rewired to reuse assignTarget's
last-top-level-access split: `deleteTarget` cuts the target at its final `.`/`[` (via
`lastTopDotIdx`/`lastTopBrkIdx`), evaluates the container to its heap ref (`assignContainer`), and
removes the slot in place — `objDelete` for a property, an array index set to a hole. `delete o.x.y`
→`{"x":{}}`, `delete a[0][1]`, `delete o.list[1]`, `delete o.a.b.c`→`{"a":{"b":{}}}`,
`delete o.items[0].n`→`{"items":[{}]}` all match Node; simple `delete o.a` / `delete o[k]` /
`delete a[i]` unchanged. New `deletepath-diff` fuzzer (2400 checks/6 seeds). Full sweep green.

Surfaced while writing the fuzzer (pre-existing, orthogonal to `delete` — both use the engine's
`undefined`-not-a-true-hole array model): a deleted/absent array slot is a real HOLE in JS but an
`undefined` VALUE here, so `[1,,3].map(f)` (JS skips holes) and `JSON.stringify([1,undefined,3])`
(→`[1,null,3]` in JS — an `undefined`/hole array element serializes as `null`) both diverge; ours keeps
`undefined`. Direct index reads, `.length`, and `.join` (undefined→"") all match. The `JSON.stringify`
`undefined`→`null` array-element case is the cleaner next fix.

**`JSON.stringify` of `undefined` / functions (2026-07-23, 48th engine fix).** The two non-representable
value kinds were mis-serialized: `undefined` came out as the literal `undefined` and a function value
as an empty/garbage token, producing invalid JSON (`{"a":1,"f":}`). Per spec they serialize as `null`
inside an ARRAY and are OMITTED (property dropped) inside an OBJECT. New `isJsonOmit` (true for
`undefined` and any function value); `jsonArrElem` emits `null` for an omittable array element;
`jsonObjLoop` skips an omittable property and joins on `acc` rather than the index so a
leading/trailing/only dropped property leaves no stray comma; top-level `JSON.stringify(undefined)` /
of a function yields `undefined`. `JSON.stringify([1,undefined,3])`→`[1,null,3]`,
`{a:1,b:undefined,c:3}`→`{"a":1,"c":3}`, function-in-array→`null`, function-property→omitted,
`{a:[1,undefined],b:2}`→`{"a":[1,null],"b":2}`, leading `{a:undefined,b:2}`→`{"b":2}` and trailing
`{a:1,b:undefined}`→`{"a":1}` all match Node; normal objects/arrays/primitives unchanged. New
`jsonundef-diff` fuzzer (2400 checks/6 seeds, random undefined/function/nested mix). Full sweep green.

**Object destructuring — `...rest`, nested value patterns, first-`}` truncation (2026-07-23, 49th
engine fix).** Three gaps in object destructuring, fixed together. (1) `destructObjLoop` had no
`...rest` case — `let {a,...rest}=o` bound a garbage `...rest` variable → `rest` was `NaN`. (2) The
`:` (rename) branch never recursed, so a nested value pattern `let {a:{b}}=o` / `{list:[x,y]}` bound a
variable literally named `{b}` → `NaN`. (3) `destructureObj` extracted the pattern inner with
`substringBefore(…,"}")`, stopping at the FIRST `}` — a nested object's closing brace — so anything
after it (a trailing `...rest`) was silently dropped (`{a:{b},...rest}`). Fixes: a `consumed`-keys
accumulator threads through `destructObjLoop`; on `...name` `objRestBuild` collects every own property
of the source not already consumed into a fresh object; the `:` branch recurses via
`destructureObj`/`destructureArr` when the value starts with `{`/`[`; and `destructureObj` now drops
the trailing `}` (balanced, like the earlier `destructureArr` fix) instead of cutting at the first.
`{a,...rest}`→rest`{b,c}`, renamed `{a:r,...rest}`, defaulted `{a=9,...rest}`, empty rest `{x,...y}`→
`{}`, nested `{a:{b:{c}}}`→c, `{list:[x,y]}`, and the full combo `{p:{q},r,...s}`→`1|2|{"x":..,"y":..}`
all match Node; flat/default/array-nested destructuring and function-param destructuring unchanged.
New `objdestructure-diff` fuzzer (2400 checks/6 seeds). Full sweep green.

**Array destructuring ASSIGNMENT — the swap idiom (2026-07-23, 50th engine fix).** `[a,b]=[b,a]`
(swap), `[a,b,c]=[…]`, `[x,y,z]=[z,x,y]` (rotate), `[a,...rest]=arr` all silently no-op'd (`[a,b]=[b,a]`
left `a,b` unchanged). The plain-assignment dispatch routed any LHS containing `[` to `assignTarget`
(a member write), so an array-PATTERN LHS was mis-read as `container[key]` with an empty container.
Fix: an LHS that STARTS with `[` is a destructuring target → `destructureArr` with the RHS evaluated
first (so the swap reads the old values), binding each name via `envSet` (reassigning the existing
variables). This is distinct from a member write, whose LHS starts with the container name
(`arr[i]`, `o.list[i]`). Swap, multi-assign, rotate, chained double-swap, from-a-variable, and
`[a,...rest]` all match Node; `a[i]=v` / `o.x=v` / `a[0][1]=v` member writes and `let [a,b]=…`
declarations unchanged. New `destructassign-diff` fuzzer (2400 checks/6 seeds). Full sweep green.
(Object destructuring assignment `({a,b}=o)` — the parenthesized form whose `=` sits at paren-depth 1
— is a separate follow-up.)

**Braceless loop bodies (2026-07-23, 51st engine fix).** A loop whose body is a single BRACELESS
statement (`for (…) f();`, `while (c) x++;`, `for (const v of xs) s+=v;`, `for (k in o) …`) didn't
run its body — `if` handled braceless, loops did not. Every loop executor took its body as
`braceBody(substringAfter(stmt,"{"))` — the first `{` anywhere — so a braceless body was empty: the
loop no-op'd (`for`/`for-of`/`for-in` returned 0/""), and a braceless `while` whose update lives in
the (now empty) body **HUNG** (`while (i<3) s+=i++` — infinite loop). New `loopBody` locates the body
AFTER the header's MATCHING `)` (found via `balancedArg`, so a `{`/`(` inside the header — a
`for (const {a} of xs)` destructuring pattern, a `while (f(x))` call — no longer misdirects it) and
returns the braced content or the lone trailing statement; wired into `execWhile`, the C-style
`forStmt`, `execForOf`, `execForIn` (do-while, whose body precedes its `while(cond)`, is untouched).
Braceless for/for-of/for-in/while, a braceless `if` inside a braceless `for`, and (bonus, from the
balanced-header extraction) `for (const {a} of arr) s+=a` and nested braceless inner loops all match
Node; every braced loop and do-while unchanged. New `bracelessloop-diff` fuzzer (2400 checks/6 seeds,
4s per-run timeout so a regressed hang surfaces). Full sweep green.

**Braceless `if`/`else` — trailing `;` corruption (2026-07-23, 52nd engine fix).** A braceless
`if (c) stmt; else stmt2` (and `else if` chains) returned `NaN`. `splitTop` correctly keeps `; else`
together (so the whole if/else is one statement), but `execIf` extracted the braceless consequent as
`substringBefore(afterCond, " else ")` — which includes the statement terminator `;` sitting just
before `else` (`return "a" ;`), and that trailing `;` corrupted the subsequent `execStmt`/`jsEvalIn`.
Fix: `stripTrailSemi` drops a trailing `;` from the braceless consequent and the else part. Braceless
`if/else` assignment, `else if` chains, deep chains, and a braceless `if/else` nested inside a
braceless `for` (`for (…) if (c) s+=i; else s-=1;`) all match Node; braced `if/else`, `else if`
chains, and a braceless then with no else are unchanged. New `bracelessif-diff` fuzzer (2400 checks/6
seeds). Full sweep green.

**Labeled loops + `break LABEL` / `continue LABEL` (2026-07-23, 53rd engine fix).** A labeled loop
`LABEL: for (…) …` returned `0` (the label prefix meant the statement didn't start with a loop
keyword, so it fell through to expression eval and never ran), and even once dispatched, a nested
`break LABEL`/`continue LABEL` could only ever target the innermost loop. Implemented properly: a new
`isLabeledLoop`/`execLabeledLoop` recognizes `IDENT : (for|while|do) …`, strips the label, and runs
the loop carrying it; the break/continue flag now holds the label (not just `"1"`); each loop threads
its own label and, via `flagMatchesHere`, HANDLES the signal when the flag is `"1"` or its own label,
otherwise still stops iterating but leaves the flag set so an OUTER labeled loop receives it —
crossing loop levels. Threaded through `execWhile`/`execDoWhile`/`forStmt`/`forOfLoop` (+`execForOf`/
`execForIn`/`execFor`). Root-cause of a self-inflicted hang along the way: the labeled-loop dispatch
had to move to the TOP of `execStmt`, ahead of `needsIncDec` — which skips a statement starting with
`for `/`while ` but not one starting with a *label*, so it was rewriting the header's `i++` to `NaN`
and spinning forever. `break L`, `continue outer`, `break outer`, labeled `while`/`for-of`, and a
plain labeled loop all match Node; unlabeled `break`/`continue`, nested plain loops, `for-of`,
`do-while` unchanged. New `labeledloop-diff` fuzzer (1800 checks/6 seeds, 4s timeout catches hangs).
Full sweep green.

**Object → string coercion CRASH (2026-07-23, 54th engine fix).** `""+o`, `String(o)`, `o.toString()`,
`` `${o}` `` on a plain object all PANICKED "Cannot parse 'NaN' as Int" (`RUST_BACKTRACE` pinned it:
`resolveArrays`→native `parseInt`). Root: `materialize` returned the raw string `"[object Object]"`,
whose literal `[` re-entered the resolve pipeline where `resolveArrays` mistook it for a bracket-index
and `parseInt`'d the "index" `object Object` → NaN → panic. (Every individual stringify path —
`materialize`/`plusStep`/`objToStringVal` — looked safe in isolation; the bug was the raw `[` in the
*result* flowing back through array-index resolution, exactly like a string literal's brackets would
if they weren't encoded.) Fix: `objectTagStr` emits `[object Object]` with ENCODED brackets
(`encBrkL`/`encBrkR`, like every string literal), so `resolveArrays` skips it and it decodes to
`[object Object]` at output; used in both `materialize` and `objToStringVal`. Also made `materialize`
Error-aware (name+message → `errToString`) so `""+e` / `String(e)` / `` `${e}` `` give `Error: msg`
(matching `e.toString()`), not `[object Object]`. `""+o`→`[object Object]`, `String(o)`, `o.toString()`,
templates, `"pre:"+o+":post"`, and Error coercion all match Node; object member access, array/string/
number concat, JSON, string-literal brackets unchanged. New `objstringify-diff` fuzzer (2400 checks/6
seeds). Full sweep green. (Still open: the DIRECT `new Error("m").toString()` — no intermediate
variable — is a separate stack-overflow in the method-on-a-`new`-expression receiver path.)

**Static class fields (2026-07-23, 55th engine fix).** `class C { static count = 0 }` then `C.count`
returned garbage (` . count`). The class desugar's `static` branch always treated the member as a
METHOD, so `static x = v` desugared to a bogus `__static_C_x = function(…){}`; and even with a binding,
the READ `C.x` didn't resolve (by the time `resolveAccess` runs, `C` is already substituted to the
constructor function, so the class name is gone). Three coordinated fixes: (1) a static-FIELD branch in
`classWalk` (when the token after the name is `=`) binds `__static_C_x = value` (mirroring the
instance-field desugar); (2) `resolveStaticProps` resolves a `ClassName.field` READ to its value before
`substitute` (with env, like the static-CALL path), firing only when that exact `__static_…` binding
exists so instance `obj.prop` is untouched; (3) the `=` dispatch rewrites `C.field = v` to the
`__static_…` binding via `staticFieldKey`. `static x=5`→`C.x`, multiple statics, same-scope
`C.n=C.n+3` accumulation, `Config.timeout+Config.retries`, and a static method reading a static field
all match Node; static methods, instance field access/assignment, nested access, array-index write
unchanged. New `staticfield-diff` fuzzer (2400 checks/6 seeds). Full sweep green. (A static field
*mutated from inside a method* persists only within that call — the `__static_` binding is a scalar in
the enclosing env, the same scalar-write-back limitation as any captured scalar; documented, avoided
in the fuzzer.)

**`yield*` delegation (2026-07-23, 56th engine fix).** `yield* [1,2]` inside a generator yielded a
single `NaN` instead of `1` then `2` — `yield*` was parsed as `yield (*[1,2])`, and the unary `*` made
the operand NaN. Fix: a `yield*` branch (both `yield* x` and `yield * x` token forms) iterates the
operand with `iterElements` and `genPush`es each value (`genPushAll`), delegating correctly to an
array, a called generator's buffered values, or a string's chars. `yield* [1,2]; yield 3`→1,2,3,
`yield 0; yield* [1,2,3]`→0,1,2,3, `yield* inner()` (generator→generator), `yield* [1,2]; yield* [3,4]`,
and `yield* "ab"`→a,b all match Node; plain `yield` and generator loops unchanged. New `yieldstar-diff`
fuzzer (2400 checks/6 seeds). Full sweep green.

**`Object.prototype.hasOwnProperty` (2026-07-23, 57th engine fix).** `o.hasOwnProperty(key)` — one of
the most common object methods — was unimplemented, so its method dispatch recursed to a stack
overflow (`o.hasOwnProperty("a")` crashed). Added a `.hasOwnProperty(` handler (registered in
`leftmostMethod` and dispatched in `resolveMethods`) that returns whether the key resolves to a defined
own value — the same membership test the `in` operator uses (`objGet(o,key) !== "undefined"`).
Present/absent keys, a variable key, a ternary on the result, `hasOwnProperty && hasOwnProperty`, and
the ubiquitous `for (k in o) if (o.hasOwnProperty(k)) …` guard all match Node; `in`, `Object.keys`,
`toString`, nested access, JSON unchanged. New `hasownprop-diff` fuzzer (2400 checks/6 seeds). Full
sweep green.

**Empty for-loop condition (2026-07-23, 58th engine fix).** `for (init;;update) { … }` / `for (;;)`
never ran its body (→ NaN): the empty middle clause evaluated to false. Per JS an omitted condition is
always true (the loop runs until an inner `break`/`return`). `forStmt` now uses `forCondHolds` — an
empty condition ⇒ true. `for(let i=0;;i++){ if(i>3) return i }`→4, `for(;;){ n++; if(n>=3) break }`→3,
and empty init+update `for(;i<4;){ i++ }`→4 all match Node; every conditioned for-loop (braced,
braceless, multi-declarator, for-of) unchanged. New `emptyfor-diff` fuzzer (2400 checks/6 seeds, 4s
timeout catches a regressed infinite loop). Full sweep green.

**Multi-argument `new Date(y, m, d, …)` (2026-07-23, 59th engine fix).** Only the single-timestamp
`new Date(ms)` worked; the component form `new Date(2024, 0, 15)` returned NaN (the comma-list was
`jsEvalIn`'d as one expression, not parsed into an epoch). Implemented `dateFromParts` + `daysFromCivil`
(Howard Hinnant's exact civil→epoch day count, verified `daysFromCivil(1970,1,1)=0`): the constructor
now maps `(year, monthIndex, day?, hours?, minutes?, seconds?, ms?)` — JS's 0-indexed month → the
1-indexed civil month, JS defaults (day 1, else 0) — to the UTC epoch its getters read back (the engine
is UTC-only, so `getFullYear == getUTCFullYear` and a component-built date round-trips). `new Date(2024,
0,15).getUTCFullYear()`→2024, `.getUTCMonth()`→0, `.getUTCDate()`→20, `new Date(2000,0,1).getTime()`→
946684800000, `getUTCHours`/`getUTCDay`, and the 6-component form all match Node; single-timestamp
`Date`, all getters, `Date.now()` unchanged. Codegen: a `Seq of Text` local can't be passed to a
consuming call twice, so `dpNum`/`nthArg` take the arg TEXT and re-`splitArgsN` per component. New
`datefromparts-diff` fuzzer (1800 checks/6 seeds; forces `TZ=UTC` so Node's local-time constructor
aligns with our UTC epoch). Full sweep green. (`getTime` of a component date is UTC here; a non-UTC
`new Date(y,m,d).getTime()` would differ from Node's local-time value — the timezone-independent
getUTC\* fields are exact regardless.)

**Object property shorthand `{n}` ≡ `{n:n}` (2026-07-23, 60th engine fix).** ES2015 property shorthand
was entirely broken: `{n}` (n=5) produced `{"5":NaN}`, `{a,b}` → `{"1":NaN,"2":NaN}`, `({name}).name`
→ undefined. Root cause: the engine substitutes free variables into the token stream BEFORE building
the object, and `substTokens`' key-position guard only protects a name FOLLOWED by `:` — a bare
shorthand `n` is followed by `,`/`}`, so it was substituted to its value (`{n}`→`{5}`) and `buildObj`
then read `5` as the KEY with a NaN value. Fixed by desugaring shorthand in `domWalk` (the object-key
pre-pass, which runs before substitution): at an object key position (`atKeyPos` — an `o` frame, not
the `b`/block frame a destructuring `let {a}=o` pattern lives in), a bare identifier whose next token is
`,`/`}`/end (new `isShorthandEnd`, distinct from `:` = normal key and `(` = method shorthand) expands to
`t : t`, so the KEY stays a name (protected) while the VALUE resolves to the variable. `{n}`→`{"n":5}`,
`{a,b,c}`, mixed `{a,b:2,c}`, nested `{x:{y}}`, `[{x},{x}]`, arg `f({x})`, and shorthand + method
`{a,b,sum(){…}}` all match Node; normal `{a:1,b:2}`, method shorthand, getters/setters, and — critically
— destructuring `let {a}=o` (a pattern, left untouched) unchanged. New `objshorthand-diff` fuzzer (2400
checks/6 seeds). Full sweep green (378/378).

**Assignment as an EXPRESSION (2026-07-23, 61st engine fix).** The keystone memoization idiom
`return memo[n] = fib(n-1) + fib(n-2)` returned NaN and wrote nothing — assignment was only handled as a
STATEMENT (execStmt), so in value position (`return`, a function argument, an assignment RHS) it fell
through to plain expression eval, which has no assignment operator → NaN, no write. Fixed in `jsEvalIn`:
a top-level bare `=` token (found by `firstTopAssignIdx`, skipping any `=` nested in `(…)`/`[…]`/`{…}` —
a default param or computed-key side effect) is an assignment expression when its `=` precedes any
top-level `?` (assignment binds looser than `?:`, so `a = b ? c : d` = `a = (b?c:d)`) AND any top-level
`=>` (so an arrow body `(a) => a = 1` is not mistaken for one); redundant outer parens are stripped
first (`stripParenWrap`). For a member/dot/bracket target it does the heap write via `assignTarget`
(globally visible in every position) and returns the assigned value; for a scalar it returns the value
(the write is moot in `return`/arg position). `return memo[n]=…` (memoized fib→55), `return m[k]=v`,
chained `a[i]=b[j]=v`, scalar `return x=v`, parenthesized `(m[k]=v)`, an arg `id(m[k]=v)`, and `x = c ?
a : b` all match Node; comparisons (`==`/`===`/`<=`), object literals, arrows (incl. default params),
and spread are untouched. Bonus: statement-level chained assignment now works (execStmt's RHS routes
through the same jsEvalIn path). Toolchain gotcha: the constant-arg monomorphizer folds a recursive
scanner's `depth - 1` reached from `depth == 0` into a `-1`-named specialization (invalid Rust), and
without a growing accumulator arg it also diverges the `Seq` param's type across specializations — so
each scanner (`firstTopAssignIdx`/`firstTopArrowIdx`/`parenCloseIdx`) carries a `g` accumulator that
turns runtime after the first token (halting monomorphization, like `topTernaryQ`/`tokHasTopSep`) and
routes every decrement through a clamped `depthDec`. New `assignexpr-diff` fuzzer (2400 checks/6 seeds,
two-step reads to avoid the confounder below). Full sweep green (380/380). SEPARATE pre-existing bug
surfaced (NOT this fix, documented): an inline mutator call in a `+` expression loses its heap write to
a later read in the same expression — `f(5)+","+JSON.stringify(m)` where `f` writes `m` reads a stale
`m` (side-effect/evaluation-order gap in binary-op operand eval); two-step `let r=f(5); …` is correct.
STILL DEEP: an embedded assignment inside a comparison inside a `while` condition (`while((v=x[i++])!==
undefined)`) still crashes (the `i++`/NaN-parse family); a scalar assignment in a non-return position
(`f(x=5)` outer-scope read, a bare `cond ? x=5 : y=5` statement) returns the right value but does not
propagate the binding.

**Regex GROUPS and ALTERNATION (2026-07-23, 62nd engine fix).** A major correctness hole: the
Kernighan-Pike backtracking matcher treated `(`, `)`, and `|` as LITERAL atoms, so ANY grouped or
alternating pattern silently failed to match — `/(foo)/.test("foo")` → false, `/a(b|c)d/`, `/(\d+)-(\d+)/`,
`/^(\w+)@(\w+)$/`, `/cat|dog/` all broken (a huge fraction of real-world regexes). Rebuilt the matcher as
`mh`, group/alternation-aware, over the same atom helpers (atomLen/atomMatches/countAtoms/reClassMatch),
using the pattern-DERIVATIVE (substitution) method: a group `(B)C` matches by trying, for each top-level
alternative Bi of the body, the CONCATENATED pattern `Bi C` — making the body and its continuation
contiguous so ordinary sequential matching backtracks across the boundary with no explicit continuation
stack. `(B)?C`→`BC` then `C`; `(B)+`/`(B)*` match one instance (grpTryAlts) followed by the derivative
`(B)*C` (grpStarPat) which re-enters `mh` for the rest — greedy for any body consuming ≥1 char. Top-level
and in-group alternation (reAltBar splits at the first depth-0 `|`), nested groups, non-capturing `(?:…)`
(reGroupBody strips the `?:`), and anchors all handled; reGroupEnd finds the matching `)` skipping nested
groups/classes/escapes. Routed reTest/reSearchFrom/reMatchEnd/reSearchStart through `mh`; the retired
atom-only matchHere/starBacktrack were deleted. `(foo)`, `(\d+)-(\d+)`, `a(b|c)d`, `(ab)+` (multi-rep),
`(\d+,)*\d+`, `^(\w+)@(\w+)$`, `cat|dog|bird`, `(?:ab)+c`, `((a)(b))`, `https?://(\w+)` all match Node
(.test + .replace); every no-group pattern (the 190-fuzzer suite) unchanged. New `regexgroups-diff` fuzzer
(3600 checks/6 seeds). Full sweep green (382/382). Toolchain gotchas hit and recorded: (1) each recursive
Text-scanner (reGroupEnd/reAltBar) needs a `g: Text` accumulator to halt the constant-arg monomorphizer
(else it emits a `-1`-named / duplicate specialization and diverges the param type); (2) a `classEnd(pat,…)`
sub-call and the recursion both consuming `pat` in ONE expression is a move error — split into a `Let`; (3)
**a LOGOS parser quirk: a stand-alone recursive function of the shape `Let x. If cond: {… nested If: Return.
Return call.} Return call.` fails to parse (ExpectedExpression) as a top-level function, though the identical
shape parses when nested inside another `If` — so the greedy-star logic had to be INLINED into `mh`'s group
branch rather than living in a separate grpStar function.** KNOWN LIMITATIONS (documented, deferred):
capture-group EXTRACTION (`m[1]`/`m.index`) and `$N` replacement backreferences (next increment); `{n,m}`
brace quantifiers; and catastrophic backtracking on adversarial nested-unbounded patterns (`(a+)+b`) can
hang — inherent to backtracking engines (V8/bun included), not hit by real patterns or the fuzz corpus.

**Array.prototype.splice (2026-07-23, 63rd engine fix).** `a.splice(start, deleteCount, ...items)` — one
of the most common array mutators — was entirely unimplemented: `.splice(` wasn't in the method table, so
the call no-op'd and the array was unchanged (`[1,2,3].splice(1,1)` left `[1,2,3]`, returned `[]`).
Implemented `arrSplice`: normalize `start` as JS does (negative counts from the end via normSliceIdx),
clamp `deleteCount` to `[0, n-start]` (an omitted deleteCount removes through the end), build the new
element list as `before + items + after` (each `items` entry `jsEvalIn`'d to its element value), and MUTATE
the array in place through its heap ref (mutArr → heapSet, so an aliasing binding sees the change), then
return a new array of the removed elements. Registered `.splice(` in the method table and dispatched it in
resolveMethods like `.slice` but writing through the receiver ref. `splice(1,1)`, `splice(1,2)`,
`splice(1,0,9)` (insert), `splice(1,1,7,8)` (replace+insert), `splice(-1,1)` (negative), `splice(2)` (omit
count), `splice(0)` (clear), start-beyond-end, insert-into-empty, string/object elements, alias-visibility,
and the returned removed-array + post-splice array all match Node; push/slice/other array ops unchanged.
Gotchas: `joinChr6` prepends a leading separator for any range NOT starting at index 1 (it only suppresses
the leading sep for the whole-array case) — a sub-range join produced a stray hole (`[1,,3]`); fixed with a
new `joinRange6` keyed on `acc == ""` (a tagged element is never the empty string). And each element range
is re-read fresh from the ref (arrElements per join) so the element Seq is never threaded through two
consuming joins. New `splice-diff` fuzzer (2400 checks/6 seeds, compares removed-array AND post-splice
array). Full sweep green (384/384).

**Scientific notation `1e3`/`2e-2` (2026-07-23, 64th engine fix).** An integer-mantissa exponent was NaN
everywhere — `Number("1e3")`, the literal `1e3`, `+"3e2"`, `1e3+5`, `(5e3).toString()` — while a decimal
mantissa (`2.5e3`) worked. Root cause: `floatTok` only recognized a decimal POINT, so `1e3` (no dot) was
neither an int (`isIntStr` fails on the `e`) nor a float, and the arithmetic path called it bad → NaN. Two
fixes: (1) a strict `sciTok` (decimal mantissa + `e`/`E` + signed-integer exponent) recognized in
`coerceNumTok`, `jsStrToNum`, and `isNumericStr`, canonicalizing the token to decimal via the native
`jsParseFloat` — with a magnitude guard `sciSafe` (integer part < 19 digits) so a literal that would
overflow the i64 display falls back to NaN instead of CRASHING the Int parse (this also stops the
pre-existing `1.5e30`/`6.022e23` panic — JS's scientific DISPLAY for ≥1e21 and integers past i64 is a
separate deferred feature); (2) the tokenizer (`normJs`) now keeps a signed exponent (`1e-2`/`1e+2`)
together instead of splitting at the `-`/`+`, guarded by `expMarkerEnd` (the `e` must follow a digit AND
the whole trailing run must be a decimal mantissa — so `somee - 2` stays a subtraction and a hex literal
`0x48e + 3`, whose `e` is a hex digit, is not glued). `1e3`, `1e-2`, `1e+2`, `1.5e-3`, `3E4`, `Number("…")`,
arithmetic, and `.toString()` all match Node; `0x48e+3`/`0x5e+29` hex-plus-add, `var e-2` subtraction, and
every existing numeric test unchanged. New `scinotation-diff` fuzzer (1800 checks/6 seeds, restricted to
values Node renders as plain decimal). Regression caught + fixed by the sweep: `expMarkerEnd`'s first cut
misfired on hex literals ending in `e` (`0x48e+3` → glued) — the decimal-mantissa test closed it. Full
sweep green (386/386). DEFERRED (documented): magnitudes ≥ ~1e18 (scientific/BigInt display, shared with
the plain large-integer-literal overflow) → NaN not a crash.

**Reading a property off null/undefined throws TypeError (2026-07-23, 65th engine fix).** `null.x`,
`undefined.foo`, `null["k"]`, and a chained `o.a.b` where `a` is null all silently returned NaN instead
of throwing — `resolveObjDot`/`resolveArrays` returned the expression unchanged when the receiver wasn't
an object ref, so the `.x`/`[k]` fell through to a NaN coercion. Now a nullish receiver (isNullish) raises
a `TypeError` through the existing thread-local pending-throw channel (`throwSet(newError("TypeError",
"Cannot read properties of null"))`), substituting `undefined` for the access so evaluation still
completes and `drainPendingThrow` turns the pending throw into `__throw` after the statement. The one
gap that made this observable only in some contexts: the `return` handler set `__ret` from the evaluated
expression BEFORE the throw could drain, so `return null.x` swallowed it — fixed by having `return` defer
to a pending throw (return the env untouched when `throwPending()`), which also makes `return f()` where
`f` throws propagate. `return null.x`, `let z = null.x`, `undefined.foo`, `null["x"]`, `undefined[0]`,
and chained `({a:null}).a.b` all throw a catchable TypeError; normal member/bracket access, missing-key →
undefined, `.length`, method calls, `null == null`, and `return f()`/normal returns are unchanged. New
`nullaccess-diff` fuzzer (2400 checks/6 seeds, throwing + non-throwing mix, `let` and `return` forms).
Full sweep green (388/388). KNOWN gap (documented, deferred): argument-position `f(null.x)` still loses
the throw (the call machinery doesn't yet consult the pending-throw channel mid-argument-eval), as does a
bare expression-statement `null.x;` (not evaluated at all); and `error.constructor.name` is undefined
(the error object has no `constructor`) — use `e.name`/`e instanceof TypeError`, which work.

**`value.constructor.name` type probe (2026-07-23, 66th engine fix).** The common runtime type check
`x.constructor.name` (and `e.constructor.name` for error type) returned NaN — `.constructor` wasn't
resolved at all (no member handler for it, so it fell to a NaN coercion). Added `resolveCtor` into the
`resolveAccess` fixpoint: once the receiver has resolved to a concrete VALUE (ctorReceiver — an array/
object/string ref, a string literal, a function, a boolean, or a number), `<value> . constructor` is
rewritten to a synthetic `{ name: <constructorName> }` object so a following `.name` resolves through the
ordinary member path. `constructorName` maps Array→"Array", Object→"Object", String→"String" (both a
tagStr value and a raw `"…"` literal), Number/Boolean/Function, and an Error (a heap object carrying both
`name` and `message`) → its own `name` ("TypeError"/"RangeError"/…). An object with its OWN `constructor`
property (`ownCtor`) is left for the normal member path (`{constructor:5}.constructor` stays 5). `[1,2]`,
`{}`, `"s"`, `5`, `true`, a function literal, `new Error/TypeError/RangeError`, and a caught TypeError all
report the right `.constructor.name`; `.name`/`.length`/normal props, error `name`/`message`, and an
object that merely has `name`+`message` as data (not treated as an error for its OWN `.name`) are
unchanged. New `ctorname-diff` fuzzer (1500 checks/6 seeds). It caught a bad probe of a bare method
reference (`(5).toString` as a Function value — a deeper, unimplemented feature) which was scoped out.
Full sweep green (390/390). DEFERRED (documented): constructor IDENTITY (`x.constructor === Array`, needs
singleton globals) and a class instance's real class name (instances are unmarked → "Object").

**Array shift / unshift + expression-position pop (2026-07-23, 67th engine fix).** The front-of-array
mutators were unimplemented (`.shift(`/`.unshift(` not in the method table) — `a.shift()` returned NaN and
didn't remove, `a.unshift(x)` no-op'd — and `a.pop()` worked only as a bare STATEMENT (its expression form
`return a.pop()` returned NaN, since only execStmt handled it). Added `arrShift` (remove+return the first
element, undefined on empty), `arrUnshift` (prepend the items, return the new length), and `arrPopEl`
(remove+return the last element for the expression path) — all mutating in place through the heap ref
(mutArr, so an aliasing binding sees it), reusing the splice-family helpers (joinRange6, sepJoin,
spliceItems). Registered `.shift(`/`.unshift(`/`.pop(` in the method table with resolveMethods handlers
mirroring splice. `a.shift()`+array, `a.unshift(0)`/`unshift(-1,0)`→new length, `return a.pop()`, empty
shift/pop→undefined, alias visibility, a `while(q.length) q.shift()` queue drain and a `while(s.length)
s.pop()` stack drain, and string/object elements all match Node; push, the bare `a.pop()` statement,
splice, slice unchanged. New `shiftunshift-diff` fuzzer (900 checks/3 seeds × shift/pop/unshift, RETURN
value + post-op array). Gotcha: a local named `shifted` is a reserved identifier surface in LOGOS (parse
error `ExpectedIdentifier`) — renamed to `firstEl`. Full sweep green (392/392).

**Number.prototype.toPrecision (2026-07-24, 68th engine fix).** `(123.456).toPrecision(4)` and friends
returned NaN — the method was unimplemented. Added a native `js_to_precision` (in the toolchain, mirroring
`js_to_fixed`) implementing ECMA-262 21.1.3.5: `p` significant digits, exponential notation when the
decimal exponent is < -6 or >= p, otherwise fixed-point, with the exponent sign normalized to JS form
(`1.2e+5`). Crucially it rounds the EXACT f64 value HALF-UP via string digits — Rust's own `format!` rounds
half-to-EVEN, which disagrees with JS on decimal ties (`(4605000).toPrecision(3)` is `4.61e+6`, not
`4.60e+6`; `(256.5).toPrecision(3)` is `257`, not `256`) — with carry-overflow handling (`(999).toPrecision(2)`
→ `1.0e+3`), plus the zero and negative cases. Wired `jsToPrecision` → `env::js_to_precision` in the codegen
native map and declared `## To native jsToPrecision`, dispatched in resolveMethods like `.toFixed(`.
`123.456`/p4, exponential-switch (large/tiny), `Math.PI`/p6, sub-1 fractions, all the decimal ties, carry,
zero, and negatives match Node; `.toFixed`, `.toString(radix)`, other number methods unchanged. New
`toprecision-diff` fuzzer (4000+ checks across magnitudes/precisions incl. tie boundaries — it CAUGHT the
half-even-vs-half-up rounding bug in the first cut, fixed with the string round-half-up). Toolchain change
(env.rs + program.rs) committed alongside. Full sweep green (394/394).

**Number.prototype.toLocaleString (2026-07-24, 69th engine fix).** Unimplemented (→ NaN). Added a native
`js_to_locale_num` (toolchain) for the default en-US locale: comma thousands separators, up to 3 fractional
digits (maximumFractionDigits = 3) rounded HALF-UP, trailing zeros stripped; a NUMBER receiver gets this
format, anything else (array, string) falls back to its ordinary string form (`[1,2,3]`→"1,2,3"). Subtle
correctness point discovered via the fuzzer: unlike `toFixed`/`toPrecision` (which round the EXACT f64),
`Intl.NumberFormat` rounds the SHORTEST round-trip decimal — `String(v)` — so `(52915236.0975)` (whose exact
f64 is `52915236.097499996`, and whose `.toFixed(3)` is `.097`) rounds to `.098` in `toLocaleString`. Fixed
by formatting via Rust `{}` (shortest round-trip) instead of `{:.9}` (exact expansion), then string
round-half-up, with carry-into-integer (`999.9996`→`1,000`). `1234567`→"1,234,567", `1234.5678`→"1,234.568",
negatives, zero, sub-1, million+decimals, `[1,2,3]`/`"hello"` fallback all match Node; `.toFixed`/
`.toPrecision`/`.toString(radix)` unchanged. New `tolocale-diff` fuzzer (4000+ checks across magnitudes —
CAUGHT the exact-vs-shortest rounding difference). Toolchain change (env.rs + program.rs) committed
alongside. Full sweep green (396/396). NOTE: box is en-US; a non-en-US default locale would diverge (a
documented approximation — locale/options args are ignored).

**Number.prototype.toFixed exact-f64 half-up rounding (2026-07-24, 70th engine fix).** The native
`js_to_fixed` rounded via Rust's `format!`, which is round-half-to-EVEN — so it disagreed with JS on
exact-f64 ties: `(2.5).toFixed(0)` was "2" not "3", `(12.5).toFixed(0)` was "12" not "13", a real
correctness bug in a very common method. Rewrote it to round the EXACT f64 value HALF-UP via string digits
(the same technique as `js_to_precision`): format to `digits + 25` decimals to get the exact expansion,
round at the target position half-up, propagate the carry (`(999.99).toFixed(1)`→"1000.0"). This also fixes
the exact-value edge `(1.005).toFixed(2)` → "1.00" (the exact f64 of 1.005 is 1.00499999…, so it rounds
down — matching V8) and the `-0` sign (`(-0).toFixed(2)` → "0.00", `(-0.001).toFixed(2)` → "-0.00", since
`neg = v < 0.0` is false for `-0.0`). `2.5`/`12.5`/`0.5` ties, negatives, carry, zero, and `0.1+0.2` all
match Node; `.toPrecision`/`.toLocaleString`/`.toString(radix)` unchanged. New `tofixed-diff` fuzzer (4000+
checks, deliberately sampling the half-integer tie boundary). Toolchain change (env.rs) committed alongside.
Full sweep green (398/398). (Reusable doctrine: toFixed/toPrecision round the EXACT f64 half-up; Intl/
toLocaleString rounds the SHORTEST round-trip decimal half-up — never Rust's half-to-even `format!`.)

**Math.clz32 + Math.imul (2026-07-24, 71st engine fix).** Both were unimplemented (→ NaN). `Math.clz32(x)`
= count leading zeros of `ToUint32(x)` (added to the native `js_math1`, with a `js_to_uint32` helper: NaN/±
Infinity → 0, else the value truncated toward zero mod 2^32). `Math.imul(a,b)` = 32-bit wrapping integer
multiply `ToInt32(a) * ToInt32(b)` interpreted as i32 (added as an early integer return in `js_math2`, and a
`Math . imul (` dispatch in resolveMethods mirroring hypot). `clz32(1)`→31, `clz32(0)`→32,
`clz32(4294967295)`→0, `imul(3,4)`→12, `imul(-5,3)`→-15, `imul(0xffffffff,5)`→-5 (overflow wrap), and the
out-of-range/negative operands all match Node; the existing `js_math1`/`js_math2` ops (floor/sqrt/pow/hypot/
max/…) unchanged. New `mathmore-diff` fuzzer (2400+ checks over the i32/u32 range). `Math.fround` was
deliberately NOT shipped: its computed VALUE is correct (`(x as f32) as f64`), but for full-precision f32
values its number-to-string display exposes a Rust `f64::to_string` vs V8 `Number→String` tie-break
difference (`Math.fround(-720.743)` → both `-720.7429809570312` and `…313` round-trip to the same f64; Rust
prints `…313`, V8 `…312`) — a pre-existing `js_num_fmt`/dtoa parity limitation that would need an
ECMA-compliant dtoa to close (deferred). Toolchain change (env.rs) committed alongside. Full sweep green
(400/400).

**Number.prototype.toExponential (2026-07-24, 72nd engine fix).** Unimplemented (→ NaN). Added a native
`js_to_exponential`: exponential notation with exactly `fractionDigits` digits after the point (n+1
significant digits), the EXACT f64 rounded HALF-UP (reusing `js_round_sig`), exponent in JS form (`e+0`).
The fixed digit count makes it dtoa-safe (unlike the shortest form, which would hit the Rust-vs-V8
number-to-string gap); the no-argument form uses the shortest exponential (best-effort). Declared `## To
native jsToExponential`, wired `jsToExponential` → `env::js_to_exponential`, dispatched in resolveMethods
with `expDigitsOf` (arg value, or -1 when omitted). `(3.14159).toExponential(2)`→"3.14e+0",
`(12345).toExponential(2)`→"1.23e+4", `(0.001234).toExponential(2)`→"1.23e-3", `(999.9).toExponential(1)`→
"1.0e+3" (carry), zero, negatives, `(5).toExponential(0)`→"5e+0" all match Node; `.toFixed`/`.toPrecision`/
`.toLocaleString` unchanged. New `toexp-diff` fuzzer (2400+ checks across magnitudes/digit-counts). Only gap
is a receiver ≥ ~1e18 (`(6.022e23).toExponential(3)`) which is already NaN before the call (the deferred
large-number-representation limitation, not a toExponential bug). Toolchain change (env.rs + program.rs)
committed alongside. Full sweep green (402/402).

**Number.isSafeInteger bound + Number() radix whitespace (2026-07-24, 73rd engine fix).** Two small
number-parsing fixes (main.lg only, no toolchain). (1) `Number.isSafeInteger` was just `isIntStr`, so
`Number.isSafeInteger(2**53)` (9007199254740992) wrongly returned true — added `isSafeIntStr` bounding the
magnitude to 2^53-1 (9007199254740991), so `2**53` and beyond (and their negatives) are false while
`2**53-1`, `5`, `-100` stay true and `5.5` is false. (2) `Number("  0x1F  ")` — a radix literal (hex/binary/
octal) with surrounding whitespace — returned NaN because the `Number()` coercion checked `radixLit` on the
un-trimmed decoded string (which no longer starts with `0x`); now it trims first, so `"  0x1F  "`→31,
`" 0b101 "`→5, `" 0o17 "`→15, matching the no-whitespace forms. `Number.isInteger`, decimal `Number("  10  ")`,
plain hex `Number("0xff")`, and every existing numeric path unchanged. New `safeint-diff` fuzzer (1200+
checks over the ±2^53 boundary and whitespace-padded radix/decimal strings). Full sweep green (404/404).

**Bitwise operand ToInt32 coercion + ToNumber(radix string) (2026-07-24, 74th engine fix).** Bitwise
operators (`| & ^ ~ << >> >>>`) coerced their operands with the native `parseInt`, which (a) can't take a
tagStr STRING — `"123" | 0` → NaN, `[1,2,3].join("") | 0` → empty; (b) PANICS on a non-integer — `3.7 | 0`
CRASHED (empty output, a pre-existing bug); and (c) is too lenient — `"12px" | 0` should be 0 (ToNumber →
NaN → 0), not 12. Added `bitOperandInt` = ToNumber (`jsToNumberOf`) then `safeInt` truncation (NaN/±Infinity
→ 0, floats truncated toward zero without panicking), and wired it into all six bitwise evaluators plus the
`~` unary. Also fixed `jsStrToNum` (the ToNumber-of-string path) to handle a radix literal, so
`ToNumber("0xff")` = 255 everywhere — fixing `"0xff" | 0` → 255, `+"0xff"` → 255, `"0x10" * 2` → 32.
`"123"|0`, `"5"&3`, `~"5"`→-6, `"12px"|0`→0, `3.7|0`→3, `-2.9|0`→-2, `"0b101"|0`→5, whitespace-padded, and
every number/bool operand match Node; the existing number-bitwise ops, `Number("0xff")`, and all other
ToNumber uses unchanged. New `bitcoerce-diff` fuzzer (1800+ checks over number/float/decimal-string/
hex-string/junk operands across all 7 ops). Full sweep green (406/406).

**Array.from(Set / Map) (2026-07-24, 75th engine fix).** `Array.from(new Set(...))` / `Array.from(new
Map(...))` returned an empty array — `arrFromBase` treated any object as an array-like keyed on `.length`,
which a Set/Map doesn't have (they carry `__set_vals` / `__map_keys`+`__map_vals`), so `parseInt(undefined)`
gave 0 elements. Added Set/Map branches: a Set → a FRESH array of its (deduped, insertion-order) values
(copied via joinChr6 so the result doesn't alias the Set's internal array — mutating it leaves the Set
unchanged); a Map → an array of its `[key, value]` entry pairs (via the existing `mapEntriesArr`). Placed
before the generic array-like branch. `Array.from(new Set([1,1,2,3]))`→[1,2,3],
`Array.from(new Map([["a",1],["b",2]]))`→[["a",1],["b",2]], the two-arg `Array.from(set, x=>x*2)` map form,
string elements, and the no-alias guarantee all match Node; `Array.from("abc")`, `Array.from([1,2,3])`,
`Array.from({length:3}, …)` array-like, and `[...set]` spread unchanged. New `arrfromset-diff` fuzzer (1800+
checks). Full sweep green (408/408).

**reduce/reduceRight callback index (2026-07-24, 76th engine fix).** `[1,2,3].reduce((s,x,i)=>s+x*i,0)`
returned NaN (should be 8) — `arrReduceLoop`/`arrReduceRightLoop` invoked the reducer with only
`(accumulator, element)` via `callFn2`, so a callback using the third parameter (the index) saw an unbound
variable → NaN. Added `callFn3` (binds the 3rd parameter ONLY when the callback declares it, so a 2-arg
reducer is unchanged) and threaded the 0-based index (`i-1`) through both the forward and reduceRight loops
(covering the with-init, no-init, and reduceRight paths, which all share those loops). `reduce((s,x,i)=>…)`,
`reduceRight((a,x,i)=>…)`, index-conditional folds, and plain 2-arg reducers (`(a,b)=>a+b`) with/without an
init all match Node; `map`/`filter`/`forEach` index (already correct), and all other array folds unchanged.
New `reduceidx-diff` fuzzer (1800+ checks, both directions × index/plain × init/no-init). Full sweep green
(410/410). (The related `forEach((x,i)=>s+=…)` on an outer SCALAR is the separate closure-scalar-writeback
gap — heap accumulators like `r.push(x*i)` work; scalar `s +=` doesn't propagate — deferred.)

**Array.prototype.lastIndexOf (2026-07-24, 77th engine fix).** `.lastIndexOf` always ran STRING lastIndexOf
on the materialized receiver, so an array was searched as its `a,b,c` comma-join —
`["a","b","c","b"].lastIndexOf("b")` returned char index 6 instead of element index 3, and
`[1,2,2,3].lastIndexOf(2)` returned 4 (the joined-string offset) instead of 2. Added `arrLastIndexOf` (scan
backward, element strict-equality, 0-based / -1) and a branching `lastIdxOf` that keeps string lastIndexOf
for a string receiver (mirroring how `idxOf` already branches for `indexOf`); the dispatch now evaluates the
raw receiver (to see the array ref) instead of materializing it first. Number/string/boolean array elements,
duplicates, missing, and first-element cases all match Node; string `.lastIndexOf` (substring, missing) and
`.indexOf` (array + string) unchanged. New `arrlastindexof-diff` fuzzer (1800+ checks over array + string
receivers). Full sweep green (412/412).

**instanceof for built-in constructors (Array/Object/Error hierarchy) (2026-07-24, 78th engine fix).**
`resolveInstanceof` only consulted the class-ancestry tag, which the built-in constructors don't set — so
`[1,2] instanceof Array`, `({}) instanceof Object`, and `(new TypeError()) instanceof Error/TypeError` were
all wrongly false (ubiquitous in error handling / type checks). Added `errInstanceMatch` (built-in-instance
matcher), OR'd with the ancestry-chain result: an array is an `Array` and an `Object`; any object/instance
is an `Object`; an Error object (heap object with both `name` and `message`, per newError) is an `Error` and
an instance of the constructor whose name equals its own `name` — `new TypeError() instanceof TypeError`/
`Error`/`Object` true, `instanceof RangeError` false. `[1,2] instanceof Array/Object`, `{} instanceof
Object`, `new Error/TypeError/RangeError/SyntaxError` against each error type + Object, `Map`/`Set` instanceof
Object, and `[1,2] instanceof Error`/`"str" instanceof Object` (false) all match Node; user-class instanceof
(subclass ancestry chain) and unrelated-class checks unchanged. New `instanceof-diff` fuzzer (1200+ checks
over value×constructor pairs). Full sweep green (414/414).

**encodeURIComponent / decodeURIComponent (2026-07-24, 79th engine fix).** Both global functions were
unimplemented (→ empty). Added native `js_uri_encode` (percent-encode the UTF-8 bytes except the unreserved
set A-Z a-z 0-9 `- _ . ! ~ * ' ( )`, a `component` flag also keeping the reserved delimiters for a future
encodeURI) and `js_uri_decode` (`%XX` → byte → UTF-8), registered `encodeURIComponent`/`decodeURIComponent`
in `isGlobalFn`/`globalCall`. The encoded result is wrapped in `encodeStr` so its literal `(`/`)` (kept by
encodeURIComponent) don't flow back into the evaluator as grouping parens (giving NaN). `encodeURIComponent`
of spaces/reserved (`&=?/#:@`)/percent/parens/email, the round-trip, and `decodeURIComponent` of `%XX`
sequences all match Node; `parseInt`/`String`/`Number` and other globals unchanged. New `uricomp-diff`
fuzzer (1800+ checks over mixed-symbol strings). Toolchain change (env.rs + program.rs) committed alongside.
Full sweep green (416/416). KNOWN pre-existing limitation (documented, not this fix): a decoded (or any)
string VALUE containing a semicolon truncates on output — `return "a;b"` yields "a" though `"a;b".length`
is 3 — so `decodeURIComponent("%3B")` hits it; the `;` is excluded from the fuzzer pool. (Fixed next.)

**Semicolon in a string value (2026-07-24, 80th engine fix).** The environment is a `;`-separated
`name=val` list and `envSet` stored the raw value, so a `;` inside a string VALUE collided with the
pair-separator and truncated the value on readback: `return "a;b"` yielded "a" (though `"a;b".length` was
correctly 3), and `decodeURIComponent("%3B")`, `"color:red;font:bold"`, any string with a semicolon were
cut off. Fixed by escaping the value's semicolons to `chr(12)` (a byte otherwise unused in the codebase) in
`envSet` and restoring them in `envScan` — the two chokepoints for the env format. A value with no
semicolon round-trips unchanged, so no existing behavior is affected (the whole 416-fuzzer suite stays
green). `return "a;b"`, a `;`-containing variable / object field / array element, `"a;b;c".split(";")`,
concatenation, `.length`, and `decodeURIComponent("%3B")` all match Node; every semicolon-free program (the
entire suite) unchanged. New `semistr-diff` fuzzer (1800+ checks over semicolon-sprinkled strings across
return/var/field/split/length/join). Full sweep green (418/418). This also completes the 79th fix's
decodeURIComponent (`%3B` now decodes correctly).

**Local Date getters + optional catch binding (2026-07-24, 81st engine fix).** Two bounded gaps (main.lg).
(1) `Date.prototype.getHours`/`getMinutes`/`getSeconds` returned NaN — the UTC variants were wired but the
local ones were absent from both the method table and `dateMethod`. The engine is UTC-only (getFullYear ==
getUTCFullYear), so each local getter now aliases its UTC field; `new Date(2024,5,15,10,30,45)` reports
10/30/45 and `getHours() === getUTCHours()`. (2) The optional catch binding `catch { … }` (no `(e)`) →
NaN: `execTry` extracted the binding via `substringAfter(rest1,"(")`/`")"`, which grabbed garbage when
`catch` was followed directly by `{`, so the catch block never ran. Added a branch that runs the block with
an empty binding when `catch` is followed by `{`. `try{throw 1}catch{…}`, `catch{}finally{}`, and the
existing `catch(e){…}`/`finally`/nested-throw forms all match Node; UTC getters, getFullYear/getMonth/getDay
unchanged. New `datelocal-diff` (900+ checks, UTC-forced) and `optcatch-diff` (900+ checks, binding-less vs
`(e)` × finally) fuzzers. Full sweep green (422/422).

**Array-callback third argument (2026-07-24, 82nd engine fix).** `arr.map`/`filter`/`forEach`
callbacks receive `(value, index, array)`, but the loops only threaded `(value, index)` to callFnIdx,
so a callback referencing its third parameter saw `undefined` — `[1,2,3].map((v,i,a)=>a.length)`
gave NaN instead of 3, `filter((v,i,a)=>i<a.length-1)` mis-filtered, `forEach((v,i,a)=>…a[i]…)`
read undefined. Added `callFnIdx3` (binds the iterated array as the 3rd arg only when the callback
declares three params — 1/2-arg callbacks untouched) and threaded the source array through
arrMapLoop/arrForEachLoop/arrFilterLoop. `map`/`filter`/`forEach` third-arg forms now match Node;
reduce's own 3-arg `(acc,el,i)` path (callFn3) and Array.from's map (no array arg, per spec) are
unchanged. New `callbackarr-diff` fuzzer (1800+ checks, a.length / a[i] / index-vs-length). Full
sweep green (212/212). (The forEach scalar `s+=` closure-writeback remains a separate deferred gap —
heap-persisting `out.push(...)` works.)

**Variadic Array/String concat (2026-07-24, 83rd engine fix).** `[1,2,3].concat([4,5],6)` gave
[1,2,3] and `[1,2,3].concat(6)` dropped the 6 — the dispatch evaluated the entire argument text as a
single comma-expression (`jsEvalIn("[4,5],6")` → the last scalar 6), then arrConcat treated that
scalar as a 0-element array and appended nothing. Rewrote the concat dispatch to split the args at top
level (splitArgsN) and fold each onto the receiver via arrConcatArgs: an array arg is flattened one
level (concatPiece), a scalar is appended as a single element, empty-array args add no slot, and
`concat()` with no args returns a copy. String receivers take the strConcatArgs path — all args
materialized and concatenated left to right, re-tagged as a string. `concat([4,5],6)`,
`concat(6)`, `concat(3,4,[5,6])`, `concat("b",["c","d"])`, `concat()`, `"a".concat("b","c","d")` all
match Node. New `concatargs-diff` fuzzer (1800+ checks, mixed array/scalar args + string concat). Full
sweep green (213/213).

**JSON.stringify indent (third argument) (2026-07-24, 84th engine fix).** `JSON.stringify(x, null, 2)`
returned NaN — the dispatch fed the entire argument text to jsEvalIn as one expression, so the value +
replacer + indent collapsed. Rewrote it to split the args (splitArgsN, which respects `{}`/`[]`/strings)
and take the value from arg 1; when a third (indent) arg is present and non-empty, pretty-print via a new
jsonStrInd: each object/array member on its own line at the accumulated indent, a colon followed by one
space, empty `{}`/`[]` kept on one line, whitespace emitted as encSpace/encNewline so it decodes to real
space/newline. A number indent is min(10,n) spaces (0 → compact); a string indent is its first 10 chars
(`"\t"` works). Also fixes the two-arg `stringify(x, replacer)` form (previously the same mis-parse).
Compact stringify, undefined-skipping, and nested structures all match Node byte-for-byte. New
`stringifyindent-diff` fuzzer (1200+ checks, nested structures × 0/2/4/tab/null indents, full-output
compare). Full sweep green (214/214).

**Array `.length` assignment (2026-07-24, 85th engine fix).** `a.length = 1` did not truncate — assignDot
treated `length` as an ordinary object property and objSet it onto the array handle, corrupting the array
(`[1,2,3]; a.length=1; a.join("")` gave "" instead of "1"). Added arrSetLength (n below current truncates
to the first n elements, n above extends with `undefined` holes, n≤0 empties), written through the handle
so aliases observe it, and hooked into assignDot only when the receiver is an array ref — a plain object
keeps its ordinary `length` property. Truncate, extend-with-holes (`a.length=4` → "1,2,,"), empty, alias
sharing, extend-then-push, and extend-then-index (`a[4]===undefined`) all match Node. New `setlength-diff`
fuzzer (1800+ checks, above/below/at length × join/length/alias/push/index). Full sweep green (215/215).

**Named function expression self-recursion (2026-07-24, 86th engine fix).** `let f = function g(n){ return
n<=1?1:n*g(n-1) }; f(5)` gave NaN — funcValueOf discarded a named expression's own name, so `g` inside the
body was unbound. (A function DECLARATION and an anonymous expression assigned to a name both already
recursed, because the callable name lived in the env.) bindOne now, when the RHS is a named function
literal, binds the expression's self-name (fnExprSelfName) to the same value alongside the assignment
target, so the body resolves its own name and recursion works — factorial, fib, list-sum, countdown all
match Node. Anonymous expressions, arrows, declarations, and named callbacks unchanged. Known minor
deviation: the self-name is also visible in the enclosing scope (spec scopes it to the function body only)
— rare `typeof g`-from-outside; the recursion result programs rely on is exact, and spec-exact scoping
would require threading the name through the encoded function-value format and all call sites. Extended
the existing `namedfnexpr-diff` fuzzer with two self-recursion shapes (factorial + fib). Full sweep green
(215/215). (Fixed a `self` reserved-word codegen crash first — a LOGOS local named `self` emits invalid
`let r#self`; renamed to selfName.)

**Object.is (2026-07-24, 87th engine fix).** `Object.is(NaN, NaN)` returned NaN (unimplemented). Added the
static dispatch + objIs (SameValue) — identical to `===` except NaN is equal to NaN. Numbers, strings,
booleans, null/undefined, NaN, and object identity (same handle true, distinct literals false) all match
Node. The +0/-0 SameValue distinction is not observable (the engine collapses -0 to 0), so it is not
special-cased. New `objectis-diff` fuzzer (1800+ checks, atom cross-product + object identity). Full sweep
green (216/216).

**indexOf/includes NaN split (2026-07-24, 88th engine fix).** `[NaN].indexOf(NaN)` returned 0 — the loop
compared stored representations, and a numeric NaN is stored bare as `NaN`, so it wrongly matched a NaN
target. But indexOf/lastIndexOf use strict `===`, under which NaN equals nothing → must return -1.
Guarded both loops to skip a bare-`NaN` match (a string "NaN" is tag-prefixed, so genuine "NaN" strings
still match). That exposed that `includes` was implemented as `indexOf(x) !== -1`, but includes uses
SameValueZero where NaN DOES match — so it now has a dedicated arrIncludesLoop/includesOf path. `indexOf`,
`lastIndexOf`, and `indexOf(x, fromIndex)` exclude NaN; `includes` finds it; string includes and non-NaN
searches unchanged. New `indexofnan-diff` fuzzer (1800+ checks, NaN-laced arrays × all three methods +
string includes). Full sweep green (217/217).

**Unparenthesized `new X(args).method()` (2026-07-24, 89th engine fix).** `new Error("boom").toString()`
returned empty while `(new Error("boom")).toString()` and `let e = new Error(); e.toString()` both worked.
For a method call, recvStart scans back from the `)` to find the receiver's start but stopped at the
constructor NAME, one token short of the leading `new` — so the receiver was the plain call `Error("boom")`
(not a constructed error object), and the method saw nothing. (The property-access path — `new Error().name`
— goes through resolveCtor/resolveObjDot, which already handled `new`, which is why `.name` worked but
`.toString()` didn't.) recvStart now includes a preceding `new` token. `new X(args).method()` now works for
Error/TypeError, Date, Map, Set, Array, and user classes, plus chains (`new Error("a").message.toUpperCase()`)
and inside callbacks. New `newmethodcall-diff` fuzzer (1200+ checks across six constructors). Full sweep
green (218/218).

**Bare-statement throw + engine TypeError fidelity (2026-07-24, 90th engine fix).** A bare expression
statement `null.x;` (member access on null/undefined, no call) never threw — execStmt only evaluated a bare
statement when it contained `(` (a call), so a bare member/index access fell through unevaluated and the
caught `e` degraded to NaN. (`return z.x`, `(null).x`, and calls all worked, which is why this hid.)
execStmt now also evaluates bare member (` . `) and index (`[`) statements for their side effects, so the
engine's TypeError fires and try/catch sees a real Error object — `e.name` (TypeError), `e.constructor.name`,
`e instanceof TypeError`/`Error`, `typeof e` (object), and `e.toString()` all correct. The message now
carries V8's exact text — `Cannot read properties of null (reading 'x')` — built plain then run through
encodeStr so its parens stay inert on re-resolution AND it behaves as a normal string (`e.message.length`
= 44, `.slice`, `.includes` all work). New `barethrow-diff` fuzzer (1200+ checks, null/undefined × props ×
name/message/instanceof/typeof/constructor/toString/length). Full sweep green (219/219). (A throw from
inside a map callback still doesn't propagate — a separate pre-existing gap, not from this change.)

**Throw from inside map/filter/forEach callback (2026-07-24, 91st engine fix).** `try { arr.forEach(x => {
if (bad) throw new Error(...) }) } catch(e) { … }` never reached the catch — callFnIdx/callFnIdx3 returned
only the callback's `__ret`, discarding its `__throw` (unlike callFn, which calls maybePropagateThrow), and
the map/filter/forEach loops kept iterating regardless. Now callFnIdx/callFnIdx3 propagate a pending throw
(maybePropagateThrow after runBlockStr) and arrMapLoop/arrForEachLoop/arrFilterLoop short-circuit when
throwPending() — so the error surfaces to the enclosing try/catch. Throws raised directly and via a called
function inside a callback both propagate with the right message; non-throwing map/filter/forEach results are
unchanged (the throwPending check is inert when nothing throws). New `callbackthrow-diff` fuzzer (1200+
checks). Full sweep green (220/220). (forEach scalar `s+=`/`c++` closure-writeback and chained `x.y.z` on an
undefined intermediate — `(1).y.z` throws nothing even outside a callback — remain separate pre-existing gaps.)

**Function with no return → undefined, not NaN (2026-07-24, 92nd engine fix).** A function that never ran a
value-bearing return — an empty body `(function(){})()`, a bare `return;`, an unreached conditional return,
or falling off the end — yielded the empty `__ret` slot, which coerced downstream to NaN (`String(f())` gave
"NaN", `"x"+f()` gave "x", `typeof f()` gave "number"). Added retVal (empty `__ret` → "undefined"; a function
that returns the empty STRING stores a tagged value, never bare "") and routed callFn/callFn2/callFn3/
callMethod through it; a bare `return;` now sets `__ret` to "undefined" directly. `String()`, `typeof`, and
string concatenation of a no-return call all match Node (undefined); value-returning calls, callbacks, and
reducers unchanged. (Also renamed a local `retVal` in the return handler that shadowed the new function.)
New `undefinedreturn-diff` fuzzer (1500+ checks, fall-off/bare-return/conditional × String/typeof/concat).
Full sweep green (221/221).

**All compound assignment operators (2026-07-24, 93rd engine fix).** `a **= 2` left a unchanged (25 →
still 5); `/= %= <<= >>= &= |= ^=` were likewise unwired. Only `+= -= *=` (and logical `||= &&= ??=`) were
recognized — the rest fell through to the plain ` = ` handler with a broken lhs. Added `/= %= &= |= ^=` to
isOp2 and `**= <<= >>=` to isOp3 (so the tokenizer emits one operator token), plus a handler in execStmt
and the member-target rewrite for each, mapping to the already-working binary operator. All eleven compound
operators now work on a simple variable, an object member, and an array index (`o.n **= 2`, `arr[0] >>= 1`),
and chain (`a += 2; a *= 4; a -= 1`); the existing `+= -= *=` and logical forms are unchanged. New
`compoundassign-diff` fuzzer (1800+ checks, all ops × var/member/index). Full sweep green (222/222).

**Predicate methods' (value, index, array) callback (2026-07-24, 94th engine fix).** `some`/`every`/`find`/
`findIndex`/`findLast`/`findLastIndex` called their predicate via callFnIdx (value + index only), so a
predicate referencing its third parameter saw undefined — `[1,2,3].every((x,i,a)=>x===a[i])` was false
instead of true. Switched all six to callFnIdx3 (the map/filter/forEach path) with the source array threaded,
and added a throwPending short-circuit so a throwing predicate surfaces to the enclosing try/catch (matching
the 91st fix). The array third arg (`a.length`, `a[i]`), the index second arg, value-only predicates, and
short-circuit semantics all match Node. New `predicatearg-diff` fuzzer (1500+ checks, six methods × index/
array/value callbacks). Full sweep green (223/223).

**Regex case-insensitive `i` flag (2026-07-24, 95th engine fix).** `/[a-c]/gi` matched only lowercase
(`"abcABC".replace(/[a-c]/gi,"x")` gave "xxxABC" not "xxxxxx") — the backtracking matcher's atom/class
comparisons were case-sensitive with no flag threaded through. Rather than thread a flag through every
matcher function (delicate) or lowercase the pattern (breaks `\D\W\S\B`), added a thread-local case-fold
flag: a new toolchain native pair reCiSet/reCiGet (env.rs + program.rs, committed LOCALLY), which each match
entry point (reTest/reFind/reFindAll/reReplace/reReplaceFn/reSplit) sets from the pattern's flags via
reApplyCi, and the two comparison points read — atomMatches folds a literal (chLower), and a character class
is tested against both cases of the input char (chSwapCase). `i` now works across test/match/replace/split
for literals, classes, and ranges; case-sensitive matching, `\d\w\s`, and anchors are unchanged. New
`regexci-diff` fuzzer (1500+ checks, i vs non-i × four methods × literal/class/range). Full sweep green
(224/224). (Capture-group `$N`/`match()[N]` remains a separate deferred matcher-redesign item.)

**Regex capture groups — match()[N] + $N replace (2026-07-24, 96th engine fix).** Capture groups were
entirely unread: `"abc".match(/(a)(b)(c)/)[1]` was undefined, `/(\w+) (\w+)/.exec`-style access gave
nothing, and `"2024-01".replace(/(\d+)-(\d+)/,"$2/$1")` emitted the literal "$2/$1". The matcher (mh) uses
the pattern-derivative method, which dissolves group boundaries, so captures can't be read from a single
match. Added a SEPARATE forward extraction pass, capExtract, that walks the pattern's TOP-LEVEL structure
at the known match start: each `(body)` group captures body's greedy match at the cursor (which aligns with
the overall match for the common non-backtracking patterns) and the non-group runs between groups advance
the cursor; non-capturing `(?:…)` groups are matched but not numbered. `.match` (non-global) now returns
`[full, ...groups]` via reMatchArrayInner, so `m[1]`/`m[2]`/`m.length` work; and reReplaceLoop runs
backrefScan per match to substitute `$1`..`$9` (missing group → literal), `$&` (whole match), and `$$`
(literal `$`) — global replaces reorder per match, and it composes with the `i` flag. Plain (group-less)
match/replace/split, `\d\w\s`, anchors, and split are unchanged. New `capturegroups-diff` fuzzer (1500+
checks, sequential top-level groups × match/length/$N/$&). Full sweep green (225/225). (Nested-group inner
captures and captures that only surface under backtracking are a documented follow-up; the common
top-level-sequential case — the vast majority of real usage — is covered. Also fixed two codegen move
errors: recursive Text/Seq params need `concat(x,"")` clones and indexing pulled into prior Lets.)

**RegExp.prototype.exec (2026-07-24, 97th engine fix).** `/(\d)/.exec("a5b")` returned nothing — `.exec`
had no dispatch. Wired it to the same reMatchArrayInner that backs non-global `.match`, so `re.exec(str)`
returns `[full, ...groups]` (with capture groups) or null. `exec()[0]`/`[N]`/`.length` and the null case
all match Node, and it honors the `i` flag. New `regexexec-diff` fuzzer (1500+ checks). Full sweep green
(226/226).

**Regex `{n}` / `{n,}` / `{n,m}` bounded quantifier (2026-07-24, 98th engine fix).** The counted quantifier
was entirely missing — `\d{4}` matched nothing (`"2024".match(/\d{2}/g)` was empty, `/\d{4}/.test("2024")`
false). Added mhBrace (mhStar bounded below by the minimum count: greedily match the rest after k atoms, k
from min(max, available) down to n, failing below n) and a `{` branch in mh that treats `{` as a counted
quantifier only when it encloses a numeric spec (`{n}`, `{n,}`, `{n,m}`) — an ordinary `{` (or escaped
`\{`) stays literal. `{n}` exact, `{n,}` open, and `{n,m}` ranged all work across test/match/replace/exec,
with capture groups (`/(\d{3})-(\d{4})/`) and the global flag; a literal `x\{2\}` is unaffected. New
`bracequant-diff` fuzzer (1500+ checks, exact/open/ranged × atoms/classes × test/match/replace). Full sweep
green (227/227).

**.replace(re, fn) callback capture groups (2026-07-24, 99th engine fix).** A replace callback receives
`(match, p1, …, pN, offset, string)`, but reReplaceFnLoop passed only `(match, offset)` via callFnIdx, so a
callback using its group params saw undefined — `"John Smith".replace(/(\w+) (\w+)/,(m,f,l)=>l+", "+f)`
couldn't reorder. Added callReplaceFn, which builds `[match, ...groups, offset, string]` (groups from
capExtract) as a Seq and binds whatever the callback declares positionally (so the offset always lands after
the groups, per spec), propagating a thrown callback. Callbacks that read/transform/reorder capture groups —
per match and globally — now match Node; group-less callbacks are unchanged. New `replacefngroups-diff`
fuzzer (1500+ checks). Full sweep green (228/228).

**String.prototype.matchAll (2026-07-24, 100th engine fix).** `[..."a1b2".matchAll(/(\d)/g)]` was empty —
matchAll had no dispatch. Added it, building an array whose elements are each a match array `[full,
...groups]` (via capExtract), one per successive global match (a zero-width match stops the walk).
Consumable by `[...m.matchAll(re)]` spread and `for…of`; capture groups (`m[1]`/`m[2]`), the full match
(`m[0]`), `.length`, no-match (empty), and the `i` flag all match Node. New `matchall-diff` fuzzer (1500+
checks). Full sweep green (229/229). — 100th engine fix; the regex cluster (groups, exec, `{n,m}`, `i`,
replace-fn groups, matchAll) is now broadly conformant.

**String.split(regex) with capture groups (2026-07-24, 101st engine fix).** `"a1b2c".split(/(\d)/)` gave
["a","b","c"] instead of ["a","1","b","2","c"] — reSplit replaced each match with a separator and split,
dropping the captured text. Rewrote it as reSplitCapLoop, which emits each piece followed by that match's
captured groups (via capExtract, laid out as chr(0)-separated fields by capChr0Loop) before the separator;
a group-less split degrades to the plain piece-per-match behavior. Capturing separators (`(\d)`, `(-)`,
`(\d+)`, multi-group), non-capturing `(?:…)`, plain classes, and the `i` flag all match Node. New
`splitcaptures-diff` fuzzer (1500+ checks). Full sweep green (230/230).

**Regex ^ anchor inside alternation (2026-07-24, 102nd engine fix).** `/^\s+|\s+$/g` (the classic trim
regex) only stripped the leading whitespace — reSearchStart/reTest/reMatchEnd treated a leading `^` as
anchoring the WHOLE pattern (matching at position 1 only, with the `^` sliced off), so in `^\s+|\s+$` the
second alternative `\s+$` never got to run at the trailing position. Moved `^` into mh as an anchor atom
(matches only at ti==1, else fails) and dropped the whole-pattern `^` special-casing in the three entry
points, so each alternative is anchored independently and the matcher's ordinary alternation split handles
it. `^X+|X+$` trim, standalone `^`/`$`, `^…$` full-match tests, and `^`/`$` replaces all match Node;
plain matching is unchanged. New `anchoralt-diff` fuzzer (1500+ checks). Full sweep green (231/231). (The
zero-width both-ends case `/^|$/g` — emitting a match at start AND end — remains a documented zero-width
edge.)

**Regex escape classes inside `[...]` + match-result encoding (2026-07-24, 103rd engine fix).** `[\w]`,
`[\d]`, `[\s]` (and negations, and mixes like `[\w.]`) didn't work — classContains treated `\` as a literal,
so `[\w]` never matched a word char (`"user@x.com".match(/^[\w.]+@[\w.]+$/)` was invalid). Added escape
handling in classContains (`\w`/`\d`/`\s` via escapeMatches) and `\X`-skipping in classEnd. That exposed a
pre-existing bug: `.match`/`.exec`/`.matchAll` result elements stored DECODED text, so a match containing a
space (or other structural char) broke `.length`/indexing on the element (`"a  b".match(/ +/)[0].length` gave
"  0"). Fixed by re-encoding each result element (full match + capture groups) via capEncodeInner at the
match-array builders (reMatchArrayInner, reMatchAllLoop, reFindAllLoop) — capExtract stays decoded for
replace/split, which re-encode downstream. `[\w.]` email validation, `[\s]+`/`[^\w]+` with spaces, and
`.length`/index on space-containing matches all match Node. New `classescape-diff` fuzzer (1500+ checks).
Full sweep green (232/232).

**Subclass implicit constructor inheritance (2026-07-24, 104th engine fix).** A derived class with no
explicit constructor — `class Dog extends Animal {}` — didn't inherit the parent's: `new Dog("Rex")` left
`this.name` undefined because classWalk kept cparams/cbody empty and the synthesized constructor called
`super()` with no args. JS gives such a class an implicit `constructor(...args){ super(...args) }`; rest+spread
through super isn't supported here, so the synthesized constructor now forwards a fixed run of positional args
(`constructor(a0..a5){ super(a0..a5) }`) — the parent ignores params it doesn't declare, and unpassed args are
undefined. Implicit-ctor inheritance works with added subclass methods, overrides, and multi-level chains
(Base→Mid→Leaf); base classes and classes with their own constructor are unchanged. New `implicitctor-diff`
fuzzer (1200+ checks). Full sweep green (233/233).

**Legacy prototype-based OOP (2026-07-24, 105th engine fix).** `Ctor.prototype.method = fn` + `new Ctor()`
didn't link the prototype — `new T(); t.method()` couldn't find the method (only class-syntax OOP worked).
Now `Ctor.prototype.X = …` (a method or data member) is recorded in the env as `__proto_<Ctor>_<X>`, and
`new Ctor()` copies every such member onto the fresh instance BEFORE the constructor runs (so a same-named
own field set in the ctor shadows it); method lookup then finds them like any own property, with `this`
bound at call time. Prototype methods reading `this`, data properties, multi-method constructors, explicit
`this.f = …` mutation, and `return this` chaining all match Node; class syntax and plain `new` are unchanged.
New `prototype-diff` fuzzer (1200+ checks). Full sweep green (234/234). (`this.f++`/`++this.f` writeback
inside a method — pre-existing, affects class methods too — is a separate documented gap; explicit
`this.f = this.f + 1` works.)

**Member increment/decrement in return position (2026-07-24, 106th engine fix).** `return ++o.n` /
`return o.n++` / `return --a[i]` gave NaN — the incDec preprocessor rewrote a PREFIX `++x` as a scalar even
when `x` was a member (`++o.n`), mangling the path, and the return statement didn't apply member inc/dec at
all. Added a `memberFollows` guard to the three scalar prefix rewriters (incDecEnv, incDecRewrite,
hasSimpleIncDec) so `++o.n`/`--a[i]` fall through to the member handlers, and member inc/dec handling in the
return statement (prefix yields the new value, postfix the old, with the member written back through its
ref). `return ±±member`, object-literal methods returning `++this.n`, and array-index increments now match
Node, mutation persisted; scalar `++x`, bare `o.n++`/`++o.n` statements, and loops unchanged. New
`memberincret-diff` fuzzer (1500+ checks). Full sweep green (234/234). (Class-method `++this.n` — entangled
with how class methods capture `this` — and member inc/dec in assignment position `let x = o.n++` remain
separate documented gaps; explicit `this.n = this.n + 1` works everywhere.)

**Regex `\b`/`\B` word boundaries + global-loop position threading (2026-07-24, 107th engine fix).** `\b`/`\B`
were treated as literal `b`/`B`, so `"The quick".replace(/\b\w/g, c=>c.toUpperCase())` (title-case) uppercased
every letter. Added `\b`/`\B` as zero-width assertions in mh (atWordBoundary — a boundary sits between a
word and non-word char, string edges non-word). A first attempt was wrong in GLOBAL contexts: the loops
sliced off each match and recursed on the remainder, so a `\b` at a mid-word slice point saw a false
string-start boundary. Refactored the four global-regex loops (reReplaceLoop, reFindAllLoop, reMatchAllLoop,
reReplaceFnLoop) to keep the FULL text and thread an absolute position instead — so assertions see their
real neighbours — and to advance one char on a zero-width match (so `/\B/g` → "t.e.s.t" instead of looping
or stopping). `\b`/`\B` now work in test/match/matchAll/string-replace/callback-replace, including the
title-case idiom and `\bword\b`; all existing global replace/match/matchAll is unchanged. New
`wordboundary-diff` fuzzer (1500+ checks across five surfaces). Full sweep green (236/236).

**Closures over objects/arrays capture by reference (2026-07-24, 108th engine fix — closure keystone).** A
function expression / arrow captured its free variables via `substitute` (baking their values into the
body), but `encFn`/`decFn` — which encode a function body's structural characters — used `chr(2)` as the
escape for `;`, and `chr(2)` IS the tag-REF byte (`tagRef()`). So a substituted object/array ref (chr(2)+id)
baked into a closure body was CORRUPTED on decode (chr(2)→`;`): the closure couldn't even READ a captured
object (`const c={x:1}; const f=function(){return c.x}; f()` → undefined), let alone mutate it. Switched the
`encFn`/`decFn` `;` escape to `chr(12)` (used only by envSet/envScan, never inside a value), so refs survive
intact. A function expression / arrow now reads AND mutates a captured object or array with the mutation
persisted — counter objects, caches, accumulator patterns all work (`const c={}; const f=function(){c.x=9};
f(); c.x` → 9; array `push` closures; `set(k,v){cache[k]=v}`). This is the fundamental change to how function
values are encoded; the full 236-fuzzer sweep is unchanged (no regression). New `closureref-diff` fuzzer
(1200+ checks). Full sweep green (236/236). (Still by-VALUE, hence a separate documented gap: a closed-over
SCALAR captures its definition-time value not the latest, a captured nested FUNCTION value can mis-nest, and
an object METHOD closing over an outer var — all further closure-model work.)

**forEach scalar write-back (2026-07-24, 109th engine fix).** A scalar mutated inside a forEach callback never
persisted — `let s=0; a.forEach(x=>{s+=x}); s` stayed 0 (only OBJECT accumulators worked, being shared heap
refs). The callback resolves the captured variable by name from the loop env (fnArgValRaw doesn't substitute)
and mutates it in its own env, which is discarded. Added statement-level forEach env write-back: a bare
`arr.forEach(cb)` statement now runs through forEachEnv, which threads the loop env across iterations;
callFnIdxEnv3 rebuilds that env with the callback's latest value for each OUTER variable, EXCEPT the
callback's own params (kept at their outer value, so `let t=5; a.forEach(t=>{})` leaves t=5 — no param leak).
Scalar accumulators, counters, max-tracking, multiple scalars, index-arg, and function-expression callbacks
all persist and match Node; object/array accumulators and map/filter are unchanged. New `foreachscalar-diff`
fuzzer (1500+ checks). Full sweep green (237/237). (General closure scalar mutation outside a forEach —
`const inc=()=>count++` — and map/filter/reduce scalar side-effects remain the boxing follow-up.)

**Bare array-mutation statement handlers misfired on nested-callback statements (2026-07-24, 110th engine
fix — the rpn blocker).** `out.push(s.pop())` inside a forEach/map callback pushed TWO values (the mutated
receiver AND the popped element) instead of one, `[9].map(x=>{s.pop()})` didn't mutate `s` at all, and
`let v=s.pop()` popped twice — so any stack/queue idiom (RPN evaluator, BFS drain) was wrong. Root cause: the
execStmt bare-array-mutation statement handlers (`arr.push(x)` / `arr.pop()` as a whole statement, which
write the mutated receiver back via assignTarget) fired for the OUTER `[…].forEach(fn)` statement because the
method marker (`" . push ("` / `" . pop ("`) also appears INSIDE the callback body — so `pv =
substringBefore(stmt, " . push (")` became the truncated `[9].forEach(function(t){ out`, and the handler's
`isArrRef(jsEvalIn(pv))` guard EVALUATED that truncated forEach as a side effect, double-running the body's
push. (Other call forms — IIFE, named fn, arrow-via-var — escaped only because their truncated `pv` happened
to evaluate non-array; forEach's evaluated to a ref, so it fired.) Fixed with two guards on the push/pop
statement handlers, mirroring the forEach handler's own protection: skip when the statement has a top-level
` = ` (it's an assignment RHS like `r.v=s.pop()` — the `=` handler owns it, and evaluating the receiver
would run the assignment as a side effect) and skip when `markerInBody` reports the marker sits inside a
nested function body (the outer call handler owns it). sort/fill/reverse were already protected by their
`isSimpleName(receiver)` guard. Now `out.push(s.pop())` in forEach/map, `map` mutations, `let v=s.pop()`,
RPN evaluation, shift/unshift/splice-in-callback, and nested-forEach grid builds all match Node; bare
`arr.push(x)`/`arr.pop()` and push-return-value are unchanged. New `callbackmutate-diff` fuzzer (1200+ checks:
nested mutating args, RPN, stack/queue drains). Full sweep green (239/239).

**In-callback `++`/`--`/compound-assign + Map/Set forEach scalar write-back (2026-07-24, 111th engine fix).**
Two related callback-mutation gaps. (A) `arr.forEach(x=>{n++})` / `arr.forEach(x=>{o.c+=x})` left `n`/`o.c`
unchanged (returned 0): `memberCompoundRewrite` — the statement-level rewriter that turns `o.c++`→`o.c = o.c
+ 1` — scanned the WHOLE statement with plain `hasSep(s, "++")`, so it found the `++` INSIDE the callback
body and, because the outer `arr.forEach` contains `" . "`, `isMemberTarget` falsely accepted the mangled
LHS → it spliced a bogus top-level `=` across the entire call (`[1].forEach(function(x){ n }) = [1].forEach
(function(x){ n }) + 1`), which `hasTopSep(mcr, " = ")` then mis-executed as an assignment (→0), never
running the real forEach. Fixed by guarding every branch of `memberCompoundRewrite` with `markerInBody` (the
operator must sit at the statement's TOP LEVEL, not inside a nested function/callback body) — the same guard
the forEach/push/pop handlers use. `incDecEnv`/`needsIncDec` were already depth-aware (via `chr(123)` brace
tracking) so only `memberCompoundRewrite` needed it. Now `n++`/`n--`/`o.c++`/`o.c+=x`/conditional `c++`
inside forEach/map callbacks all persist and match Node; top-level `o.c++`/`a[i]++`/`o.n+=5`/nested
`o.a.b++` are unchanged. (B) `map.forEach(v=>{s+=v})` / `set.forEach(v=>{t+=v})` scalar accumulators stayed
0 — Map/Set forEach threaded no env write-back (only object accumulators worked, as shared heap refs), unlike
the 109th's array `forEachEnv`. Added `mapForEachEnv`/`setForEachEnv` (via `callFnIdxEnv3`, whose (el, idx,
arrv) param order matches Map's cb(value, key, map) and Set's cb(value, value, set)) and routed the
statement-level `m.forEach(cb)` / `s.forEach(cb)` to them. Map/Set scalar accumulate/count/max now persist;
object accumulators + key iteration unchanged. New `callbackcompound-diff` fuzzer (1200+ checks: in-callback
inc/dec/compound over arrays + Map/Set accumulation). Full sweep green (240/240). (The GENERAL scalar closure
outside a forEach — `function f(){n++}; f()` — still returns the stale value: that's the deep closure/env-by-
reference keystone requiring heap-boxed scalars, unchanged by this fix.)

**Method call directly on a numeric literal via the double-dot idiom (2026-07-24, 112th engine fix).**
`255..toString(16)` returned "" instead of "ff" (also `10..toString(2)`, `1000000..toLocaleString()`). In
`255..toString`, the FIRST `.` is the number's trailing decimal point (`255.` === 255) and the SECOND `.`
is the member access — but normJs kept a post-digit `.` as part of the number only when the NEXT char was
another digit (`255.5`), so the double-dot fell through and emitted a broken `255 . . toString` (two operator
dots) that couldn't resolve the method. Fixed with one targeted branch: when a `.` follows a digit and the
next char is ALSO a `.`, treat the first as a trailing decimal point (drop it, `255.`→`255`), leaving the
second `.` as the member access → `255 . toString`. Now `N..method(...)` works for toString(radix)/
toFixed/toLocaleString; the spaced `255 .m()`, parenthesized `(255).m()`, decimal `3.14.toFixed()`, and all
ordinary decimal/float parsing are unchanged. New `numdotmethod-diff` fuzzer (600+ checks across the four
call forms). Full sweep green (241/241).

**WeakMap/WeakSet + object-key identity in Map/Set (2026-07-24, 113th engine fix).** Two related gaps. (A)
`new WeakMap()`/`new WeakSet()` were unimplemented — `wm.get(k)` returned NaN. Since our objects are heap
refs whose ref string IS their identity, a WeakMap/WeakSet is faithfully backed by the existing Map/Set
machinery for all object-key usage (get/set/has/delete/add): added `new WeakMap (`/`new WeakSet (`
constructors routing to `newMap()`/`newSetFrom()`, so the Map/Set method dispatch (via isMap/isSet) carries
them. (B) A pre-existing bug this exposed: Map/Set with distinct OBJECT keys collapsed to one entry — `new
Map(); m.set({},"x"); m.set({},"y")` gave size 1, both `get` returning "y". `mapKeyIdx` compared
`materialize()`d keys, so every `{}` became "[object Object]" and merged. Fixed: object/array keys (heap
refs) now compare by REFERENCE identity (the raw ref string carries a unique id — two distinct `{}` are
different keys), while primitive keys still compare by value (materialize). Now WeakMap/WeakSet get/set/has/
delete/add, WeakMap-as-memo-cache, and Map/Set with distinct object keys all match Node; primitive-key Maps/
Sets (string/number keys, NaN, dedup, forEach, size) are unchanged. New `weakmap-diff` fuzzer (800+ checks).
Full sweep green (242/242). (WeakMap/WeakSet iteration semantics — they're intentionally non-iterable in
spec — are not enforced since they reuse Map/Set storage.)

**Map/Set primitive-key type distinction (2026-07-24, 114th engine fix — close-out on the 113th's
mapKeyIdx).** A Map keyed by both a number and the same-looking string — `m.set(1,"a"); m.set("1","b")` —
merged them into one key (both `get`→"b", size 1). JS Map uses SameValueZero with NO coercion, so `1` and
`"1"` (and `true`/`"true"`, `null`/`"null"`, …) are distinct keys. mapKeyIdx's primitive path compared
`materialize()`d values, and a number and a string with the same digits materialize identically. Fixed by
gating the value comparison on matching string-ness (`startsWith(k, tagStr())` equal on both) — a string key
and a non-string key never match even with equal materialized text. Now `1`≠`"1"`, `true`≠`"true"` as Map/
Set keys and sizes are correct; equal-type keys (string==string, number==number, NaN==NaN) and object-
identity keys are unchanged. Extended `weakmap-diff` fuzzer with the number-vs-string case. Full sweep green
(242/242). (A BigInt `1n` vs number `1` edge remains — both non-string, so still merges — but BigInt Map
keys are vanishingly rare.)

**Object.keys/values/entries on arrays & strings + string-numeric array indexing (2026-07-24, 115th engine
fix).** Two composing gaps. (A) `Object.keys([10,20,30])` / `Object.values(...)` / `Object.entries(...)` (and
on strings) returned [] — they routed through objEntrySeq, which is empty for a non-object. Now an array or
string is treated as an index-keyed collection: keys → STRING indices `["0","1","2"]` (per spec, unlike
`arr.keys()`'s numbers — verified `Object.keys(a)[0]==="0"`), values → the elements/chars, entries →
`[stringIndex, element]` pairs; plain objects are unchanged. (Arrays are dense here — a sparse `[1,,3]` yields
all three indices rather than skipping the hole, since holes aren't tracked.) (B) That exposed a companion
bug: `a["0"]` / `a[k]` (a string-numeric index) returned undefined, because the array bracket path fed the
tagStr-tagged index straight to parseInt without materializing it (the object-property path already
materialized). Fixed to `parseInt(materialize(...))`, so `a["0"]===a[0]` and `Object.keys(a).forEach(k=>…a[k]…)`
work; numeric indexing is unchanged. New `objkeysarray-diff` fuzzer (800+ checks). Full sweep green (243/243).
(Separate pre-existing gap, not addressed: an arrow with an EXPRESSION body that is an assignment side-effect
— `forEach(k=>s+=k)` — doesn't write back, because compound/plain assignment in expression position doesn't
mutate the env; the block-body form `forEach(k=>{s+=k})` works.)

**Chained assignment `a = b = c` (2026-07-24, 116th engine fix).** A right-associative assignment chain set
only the LEFTMOST target: `a=b=7` gave a=7 but left b undefined; `a=b=c=9`, `x=y=10`, `o.x=o.y=5`,
`let y=x=5` all failed the same way. The RHS `b = 7` was evaluated as an expression (yielding 7) without
mutating b — assignment in expression position doesn't thread env changes back in the value-threaded env
model. Fixed at the two assignment surfaces: when the RHS of an assignment statement (execStmt's ` = `
handler) or a let/const/var initializer (bindOne) itself contains a top-level ` = `, execute that RHS as a
statement first (setting the inner target), then assign the outer target to the inner target's value —
recursively, so `a=b=c=9` threads all the way down. The check is depth-aware (hasTopSep), so comparisons
(`==`/`===`, which tokenize as ` == `/` === `) and a `=` inside parens/arrows (`f(a=5)`, `()=>x`) don't trip
it. Scalar chains, member/bracket chains (`o.x=o.y=v`, `arr[i]=arr[j]=v`), and let-initializer chains
(`let y=x=5`) now match Node; simple/compound/ternary/fn-literal assignments are unchanged. New
`chainassign-diff` fuzzer (800+ checks). Full sweep green (244/244). (The general assignment-in-expression-
position case — a nested `let y=(x=5)` or arrow-expr `k=>s+=k` — is still open; only the top-level chain
forms are threaded here.)

**`super.method()` from a child method + engine-internal-key filtering in Object.keys (2026-07-24, 117th
engine fix).** `super.method(...)` in a non-constructor method returned NaN — only `super(...)` in a
constructor was wired (`__super__`). Now classWalk stores each class's own methods under
`this.__msuper_<C>_<m>` (in addition to `this.<m>`), which survives a subclass overriding `this.<m>`, and
rewrites `super . M (` in a child's method bodies to `this . __msuper_<parent>_M (` (the parent is known at
desugar time; `this`-binding falls out because it's an ordinary method call on the instance). `super.M()`
now works with arguments, through multi-level chains (`C→B→A`), alongside `this`, and with polymorphic
dispatch (a parent method calling `this.overridden()` reaches the child's override). Those `__msuper_`
records — and the existing `__get_`/`__set_` accessor records and `__proto_` legacy-prototype members —
would otherwise leak through `Object.keys`/`values`/`entries`, so added an internal-key filter
(`objEntrySeqPublic`): keys with those reserved engine prefixes are dropped, while a real user `__foo` key
and ordinary object methods are preserved. This also fixes a pre-existing `__get_` leak (`Object.keys` of a
getter class now matches Node). New `supermethod-diff` fuzzer (800+ checks). Full sweep green (245/245).
(Known pre-existing, still open — deeper model issue: a class instance's own METHODS still appear in
`Object.keys` — `class C{m(){}}`→`["m",…]` vs Node `[…]` — because our model stores methods as own props
rather than on a prototype; distinguishing them from legitimate plain-object methods needs instance marking
or a prototype model. `super.method` is unaffected by this — it uses the filtered `__msuper_` records.)

**Arrow with an assignment expression body — `x => s += x` (2026-07-24, 118th engine fix).** An arrow whose
expression body is an assignment didn't mutate its target: `arr.forEach(x => s += x)` /
`Object.keys(a).forEach(k => s += a[k])` left `s` at 0. buildArrow wrapped an expression body as
`return <body>`, so `s += x` was evaluated as an expression (yielding the value) without writing s — the
assignment-in-expression-position limitation. Fixed: when the body's top-level operator is an assignment
(`=`/`+=`/`-=`/`*=`/`/=`/`%=`/`**=`/`&&=`/`||=`/`??=`, depth-aware so a `=` in parens or a comparison
`==`/`===` never matches) AND its lhs is a simple name or member/index target, the body is emitted as the
mutating STATEMENT plus `return <lhs>` — so the write happens (and a forEach callback's env write-back
persists a scalar/member accumulator) while the arrow still yields the assigned value. A ternary/comparison/
plain-value body stays a plain `return` (unchanged), so `map`/`filter`/`reduce` arrows are unaffected. Now
`forEach(x=>s+=x)`, `forEach(x=>o.t+=x)`, `forEach(x=>last=x)`, and the earlier probe-35 RED
`Object.keys(a).forEach(k=>s+=a[k])` all match Node. New `arrowassign-diff` fuzzer (800+ checks). Full sweep
green (246/246). (A `map(x=>s+=x)` still won't persist the OUTER s — map has no env write-back — but its
returned running-sum values are now correct; the general nested `let y=(x=5)` remains the deeper case.)

**Custom Error subclasses — `class X extends Error { super(m) }` (2026-07-24, 119th engine fix).** A class
extending a built-in error left `.message` undefined: `class E extends Error{constructor(m){super(m)}}` →
`new E("x").message` was undefined (and the implicit-ctor form `class E extends Error{}` too). The
`__super__` handler ran `callMethod(env["Error"], …)`, but `Error` is a builtin with no env binding, so the
super() call was a silent no-op. Fixed: when `__super__`'s parent is a built-in error type (Error/TypeError/
RangeError/SyntaxError/ReferenceError/EvalError/URIError), it now sets `this.name` = the type and
`this.message` = the first super() argument (evaluated) via the same `assignTarget` path `this.f = v` uses —
so a same-constructor `this.name = "..."` override afterwards still wins (runs after super), and the message
can be any expression (`super(f+" invalid")`). Custom error classes now carry their message through
`new`/`throw`/`catch`, `.name` defaults to the base type, extra own fields coexist, and `instanceof` still
holds; user-class `super(...)` (non-error parent) is unchanged. New `errorsubclass-diff` fuzzer (800+
checks). Full sweep green (247/247).

**JSON.parse now throws SyntaxError on malformed input (2026-07-24, 120th engine fix).** `JSON.parse` was
lenient — `JSON.parse("{bad}")` / `"[1,2,"` / `"undefined"` silently returned a partial/garbage value
instead of throwing, so `try { JSON.parse(untrusted) } catch {…}` never caught anything. Added a validator
(`jsonValid`) that scans the raw text and requires exactly one well-formed value spanning the whole input
(after trimming whitespace); on failure the dispatch throws a `SyntaxError`. A subtlety that first produced
false positives: the materialized JSON text carries ENCODED delimiters (`encBraceL`/`encBraceR`/`encBrkL`/
`encBrkR`/`encQuote`) and encoded whitespace (`encSpace`/`encNewline`), not raw `{`/`"`/space — the scanners
and whitespace-skipper were corrected to accept BOTH — the encoded forms a source string literal carries AND
the RAW `{`/`"`/`[` that `JSON.stringify`'s runtime output uses, so `JSON.parse(JSON.stringify(x))` round-
trips. Numbers are scanned leniently (a digit-requiring run), which
is deliberately safe: it never REJECTS valid JSON (no false positive on working input), it only lets a few
exotic malformed numbers through. Now objects/arrays/strings/numbers/booleans/null, nested, and whitespace-
padded/spaced JSON all still parse, while unquoted keys, trailing/double commas, unterminated structures,
missing values, and `undefined`/`NaN`/empty input throw SyntaxError — matching Node. New
`jsonparsevalid-diff` fuzzer (700+ checks: valid round-trips + malformed-throws). Full sweep green (248/248).
(Separate pre-existing, untouched: `JSON.parse('"a\\"b"')` keeps the backslash — jsonParse's string
UNESCAPING doesn't resolve `\"`/`\n` inside a parsed string; the validator correctly accepts such input.)

**JSON.parse resolves string escapes (`\"`, `\\`, `\/`, `\b`) (2026-07-24, 121st engine fix — follows the
120th).** A parsed JSON string kept its escape sequences literally — `JSON.parse('"a\"b"')` returned `a\"b`,
not `a"b`, and an escaped quote inside a structure (`{"q":"say \"hi\""}`) additionally broke parsing because
the structural splitter treated the `\"` as a string close. Fixed two places: jsonParse now unescapes a
parsed string's content, and jsonSplitTop skips an escaped char (encBackslash/`\` + next) while scanning, so
an escaped quote no longer ends the string mid-value. Only the WHITESPACE-free, non-separator escapes are
resolved — `\"`→`"`, `\\`→`\`, `\/`→`/`, `\b` — which covers the common quote/backslash cases (incl.
`O"Brien`, `say "hi"`, Windows paths) at top level and inside objects/arrays, and stringify→parse round-
trips. The whitespace escapes `\n`(chr10)/`\t`(chr9)/`\r`(chr13)/`\f`(chr12) are deliberately left intact:
chr10 is the object/array entry separator, chr12 the env-value escape, and a trailing chr9/chr13 gets
whitespace-trimmed out of a value — materializing them corrupts the value (a pre-existing representation
limit that even a plain `{a:"x\ny",b:2}` literal exhibits by dropping `b`). New `jsonstringesc-diff` fuzzer
(800+ checks over the safe escapes). Full sweep green (249/249). (Full `\n`/`\t` support needs the deeper
value-representation work so a string value can carry the separator/whitespace bytes.)

**charCodeAt/codePointAt over a newline returned 31 not 10 (2026-07-24, 122nd engine fix).** A string value
stores its newline internally as `encNewline`(chr31) — so it doesn't act as a statement separator — but
`charCodeAt`/`codePointAt` read that raw internal byte, so `"x\ny".charCodeAt(1)` returned 31 instead of 10
(breaking the common `.charCodeAt(i) === 10` newline scan). Fixed by decoding the receiver (`decodeStr`,
which maps `encNewline`→chr10 and is a no-op on already-raw bytes like space/tab) before the character read.
Now the newline char code is 10, the `for … charCodeAt(i)===10` count is correct, and plain ASCII / space /
tab char codes are unchanged. New `charcodenewline-diff` fuzzer (800+ checks). Full sweep green (250/250).
(This is the safe, number-returning slice of the broader `encNewline` value-representation issue — the
inline expression leak `o.a.length + o.b` when `o.a` holds a newline, and multi-line string values inside
objects, still need the core-evaluator representation work; a non-ASCII char code like `"café".charCodeAt(0)`
is the separate unicode-UTF-16 keystone, unaffected here.)

**The legacy `arguments` object was unbound (2026-07-24, 123rd engine fix).** Inside a regular function
`arguments` didn't exist — `typeof arguments` was "number" and `arguments.length` returned garbage. Now
callFn binds `arguments` to an array of the call's argument values, so `arguments.length`, `arguments[i]`,
the classic `for (i<arguments.length)` loop, spread `[...arguments]`, and `Array.from(arguments)` all work,
including mixing named params with `arguments`. Guarded: `arguments` is bound ONLY when the function body
references it, so ordinary functions pay nothing — and because callFn already receives evaluated argument
values (not the raw expressions), building the array re-runs no side effects, so even an arguments-using
function called with a side-effecting argument runs it exactly once (verified: `au(g())` runs `g` once, like
Node). Plain calls, rest params, defaults, destructuring params, and arrows are unchanged. New
`argumentsobj-diff` fuzzer (800+ checks). Full sweep green (251/251). (Separate, not addressed: `arguments`
is a real array here rather than a distinct arguments-exotic object, and `Array.prototype.slice.call
(arguments)` needs `.call()` on a prototype method — a different feature.)

**Function.prototype.call / .apply were unimplemented (2026-07-24, 124th engine fix).** `f.call(thisArg,…)`
and `f.apply(thisArg, argsArray)` weren't recognized at all — they fell through to garbage. Added `.call`/
`.apply` to the method dispatch list and handlers that route to `callMethod` (which binds `this` + params):
`.call(thisArg, a, b)` binds `this`=thisArg and passes `a, b`; `.apply(thisArg, [a, b])` spreads the array's
element VALUES the same way (jsEvalIn is idempotent on values, so no re-eval). The handlers only fire for a
real function value (a `chr(1)` function) — a non-function receiver is left untouched, so no ordinary method
call is affected. Also threaded `arguments` binding into `callMethod` (it previously only lived in `callFn`),
so a call/apply'd function that uses `arguments` works. Now `f.call(obj)`/`f.call(obj,a,b)`/`f.apply(null,
[a,b])`, borrowing a method via `.call`, and arguments inside a call/apply'd function all match Node; class
methods, getters/setters, `super.method()`, and plain calls are unchanged. New `callapply-diff` fuzzer (800+
checks). Full sweep green (252/252). (Not addressed: `.call`/`.apply` on a NATIVE/prototype function — e.g.
`Math.max.apply(null, arr)` or `Array.prototype.slice.call(...)` — needs native-function dispatch; `.bind`;
and `map(fn, thisArg)`'s 2nd-arg this — separate features.)
