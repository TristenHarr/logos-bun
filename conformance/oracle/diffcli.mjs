// conformance/oracle/diffcli.mjs — the §6.4 differential oracle.
//
// Run identical (argv, cwd, env) under TWO binaries, capture (exit, stdout, stderr), apply
// the per-command normalizers granted by conformance/normalizers.tsv, and emit a structured
// verdict. This is the engine every "does logos-bun match oracle-bun?" check runs through.
//
// Anti-over-eagerness by construction: diffcli never invents normalization. It looks the
// command up in normalizers.tsv, applies exactly the NAMED normalizers that row grants
// (identically to both A and B), and RECORDS which normalizers fired in the verdict. A
// reviewer reading a verdict sees precisely what was masked; a green diff obtained by
// masking is auditable back to a checked-in, ledger-chained TSV row.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyNormalizers, liveEnv } from "../normalize.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const TSV = join(HERE, "..", "normalizers.tsv");

/** Parse normalizers.tsv -> ordered [glob, names[], justification] rows (comments stripped). */
export function loadNormalizerRules(tsvPath = TSV) {
  const text = readFileSync(tsvPath, "utf8");
  const rows = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line || line.startsWith("#")) continue;
    const [glob, namesField, justification = ""] = line.split("\t");
    if (glob === undefined || namesField === undefined) continue;
    const names = namesField === "-" ? [] : namesField.split(",").map((s) => s.trim()).filter(Boolean);
    rows.push({ glob, names, justification });
  }
  return rows;
}

/** Glob (only `*`) -> anchored RegExp. */
function globToRe(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${esc}$`);
}

/**
 * Choose the normalizer names for a command string. Most-specific-first = longest glob that
 * matches (with the bare `*` floor always last). Returns { names, glob, justification }.
 */
export function selectNormalizers(command, rules = loadNormalizerRules()) {
  const matches = rules.filter((r) => globToRe(r.glob).test(command));
  if (matches.length === 0) return { names: [], glob: null, justification: "no rule matched (byte-exact)" };
  // Longest non-`*` glob wins; `*` (length-1) is the natural floor.
  matches.sort((a, b) => b.glob.length - a.glob.length);
  return matches[0];
}

function run(bin, argv, cwd, env) {
  const r = spawnSync(bin, argv, { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    return { exit: null, stdout: "", stderr: String(r.error && r.error.message || r.error), spawnError: true };
  }
  // exit code, or 128+signal when killed by a signal (POSIX convention).
  const exit = r.status !== null ? r.status : (r.signal ? 128 : null);
  return { exit, stdout: r.stdout ?? "", stderr: r.stderr ?? "", signal: r.signal ?? null };
}

/** First differing line between two multi-line strings, with a little context. */
function firstDiff(a, b) {
  const al = a.split("\n"), bl = b.split("\n");
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n; i++) {
    if (al[i] !== bl[i]) {
      return {
        lineNo: i + 1,
        firstLine: `A:${JSON.stringify(al[i] ?? null)}  B:${JSON.stringify(bl[i] ?? null)}`,
        context: al.slice(Math.max(0, i - 1), i + 2).join("\n"),
      };
    }
  }
  return null;
}

/**
 * Run one command under two binaries and produce a verdict.
 *
 * @param {object} o
 * @param {string[]} o.argv           the command argv (argv[0] chooses the normalizer row)
 * @param {string}   o.cwd            working directory for both spawns
 * @param {string}   o.a              path to binary A (conventionally oracle-bun)
 * @param {string}   o.b              path to binary B (conventionally logos-bun)
 * @param {object}   [o.env]          env for both (defaults to process.env)
 * @param {object}   [o.envA]         env override for A only
 * @param {object}   [o.envB]         env override for B only
 * @param {import("../normalize.ts").NormEnv} [o.normEnv]  fixed NormEnv (defaults to live host)
 * @returns {Verdict}
 */
export function diffcli(o) {
  const { argv, cwd, a, b } = o;
  const env = o.env ?? process.env;
  const command = argv.join(" ");
  const rule = selectNormalizers(command);
  const normEnv = o.normEnv ?? liveEnv();

  const A = run(a, argv, cwd, o.envA ?? env);
  const B = run(b, argv, cwd, o.envB ?? env);

  const normA = {
    stdout: applyNormalizers(A.stdout, rule.names, normEnv),
    stderr: applyNormalizers(A.stderr, rule.names, normEnv),
  };
  const normB = {
    stdout: applyNormalizers(B.stdout, rule.names, normEnv),
    stderr: applyNormalizers(B.stderr, rule.names, normEnv),
  };

  const diffs = [];
  if (A.exit !== B.exit) {
    diffs.push({ stream: "exit", firstLine: `A:${A.exit} B:${B.exit}`, context: "" });
  }
  for (const stream of ["stdout", "stderr"]) {
    const d = firstDiff(normA[stream], normB[stream]);
    if (d) diffs.push({ stream, firstLine: d.firstLine, lineNo: d.lineNo, context: d.context });
  }

  return {
    equal: diffs.length === 0,
    command,
    exitA: A.exit,
    exitB: B.exit,
    binA: a,
    binB: b,
    normalizers: rule.names,          // exactly what was masked, by name
    normalizerRule: rule.glob,        // which TSV glob granted them (audit trail)
    diffs,
  };
}

/**
 * @typedef {object} Verdict
 * @property {boolean} equal
 * @property {string} command
 * @property {number|null} exitA
 * @property {number|null} exitB
 * @property {string} binA
 * @property {string} binB
 * @property {string[]} normalizers
 * @property {string|null} normalizerRule
 * @property {{stream:string, firstLine:string, lineNo?:number, context:string}[]} diffs
 */

// CLI: node diffcli.mjs --a <bin> --b <bin> [--cwd <dir>] -- <argv...>
if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = process.argv.slice(2);
  let a, b, cwd = process.cwd();
  const argv = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "--a") a = raw[++i];
    else if (raw[i] === "--b") b = raw[++i];
    else if (raw[i] === "--cwd") cwd = raw[++i];
    else if (raw[i] === "--") { argv.push(...raw.slice(i + 1)); break; }
    else argv.push(raw[i]);
  }
  if (!a || !b) {
    console.error("usage: node diffcli.mjs --a <bin> --b <bin> [--cwd <dir>] -- <argv...>");
    process.exit(2);
  }
  const verdict = diffcli({ argv, cwd, a, b });
  process.stdout.write(JSON.stringify(verdict, null, 2) + "\n");
  process.exit(verdict.equal ? 0 : 1);
}
