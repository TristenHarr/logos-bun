# PORTING_RUST_TO_LOGOS.md — the bun→LOGOS idiom map

STATUS: FROZEN 2026-07-13 — post-review; edits require an incident.

The frozen pattern map: how bun's source idioms render as LOGOS idioms. A porter reads
this and knows exactly how to render each construct. Every LOGOS syntax claim traces to a
real citation. Where a construct is unproven against real LOGOS code it is marked
**UNVERIFIED — porter must confirm**; do not treat those as license to invent syntax.

Post-freeze edits require the incident path (§6.3). This is a reference, not a gate; PORT.3
validates it against a real port.

---

## 0. Read this first — the ground truth

**0.1 bun's source is Rust.** The port source at `/home/tristen/logicaffeine/bun` (commit
`43ee038`, `v1.4.0-dev`) is **1516 `.rs` files** (`src/install` ~80K LOC, `src/js_parser`
~47K LOC, …). This is the Rust rewrite of bun; the thesis of this campaign is **Rust →
LOGOS**. An earlier pass of this document was grounded in a Zig snapshot — that was the
wrong source. Every "bun shape" column below now cites a real **`.rs`** snippet
(`file:line`). A porter reading a `.rs` file is reading the real thing: you will see
`Result<T,E>`, `?`, `Option<T>`, `Box`, `Rc`/`Arc`, `impl Trait`, `dyn`, traits, const
generics, and `&[u8]` slices — **not** Zig's `!T`, `orelse`, `catch`, `comptime`.

**The headline consequence: the Rust rewrite is CLOSER to LOGOS in three places and
FARTHER in one.**
- **Closer:** Rust's `Result`/`Option` are real *typed sum types* — they map to LOGOS
  payload-enums and the built-in `Option` almost 1:1 (§1). Rust's `trait` mechanism is a
  real nominal interface — it maps to LOGOS generics + enum-dispatch far more legibly than
  Zig's comptime duck-typing did (§4). Rust `enum`s with data ARE tagged unions expressed
  in the type system — they map straight to `## X is one of:` (§5).
- **Farther (the #1 friction):** Rust's **`?` operator** has **no LOGOS analog**. bun's
  Rust uses `?` pervasively for early-return-on-error/absence; LOGOS has no `try`, no
  `catch`, no `?`. Every `?` becomes an explicit `Inspect` / `If … Return …` at the call
  site (§1.4). Budget for this on every fallible function you port.

**0.2 The LOGOS `(proposed)` trap.** `vendor/logicaffeine/LOGOS_QUICKGUIDE.md` marks some
forms **(proposed)** = designed, not yet implemented. This document only asserts forms that
appear in **real passing LOGOS code** (the test corpus and the two `.lg` stdlib modules).
Where the QUICKGUIDE says "(proposed)" but the corpus proves it works today, this document
uses the corpus as ground truth and says so (e.g. Text `+` concatenation — QUICKGUIDE marks
it proposed, but `e2e_language_gaps.rs:143` and `uuid.lg:543` use it). When in doubt, grep
the corpus before writing.

**Citation convention.** LOGOS paths are relative to `vendor/logicaffeine/`. bun paths are
relative to the Rust source root `/home/tristen/logicaffeine/bun/` (i.e. `src/...`). Both
trees are read-only. The bun-Rust citations below were verified at commit `43ee038`; a
reviewer re-greps against that pin.

---

## 1. Result / Option / error plumbing — where Rust maps CLEANEST, except `?`

### 1.1 The core LOGOS finding: NO `Result`/`Ok`/`Err`, NO `try`/`catch`, NO `?`

Verified by exhaustive corpus search: there is no native `Result`, `Ok`, `Err`, `try`,
`catch`, `throw`, `?`, or `panic`-as-value in LOGOS programs. Error handling is one of four
mechanisms below. **This is the single most important thing to internalize.** Unlike the
Zig source (which used `!T`/`orelse`/`catch`), bun's Rust uses `Result<T,E>` + `?` and
`Option<T>` + `?`/`ok_or` everywhere — and those constructs are exactly the ones LOGOS
lacks a keyword for. You cannot mechanically transliterate a `?`. You must choose a target
idiom per call site.

### 1.2 bun (Rust) error shapes

| bun shape | Real citation |
|-----------|---------------|
| Typed error enum (`thiserror`) | `#[derive(thiserror::Error, …)] pub(crate) enum SplitNameError { #[error("MissingVersion")] MissingVersion }` — `src/install/dependency.rs:522-526` |
| Fallible return | `pub(crate) fn split_name_and_version(str: &[u8]) -> Result<(&[u8], &[u8]), SplitNameError>` — `src/install/dependency.rs:528` |
| `?` on an `Option` → early-return the error | `Ok((name, version.ok_or(SplitNameError::MissingVersion)?))` — `src/install/dependency.rs:530` |
| `?` chain on `Result` (I/O / serialization) | `writer.write_int_le::<u64>(bytes.len() as u64)?; … writer.write_all(bytes)?;` — `src/install/npm.rs:974-978` |
| Fallible return with crate error | `-> Result<Dependency, crate::Error>` — `src/install/dependency.rs:89,210` |
| Per-crate rich error enum | `#[derive(…, thiserror::Error)] pub enum Error { #[error("FileNotFound")] …, #[error("InvalidUtf8")] …, #[error("TarballHTTP400")] … }` — `src/install/error.rs:1-35` |
| Absent value (`Option<T>` return) | `fn parse_ascii(s: &[u8]) -> Option<Self>` — `src/semver/Version.rs:24`; `-> Option<Version>` — `src/install/dependency.rs:296` |
| `Result → Option` discard error | `bun_core::parse_unsigned::<u64>(s, 10).ok()` — `src/semver/Version.rs:36` |
| `Option → default` | `version.unwrap_or(b"latest")` — `src/install/dependency.rs:519`; `.unwrap_or_default()` — `src/install/dependency.rs:242,716` |
| `let-else` early return on `None` | `let Some(second) = strings::index_of_char(&str[1..], b'@') else { return (str, None); };` — `src/install/dependency.rs:499-501` |

### 1.3 LOGOS renderings

**(a) Fallible result → a user-defined payload enum** (the direct analog to Rust
`Result<T,E>` / `thiserror` enums). Define your own; it is not built in.
```
## A Result is one of:
    A Success with value Int.
    A Failure with msg Text.
```
— `e2e_async_cross_cutting.rs:156` (VERIFIED). Also written `is either` with parenthesized
fields: `A Success (value: Int).` / `A Failure (message: Text).` — `phase33_enums.rs:174`
(VERIFIED — both `is one of` and `is either` parse; corpus: 122× `is one of`, 58× `is
either`). This maps `Result<Dependency, crate::Error>` and the `thiserror` enums directly:
the Rust `enum Error { FileNotFound, InvalidUtf8, … }` becomes a payload-free
`## An Error is one of: A FileNotFound. An InvalidUtf8. …`, and the `Ok(T)/Err(E)` wrapper
becomes your own two-variant `Result`-shaped enum.

Consume it with `Inspect`/`When` (§5):
```
Inspect r:
    When Success (v): Show v.
    When Failure (m): Show m.
```
— `e2e_async_cross_cutting.rs:167` (VERIFIED).

**(b) Absent-value → the built-in `Option`.** `some X` / `none`, return type `Option of T`:
```
## To findAge (name: Text) -> Option of Int is exported:
    If name = "Alice" then:
        Return some 30.
    Otherwise:
        Return none.
```
— `phase_ffi_requires.rs:1060` (VERIFIED). Matched with `When OptionSome (v):` /
`When OptionNone:` (QUICKGUIDE §9, `phase_futamura.rs` uses the `COptionSome` constructor
form). **This maps bun's `Option<T>` / `-> Option<Version>` 1:1** — the cleanest of all the
Rust→LOGOS mappings.

**(c) Precondition contracts** — for "this must hold or the program is wrong" (bun's
`panic!`/`unreachable!`/`debug_assert!`/`.expect("infallible: …")` sites, where the Rust
comment itself says the condition is a proven invariant, e.g.
`src/install/dependency.rs:341` `.try_into().expect("infallible: size matches")`):

| LOGOS | Meaning | Citation |
|-------|---------|----------|
| `Check that <cond>.` | mandatory security/validity gate | `e2e_feature_matrix.rs:786` (VERIFIED) |
| `Assert that <cond>.` | debug assertion (panics on failure) | `e2e_language_gaps.rs:302` (VERIFIED) |
| `Trust that <cond> because "<reason>".` | developer-justified precondition, carries a reason | `native_pe_wire.rs:278` (VERIFIED) |

`Trust that … because "…"` is the natural home for bun's `.expect("infallible: …")` and
`// SAFETY: …` invariants: it carries the justification string, mirroring the Rust comment.

**(d) `native` FFI decls have no error channel in the `.lg` surface** — a `## To native f`
declares a kernel that returns its type directly (`crypto.lg:120` `## To native mlkemNtt (a:
Seq of Int) -> Seq of Int`). Fallibility, if any, lives in the Rust/native kernel, not the
LOGOS signature. (This is exactly bun's `unsafe extern` / FFI-boundary pattern, e.g.
`src/bun_core/string/mod.rs:75` `fn BunString__fromLatin1(…) -> String;`.)

### 1.4 Porter decision rule (mechanical)

1. bun `Option<T>` (return, `.ok_or`, `.map`) → LOGOS `Option of T` with `some`/`none`.
   (Cleanest 1:1 — the built-in `Option` matches.)
2. bun `Result<T, E>` where the caller inspects the error → define a `Result`-shaped
   payload enum (1.3a) mirroring the `thiserror` variants and `Inspect` it.
3. bun `panic!` / `unreachable!` / `debug_assert!` / `.expect("invariant")` where a bad
   value means "programmer error, abort" → `Check that …` / `Assert that …` / `Trust that …
   because "…"`.
4. bun `.unwrap_or(d)` / `.unwrap_or_default()` → an `If` guard or `Inspect … Otherwise`
   that produces the default.

**GOTCHA — there is no `?` operator (THE top friction of the whole port).** Every bun
`foo()?` / `bar.ok_or(E)?` / `writer.write_all(x)?` early-return-on-error must be rewritten
as an explicit `Inspect` on the `Option`/`Result`-enum (bind the error, `Return` it) or an
`If … Return …` at the call site. A function like
`clone_with_different_buffers` (`src/install/dependency.rs:214`), which threads several `?`
through a builder, becomes a sequence of `Inspect`/`Return` steps — one per `?`. Count the
`?` and `.ok_or(…)?` in a function before you port it; that count is your rewrite budget.
The `grep -c '?;'` over `src/install/npm.rs` (42 sites in one file) is a good calibration of
how pervasive this is.

---

## 2. Ownership (Box / Rc / Arc / lifetimes / arenas)

### 2.1 bun (Rust) shapes

Rust bun is ownership-and-borrow with real lifetimes, `Box`/`Rc`/`Arc`, `ManuallyDrop`, and
`Drop`, layered over the same *string-arena-beside-a-slice* pattern the Zig source used.
Real shapes:
- Borrowed slice into a caller-owned buffer: `&[u8]` everywhere (e.g. `fn sort_gt(ctx:
  &[u8], lhs: Self, rhs: Self) -> bool` — `src/semver/Version.rs:106`); the `ctx`/`buf`
  string arena is threaded by hand as a `&[u8]` parameter.
- The `SlicedString` arena pair survives verbatim: `pub struct SlicedString<'a> { pub buf:
  &'a [u8], pub slice: &'a [u8] }` — `src/semver/lib.rs:87-91`. `buf` is the whole arena,
  `slice` is the view into it; a `debug_assert` even checks `buf` precedes `slice`
  (`src/semver/lib.rs:98-100`).
- Clone into a target buffer: `pub fn clone_into(self, slice: &[u8], buf: &mut &mut [u8]) ->
  Self` — `src/semver/Version.rs:122`; the builder-threaded variant returns a fresh value:
  `fn clone_in<SB: StringBuilderLike>(…) -> Result<Version, crate::Error>` —
  `src/install/dependency.rs:632-642`.
- Heap indirection + manual drop for a tagged union arm: `pub npm: ManuallyDrop<NpmInfo>`
  inside `pub union DependencyVersionValue` — `src/install_types/resolver_hooks.rs:419-431`;
  the doc-comment notes the `npm` arm "owns a `Box` linked list … `git`/`github`
  (`Repository`) hold no heap data" (`:414-417`), with `Drop`/`Clone` dispatching on `.tag`.
- Trait object behind a reference (shared/dynamic behavior, Rust's `dyn`): `Some(m as &mut
  dyn NpmAliasRegistry)` — `src/install/dependency.rs:240,714`.

### 2.2 LOGOS model: value semantics + explicit `copy` + arena zones

LOGOS structs and collections are **value-semantic** (imperative-mode.md §"Ownership &
borrowing"). LOGOS tracks ownership; use-after-move is a compile error caught by the
ownership analysis (`analysis/ownership.rs`). There is no `Box`/`Rc`/`Arc`/`&`/lifetime
surface.

| bun intent | LOGOS rendering | Citation |
|-----------|-----------------|----------|
| Explicit clone (`clone_into`, `clone_in`, `.clone()`) | `copy of xs` | imperative-mode.md §Ownership (VERIFIED); QUICKGUIDE §5.2 |
| Heap indirection (`Box<T>`, `ManuallyDrop<T>`) | just hold the value; structs are value-semantic | imperative-mode.md §Ownership |
| Borrowed slice param (`buf: &[u8]`) | pass the `Seq`/`Text` as a value parameter; no lifetime, no borrow | pattern, not a single citation |
| Shared/aliased state (`Rc`/`Arc`, `&mut dyn`) | **no direct analog.** For cross-agent sharing use the CRDT/`Shared` surface (`A Counter is Shared and has:` — QUICKGUIDE §12); otherwise pass by value + `copy`. |
| Arena / scratch allocator (`MimallocArena`, the AST arena) | `Inside a zone called "Scratch":` (scoped arena) | QUICKGUIDE §12 (UNVERIFIED against corpus — porter must confirm the zone body syntax) |

**GOTCHA — value semantics is a trap class (SEMANTIC_TRAPS).** bun mutates through a `&mut`
slice or a `&mut &mut [u8]` builder buffer that aliases a caller's arena; the LOGOS
equivalent copies. Two consequences:
1. Where bun relies on in-place mutation through `&mut` being visible to the caller, LOGOS
   is NOT — you must `Return` the mutated value and rebind. See `uuid.lg:29` `stampBytes`:
   it does `Let mutable out be raw.` then mutates `out` and `Return out.` — it does not
   mutate `raw` in place. (VERIFIED) bun's `clone_into(self, slice, buf: &mut &mut [u8])`
   pattern — write-through-the-out-buffer — becomes "build a fresh value and `Return` it,"
   exactly as `clone_in` (`src/install/dependency.rs:632`) already does on the Rust side by
   returning a new `Version`.
2. Struct field writes are copy-on-write; a struct passed to a function and mutated there
   does not affect the caller's copy unless returned.

**GOTCHA — the `SlicedString { buf, slice }` idiom disappears.** bun's `SlicedString<'a> {
buf: &'a [u8], slice: &'a [u8] }` (a string view plus the arena it points into,
`src/semver/lib.rs:87`) has no LOGOS analog and no need for one: a LOGOS `Text`/`Seq` owns
its bytes. When you see `sliced.slice` / `x.slice(buf)` calls in bun, the LOGOS side is just
the `Text`/`Seq` directly. Do not port the `'a` lifetime or the buffer-threading — the whole
`buf`/`slice`/`&mut &mut [u8]` machinery collapses to a single owned value.

**GOTCHA — `ManuallyDrop` + the untagged `union` is a bun-internal ABI trick, not
semantics.** `DependencyVersionValue` is a raw `union` with the discriminant held separately
in `.tag` *only because the lockfile binary layout demands it* (`resolver_hooks.rs:413-417`).
Port the *logical* tagged union (§5), a `## X is one of:` — do NOT try to reproduce the
`union` + `ManuallyDrop` + tag-blind-clone-would-double-free machinery. LOGOS enums are
tagged automatically.

---

## 3. Slices & iterators

### 3.1 bun (Rust) shapes

- Slice type / subslice: `&[u8]`; `&str[at_index + 1..]` (`src/install/dependency.rs:492`);
  `&bytes[0..byte_i as usize]` (`src/semver/Version.rs:696`).
- Index-of / search via the SIMD toolkit: `strings::index_of_char(str, b'@')` returns
  `Option<u32>` (`src/install/dependency.rs:486`); `bun_core::strings::index_of` returns
  `Option<usize>` (per `src/CLAUDE.md`). Consumed with `if let Some(i) = …` / `.ok_or(…)?`.
- **Two iteration styles coexist:** hot byte-parsing loops use index/`while` loops (`for j
  in 0..version.len()` — `src/semver/Version.rs:248`; `while i < input.len()` — `:514`),
  matching the esbuild reference for the parser; higher-level code uses **real iterator
  combinator chains**: `props.iter().map(|prop| { (prop.key.as_ref().and_then(...),
  prop.value.as_ref().and_then(...)) })` — `src/install/bin.rs:216-221`;
  `(0..next_package_id).map(|_| Vec::new()).collect()` — `src/install/yarn.rs:1414`;
  `.map(|v| v.iter().map(|z| z.as_ptr()…).collect())` — `src/install/PackageManager.rs:2225`;
  `for (i, &c) in dependency.iter().enumerate()` — `src/install/dependency.rs:381`.

### 3.2 LOGOS renderings — `Seq` + `Repeat` + `Push` is the workhorse

| bun intent | LOGOS canonical | Citation |
|-----------|-----------------|----------|
| Empty list (`Vec::new()`) | `a new Seq of Int` (also `List`/`Vec`) | `uuid.lg:167` (VERIFIED) |
| List literal | `[1, 2, 3]` | imperative-mode.md §Collections (VERIFIED) |
| Pre-sized (`Vec::with_capacity`) | `a new Seq of Int with capacity n` | QUICKGUIDE §5.1 (UNVERIFIED — porter confirm) |
| Index read (**1-based**) | `item i of xs` (also `xs[i]`) | `uuid.lg:32,46` (VERIFIED) |
| Index write | `Set item i of xs to v` | `uuid.lg:31` (VERIFIED) |
| Subslice (**inclusive both ends**) | `items a through b of xs` | `e2e_collections.rs:76,169` (VERIFIED) |
| Length (`.len()`) | `length of xs` | `uuid.lg:179` (VERIFIED) |
| Append (`.push`) | `Push v to xs.` | `uuid.lg:168` (VERIFIED) |
| Pop | `Pop from xs.` / `Pop from xs into y.` | QUICKGUIDE §5.3 (UNVERIFIED — corpus confirm) |
| Concatenate two Seqs | `a followed by b` | `crypto.lg:806,840`; `uuid.lg:410` (VERIFIED) |
| For-each (`for x in xs`) | `Repeat for x in xs:` | `uuid.lg:182,215` (VERIFIED) |
| Counted (`for i in a..b`, **note bounds**) | `Repeat for i from A to B:` (**inclusive** upper) | `uuid.lg:187,203,413` (VERIFIED) |
| Enumerate (`.iter().enumerate()`) | `Repeat for i from 1 to length of xs:` + `item i of xs` | pattern (see 1-based gotcha) |
| Pairs over a Map | `Repeat for (k, v) in m:` | QUICKGUIDE §5.4 (UNVERIFIED — corpus confirm) |
| Membership (`.contains`) | `xs contains v` (also `v in xs`) | QUICKGUIDE §5.2 |

**The iterator-combinator reality (critical for porters):** `map` / `filter` / `reduce` /
`sum` / `sort` / `any` / `all` / `collect` as LOGOS method calls or comprehensions are all
marked **(proposed)** in QUICKGUIDE §4/§5.4 and do **not** appear in the corpus.
**Mechanical rule: desugar every Rust `.iter().map().collect()` / `.filter()` / `.fold()`
chain to `Repeat` + `Push`.** This is exactly how the stdlib does it. Canonical map/build:
```
Let mutable out be a new Seq of Int.
Repeat for word in h:
    Let v be intOfWord32(word).
    Push v % 256 to out.
```
— `uuid.lg:214-220` (VERIFIED). filter = `Repeat` + `If … Push`; `reduce`/`sum`/`fold` =
`Let mutable acc be 0.` + `Repeat … Set acc to acc + …`. bun's `bin.rs:216`
`props.iter().map(|prop| (key, value))` becomes a `Repeat for prop in props:` loop that
`Push`es a constructed pair per iteration.

**GOTCHA — there is NO usable `sort` primitive (blocks P2 semver + the install resolver).**
`sort` / `xs sorted` / `xs.sort()` are marked **(proposed)** in QUICKGUIDE §5 (`LOGOS_QUICKGUIDE.md:137`,
"new builtins") and do NOT work at the current pin. This is not a cosmetic gap: bun's install
resolver picks the max-satisfying version by sorting candidates with the `sort_gt` comparator
(`src/semver/Version.rs:106`), which is exactly the code the first real port (P2 semver) must
render. **Two options, both grounded in this doc:** (a) a ported resolver **hand-writes
selection sort** — `Repeat` + `If` + swap, using a `## To compareVersion -> Ordering`
(§5.3) as the comparator, Set-item swaps (§3), and 1-based indexing; OR (b) the **G-SORT
toolchain G-task** lands a real LOGOS sort primitive upstream first. Per constitution R7
(the STOP rule) a port that needs sort must NOT shim it — see WAVES.md's G-SORT entry
(`## Toolchain-gap G-tasks`, "R7-STOP: blocks P2 semver"). Until then, hand-write it.

**GOTCHA — 1-based indexing (SEMANTIC_TRAPS, the documented bracket footgun).** `item 1 of
xs` is the FIRST element. bun/Rust is 0-based (`buf[0]`, `str[at_index + 1..]`, `for i in
0..n`). **Every index arithmetic must shift by 1.** The stdlib does this constantly: to read
the byte at 0-based offset `off`, it writes `item (off + 1) of padded` (`uuid.lg:210`). `item
0 of xs` is a compile error; `xs[0]` underflows (QUICKGUIDE §5.2). When porting a bun loop
`for i in 0..n { buf[i] }` (as in `src/semver/Version.rs:248,673`) the LOGOS body must index
`item (i + 1) of buf` OR iterate `for i from 1 to n` and index `item i`. bun's `.enumerate()`
0-based `i` (`dependency.rs:381`) shifts the same way. Mixing the two conventions in one
function is the #1 source of off-by-one regressions.

**GOTCHA — half-open vs inclusive ranges.** Rust `for i in 0..n` is half-open (excludes
`n`); LOGOS `Repeat for i from A to B` is **inclusive** of `B`. Porting `0..n` → `from 1 to
n` (1-based, inclusive) already lands on the right element count; porting `0..n` → `from 0 to
n` would over-run. Reconcile the base shift and the bound together, never separately.

**GOTCHA — `Break` is innermost-only; there is NO `Continue`, no labeled break, no
break-with-value (glob matcher = structural rewrite).** LOGOS `Break.` exits the **innermost**
loop only (`ast/stmt.rs:282`; QUICKGUIDE:150), and the corpus/QUICKGUIDE have **no `Continue`
statement** (the `Continue` token at `token.rs:48` is a Logic-mode presupposition kind, not
loop control), no labeled `break 'label`, and no `break 'label value`. bun's glob matcher
leans on all of these — `'main_loop: while` with `continue 'main_loop`, `break 'fallthrough`,
and break-with-value `break 'blk high` / `break 'brk cp` (`src/glob/matcher.rs:188,227,268,330,648`).
Renderings (SEMANTIC_TRAPS TRAP-19):

| bun shape | LOGOS rendering |
|-----------|-----------------|
| plain `continue;` | guard the loop's REST with `If`: `If skip: ... else run the tail` — skip the rest of the body when the continue-condition holds |
| `continue 'outer;` / `break 'outer;` (labeled, multi-level) | thread a mutable `done`/`skip` flag OUT through each nesting level, re-check it after the inner loop, and `Break.` each level in turn |
| `break 'blk value;` (break-with-value) | assign the value to a var FIRST, THEN `Break.` |

**Flag bun's glob matcher (`src/glob/matcher.rs`) as a structural rewrite, not a
transliteration** — a `break 'main_loop` mechanically copied as `Break.` exits only the inner
loop and the outer keeps running, silently matching the wrong path.

---

## 4. Traits & generics — where Rust maps CLEANER than Zig

### 4.1 bun (Rust) shapes

Rust bun uses real `trait`s, generic type parameters with bounds, associated consts/types,
`impl Trait`, and `dyn` — a far more legible generic surface than Zig's comptime
duck-typing.
- Trait with associated const/type + method: `pub trait VersionInt: Copy + Default + Eq +
  Ord + fmt::Display + 'static { const ZERO: Self; const MAX: Self; type TagPadding: …; fn
  parse_ascii(s: &[u8]) -> Option<Self>; }` — `src/semver/Version.rs:18-25`, with `impl
  VersionInt for u64 { … }` / `for u32 { … }` at `:27,40`.
- Generic struct over a bounded param: `pub struct VersionType<T: VersionInt> { pub major:
  T, … }` — `src/semver/Version.rs:56`; `pub type Version = VersionType<u64>;` — `:11`.
- Generic method with a trait-bounded param: `fn clone_in<SB: StringBuilderLike>(&self, buf:
  &[u8], builder: &mut SB) -> Result<Version, crate::Error>` — `src/install/dependency.rs:632`.
- Trait inheritance / supertrait: `pub trait StringBuilderLike: bun_semver::StringBuilder {
  fn string_bytes(&self) -> &[u8]; }` — `src/install/dependency.rs:306-309`.
- Extension trait providing methods on a type from another crate: `pub trait DependencyExt {
  … }` + `impl DependencyExt for Dependency { … }` — `src/install/dependency.rs:62-111`.
- Argument polymorphism via `impl Into`: `alias_hash: impl Into<Option<PackageNameHash>>` —
  `src/install/dependency.rs:68,143`.
- Higher-order fn parameter: `mut print: impl FnMut(fmt::Arguments<'_>) -> Result<R, E>` —
  `src/install/extract_tarball.rs:109`.
- **Dynamic dispatch (`dyn`):** `Some(m as &mut dyn NpmAliasRegistry)` —
  `src/install/dependency.rs:240,714`, with `pub trait NpmAliasRegistry { fn
  record_npm_alias(&mut self, …); }` — `src/install/dependency.rs:19-21`.
- Const generics: `fn tl_buf_mut<const N: usize>(…)` — `src/paths/resolve_path.rs:29`;
  const-generic `Platform` parameter (`P::P == Platform::Windows`) — `:131,228`.

### 4.2 LOGOS renderings

**Generic struct/enum** — type params in `[brackets]`, joined by `and`. This maps bun's
`VersionType<T>`:
```
A Box of [T] has:
    a value, which is T.
```
— `phase34_generics.rs:21` (VERIFIED).
```
A Pair of [A] and [B] has:
    a first, which is A.
    a second, which is B.
```
— `phase34_generics.rs:72` (VERIFIED).

Generic enum:
```
A Maybe of [T] is either:
    A Some with a value, which is T.
    A None.
```
— `phase34_generics.rs:174` (VERIFIED). Recursive: `A Cons with head T and tail MyList of T.`
— `phase103_generics.rs:23` (VERIFIED).

**Generic function** — `of [T]` between name and params. Maps `fn clone_in<SB>(…)`:
```
To identity of [T] (x: T) -> T:
    Return x.
```
— `phase24_codegen.rs:923` (VERIFIED). Two params: `To first of [T] and [U] (x: T, y: U) ->
T:` — `phase24_codegen.rs:950` (VERIFIED).

**Instantiation** — `a new Box of Int` — `phase34_generics.rs:165` (VERIFIED). Also the
built-in generic collections `Seq of Int`, `Map of Text to Int`, `List of T`
(`phase34_generics.rs:130` `a items, which is List of T.`).

**`impl FnMut(…)` / `impl Fn(…)` params → LOGOS `fn(...) -> ...` params** (§6.3). bun's
`print: impl FnMut(fmt::Arguments) -> Result<R,E>` (`extract_tarball.rs:109`) renders as a
function-typed parameter passing the behavior explicitly.

**Operator-trait newtypes = the Word types.** LOGOS ships `Word8`/`Word16`/`Word32`/`Word64`
as ℤ/2ⁿ ring newtypes with operator overloads (`+`, `xor`, etc.) — this IS the "impl a trait
for a numeric newtype" mechanism, but it is a fixed set, not user-extensible. See §7. It maps
bun's `impl VersionInt for u32/u64` in spirit (a trait over a numeric type), but only the
built-in widths exist; you cannot declare a new `VersionInt`-style trait and `impl` it.

**GOTCHA — no trait objects / no `dyn` / no user-defined traits / no bounds (where Rust
fights LOGOS).** There is NO `dyn`/vtable dispatch and NO user-declared `trait` surfaced in
the corpus. bun's `&mut dyn NpmAliasRegistry` (`dependency.rs:240`) and its `pub trait
DependencyExt`/`NpmAliasRegistry`/`StringBuilderLike` declarations have no direct LOGOS
translation. Options:
- (a) a concrete `enum` of the known implementers matched by `Inspect` — for a *closed* set
  of implementers (bun's `impl DependencyExt for Dependency` has exactly one impl; a `dyn`
  with two known impls, like `NpmAliasRegistry for PackageManager` and `for NpmAliasMap`,
  becomes a 2-variant enum).
- (b) a higher-order function parameter (§6, `fn(...) -> ...`) passing the behavior
  explicitly — the natural home for a one-method trait like `NpmAliasRegistry` (§4.1).
- Trait *bounds* on `[T]`: **UNVERIFIED** — the corpus shows only unconstrained `[T]`. bun's
  `T: VersionInt` / `SB: StringBuilderLike` supertrait bounds have no proven LOGOS analog.
  Porter must confirm before relying on bounded generics; if bounds are unavailable, model
  the bound's obligations (`ZERO`/`MAX`/`parse_ascii`) as explicit function parameters or a
  concrete-type specialization (§10 gotcha), not a constraint.

**GOTCHA — associated consts/types have no analog.** bun's `VersionInt::ZERO`/`MAX`/
`TagPadding` (`Version.rs:19-23`) are trait-associated. LOGOS generics carry no associated
items; supply them as ordinary values/parameters or specialize to the concrete type.

---

## 5. Enums & match — Rust enums ARE tagged unions, maps clean

### 5.1 bun (Rust) shapes

- Payload-free enum with **explicit discriminant values** (lockfile-serialized): `#[repr(u8)]
  pub enum DependencyVersionTag { #[default] Uninitialized = 0, Npm = 1, DistTag = 2, Tarball
  = 3, … Catalog = 9 }` — `src/install_types/resolver_hooks.rs:301-322`. The `= 0/1/2…` are
  **load-bearing** (written to / read from the lockfile: `match bytes[0] { 0 =>
  Tag::Uninitialized, 1 => Tag::Npm, … }` — `src/semver/Version.rs → dependency.rs:684-703`).
- **Idiomatic Rust enum with data (a true tagged union in the type system):** `pub enum URI {
  Local(SemverString), Remote(SemverString) }` — `src/install_types/resolver_hooks.rs:342-345`,
  matched by `match (lhs, rhs) { (URI::Local(l), URI::Local(r)) | (URI::Remote(l),
  URI::Remote(r)) => …, _ => false }` — `:349-354`.
- **Raw `union` + external tag (ABI-forced tagged union):** `pub union
  DependencyVersionValue { pub uninitialized: (), pub npm: ManuallyDrop<NpmInfo>, pub
  dist_tag: TagInfo, pub tarball: TarballInfo, pub folder: SemverString, … pub git:
  ManuallyDrop<Repository>, … }` — `src/install_types/resolver_hooks.rs:419-436`, with the
  discriminant living in the sibling `DependencyVersion.tag` field (`:448-451`).
- Exhaustive `match` on the tag: `match self.version.tag { Tag::DistTag => …, Tag::Git => …,
  Tag::Npm => …, _ => self.name }` — `src/install/dependency.rs:250-257`.
- Enum literals returned from a function: `b"npm" => Tag::Npm`, `b"dist_tag" =>
  Tag::DistTag` — `src/install/dependency.rs:760,767`.

### 5.2 LOGOS renderings

**Enum without payload (maps `DependencyVersionTag`):**
```
## A Color is one of:
    A Red.
    A Green.
    A Blue.
```
Construct `a new Red`; match with `Inspect c:` / `When Red: Show "red".` — imperative-mode.md
§Enums (VERIFIED).

**Enum with payload (maps both the idiomatic `URI` enum AND the `union DependencyVersionValue`
tagged union — they collapse to ONE LOGOS form):**
```
## A Shape is one of:
    A Circle with radius Int.
    A Rectangle with width Int and height Int.
```
— `e2e_enums.rs:40` (VERIFIED). Construct: `a new Circle with radius 10` (`:46`). bun's `enum
URI { Local(SemverString), Remote(SemverString) }` becomes `## A URI is one of: A Local with
value Text. A Remote with value Text.` Match binds positionally:
```
Inspect s:
    When Circle (r): Show r.
    When Rectangle (w, h): Show w.
```
— `e2e_enums.rs:48` (VERIFIED).

**`match` → `Inspect`/`When`.** bun's `match tag { Tag::Npm => …, Tag::Git => …, _ => … }`
(`dependency.rs:250`) renders as `Inspect x:` with a `When Npm:` arm per variant and
`Otherwise:` for the `_` wildcard (QUICKGUIDE §6). `Inspect`/`When` does exhaustiveness
checking (imperative-mode.md §Enums) — matching Rust's exhaustive-`match` guarantee.

**GOTCHA — payload bindings are POSITIONAL, not named.** In `When Rectangle (w, h):`, `w`/`h`
bind to the first/second field by position, regardless of the field's declared name. This
matches Rust tuple-variant `URI::Local(l)` (positional) but NOT struct-variant field names —
keep declaration order and match order aligned.

**GOTCHA — enum-with-explicit-discriminant-values is load-bearing here and has no direct
LOGOS analog.** bun's `#[repr(u8)] DependencyVersionTag { Npm = 1, DistTag = 2, … }` writes
those integers to the lockfile (`to_external`/`to_version`, `dependency.rs:684-703`). LOGOS
enums are not surfaced with a discriminant. **If the numeric value is serialized, model it
explicitly** — a `## To tagValue (t: Tag) -> Int` function (and its inverse `## To
tagFromByte (n: Int) -> Tag` mirroring the `match bytes[0]`) — rather than assuming the
variant carries a wire number. **UNVERIFIED** whether LOGOS enums expose a discriminant at
all; porter must confirm. This is a genuine porter trap for the whole `src/install/lockfile`
subsystem, which is discriminant-serialization-heavy.

**GOTCHA — do NOT port the `union` + `ManuallyDrop` machinery (see §2).** The raw `union
DependencyVersionValue` exists only for lockfile ABI layout; the *logical* type is a tagged
union, which is exactly `## A Value is one of: A Npm with … . A DistTag with … . …`. Port the
logic, drop the ABI trick.

### 5.3 Three-way compare (`Ordering`) — a user enum, NO built-in `cmp` (blocks P2 semver day one)

bun's semver is built on Rust's `std::cmp::Ordering`. `pub fn order_without_tag(lhs, rhs) ->
Ordering` (`src/semver/Version.rs:419-459`) is a Less/Greater/Equal ladder over
major/minor/patch/pre-release, and it is the backbone of the whole install resolver: `order`
reuses it, `satisfies` matches on it (`match order { Ordering::Equal => …, Ordering::Greater
=> …, Ordering::Less => … }` — `src/semver/SemverRange.rs:256`), and the sort comparator is
`sort_gt(…) = order_fn(…) == Ordering::Greater` (`src/semver/Version.rs:106`).

**LOGOS has the two-way comparisons `is less than` / `is greater than` / `is equal to`
(`codegen_hotpath_locks.rs:85`, `audit_codegen.rs:33`, `correctness_is_equality.rs:67`; also
`is at most` / `is between`), but NO built-in three-way `Ordering` / `cmp` / `<=>`** (verified
by exhaustive corpus + QUICKGUIDE search — none exists). Model it as your own payload-free
enum (§5.2 form), returned explicitly, and dispatched with `Inspect`:
```
## An Ordering is one of:
    A Less.
    An Equal.
    A Greater.

## To compareVersion (a: Version) and (b: Version) -> Ordering:
    If a's major is less than b's major:
        Return a new Less.
    If a's major is greater than b's major:
        Return a new Greater.
    ...
    Return a new Equal.
```
The enum declaration (`## A X is one of:` payload-free) is the `e2e_codegen_enums.rs:17`
`## A Color is one of:` form (VERIFIED); the `Inspect`/`When Less:` dispatch is the
`correctness_inspect.rs:21` `When Red:` form (VERIFIED). Consume it exactly like bun's `match
order`:
```
Inspect compareVersion(a, b):
    When Less: ...
    When Equal: ...
    When Greater: ...
```

**GOTCHA — compute the `Ordering` ONCE, then `Inspect` it.** The trap (SEMANTIC_TRAPS
TRAP-18) is porting bun's single `Ordering` into scattered pairwise `is less than` /
`is greater than` boolean tests at each call site. That (a) re-runs the whole
major/minor/patch/pre ladder every comparison, and (b) risks an inconsistent partial order —
an `a < b` test and a separate `a == b` test that disagree on the pre-release tie-break
(`1.2.0` outranks `1.2.0-rc.1`: `Version.rs:439-451`). Write ONE `compareVersion -> Ordering`
mirroring `order_without_tag`, and the total-order axioms (antisymmetry, transitivity) hold by
construction. **This is the first thing the P2 semver port needs; it cannot render
`Version.rs:419` without it.**

### 5.4 `matches!`, match OR-patterns, guards, and ranges (THE lexer shape — P5)

bun uses `matches!` and rich `match` arms pervasively, especially in the JSON/INI/lexer
surface: `matches!(contents[1], b'"' | b'\'')` (`src/parsers/json.rs:537`),
`matches!(contents[p], b']' | b',')` (`:794`), `matches!(self, ConfigOpt::_Auth |
ConfigOpt::_Password)` (`src/ini/lib.rs:121`); OR-arms with guards `b'-' | b'.' if
leads_a_number(contents) =>` (`src/parsers/json.rs:555`); and OR-of-range arms `0x30..=0x37
=>` / `0x30..=0x39 | 0x61..=0x66 | 0x41..=0x46 =>` (`src/js_parser/lexer.rs:688,1289`).

| bun shape | LOGOS rendering |
|-----------|-----------------|
| `matches!(x, A \| B)` (a **boolean test**) | `x is A or x is B` inside an `If` (logical `or`, QUICKGUIDE §5 legend / QUICKGUIDE:55) — **NOT** an `Inspect` |
| `match` enum **OR-arm** `A \| B => body` | TWO `When` arms with the same body (`When A: body.` `When B: body.`) — there is **no `When A or B:` OR-arm** (UNVERIFIED / not in corpus or QUICKGUIDE; `Inspect` parses one variant per arm, `parser/mod.rs:5756`) |
| match arm **guard** `pat if cond =>` | an `If cond:` nested inside the `When` arm |
| contiguous **range** `0x30..=0x37` | `is between 48 and 55` (INCLUSIVE; `correctness_predicates.rs:97`, QUICKGUIDE:53) |
| **OR of ranges** `A..=B \| C..=D` | `(x is between A and B) or (x is between C and D)` in an `If` |

**GOTCHA — `matches!` is a boolean, not a match statement.** Porting `matches!(c, b'"' |
b'\'')` to an `Inspect` with an empty `Otherwise` silently no-ops; it is `c is 34 or c is 39`
in an `If`. **GOTCHA — range VALUES do not shift, only Seq INDICES do.** `0x30..=0x37`
→ `is between 48 and 55` uses the literal byte values 48–55; the 1-based shift (§3, TRAP-01)
applies to `item i of xs` indexing, NOT to a byte-value range test. **GOTCHA — never drop the
guard.** `b'-' | b'.' if leads_a_number(...)` without the `If leads_a_number(...)` guard
mis-classifies `-`/`.` that do not lead a number. (SEMANTIC_TRAPS TRAP-20.)

---

## 6. Structs & construction, functions & closures

### 6.1 Structs

bun: `#[repr(C)] pub struct VersionType<T: VersionInt> { pub major: T, pub minor: T, pub
patch: T, pub _tag_padding: T::TagPadding, pub tag: Tag }` — `src/semver/Version.rs:54-65`,
with defaults supplied via an `impl Default` block (`major: T::ZERO, …` — `:77-87`) rather
than inline field defaults.

LOGOS:
```
## A Point has:
    An x: Int.
    A y: Int.
```
— imperative-mode.md §Structs (VERIFIED). Note the article `An`/`A` before each field
(agrees with the field's first sound). Field type after `:`.

| Operation | LOGOS | Citation |
|-----------|-------|----------|
| Construct (defaults) | `a new Point` | imperative-mode.md §Structs (VERIFIED) |
| Construct with fields | `a new Point with x 10 and y 20` | QUICKGUIDE §8; `e2e_feature_matrix.rs:790` `a new User with role "admin"` (VERIFIED) |
| Field read (`p.x`) | `p's x` (also `p.x`) | imperative-mode.md §Structs (VERIFIED) |
| Nested read | `b's location's x` | QUICKGUIDE §8 |
| Field write (`p.x = 5`) | `Set p's x to 5.` (also `Set p.x to 5.`) | imperative-mode.md §Structs (VERIFIED) |
| Method (UFCS, `xs.f(a)`) | `xs.f(a)` ≡ `f(xs, a)` (receiver = arg 0) | QUICKGUIDE §8 (UNVERIFIED against corpus — porter confirm the dot-method form) |

**GOTCHA — Rust `impl Default` field defaults do not carry over automatically.** bun's
`VersionType::default()` sets `major: T::ZERO, …` (`Version.rs:77`). `a new Point`
zero/default-initializes per LOGOS rules; if a bun struct relies on a specific non-trivial
default (e.g. `Tag::default() == Uninitialized`, or `TarballInfo::default()` building a
`URI::Local(default)` — `resolver_hooks.rs:398-404`), set it explicitly in the constructor or
a factory function. bun's `Default` impls are where those non-zero defaults live; read them.

**GOTCHA — `#[repr(C)]` + layout `assert!`s are ABI, not logic.** bun pins
`VersionType<u64>` to 56 bytes with `const _: () = { assert!(size_of::<…>() == 56); … };`
(`Version.rs:68-75`) for the lockfile format. LOGOS has no memory-layout control; the layout
asserts do not port. What DOES port is the *fact* that the serialized form is fixed-width —
handle it in an explicit `to_bytes`/`from_bytes` function (§5 discriminant gotcha), not via
struct layout.

### 6.2 Functions

```
## To classify (n: Int) -> Text:
    If n is less than 0:
        Return "negative".
    Return "non-negative".
```
— imperative-mode.md §Functions (VERIFIED). Multiple params joined by `and`, comma, or
prepositions: `## To add (a: Int) and (b: Int) -> Int:` / `## To withdraw (amount: Int) from
(balance: Int):` (QUICKGUIDE §7; `uuid.lg:38` uses `and` between four groups). Return type
`-> T` optional (procedures omit it). **Every statement ends with a period.**

FFI / export markers (real, high-frequency in corpus): `is exported` (180×), `is exported for
native` (4×), `is exported for wasm` (7×); native import `## To native f (…) -> T` —
`crypto.lg:120`. These map bun's `pub fn` (public) vs unmarked (crate/module-private) and its
`unsafe extern "C"` FFI blocks (`src/bun_core/string/mod.rs:74-98`).

### 6.3 Closures & higher-order functions

Expression closure (maps Rust `|n| n * 2`): `Let doubler be (n: Int) -> n * 2.` —
`e2e_closures.rs:34` (VERIFIED). Zero params: `() -> "hello"` (`:58`). Multi-param: `(a: Int,
b: Int) -> a + b` (`:46`).

Block closure (multi-statement, `->:` then indented body):
```
Let process be (n: Int) ->:
    Let doubled be n * 2.
    Return doubled + 1.
```
— `e2e_closures.rs:99` (VERIFIED).

Function-typed parameter and returning a closure (maps Rust `f: impl Fn(Int)->Int` /
`-> impl Fn`):
```
To apply (f: fn(Int) -> Int) and (x: Int) -> Int:
    Return f(x).
```
— `e2e_closures.rs:208` (VERIFIED).
```
To makeAdder (n: Int) -> fn(Int) -> Int:
    Return (x: Int) -> x + n.
```
— `e2e_closures.rs:222` (VERIFIED). Captures are automatic: `(n: Int) -> n + offset` (`:152`,
`offset` from enclosing scope, VERIFIED) — like a Rust `move` closure capturing by value.

**This is the primary tool for porting bun's `impl Fn`/`impl FnMut`/`dyn`-trait/callback code**
(§4 gotcha): pass behavior as an `fn(...) -> ...` parameter. bun's `print: impl
FnMut(fmt::Arguments) -> Result<R,E>` (`extract_tarball.rs:109`) and its one-method traits
(`NpmAliasRegistry`) both render as function-typed parameters.

---

## 7. Strings & bytes — THE big trap (WTF-16 / Latin-1 vs UTF-8)

### 7.1 The trap, stated first

**bun's JS-facing strings are NOT UTF-8; LOGOS `Text` is UTF-8.** The Rust rewrite keeps
JSC's string model: `bun_core::String` is a **5-variant tagged union** whose active payload
is a `WTFStringImpl` (WebKit string) holding either **Latin-1** or **UTF-16** —
`src/bun_core/string/mod.rs:52-53` ("`bun.String` — 5-variant tagged WTFString-or-ZigString")
and the tag enum `pub enum Tag { Dead = 0, WTFStringImpl = 1, ZigString, StaticZigString,
Empty }` — `src/bun_alloc/lib.rs:991-993`. The width is queried at runtime: `is_16bit()` /
`is_8bit()` (`src/bun_core/string/mod.rs:566` and `:573` respectively — the `is_8bit` in
`src/bun_alloc/lib.rs` is the lower-level ZigString variant). The `src/CLAUDE.md`
is explicit: *"`WTFStringImpl` (Latin-1 or UTF-16). **Latin-1 is NOT UTF-8** — bytes 128-255
are single chars in Latin-1 but invalid UTF-8 — so converting either direction requires a real
encoder, not a cast."* So:
- A JS-visible `.length` counts **UTF-16 code units**, not codepoints or UTF-8 bytes.
- An 8-bit `bun.String` is **Latin-1**, where bytes 128-255 are single characters — the wrong
  interpretation as UTF-8.
- **LOGOS `Text` operations are UTF-8/codepoint-oriented.** These do not agree with WTF-16 or
  Latin-1 for any non-ASCII string.

**Mechanical rules:**
1. Any bun code that indexes/slices/measures a *JS-visible* `bun.String`/`WTFStringImpl` in
   UTF-16 units MUST NOT be transliterated to LOGOS `Text` indexing. Convert to an explicit
   code-unit `Seq` and index that, or preserve the encoding semantics deliberately. Flag
   every such site. bun's own encoders (`to_utf16_alloc`, `copy_latin1_into_utf8`,
   `copy_utf16_into_utf8` — `src/bun_core/string/immutable.rs`) mark exactly the boundaries
   where a re-encode happens; those are your conversion points.
2. bun code operating on **bytes** (`&[u8]`: file paths, buffers, hashing input, the whole
   `src/semver`/`src/install` parser surface, which is `&[u8]`-throughout) maps cleanly to
   LOGOS byte sequences (§7.3) — no encoding hazard, because it was never JS text.
3. bun code that is genuinely UTF-8 (`String::clone_utf8`/`borrow_utf8`, already-decoded
   native strings — `borrow_utf8` sig at `src/bun_core/string/mod.rs:187`) maps to LOGOS `Text`.

The SEMANTIC_TRAPS taxonomy lists "UTF-8 `Text` vs WTF-16 vs raw-byte string handling" as a
dedicated fuzz-generator focus. Treat string encoding as a per-site decision, never a blanket
`String → Text`. **Note vs the Zig source:** the trap is identical in shape — WebKit's WTF
string model is the same — but the Rust rewrite ALSO surfaces the Latin-1 8-bit case
explicitly (`is_8bit()`), so a porter must distinguish *three* bun-side encodings (UTF-8 /
Latin-1 / UTF-16), not two. **(Cross-ref: SEMANTIC_TRAPS TRAP-07 counts *four* indexing
bases — these same three bun encodings PLUS LOGOS `Text`'s own codepoint basis, the target
you are mapping *into*. "Three encodings" and "four bases" agree; the fourth is LOGOS.)**

### 7.2 LOGOS `Text` operations (VERIFIED working today)

| Operation | LOGOS | Citation |
|-----------|-------|----------|
| Concatenate | `a + b` (also `a combined with b`) | `e2e_language_gaps.rs:143` `"a" + "b" + "c" + "d"`; `e2e_feature_matrix.rs:2263` `"Hello " + getName()`; `uuid.lg:543` `out + chr(code)` (VERIFIED — QUICKGUIDE marks `+` proposed, but corpus proves it) |
| Interpolate | `"Hello, {name}!"` | `e2e_string_interpolation.rs:77` (VERIFIED) |
| Format spec | `"{pi:.2}"`, `"{s:>10}"`, `"{v=}"`, `"{price:$}"` | `e2e_string_interpolation.rs:245` (VERIFIED) |
| Multiline | `"""…"""` | QUICKGUIDE §4 |
| Text → bytes (**UTF-8**) | `text_bytes(s)` → `Seq of Int` (each 0–255) | `uuid.lg:410,479`; `e2e_codegen_uuid.rs:110` (VERIFIED — `sha1(text_bytes("abc"))` first byte = 169 = 0xa9, proving UTF-8 bytes) |
| Int (code) → 1-char Text | `chr(code)` | `uuid.lg:543`; `phase_futamura.rs:10782` `chr(10)`; `vm_parity_matrix.rs:163` `chr(65)` (VERIFIED) |
| Char literal | `` `z` `` with type `Char` | `e2e_codegen_primitives.rs:30` (VERIFIED) |
| Seq of Char | `a new Seq of Char`, `Push \`a\` to chars` | `e2e_codegen_primitives.rs:84` (VERIFIED) |

**Phantom / (proposed) — do NOT use, desugar instead:** `split`, `join`, `trim`, `replace`,
`substring`, `s.split(",")` are marked **(proposed)** in QUICKGUIDE §4 and do **not** appear
in the corpus. This matters more for the Rust port than it looks: bun's `&[u8]` string
toolkit (`bun_core::strings::index_of`, `starts_with`, `ends_with`, `contains`, `trim_left` —
`src/install/dependency.rs:1206`, `src/CLAUDE.md`) is used constantly, and **none of those
have LOGOS `Text` method equivalents**. Port bun's byte-string search by hand: iterate
`text_bytes(s)` (for byte ops) or build char-by-char with `chr`/`+` (as `uuidFormat` does at
`uuid.lg:540-547`). `ord(...)` was NOT found in the corpus (UNVERIFIED — the inverse of `chr`
may not exist; porter must confirm or build it).

### 7.3 Bytes / buffers

bun's parser/installer surface is `&[u8]`-native (not text): `&[u8]` params, `bytes[0..byte_i]`,
byte literals `b'@'`/`b"latest"`. Two LOGOS idioms, both VERIFIED, map it:
- **`Seq of Int`, each element 0–255** — the lower-level buffer interface the crypto stdlib
  uses throughout (`crypto.lg:978` `bytesToWords (bytes: Seq of Int)`; all of MD5/SHA-1 in
  `uuid.lg` operate on `Seq of Int`). This is what `text_bytes` returns. **Use this for
  porting `&[u8]` / `Vec<u8>` / `Box<[u8]>`.**
- **`Byte` type** (u8, wrapping) — `Let b: Byte be 255.`, `a new Seq of Byte`
  (`e2e_codegen_primitives.rs:113,147`). Byte `+` wraps mod 256 (`100 + 50 = 150`, no trap).

**GOTCHA — the stdlib byte-buffer convention is `Seq of Int`, not `Seq of Byte`.** Follow it
for interop with `text_bytes`, `md5`, `sha1`, etc. Reach for `Byte` only when you specifically
want u8 wrapping semantics on a scalar. bun's `&[u8]` byte literals (`b'@'` = 64) become plain
`Int`s in a `Seq of Int`.

---

## 8. Integer semantics

### 8.1 bun (Rust) shapes

Sized integers everywhere: `u8`/`u16`/`u32`/`u64` (`#[repr(u8)]` on `Tag`, `VersionType<u64>`
vs `VersionType<u32>`), `usize` for indices (`byte_i as usize`, `input.len()`). Rust integer
overflow **panics in debug, wraps in release** unless made explicit — and bun makes it
explicit where it matters: `wrapping_*`, `saturating_*` (`i.saturating_sub(1)` —
`src/semver/Version.rs:526`), `checked_*`. Parsing goes through
`bun_core::parse_unsigned::<u64>(s, 10)` returning `Result` (`src/semver/Version.rs:36`).
Associated `const MAX: Self = u64::MAX` / `const ZERO: Self = 0` (`Version.rs:29,28`). Casts
are explicit: `as u32`, `as usize` (`Version.rs:134,468`).

### 8.2 LOGOS renderings

| bun type | LOGOS | Notes |
|----------|-------|-------|
| `i64` / general integer | `Int` | i64 (imperative-mode.md §Primitive types, VERIFIED) |
| `u64` / non-negative | `Nat` | u64 |
| `usize` index | `Int` (1-based!) | see §3 gotcha |
| `u8`/`u16`/`u32`/`u64` **with wrapping** | `Word8`/`Word16`/`Word32`/`Word64` | ℤ/2ⁿ ring newtypes, the crypto substrate (imperative-mode.md §Primitive types, VERIFIED) |
| big integer | `BigInt` | exists in corpus (20 refs) |
| exact fraction | `Rational` | exists (119 refs) |
| `f64` | `Real` (alias `Float`) | |

**When to use Word types (mechanical rule):** any bun code where the integer width and
wrapping/overflow behavior is *semantically load-bearing* — **hashing (`bun_wyhash::hash` →
u64), crypto, parsers that pack bytes into words, checksums, bit manipulation, integrity**. If
bun does `& 0xFF`, `<<`, `>>`, `>>>`, `^`, rotate, `wrapping_add`, or relies on `u32`
wraparound, port to the Word type. General-purpose counting/arithmetic → `Int`. bun's
`saturating_sub`/`checked_*` on `usize` indices are *guards*, not wrapping — port those as
`If i > 0 then Set i to i - 1` style clamps on `Int`, not as Word ops.

**Word op spellings (VERIFIED, exact — do not guess):**
- Construct: `word32(1732584193)`, `word64(255)` — `uuid.lg:197`, `simd_lanes.rs:4294`.
- Back to Int: `intOfWord32(word)`, `intOfWord64(w)` — `uuid.lg:216`, `simd_lanes.rs:4294`.
- Word32 bitwise: `word_and`, `word_or`, `word_not` — `uuid.lg:323`; `xor` operator on words —
  `uuid.lg:66` `m0 xor m2`; `rotl(x, n)` — `uuid.lg:329`. (VERIFIED)
- Word64 bitwise: `word64And(a, b)`, `word64Shl(w, n)`, `word64Shr(w, n)`, `xor` operator,
  `rotl(w, n)` — `simd_lanes.rs:4293-4298`. (VERIFIED)
- **Note the asymmetry:** Word32 has the `word_and`/`word_or`/`word_not` free-function family;
  Word64 uses `word64And`/`word64Shl`/`word64Shr` (no `word64Or`/`word64Xor` found — use the
  `xor` operator). Confirm the exact builtin name against the corpus before each use; the two
  width-families are NOT spelled identically.

### 8.3 Integer division & overflow traps (SEMANTIC_TRAPS)

- **Integer division truncates toward zero:** `7 / 2` = `3`, `10 / 2` = `5`
  (`e2e_expressions.rs:100` and `:33`, VERIFIED — there is no `e2e_operators.rs`). Matches Rust `/` on unsigned and
  `/` toward-zero on signed for positives. **UNVERIFIED** for negative operands (round-toward-
  zero vs floor) — the corpus test uses positives only; porter must confirm before porting bun
  code with negative dividends. This is a named trap class ("integer division/overflow/wrapping
  semantics").
- **`Int` is NOT wrapping.** Rust release-mode `u32` overflow wraps; `Int` will not reproduce
  it — you must use the Word type. Rust debug-mode overflow *panics*, so bun code that relies
  on wrap always spells it (`wrapping_*`) — grep for that as your Word-type signal. Silent
  divergence otherwise.
- **`%` modulo:** used throughout the stdlib as `x % 256`, `x % 16` for byte/nibble extraction
  (`uuid.lg:32` and `:217-220`). VERIFIED for positives; sign behavior on negatives UNVERIFIED (same
  caveat as division). Rust `%` follows the dividend's sign; confirm LOGOS matches before
  porting signed remainders.

---

## 9. Modules & visibility

### 9.1 bun (Rust) shapes

`mod` + `pub use` re-export hubs: `pub use crate::version::Version;` /
`pub use crate::semver_string::String;` / `pub use crate::sliced_string::SlicedString;` /
`pub mod version; pub mod semver_query; pub use crate::semver_query as query;` —
`src/semver/lib.rs:3-22`. Re-export with rename inside a module for downstream compat: `pub
use bun_install_types::resolver_hooks::{ … DependencyVersionTag as Tag, DependencyVersionValue
as Value, … };` — `src/install/dependency.rs:53-56`; `pub use Tag as VersionTag; pub mod
version { pub use super::Tag; }` — `:458-461`. Visibility: `pub` (public), `pub(crate)`
(crate-private, e.g. `split_name_and_version` — `dependency.rs:528`), unmarked (module-
private). Each crate defines its own `Error` (`src/install/error.rs`) re-exported as
`crate::Error` (per `src/CLAUDE.md`).

### 9.2 LOGOS reality: invisible demand-driven prelude, no explicit `import`/`use`/`mod`

There is **no `import`/`use`/`mod`/module-path statement** in LOGOS programs (confirmed: no
such syntax in the corpus). Instead: the stdlib modules in `assets/std/*.lg`/`*.md` are
**auto-imported on demand** — `apply_prelude`
(`crates/logicaffeine_compile/src/loader.rs:385`) prepends a module only when your program
references one of its names *and* doesn't define them itself ("declarer wins"). Opt out with a
`## NoPrelude` marker (`loader.rs:187`). imperative-mode.md §Standard library confirms this.
Consequence for porters: you call `md5(...)`, `sha1(...)`, `text_bytes(...)` etc. **by bare
name** — no `use crate::…` line. To reuse a function across your own `.lg` files, the mechanism
is the same prelude splice / concatenation, not a `mod`/`pub use` statement. bun's entire
`mod`/`pub use` re-export-hub layer (`src/semver/lib.rs`) simply evaporates — there is nothing
to port; unique global names do the job.

**GOTCHA — "declarer wins" name collisions.** If your program defines a `Message`/`args`/etc.
that also exists in a stdlib module, YOURS is used and the stdlib one is not spliced. Do not
rely on a stdlib name you have also shadowed. Generic type names (net/io/crdt) can collide;
imperative-mode.md and the campaign memory both flag this. bun's `pub use … as Tag` renames
have no analog — pick one unique LOGOS name per concept up front (bun already collides on
`Tag`: `dependency::Tag`, `bin::Tag`, `lockfile::Tag`, `PackageManagerTask::Tag` are four
different enums — you must disambiguate them into four distinct LOGOS names).

### 9.3 Namespaced types (`Alias::Type`) — PIN-GATED, do not use yet

The card names `Alias::Type` namespaced imports as the **W0.E-G feature**, explicitly
**"uncommitted-in-live pending pin bump."** Corpus search finds NO `Alias::Type` LOGOS usage
at the current pin (the `::` hits are all Rust harness code). **UNVERIFIED / NOT AVAILABLE at
TOOLCHAIN_PIN.** Per constitution R7 (the STOP rule): if a port needs namespaced imports, stop
and write a G-task; do not shim it inside logos-bun. Until the pin bump, rely on the demand-
driven prelude (§9.2) and unique global names. **This is the acute pain point for the `Tag`
collision above:** without `Alias::Type`, the four different bun `Tag` enums cannot coexist as
`dependency::Tag` etc. and must be manually renamed — flag any port that needs to distinguish
them.

---

## 10. Const / const-generics (Rust has NO comptime — the trap CHANGES vs Zig)

### 10.1 bun (Rust) shapes

Rust has **no Zig-style `comptime`** — no comptime value computation, no comptime branching,
no `@compileError` metaprogramming. Its compile-time surface is narrower and more structured:
- Associated `const` on a trait: `const ZERO: Self; const MAX: Self;` — `src/semver/Version.rs:19-20`,
  with concrete `const ZERO: Self = 0; const MAX: Self = u64::MAX;` per impl (`:28-29,41-42`).
- `const` items / static tables: ordinary `const` bindings.
- **Compile-time assertion (Rust's `@compileError` analog):** `const _: () = { assert!(size_of::<Tag>()
  == 32); assert!(size_of::<VersionType<u64>>() == 56); … };` — `src/semver/Version.rs:68-75`
  (a `const` block that fails the build if the layout drifts).
- **Const generics:** `fn tl_buf_mut<const N: usize>(…)` — `src/paths/resolve_path.rs:29`;
  const-generic `Platform` parameter dispatched at monomorphization (`P::P ==
  Platform::Windows`) — `src/paths/resolve_path.rs:131,228`. This is Rust's *type-level
  specialization* mechanism (what Zig used `comptime` for).
- Generic monomorphization for two int widths: `VersionType<u64>` (the real type) vs
  `VersionType<u32>` (the old lockfile version), bridged by `fn migrate(self) ->
  VersionType<u64>` — `src/semver/Version.rs:89-102`.

### 10.2 LOGOS reality: compute at runtime; no comptime metaprogramming

- **Generic type params (`<T: VersionInt>`, `<const N: usize>`, const-generic `Platform`) →
  LOGOS generics** (`[T]`, §4) where the parameter is a *type*. **The const-generic /
  value-level specialization has NO analog** — `<const N: usize>` and `P::P ==
  Platform::Windows` monomorphized dispatch cannot be reproduced; pass the value as an
  ordinary runtime parameter, or write two concrete functions (see gotcha).
- **Associated consts (`const ZERO`/`MAX`) → NO analog** (§4 gotcha) — supply as parameters or
  specialize to the concrete type.
- **The `const _: () = { assert!(…layout…) }` block → does NOT port** — it is a memory-layout
  guard (ABI), and LOGOS has no layout control (§6.1 gotcha). The *intent* (serialized form is
  fixed-width) lives in explicit `to_bytes`/`from_bytes` code, not a compile-time assert.
- **`const` value tables → runtime `Seq` builders.** There is no user-facing compile-time
  const-evaluation of tables in the corpus. Render a bun `const TABLE: [u32; 64] = […]` as a
  LOGOS function that builds and returns the `Seq` at runtime: the MD5 round-constant table is
  built by 64 `Push` statements (`uuid.lg:226-292` `md5Constants`), NOT a compile-time array.
  **Mechanical rule: any bun const/static table becomes a LOGOS function that builds and
  returns the `Seq` at runtime** (call it once, bind with `Let`).
- **`const x = …` (immutable local) → `Let x be …`** (immutable by default; mutation requires
  `Let mutable`). Verified everywhere in the stdlib. Maps Rust `let x = …` (immutable) vs `let
  mut x = …`.
- Whether LOGOS constant-folds these runtime tables is an *optimizer* concern, not a source
  concern; write them as runtime builders and trust the tiers.

**GOTCHA (SEMANTIC_TRAPS "comptime/const-generic analogs") — the trap is DIFFERENT from the
Zig source.** Zig `comptime`-specialization (two distinct struct layouts from one comptime fn)
does not exist in Rust; instead Rust uses **generic monomorphization** (`VersionType<u64>` vs
`VersionType<u32>`). Port as ONE generic definition (`of [T]`) if the difference is purely the
element type. If the two instantiations genuinely diverge in behavior or serialized layout —
as `Version` (u64) vs the migration-only `VersionType<u32>` do (bridged by `migrate()`,
`src/semver/Version.rs:89`) — port as TWO concrete structs/functions plus an explicit
`migrate`-style converter. Do NOT attempt to reproduce Rust's monomorphization; there is no
LOGOS mechanism for "specialize this generic to a concrete int width and get a different
layout."

---

## 10.5 Concurrency & the installer — actors/channels map; shared atomics do NOT (blocks P4 install core)

bun's package installer is a **thread-pool + batches + a mini event loop + shared atomics**,
NOT async/tokio. The shapes:
- `use bun_threading::{ThreadPool, UnboundedQueue, thread_pool};` — `src/install/PackageManager.rs:27`;
  `use bun_event_loop::MiniEventLoop` — `:18`.
- `pub thread_pool: ThreadPool`, `pub task_batch: thread_pool::Batch` (plus
  `network_tarball_batch`, `network_resolve_batch`, `patch_apply_batch`, …) —
  `src/install/PackageManager.rs:394-408`.
- **Shared mutable counters via atomics:** `use core::sync::atomic::{AtomicBool, AtomicU32,
  Ordering};` (`:3`); `pub pending_tasks: AtomicU32` (`:416`), `pub finished_installing:
  AtomicBool` (`:425`), `pub pending_pre_calc_hashes: AtomicU32` (`:415`),
  `pub pending_lifecycle_script_tasks: AtomicU32` (`:424`). The install loop spins until
  `pending_tasks` drains and flips `finished_installing`.

**What MAPS — LOGOS has a real deterministic concurrency runtime** (`logicaffeine_runtime`:
`scheduler.rs` "a single, deterministic, seed-driven scheduler", `channel.rs`, `task.rs`).
Surface forms (VERIFIED in the concurrency corpus):

| bun intent | LOGOS rendering | Citation |
|-----------|-----------------|----------|
| Channel / queue (`UnboundedQueue`) | `Let ch be a Pipe of Int.` (FIFO) | `e2e_concurrency.rs:73` (VERIFIED) |
| Enqueue (`.push` to the queue) | `Send x into ch.` | `e2e_concurrency.rs:75` (VERIFIED) |
| Dequeue (worker pulls a task) | `Receive x from ch.` | `concurrency_prelude.rs:34`, `concurrency_differential.rs:44` (VERIFIED) |
| Spawn a pool task (`Batch`/`ThreadPool` job) | `Launch a task to worker with args.` | `concurrency_differential.rs:43,85` (VERIFIED) |
| Long-lived worker (actor) | `Spawn an EchoAgent called "echo".` | QUICKGUIDE §12 (`:235`) |
| Convergent shared state (merge, not lock) | `A Counter is Shared and has: points: ConvergentCount.` + `Increase c's points by 10.` / `Merge remote into local.` | QUICKGUIDE §12 (`:229-232`) |

**GOTCHA — there is NO atomic-shared-counter analog; `pending_task_count`/`finished_installing`
need the G-CONCURRENCY toolchain G-task.** LOGOS actors are **value-COW isolated** — a task
cannot atomically `fetch_sub` a counter that another task also reads, because a mutation
copy-on-writes into the mutator's private copy (§2, TRAP-09). The CRDT `Shared`/`ConvergentCount`
surface is **merge-based (eventually-consistent), not a lock-free atomic**: it converges, it
does not give you bun's "read the live count this instant, decrement it, and spin until zero"
semantics. So bun's `pending_tasks: AtomicU32` drain-loop and its `finished_installing:
AtomicBool` flag have **no direct LOGOS translation at the current pin**. Per constitution R7
(the STOP rule): a port that needs the shared-atomic drain pattern must STOP and use the
**G-CONCURRENCY** G-task, NOT shim it inside logos-bun — see WAVES.md's G-CONCURRENCY entry
(`## Toolchain-gap G-tasks`, "R7-STOP: blocks P4 install core"). **Note (per that entry):**
the deterministic runtime EXISTS, so G-CONCURRENCY may be a *surfacing/mapping* task (exposing
a shared-counter/barrier idiom over the existing scheduler) rather than a from-scratch build —
investigate before carding. What you CAN port today is the actor/channel decomposition (rewrite
the counter-drain as "coordinator receives N `done` messages on a `Pipe`, then proceeds"), a
deterministic single-threaded reshaping of the pool.

### 10.6 Fast-follow pointers (surface later in a port, not day one)

These don't block the first leaf ports; a porter meets them mid-port. Each has a home
elsewhere in this doc — noted here so they aren't forgotten:
- **simdutf FFI leaf crates → REIMPLEMENT the algorithm, don't transliterate.** bun's base64
  is FFI over a C++ SIMD lib (`use bun_simdutf_sys::simdutf` — `src/base64/lib.rs:1`). Port it
  as a real LOGOS byte algorithm (Word8 6-bit tables per §7.3/§8.2), the P2 "worked example."
  The LOGOS side has no `simdutf`; there is nothing to bind, only to re-derive.
- **Lockfile byte-serialization > discriminant.** bun's lockfile is `bytemuck`-Pod structs
  with explicit padding + a `0xDEADBEEF` "never written" sentinel and an `Aligner`
  (`src/install/lockfile/Buffers.rs:16,86-87`; `_padding_after_integrity: [u8; 3]` at
  `src/install/npm.rs:690`). LOGOS has no memory layout — port to explicit `to_bytes`/`from_bytes`
  (§5 discriminant gotcha, §6.1 `#[repr(C)]` gotcha); fuzz-focus = `bun.lockb` round-trip
  byte-exact.
- **SHA-512 SRI integrity.** npm integrity is `sha512-` + base64 (`src/install/integrity.rs:3,11,174`,
  `SHA512_DIGEST_LEN = 64`; `src/install/npm.rs:679-682`). LOGOS ships a SHA-512/SHA-256/SHA-3
  crypto substrate (`sha3_native.rs`, `simd_lanes.rs`; §8.2 Word64) — port the hash natively and
  gate extract-after-verify with `Check that <digest matches>.` (§1.3c).

---

## 11. Quick-reference cheat sheet (all VERIFIED unless flagged)

| bun (Rust) | LOGOS |
|-----------|-------|
| `Result<T,E>`, caller inspects (`thiserror` enum) | user enum `## A Result is one of: A Ok…/A Err…` + `Inspect` |
| `Option<T>`, `.ok_or`, `.map` | `Option of T`, `some x`/`none`, `When OptionSome (v):` |
| `foo()?` / `x.ok_or(E)?` (early return) | **no `?`** — explicit `Inspect`/`If … Return …` per site (TOP FRICTION) |
| `.unwrap_or(d)` / `.unwrap_or_default()` | `If` guard / `Inspect … Otherwise` producing the default |
| `panic!`/`unreachable!`/`.expect("inv")` | `Check that …` / `Assert that …` / `Trust that … because "…"` |
| `&[u8]`, `&str[a..b]` | `Seq of Int` / `Text`; `items a through b of xs` (INCLUSIVE) |
| `buf[i]` (0-based), `for i in 0..n` (half-open) | `item (i + 1) of buf` (1-BASED); `from 1 to n` (INCLUSIVE) |
| `continue;` / `continue 'label` / `break 'label` / `break 'label val` | **no `Continue`, no labeled/value break** — `If`-guard the tail / mutable `done` flag / assign-then-`Break.` (§3, TRAP-19) |
| `.sort()` / `xs.sort_by(cmp)` | **no usable sort** (proposed) — hand-write selection sort w/ §5.3 `Ordering`, OR G-SORT G-task (§3, WAVES.md) |
| `.iter().map()/.filter()/.collect()` | `Repeat for x in xs:` + `Push`/`If` (no combinators) |
| `a ++ b` / `[a, b].concat()` | `a followed by b` (Seq) / `a + b` (Text) |
| generic `struct Foo<T>` / `fn f<T>` | `Foo of [T]` / `of [T]` |
| trait bound `<T: Bound>`, associated `const` | UNVERIFIED (unconstrained `[T]` only; pass obligations as params) |
| `impl Trait` / `dyn Trait` / user `trait` | enum + `Inspect`, or `fn(...) -> ...` param (NO traits/dyn) |
| `impl Fn`/`impl FnMut` param | `f: fn(...) -> ...` parameter |
| `#[repr(u8)] enum { A=0, B=1 }` + `match` | `## A X is one of:` + `Inspect`/`When`; discriminant → explicit `To tagValue` |
| `enum URI { Local(T), Remote(T) }` (data) | `## A URI is one of: A Local with value T. A Remote with value T.` |
| `union` + separate `.tag` (ABI) | ONE tagged `## X is one of:` (drop the union/`ManuallyDrop`) |
| `Ordering` / `cmp` / `<=>` (3-way, `Version.rs:419`) | **no built-in** — user enum `## An Ordering is one of: A Less. An Equal. A Greater.` + `Inspect`; compute ONCE (§5.3) |
| `matches!(x, A \| B)` (boolean test) | `x is A or x is B` in an `If` — **NOT** an `Inspect` (§5.4) |
| match **OR-arm** `A \| B => body` | TWO `When` arms, same body (no `When A or B:`; §5.4) |
| match arm **guard** `pat if cond =>` | `If cond:` nested inside the `When` arm (§5.4) |
| range arm `0x30..=0x37 =>` | `is between 48 and 55` (INCLUSIVE; range VALUES don't 1-shift) (§5.4) |
| `Foo { a: 1, b: 2 }` / `impl Default` | `a new Foo with a 1 and b 2` (defaults set explicitly) |
| `.field` read / `p.x = 5` | `x's field` / `Set x's field to …` |
| `u32`/`u64` **wrapping** (`wrapping_*`, crypto/hash/parse-pack) | `Word32`/`Word64` (§8.2 exact ops) |
| general integer, `saturating_sub` guard | `Int` (i64, NOT wrapping); clamp with `If … then` |
| `bun.String` (JS-visible, WTF-16/Latin-1) | **decision required** — NOT blanket `Text` (§7.1) |
| `&[u8]` bytes / `Vec<u8>` | `Seq of Int` (0–255) |
| `Box<T>` / `ManuallyDrop<T>` / heap | value; structs are value-semantic |
| `Rc`/`Arc`/`&mut dyn` shared | no analog (CRDT `Shared` for actors, else copy) |
| `ThreadPool`/`Batch` job, `UnboundedQueue` | `Launch a task to f with args.` / `a Pipe of T` + `Send`/`Receive` (§10.5) |
| `AtomicU32`/`AtomicBool` shared counter (`pending_tasks`, `finished_installing`) | **no analog** (value-COW); G-CONCURRENCY G-task, or coordinator counts `done` msgs on a `Pipe` (§10.5, WAVES.md) |
| `.clone()` / `clone_into` / `clone_in` | `copy of x` (or build-fresh-and-`Return`) |
| `MimallocArena` / AST arena | `Inside a zone called "…":` (UNVERIFIED) |
| `mod` / `pub use` / `pub use X as Y` | invisible demand-prelude (no `use`); `## NoPrelude` opts out |
| `Alias::Type` | **pin-gated, unavailable now** (§9.3) |
| `const TABLE: [_; N] = …` | runtime `Seq` builder function (§10.2) |
| `<const N: usize>` / const-generic dispatch | **no analog** — runtime param or two concrete fns |
| `const _: () = { assert!(layout) }` | does not port (ABI); intent → explicit `to_bytes`/`from_bytes` |
| `let x = …` (immutable) / `let mut x` | `Let x be …` / `Let mutable x be …` |
| `SlicedString<'a> { buf, slice }` (arena pair) | just the owned `Text`/`Seq` (drop `'a` + buffer-threading) |
| every statement | ends with `.` |

---

## 12. Reviewer attack surface / least-certain claims

Claims a reviewer should hit hardest (ranked):
1. **§1.4 the `?`-elimination guidance** — the single highest-impact, highest-friction rule.
   The claim "every `?` becomes an explicit `Inspect`/`If … Return`" is a mechanical rule, but
   the exact rewrite shape for a `?`-chain across a builder (`clone_with_different_buffers`,
   `dependency.rs:214`) is *not* worked end-to-end here. A reviewer should demand a concrete
   worked port of one multi-`?` function before PORT.3 leans on it — it is the pattern the
   entire `src/install` port repeats thousands of times.
2. **§7.1 WTF-16 / Latin-1 vs UTF-8** — the `bun_core::String` 5-variant + `is_8bit()`/`is_16bit()`
   citations are solid, but the *porter guidance* ("decision per site") is judgment, not a
   mechanical rule. The exact conversion recipe for a UTF-16- or Latin-1-counted index is not
   specified because LOGOS has no verified WTF-16/Latin-1 `Text` surface. A reviewer should
   demand a concrete worked example before P5 (the JS parser / `src/js_parser`) leans on it.
   Note the Rust rewrite adds the Latin-1 8-bit case the Zig doc missed — three encodings.
3. **§5 enum discriminants (load-bearing) & §4 generic bounds** — payload matching and
   unconstrained `[T]` are verified; *explicit-value* `#[repr(u8)]` discriminants
   (lockfile-serialized, `resolver_hooks.rs:301`) and *bounded/associated-const* generics
   (`VersionInt`) are UNVERIFIED. bun leans on both heavily across `src/install/lockfile`;
   reviewer should confirm a discriminant-serialization strategy and whether bounds exist.
4. **§10 const-generics / monomorphization** — the claim "no LOGOS analog for `<const N>` or
   width-specialized layouts" is asserted from a negative corpus search. bun's `VersionType<u32
   vs u64>` two-layout split (`Version.rs:11,89`) is real; if LOGOS gained value-level
   specialization since the pin this is stale. Reviewer re-greps.
5. **§9.3 `Alias::Type` + the `Tag` collision** — asserted unavailable-at-pin from a negative
   corpus search + the card's note. bun has four distinct `Tag` enums (§9.2); without
   `Alias::Type` they must be manually renamed. If the pin has since bumped this is stale;
   reviewer re-greps and re-checks the collision workaround.
6. **UNVERIFIED-flagged surface forms** — zone body syntax (§2), `with capacity` (§3), `Pop …
   into` (§3), Map-pair iteration (§3), UFCS dot-methods (§6.1), `ord` (§7.2). Each is from
   QUICKGUIDE, not proven in corpus. A reviewer/porter must grep-confirm before first use; none
   are load-bearing for the earliest ports.
