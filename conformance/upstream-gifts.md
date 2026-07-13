# conformance/upstream-gifts — the gift covenant + finding ledger

Differential fuzzing against bun's *actual* crates finds real bun bugs. **We patch
what we find, upstream, as we go** (BAKE_A_BUN §9.4). This document is the covenant
explainer and the schema for the finding ledger. The 20 invariants of §9.4 are the
binding rulebook; the mechanized subset lives in `scripts/lints/gifts-lint.mjs` and
runs in `scripts/gate.sh`. This file is that lint's spec of record.

## Where the rows live (the split)

The **human covenant is this `.md`**; the **machine-readable rows live in the sibling
`conformance/upstream-gifts.tsv`**. This mirrors `conformance/ledger/SCHEMA.md`'s
separation of prose from data: editing the covenant prose here never touches the
chain, and the lint has a single crisp body to hash. `gifts-lint.mjs` lints the
`.tsv`; `gate.sh` runs it only when that ledger has real (non-comment) rows.

The `.tsv` **reuses the W1.1 hash-chain mechanism verbatim** — it imports
`chainDigest` / `priorState` / `GENESIS` / `TRAILER_RE` from `scripts/lints/ledger-lint.mjs`
and does NOT reimplement sha256 chaining (SCHEMA.md §4). A finding's rows form its
append-only, chained history; a careless edit that does not rechain is caught exactly
as in the conformance ledger.

## The finding state machine (invariant 15)

Every divergence is triaged **before** filing and tracked through the full lifecycle:

```
found → classified → {embargoed | ready} → filed → {in-review | changes-requested}
      → {merged | declined | duplicate | superseded-upstream | stale} → re-baselined
```

- **found** — a differential mismatch (or an independent-reimplementation defect) is
  recorded. Born here; a finding's first row is always `found`.
- **classified** — triaged into exactly one of **ours** (fix logos-bun, zero upstream
  noise), **theirs** (a gift), or **spec-ambiguity** (document; file an issue asking
  intent only when the answer matters). Classification is *required* before a finding
  may leave `found` (invariant 15).
- **embargoed** — a **security** finding (memory-safety / crash / integrity) held for
  coordinated disclosure. Routes to `security@bun.com` (invariant 10, `SECURITY.md`);
  **never a public PR or issue** until coordinated. The `.tsv` records `embargoed`; the
  actual report goes through the security channel (`templates/security-routing.md`).
- **ready** — a non-security gift with branch content, test, and PR body prepared
  (`templates/gift-pr-body.md`), duplicate-searched (`templates/duplicate-search.md`),
  adversarially reviewed, awaiting the user's push (invariant 20 — remote ops are the
  user's; Claude never runs git).
- **filed** — the PR is open (a gift), or the report is sent to `security@bun.com` (a
  security finding). The artifact link is the PR URL, or `security@bun.com` for a
  routed security report — never a public URL for a security finding.
- **in-review** / **changes-requested** — the review loop (invariant 16): respond to
  maintainer comments, re-pass the §2.5 adversarial gate on each revision, keep the
  branch green. These two states may churn (`changes-requested → in-review → …`).
- **merged** / **declined** / **duplicate** / **superseded-upstream** / **stale** — the
  terminal outcomes. `duplicate` = upstream already had it (invariant 11);
  `superseded-upstream` = upstream fixed the same bug differently and we adopt theirs
  (invariant 19).
- **re-baselined** — the finding is closed against the current `SPEC_PIN`; the ledger
  row is retired. Absorbing.

The exact legal edges are encoded in `TRANSITIONS` in `gifts-lint.mjs`; the lint
rejects any illegal jump (e.g. `found → filed`, skipping `classified`).

## The row grammar (6 TAB-separated fields, mirroring SCHEMA §2.1 splitting)

```
id ⇥ state ⇥ classification ⇥ security ⇥ artifact-link ⇥ note
```

| # | field            | grammar                                                              |
|---|------------------|----------------------------------------------------------------------|
| 1 | `id`             | `G-<digits>` — the finding key, stable across its whole history.     |
| 2 | `state`          | one state token from the machine above.                              |
| 3 | `classification` | `ours` \| `theirs` \| `spec-ambiguity`; `-` ONLY while state=`found`. |
| 4 | `security`       | `y` \| `n`; MUST NOT flip across a finding's history.                |
| 5 | `artifact-link`  | a PR URL / `security@bun.com` / `SEC-<n>` ref / branch path, or `-`. |
| 6 | `note`           | free text; may be empty (its leading TAB is still required).         |

The file is LF-only, ends in `\n`, and its last line is the single `#CHAIN <64hex>`
trailer (SCHEMA §1/§4). Rows accumulate append-only; **the latest row per `id` is the
current state**. Comment/prose lines start with `#` (or, defensively, carry no TAB).

## Security embargo — the covenant's sharpest edge (invariant 10)

A **`security=y` finding may NEVER carry a public artifact link** — a `github.com`
PR/issue URL, or a bare `#<issue>` ref — in **any** row, in **any** state, in **any
field** (artifact-link *or* note). Security findings route to `security@bun.com`
(`SECURITY.md`; ack within 5 days) and are recorded as `embargoed` → `filed` with a
`security@bun.com` / `SEC-<n>` artifact, never a URL. `gifts-lint.mjs` scans **every**
row (not just the current state) and **both** the artifact-link and the free-text note
(the note is not an escape hatch), so a multi-step edit that briefly parks a URL on an
intermediate row — or smuggles one into a note — is still caught. The security flag is
also pinned stable, so a finding cannot silently become `n` to shed the routing
constraint.

## Provenance & AI-authorship (invariants 12–13)

Every gift PR discloses (a) how the bug was found — differential fuzzing vs an
independent LOGOS reimplementation — and (b) that the fix and test are Claude-authored,
human-reviewed. The PR body follows bun's template (*What does this PR do? / How did you
verify?*) plus the mandatory provenance block; gift code is clean-room MIT-compatible
and contains **nothing** derived from the BSL-licensed logicaffeine/logos-bun sources.
See `templates/gift-pr-body.md`.

## Remote operations (invariant 20)

Fork creation, pushes, and PR open/update are the **user's** actions. Claude prepares
branch-ready content (fix, test, PR body, platform-check evidence) and moves the ledger
to `ready`; the user pulls the trigger and the row advances to `filed`.

## Templates

- `templates/gift-pr-body.md` — bun's PR template + provenance/AI-authorship block.
- `templates/security-routing.md` — the `security@bun.com` flow (invariant 10).
- `templates/duplicate-search.md` — the pre-filing search checklist (invariant 11).

## Current findings

None yet. The fuzz lanes (P2+) feed GIFT.4 continuously; **we never manufacture a
gift** (§9.4). When the first confirmed bun bug appears it is appended to
`upstream-gifts.tsv` as a `G-0001 … found …` row and walked through the state machine
from there.
