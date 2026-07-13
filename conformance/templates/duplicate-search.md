# Duplicate-search checklist — search before filing (§9.4 invariant 11)

Before a finding leaves `classified` for `ready`/`filed`, search bun's issues **and** open PRs
for an existing report or an in-flight fix. No duplicates, no re-filing what upstream already
has. This is invariant 11; a finding that turns out to already exist upstream is recorded in
the ledger's `duplicate` (or `superseded-upstream`) state, not filed again.

Do this while the finding is `classified` (before `ready`). For a **security** finding, do
NOT search by opening or commenting on public issues that would reveal the vulnerability —
search advisories privately and let `security-routing.md` drive (invariant 10).

## The searches (record each result in the ledger NOTE)

- [ ] **Open + closed issues** on `oven-sh/bun` for the symptom, the API name, and the error
      text. A recently-closed issue may carry a linked fix already merged (→ `superseded-upstream`).
- [ ] **Open PRs** on `oven-sh/bun` — someone may have an in-flight fix. If so, the finding is
      `duplicate`; add your differential repro as context on their PR only if it helps
      (comments ≤ 3 lines, bun rule 13).
- [ ] **Merged PRs** touching the same file/function since our SPEC_PIN — the bug may be fixed
      on `main` ahead of our pin. If so, re-baseline (`superseded-upstream`) rather than file.
- [ ] **The module's existing test file** in `test/` — the behavior may be covered (or
      xfail-marked) already; if it is, the fix updates that coverage in place (invariant 4).
- [ ] **Security advisories** (GitHub Security Advisories / `security@bun.com` context) for
      any `security=y` finding — privately, never via a public issue.
- [ ] **Our own regression bank** (`conformance/corpus`) and the drift-canary (P0.8/P0.9) —
      confirm we did not already file or already adopt this upstream.

## Decision

- **No existing report or fix found** → the finding is clear to proceed `classified → ready`
  (non-security) or stays `embargoed` under security-routing (security). Note "dup-search
  clean" with the date in the ledger NOTE.
- **An existing open issue/PR found** → set state `duplicate`; link it in the NOTE; do not
  file. Re-baseline when upstream resolves it.
- **Already fixed upstream (merged / on main ahead of pin)** → set state
  `superseded-upstream`; adopt theirs at re-baseline (invariant 19). Never re-file.

## Never

- Never file without completing this search (invariant 11).
- Never reveal a security finding through a public search action (invariant 10).
