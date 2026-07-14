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

### BUG-12 · BUN · REPRODUCED + OUR PORT IS CORRECT (2026-07-14)
**Update:** the campaign's thesis, demonstrated concretely. `Bun.semver.satisfies("2.0.0",
">1.0.0 3.0.0")` returns **true** (bun DROPS the trailing `3.0.0` exact-version conjunct);
node-semver and our LOGOS port both return the correct **false** (the set is `>1.0.0 AND =3.0.0`;
2.0.0 fails `=3.0.0`). **The reimplementation is more correct than the original.** Pinned as a
regression lock in `fuzz/semver/satisfies-diff.mjs`. **Tweet:** Ported bun's semver to LOGOS and
found it's *more* correct than bun: `satisfies("2.0.0", ">1.0.0 3.0.0")` — bun says yes (it drops
the `3.0.0` requirement!), our rewrite + node-semver say no. Verified against both.

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

---

_Live count: 27 (⭐×6 BUN [semver + 5 TOML], 13 toolchain [**8 FIXED**, 1 open + BUG-11 recurring],
8 ours [all fixed]). bun's JSON parser fuzzed CLEAN (4000 edge cases, 0 diffs — spec-correct).
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
grammar (`* ? [...] **`) is LOGOS-native; only brace expansion `{a,b}` remains. Remaining toolchain
gaps: cross-module functions (BUG-24), atomics (install parallelism), BUG-11 preamble robustness.
**Next: P1.3 bunfig (pure-.lg TOML parser — also lets us NOT replicate bun's 5 TOML bugs), or the
BUG-24/BUG-11 toolchain fixes, or glob brace expansion.**_
