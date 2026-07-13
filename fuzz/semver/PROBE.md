# fuzz/semver — differential fuzz: Bun.semver.satisfies vs node-semver (the reference)

Protocol: gen.mjs emits seeded (version, range) pairs → run each through both `Bun.semver.satisfies`
(via the oracle binary --eval) and node-semver `satisfies`. A disagreement where BOTH inputs are
valid (semver.valid(v) && semver.validRange(r)) is a candidate BUN bug (triage: ours/theirs/
spec-ambiguity per §9.4 inv 15). Bun-lenient-on-invalid-ranges cases (">", "latest", wildcard-in-
hyphen) are spec-ambiguity, filtered out. Reproduce: `node fuzz/semver/diff.mjs <seed> <n>`.

Banked regression: seed=1 n=10000 → 80 valid-input disagreements, root cause = BUG-12 (trailing
exact-version conjunct dropped in a compound AND range that starts with an inequality).
