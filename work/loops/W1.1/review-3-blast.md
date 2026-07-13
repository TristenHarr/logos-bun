# W1.1 ledger keystone — review 3 (integration/blast-radius) — VERDICT: CHANGES-REQUIRED

Reproduced on /tmp fixtures against real scripts. The load-bearing failures B1/B2.

## BLOCKER B1 (MOST IMPORTANT): gate.sh _ledger_gate is a TEXT-MATCH SIEVE
gate.sh:69-87 credits `pass` unless lint output substring-matches `L1 chain` /
`L2 (monotonicity|provenance)` / `L3 expiry`. Lint exits 1 correctly, but EVERY other
failure is GREEN: bad STATUS, bad LANE, empty key, CR byte, missing final newline,
stray/dup #CHAIN, non-byte-exact trailer, interstitial blank, wrong field count, unreal
QUARANTINE date, all PASS field invariants, dup key, coarse/fine collision, AND the
committed-marker ban (L9). W1.6's planted violations of these classes → GREEN (gate-audit
would falsely pass). FIX FIRST: _ledger_gate fails on lint NONZERO EXIT, not tag substring.
This single fix converts all un-surfaced checks (B2, M2's future .head ban, m4) into real
gates.

## BLOCKER B2: committed-marker ban unenforced by gate; .merge-freeze consumed by nothing
checkMarkersNotCommitted fires (lint exit 1) but its message is untagged → gate GREEN with a
committed .ratchet-break (SCHEMA §9 "anyone unlocks demotions forever"). Separately
.merge-freeze is only WRITTEN + banned-if-committed, never CONSUMED: gate --quick, commit.mjs,
pre-commit never check it → a "frozen" repo commits normally. FIX: B1 surfaces the ban;
commit.mjs + gate.sh must REFUSE when .merge-freeze exists (freeze must actually block).

## BLOCKER B3: run-store "frontier-scan" = whole-history-must-be-clean → frontier keys un-promotable
ledger-lint.mjs:240 + promote.mjs:60 reject if the ENTIRE append-only history has any `fail`.
record-run.mjs (W1.2, built) records fail rows in normal dev → a FAIL-frontier candidate
accumulates permanent fails → never promotable. FIX: scan a RECENT WINDOW (last N runs must
be 5/5 across ≥2 ts), OR redefine + stop recording fails (contradicts §6.1 append-only).
Pick the window approach; W1.2's record-run stays as-is (consumer-side fix).

## MAJOR M1: priorState relative-path → GENESIS (= review-2 BLOCKER-A). Silent monotonicity disable.
## MAJOR M2: committable *.tsv.head forges baseline (= review-2 BLOCKER-B). Not gitignored/banned.

## MINOR
- m1: LEDGER_TODAY/LEDGER_VERDICTS leak into production; gate.sh never scrubs (= review-2 MAJOR-D).
- m2: incident `key:` grep too strict (case-sensitive, rejects `Key:`/fenced) AND too loose
  (any stale/unrelated incident with `key: <k>` authorizes dropping <k>; no coupling to
  ledger/transition/freshness). Couple it.
- m3: run store never structurally linted; gate glob `*.tsv` misses `runs/*.runs.tsv` subdir;
  promote trusts a chained-but-malformed store. Add runs to lint targets + structural checks.
- m4: promote writes first-green-commit=0000…(40 zeros) with no git; SHA_RE accepts it → fake
  provenance. Require a real git sha or fail loud when no git/LEDGER_HEAD_SHA.

## Held / confirmed-good
6-vs-5 field supersedes note explicit (5-field fails loud — but swallowed by B1). Chain-helper
reuse CLEAN: chainDigest/GENESIS/priorState EXPORTED and already reused by gifts-lint.mjs (W1.7)
+ record-run.mjs (W1.2), no reimplementation, no drift → **fixer MUST preserve these export
signatures**. Glob covers W1.3's future stdlib.tsv automatically (once B1 makes it real).

## Fixer order: B1 → B2 → B3 → M1 → M2 → minors. B1 unblocks the rest being real gates.
