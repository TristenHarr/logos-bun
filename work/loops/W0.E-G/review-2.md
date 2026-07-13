# W0.E-G review 2 (blast-radius lens) — VERDICT: CHANGES-REQUIRED

## BLOCKER (converges with review-1 MAJOR-1, sharpened): enum codegen unsanitized AND unconditional
- discovery.rs:143-158 qualifies imported ENUMS too (`Colors::Filter`).
- program.rs:570-582,594 builds `enums` unconditionally from registry.iter_types() →
  **importing any module that declares an enum breaks AOT even if the enum is never used**.
- Raw-resolve sites: types.rs:464,472,507,510,524,535 (decl/Default/wire impls),
  expr.rs:2872 (NewVariant), stmt.rs:2772-2790 (Inspect arm enum_prefix).
- Battery misses it: fixtures only use structs; compile_project never invokes rustc.

## Surfaces attacked and held
- NL/logic-mode: glue needs doubled colon between ident chars; ordered after is_time_colon;
  phase1_garden_path 2/2 PASS. Held.
- Single-module byte-identity: rust_type_ident is a guarded no-op without `::`. e2e_structs
  6/6 PASS. Held.
- LSP span math: glued token span covers all of A::B, ASCII alignment correct. Held.
- Wire/Showable (struct side): consistent sanitized name. Held.
- **PE/Futamura round-trip: SYMMETRIC** — decompile_type_expr (compile.rs:5368) prints the
  interned `::` name which re-lexes to the same single Word; `__` exists only at the Rust
  boundary, never re-parsed. Held.

## Sibling-stream classification (co-resident tree changes, NOT this feature)
- vm/isa.rs, vm/pebble.rs: no diff vs HEAD. vm/machine.rs: +3794 lines (VM stream).
- compile.rs +262 lines (`Stmt::TestDef/Expect` PE encoding) + lexer `BlockType::Test`:
  the in-progress `## Test` framework stream. It breaks logicaffeine-language compile
  (teach_lock.rs:88 non-exhaustive) and causes the 3 jones_fidelity_lock failures.
  → W1.9 (G13 largo test) MUST coordinate with this stream before starting.

## Empirical
multimodule_types+phase36_modules+e2e_structs 25/25 · phase1_garden_path 2/2 ·
jones_fidelity_lock 3/6 (failures = sibling streams) · logicaffeine-language: cannot
compile (sibling break), 268 tests unrunnable at review time.

## Required fix
Route every enum-name emission through rust_type_ident (types.rs 464+472/507/510/524/535,
expr.rs:2872, stmt.rs:2772-2790); add a namespaced-ENUM battery case (imported
`## A Filter is one of:` constructed + Inspect-matched, assert `Filter__`/no raw `::`);
close the string-only blind spot with a real compile-and-run AOT test.
