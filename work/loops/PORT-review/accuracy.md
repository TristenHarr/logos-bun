# PORT docs — accuracy review — VERDICT: ACCURATE-ENOUGH-TO-FREEZE (5 minor citation fixes)

Every load-bearing semantic claim (the ones that drive the fuzzers) VERIFIED against real lines:
1-based indexing + `item 0`=ZeroIndex COMPILE error (parser/mod.rs:1509, error.rs:448); Int→BigInt
on overflow NOT wrap (arith.rs:443-446); Text=UTF-8 codepoints (types.rs:33, collections.rs:49/119,
text_bytes("abc")→169,153 at e2e_codegen_uuid.rs:120); Assert→debug_assert stripped vs
Require→assert survives (codegen/stmt.rs:2298-2300); value-COW (collections.rs:394); AST depth
128 abort (ast_depth.rs:45); div/0 catchable Err + i64::MIN/-1→BigInt + `/`trunc `//`floor
(arith.rs:850/873/953); 7/2=3 10/2=5 (e2e_expressions.rs:100/33). All UNVERIFIED items correctly
flagged. NO cross-doc contradictions. Rust semantics (overflow debug-panic/release-wrap, div/0
both modes, `?`=invisible early-return+.into()) CORRECT + cited (wyhash/lib.rs:573, toml/lexer.rs).

## MINOR citation-precision fixes (claim correct, ref wrong):
- M1: SEMANTIC_TRAPS TRAP-02 — ZeroIndex is parser/mod.rs:1509 (not :1531), error at
  language/src/error.rs:448 (not parser/error.rs:457 — that FILE doesn't exist).
- M2: TRAP-12 — Assert/Require at codegen/stmt.rs:2298-2300 (not :2315-2319).
- M3: PORTING §8.3 — 7/2=3 is e2e_expressions.rs:100/:33 (not e2e_operators.rs — doesn't exist).
- M4: cross-doc — PORTING "three encodings" (bun-side) vs TRAPS "four bases" (bun+LOGOS) — add a
  one-word cross-ref so it doesn't read as a discrepancy.
- M5: PORTING §7.1 — is_16bit() is string/mod.rs:566 (not bun_alloc/lib.rs:1513=is_8bit());
  borrow_utf8 sig :187; §8.3 `%` sites uuid.lg:32/:210-220 (not :213); e2e_codegen_uuid.rs:111/120.

## Non-finding footnote: arith.rs:983 exact_divide (Rational, ExactDivide op) is a sibling of
truncating divide; docs correctly describe current-pin `Divide`=trunc; arith.rs:1953 flags a
future Int/Int→Rational R2 flip → §8.3 could go stale at a pin bump (covered by pin-caveat).
