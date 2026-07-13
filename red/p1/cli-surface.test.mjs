// P1.1 Lane-A conformance: logos-bun's CLI surface vs the Rust bun oracle (diffcli).
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9. First real product-code conformance.
import { execFileSync } from "node:child_process";
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
const run = (bin, args) => { try { return { out: execFileSync(bin, args, { encoding: "utf8" }), code: 0 }; }
  catch (e) { return { out: (e.stdout || "") + (e.stderr || ""), code: e.status ?? 1 }; } };

if (!OURS) fails.push("no logos-bun binary under target/ — build it");
else {
  // BYTE-EXACT conformance vs the Rust oracle on the version surface.
  for (const flag of ["--version", "-v", "--revision"]) {
    const a = run(OURS, [flag]).out, b = run(ORACLE, [flag]).out;
    if (a !== b) fails.push(`${flag}: ours=${JSON.stringify(a)} oracle=${JSON.stringify(b)} (must be byte-exact)`);
  }
  // Every recognized subcommand is DISPATCHED (NOTIMPL), never a silent no-op or crash.
  for (const cmd of ["install", "add", "run", "test", "build", "x", "pm", "why", "audit", "publish"]) {
    const r = run(OURS, [cmd]);
    if (!/not implemented/.test(r.out)) fails.push(`subcommand '${cmd}' not dispatched (got ${JSON.stringify(r.out.slice(0, 40))})`);
  }
  // --help / no-args produce bun's help banner line (byte-exact --help block is BLOCKED, ledgered to grow toward).
  if (!/Bun is a fast JavaScript runtime/.test(run(OURS, []).out)) fails.push("no-args did not emit the help banner");
}

if (fails.length) { for (const f of fails) console.error("FAIL cli-surface: " + f); process.exit(1); }
console.log(`PASS cli-surface (--version/-v/--revision byte-exact vs oracle; subcommands dispatched)`);
