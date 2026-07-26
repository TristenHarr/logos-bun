// fuzz/jsint/typeofundef — `typeof undeclaredName` is the one read that yields "undefined" instead of
// throwing (the classic `typeof x === "undefined"` feature-test). typeOfTag now maps a bare undeclared
// identifier to "undefined". A DECLARED binding is substituted to its value before typeOfTag, so declared
// vars/literals keep their real type — those are regression controls, as is `typeof typeof` nesting and a
// declared var whose NAME resembles the undeclared probe. (typeof of a builtin object like Math, and of a
// member expression `o.m`, are separate known gaps and are deliberately NOT exercised here.) Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bin binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "tu-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const un = () => "wz" + ri(9999);                                     // never declared
  const lit = () => ["5", '"s"', "true", "3.5", "-2", "1+1"][ri(6)];
  const program = () => {
    const u = un(), l = lit(), k = ri(9);
    if (k === 0) return `console.log(typeof ${u})`;                     // undeclared -> "undefined"
    if (k === 1) return `console.log(typeof ${u} === "undefined")`;
    if (k === 2) return `if (typeof ${u} === "undefined") console.log("safe"); else console.log("no")`;
    if (k === 3) return `console.log(typeof ${u}, typeof ${un()})`;     // two undeclared
    // regression controls
    if (k === 4) return `console.log(typeof ${l})`;                     // literal keeps its type
    if (k === 5) return `let ${u}v = ${l}; console.log(typeof ${u}v)`;  // declared (name near probe) keeps type
    if (k === 6) return `console.log(typeof typeof ${u})`;              // typeof of undefined-str -> "string"
    if (k === 7) return `let x = ${l}; console.log(typeof x === typeof ${l})`;
    return `console.log([${l}].map(z=>typeof z)[0])`;                   // typeof in a callback
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-typeofundef: ${checked} typeof-undeclared programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-typeofundef: " + f); process.exit(1); }
