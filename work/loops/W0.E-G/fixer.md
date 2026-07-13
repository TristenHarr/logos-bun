# W0.E-G fixer — both MAJORs CLOSED

## MAJOR-1 (enum path) — closed
Every enum-name-into-Rust site routed through rust_type_ident, with a deliberate
raw-vs-sanitized split (raw interned name kept for recursion detection + boxed-field
lookup keys; sanitized for all emission): types.rs:464-471/479/515/518/531/541 (+wire
impls :71/:92), expr.rs:2871-2943 (NewVariant), stmt.rs:2771-2794 (Inspect arms),
ffi.rs:1032/1139/1156-1216 (C-export shim Rust-type positions — beyond reviewers' list).
Unconditional emission now safe (imported_but_unused_enum test compiles AND runs).
Completeness greps run over codegen/*.rs; remaining raw resolves are internal keys only.

## MAJOR-2 (string-only AOT battery) — closed
tests/common/mod.rs: extracted run_rust_project(rust_code, deps, args) from
run_logos_with_args (shared build+run path). multimodule_types.rs now 14 tests incl.
compile-AND-RUN: 263 toy executes, enum program prints "sepia", unused-enum-import runs,
global no-raw-:: guard over all fixtures. RED captured against pre-fix code
(pub enum Colors::Filter emitted — rustc-invalid).

## GREEN
multimodule_types 14/14 · struct/module neighbors 32/32 · e2e enums 17/17 ·
phase_ffi_requires 156/156.

## MINOR (Alias__Type collision) — documented follow-up, not fixed
Clean LOGOS-level error needs codegen_program* String→Result threading (large blast
radius for an exotic case). Today: loud rustc duplicate-type error, never silent.

## Sibling boundary respected
No vm/machine.rs, no BlockType::Test/teach_lock, no git, one suite at a time.

## Feature file inventory (for the user's logicaffeine commit — OUR stream only)
- crates/logicaffeine_language/src/lexer.rs (is_namespace_colon glue arm)
- crates/logicaffeine_compile/src/codegen/{types.rs,expr.rs,stmt.rs,ffi.rs}
- crates/logicaffeine_tests/tests/multimodule_types.rs (14-test battery)
- crates/logicaffeine_tests/tests/common/mod.rs (run_rust_project extraction)
NOT ours (sibling streams, do not bundle): vm/machine.rs, compile.rs TestDef/Expect work,
lexer BlockType::Test portions if separable, teach_lock.rs.
NOTE: lexer.rs contains BOTH streams' edits — flag to user at commit time.
