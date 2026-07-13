// Differential fuzz: Bun.TOML.parse vs @iarna/toml (spec-conformant reference).
// A disagreement on a doc BOTH accept, OR one accepts and the other rejects a doc that the
// reference deems valid, is a candidate BUN bug (triage per §9.4). node fuzz/toml/diff.mjs [seed] [n]
import iarna from "@iarna/toml";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gen } from "./gen.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const O = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");
const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 2000);
const docs = gen(seed, n);

// Canonicalize a parsed value so representation differences (BigInt vs number, Date vs string,
// object key order) don't create false positives — only genuine structure/value diffs surface.
function canon(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "bigint") return "N:" + v.toString();
  if (typeof v === "number") return "N:" + (Number.isInteger(v) ? v.toString() : v);
  if (typeof v === "boolean") return "B:" + v;
  if (typeof v === "string") return "S:" + v;
  if (v instanceof Date) return "D:" + v.toISOString();
  if (v && typeof v.toISOString === "function") return "D:" + v.toISOString();      // @iarna date types
  if (v && typeof v.toJSON === "function" && !Array.isArray(v)) { try { return "S:" + v.toJSON(); } catch {} }
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return "?" + String(v);
}

const tmp = join(ROOT, "work", "toml-docs.json");
writeFileSync(tmp, JSON.stringify(docs));
// Bun side (batch, in one eval): {ok, val|err} per doc.
const bun = JSON.parse(execFileSync(O, ["--eval",
  `const c=require(${JSON.stringify(tmp)});console.log(JSON.stringify(c.map(d=>{try{return {ok:true,v:Bun.TOML.parse(d)}}catch(e){return {ok:false,e:String(e.message||e)}}})))`],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

let valuemismatch = [], bunRejectsValid = [], bunAcceptsInvalid = [];
docs.forEach((d, i) => {
  let ref, refOk = true;
  try { ref = iarna.parse(d); } catch { refOk = false; }
  const b = bun[i];
  if (refOk && b.ok) { if (canon(ref) !== canon(b.v)) valuemismatch.push([d, canon(ref), canon(b.v)]); }
  else if (refOk && !b.ok) bunRejectsValid.push([d, b.e]);          // reference accepts, bun rejects
  else if (!refOk && b.ok) bunAcceptsInvalid.push([d]);              // bun accepts what the reference rejects
});
console.log(`TOML fuzz @ seed ${seed}, ${n} docs:`);
console.log(`  value-mismatches (both parse, differ):     ${valuemismatch.length}`);
console.log(`  bun REJECTS a reference-valid doc:          ${bunRejectsValid.length}`);
console.log(`  bun ACCEPTS a reference-invalid doc:        ${bunAcceptsInvalid.length}  (leniency — usually spec-ambiguity)`);
const show = (title, arr, fmt) => { if (!arr.length) return; console.log(`\n${title}:`); arr.slice(0, 8).forEach(fmt); };
show("VALUE MISMATCH (candidate bug)", valuemismatch, ([d, r, b]) => console.log(`  --- doc ---\n${d.trim().split("\n").map(l => "  | " + l).join("\n")}\n    ref=${r}\n    bun=${b}`));
show("BUN REJECTS VALID (candidate bug)", bunRejectsValid, ([d, e]) => console.log(`  --- doc ---\n${d.trim().split("\n").map(l => "  | " + l).join("\n")}\n    bun error: ${e}`));
process.exit((valuemismatch.length || bunRejectsValid.length) ? 1 : 0);
