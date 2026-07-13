# PORT.1 — PORTING_RUST_TO_LOGOS.md (the Rust→LOGOS idiom map)

repo: logos-bun. Toolchain-independent (pure analysis). §7 prep gate: adversarially reviewed
BEFORE any mass port fans out. Seeds every P2/P4/P5/P6/P9 port workflow.

## Deliverable
`PORTING_RUST_TO_LOGOS.md` at repo root — the frozen pattern map: how bun's Rust idioms render
as LOGOS idioms. Ground EVERY pattern in real code: cite a concrete bun Rust snippet (from
vendor/bun/src/**, read-only) AND the LOGOS rendering (cite a real construct from
vendor/logicaffeine — the crypto.lg/uuid.lg modules, the docs guides, LOGOS_QUICKGUIDE.md if
present in vendor/logicaffeine, the test corpus). No hand-waving — a porter must be able to
follow it mechanically.

Cover at minimum:
- **Result/Option plumbing** — Rust `Result<T,E>`/`?`/`Option` → LOGOS error handling
  (Requires/Ensures contracts? Option-of-T? how does LOGOS propagate errors — find the actual
  mechanism in the language, don't invent one).
- **Ownership** — Box/Rc/Arc/lifetimes → LOGOS value-semantics + arena model (§ the memory
  model; how LOGOS structs are value-semantic, when things are shared).
- **Slices & iterators** — `&[T]`, `.iter().map().collect()`, ranges → LOGOS Seq + Repeat/for +
  the (proposed vs real) map/filter surface. Flag which iterator combinators exist vs must
  desugar to Repeat+Push.
- **Traits & generics** — `impl Trait`, trait objects, const generics → LOGOS generic types
  (`Box of Int`), operator-trait newtypes (the Word types), the type system's actual capabilities.
- **Enums & match** — Rust enums + exhaustive match → LOGOS `## X is one of:` + Inspect/When.
- **Structs & construction** — `Foo { a, b }` → `a new Foo with a .. and b ..`; field access.
- **Strings & bytes** — Rust `String`/`&str`/`Vec<u8>`/`[u8]` → LOGOS Text (UTF-8) vs the Word
  types vs raw bytes. THE big trap (WTF-16 vs UTF-8 — cross-ref SEMANTIC_TRAPS).
- **Integer semantics** — u8/u32/i64/usize, wrapping/overflow → LOGOS Int/Nat + Word8/16/32/64
  (the ℤ/2ⁿ ring newtypes). Which bun code needs Word types (crypto, parsers, hashing).
- **Modules & visibility** — Rust `mod`/`pub use` → LOGOS markdown-link imports + namespaced
  types (Alias::Type — the W0.E-G feature; note it's uncommitted-in-live pending pin bump).
- **Const/comptime** — Rust const fns, const generics → LOGOS equivalents or "no direct analog,
  compute at runtime".

## Process (§2.5 plan-docs-first)
Written by this implementer, then a 2-diff-only-reviewer + fixer doc-review round (the
orchestrator runs it) BEFORE the doc is frozen. Conflicting guidance killed before it fans out.

## Exit / ratchet
The doc is frozen; post-freeze edits require the incident path. It's a reference, not a gate,
but PORT.3 (the trial) validates it against a real port.

## Manifest
PORTING_RUST_TO_LOGOS.md only. Read-only on vendor/**. No build. No commit.
