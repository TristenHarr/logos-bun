// conformance/normalize.ts — output normalizers for the §6.4 comparators.
//
// TWO layers, both here, deliberately separate:
//
//   1. `normalizeBunSnapshot` — a faithful port of vendor/bun's harness function of the
//      same name (test/harness.ts). It is the P8.2 snapshot-parity oracle: byte-for-byte
//      the same transform bun applies to its own snapshots. DO NOT "improve" it — its job
//      is to MATCH bun, drift is a bug. vendor/bun is read-only; this is the port, not a fork.
//
//   2. per-CLASS normalizers (`registry`) — one small, named, auditable transform per
//      nondeterminism class (temp paths, PIDs, timings, durations, versions, cwd). diffcli
//      applies a SUBSET of these, chosen per command by conformance/normalizers.tsv. Keeping
//      them separate + named is the whole anti-over-eagerness design: a diff can only be
//      hidden by a NAMED normalizer that appears, with a justification, in a checked-in TSV
//      row under the ledger chain (W1.1). There is no catch-all "clean it up" pass.
//
// Determinism: every normalizer takes its environment (tmp/home/cwd/version/revision) as an
// explicit `NormEnv`, never reading process.cwd()/os.tmpdir() implicitly. Fixture goldens
// pin a fixed NormEnv so they are machine-independent; diffcli fills NormEnv from the live
// host once, up front, and both A and B outputs get the identical substitution.
//
// Runnable under plain `node` (v22 type-stripping) and importable from .mjs — no build step.
import { realpathSync } from "node:fs";
import { cwd } from "node:process";
import { tmpdir, homedir } from "node:os";

export interface NormEnv {
  cwd: string;
  tmp: string;
  home: string;
  version: string;
  version_with_sha: string;
  revision: string;
}

/** Resolve a live NormEnv from the host (realpath-canonicalized, like bun's harness). */
export function liveEnv(over: Partial<NormEnv> = {}): NormEnv {
  const real = (p: string) => {
    try { return realpathSync.native(p).replaceAll("\\", "/"); } catch { return p; }
  };
  return {
    cwd: real(cwd()),
    tmp: real(tmpdir()),
    home: real(homedir()),
    version: "",
    version_with_sha: "",
    revision: "",
    ...over,
  };
}

type Normalizer = (s: string, env: NormEnv) => string;

// ── per-class normalizers ──────────────────────────────────────────────────────
// Each is a pure string->string transform. No trimming, no CRLF folding, no chaining:
// composition is the caller's job (via normalizers.tsv), so every applied transform stays
// individually visible in the allowlist.

/** Absolute cwd/tmp/home paths -> <cwd>/<tmp>/<home>. cwd first (most specific). */
const tempPaths: Normalizer = (s, env) => {
  let out = s;
  if (env.cwd) out = out.replaceAll(env.cwd, "<cwd>");
  if (env.tmp) out = out.replaceAll(env.tmp, "<tmp>");
  if (env.home) out = out.replaceAll(env.home, "<home>");
  return out;
};

/** cwd-only substitution (some commands legitimately echo tmp/home paths verbatim). */
const cwdOnly: Normalizer = (s, env) => (env.cwd ? s.replaceAll(env.cwd, "<cwd>") : s);

/**
 * Process IDs -> <pid>. Scoped to pid-LABELLED numbers only, never bare integers:
 *   `pid 123` `pid: 123` `pid=123` `[pid 123]`  and the `process 123 <verb>` form.
 * The `process N` arm requires a following lowercase word so it can't eat "process 3 files".
 */
const pids: Normalizer = (s) =>
  s.replace(/\bpid([\s:=]+)\d+/g, "pid$1<pid>")
    .replace(/\bprocess (\d+)(?=\s+[a-z])/g, "process <pid>");

/**
 * Bracketed timing suffixes, exactly as bun emits on test-result and status lines:
 *   `(pass) x [1.2ms]` -> `(pass) x`   ` [15ms] y` -> `y`   `[0.5s] z` -> ` z`
 * This mirrors the three timing rules inside normalizeBunSnapshot (bun REMOVES the bracket
 * rather than placeholder it, so snapshots stay clean); kept as its own class for diffcli.
 */
const timings: Normalizer = (s) =>
  s.replace(/^((?:pass|fail|skip|todo)\) .+) \[[\d.]+\s?m?s\]$/gm, "$1")
    .replace(/\s\[[\d.]+\s?m?s\]/gm, "")
    .replace(/^\[[\d.]+\s?m?s\]/gm, "");

/**
 * Bare inline durations that bun prints OUTSIDE brackets -> <time>. Scoped to a duration
 * that FOLLOWS `in ` (e.g. "compiled in 4.51ms", "done in 1200ms") so it can't touch a bare
 * count like "port 3000". This is the visible-placeholder complement to `timings`.
 */
const durations: Normalizer = (s) =>
  s.replace(/\bin \d+(?:\.\d+)?\s?(?:ms|s)\b/g, "in <time>");

/** Version + revision strings -> placeholders. Order matches bun's harness exactly. */
const versions: Normalizer = (s, env) => {
  let out = s.replace(
    /Bun v[\d.]+(?:-[\w.]+)?(?:\+[\w]+)?(?:\s+\([^)]+\))?/g,
    "Bun v<bun-version>",
  );
  if (env.version_with_sha) out = out.replaceAll(env.version_with_sha, "<version> (<revision>)");
  if (env.version) out = out.replaceAll(env.version, "<bun-version>");
  if (env.revision) out = out.replaceAll(env.revision, "<revision>");
  return out;
};

/** The named registry diffcli/normalizers.tsv select from. Names are the TSV vocabulary. */
export const registry: Record<string, Normalizer> = {
  tempPaths,
  cwd: cwdOnly,
  pids,
  timings,
  durations,
  versions,
};

/** Apply a named list of normalizers left-to-right. Unknown names throw (fail loud). */
export function applyNormalizers(text: string, names: readonly string[], env: NormEnv): string {
  let out = text;
  for (const name of names) {
    const fn = registry[name];
    if (!fn) throw new Error(`normalize: unknown normalizer "${name}" (not in registry)`);
    out = fn(out, env);
  }
  return out;
}

// ── the faithful normalizeBunSnapshot port ─────────────────────────────────────
// Ported 1:1 from vendor/bun/test/harness.ts. The only change is DI: bun reads its live
// realpath'd cwd/tmp/home and Bun.version* globals inline; we take them via NormEnv so this
// is portable to node and deterministic under fixtures. Behavior is otherwise byte-identical.
export function normalizeBunSnapshot(
  snapshot: string,
  opts: { env?: Partial<NormEnv>; optionalDir?: string } = {},
): string {
  const env = { ...liveEnv(), ...opts.env } as NormEnv;
  const optionalDir = opts.optionalDir;

  if (optionalDir) {
    let real = optionalDir;
    try { real = realpathSync.native(optionalDir).replaceAll("\\", "/"); } catch { /* keep raw */ }
    snapshot = snapshot.replaceAll(real, "<dir>").replaceAll(optionalDir, "<dir>");
  }

  snapshot = snapshot.replace(/^((?:pass|fail|skip|todo)\) .+) \[[\d.]+\s?m?s\]$/gm, "$1");

  let out = snapshot
    .replaceAll("\r\n", "\n")
    .replaceAll("\\", "/");
  if (env.cwd) out = out.replaceAll(env.cwd, "<cwd>");
  if (env.tmp) out = out.replaceAll(env.tmp, "<tmp>");
  if (env.home) out = out.replaceAll(env.home, "<home>");
  out = out
    .replace(/\s\[[\d.]+\s?m?s\]/gm, "")
    .replace(/^\[[\d.]+\s?m?s\]/gm, "")
    .replace(/^\s+at (.*?)\(.*?:\d+(?::\d+)?\)/gm, "    at $1(file:NN:NN)")
    .replace(/Bun v[\d.]+(?:-[\w.]+)?(?:\+[\w]+)?(?:\s+\([^)]+\))?/g, "Bun v<bun-version>");
  if (env.version_with_sha) out = out.replaceAll(env.version_with_sha, "<version> (<revision>)");
  if (env.version) out = out.replaceAll(env.version, "<bun-version>");
  if (env.revision) out = out.replaceAll(env.revision, "<revision>");
  return out.trim();
}
