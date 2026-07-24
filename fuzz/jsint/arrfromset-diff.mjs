// fuzz/jsint/arrfromset — Array.from over a Set / Map. arrFromBase treated any object as an array-like
// with a `.length`, so a Set/Map (which have no length, just __set_vals / __map_keys) came out empty. Now
// a Set → a fresh array of its (deduped, insertion-order) values, a Map → an array of its [key, value]
// entry pairs; the fresh copy means mutating the result doesn't alias the Set/Map. This fuzzer builds
// random Sets/Maps, applies Array.from (with and without a map fn), and compares (via JSON/join) vs Node.
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
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(4);
    if (k === 0) {
      const items = Array.from({ length: 1 + ri(6) }, () => ri(10));
      return `(function(){ return JSON.stringify(Array.from(new Set([${items.join(",")}]))) })()`;
    }
    if (k === 1) {
      const items = Array.from({ length: 1 + ri(6) }, () => ri(10));
      return `(function(){ return Array.from(new Set([${items.join(",")}]), x=>x+${ri(9)}).join(",") })()`;
    }
    if (k === 2) {
      const pairs = Array.from({ length: 1 + ri(4) }, (_, i) => `[${JSON.stringify("k" + i)},${ri(99)}]`);
      return `(function(){ return JSON.stringify(Array.from(new Map([${pairs.join(",")}]))) })()`;
    }
    const items = Array.from({ length: 1 + ri(5) }, () => JSON.stringify("s" + ri(9)));
    return `(function(){ return Array.from(new Set([${items.join(",")}])).join("|") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-arrfromset: ${checked} Array.from(Set/Map) programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arrfromset: " + f); process.exit(1); }
