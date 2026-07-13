// W0.E RED — PERMANENT TOOLCHAIN CANARY: the multi-module largo build path
// (markdown-link imports, namespaced types) builds and runs correctly.
// Re-run at every TOOLCHAIN_PIN bump. SHIM (tests-shim-allowlist.tsv): the
// node wrapper migrates to .lg at W2.9; the toy project itself is already LOGOS.
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROJ = join(ROOT, "red", "p0", "multimodule");

function findBinary(dir, name, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findBinary(p, name, out);
    else if (e === name && st.mode & 0o111) out.push(p);
  }
  return out;
}

try {
  execFileSync(join(ROOT, "scripts", "build.sh"), ["--project", PROJ, "--release"], { stdio: "pipe", encoding: "utf8" });
} catch (e) {
  console.error("FAIL multimodule: build failed:\n" + (e.stdout || "") + (e.stderr || ""));
  process.exit(1);
}
const bins = findBinary(join(PROJ, "target"), "multimodule-toy");
if (bins.length === 0) {
  console.error("FAIL multimodule: no multimodule-toy binary under project target/");
  process.exit(1);
}
const bin = bins.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const out = execFileSync(bin, [], { encoding: "utf8" });
if (out !== "263\n") {
  console.error(`FAIL multimodule: printed ${JSON.stringify(out)}, want "263\\n"`);
  process.exit(1);
}
console.log("PASS multimodule");
