// fuzz/jsint/chain-diff — METHOD CHAINING: random, type-tracked chains of 2–5
// string/array methods (`a.f().g().h()`), each run through logos-bun __js AND
// Node eval and required to agree. Locks the leftmost-method dispatch that makes
// a chain resolve left-to-right regardless of each method's branch priority
// (before the fix, `s.toUpperCase().indexOf(x)` fired the indexOf branch first
// because indexOf outranks toUpperCase, and read `)` as the receiver).
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
const nodeRun = (p) => String(eval(p));
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const letters = "abcABCxy";
  const baseStr = () => { let s = ""; const L = 3 + ri(5); for (let i = 0; i < L; i++) s += letters[ri(letters.length)]; return s; };
  const baseCsv = () => { const parts = 2 + ri(3); let a = []; for (let i = 0; i < parts; i++) a.push(letters[ri(letters.length)] + letters[ri(letters.length)]); return a.join(","); };
  // a chain STEP: given the current type, return {code, next} or null (terminal). No arg touches
  // a scoped-out primitive: split() sep is never "" ; slice bounds are non-negative.
  const strStep = () => {
    const k = ri(11);
    if (k === 0) return { code: `.toUpperCase()`, next: "str" };
    if (k === 1) return { code: `.toLowerCase()`, next: "str" };
    if (k === 2) return { code: `.slice(${ri(3)},${3 + ri(4)})`, next: "str" };
    if (k === 3) return { code: `.replace("${letters[ri(3)]}","Z")`, next: "str" };
    if (k === 4) return { code: `.charAt(${ri(4)})`, next: "str" };
    if (k === 5) return { code: `.repeat(${1 + ri(2)})`, next: "str" };
    if (k === 6) return { code: `.split(",")`, next: "arr" };
    if (k === 7) return { code: `.indexOf("${letters[ri(3)]}")`, next: null };
    if (k === 8) return { code: `.includes("${letters[ri(3)]}")`, next: null };
    if (k === 9) return { code: `.startsWith("${letters[ri(3)]}")`, next: null };
    return { code: `.length`, next: null };
  };
  const arrStep = () => {
    const k = ri(6);
    if (k === 0) return { code: `.reverse()`, next: "arr" };
    if (k === 1) return { code: `.slice(${ri(2)},${2 + ri(3)})`, next: "arr" };
    if (k === 2) return { code: `.map(function(x){return x.toUpperCase()})`, next: "arr" };
    if (k === 3) return { code: `.join("${["-", "_", "|"][ri(3)]}")`, next: "str" };
    if (k === 4) return { code: `.indexOf("${letters[ri(3)]}${letters[ri(3)]}")`, next: null };
    return { code: `.length`, next: null };
  };
  const gen = () => {
    let useCsv = rnd() < 0.5;
    let type = "str";
    let code = `"${useCsv ? baseCsv() : baseStr()}"`;
    const depth = 2 + ri(4);  // 2..5 links
    for (let i = 0; i < depth; i++) {
      const step = type === "str" ? strStep() : arrStep();
      code += step.code;
      if (step.next === null) return code;      // terminal reached
      type = step.next;
    }
    return code;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = gen();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-chain: ${checked} method-chain programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-chain: " + f); process.exit(1); }
