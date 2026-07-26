// fuzz/jsint/querystring — node:querystring (application/x-www-form-urlencoded): parse (string -> object),
// stringify (object -> string), escape/unescape (percent-codec). parse builds a heap object; stringify
// iterates one; escape is encodeURIComponent's unreserved set, unescape decodes %XX and +. Uses the
// node-builtin-module foundation. ASCII inputs only (multi-byte UTF-8 percent-encoding is a follow-up).
// JSON.stringify is a regression control (its name overlaps qs.stringify but dispatches by receiver).
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
  const key = () => "k" + ri(99);
  const val = () => ["v" + ri(99), "a b", "x&y", "1", "p=q", "hello world"][ri(6)];
  const qstr = () => Array.from({ length: 1 + ri(3) }, () => key() + "=" + encodeURIComponent(val())).join("&");
  const obj = () => "{" + Array.from({ length: 1 + ri(3) }, () => JSON.stringify(key()) + ":" + JSON.stringify(val())).join(",") + "}";
  const program = () => {
    const head = `import qs from "${ri(3) === 0 ? "node:querystring" : "querystring"}";\n`;
    const k = ri(8);
    if (k === 0) return head + `console.log(JSON.stringify(qs.parse(${JSON.stringify(qstr())})));`;
    if (k === 1) return head + `console.log(qs.stringify(${obj()}));`;
    if (k === 2) return head + `console.log(qs.escape(${JSON.stringify(val())}));`;
    if (k === 3) return head + `console.log(qs.unescape(${JSON.stringify(encodeURIComponent(val()))}));`;
    if (k === 4) return head + `console.log(qs.stringify(qs.parse(${JSON.stringify(qstr())})));`;             // roundtrip
    if (k === 5) return `import { parse } from "querystring";\nconsole.log(JSON.stringify(parse(${JSON.stringify(qstr())})));`; // named
    if (k === 6) return `console.log(JSON.stringify(${obj()}));`;                                             // JSON.stringify control
    return `import qs from "querystring";\nconsole.log(JSON.stringify(qs.parse(${JSON.stringify(qstr())})), JSON.stringify([1,2,3]));`; // both stringifys
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "qsf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-querystring: ${checked} querystring programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-querystring: " + f); process.exit(1); }
