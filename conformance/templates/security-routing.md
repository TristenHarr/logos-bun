# Security-routing checklist — a finding NEVER goes public first (§9.4 invariant 10)

Grounded in bun's ACTUAL `SECURITY.md` (vendor/bun/SECURITY.md, read-only): **report
vulnerabilities by emailing `security@bun.com`. The report is acknowledged within 5 days; a
team member is assigned as primary handler and keeps you informed toward a fix and a
coordinated announcement.** There is NO public-issue path for a vulnerability — a public PR
or issue on a memory-safety / crash / integrity finding is a disclosure leak.

A finding is **security** (`security=y` in `conformance/upstream-gifts.tsv`) when it is a
memory-safety bug (UAF, OOB, double-free, uninitialized read), a crash reachable from
untrusted input, or any integrity/authentication defect. When in doubt, treat it as security
and route it here — under-routing leaks; over-routing costs only an email.

## The mechanized guard

`scripts/lints/gifts-lint.mjs` enforces invariant 10 structurally: a `security=y` row that carries
ANY public artifact link (a `github.com/.../pull/<n>` or `.../issues/<n>` URL, or a bare
`#<n>` issue ref) is **REJECTED**. A security finding's `ARTIFACTS` field carries only a
private reference — `SEC-<n>` or `security@bun.com` — never a URL. This is why the routing
below happens *before* anything public exists.

## The flow (do these in order; steps 4–6 are user-driven)

1. **Classify before filing.** Set `security=y` and `classification` (usually `theirs`) in the
   ledger; the finding enters state `classified`, then `embargoed` (never `ready`/`filed`
   while embargoed). The security flag is stable for the finding's whole life.
2. **Prepare the private report — no public artifact.** Assemble, for `security@bun.com`:
   - a clear title and severity assessment;
   - the minimal crashing input as a spawned fixture (invariant 8), and an ASan repro on the
     unfixed build or a leak regression proof where applicable;
   - the root-cause mechanism at the layer that owns the invariant (invariant 2);
   - the proposed fix + its test, in bun's format (kept private until coordinated);
   - the provenance & AI-authorship disclosure (invariants 12–13) — same honesty as a PR.
3. **Duplicate-check privately.** Run `duplicate-search.md` against advisories and any private
   context you have. Do NOT search by opening public issues that reveal the vuln.
4. **Send to `security@bun.com`** (USER-DRIVEN — Claude never sends). Record only a private
   reference (`SEC-<n>`) in the ledger `ARTIFACTS`. Expect acknowledgement within 5 days.
5. **Coordinate.** Work with the assigned handler toward a fix and a coordinated disclosure
   date. Respond to their questions; keep the fix private. The ledger stays `embargoed`.
6. **Only after the maintainers coordinate disclosure** does the finding transition
   `embargoed → ready → filed` (or `embargoed → filed` if they direct a fix PR post-fix), and
   only then may a public PR/issue URL appear in `ARTIFACTS` — at which point the finding is
   no longer treated as pre-disclosure. Adopt their fix at re-baseline if they ship their own
   (`superseded-upstream`).

## Never

- Never open a public PR or issue for a security finding before coordinated disclosure.
- Never put a PR/issue URL (or `#<n>`) on a `security=y` ledger row (gifts-lint FAILS it).
- Never send the report yourself — remote/outbound actions are user-driven (invariant 20).
