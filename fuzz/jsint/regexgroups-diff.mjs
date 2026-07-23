// fuzz/jsint/regexgroups — regex GROUPS and ALTERNATION. The Kernighan-Pike matcher treated `(`/`)`/`|`
// as literal atoms, so ANY grouped or alternating pattern silently failed to match (`/(foo)/.test("foo")`
// → false). The rewritten `mh` matcher handles groups, top-level and in-group alternation, non-capturing
// `(?:…)`, nested groups, and greedy group quantifiers `(B)*`/`(B)+`/`(B)?` via the pattern-derivative
// (substitution) method. This fuzzer checks `.test()` and `.replace(pat,"X")` for a spread of grouped
// patterns against random strings, differentially vs Node. It deliberately avoids `{n,m}` brace
// quantifiers and `$N` backreferences (separate features) and any nested-unbounded pattern that would
// trigger catastrophic backtracking (inherent to every backtracking engine, V8 included).
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
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  // patterns whose semantics rely on groups/alternation; each paired with a random-string generator
  const cases = [
    { re: "(foo)", s: () => ["foo", "fo", "xfoox", "bar"][ri(4)] },
    { re: "(\\d+)-(\\d+)", s: () => [`${ri(999)}-${ri(999)}`, `${ri(99)}x${ri(99)}`, "12-", "ab-cd"][ri(4)] },
    { re: "a(b|c)d", s: () => ["abd", "acd", "aed", "ad", "abcd"][ri(5)] },
    { re: "(ab)+", s: () => ["ab".repeat(1 + ri(4)), "aba", "a", "xabx"][ri(4)] },
    { re: "^(ab)+$", s: () => ["ab".repeat(1 + ri(4)), "aba", "abab c"][ri(3)] },
    { re: "(\\d+,)*\\d+", s: () => [Array.from({ length: 1 + ri(4) }, () => ri(99)).join(","), "1,", ",2", "x"][ri(4)] },
    { re: "^(\\w+)@(\\w+)$", s: () => [`u${ri(9)}@h${ri(9)}`, "no-at", "a@b@c"][ri(3)] },
    { re: "cat|dog|bird", s: () => ["cat", "dog", "bird", "fish", "xdogy"][ri(5)] },
    { re: "^(cat|dog)$", s: () => ["cat", "dog", "cats", "catdog"][ri(4)] },
    { re: "x(?:yz)?w", s: () => ["xw", "xyzw", "xyw", "xyzyzw"][ri(4)] },
    { re: "(?:ab)+c", s: () => ["ab".repeat(1 + ri(3)) + "c", "c", "abc", "abx"][ri(4)] },
    { re: "((a)(b))", s: () => ["ab", "a", "b", "xaby"][ri(4)] },
    { re: "https?://(\\w+)", s: () => [`http://h${ri(9)}`, `https://h${ri(9)}`, "ftp://x", "http://"][ri(4)] },
    { re: "(a|bc)+d", s: () => ["ad", "bcd", "abcad", "abcd", "d"][ri(5)] },
  ];
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const c = cases[ri(cases.length)];
    const str = c.s();
    const mode = ri(2);
    const prog = mode === 0
      ? `(function(){ return new RegExp(${JSON.stringify(c.re)}).test(${JSON.stringify(str)}) })()`
      : `(function(){ return ${JSON.stringify(str)}.replace(new RegExp(${JSON.stringify(c.re)}), "X") })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-regexgroups: ${checked} group/alternation programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-regexgroups: " + f); process.exit(1); }
