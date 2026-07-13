# fuzz/stringwidth — Bun.stringWidth vs string-width  ⚠️ REFERENCE-DISPUTED, low signal

Protocol: diff.mjs fuzzes random width-relevant strings (CJK, emoji, ZWJ, regional indicators,
variation selectors, combining marks, ANSI) through Bun.stringWidth vs the `string-width` npm
package.

## Triage verdict (2026-07-13): NOT a bun-bug source — no authoritative reference.
Seed 3, 6000 strings → 2475 disagreements, but EVERY one clusters in disputed Unicode-width
territory: lone regional indicators (U+1F1E6..), variation selectors (U+FE0F), ZWJ sequences
(U+200D), combining marks. `string-width@4` uses OUTDATED emoji/width tables; bun uses modern
ones. Bun is correct on all UNAMBIGUOUS cases (ASCII, plain CJK wide, fullwidth/halfwidth kana).
Per §9.4 invariant 15 these are **spec-ambiguity / reference-outdated**, NOT bun defects — we do
NOT claim them (a false accusation is worse than no finding). Kept as a documented dead-end so a
future iteration doesn't re-investigate.

## Good differential targets (spec-backed reference → real bugs, like semver→node-semver=BUG-12):
Bun.TOML vs @iarna/toml (TOML has a spec), the JSON/JSONC parser vs the JSON spec, semver (done).
Avoid: stringWidth, glob (multiple defensible interpretations) — no single authority.
