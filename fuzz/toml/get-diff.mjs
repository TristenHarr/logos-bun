// fuzz/toml/get-diff — differential fuzzer for logos-bun's pure-.lg TOML value
// extractor (tomlGet: read a dotted key out of a bunfig-style TOML doc) against
// @iarna/toml (the reference our earlier fuzzing found 5 bun-TOML bugs against).
// Every generated doc is re-parsed by @iarna first (so the corpus is valid TOML),
// then each key is looked up both ways and the string-normalized values compared.
//
// SCOPE: the bunfig subset tomlGet supports — top-level + [table] + [a.b] nested
// sections, values = basic string / integer / boolean, one `key = value` per line.
// Arrays, inline tables, floats (1.0→1 normalization trap), underscored ints,
// multiline strings, and `#` comments are a later increment; the generator stays
// inside the subset so a disagreement is a real bug, not an unimplemented feature.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import TOML from "@iarna/toml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(dir, out = []) {
  let es; try { es = readdirSync(dir); } catch { return out; }
  for (const e of es) {
    const p = join(dir, e); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findBin(p, out);
    else if (e === "bun" && st.mode & 0o111) out.push(p);
  }
  return out;
}
const OURS = findBin(join(ROOT, "target"))
  .filter((p) => !/vendor|oracle/.test(p))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

const fails = [];
if (!OURS) fails.push("no logos-bun binary under target/ — build it first");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ours = (doc, key) => {
  const r = spawnSync(OURS, ["__toml-get", doc, key], { encoding: "utf8" });
  return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, "");
};
const navigate = (obj, dotted) => dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const norm = (v) => (v === undefined ? "" : typeof v === "object" ? "￿obj" : String(v));

if (OURS) {
  const seed = Number(process.argv[2] || 20260714);
  const n = Number(process.argv[3] || 400);
  const rnd = mulberry32(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const ident = () => Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => pick("abcdefghij0123".split(""))).join("");
  // String content that stays inside the subset: no `"`, no `\`, no `[` lead, no
  // " = " substring (which would split the key/value line), no newline.
  const strContent = () => {
    let s = Array.from({ length: Math.floor(rnd() * 8) }, () => pick("abc012 ./~-_x".split(""))).join("").trim();
    return s.includes(" = ") ? s.replace(/ = /g, " x ") : s;
  };
  const value = () => {
    const k = rnd();
    if (k < 0.4) return { toml: `"${strContent()}"`, js: undefined, str: true };
    if (k < 0.7) { const n = Math.floor(rnd() * 20000) - 5000; return { toml: `${n}`, js: n }; }
    const b = rnd() < 0.5; return { toml: `${b}`, js: b };
  };

  let checked = 0, hit = 0;
  for (let it = 0; it < n; it++) {
    // Build a doc: a top-level section then 1-3 [table]/[a.b] sections, unique keys.
    const lines = [];
    const keys = []; // [dottedKey, tomlValueText]
    const emitTable = (prefix) => {
      const used = new Set();
      const cnt = 1 + Math.floor(rnd() * 4);
      for (let i = 0; i < cnt; i++) {
        let k = ident(); if (used.has(k)) continue; used.add(k);
        const v = value();
        const content = v.str ? v.toml.slice(1, -1) : v.toml;
        lines.push(`${k} = ${v.toml}`);
        keys.push([prefix ? `${prefix}.${k}` : k, content]);
      }
    };
    emitTable("");
    const tcnt = 1 + Math.floor(rnd() * 3);
    const tablesUsed = new Set();
    for (let t = 0; t < tcnt; t++) {
      let tp = ident() + (rnd() < 0.4 ? `.${ident()}` : "");
      if (tablesUsed.has(tp)) continue; tablesUsed.add(tp);
      lines.push("");
      lines.push(`[${tp}]`);
      emitTable(tp);
    }
    const doc = lines.join("\n");
    let parsed; try { parsed = TOML.parse(doc); } catch { continue; } // only valid docs
    // Query every real key + a couple of non-existent ones.
    const probes = [...keys.map(([k]) => k), `${ident()}.${ident()}`, ident()];
    for (const key of probes) {
      const ref = norm(navigate(parsed, key));
      if (ref === "￿obj") continue; // key resolves to a sub-table, not a scalar — out of scope
      const got = ours(doc, key);
      if (got !== ref) fails.push(`tomlGet(<doc>, "${key}"): ours=${JSON.stringify(got)} iarna=${JSON.stringify(ref)}\n--doc--\n${doc}\n--`);
      if (ref) hit++;
      checked++;
    }
  }
  if (!fails.length) console.log(`PASS toml-get: ${checked} lookups agree with @iarna/toml (${hit} non-empty, seed ${seed})`);
}

if (fails.length) {
  for (const f of fails.slice(0, 8)) console.error("FAIL toml-get: " + f);
  if (fails.length > 8) console.error(`… and ${fails.length - 8} more`);
  process.exit(1);
}
