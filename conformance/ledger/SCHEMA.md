# conformance/ledger/*.tsv — the ratchet ledger schema (KEYSTONE, W1.1)

This file is the frozen interface every other conformance card writes against
(BAKE_A_BUN §6.3). The ledger is the single source of proven behavior; its PASS
set may only grow (CLAUDE.md R1). Change this schema only via the incident path.

> **Supersedes note.** BAKE_A_BUN §6.3 sketches a **5-field** row
> (`STATUS ⇥ LANE ⇥ path[::name] ⇥ first-green-commit ⇥ note`). This schema is
> the authoritative, mechanized form and adds a 5th `asserts` field (per the
> W1.1 card), pushing `note` to field 6. Where §6.3 prose and this file differ on
> row shape, **this file wins** — §6.3 semantics (statuses, demotion, promotion)
> are unchanged. The row is **fixed at 6 fields forever** (§2.1); future
> per-row metadata goes inside a structured `note` (§2.4), never a 7th column, so
> the field count never has to break.

## 0. Threat model — what the chain does and does NOT do (read first)

The `#CHAIN` trailer (§4) is an **integrity checksum against incomplete and
accidental edits**, not a cryptographic anti-forgery seal. It is an *unkeyed*
sha256 over *public* inputs, so anyone with `sha256sum` can recompute a valid
trailer after editing a row. It therefore catches: a partial `sed`, a bad merge,
an editor that rewrote a byte, a row hand-flipped by someone who forgot to (or
did not know to) rechain — i.e. every realistic careless mutation. It does **not**
stop a determined attacker who recomputes the trailer by hand. Adversarial
tamper-evidence comes from three other places, and downstream cards must rely on
those, not on the chain alone:

1. **git history + review** — every ledger change lands through a reviewed commit
   (CLAUDE.md R4 routes all commits through `commit.mjs`); the diff is visible.
2. **PASS-set monotonicity vs HEAD** (§5, L2) — a committed PASS cannot silently
   vanish or downgrade; the drop is a reviewable `ratchet-break`.
3. **The tamper-evident run store** (§6.1) — a PASS cannot exist without 5/5
   evidence in a *separately chained* runs ledger, so a hand-planted PASS row
   (new key, invisible to monotonicity) is caught by the missing/forged evidence.

The chain's job is to make the *common* failure (a stale/partial edit) loud and
cheap; §5 and §6.1 are the adversarial floor.

## 1. File shape

A ledger is a UTF-8, **LF-only** text file at `conformance/ledger/<name>.tsv`. A
byte `\r` anywhere in the file is INVALID (no CRLF — it would ride invisibly into
the chain). The file is a sequence of `\n`-terminated **lines**; the final line
MUST end in `\n` (a file not ending in `\n` is INVALID). There are exactly three
line kinds:

1. **Comment / blank lines** — a line whose first byte is `#`, or that is empty.
   Ignored by every tool for row/status purposes. **Canonical form forbids
   interstitial blank lines between rows** (§4 depends on a crisp body); a blank
   line anywhere except a single optional run of leading comments is INVALID, so
   two lint-identical ledgers can never carry different chains.
2. **Row lines** — a data row (§2). One test per row.
3. **The chain trailer** — the LAST line of the file, and the only line that may
   match `^#CHAIN [0-9a-f]{64}$`. Exactly one such line per file. Any *other*
   line matching that pattern (a comment shaped like a trailer, a second
   `#CHAIN`) is INVALID (ambiguity guard). Written only by `ratchet.mjs` /
   `promote.mjs`; the lint does not trust the producer, it recomputes (§4).

A ledger with rows but no `#CHAIN` trailer is INVALID. A comment-only ledger
(empty body) still carries a trailer computed over the empty body (§4).

## 2. The row grammar (6 TAB-separated fields)

```
STATUS ⇥ LANE ⇥ path[::name] ⇥ first-green-commit ⇥ asserts ⇥ note
```

### 2.1 Splitting rule (pin this before any regex)

The separator is a single U+0009 TAB (`⇥`). A row line is split on TAB **by
position into exactly 6 fields first**; only then are per-field regexes applied
(never regex the whole line). Exactly 5 TABs → 6 fields. Any other TAB count is
INVALID — in particular a present-but-empty `note` still requires its leading TAB
(a row ending `…\t<asserts>` with only 4 TABs is a field-count violation, not an
"omitted note"). No field may contain a TAB or a newline. Fields are byte-exact
between the TABs — no trimming (the chain hashes raw bytes).

### 2.2 Field table

| # | Field                | Anchored grammar (`^…$` on the split field)                 |
|---|----------------------|-------------------------------------------------------------|
| 1 | `STATUS`             | one status token (§3)                                       |
| 2 | `LANE`               | `[ABC]` (exactly one of A/B/C — no spaces)                  |
| 3 | `path[::name]`       | `[^\t\n]+` non-empty; optional `::name` suffix (§2.3)       |
| 4 | `first-green-commit` | `[0-9a-f]{40}` (lowercase sha1) when PASS; `-` otherwise     |
| 5 | `asserts`            | `0` or `[1-9][0-9]*` (no leading zeros/sign) when PASS; `-` otherwise |
| 6 | `note`               | `[^\t\n]*` (may be empty); structured or free text (§2.4)   |

**Key (uniqueness).** Field 3 is the row key. A ledger MUST NOT contain two rows
with the same key (lint fails).

**PASS invariants.** A `PASS` row MUST carry a real lowercase 40-hex
`first-green-commit` and a decimal `asserts` ≥ 0 (canonical: no leading zeros).
A non-`PASS` row MUST carry `-` in BOTH fields 4 and 5. Violation → lint fails.
(This makes "is this proven" a single-field test and keeps meaningless fields
empty.)

### 2.3 The `::name` future (per-test-name rows)

§6.3 says "one row per test (later per test-name)." A key is either a bare `path`
(whole-file) or `path::name` (per named test). To keep the migration mechanical
and prevent double-counting, a ledger MUST NOT contain both a bare-`path` key AND
any `path::name` key for the same `path` (lint fails). A ledger is thus wholly
per-file or per-name for any given path — never a contradictory mix.

### 2.4 The `note` field

`note` is field 6, always last, may be empty. It carries either free text or a
structured `k=v;k=v` prefix for future metadata (owner, incident id, gate
detail). Because all future per-row metadata lives here, the row never needs a
7th column — the field count is stable forever (§2.1 supersedes note).

## 3. Status tokens (the status grammar)

Exactly these six shapes, matched anchored against field 1 (never the whole line):

| Token                              | Regex                                        | Meaning (§6.3)                                             |
|------------------------------------|----------------------------------------------|------------------------------------------------------------|
| `PASS`                             | `PASS`                                        | proven; locked; leaves only via the demotion path (§7).    |
| `FAIL`                             | `FAIL`                                        | the aspirational frontier.                                 |
| `BLOCKED(<gate>)`                  | `BLOCKED\([A-Za-z][A-Za-z0-9]*\)`             | impossible until gate lands (phase `P7`, milestone `M2`, lane `LaneB`). |
| `NOTIMPL`                          | `NOTIMPL`                                     | honest not-yet stub.                                       |
| `DIVERGE(reason)`                  | `DIVERGE\([^()\t\n]*[^()\t\n ][^()\t\n]*\)`   | deliberately, permanently not matched (anti-feature §1.3); reason non-blank, no parens. |
| `QUARANTINE(expires=YYYY-MM-DD)`   | `QUARANTINE\(expires=\d{4}-\d{2}-\d{2}\)`     | flaky; expiry mandatory; a real date; expired = lint fail. |

Notes on the parametric tokens:
- `<gate>` is identifier-shaped (letter then alnum): `P7`, `M2`, `M5`, `LaneB`.
  No spaces, no nested parens.
- `DIVERGE`'s reason is any non-**blank** run without TAB, newline, or paren
  (parens are disallowed to keep the token unambiguous; a reason that wants them
  rephrases). At least one non-space character is required.
- `QUARANTINE`'s date is validated as a **real** proleptic-Gregorian calendar
  date with correct leap-year rules. The regex is necessary but not sufficient:
  the lint MUST reject `2026-02-30`, `2026-13-01`, `2100-02-29`, etc. via a
  strict round-trip parse (construct `Y-M-D`, re-serialize, require byte
  equality) — **never** a bare `new Date(str)`, which silently rolls
  `2026-02-30` over to Mar 02 and would wrongly accept it (§L3 hazard).

## 4. The hash chain (`#CHAIN`)

The trailer binds the whole ledger into an append-only chain so incomplete or
careless edits of a committed row are detectable without re-running any test
(threat scope in §0).

**`body`.** The exact raw bytes of the file from its first byte up to and
INCLUDING the `\n` that precedes the trailer line — i.e. the whole file minus
exactly the final `#CHAIN <64hex>\n` line, with **no normalization**. For a
comment-only ledger, `body` is those comment bytes; for a truly empty file (only
the trailer), `body` is the empty string.

**`prev_chain`.** The 64-hex ASCII digest carried by the ledger at its **prior
committed state**, resolved in this fixed order (this resolution is part of the
interface — every tool and every fixture uses it):

1. If a **fixture-local head snapshot** `conformance/ledger/<name>.tsv.head`
   exists, its trailer's 64-hex is `prev_chain`, and its PASS set is the
   monotonicity baseline (§5). This is how the self-contained fixtures plant a
   controlled prior state without touching real git.
2. Else `git show HEAD:<path-to-ledger>` — on **success**, its trailer's 64-hex.
   On **any nonzero exit** (no HEAD yet, path absent at HEAD, detached HEAD with
   no such blob) → GENESIS. A `git show` failure is **never** itself a lint
   error; it means "no prior state."
3. GENESIS = the literal 64-character string of ASCII zeros (`0` × 64).

**Digest.** `chain = sha256_hex( utf8(prev_chain) ‖ body )`, where `‖` is raw
byte concatenation (no separator), `prev_chain` is fed as its **64 ASCII hex
characters** (not 32 decoded bytes), `body` is appended raw, and `sha256_hex` is
lowercase hex. The trailer line is exactly `#CHAIN ` (one ASCII space) + `chain`
+ `\n`, matching `^#CHAIN [0-9a-f]{64}\n$`.

**Test vectors** (pin the encoding so two implementers cannot diverge):
- Genesis empty body: `body = ""`, `prev = GENESIS` →
  `chain = sha256_hex("0000…0000")` (the 64 zero-chars as ASCII, empty body) =
  `60e05bd1b195af2f94112fa7197a5c88289058840ce7c6df9693756bc6250f55`.
- These vectors are asserted by the lint's self-test so a broken sha256 wiring
  fails loudly rather than silently mis-chaining.

**Who writes it.** Only `ratchet.mjs` / `promote.mjs` recompute and rewrite the
trailer, and only after a legitimate transition. The lint never trusts the
producer: it recomputes `sha256(prev_chain ‖ body)` and compares. A stale trailer
(from any edit that did not rechain) → mismatch → INVALID.

## 5. PASS-set monotonicity (L2) & the transition law

Baseline = the prior-state ledger resolved in §4 (`<name>.tsv.head` if present,
else HEAD, else GENESIS/empty). Compare working-tree ledger to baseline:

- **No shrink.** Every key that is `PASS` in the baseline MUST still be present
  AND `PASS` in the working tree. A missing or downgraded baseline-PASS key is a
  shrink → lint FAIL unless authorized as a ratchet-break below. **Deleting the
  whole ledger file** counts as dropping every baseline-PASS key (the lint
  enumerates baseline ledgers, not just working-tree files).
- **`asserts` monotone on a stable PASS key.** For a key that is PASS in both
  baseline and working tree, `asserts` MUST NOT decrease (a proof cannot silently
  weaken). A decrease → lint FAIL.
- **Ratchet-break (the only way PASS shrinks).** A `PASS →` transition (downgrade
  or deletion of a baseline-PASS key) is permitted ONLY when, in the same working
  state, BOTH exist: (a) an incident file under `conformance/incidents/` whose
  body **names the exact key** being demoted, AND (b) the `ratchet-break` marker
  `conformance/ledger/.ratchet-break` whose body **lists that key** (§9). The
  marker is per-key scoped: a present marker authorizes only the keys it lists,
  never an unrelated PASS drop. Absent either, or the key not listed → lint FAIL.

The complete transition table (from-status rows × to-status; `free` = allowed
with no ceremony for a *new-or-non-PASS* key, `break` = requires §5 ratchet-break,
`promote` = only via `promote.mjs` with 5/5 evidence, `—` = same status):

| from \ to    | PASS      | FAIL  | BLOCKED | NOTIMPL | DIVERGE | QUARANTINE | (deleted) |
|--------------|-----------|-------|---------|---------|---------|------------|-----------|
| PASS         | —         | break | break   | break   | break   | break¹     | break     |
| FAIL         | promote   | —     | free    | free    | free    | free       | free      |
| BLOCKED      | promote   | free  | —       | free    | free    | free       | free      |
| NOTIMPL      | promote   | free  | **✗**   | —       | **✗**   | **✗**      | free      |
| DIVERGE      | **✗**     | **✗** | **✗**   | **✗**   | —       | **✗**      | **✗**     |
| QUARANTINE   | promote   | free  | free    | free    | free    | —          | free      |
| (new key)    | promote   | free  | free    | free    | free    | free       | n/a       |

¹ The `PASS → QUARANTINE(+14d)` auto-demotion written by `ratchet.mjs` on an
*unconfirmed* flake is the canonical ratchet-break: it writes the incident + the
per-key marker mechanically, so the lint accepts it.
`✗` = forbidden (`NOTIMPL` may only implement/prove → FAIL/PASS or be deleted;
`DIVERGE` is a permanent stance — it never transitions).

**New-key PASS is not trusted to the chain.** A key absent from the baseline that
appears as `PASS` in the working tree is invisible to the no-shrink rule. The
lint therefore requires, for every working-tree PASS key, a matching **promotion
record** in the chained run store (§6.1) proving 5/5 across ≥2 timestamps with a
`first-green-commit` and `asserts` that match the row. A PASS row without backing
run-store evidence → lint FAIL. This is what actually stops a hand-planted PASS
(the chain alone cannot — §0).

## 6. Promotion (promote.mjs — the SOLE writer of PASS)

A candidate (a `FAIL`, `BLOCKED`, or live `QUARANTINE` row) is promoted to `PASS`
ONLY when its run history shows **5/5 passes across ≥2 distinct run timestamps**
(§6.3 frontier-scan). 4/5, or 5/5 within a single timestamp, is REFUSED. On a
legitimate promotion, `promote.mjs` writes `STATUS=PASS`,
`first-green-commit=<HEAD sha>`, `asserts=<the count all 5 passing runs agree on;
disagreement is REFUSED>`, then recomputes the chain trailer (§4).

### 6.1 The run store (tamper-evident evidence — the real PASS floor)

Run history lives in `conformance/ledger/runs/<name>.runs.tsv`, one **append-only,
independently chained** file per ledger (same `#CHAIN` discipline as §4, same
lint). A row is:

```
ts ⇥ key ⇥ verdict ⇥ asserts
```

- `ts` = an ISO-8601 UTC instant `YYYY-MM-DDThh:mm:ssZ`. "Distinct timestamps"
  means distinct `ts` values; 5 passes sharing one `ts` is a single timestamp
  (correctly refused). `verdict ∈ {pass, fail}`. `asserts` = the run's count.
- The run store is chained, so a hand-appended fake pass breaks the store's own
  chain (caught by lint) unless the forger also rechains it — the same
  accidental-vs-adversarial split as §0, but here it is the *floor* under every
  PASS and is cross-checked by both promote (before writing) and lint (§5). The
  store is written by the CI test runner and by `ratchet.mjs`/`promote.mjs`; it is
  never hand-edited.

## 7. Demotion (ratchet.mjs — the flake safety valve)

`ratchet.mjs` replays the PASS set. Each PASS key runs its verdict source (a real
`largo test` shard; in the hermetic fixtures a scripted verdict via the injection
seam in §10). On a PASS key that FAILS:

- **Confirmatory re-run** on the same shard, once.
- **Confirmed** (fails again): exit nonzero; write the merge-freeze marker
  `conformance/ledger/.merge-freeze` + an incident skeleton (§8). Repo is frozen;
  the PASS row is NOT auto-demoted (a human fixes/reverts under the incident).
- **Unconfirmed** (passes on re-run): auto-demote that key to
  `QUARANTINE(expires=+14d UTC)`, write an incident + the per-key `ratchet-break`
  marker (§9), recompute the chain. Repo stays open. This is the sanctioned
  `PASS → QUARANTINE` the lint accepts (incident names the key, marker lists it).

## 8. Incident files

`conformance/incidents/<YYYY-MM-DD>-<slug>.md`. Skeleton (all mechanically filled
by `ratchet.mjs`): the offending `key` (verbatim, so §5 can match it), the
`ledger` file, the `transition` (`PASS→QUARANTINE` or `PASS→FAIL(frozen)`), the
run `timestamps` that produced the verdict, and a `## Resolution` stub. An
incident naming a key is REQUIRED for any `PASS →` transition on that key (§5).

## 9. Markers (working-tree only — never committed)

- `conformance/ledger/.ratchet-break` — presence + a listed key authorizes that
  key's `PASS →` transition in the working state (paired with an incident). Its
  body is one authorized key per line.
- `conformance/ledger/.merge-freeze` — presence means a confirmed regression froze
  the repo; only fix-regression work proceeds.

Both markers are **transient CI/working-tree artifacts and MUST be gitignored** —
a *committed* marker is a lint FAIL (a marker in git history would let anyone
unlock demotions permanently). They exist only in the working state that performs
the transition, alongside the committed incident that is the durable record.

## 10. Fixture / hermetic-run contract (how the RED battery is self-contained)

The RED fixtures in `red/p0/ledger/` are self-oracles: each is a fixture directory
with a toy ledger + an expected verdict, driven by a `*.test.mjs` runner (matching
gate.sh's globs; allowlisted in `tests-shim-allowlist.tsv`, replaced-by W2.9).
To be hermetic (no dependence on real repo HEAD or wall-clock), the tools honor
these seams — all part of the frozen interface:

- **Prior state**: `<ledger>.tsv.head` snapshot (§4 resolution step 1) supplies a
  controlled `prev_chain` + PASS baseline without git.
- **"today"**: env `LEDGER_TODAY=YYYY-MM-DD` overrides the UTC clock for expiry
  (§3) and `+14d` (§7), so expiry fixtures don't rot. Absent → real UTC today.
- **verdict injection**: env `LEDGER_VERDICTS=<path-to-tsv>` supplies scripted
  `key ⇥ attempt ⇥ pass|fail` verdicts for `ratchet.mjs`, so a fixture can force
  confirmed (fail,fail) vs unconfirmed (fail,pass) deterministically without a
  real test binary. Absent → real `largo test` shards.

## 11. Gate wiring (L1/L2/L3 — separable checks)

`ledger-lint.mjs` runs all structural checks; gate.sh calls three named checks in
the l6/l7/l15 style. Separability (what each needs) is pinned so `--quick` stays
fast:

| Gate | Check                | Needs                                  | In `--quick`? |
|------|----------------------|----------------------------------------|---------------|
| L1   | chain validity       | prior state (snapshot/HEAD read), sha256| yes           |
| L2   | PASS-set monotone    | prior state (snapshot/HEAD read)        | yes           |
| L3   | expiry enforcement   | pure-local (parse date vs today) — **no git, no runs** | yes |

L3 is fully local and trivially standalone. `--quick` runs L1 + L2 + L3 +
schema/status validity over the *existing committed* ledgers only (no test
replay, no promotion). `ratchet.mjs`/`promote.mjs` (the replay + writer paths)
run at `--full`/`--wave`, never in `--quick`.

## 12. Worked example

```
# conformance/ledger/p1.tsv — walking-skeleton conformance
PASS	C	src/main.lg::version_flag	3d691fac1b2e4d5a6f7089abcdef0123456789ab	4	--version prints the pinned bun version
FAIL	C	src/main.lg::help_flag	-	-	frontier: --help text not yet ported
BLOCKED(P7)	A	test/js/bun/http/serve.test.ts	-	-	needs the HTTP engine
NOTIMPL	C	src/main.lg::upgrade	-	-	subcommand stub answers honestly
DIVERGE(telemetry no-op)	C	src/analytics/report.lg::phone_home	-	-	we never phone home (§1.3)
QUARANTINE(expires=2026-07-27)	C	src/main.lg::flaky_timer	-	-	demoted by ratchet 2026-07-13; incident-0007
#CHAIN <computed by ratchet/promote — sha256(prev‖body); NOT the genesis zeros>
```

The `#CHAIN` value is written by the tools; it is intentionally shown as a
placeholder here so this illustrative block can never be mistaken for a real,
lint-valid genesis trailer.
