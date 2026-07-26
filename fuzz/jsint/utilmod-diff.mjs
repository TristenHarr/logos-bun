// fuzz/jsint/utilmod — the node:util builtin module: util.format (the same %-specifier engine as
// console.log, but returning the string) and util.inspect (the same inspector as console.log but with
// top-level strings QUOTED). Reuses the node-builtin-module foundation (tagStr __nodemod:util marker +
// resolveMethods dispatch). The inspect result is normalized through encodeStr(decodeStr(...)) so the
// value round-trips as a proper string. Diffed vs Node in a temp dir; import on its own line.
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
    const a = 1 + ri(9), b = 1 + ri(9), s = "s" + ri(99), head = `import u from "${ri(3) === 0 ? "node:util" : "util"}";\n`;
    const k = ri(9);
    if (k === 0) return head + `console.log(u.format("%s and %d", "${s}", ${a}));`;
    if (k === 1) return head + `console.log(u.format("x", ${a}, "${s}", ${b}));`;            // no-spec append
    if (k === 2) return head + `console.log(u.format("%j", {v:${a}}));`;
    if (k === 3) return head + `console.log(u.inspect({a:${a},b:[${a},${b}]}));`;
    if (k === 4) return head + `console.log(u.inspect([${a},"${s}",${b}]));`;
    if (k === 5) return head + `console.log(u.inspect("${s}"), u.inspect(${a}), u.inspect(null));`;
    if (k === 6) return head + `let o={name:"${s}",n:${a}};\nconsole.log(u.inspect(o));`;
    if (k === 7) return head + `console.log([${a},${b}].map(x=>u.inspect({k:x})).join(" | "));`;
    return head + `console.log(u.format("[%s]", u.inspect({z:${a}})));`;                     // nested
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "umf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-utilmod: ${checked} node:util programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-utilmod: " + f); process.exit(1); }
