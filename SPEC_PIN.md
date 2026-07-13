# SPEC_PIN — the bun conformance oracle

Re-baselining this pin is a deliberate, documented event (ritual below). All conformance
claims are relative to exactly this pin.

| Field | Value |
|---|---|
| Upstream | https://github.com/oven-sh/bun |
| Tag | `bun-v1.3.14` |
| Tag commit SHA | `0d9b296af33f2b851fcbf4df3e9ec89751734ba4` |
| Oracle binary | official release asset `bun-linux-x64.zip` (AVX2 baseline not required — box has AVX2) |
| Binary sha256 | `9fd36f87e4b90b07632b987a2e4ec81ca15a62c81bf983190cea6d715be2ad74` |
| `bun --version` output | `1.3.14` |
| Test-file count at tag | `1731` (glob `test/**/*.test.{ts,tsx,js,jsx,mjs,cjs,mts}`, counted mechanically at the tag) |

Notes:
- The dev checkout at `/home/tristen/logicaffeine/bun` (43ee038, 1.4.0-dev) is
  **non-normative** — reference reading only.
- The oracle binary lives at `vendor-artifacts/oracle-bun/bun` (gitignored; sha256 above is
  the integrity anchor, verified by gate check L6 on every run; `scripts/bootstrap/
  fetch-oracle.sh` re-materializes it).

## Re-baseline ritual (§6.3 drift-canary feeds this)

1. Pick the new tag; update every field above in one commit.
2. Bump the `vendor/bun` submodule to the new tag SHA.
3. Re-apply `conformance/patches/` to a scratch worktree — an apply failure is a loud stop.
4. Re-count test files mechanically; run frontier-scan over files added since the old pin —
   the non-blocking drift lane (`conformance/ledger/drift.tsv`, produced by
   `conformance/drift-canary.mjs`) is the pre-computed worklist of exactly those upstream-new,
   ledger-uncovered files, so a bump is a planned absorption, not a surprise; triage each new
   file into a phase in the ledger.
5. Fetch + sha256 the new oracle binary; `oracle-pin` test green.
6. Record the event in `conformance/incidents/` (re-baselines are incidents by convention —
   planned absorptions, not surprises).
