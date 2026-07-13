#!/usr/bin/env bash
# The gate — logos-bun's CI until a remote exists; every check here ports 1:1 to a §6.3
# CI job later. Wave N+1 may not start until `gate.sh --wave N` exits 0 (CLAUDE.md R6).
# v0 (Wave 0): L6, L7, L15, L16-seed + the red/p0 battery. Checks accrete per wave.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:---quick}"
WAVE="${2:-}"
FAILS=0

# ── env-seam scrub (blast m1 / review-2 MAJOR-D) ──────────────────────────────
# The hermetic RED fixtures inject LEDGER_TODAY / LEDGER_VERDICTS / LEDGER_HEAD_SHA to control
# the clock, scripted verdicts, and the first-green sha. Those seams belong to the fixture
# drivers ONLY — a stray value in the ambient environment must NEVER steer a PRODUCTION gate
# run (LEDGER_TODAY=2000-01-01 would un-expire every quarantine; LEDGER_VERDICTS would replay a
# scripted "pass" so a real regression never freezes). Scrub them before any real lint/ratchet/
# promote runs here. LEDGER_GATE_DIR (which ledger dir the gate lints) is a gate-routing seam,
# not a lint seam, and is preserved so fixtures can point the gate at a temp ledger tree.
unset LEDGER_TODAY LEDGER_VERDICTS LEDGER_HEAD_SHA

# The ledger tree the gate lints (default: the committed one). Fixtures override this to drive
# the real gate checks against a hermetic temp tree without touching conformance/ledger/.
LEDGER_DIR="${LEDGER_GATE_DIR:-$ROOT/conformance/ledger}"

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

# ── L1/L2/L3: the ledger gate (blast B1) ──────────────────────────────────────
# ledger-lint.mjs validates EVERY structural invariant of a ledger — the hash chain (L1), the
# PASS-set monotonicity + transition law + provenance (L2), expiry (L3), the row grammar, status
# tokens, field invariants, dup/coarse-fine keys, the committed-marker ban (§9), the .head ban,
# and the run-store structure. It exits nonzero on ANY of them. The gate MUST red on that
# NONZERO EXIT CODE — never on a tag substring (the old text-match sieve let bad STATUS / bad
# LANE / CR bytes / dup keys / the marker ban / everything untagged sail through GREEN). One
# tag-free check surfaces the whole invariant surface (B1), so B2's marker ban, M2's .head ban,
# and every future check become real gates for free.
#
# Also enumerate BASELINE ledgers committed at HEAD but ABSENT from the working tree (a
# git mv/rm that erases a proven PASS set): each such ledger is linted from its HEAD blob via
# LEDGER_LINT_BASELINE so its monotonicity is still checked (review-1 FINDING 2 / M2).
_ledger_gate() {
  local ok=1 out
  shopt -s nullglob
  local ledgers=("$LEDGER_DIR"/*.tsv)
  shopt -u nullglob
  # baseline ledgers present at HEAD but vanished from the working tree (rename/delete).
  local vanished=()
  if [[ "$LEDGER_DIR" == "$ROOT/conformance/ledger" ]]; then
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      [[ -f "$LEDGER_DIR/$name" ]] || vanished+=("$name")
    done < <(git -C "$ROOT" ls-tree --name-only HEAD conformance/ledger/ 2>/dev/null \
             | sed -n 's#^conformance/ledger/\(.*\.tsv\)$#\1#p')
  fi
  if [[ ${#ledgers[@]} -eq 0 && ${#vanished[@]} -eq 0 ]]; then pass L1; pass L2; pass L3; return; fi
  for lg in "${ledgers[@]}"; do
    if ! out="$(node "$ROOT/scripts/lints/ledger-lint.mjs" "$lg" 2>&1)"; then
      fail "L1/L2/L3" "$out"; ok=0
    fi
  done
  for name in "${vanished[@]}"; do
    if ! out="$(LEDGER_LINT_BASELINE="$name" node "$ROOT/scripts/lints/ledger-lint.mjs" "$LEDGER_DIR/$name" 2>&1)"; then
      fail "L1/L2/L3" "$out"; ok=0
    fi
  done
  [[ $ok == 1 ]] && { pass L1; pass L2; pass L3; }
}
# L1: ledger hash-chain validity · L2: PASS-set monotonicity vs HEAD · L3: expiry — all fast
# (chain+lint over the committed ledgers + HEAD-baseline enumeration, no test replay) → --quick.
# ratchet.mjs/promote.mjs (replay + PASS writer) run only at --full/--wave.
l1() { _ledger_gate; }

# ── merge-freeze: a frozen repo blocks (blast B2 / SCHEMA §9) ──────────────────
# ratchet.mjs writes conformance/ledger/.merge-freeze on a CONFIRMED PASS regression (repo-wide
# freeze until fixed/reverted). That marker must actually BLOCK: while it is present in the
# working tree, the gate REFUSES so no further work merges past a live confirmed regression.
# The marker is gitignored (working-tree only) — the committed-marker BAN is a separate check
# inside ledger-lint (§9). Both --quick and --full hit this.
l_freeze() {
  if [[ -e "$LEDGER_DIR/.merge-freeze" ]]; then
    fail FREEZE "repo frozen — conformance/ledger/.merge-freeze is present (a confirmed PASS regression; fix or formally revert with an incident before the gate can pass)"
  else
    pass FREEZE
  fi
}

# ── L4: Lane-A validity lint over every committed ledger's Lane-A rows (W1.3) ──────
# A Lane-A pass counts only if its assertions observe the CHILD (BAKE_A_BUN §6.2). A Lane-A
# row whose test file exercises an in-process Bun API (Bun.build(/Bun.serve(/bun:ffi/a
# bun-internal import) would assert against real bun in the host process — a false-green — so
# it must be BLOCKED(P9), not PASS. lint-lanes.mjs scans each Lane-A row's file and fails loud
# on any such row that is not already BLOCKED(P9)/DIVERGE. Local + fast (source scan over the
# EXISTING committed ledgers' referenced files, no test replay) → belongs in --quick.
l4() {
  local ok=1
  shopt -s nullglob
  local ledgers=("$ROOT"/conformance/ledger/*.tsv)
  shopt -u nullglob
  [[ ${#ledgers[@]} -eq 0 ]] && { pass L4; return; }
  for lg in "${ledgers[@]}"; do
    if ! out="$(node "$ROOT/conformance/lint-lanes.mjs" --ledger "$lg" --root "$ROOT" 2>&1)"; then
      fail L4 "$out"; ok=0   # B1: red on ANY nonzero exit — a lint that can't run is not a pass
    fi
  done
  [[ $ok == 1 ]] && pass L4
}

# ── L5: assert-parity ratchet (W1.2) ─────────────────────────────────────────────
# For every committed PASS row, its CURRENT recorded asserts (the latest verdict in the chained
# run store) must be >= its promotion-time value (SCHEMA §5 asserts-monotone, extended from the
# ledger baseline to the live run store). This is the ratchet the conformance runner's
# assert-count capture exists to power: a test that quietly stops executing assertions keeps its
# green PASS row but sheds its real evidence — L5 turns that silent drop into a loud gate FAIL.
# Local + fast (parse + chain over EXISTING committed ledgers + their run stores, no test replay),
# reusing ledger-lint's parseLedger/priorState/chainDigest → belongs in --quick like L1/L2/L3.
l5() {
  local ok=1
  shopt -s nullglob
  local ledgers=("$ROOT"/conformance/ledger/*.tsv)
  shopt -u nullglob
  [[ ${#ledgers[@]} -eq 0 ]] && { pass L5; return; }
  for lg in "${ledgers[@]}"; do
    if ! out="$(node "$ROOT/scripts/lints/assert-parity-lint.mjs" "$lg" 2>&1)"; then
      fail L5 "$out"; ok=0   # B1: red on ANY nonzero exit — a lint that can't run is not a pass
    fi
  done
  [[ $ok == 1 ]] && pass L5
}

# ── L17: the gift covenant ledger (§9.4; CLAUDE.md R10-GIFTS) ────────────────────
# (Fresh check number — L10 is already the commit-time RED-first gate in commit.mjs/CLAUDE.md.)
# gifts-lint validates conformance/upstream-gifts.tsv — legal state transitions, required
# classification, invariant-10 security embargo (no public link on a security=y finding), and
# chain validity (reused from the ledger core). GUARD: run ONLY when the ledger has a real
# (non-comment, non-blank, non-#CHAIN) row; an empty/absent ledger passes trivially so the
# gate never blocks on the honest "no gifts yet" state (GIFT.4 stays open until a real bug).
l17() {
  local gifts="$ROOT/conformance/upstream-gifts.tsv"
  if [[ ! -f "$gifts" ]]; then pass L17; return; fi
  if ! grep -qvE '^(#|[[:space:]]*$)' "$gifts"; then pass L17; return; fi  # comment/blank only
  local out
  if out="$(node "$ROOT/scripts/lints/gifts-lint.mjs" "$gifts" 2>&1)"; then
    pass L17
  else
    fail L17 "$out"
  fi
}

# ── L9: gate-manifest — the guarded artifact ratchet (ratchet-before-code) ────────
# scripts/gate-manifest.json maps a guarded artifact PATH to the guard that must exist before
# that path may (STOP rule R7 generalized). A guarded path present in the working tree WITHOUT
# its registered guard present is a gate failure: the artifact landed before the mechanism that
# keeps it honest. This is the general form of R7's "never shim toolchain functionality" and of
# the ratchet law itself — you may not add bun-engine/ before its seam grep-lock, a fuzz corpus
# before its replay bank, a bench lock before its 3σ verify, or a mutation-oracle shim dir before
# its mutants config. The check passes TRIVIALLY (like l17's empty-ledger guard) while the
# guarded dirs don't exist yet — the POINT is that the instant one appears, its guard must too.
# Local + fast (a JSON parse + a handful of path existence checks, no test replay) → --quick.
# The check is a node one-liner (robust JSON parse) embedded here so gate-manifest.json is the
# ONLY new artifact — no sidecar lint. `match` grammar: a trailing `/` matches the dir or anything
# under it; a `*` SEGMENT matches any single immediate child; otherwise an exact path. A guard
# "fires" when a matching path exists; when fired, EVERY path in its `present` array must exist.
# Structural errors (bad JSON, missing/empty fields, dup ids) fail too — a manifest that can't be
# evaluated is not a pass (B1). Exit 1 = violation, exit 0 = clean.
l9() {
  local manifest="$ROOT/scripts/gate-manifest.json"
  if [[ ! -f "$manifest" ]]; then fail L9 "scripts/gate-manifest.json missing"; return; fi
  local out
  if out="$(GM_ROOT="$ROOT" GM_FILE="$manifest" node --input-type=module -e '
    import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
    import { join, resolve } from "node:path";
    const root = process.env.GM_ROOT, file = process.env.GM_FILE;
    let doc;
    try { doc = JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { console.error("manifest is not valid JSON: " + e.message); process.exit(1); }
    if (!doc || !Array.isArray(doc.guards)) { console.error("manifest missing a `guards` array"); process.exit(1); }
    const matchExists = (pattern) => {
      const trailingSlash = pattern.endsWith("/");
      const segs = pattern.replace(/\/+$/, "").split("/").filter(Boolean);
      let level = [root];
      for (const seg of segs) {
        const next = [];
        for (const base of level) {
          if (seg === "*") { let es; try { es = readdirSync(base); } catch { continue; } for (const e of es) next.push(join(base, e)); }
          else { const p = join(base, seg); if (existsSync(p)) next.push(p); }
        }
        level = next; if (!level.length) return false;
      }
      if (!trailingSlash) return level.length > 0;
      return level.some((p) => { try { return statSync(p).isDirectory(); } catch { return false; } });
    };
    const errors = []; const seen = new Set(); let fired = 0;
    for (const g of doc.guards) {
      if (!g || typeof g !== "object") { errors.push("a guard entry is not an object"); continue; }
      for (const k of ["id", "match", "requires"]) if (typeof g[k] !== "string" || !g[k].length) errors.push(`guard ${JSON.stringify(g.id ?? "?")}: field ${k} must be a non-empty string`);
      if (!Array.isArray(g.present) || !g.present.length || !g.present.every((p) => typeof p === "string" && p.length)) errors.push(`guard ${JSON.stringify(g.id ?? "?")}: field present must be a non-empty array of path strings`);
      if (typeof g.id === "string") { if (seen.has(g.id)) errors.push(`duplicate guard id ${JSON.stringify(g.id)}`); seen.add(g.id); }
      if (errors.length) continue;
      if (!matchExists(g.match)) continue;
      fired++;
      const missing = g.present.filter((p) => !existsSync(resolve(root, p)));
      if (missing.length) errors.push(`guarded artifact "${g.match}" exists but its guard "${g.id}" is MISSING: ${missing.map((m) => "`" + m + "`").join(", ")} not present. ${g.requires} (ratchet-before-code — owner: ${g.owner ?? "?"})`);
    }
    if (errors.length) { for (const e of errors) console.error("FAIL L9: " + e); console.error(`L9 gate-manifest: ${errors.length} violation(s) — a guarded artifact landed before its guard (CLAUDE.md R1/R7)`); process.exit(1); }
    console.log(`PASS L9 gate-manifest (${doc.guards.length} guard(s), ${fired} fired)`);
  ' 2>&1)"; then
    pass L9
  else
    fail L9 "$out"   # B1: red on ANY nonzero exit — a manifest that can't be evaluated is not a pass
  fi
}

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

# ── L13: fuzz regression replay (§8; W2.1) ────────────────────────────────────────
# Every banked witness under fuzz/<c>/corpus/regressions/ is a permanent differential repro; on
# each gate run fuzz-driver.mjs --replay-all re-runs them all and REDS if any still diverges (a
# resurrected bug). The bank is append-only (a fuzz/*/ gate-manifest guard). GUARD: no fuzz/<c>/
# regression dirs exist yet, so --replay-all exits 0 trivially over an empty fuzz tree (l17-style
# empty guard). Local + fast (re-runs banked seeds only, no generation) → both --quick and --full.
l13() {
  local out
  if out="$(node "$ROOT/conformance/fuzz-driver.mjs" --replay-all 2>&1)"; then
    pass L13
  else
    fail L13 "fuzz regression replay reproduced a banked bug:\n$out"
  fi
}

# ── L12: the never-slower bench ratchet (§9.1; W2.2) ──────────────────────────────
# bench/verify.mjs recomputes every locked suite's integrity seal in bench/LEDGER.json — a
# hand-edit that LOOSENS a locked_ratio (raises it so a slower run passes) without re-sealing
# goes stale and reds here — and validates the four metric kinds (wall-clock/peak-rss/binary-
# size/build-time). GUARD: an empty suite set (no locks yet) verifies trivially (l17-style), so
# the gate never blocks the honest "no benchmarks locked yet" bootstrap state. Local + fast
# (chain recompute over the committed ledger, no hyperfine run) → both --quick and --full.
l12() {
  local out
  if out="$(node "$ROOT/bench/verify.mjs" --ledger "$ROOT/bench/LEDGER.json" 2>&1)"; then
    pass L12
  else
    fail L12 "bench ratchet lock broken (a loosening edit or bad metric):\n$out"
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

l15; l6; l7; l8; l_freeze; l1; l4; l5; l17; l9; l16_seed; l13; l12

# ── wave-N exit criteria (CLAUDE.md R6 / §6.3) ─────────────────────────────────
# `--wave N` = `--full` + wave-N exit criteria. The WAVE-LEVEL exit conditions (which cards are
# GREEN, the WAVES.md table transition) are the ORCHESTRATOR's ledger, not a shell test — so this
# gate stays HONEST about what it can mechanically verify: it runs the full lint+RED battery, then
# if a per-wave criteria script exists at conformance/wave-criteria/wave-N.sh it runs it (a
# nonzero exit reds the gate), and if none exists it says so plainly rather than pretending to
# have checked a wave gate it cannot. The gate-audit meta-lock (red/p0/gate-audit/**) is part of
# the --full battery, so it re-runs at EVERY wave exit forever (a gate that stops catching a
# planted violation is itself the regression this wave-mode is here to freeze on).
wave_criteria() {
  local n="$1"
  if [[ -z "$n" ]]; then fail WAVE "--wave requires a wave number: gate.sh --wave N"; return; fi
  local crit="$ROOT/conformance/wave-criteria/wave-$n.sh"
  if [[ -f "$crit" ]]; then
    local out
    if out="$(bash "$crit" "$ROOT" 2>&1)"; then
      pass "WAVE:$n"
    else
      fail "WAVE:$n" "wave-$n exit criteria failed:\n$out"
    fi
  else
    say "GATE note [WAVE:$n]: no conformance/wave-criteria/wave-$n.sh — wave-level exit is the orchestrator's ledger (WAVES.md); mechanical checks (lints + RED battery incl. gate-audit) ran above"
  fi
}

case "$MODE" in
  --quick) ;;                      # lints only (pre-commit speed)
  --full) battery red/p0 ;;
  --wave) battery red/p0; wave_criteria "$WAVE" ;;
  *) say "usage: gate.sh [--quick|--full|--wave N]"; exit 2 ;;
esac

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ $FAILS -gt 0 ]]; then
  say "GATE RED — $FAILS failure(s) [$MODE $WAVE] $STAMP"
  exit 1
fi
say "GATE GREEN [$MODE $WAVE] $STAMP"
