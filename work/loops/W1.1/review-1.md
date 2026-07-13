# W1.1 ledger keystone — review 1 (correctness/integrity) — VERDICT: CHANGES-REQUIRED

All findings EMPIRICALLY reproduced under /tmp, read-only, no repo write.

## FINDING 1 (FATAL): committed unchanged ledger fails its own L1 chain via gate's absolute-path invocation
gate.sh:76 invokes lint with ABSOLUTE path → priorState step 2 (`git show HEAD:<rel>`,
ledger-lint.mjs:149-169) returns the file's OWN committed version → prevChain = the
ledger's own trailer → checkChain (`:172-178`) requires sha256(own_trailer ‖ body) ==
own_trailer, a hash fixed-point (impossible). `gate.sh --quick` is RED on the real tree
(8 failures). Re-sealing+committing just shifts the paradox to the next lint. RED battery
green only via a RELATIVE-path accident (rel→basename→`git show HEAD:p0.tsv` fails→GENESIS).
NO fixture asserts a clean committed .head-less ledger passes L1 → zero coverage.
Files: ledger-lint.mjs:149-169,172-178; gate.sh:76.

## FINDING 2 (CRITICAL): monotonicity never enumerates baseline ledgers — rename/delete erases PASS set silently
SCHEMA §5 promises "the lint enumerates baseline ledgers, not just working-tree files."
UNIMPLEMENTED. `git mv p0.tsv p1.tsv` + gut p1 → lints clean (p1's own HEAD absent→GENESIS→
empty baseline); gate globs WORKING-TREE *.tsv only (gate.sh:72-73) so vanished p0 never
linted. Proven PASS erased, no incident/marker. `git rm` same class.
Files: ledger-lint.mjs:181-215 (checkMonotone); gate.sh:70-80.

## FINDING 3 (CRITICAL): run-store "provenance" provides zero protection over the chain
Run store uses the SAME unkeyed sha256-over-public-inputs chain — no independent root of
trust. Anyone who can write the ledger writes the run store + recomputes both with
sha256sum. Reproduced: fabricated PASS + runs/evil.runs.tsv (5 pass / 2 ts / asserts=42),
chained from GENESIS → `ledger-lint ok`, exit 0 (both non-git and committed-at-HEAD).
SCHEMA §0 leg-3 claim "this is what actually stops a hand-planted PASS" is empirically
false — only git review (leg 1) survives. SECONDARY: provenance counts run-store ROWS not
distinct runs (`:237-244`) → "5/5 across ≥2 ts" satisfiable by 2 physical runs.
Files: ledger-lint.mjs:219-247,226-228.

## FINDING 4 (HIGH): §5 transition table decorative for non-PASS baseline rows
checkMonotone enforces only PASS-shrink + asserts-monotone; never compares a non-PASS
baseline status to its successor. `DIVERGE(telemetry no-op)` ("never transitions") flipped
to FAIL → lints clean. Opens DIVERGE→FAIL→promote→PASS laundering.
Files: ledger-lint.mjs:181-215.

## Lower severity
- CLI no-args default resolves ledger dir relative to SCRIPT location not cwd
  (ledger-lint.mjs:344-346) — from another checkout, silently lints logos-bun's ledgers.
- f4 fixture passes for the wrong reason (internal L1 mismatch ignored; asserts only "expir").

## Required direction (fixer)
1. Kill the fixed-point: the file-level trailer must be verifiable for a committed unchanged
   ledger WITHOUT a git round-trip that returns self. Simplest honest design: trailer =
   sha256(body) as an ACCIDENTAL-EDIT/corruption tripwire (verified with no git); move all
   anti-forgery framing OFF the chain. OR implement a genuine cross-commit chain verified by
   walking the file's git history (heavier) — pick one, document it truthfully.
2. Implement baseline-ledger ENUMERATION in monotonicity (`git ls-tree HEAD
   conformance/ledger/`), and make the gate lint every baseline ledger even if absent from
   the working tree. Add fixtures: rename-erases and delete-erases must go RED.
3. Enforce the FULL transition table for non-PASS baseline rows.
4. Count DISTINCT timestamps (not rows) for provenance; rewrite SCHEMA §0/§5 threat model to
   state honestly that anti-forgery rests on git review + monotonicity + visibility, NOT the
   unkeyed chain or the recomputable run store.
5. Add the missing positive fixture: a clean committed .head-less ledger PASSES L1.
