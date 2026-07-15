// fuzz/jsint/objstatics-diff — Object.fromEntries + Object.assign, completing the
// Object.* static family (keys/values/entries already present). fromEntries builds an
// object from an array of [key, value] pairs (the inverse of entries); assign merges
// all its object arguments left-to-right (later keys win) into a new object and returns
// it. objAssign splits its args bracket-aware (patFields) so multi-key object literals
// survive. Diffed vs Node (byte-exact via JSON.stringify, key order = insertion).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) { if (c === "{" || c === "(" || c === "[") depth++; else if (c === "}" || c === ")" || c === "]") depth--; if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c; }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const obj = (keys) => `{${keys.map((k) => `${k}:${sn()}`).join(",")}}`;
  const someKeys = () => ["a", "b", "c", "d", "e"].filter(() => rnd() < 0.5).slice(0, 3);
  const kv = () => `["${["a", "b", "c", "d"][ri(4)]}",${sn()}]`;
  const program = () => {
    const k = ri(6);
    if (k === 0) { const ks = someKeys(); if (!ks.length) ks.push("a"); return `JSON.stringify(Object.assign({},${obj(ks)}))`; }
    if (k === 1) { const a = someKeys().length ? someKeys() : ["a"], b = someKeys().length ? someKeys() : ["b"]; return `JSON.stringify(Object.assign(${obj(a)},${obj(b)}))`; }
    if (k === 2) return `JSON.stringify(Object.assign({},${obj(["a", "b"])},${obj(["b", "c"])}))`;      // override
    if (k === 3) { const pairs = Array.from({ length: 1 + ri(3) }, kv); return `JSON.stringify(Object.fromEntries([${pairs.join(",")}]))`; }
    if (k === 4) { const ks = ["a", "b", "c"].slice(0, 1 + ri(3)); return `JSON.stringify(Object.fromEntries(Object.entries(${obj(ks)})))`; } // round-trip
    return `Object.keys(Object.assign(${obj(["a", "b"])},${obj(["c"])})).length`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objstatics: ${checked} Object.assign/fromEntries programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objstatics: " + f); process.exit(1); }
