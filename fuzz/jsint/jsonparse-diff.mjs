// fuzz/jsint/jsonparse-diff — JSON.parse over random JSON-serializable values,
// validated by the round-trip JSON.stringify(JSON.parse(<literal>)): parse a
// canonical JSON string and re-serialize it; ours must reproduce byte-for-byte
// what Node does. The source literal is produced by JSON.stringify(json) so its
// quotes are correctly escaped (exercising the \" escape path too).
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
const nodeRun = (p) => eval(p);
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(99);
  const words = ["cat", "dog", "fox", "owl", "ada"];
  const keys = "abcdef";
  const scalar = () => { const k = ri(4); return k === 0 ? `"${words[ri(5)]}"` : k === 1 ? "true" : k === 2 ? "null" : `${sn()}`; };
  const arr = () => "[" + Array.from({ length: 1 + ri(4) }, () => scalar()).join(",") + "]";
  const flatObj = () => { const nk = 1 + ri(3); const used = new Set(); const parts = []; while (parts.length < nk) { const k = keys[ri(6)]; if (used.has(k)) continue; used.add(k); parts.push(`"${k}":${scalar()}`); } return "{" + parts.join(",") + "}"; };
  const nested = () => `{"a":${arr()},"b":${flatObj()}}`;
  const jsonVal = () => { const k = ri(4); return k === 0 ? scalar() : k === 1 ? arr() : k === 2 ? flatObj() : nested(); };
  const program = () => {
    let json = jsonVal();                                      // a canonical JSON string
    if (ri(2) === 0) json = json.replace(/:/g, " : ").replace(/,/g, " , ").replace(/{/g, "{ ").replace(/}/g, " }").replace(/\[/g, "[ ").replace(/]/g, " ]");  // inject insignificant whitespace
    const srcLit = JSON.stringify(json);                       // that JSON as an escaped JS string literal
    return `JSON.stringify(JSON.parse(${srcLit}))`;            // parse then re-serialize (canonical for both)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(nodeRun(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-jsonparse: ${checked} JSON.parse round-trips agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-jsonparse: " + f); process.exit(1); }
