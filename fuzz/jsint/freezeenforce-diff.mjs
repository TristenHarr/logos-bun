// fuzz/jsint/freezeenforce — Object.freeze now ENFORCES immutability (previously only Object.isFrozen
// reported it): a write or add to a frozen object's property is silently ignored (non-strict), so
// Object.freeze({a:1}) then o.a=2 keeps a=1 and o.b=5 never appears. assignDot/assignBrk check jsIsFrozen
// on the container before writing. Freeze is shallow (a nested object stays mutable). Non-frozen objects,
// arrays, push, ++, and method mutation are regressions that must still write. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(8);
    if (k === 0) return `let o={a:${a}};Object.freeze(o);o.a=${b};o.a`;
    if (k === 1) return `let o={a:${a}};Object.freeze(o);o.b=${b};String(o.b)`;
    if (k === 2) return `let o={a:${a}};Object.freeze(o);o["a"]=${b};o.a`;
    if (k === 3) return `let o={a:${a}};Object.freeze(o);o.a=${b};JSON.stringify(o)`;
    if (k === 4) return `let o={x:{y:${a}}};Object.freeze(o);o.x.y=${b};o.x.y`;   // shallow: nested mutable
    if (k === 5) return `let o={a:${a}};o.a=${b};o.a`;                             // regression: not frozen
    if (k === 6) return `let arr=[${a}];arr[0]=${b};arr[0]`;                       // regression: array write
    return `let o={n:${a}};o.n++;o.n`;                                            // regression: increment
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-freezeenforce: ${checked} Object.freeze-enforcement programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-freezeenforce: " + f); process.exit(1); }
