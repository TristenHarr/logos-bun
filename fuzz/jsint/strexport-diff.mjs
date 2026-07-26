// fuzz/jsint/strexport — a module export whose VALUE derives from a string literal (`export const v="s"`,
// `export default "s"`, a string-returning function, an object/array with string fields). collectExports
// detected a re-export by "line contains a string literal" (importSpec = the first string literal), so ANY
// string-valued export was misread as `export {…} from "<the value>"` and its binding was lost (import read
// NaN / typeof undefined). Fixed by gating the re-export branch on ` from `. Number exports and real
// `export … from "mod"` re-exports are regression controls. Diffed vs Node (run in a temp dir, cwd-relative).
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
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "sxf-"));
    const s = "s" + ri(9999), a = 1 + ri(50), shape = ri(7);
    let entry;
    if (shape === 0) {
      writeFileSync(join(dir, "m.js"), `export const v = "${s}";\n`);
      entry = `import { v } from "./m.js";\nconsole.log(v + "|" + typeof v);\n`;
    } else if (shape === 1) {
      writeFileSync(join(dir, "m.js"), `export default "${s}";\n`);
      entry = `import d from "./m.js";\nconsole.log(d);\n`;
    } else if (shape === 2) {
      writeFileSync(join(dir, "m.js"), `export function greet(){ return "${s}"; }\n`);
      entry = `import { greet } from "./m.js";\nconsole.log(greet());\n`;
    } else if (shape === 3) {
      writeFileSync(join(dir, "m.js"), `export const o = { name: "${s}", num: ${a} };\n`);
      entry = `import { o } from "./m.js";\nconsole.log(o.name + ":" + o.num);\n`;
    } else if (shape === 4) {
      writeFileSync(join(dir, "m.js"), `export const label = "a" + "${s}" + ${a};\n`);
      entry = `import { label } from "./m.js";\nconsole.log(label);\n`;
    } else if (shape === 5) {
      // number export + string export together
      writeFileSync(join(dir, "m.js"), `export const num = ${a};\nexport const text = "${s}";\n`);
      entry = `import { num, text } from "./m.js";\nconsole.log(num + " " + text);\n`;
    } else {
      // real re-export from "mod" must still work (regression control)
      writeFileSync(join(dir, "orig.js"), `export const base = "${s}";\nexport const k = ${a};\n`);
      writeFileSync(join(dir, "mid.js"), `export { base } from "./orig.js";\nexport const extra = "e${a}";\n`);
      entry = `import { base, extra } from "./mid.js";\nconsole.log(base + "," + extra);\n`;
    }
    writeFileSync(join(dir, "entry.js"), entry);
    const ref = run(NODE, dir, ["entry.js"]);
    const got = run(OURS, dir, ["run", "entry.js"]);
    if (got !== ref) fails.push(`shape ${shape} (seed ${seed} it ${it}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-strexport: ${checked} string-export module graphs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-strexport: " + f); process.exit(1); }
