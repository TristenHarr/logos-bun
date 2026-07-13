#!/usr/bin/env bash
# The gate — logos-bun's CI until a remote exists; every check here ports 1:1 to a §6.3
# CI job later. Wave N+1 may not start until `gate.sh --wave N` exits 0 (CLAUDE.md R6).
# v0 (Wave 0): L6, L7, L15, L16-seed + the red/p0 battery. Checks accrete per wave.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:---quick}"
WAVE="${2:-}"
FAILS=0

say()  { printf '%s\n' "$*"; }
fail() { say "GATE FAIL [$1]: $2"; FAILS=$((FAILS + 1)); }
pass() { say "GATE pass [$1]"; }

# ── L15: CLAUDE.md rule anchors ────────────────────────────────────────────────
l15() {
  local ok=1
  for a in R1-RATCHET-IS-LAW R2-NEVER-MODIFY-RED R3-TESTS-IN-LOGOS R4-GIT-SPLIT \
           R5-VENDOR-PRISTINE R6-DONE-MEANS-GATE R7-DUAL-REPO R8-BUILD-DISCIPLINE \
           R9-FIX-THE-PROCESS R10-GIFTS; do
    grep -q "<!-- ANCHOR:$a -->" "$ROOT/CLAUDE.md" || { fail L15 "CLAUDE.md lost anchor $a"; ok=0; }
  done
  [[ $ok == 1 ]] && pass L15
}

# ── L6: pins == submodules == oracle binary ──────────────────────────────────
l6() {
  local ok=1
  local spec_sha tool_sha bin_sha pin_bin_sha
  spec_sha="$(grep -oP '(?<=Tag commit SHA \| `)[0-9a-f]{40}' "$ROOT/SPEC_PIN.md" || true)"
  tool_sha="$(grep -oP '(?<=Pinned commit \| `)[0-9a-f]{40}' "$ROOT/TOOLCHAIN_PIN.md" || true)"
  [[ -n "$spec_sha" ]] || { fail L6 "SPEC_PIN.md missing tag SHA"; ok=0; }
  [[ -n "$tool_sha" ]] || { fail L6 "TOOLCHAIN_PIN.md missing pin SHA"; ok=0; }
  for pair in "vendor/bun:$spec_sha" "vendor/logicaffeine:$tool_sha"; do
    local dir="${pair%%:*}" want="${pair#*:}"
    if [[ ! -e "$ROOT/$dir/.git" ]]; then fail L6 "$dir submodule missing"; ok=0; continue; fi
    local got; got="$(git -C "$ROOT/$dir" rev-parse HEAD 2>/dev/null || echo MISSING)"
    [[ "$got" == "$want" ]] || { fail L6 "$dir HEAD $got != pin $want"; ok=0; }
  done
  pin_bin_sha="$(grep -oP '(?<=Binary sha256 \| `)[0-9a-f]{64}' "$ROOT/SPEC_PIN.md" || true)"
  if [[ -z "$pin_bin_sha" ]]; then
    fail L6 "SPEC_PIN.md binary sha256 is PENDING/absent"; ok=0
  elif [[ ! -x "$ROOT/vendor-artifacts/oracle-bun/bun" ]]; then
    fail L6 "oracle binary missing (fetch-oracle.sh)"; ok=0
  else
    bin_sha="$(sha256sum "$ROOT/vendor-artifacts/oracle-bun/bun" | cut -d' ' -f1)"
    [[ "$bin_sha" == "$pin_bin_sha" ]] || { fail L6 "oracle sha256 $bin_sha != pin $pin_bin_sha"; ok=0; }
  fi
  [[ $ok == 1 ]] && pass L6
}

# ── L7: vendor pristine, no stray worktrees ──────────────────────────────────
l7() {
  local ok=1
  for dir in vendor/bun vendor/logicaffeine; do
    [[ -e "$ROOT/$dir/.git" ]] || continue
    local dirty; dirty="$(git -C "$ROOT/$dir" status --porcelain 2>/dev/null | head -5)"
    [[ -z "$dirty" ]] || { fail L7 "$dir is dirty:\n$dirty"; ok=0; }
  done
  if [[ -d "$ROOT/work/worktrees" ]]; then
    local stray; stray="$(find "$ROOT/work/worktrees" -maxdepth 1 -mindepth 1 -mmin +1440 | head -3)"
    [[ -z "$stray" ]] || { fail L7 "stale scratch worktrees (>24h): $stray"; ok=0; }
  fi
  [[ $ok == 1 ]] && pass L7
}

# ── ledger gate helper: lint one *.tsv, fail the given gate if its tag appears ──
_ledger_gate() {
  local gate="$1" tag="$2" ok=1
  shopt -s nullglob
  local ledgers=("$ROOT"/conformance/ledger/*.tsv)
  shopt -u nullglob
  [[ ${#ledgers[@]} -eq 0 ]] && { pass "$gate"; return; }
  for lg in "${ledgers[@]}"; do
    if ! out="$(node "$ROOT/scripts/lints/ledger-lint.mjs" "$lg" 2>&1)"; then
      if grep -qE "$tag" <<<"$out"; then fail "$gate" "$out"; ok=0; fi
    fi
  done
  [[ $ok == 1 ]] && pass "$gate"
}
# L1: ledger hash-chain validity · L2: PASS-set monotonicity vs HEAD · L3: expiry.
# All three are fast (chain+lint over EXISTING committed ledgers, no test replay) so they
# belong in --quick. ratchet.mjs/promote.mjs (replay + PASS writer) run only at --full/--wave.
l1() { _ledger_gate L1 'L1 chain'; }
l2() { _ledger_gate L2 'L2 (monotonicity|provenance)'; }
l3() { _ledger_gate L3 'L3 expiry'; }

# ── L16-seed: every .mjs test is allowlisted (full shrink-ratchet lands W1) ──
l16_seed() {
  local ok=1
  while IFS= read -r f; do
    local rel="${f#"$ROOT"/}"
    grep -qP "^\Q$rel\E\t" "$ROOT/conformance/tests-shim-allowlist.tsv" \
      || { fail L16 "unallowlisted node test shim: $rel (write it in LOGOS — CLAUDE.md R3)"; ok=0; }
  done < <(find "$ROOT/red" "$ROOT/conformance" -name '*.test.mjs' -type f 2>/dev/null)
  [[ $ok == 1 ]] && pass L16
}

# ── L8: no destructive/wholesale git verbs anywhere (CLAUDE.md R4) ───────────────
l8() {
  local out
  if out="$(node "$ROOT/scripts/lints/workflow-ops-lint.mjs" --root "$ROOT" 2>&1)"; then
    pass L8
  else
    fail L8 "forbidden git verb(s) found:\n$out"
  fi
}

# ── RED batteries ─────────────────────────────────────────────────────────────
battery() {
  local dir="$1" ok=1
  while IFS= read -r t; do
    if out="$(node "$t" 2>&1)"; then
      say "  $out"
    else
      say "$out"; fail RED "$(basename "$t")"; ok=0
    fi
  done < <(find "$ROOT/$dir" -name '*.test.mjs' -type f | sort)
  [[ $ok == 1 ]] && pass "RED:$dir"
}

l15; l6; l7; l8; l1; l2; l3; l16_seed
case "$MODE" in
  --quick) ;;                      # lints only (pre-commit speed)
  --full|--wave) battery red/p0 ;;
  *) say "usage: gate.sh [--quick|--full|--wave N]"; exit 2 ;;
esac

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ $FAILS -gt 0 ]]; then
  say "GATE RED — $FAILS failure(s) [$MODE $WAVE] $STAMP"
  exit 1
fi
say "GATE GREEN [$MODE $WAVE] $STAMP"
