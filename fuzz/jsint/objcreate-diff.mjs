// fuzz/jsint/objcreate — Object.create(proto): a new object that INHERITS data properties from proto via
// a prototype chain. It was unimplemented, and getMember had no prototype fallthrough, so y=Object.create({a:1})
// then y.a returned undefined. Object.create now stores a __proto__ link (an internal key, absent from
// Object.keys/JSON.stringify) and getMember walks it when a property is missing locally; Object.create(null)
// / a non-object arg gives a bare object. Covers single/multi-level data inheritance, own-vs-inherited
// shadowing, and enumeration (own keys only). (Inherited METHOD calls that need `this` are a separate
// pending path and are not exercised.) Diffed vs Node.
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
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(7);
    if (k === 0) return `const p={a:${a}};const o=Object.create(p);o.a`;
    if (k === 1) return `const p={a:${a}};const o=Object.create(p);o.b=${b};o.a+","+o.b`;
    if (k === 2) return `const p={a:${a}};const o=Object.create(p);o.a=${b};p.a+","+o.a`;   // own shadows proto
    if (k === 3) return `const g={x:${a}};const m=Object.create(g);const o=Object.create(m);o.x`;
    if (k === 4) return `const p={a:${a}};const o=Object.create(p);o.own=${b};Object.keys(o).join(",")`;
    if (k === 5) return `const p={a:${a}};const o=Object.create(p);JSON.stringify(o)`;
    return `const o=Object.create(null);o.v=${a};o.v`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objcreate: ${checked} Object.create programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objcreate: " + f); process.exit(1); }
