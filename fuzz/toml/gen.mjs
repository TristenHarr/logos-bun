// Structure-aware TOML generator: emits random VALID TOML documents biased toward the
// edge cases where parsers disagree — integers in all bases (hex/oct/bin/underscored),
// string escapes, quoted/dotted keys, inline tables, arrays, nested tables. Seeded. See PROBE.md.
import { mulberry32 } from "../semver/gen.mjs";

export function gen(seed, n) {
  const r = mulberry32(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const chance = (p) => r() < p;
  let keyN = 0;
  const bareKey = () => `k${keyN++}`;
  const quotedKey = () => `"${pick(["a b", "a.b", "1", "ʎ", "with space", "π"])}"`;
  const key = () => chance(0.75) ? bareKey() : quotedKey();

  const intVal = () => {
    const k = r();
    const raw = Math.floor(r() * 100000);
    if (k < 0.5) return chance(0.3) ? `+${raw}` : (chance(0.15) ? `-${raw}` : String(raw));
    if (k < 0.6) return `0x${raw.toString(16)}`;
    if (k < 0.7) return `0o${(raw % 512).toString(8)}`;
    if (k < 0.8) return `0b${(raw % 256).toString(2)}`;
    // underscored decimal
    const s = String(raw); let out = ""; for (let i = 0; i < s.length; i++) { out += s[i]; if (i < s.length - 1 && chance(0.4)) out += "_"; }
    return out;
  };
  const strVal = () => {
    const k = r();
    if (k < 0.5) return `"${pick(["hi", "a\\tb", "line1\\nline2", "quote:\\u0041", "\\u00e9", "path\\\\to", "", "tab\\there", "emoji\\U0001F600"])}"`;
    if (k < 0.75) return `'${pick(["literal", "no\\escape", "C:\\path", "raw'"].map(s => s.replace(/'/g, "")))}'`;
    return `"""${pick(["multi\nline", "with \"quotes\"", "trailing\\\n  joined"])}"""`;
  };
  const boolVal = () => pick(["true", "false"]);
  const arrVal = (depth) => {
    const len = Math.floor(r() * 4);
    const items = [];
    for (let i = 0; i < len; i++) items.push(scalar(depth));
    return `[${items.join(chance(0.5) ? ", " : ",\n  ")}]`;
  };
  const inlineTable = (depth) => {
    const len = 1 + Math.floor(r() * 3);
    const parts = [];
    for (let i = 0; i < len; i++) parts.push(`${bareKey()} = ${scalar(depth)}`);
    return `{ ${parts.join(", ")} }`;
  };
  function scalar(depth = 0) {
    const k = r();
    if (k < 0.32) return intVal();
    if (k < 0.55) return strVal();
    if (k < 0.68) return boolVal();
    if (depth < 2 && k < 0.85) return arrVal(depth + 1);
    if (depth < 2) return inlineTable(depth + 1);
    return intVal();
  }

  const docs = [];
  for (let d = 0; d < n; d++) {
    keyN = 0;
    const lines = [];
    const topPairs = Math.floor(r() * 4);
    for (let i = 0; i < topPairs; i++) lines.push(`${key()} = ${scalar()}`);
    const tables = Math.floor(r() * 3);
    for (let t = 0; t < tables; t++) {
      const depth = 1 + Math.floor(r() * 2);
      const segs = []; for (let s = 0; s < depth; s++) segs.push(bareKey());
      lines.push(`[${segs.join(".")}]`);
      const pairs = 1 + Math.floor(r() * 3);
      for (let i = 0; i < pairs; i++) lines.push(`${key()} = ${scalar()}`);
    }
    if (chance(0.3)) { // array of tables
      const name = bareKey();
      const count = 1 + Math.floor(r() * 2);
      for (let a = 0; a < count; a++) { lines.push(`[[${name}]]`); lines.push(`${bareKey()} = ${scalar()}`); }
    }
    if (chance(0.25)) lines.push(`${bareKey()}.${bareKey()} = ${scalar()}`); // dotted key
    docs.push(lines.join("\n") + "\n");
  }
  return docs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(gen(Number(process.argv[2] || 1), Number(process.argv[3] || 2000))));
}
