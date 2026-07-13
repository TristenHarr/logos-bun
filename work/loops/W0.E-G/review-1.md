# W0.E-G review 1 (correctness lens) — VERDICT: CHANGES-REQUIRED

## MAJOR-1: cross-module ENUMS uncovered — AOT emits invalid Rust with raw `::`
codegen/types.rs:472 (enum decl), :507/:510/:524 (Default impl), :535 (wire impls),
codegen/expr.rs:2872 (Expr::NewVariant) all resolve the enum name WITHOUT rust_type_ident.
Reachable: merge_registry namespaces imported enums (`Colors::Hue`); find_variant
(parser mod.rs:527) returns the namespaced key. Repro: imported `## A Hue is one of:
Red, Green.` + `Let h be a new Red.` → `pub enum Colors::Hue` (rustc-invalid).
Tier divergence: interpreter (symbol-keyed) runs; AOT fails to compile. Zero test coverage.

## MAJOR-2: the AOT battery is string-only
compile_project returns rust_code as String; all AOT assertions are `.contains(...)`.
The 263 program's AOT output is never rustc-compiled or executed. Cannot catch MAJOR-1
or any miscompile. Required: at least one test that compiles AND runs the emitted Rust
(expect 263), plus an enum-path lock.

## MINOR: sanitization collision
Imported `Geometry::Point` + local type literally named `Geometry__Point` both lower to
`Geometry__Point` → duplicate struct, rustc error, silent at LOGOS level. Exotic.

## Attacked and held
- Lexer collisions (time literals, block/annotation colons, Text containing `::`,
  chained A::B::C): is_namespace_colon requires doubled colon between ident chars. Held.
- Interning contract: token text byte-matches merge_registry format; nothing anywhere
  re-splits on `::` (opaque until codegen). Held.
- Struct codegen: all 7 sites + construction consistent. Held (structs only).
- VM tier: vm/{machine,isa,pebble}.rs changes are the SIBLING EXODIA stream, not this
  feature; VM keys structs by opaque string name — flows through. Interpreter symbol-keyed.
  Held.

## Negative-path note
`Bogus::Point` currently fails only at the rustc stage (dangling ident) — loud but not
LOGOS-level. Typechecker existence check stays a flagged follow-up (matches implementer's
own report).
