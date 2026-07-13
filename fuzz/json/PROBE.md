# fuzz/json — bun JSON.parse vs node JSON.parse (V8 reference)

Protocol: diff.mjs fuzzes edge-case JSON (unicode/lone-surrogates/astral escapes, big+precise
numbers, dup keys, deep nesting) through both parsers, canonicalizes (code-point escaping so
surrogate/precision diffs surface), reports value-mismatches + accept/reject asymmetries.

## Verdict (2026-07-13): bun JSON.parse is CLEAN — 4000 edge-case docs @ seed 1, ZERO
disagreements with V8. bun's JSON parser is spec-correct (heavily-used, well-tested). Kept as a
passing regression lane. (Contrast bun's TOML parser, which is materially spec-incomplete —
BUG-13/14/15/16/19.) An honest negative: not every hunt finds a bug; rigor = also proving
correctness.
