# PORT.2 — SEMANTIC_TRAPS.tsv (the Rust→LOGOS divergence taxonomy)

repo: logos-bun. Toolchain-independent. §7 prep gate: adversarially reviewed before mass port.
The Rust→LOGOS analog of the Zig→Rust rewrite's 19-regression taxonomy — every trap = code
that's *syntactically similar, semantically different*, where a mechanical port silently breaks.

## Deliverable
`SEMANTIC_TRAPS.tsv` at repo root: `TRAP-ID ⇥ class ⇥ rust-shape ⇥ logos-shape ⇥ divergence ⇥
fuzz-focus ⇥ example`. Each row = a concrete trap with a fuzz-generator focus (§8) that targets
it. Cover the §7-named trap classes AND any you find reading bun's parsers:

- **1-based vs 0-based indexing** — THE documented LOGOS bracket footgun (`item 1 of xs` is the
  first element; `item 0` is a compile error, `xs[0]` underflows). Every bun `arr[i]`/`arr[0]`
  loop is a landmine. Fuzz-focus: index-boundary generation.
- **Integer div/overflow/wrapping** — Rust `/` truncates, `wrapping_add`, `usize` underflow →
  LOGOS Int vs Word (ℤ/2ⁿ). Which bun sites rely on wrapping (hashing, parsers). Fuzz: near-
  MAX/MIN, div-by-zero, negative div.
- **UTF-8 Text vs WTF-16 vs raw bytes** — bun strings are WTF-16; LOGOS Text is UTF-8; parsers
  work on bytes. A port that treats a byte offset as a char index breaks on multibyte. Fuzz:
  surrogate pairs, multibyte, lone surrogates.
- **Value vs reference semantics** — Rust `&mut`/shared refs vs LOGOS value-semantic structs/
  collections (a struct assignment COPIES — the W0.E-G cow-struct finding). A port relying on
  aliased mutation silently diverges. Fuzz: mutate-after-copy.
- **Arena vs Rc lifetime mapping** — bun's bumpalo/Box ownership → LOGOS arena; dangling/
  use-after-scope analogs.
- **Assert-with-side-effects** — Rust `debug_assert!(expr_with_effect)` (their regression) →
  LOGOS Assert (debug, stripped in release) vs Require (survives). A side-effecting Assert
  vanishes in release. Fuzz: assert-with-mutation.
- **Comptime/const-generic analogs** — their `Output.pretty` regression class.
- **Recursive-descent stack depth** — every LOGOS parser needs explicit depth limits with
  RangeError semantics (their TOML 25k-nesting test = the spec). Fuzz: deep-nesting generators.

## Process (§2.5)
Written, then 2-diff-only-reviewer + fixer doc-review round before freeze. Every trap class
MUST name a concrete fuzz-generator focus (the P2+ fuzz batteries target these).

## Exit / ratchet
Frozen; each trap's fuzz-focus is a commitment the P2+ fuzz generators honor. PORT.3 validates.

## Manifest
SEMANTIC_TRAPS.tsv only. Read-only on vendor/**. No build. No commit.
