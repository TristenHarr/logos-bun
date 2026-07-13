# SPEC_PIN — the bun conformance oracle

Re-baselining this pin is a deliberate, documented event (ritual below). All conformance
claims are relative to exactly this pin.

| Field | Value |
|---|---|
| Upstream | https://github.com/oven-sh/bun |
| Tag | `43ee038` (v1.4.0-canary.1 — **the Rust rewrite**; a dev commit, not a release tag) |
| Tag commit SHA | `43ee03834ca77f9f218cc998a0df7fb8b301ff53` |
| Oracle binary | **built from source** (release profile) via `scripts/bootstrap/build-oracle-rust.sh`, bootstrapped by the 1.3.14 binary; WebKit prebuilt. Revision `1.4.0-canary.1+43ee03834` |
| Binary sha256 | `c3a199d737aa19a53f9d32bdaae7b0598ede4c222b6fcba18886f27a9ef63a79` |
| `bun --version` output | `1.4.0` |
| Test-file count at tag | `1881` (glob `test/**/*.test.{ts,tsx,js,jsx,mjs,cjs,mts}`, counted mechanically at the commit) |

Notes:
- **This is the RUST rewrite** (1516 .rs, matching BAKE_A_BUN §1.1) — the thesis is Rust→LOGOS.
  The pre-rewrite Zig release `bun-v1.3.14` (0d9b296) is now non-normative; it served only as
  the bootstrap binary to build this one.
- The oracle binary lives at `vendor-artifacts/oracle-bun/bun` (gitignored; sha256 above is
  the integrity anchor, verified by gate check L6 on every run; rebuild via
  `scripts/bootstrap/build-oracle-rust.sh` — needs clang-21/lld-21/ninja/ccache).

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
