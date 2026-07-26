// fuzz/jsint/events — node:events EventEmitter core. `new EventEmitter()` is a heap object; on/addListener
// append persistent listeners, once appends a one-shot listener (cleared after it fires), emit(name,
// ...args) calls every listener (persistent then once) in registration order and returns whether any ran,
// removeListener/off drop a listener by identity, listenerCount counts both lists. Listeners print, so
// stdout carries the observable behavior; emit's boolean and listenerCount are printed too. Exercised at
// top level and inside functions (regression control for the multi-line splitTop fix). Subclassing
// (`class X extends EventEmitter`) is deferred. Diffed vs Node.
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
  const ev = () => ["data", "go", "close", "error2", "tick"][ri(5)];
  const spec = () => ri(3) === 0 ? "node:events" : "events";
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9), e = ev(), k = ri(9);
    const head = `import { EventEmitter } from "${spec()}";\n`;
    if (k === 0) return head + `const em = new EventEmitter();\nem.on(${JSON.stringify(e)}, (x) => console.log("h", x));\nem.emit(${JSON.stringify(e)}, ${a});\nem.emit(${JSON.stringify(e)}, ${b});`;
    if (k === 1) return head + `const em = new EventEmitter();\nem.on(${JSON.stringify(e)}, (x, y) => console.log(x + y));\nem.on(${JSON.stringify(e)}, (x, y) => console.log(x * y));\nem.emit(${JSON.stringify(e)}, ${a}, ${b});`;
    if (k === 2) return head + `const em = new EventEmitter();\nlet c = 0;\nem.once(${JSON.stringify(e)}, () => { c = c + 1; console.log("once", c); });\nem.emit(${JSON.stringify(e)});\nem.emit(${JSON.stringify(e)});\nconsole.log("final", c);`;
    if (k === 3) return head + `const em = new EventEmitter();\nem.on(${JSON.stringify(e)}, () => {});\nem.on(${JSON.stringify(e)}, () => {});\nconsole.log(em.listenerCount(${JSON.stringify(e)}));`;
    if (k === 4) return head + `const em = new EventEmitter();\nconst fn = (v) => console.log("f", v);\nem.on(${JSON.stringify(e)}, fn);\nconsole.log(em.listenerCount(${JSON.stringify(e)}));\nem.removeListener(${JSON.stringify(e)}, fn);\nem.emit(${JSON.stringify(e)}, ${a});\nconsole.log(em.listenerCount(${JSON.stringify(e)}));`;
    if (k === 5) return head + `const em = new EventEmitter();\nconsole.log(em.emit(${JSON.stringify(e)}));\nem.on(${JSON.stringify(e)}, () => {});\nconsole.log(em.emit(${JSON.stringify(e)}));`;
    if (k === 6) return head + `function make() {\n  const em = new EventEmitter();\n  em.on(${JSON.stringify(e)}, (n) => console.log("in", n));\n  em.emit(${JSON.stringify(e)}, ${a});\n  return em.listenerCount(${JSON.stringify(e)});\n}\nconsole.log(make());`;
    if (k === 7) return head + `const em = new EventEmitter();\nem.addListener(${JSON.stringify(e)}, (x) => console.log("add", x));\nem.emit(${JSON.stringify(e)}, ${a});\nconst g = () => console.log("off-test");\nem.on(${JSON.stringify(e)}, g);\nem.off(${JSON.stringify(e)}, g);\nem.emit(${JSON.stringify(e)}, ${b});`;
    return head + `const em = new EventEmitter();\nem.on(${JSON.stringify(e)}, (x) => console.log("a", x));\nem.once(${JSON.stringify(e)}, (x) => console.log("b", x));\nem.emit(${JSON.stringify(e)}, ${a});\nem.emit(${JSON.stringify(e)}, ${b});`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "evf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-events: ${checked} EventEmitter programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-events: " + f); process.exit(1); }
