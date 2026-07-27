#!/usr/bin/env node
// crash-hunt.mjs — sweep test262 for ENGINE CRASHES only (panic / stack overflow), grouped by a
// normalized signature so one fix can be seen to clear a whole cluster. Crashes fail fast, so a short
// timeout catches them cleanly while merely-slow tests drop out as timeouts (ignored here).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const T262 = join(ROOT, "vendor-artifacts", "test262");
const HARNESS = join(T262, "harness");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && (st.mode & 0o111)) o.push(p); } return o; }
const BIN = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const argv = process.argv.slice(2);
const getArg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const SAMPLE = Number(getArg("--sample", "30"));
const TIMEOUT = Number(getArg("--timeout", "2500"));
const DIRS = (getArg("--dirs", "language/expressions,language/statements,language/types,language/literals,built-ins/Array,built-ins/Object,built-ins/String,built-ins/Number,built-ins/Function,built-ins/RegExp,built-ins/Math,built-ins/JSON")).split(",");
const hc = new Map(); const hf = (n) => { if (!hc.has(n)) hc.set(n, readFileSync(join(HARNESS, n), "utf8")); return hc.get(n); };
function fm(src) { const m = src.match(/\/\*---([\s\S]*?)---\*\//); if (!m) return { flags: [], includes: [] }; const y = m[1]; const flags = (y.match(/flags:\s*\[([^\]]*)\]/) || [, ""])[1].split(",").map(s => s.trim()).filter(Boolean); const includes = (y.match(/includes:\s*\[([^\]]*)\]/) || [, ""])[1].split(",").map(s => s.trim()).filter(Boolean); return { flags, includes }; }
function walk(dir, out = []) { let es; try { es = readdirSync(dir); } catch { return out; } for (const e of es) { const p = join(dir, e); const st = statSync(p); if (st.isDirectory()) walk(p, out); else if (e.endsWith(".js") && !e.includes("_FIXTURE")) out.push(p); } return out; }
function sample(files, n) { if (files.length <= n) return files; const step = files.length / n, out = []; for (let i = 0; i < n; i++) out.push(files[Math.floor(i * step)]); return out; }
const TMP = mkdtempSync(join(tmpdir(), "crashhunt-")); let ctr = 0;
// normalize a panic line into a signature (strip addresses, numbers, temp paths)
function sig(err) {
  const lines = err.split("\n");
  let panic = lines.find(l => /panicked at|overflowed its stack|index out of bounds|Cannot parse|unwrap|None/.test(l)) || lines[0] || "";
  return panic.replace(/0x[0-9a-f]+/g, "0xN").replace(/\(\d+\)/g, "(N)").replace(/:\d+:\d+/g, ":N:N").replace(/\/tmp\/\S+/g, "TMP").replace(/\d+/g, "N").trim().slice(0, 140);
}
const clusters = new Map();
let scanned = 0, crashed = 0;
for (const d of DIRS) {
  for (const f of sample(walk(join(T262, "test", d)), SAMPLE)) {
    const src = readFileSync(f, "utf8"); const meta = fm(src);
    if (meta.flags.includes("module") || meta.flags.includes("async") || /\$262/.test(src)) continue;
    let pre = hf("sta.js") + "\n" + hf("assert.js") + "\n";
    let bad = false;
    for (const inc of meta.includes) { try { pre += hf(inc) + "\n"; } catch { bad = true; } }
    if (bad) continue;
    const prog = (meta.flags.includes("raw") ? src : pre + src);
    const tmp = join(TMP, `c${ctr++}.js`); writeFileSync(tmp, prog);
    const r = spawnSync(BIN, ["run", tmp], { encoding: "utf8", timeout: TIMEOUT });
    scanned++;
    const err = ((r.stderr || "") + (r.stdout || ""));
    if (/panic|overflowed its stack|fatal runtime|index out of bounds|Cannot parse|thread '/.test(err)) {
      crashed++;
      const s = sig(err);
      if (!clusters.has(s)) clusters.set(s, { count: 0, files: [] });
      const c = clusters.get(s); c.count++; if (c.files.length < 4) c.files.push(f.replace(T262 + "/test/", ""));
    }
  }
}
console.log(`\n=== crash-hunt: scanned ${scanned}, crashed ${crashed} ===`);
[...clusters.entries()].sort((a, b) => b[1].count - a[1].count).forEach(([s, c]) => {
  console.log(`\n[${c.count}]  ${s}`);
  c.files.forEach(f => console.log(`     ${f}`));
});
