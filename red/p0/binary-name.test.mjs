// W0.D RED: `largo build --release` emits a binary literally named `bun` that
// answers `--version` byte-exactly per SPEC_PIN. SHIM (tests-shim-allowlist.tsv):
// migrates to .lg once G2 subprocess + G13 largo-test land (W2.9).
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function pinVersion() {
  const pin = readFileSync(join(ROOT, "SPEC_PIN.md"), "utf8");
  const m = pin.match(/`bun --version` output \| `([^`]+)`/);
  if (!m) throw new Error("SPEC_PIN.md has no version output field");
  return m[1];
}

function findBinary(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findBinary(p, out);
    else if (e === "bun" && st.mode & 0o111) out.push(p);
  }
  return out;
}

const version = pinVersion();
if (version.startsWith("PENDING")) {
  console.error("FAIL binary-name: SPEC_PIN version is PENDING-FETCH");
  process.exit(1);
}
const candidates = findBinary(join(ROOT, "target"));
if (candidates.length === 0) {
  console.error("FAIL binary-name: no executable named `bun` under target/ — build it");
  process.exit(1);
}
const bin = candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const out = execFileSync(bin, ["--version"], { encoding: "utf8" });
if (out !== version + "\n") {
  console.error(`FAIL binary-name: --version printed ${JSON.stringify(out)}, want ${JSON.stringify(version + "\n")} (from ${bin})`);
  process.exit(1);
}
console.log(`PASS binary-name (${bin})`);
