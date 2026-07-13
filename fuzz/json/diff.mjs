// Differential fuzz: bun's JSON.parse (Rust reimpl) vs node's JSON.parse (V8, the reference).
// Both implement ECMA-404 / RFC 8259; a disagreement on valid JSON is a candidate BUN bug.
// Edge-case-biased: unicode escapes, lone surrogates, big/precise numbers, deep nesting, dup keys.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32 } from "../semver/gen.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const O = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");
const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 4000);
const r = mulberry32(seed);
const pick = (a) => a[Math.floor(r() * a.length)];

const numTok = () => pick([
  "0", "-0", "1", "-1", "123456789012345678901234567890", "1e309", "1e-400", "3.141592653589793238462643",
  "1.7976931348623157e308", "5e-324", "9007199254740993", "-9007199254740993", "0.1", "1E10", "2.5e-3",
  "10000000000000000.5", "0.30000000000000004", "1234567890123456789",
]);
const strTok = () => {
  const parts = pick([
    '"hi"', '"\\u0041"', '"\\ud83d\\ude00"' /* emoji surrogate pair */, '"\\ud800"' /* lone high surrogate */,
    '"\\udc00"' /* lone low */, '"\\ud800\\ud800"' /* two highs */, '"tab\\tnl\\n"', '"\\u0000"', '"quote\\""',
    '"slash\\/"', '"\\ude00\\ud83d"' /* reversed */, '"é\\u00e9"', '"\\uD834\\uDD1E"' /* astral */,
  ]);
  return parts;
};
function val(depth) {
  const k = r();
  if (depth > 3) return r() < 0.5 ? numTok() : strTok();
  if (k < 0.3) return numTok();
  if (k < 0.5) return strTok();
  if (k < 0.62) return pick(["true", "false", "null"]);
  if (k < 0.8) { const len = Math.floor(r() * 4); return "[" + Array.from({ length: len }, () => val(depth + 1)).join(",") + "]"; }
  const len = Math.floor(r() * 4); const keys = [];
  for (let i = 0; i < len; i++) keys.push(`${strTok()}:${val(depth + 1)}`);
  if (r() < 0.2 && len) keys.push(`${strTok()}:${val(depth + 1)}`); // occasional dup-key
  return "{" + keys.join(",") + "}";
}
const docs = []; for (let i = 0; i < n; i++) docs.push(val(0));

// Canonicalize: JSON.stringify with code-point escaping so surrogate/precision diffs surface exactly.
const canonSrc = `(v)=>{const e=s=>[...s].map(c=>{const p=c.codePointAt(0);return p<32||p>126?"\\\\u{"+p.toString(16)+"}":c}).join("");const c=x=>x===null?"null":typeof x==="number"?(Object.is(x,-0)?"-0":String(x)):typeof x==="string"?'"'+e(x)+'"':typeof x==="boolean"?String(x):Array.isArray(x)?"["+x.map(c).join(",")+"]":"{"+Object.keys(x).sort().map(k=>'"'+e(k)+'":'+c(x[k])).join(",")+"}";return c(v)}`;
const tmp = join(ROOT, "work", "json-docs.json");
writeFileSync(tmp, JSON.stringify(docs));
const bun = JSON.parse(execFileSync(O, ["--eval",
  `const C=${canonSrc};const d=require(${JSON.stringify(tmp)});console.log(JSON.stringify(d.map(s=>{try{return {ok:1,c:C(JSON.parse(s))}}catch(e){return {ok:0}}})))`],
  { encoding: "utf8", maxBuffer: 64e6 }));
const C = eval(canonSrc);

let mismatch = [], bunRej = [], nodeRej = [];
docs.forEach((s, i) => {
  let nv, nok = 1; try { nv = JSON.parse(s); } catch { nok = 0; }
  const b = bun[i];
  if (nok && b.ok) { const nc = C(nv); if (nc !== b.c) mismatch.push([s, nc, b.c]); }
  else if (nok && !b.ok) bunRej.push([s]);
  else if (!nok && b.ok) nodeRej.push([s]);
});
console.log(`JSON fuzz @ seed ${seed}, ${n} docs:`);
console.log(`  value-mismatches (both parse, differ): ${mismatch.length}`);
console.log(`  bun REJECTS node-valid JSON:           ${bunRej.length}`);
console.log(`  bun ACCEPTS node-invalid JSON:         ${nodeRej.length}`);
mismatch.slice(0, 12).forEach(([s, nc, bc]) => console.log(`  MISMATCH ${JSON.stringify(s)}\n    node=${nc}\n    bun =${bc}`));
bunRej.slice(0, 8).forEach(([s]) => console.log(`  BUN-REJECTS ${JSON.stringify(s)}`));
process.exit((mismatch.length || bunRej.length) ? 1 : 0);
