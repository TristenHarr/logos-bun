<!--
  gift-pr-body.md — the PR body every logos-bun gift to oven-sh/bun uses.

  Grounded in bun's ACTUAL conventions (vendor/bun, read-only):
    • bun's PR template is exactly two headings — "### What does this PR do?" and
      "### How did you verify your code works?" (vendor/bun/.github/pull_request_template.md).
      We keep those two headings verbatim and add the covenant's mandatory provenance &
      AI-authorship disclosure block (§9.4 invariants 12–13).
    • bun's CLAUDE.md rule 11: "be humble & honest — NEVER overstate what works." The
      disclosure below states the finding method and authorship plainly, without overstatement.
    • bun's CLAUDE.md rule 12: the branch is `claude/gift-<slug>` (their CI requires the
      `claude/` prefix; the `gift-` infix marks provenance). The PR targets oven-sh/bun.
    • Verification follows their most-enforced rule: the test must FAIL under
      `USE_SYSTEM_BUN=1 bun test <file>` and PASS under `bun bd test <file>`
      (vendor/bun/CLAUDE.md, "Testing" — the test is NOT VALID if it passes with USE_SYSTEM_BUN=1).

  Filling rules (the covenant, mechanized elsewhere by GIFT.3):
    • The test ships in the SAME PR, in bun's format/folder — the existing test file for the
      module, not a new file (invariant 4). test/regression/issue/<N>.test.ts ONLY for a REAL
      GitHub issue number that is a true regression (invariant 5) — our differential finds are
      usually never-worked, so they go in the module's existing file.
    • Fix the whole bug class in one PR (every sibling site); if a site is intentionally
      excluded, say so (invariant 1).
    • Comments in the diff stay ≤ 3 lines (bun rule 13); a regression test gets exactly one
      comment — the issue URL (invariant 18).
    • Security findings NEVER open a public PR first — use security-routing.md; a security=y
      row in upstream-gifts.tsv carrying a PR/issue URL is a gifts-lint FAILURE (invariant 10).
    • Remote actions (push, PR open/update) are USER-DRIVEN; Claude only prepares this content
      (invariant 20). Delete this comment block before the PR is opened.
-->

### What does this PR do?

<!-- One bug, one fix, one test — but fix the whole bug class. Name the exact behavior that
     was wrong and what it is now. Fix the layer that OWNS the invariant, not the symptom
     site; state the root-cause mechanism ("the crash goes away" is not a root cause,
     invariant 2). List every sibling site touched (parallel switch arms, sync/async twins,
     POSIX/Windows branches, every caller of a changed helper); if a site is intentionally
     excluded, say why (invariant 1). Match the file's local conventions and in-tree helpers
     (invariant 3). -->

-

### How did you verify your code works?

<!-- An automated test ships in THIS PR, in bun's format and the module's existing test file
     (invariant 4). Show it fails for the right reason and passes on the fix: -->

- Fails on the unfixed build: `USE_SYSTEM_BUN=1 bun test <file>` (the test is NOT VALID if it
  passes here).
- Passes on the fix: `bun bd test <file>`.
- Non-flaky: no `setTimeout`; the condition is awaited; N reruns green (invariant 7). Exact
  normalized assertions (`toBe` over `toContain`), `port: 0`, hermetic (no live network),
  resources released via `using` before assertions (invariant 6).
- Cross-platform: `bun run rust:check-all` (or `bun run zig:check-all` for Zig) so
  `#[cfg]`-gated code type-checks on linux/macos/windows × x64/aarch64 (invariant 14).
- Memory-safety fixes carry the specific proof: the crashing input as a spawned fixture; an
  ASan repro on the unfixed build or a leak regression test (`Bun.gc(true)` + `heapStats`,
  RSS thresholds with headroom) (invariant 8).

<!-- ─────────────────────────────────────────────────────────────────────────────
     PROVENANCE & AI-AUTHORSHIP DISCLOSURE (mandatory — §9.4 invariants 12–13).
     This block is required on every gift PR and MUST NOT be removed. -->

### Provenance & authorship disclosure

- **How this was found.** This divergence was surfaced by **differential fuzzing of bun
  against an independent reimplementation** (the LOGOS rewrite of bun, `logos-bun`): the two
  implementations were driven head-to-head on the same inputs and this behavior differed.
  It was then triaged as a genuine upstream bug (classification `theirs`) before filing.
- **Authorship.** The fix and its test are **Claude-authored and human-reviewed** (a human
  read every line, ran the verification above, and opened this PR). Stated plainly and
  without overstatement, per bun's own humility rule.
- **License & derivation.** This change is **clean-room and contains nothing derived from the
  BSL-licensed logos-bun / logicaffeine sources** — it is a fix expressed in bun's own idioms,
  not a transplant of our code (invariant 13). Contributor terms (CLA/DCO) are satisfied as
  GitHub presents them at PR time (user-confirmed).
- **Not load-bearing on our side.** logos-bun does not depend on this being accepted; our
  conformance runs against the pinned bun regardless (invariant 19). If upstream fixes the
  same bug differently, we adopt yours and re-baseline.
