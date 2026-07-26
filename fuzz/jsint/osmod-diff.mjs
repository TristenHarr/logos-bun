// fuzz/jsint/osmod — the node:os builtin module (deterministic surface): platform/arch/type/endianness/
// tmpdir/homedir + the EOL data property. Values come from natives that remap Rust's target/OS spelling
// to Node's (x86_64->x64, macos->darwin, …); homedir reads $HOME; EOL is "\n" on POSIX. Every value is a
// host constant, so ours must byte-match Node on this machine. Default, `node:os`, and named-import forms
// are exercised (incl. `as` rename). Diffed vs Node in a temp dir.
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
    const spec = ri(3) === 0 ? "node:os" : "os";
    const head = `import os from "${spec}";\n`;
    const k = ri(13);
    if (k === 11) return head + `console.log(os.availableParallelism() > 0, typeof os.availableParallelism());`;
    if (k === 12) return `import { availableParallelism } from "${spec}";\nconsole.log(availableParallelism() > 0);`;
    if (k === 0) return head + `console.log(os.platform());`;
    if (k === 1) return head + `console.log(os.arch());`;
    if (k === 2) return head + `console.log(os.type());`;
    if (k === 3) return head + `console.log(os.endianness());`;
    if (k === 4) return head + `console.log(os.tmpdir());`;
    if (k === 5) return head + `console.log(os.homedir());`;
    if (k === 6) return head + `console.log(JSON.stringify(os.EOL));`;
    if (k === 7) return head + `console.log(["a", "b", "c"].join(os.EOL));`;
    if (k === 8) return head + `console.log(os.platform() + "-" + os.arch() + " (" + os.type() + ", " + os.endianness() + ")");`;
    if (k === 9) return `import { platform, arch } from "${spec}";\nconsole.log(platform(), arch());`;
    return `import { tmpdir as t, homedir as h } from "${spec}";\nconsole.log(t() + "::" + h());`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "osf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-osmod: ${checked} node:os programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-osmod: " + f); process.exit(1); }
