// P1.1 Lane-A conformance: logos-bun's CLI surface vs the Rust bun oracle (diffcli).
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9. First real product-code conformance.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORACLE = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");

function findBin(dir, out = []) {
  let es; try { es = readdirSync(dir); } catch { return out; }
  for (const e of es) {
    const p = join(dir, e); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findBin(p, out);
    else if (e === "bun" && st.mode & 0o111) out.push(p);
  }
  return out;
}
const OURS = findBin(join(ROOT, "target"))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

const fails = [];
// spawnSync separates stdout/stderr/exit — needed to verify bun routes errors to stderr, not stdout.
const run = (bin, args) => { const r = spawnSync(bin, args, { encoding: "utf8" }); return { out: r.stdout ?? "", err: r.stderr ?? "", code: r.status ?? 1 }; };

if (!OURS) fails.push("no logos-bun binary under target/ — build it");
else {
  // BYTE-EXACT conformance vs the Rust oracle on the version surface.
  for (const flag of ["--version", "-v", "--revision"]) {
    const a = run(OURS, [flag]).out, b = run(ORACLE, [flag]).out;
    if (a !== b) fails.push(`${flag}: ours=${JSON.stringify(a)} oracle=${JSON.stringify(b)} (must be byte-exact)`);
  }
  // Every recognized subcommand is DISPATCHED (NOTIMPL to stderr + exit 1), never a silent no-op/crash.
  for (const cmd of ["install", "add", "run", "test", "build", "x", "pm", "why", "audit", "publish"]) {
    const r = run(OURS, [cmd]);
    if (!/not yet implemented/.test(r.err)) fails.push(`subcommand '${cmd}' not dispatched to stderr (err=${JSON.stringify(r.err.slice(0, 50))})`);
    if (r.code === 0) fails.push(`subcommand '${cmd}' NOTIMPL must exit nonzero, got 0`);
  }
  // --help / no-args produce bun's help banner line (byte-exact --help block is BLOCKED, ledgered to grow toward).
  if (!/Bun is a fast JavaScript runtime/.test(run(OURS, []).out)) fails.push("no-args did not emit the help banner");

  // BYTE-EXACT unknown-command conformance vs the oracle: bun treats a non-flag arg as a script,
  // errors to STDERR, and exits 1. This exercises the exitWith/eputs toolchain primitives.
  for (const arg of ["notacommand", "definitely-not-a-real-thing"]) {
    const a = run(OURS, [arg]), b = run(ORACLE, [arg]);
    const aerr = a.err ?? a.out, berr = b.err ?? b.out;                 // whichever stream carried it
    if (aerr !== berr) fails.push(`'${arg}' stderr: ours=${JSON.stringify(aerr)} oracle=${JSON.stringify(berr)}`);
    if (a.code !== b.code) fails.push(`'${arg}' exit: ours=${a.code} oracle=${b.code} (must match — needs exitWith)`);
    // and it must be on STDERR, not stdout (bun errors don't corrupt piped stdout)
    if (a.out.trim() !== "") fails.push(`'${arg}' wrote to stdout (${JSON.stringify(a.out)}); the error must go to stderr`);
  }
  // an unknown FLAG (leading dash) is NOT a script → help banner, exit 0 (matches bun's leniency).
  { const a = run(OURS, ["--bogusflag"]); if (a.code !== 0 || !/Bun is a fast JavaScript runtime/.test(a.out)) fails.push(`--bogusflag should show help + exit 0, got exit ${a.code}`); }
}

if (fails.length) { for (const f of fails) console.error("FAIL cli-surface: " + f); process.exit(1); }
console.log(`PASS cli-surface (--version/-v/--revision byte-exact vs oracle; subcommands dispatched)`);
