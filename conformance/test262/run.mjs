#!/usr/bin/env node
// conformance/test262/run.mjs — the OBJECTIVE conformance metric.
//
// Runs tc39/test262 (pinned in conformance/test262/PIN, corpus in vendor-artifacts/test262) against
// the logos-bun binary and classifies each test PASS / FAIL / SKIP, with a failure taxonomy. A
// non-negative test PASSES iff the binary exits 0 (test262's assert.js throws a Test262Error on
// failure, which our runtime now surfaces as a non-zero exit — that's the signal). A negative test
// PASSES iff the binary exits non-zero (exact error-type/phase checking is a refinement).
//
// Usage:
//   node conformance/test262/run.mjs [--dir <subpath>] [--sample N] [--full] [--timeout ms] [--json out]
// Examples:
//   node conformance/test262/run.mjs --dir language/expressions --sample 60
//   node conformance/test262/run.mjs --baseline    # the standard baseline sweep + taxonomy
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
if (!BIN) { console.error("no logos-bun binary — build it first (scripts/build.sh)"); process.exit(2); }

// ---- args ----
const argv = process.argv.slice(2);
const getArg = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const has = (name) => argv.includes(name);
const TIMEOUT = Number(getArg("--timeout", "10000"));
const SAMPLE = has("--full") ? Infinity : Number(getArg("--sample", "40"));
const JSONOUT = getArg("--json", null);
const BASELINE = has("--baseline");

// Baseline sweep = a representative cross-section (per-dir sampled to stay fast).
const BASELINE_DIRS = [
  "language/expressions", "language/statements", "language/types", "language/literals",
  "built-ins/Array", "built-ins/Object", "built-ins/String", "built-ins/Number",
  "built-ins/Boolean", "built-ins/Math", "built-ins/JSON", "built-ins/Function",
  "built-ins/Map", "built-ins/Set", "built-ins/Symbol", "built-ins/RegExp",
  "built-ins/Promise", "built-ins/Proxy", "built-ins/Reflect", "built-ins/TypedArray",
];

// ---- frontmatter ----
function frontmatter(src) {
  const m = src.match(/\/\*---([\s\S]*?)---\*\//);
  if (!m) return { flags: [], includes: [], features: [], negative: null };
  const y = m[1];
  const flags = (y.match(/flags:\s*\[([^\]]*)\]/) || [, ""])[1].split(",").map((s) => s.trim()).filter(Boolean);
  const includes = (y.match(/includes:\s*\[([^\]]*)\]/) || [, ""])[1].split(",").map((s) => s.trim()).filter(Boolean);
  const features = (y.match(/features:\s*\[([^\]]*)\]/) || [, ""])[1].split(",").map((s) => s.trim()).filter(Boolean);
  let negative = null;
  const nm = y.match(/negative:\s*\n\s*phase:\s*(\S+)\s*\n\s*type:\s*(\S+)/) || y.match(/negative:\s*\{[^}]*type:\s*(\w+)[^}]*\}/);
  if (nm) negative = nm.length === 3 ? { phase: nm[1], type: nm[2] } : { phase: "runtime", type: nm[1] };
  return { flags, includes, features, negative };
}

const harnessCache = new Map();
const harnessFile = (name) => { if (!harnessCache.has(name)) harnessCache.set(name, readFileSync(join(HARNESS, name), "utf8")); return harnessCache.get(name); };

const TMP = mkdtempSync(join(tmpdir(), "t262-"));
let counter = 0;

function runOne(file) {
  const src = readFileSync(file, "utf8");
  const fm = frontmatter(src);
  // --- skip categories (harness/features we cannot fairly measure yet) ---
  if (fm.flags.includes("async")) return { r: "skip", why: "async" };
  if (fm.flags.includes("module")) return { r: "skip", why: "module" };
  if (fm.flags.includes("CanBlockIsFalse") || fm.flags.includes("CanBlockIsTrue")) return { r: "skip", why: "canblock" };
  if (/\$262|\$DONE/.test(src)) return { r: "skip", why: "host-hook" };
  // --- assemble ---
  let program;
  if (fm.flags.includes("raw")) {
    program = src;
  } else {
    let pre = harnessFile("sta.js") + "\n" + harnessFile("assert.js") + "\n";
    for (const inc of fm.includes) { try { pre += harnessFile(inc) + "\n"; } catch { return { r: "skip", why: "missing-include:" + inc }; } }
    const strict = fm.flags.includes("onlyStrict");
    program = (strict ? '"use strict";\n' : "") + pre + src;
  }
  const tmp = join(TMP, `t${counter++}.js`);
  writeFileSync(tmp, program);
  const res = spawnSync(BIN, ["run", tmp], { encoding: "utf8", timeout: TIMEOUT });
  const timedOut = res.error && res.error.code === "ETIMEDOUT";
  const exit = res.status;
  const err = ((res.stderr || "") + (res.stdout || "")).trim();
  if (timedOut) return { r: "fail", why: "TIMEOUT", err: "timeout" };
  if (fm.negative) {
    // negative test: expected to error. PASS iff non-zero exit. (type/phase check = refinement)
    return exit !== 0 ? { r: "pass" } : { r: "fail", why: "negative-not-thrown", err };
  }
  if (exit === 0) return { r: "pass" };
  return { r: "fail", why: bucket(err), err };
}

// crude taxonomy bucket from the error text
function bucket(err) {
  const first = (err.split("\n")[0] || "").slice(0, 120);
  if (/is not defined|not a function|has no |undefined is not/i.test(first)) {
    const m = first.match(/([A-Za-z_$][\w.$]*) is not defined/) || first.match(/\.([A-Za-z_$]\w*) is not a function/);
    if (m) return "missing:" + m[1];
  }
  if (/Proxy/.test(first)) return "missing:Proxy";
  if (/Reflect/.test(first)) return "missing:Reflect";
  if (/TypedArray|ArrayBuffer|DataView|Int\d|Float\d|Uint/.test(first)) return "missing:TypedArray";
  if (/Test262Error/.test(first)) return "assertion";
  if (/parse|Parse|Unexpected|SyntaxError/.test(first)) return "parse/syntax";
  if (/panic|Cannot parse|thread '/.test(first)) return "engine-crash";
  return first.replace(/[0-9]+/g, "N").slice(0, 48) || "unknown";
}

// ---- walk ----
function walk(dir, out = []) { let es; try { es = readdirSync(dir); } catch { return out; } for (const e of es) { const p = join(dir, e); const st = statSync(p); if (st.isDirectory()) walk(p, out); else if (e.endsWith(".js") && !e.endsWith("_FIXTURE.js") && !e.includes("_FIXTURE")) out.push(p); } return out; }
function sampleFiles(files, n) { if (files.length <= n) return files; const step = files.length / n; const out = []; for (let i = 0; i < n; i++) out.push(files[Math.floor(i * step)]); return out; }

function sweep(dirs, sample) {
  const tax = new Map(); const skipTax = new Map();
  let pass = 0, fail = 0, skip = 0; const failExamples = [];
  for (const d of dirs) {
    const files = sampleFiles(walk(join(T262, "test", d)), sample);
    for (const f of files) {
      const o = runOne(f);
      if (o.r === "pass") pass++;
      else if (o.r === "skip") { skip++; skipTax.set(o.why, (skipTax.get(o.why) || 0) + 1); }
      else { fail++; tax.set(o.why, (tax.get(o.why) || 0) + 1); if (failExamples.length < 25) failExamples.push({ file: f.replace(T262 + "/", ""), why: o.why, err: (o.err || "").split("\n")[0].slice(0, 100) }); }
    }
  }
  return { pass, fail, skip, tax, skipTax, failExamples };
}

const pin = (() => { try { return readFileSync(join(HERE, "PIN"), "utf8").trim(); } catch { return "unpinned"; } })();
const dirs = BASELINE ? BASELINE_DIRS : [getArg("--dir", "language/expressions")];
const t0 = Date.now();
const { pass, fail, skip, tax, skipTax, failExamples } = sweep(dirs, SAMPLE);
const ran = pass + fail;
const pct = ran ? ((pass / ran) * 100).toFixed(2) : "0.00";
const secs = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n=== test262 metric (pin ${pin.slice(0, 12)}) ===`);
console.log(`dirs: ${dirs.join(", ")}   sample/dir: ${SAMPLE === Infinity ? "FULL" : SAMPLE}   ${secs}s`);
console.log(`PASS ${pass}   FAIL ${fail}   SKIP ${skip}   →  ${pct}%  (of ${ran} run; skips excluded)`);
console.log(`\n-- failure taxonomy (top) --`);
[...tax.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
console.log(`\n-- skip reasons --`);
[...skipTax.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
if (has("--examples")) { console.log(`\n-- failure examples --`); failExamples.forEach((e) => console.log(`  [${e.why}] ${e.file}\n      ${e.err}`)); }

if (JSONOUT) writeFileSync(JSONOUT, JSON.stringify({ pin, dirs, sample: SAMPLE === Infinity ? "full" : SAMPLE, pass, fail, skip, pct: Number(pct), taxonomy: Object.fromEntries(tax), skips: Object.fromEntries(skipTax) }, null, 2));
