# Wave-1 cross-integration review + Lane-A smoke — 1 BLOCKER, else COMPOSES

## PART A — Lane-A end-to-end smoke (the Wave-1 lock criterion): WORKS, with 1 blocker inside
Proven chain: build.sh --release (22.6s) → binary `bun` prints 1.3.14 byte-exact vs oracle →
worktree.mjs patched (bunExe honors BUN_EXE_OVERRIDE at harness.ts:143-148, vendor pristine) →
Lane-A .test.ts (spawns subject, asserts on CHILD --version) hosted on ORACLE via runner.mjs
--lane A → 2 pass/0 fail. **preload.ts strip seam HOLDS**: BUN_EXE_OVERRIDE survives only because
bunEnv={...process.env} snapshots it at harness load (fragile — an explicit-allowlist bunEnv would
break Lane A silently, but correct today). Queue LANE=A row + chained runs/laneA.runs.tsv via
sealRunStore → promote.mjs (5 pass across 3 ts) → FAIL→PASS with real 40-hex first-green (5d2220e)
→ ledger-lint L1/L2/L3 green.

## BLOCKER (blocks LOCK): W1.2↔W1.3 assert-sink format mismatch → asserts=0 for every real test
Patch 0002 WRITES sink as `${file}\t${count}` (harness.ts:87); runner.mjs READS with
`parseInt(readFileSync(sink).trim())` (169-171) → on a `/path...` string returns NaN → executed=0.
The harness patch DOES count (sink held `…test.ts\t4`); the runner's parser is wrong → a real
4-assertion test promotes as a 0-assertion "proof", disarming the anti-skip invariant on the exact
lane Wave 1 exists to enable. Chain/promote/provenance/monotonicity/freeze all correct; one parser.
→ FIXER DISPATCHED (a909d993): parse the file\tcount line format, sum trailing counts.

## PART B — all seams COMPOSE (evidence)
1. chainDigest/priorState reuse: all 4 consumers read only .prevChain; committed p0.tsv resolves
   prevChain=GENESIS (not self-HEAD — the fixed-point is dead), body recomputes to own trailer, L1
   passes. sealRunStore body verifies byte-identical under core digest (ae41b079 both sides).
2. gate l4/l5 B1 fix: planted an off-tag EISDIR crash (message has neither 'L4 lane lint' nor
   'L5 assert-parity') → BOTH red the gate now; old tag-sieve credited it pass. _ledger_gate B1
   survived (gate.sh:111,116). Sequence line 237 calls every l-fn.
3. diffcli vs real oracle: oracle-vs-oracle --version equal; oracle-vs-logos --help WITH versions
   normalizer active → equal:false, diff surfaced (logos help is empty), normalizers recorded in
   verdict (auditable). Version mask can't hide a real divergence.
4. worktree hygiene: --clean --all → work/worktrees/ empty, vendor/bun pristine @ 0d9b296, no leaks.
5. freeze: .merge-freeze → gate --quick FREEZE red + commit.mjs refuses exit 6; removed → green.

## Cleanup: vendor pristine, no worktree leaks, scratch removed, gate --full green.
## Note: the reviewer flagged WAVES.md + W1.9 card mods as "sibling stream" — those are the
## ORCHESTRATOR's G13-recon doc updates (mine), not a conflict.
