// Differential driver: Bun.semver.satisfies vs node-semver; reports valid-input disagreements.
import { execFileSync } from "node:child_process";
import { gen } from "./gen.mjs";
import semver from "semver";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORACLE = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");
const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 10000);
const pairs = gen(seed, n);
const tmp = join(ROOT, "work", "semver-pairs.json"); writeFileSync(tmp, JSON.stringify(pairs));
const bun = JSON.parse(execFileSync(ORACLE, ["--eval",
  `const c=require(${JSON.stringify(tmp)});console.log(JSON.stringify(c.map(([v,r])=>{try{return Bun.semver.satisfies(v,r)}catch{return null}})))`], { encoding: "utf8" }));
const dis = pairs.filter(([v, r], i) => {
  if (bun[i] === null || !semver.valid(v) || semver.validRange(r) === null) return false;
  let node; try { node = semver.satisfies(v, r); } catch { return false; }
  return bun[i] !== node;
});
console.log(`${dis.length} valid-input disagreements (candidate BUN bugs) in ${n} pairs @ seed ${seed}`);
dis.slice(0, 10).forEach(([v, r]) => console.log(`  satisfies(${JSON.stringify(v)}, ${JSON.stringify(r)}) bun=${bun[pairs.indexOf(pairs.find(p=>p[0]===v&&p[1]===r))]}`));
process.exit(dis.length ? 1 : 0);
