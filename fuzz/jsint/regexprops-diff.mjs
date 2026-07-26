// fuzz/jsint/regexprops — RegExp read-only properties: .source, .flags, .lastIndex (0 until exec advances
// it), and the flag booleans .global/.ignoreCase/.multiline/.sticky/.dotAll/.unicode. These are backed by
// internal __regex_* fields; getMember now maps them (a plain read returned undefined). .test/.match are
// regression controls. (Sticky/global .test advancing lastIndex is a separate follow-up, not exercised.)
// Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "rp-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sources = ["\\\\d+", "[a-z]", "ab+c", "\\\\w{2,3}", "foo|bar", "^x$"];
  const flagsets = ["", "g", "i", "gi", "gm", "y", "s", "gimsu"];
  const src = () => sources[ri(sources.length)];
  const fl = () => flagsets[ri(flagsets.length)];
  const program = () => {
    const s = src(), f = fl();
    const k = ri(7);
    if (k === 0) return `const re=new RegExp("${s}","${f}");console.log(re.source+"|"+re.flags)`;
    if (k === 1) return `const re=new RegExp("${s}","${f}");console.log([re.global,re.ignoreCase,re.multiline,re.sticky,re.dotAll,re.unicode].join(","))`;
    if (k === 2) return `const re=new RegExp("${s}","${f}");console.log(re.lastIndex)`;
    // exec-advances-lastIndex uses a plain global (sticky .exec semantics is a separate gap)
    if (k === 3) return `const re=new RegExp("\\\\d","g");re.exec("a1b2c3");console.log(re.lastIndex)`;
    if (k === 4) return `const re=new RegExp("\\\\d","g");re.exec("a1b2c3");re.exec("a1b2c3");console.log(re.lastIndex)`;
    if (k === 5) return `console.log(new RegExp("${s}","${f}"))`;  // console.log(regex) -> /source/flags
    // .test control uses a NON-STICKY flag (sticky/global anchored matching is a separate follow-up gap)
    return `const re=new RegExp("${s}","${f.replace(/[yg]/g, "")}");console.log(re.test("ab12cd"))`;
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
  if (!fails.length) console.log(`PASS jsint-regexprops: ${checked} RegExp-property programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-regexprops: " + f); process.exit(1); }
