// fuzz/jsint/classname — the .name of a class value (C.name → "C"). Classes had no name property, so
// C.name read as " . name". Class definition now emits a default `__static_<C>_name = "<C>"` (before user
// statics, so a user `static name = x` still overrides), and the static reader returns it. Covers a bare
// class, an extends class, C.name inside a static method / constructor, and the user-override case.
// Diffed vs Node via a module file (`bun run`).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "cn-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const names = ["Animal", "Dog", "Widget", "Foo", "Service", "Model"];
  const program = () => {
    const nm = names[ri(names.length)], k = ri(6);
    if (k === 0) return `class ${nm}{}console.log(${nm}.name)`;
    if (k === 1) return `class ${nm} extends Object{}console.log(${nm}.name)`;
    if (k === 2) return `class ${nm}{static who(){return ${nm}.name}}console.log(${nm}.who())`;
    if (k === 3) return `class ${nm}{constructor(){this.t=${nm}.name}}console.log(new ${nm}().t)`;
    if (k === 4) return `class ${nm}{static name="X"}console.log(${nm}.name)`;              // user override
    return `class ${nm}{static x=${ri(9)}}console.log(${nm}.name+":"+${nm}.x)`;              // name + a static field
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
  if (!fails.length) console.log(`PASS jsint-classname: ${checked} class-name programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-classname: " + f); process.exit(1); }
