# fuzz/toml — Bun.TOML.parse vs @iarna/toml (spec-conformant reference)

Protocol: gen.mjs emits random VALID TOML docs (ints in all bases, string escapes, quoted/dotted
keys, inline tables, arrays, nested + arrays-of-tables). diff.mjs parses each with both engines,
canonicalizes (normalizing BigInt/number/Date representation so only genuine value/structure diffs
surface), and reports: value-mismatches (both parse, differ), bun-rejects-a-valid-doc, and
bun-accepts-an-invalid-doc (leniency = usually spec-ambiguity, not a bug). Reproduce:
`node fuzz/toml/diff.mjs [seed] [n]`. seed 1 / 2000 → 175 value-mismatches, two root causes:
BUG-13 (\U 8-digit escape undecoded) + BUG-14 (multiline line-continuation drops leading-ws trim).

Triage note: the 404 "bun accepts reference-invalid" cases are bun implementing non-TOML escapes
(\v, octal \0-\7 — JS/C style, per src/parsers/toml/lexer.rs:849). That's a leniency (accepts
strings the spec forbids), classified spec-ambiguity for now, NOT filed — worth a look later.
