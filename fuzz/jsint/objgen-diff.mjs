// fuzz/jsint/objgen — generator methods in an OBJECT literal (`{ *m(){ yield … } }`). The object-method
// desugar (domWalk) now recognizes a `*`-prefixed method key and emits `m : function* (){…}`, and a second
// desugarGenerators pass (after desugarObjMethods) lowers it to the generator machinery. Diffed vs Node.
// (Deferred: generator methods in a CLASS body — classWalk needs the same `*`-key case.)
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = "node";
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir, timeout: 5000 }); return ((r.stdout || "") + (r.status ? "\n<exit:" + r.status + ">" : "")).trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(8);
    if (k === 0) return `var o = { *m(){ yield ${a}; } };\nconsole.log(o.m().next().value);`;
    if (k === 1) return `var o = { *m(){ yield ${a}; yield ${b}; } };\nvar it = o.m();\nconsole.log(it.next().value, it.next().value, it.next().done);`;
    if (k === 2) return `var o = { n: ${a}, *g(){ yield this.n; yield this.n + ${b}; } };\nvar it = o.g();\nconsole.log(it.next().value, it.next().value);`;
    if (k === 3) return `var o = { *range(){ for (var i = 0; i < ${1 + ri(4)}; i++) yield i + ${a}; } };\nconsole.log([...o.range()].join(","));`;
    if (k === 4) return `var o = { plain(){ return ${a}; }, *gen(){ yield ${b}; } };\nconsole.log(o.plain(), o.gen().next().value);`;
    if (k === 5) return `var o = { *m(){ var x = ${a}; yield x; yield x * 2; } };\nvar it = o.m();\nconsole.log(it.next().value + it.next().value);`;
    if (k === 6) return `var o = { *empty(){ } };\nconsole.log(o.empty().next().done);`;
    // NOTE: a generator with an explicit `return VALUE` (vs falling off the end) is a separate PRE-EXISTING
    // gap — it fails for standalone `function*` too — so it is out of scope for this object-method fuzzer.
    return `var o = { *m(){ yield ${a}; yield ${a} + ${b}; } };\nconsole.log(Array.from(o.m()).join("-"));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "ogf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objgen: ${checked} object-generator-method programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objgen: " + f); process.exit(1); }
