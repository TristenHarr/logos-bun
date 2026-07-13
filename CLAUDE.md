# logos-bun — AI Assistant Constitution

This repo rewrites Bun in LOGOS. The master plan is `BAKE_A_BUN.md` (final; section
references like §6.3 point there). Campaign state lives in `WAVES.md`. Every rule below
carries a stable anchor comment — the L15 gate check greps for every anchor; deleting or
rewording a rule fails the gate. Change a rule only via the incident path (§6.3).

## The rules

<!-- ANCHOR:R1-RATCHET-IS-LAW -->
1. **The ratchet is law.** Every proven behavior lands in a checked-in ledger whose PASS set
   may only grow. Nobody hand-edits PASS entries — `scripts/promote.mjs` is the sole writer,
   and the ledger hash chain (L1) catches everything else. A confirmed PASS regression is a
   repo-wide merge freeze until fixed or formally reverted with an incident file.

<!-- ANCHOR:R2-NEVER-MODIFY-RED -->
2. **Never modify RED tests.** The test defines the spec; if a test fails, fix the
   implementation, not the test. RED tests are committed before implementation starts, and
   `scripts/workflow/commit.mjs` enforces RED-before-implementation at commit time (L10).

<!-- ANCHOR:R3-TESTS-IN-LOGOS -->
3. **Tests are written in LOGOS.** Every test we author is a `.lg` test (`## Test` sections,
   `Expect that`, `Require that`) run by `largo test`, wherever the pinned toolchain can
   express it. Node shims are bootstrap debt: each must be listed in
   `conformance/tests-shim-allowlist.tsv`, which only ever shrinks (L16). Node remains
   legitimate only where the subject is bun's own TS suite (Lane-A hosting) or npm tooling.

<!-- ANCHOR:R4-GIT-SPLIT -->
4. **The git split.** Git (init/add/commit/submodule/worktree) is authorized inside
   logos-bun ONLY (user grant, 2026-07-13), channeled through `scripts/workflow/commit.mjs`
   (named paths only; refuses `vendor/**`, out-of-manifest paths, implementation-before-RED).
   Destructive verbs (stash, reset, checkout --, clean, rebase, force-push, `add -A`,
   `add .`, `commit -a`) are forbidden everywhere (L8). In the logicaffeine repo git is
   NEVER run, no exceptions. All remote operations (push, fork, PR) are user-driven, always.

<!-- ANCHOR:R5-VENDOR-PRISTINE -->
5. **vendor/ is read-only reality.** `vendor/bun` is the pristine conformance oracle at
   SPEC_PIN — never dirtied; harness patches apply at runtime to scratch worktrees under
   `work/worktrees/` only (L7). `vendor/logicaffeine` moves only via the pin-bump ritual.
   The three bun trees never mix: `vendor/bun` (oracle) ≠ `bun-engine/` (hybrid working
   copy, W8+) ≠ the gift checkout (user's fork).

<!-- ANCHOR:R6-DONE-MEANS-GATE -->
6. **Definition of done = `scripts/gate.sh` green.** No task closes outside a wave; wave
   exits run `gate.sh --wave N` and record the result in WAVES.md. If gate.sh and WAVES.md
   disagree, the gate wins and the discrepancy becomes an incident.

<!-- ANCHOR:R7-DUAL-REPO -->
7. **Dual-repo protocol.** Every task card carries `repo:`. `repo: logicaffeine` work
   happens there under ITS CLAUDE.md (TDD, run-all-tests-fast.sh green, never git). No card
   spans both repos. **STOP rule**: if a task needs a toolchain symbol absent at
   TOOLCHAIN_PIN, stop, write a G-task card, mark the card blocked in WAVES.md. Never shim
   toolchain functionality inside logos-bun (L9).

<!-- ANCHOR:R8-BUILD-DISCIPLINE -->
8. **Build discipline.** One build at a time, ever, via `scripts/build.sh` (it holds
   `work/locks/build.lock`). One test suite at a time. Expensive commands run at loop
   boundaries, never inside agent fan-out. Stress-class tests run only under the cgroup
   wrapper (`systemd-run`), and network-hermetic tests under the offline wrapper.

<!-- ANCHOR:R9-FIX-THE-PROCESS -->
9. **Fix the process, not the code.** Mass work runs the §2.5 loop: 1 implementer +
   2 diff-only adversarial reviewers + 1 fixer, using the frozen prompts in
   `scripts/workflow/prompts/`. When output is wrong at scale, edit the prompts, not the
   files. If a workaround needs a paragraph-long justification comment, the code is wrong.

<!-- ANCHOR:R10-GIFTS -->
10. **The gift covenant** (§9.4, all 20 invariants) governs anything touching upstream bun:
    security findings go to security@bun.com first, never a public PR; provenance and
    AI-authorship are always disclosed; remote operations are the user's.

## Cheat sheet

- Build: `scripts/build.sh [--release]` (wraps `LOGOS_WORKSPACE=/home/tristen/logicaffeine
  cargo run -p logicaffeine-cli -- build`, single-flight).
- Gate: `scripts/gate.sh --quick` (pre-commit), `--full`, `--wave N` (wave exit).
- Ledger statuses: PASS / FAIL / BLOCKED(gate) / NOTIMPL / DIVERGE(reason) /
  QUARANTINE(expires=…) — semantics in §6.3.
- Lanes: A = oracle-bun hosts, logos-bun is spawned subject · B = logos-bun self-hosts ·
  C = direct exec. Assignment is total (§6.2).
- Pins: `SPEC_PIN.md` (bun oracle), `TOOLCHAIN_PIN.md` (logicaffeine). L6 verifies both
  against submodules + oracle binary sha256 every gate run.
