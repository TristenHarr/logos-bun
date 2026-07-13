# W1.1 ledger keystone — review 2 (correctness, second angle) — VERDICT: CHANGES-REQUIRED

Complements review-1. Both converge on the prior-state layer; core parse/grammar/chain-
encoding/promote-arithmetic proven solid. All findings reproduced in /tmp, no repo write.

## BLOCKER-A: priorState relative-path collapse silently DISABLES L1+L2 (the other face of review-1 FINDING 1)
ledger-lint.mjs:156-162: for a RELATIVE ledger path, `git rev-parse --show-toplevel` returns
absolute root → `startsWith(repoRoot+"/")` false → falls back to basename → `git show
HEAD:p0.tsv` (wrong relpath, blob is conformance/ledger/p0.tsv) → catch swallows → GENESIS +
empty passSet. So: ABSOLUTE path → returns self → L1 fixed-point RED (review-1); RELATIVE
path → GENESIS → PASS-set silently WIPED, lints clean. ONE broken function, both directions
fatal. provenPassKeys(runPath) shares the fragility.
FIX: resolve the git relpath CORRECTLY regardless of input form (or reject non-absolute
loudly). This subsumes review-1 FINDING 1.

## BLOCKER-B: committable `.tsv.head` overrides the monotonicity baseline
ledger-lint.mjs:150-153 + SCHEMA §4/§10: `.head` is highest-priority prior-state and
supplies BOTH prev_chain AND the PASS baseline, but is NOT gitignored and NOT banned-at-HEAD
(checkMarkersNotCommitted lists only .ratchet-break/.merge-freeze). Attacker commits a
p0.tsv.head with a shrunk baseline → drops proven keys with no incident/marker/failure.
FIX: gitignore `*.tsv.head`, ban it at HEAD like the markers, scope the seam to fixtures.

## MAJOR-C: run-store verdict/ts unvalidated → 5/5-across-2-timestamps bypassable
promote.mjs:58-62 + ledger-lint.mjs:238-243 disqualify only literal "fail"; a failing run
spelled skip/error/empty is neither pass nor disqualifier (5 pass + 2 non-fail-fails →
"5/7", promotes). ts never format-checked → `…T00:00:00Z` vs `…T00:00:00.000Z` count as 2
distinct timestamps → single-sitting 5/5 passes the anti-flake gate.
FIX: enforce verdict∈{pass,fail} and the pinned ts format; count DISTINCT timestamps.

## MAJOR-D: fixture env seams honored in production
gate.sh never unsets LEDGER_TODAY / LEDGER_VERDICTS / LEDGER_HEAD_SHA. LEDGER_TODAY=2000-01-01
un-expires every quarantine; LEDGER_VERDICTS=<file> makes ratchet.mjs replay scripted "pass"
so a real regression never confirms/freezes.
FIX: gate.sh `unset` all three before any production lint/ratchet/promote; scope to fixtures.

## MINOR-E: no max QUARANTINE expiry — QUARANTINE(expires=9999-12-31) parks a flake forever.
## MINOR-F: a data row whose first byte is `#` is swallowed as a comment (ledger-lint.mjs:105).

## Attacked and held (both reviewers agree)
Status grammar (DIVERGE()/paren-in-reason/bad dates), structural parse (CRLF/field-count/
stray #CHAIN/blanks/TAB-in-note), field invariants (dup key/coarse-fine/`-` enforcement/
leading-zero/uppercase-sha), chain genesis vector byte-exact, f3 hand-edit caught, promote
4/5 & single-ts refused, ratchet confirm→freeze / unconfirmed→QUARANTINE+incident,
.ratchet-break/.merge-freeze gitignored+banned. isRealDate correct on all calendar edges.

## Consolidated fixer brief (review-1 + review-2)
1. Fix priorState: correct git-relpath resolution (kills BOTH the absolute-self fixed-point
   AND the relative-GENESIS wipe). Add fixtures: committed unchanged ledger PASSES L1;
   relative-path invocation preserves the baseline.
2. Baseline-ledger ENUMERATION in monotonicity (`git ls-tree HEAD conformance/ledger/`);
   gate lints every baseline ledger even if absent from working tree (rename/delete → RED).
3. gitignore `*.tsv.head` + ban at HEAD (checkMarkersNotCommitted); unset LEDGER_* seams in
   gate.sh.
4. Validate run-store verdict∈{pass,fail} + ts format; count distinct timestamps.
5. Enforce full transition table for non-PASS baseline rows (no DIVERGE→FAIL→PASS laundering).
6. Rewrite SCHEMA §0/§5 threat model HONESTLY: anti-forgery = git review + monotonicity +
   visibility; the unkeyed chain and recomputable run-store are accidental-edit tripwires,
   not forgery seals. Optional: max QUARANTINE horizon; document/handle `#`-leading keys.
7. PRESERVE the chain-helper API signature (W1.2/W1.7 import it) even as internals change.
