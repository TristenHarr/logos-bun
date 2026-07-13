#!/usr/bin/env node
// lint-lanes.mjs — the Lane-A validity lint (BAKE_A_BUN §6.2, gate check L4).
//
// A Lane-A test PASSES only if its assertions observe the *child* (logos-bun spawned via
// bunExe()), never bun's in-process behavior. A test that exercises an in-process Bun API —
// `Bun.build(`, `Bun.serve(`, `bun:ffi`, `Bun.Transpiler`/`new Transpiler`, `Bun.plugin`, or a
// direct import of a bun-internal module — asserts against real bun running IN the host
// process, so a green there proves nothing about logos-bun and could false-green us. Such
// files are auto-classified **BLOCKED(P9)** (that is where the plugin host / in-process API
// surface lands, §7 P9.2). A Lane-A PASS row for such a file is an L4 FAILURE.
//
// Ledger rows use the frozen SCHEMA.md grammar (6 TAB-separated fields):
//   STATUS ⇥ LANE ⇥ path[::name] ⇥ first-green-commit ⇥ asserts ⇥ note
// L4 reads STATUS (field 1), LANE (field 2), and the file path (field 3, before `::`).
//
// Modes:
//   --report <file…>          emit a SCHEMA-conformant classification ROW per flagged file
//                             (BLOCKED(P9)⇥A⇥<path>⇥-⇥-⇥<reason>). Clean files emit no row.
//                             Non-zero exit iff ≥1 flagged file (a machine + human signal).
//   --gate                    read ledger rows from STDIN; FAIL (nonzero, `L4 lane lint`) on
//                             any Lane-A row whose STATUS asserts a pass/frontier state
//                             (PASS/FAIL/QUARANTINE/NOTIMPL) for a flagged file — such a row
//                             MUST be BLOCKED(P9). Correct BLOCKED(P9)/DIVERGE rows pass.
//   --ledger <l.tsv> [--root] scan a committed ledger's Lane-A rows (gate.sh L4 wiring).
//   <file…>                   legacy file-mode verdict (human-readable), kept for callers.
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";

const read = readFileSync;

// ── the in-process API detectors ──────────────────────────────────────────────
// A false NEGATIVE (missing an in-process API) lets a bad Lane-A row false-green us — the
// exact failure this lint exists to prevent — so we err toward flagging (over-inclusive).
//
// bun-internal / in-process virtual modules. `bun:test` is the harness host (allowed);
// `bun:jsc`/`bun:sqlite` are data helpers used by spawn-lane tests (allowed). Anything that
// reaches bun's engine internals or an in-process native/bundler surface is flagged.
const INTERNAL_MODULES = new Set([
  "bun:ffi", // dlopen — native code in the host process
  "bun:internal-for-testing",
  "bun:app",
  "bun:bundle",
  "bun:hmr",
  "bun:invalidate",
  "bun:main",
  "bun:runtime",
  "bun:wrap",
  "bun:error",
  "bun:ready",
]);

// strip // line comments and /* block */ comments so a commented-out `Bun.build(` in a
// docstring is not a false positive. String contents are left intact (a marker inside a
// string literal is rare and flagging it is the safe direction).
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

// find every `import … from "bun:xxx"` / `require("bun:xxx")` / dynamic `import("bun:xxx")`
// module specifier in the source and return the set of specifiers.
function importedModules(src) {
  const mods = new Set();
  const re = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)(['"])(bun:[a-z-]+)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) mods.add(m[2]);
  const bare = /import\s*(['"])(bun:[a-z-]+)\1/g; // side-effect import "bun:ffi";
  while ((m = bare.exec(src)) !== null) mods.add(m[2]);
  return mods;
}

// The in-process members of the global `Bun` object. Reaching any of these — as
// `Bun.build(`, `Bun["build"](`, or via a named `import { build } from "bun"` used bare —
// runs bundler/server/transpiler/plugin machinery in the HOST process, so a Lane-A pass
// observes real bun, not the child. `build`/`serve`/`plugin` are call-shaped; `Transpiler`
// is construction-shaped (`new Transpiler(`).
const BUN_INPROCESS_MEMBERS = ["build", "serve", "plugin", "Transpiler"];

// Map every name imported FROM "bun" to its ORIGINAL member name, e.g.
//   import { build as mkBundle, plugin as p, Transpiler } from "bun";
// → { mkBundle: "build", p: "plugin", Transpiler: "Transpiler" }. Also handles the
// namespace form `import * as B from "bun"` (returns the namespace local under `*`), so
// `B.build(` is caught alongside `Bun.build(`.
function bunImportBindings(src) {
  const byLocal = new Map();   // localName -> originalName
  const namespaces = new Set(); // `import * as X from "bun"` locals (behave like Bun)
  const named = /import\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*(['"])bun\2/g;
  let m;
  while ((m = named.exec(src)) !== null) {
    for (const raw of m[1].split(",")) {
      const piece = raw.trim();
      if (!piece) continue;
      const parts = piece.split(/\s+as\s+/);
      const original = parts[0].trim();
      const local = (parts[1] ?? parts[0]).trim();
      if (original && local) byLocal.set(local, original);
    }
  }
  const ns = /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s*from\s*(['"])bun\2/g;
  while ((m = ns.exec(src)) !== null) namespaces.add(m[1]);
  return { byLocal, namespaces };
}

// Does `src` call/construct `name` bare (as a call `name(` or `new name(` for Transpiler)?
function usesBare(src, name, ctor) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = ctor ? new RegExp(`\\bnew\\s+${esc}\\s*\\(`) : new RegExp(`\\b${esc}\\s*\\(`);
  return re.test(src);
}

// The reasons a file is in-process (empty array ⇒ clean).
export function inProcessReasons(src) {
  const clean = stripComments(src);
  const reasons = [];
  // (a) member access on the global `Bun` — dot OR bracket form, call/construct shaped.
  //     `Bun.build(`, `Bun . build (`, `Bun["build"](`, `Bun['serve'](`, `new Bun.Transpiler(`.
  for (const mem of BUN_INPROCESS_MEMBERS) {
    const ctor = mem === "Transpiler";
    const dot = ctor
      ? new RegExp(`\\bnew\\s+Bun\\s*\\.\\s*Transpiler\\s*\\(`)
      : new RegExp(`\\bBun\\s*\\.\\s*${mem}\\s*\\(`);
    const bracket = ctor
      ? new RegExp(`\\bnew\\s+Bun\\s*\\[\\s*(['"])Transpiler\\1\\s*\\]\\s*\\(`)
      : new RegExp(`\\bBun\\s*\\[\\s*(['"])${mem}\\1\\s*\\]\\s*\\(`);
    if (dot.test(clean) || bracket.test(clean)) reasons.push(ctor ? "new Bun.Transpiler(" : `Bun.${mem}(`);
  }
  // (b) named / namespace imports off "bun", then used bare under any local name.
  const { byLocal, namespaces } = bunImportBindings(clean);
  for (const [local, original] of byLocal) {
    if (!BUN_INPROCESS_MEMBERS.includes(original)) continue;
    const ctor = original === "Transpiler";
    if (usesBare(clean, local, ctor)) {
      reasons.push(ctor ? `new ${local}(` : `${local}(`);
    }
  }
  for (const ns of namespaces) {
    for (const mem of BUN_INPROCESS_MEMBERS) {
      const ctor = mem === "Transpiler";
      const re = ctor
        ? new RegExp(`\\bnew\\s+${ns}\\s*\\.\\s*Transpiler\\s*\\(`)
        : new RegExp(`\\b${ns}\\s*\\.\\s*${mem}\\s*\\(`);
      if (re.test(clean)) reasons.push(ctor ? `new ${ns}.Transpiler(` : `${ns}.${mem}(`);
    }
  }
  // (c) in-process / engine-internal virtual-module imports (static or dynamic).
  for (const mod of importedModules(clean)) {
    if (INTERNAL_MODULES.has(mod)) reasons.push(`import ${mod}`);
  }
  return reasons;
}

// Build the SCHEMA-conformant classification row for a flagged file.
// BLOCKED(P9) ⇥ A ⇥ <path> ⇥ - ⇥ - ⇥ <reason>   (fields 4 & 5 are `-` per SCHEMA §2.2).
function schemaRow(path, reasons) {
  const note = `in-process API: ${reasons.join(", ")} (§6.2/P9.2)`;
  return `BLOCKED(P9)\tA\t${path}\t-\t-\t${note}`;
}

// ── --report mode: emit SCHEMA rows for flagged files ─────────────────────────
function reportMode(files) {
  let flagged = 0;
  for (const f of files) {
    if (!existsSync(f)) { console.error(`lint-lanes: no such file ${f}`); flagged++; continue; }
    const reasons = inProcessReasons(read(f, "utf8"));
    if (reasons.length) {
      console.log(schemaRow(f, reasons)); // SCHEMA row on STDOUT (machine-consumable)
      flagged++;
    }
    // clean files emit nothing (absence == Lane-A valid)
  }
  process.exit(flagged ? 1 : 0);
}

// ── --gate mode: STDIN ledger rows → fail on a Lane-A pass-state row for a flagged file ──
// Statuses that ASSERT a Lane-A claim about the child: PASS/FAIL/QUARANTINE/NOTIMPL. A file
// that uses an in-process API under any of these on Lane A must instead be BLOCKED(P9).
// BLOCKED(P9) and DIVERGE(...) are correct/deliberate and pass.
function gateMode() {
  const text = readFileSync(0, "utf8"); // fd 0 = stdin
  const errors = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln === "" || ln.startsWith("#")) continue;
    const fields = ln.split("\t");
    if (fields.length !== 6) continue; // structural validity is ledger-lint's job, not L4's
    const [status, lane, keyField] = fields;
    if (lane !== "A") continue;
    if (status === "BLOCKED(P9)") continue;    // already correctly blocked
    if (status.startsWith("DIVERGE(")) continue; // a deliberate stance
    const rel = keyField.split("::")[0];
    if (!existsSync(rel)) continue; // unresolvable path — not L4's call in gate mode
    const reasons = inProcessReasons(read(rel, "utf8"));
    if (reasons.length) {
      errors.push(
        `L4 lane lint — Lane-A row "${rel}" is ${status} but the file uses an in-process API ` +
        `(${reasons.join(", ")}); it must be BLOCKED(P9), not a Lane-A pass (§6.2 — a Lane-A ` +
        `pass cannot observe the child).`);
    }
  }
  if (errors.length) {
    for (const e of errors) console.error("LANE-LINT FAIL: " + e);
    process.exit(1);
  }
  console.log("lint-lanes ok: Lane-A rows are validity-clean");
  process.exit(0);
}

// ── ledger mode (L4, gate.sh wiring) ──────────────────────────────────────────
function ledgerMode(ledgerPath, root) {
  if (!existsSync(ledgerPath)) { console.error(`lint-lanes: no such ledger ${ledgerPath}`); process.exit(2); }
  const text = read(ledgerPath, "utf8");
  const errors = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln === "" || ln.startsWith("#")) continue;
    const fields = ln.split("\t");
    if (fields.length !== 6) continue;
    const [status, lane, keyField] = fields;
    if (lane !== "A") continue;
    if (status === "BLOCKED(P9)") continue;
    if (status.startsWith("DIVERGE(")) continue;
    const rel = keyField.split("::")[0];
    const abs = isAbsolute(rel) ? rel : join(root, rel);
    if (!existsSync(abs)) continue;
    const reasons = inProcessReasons(read(abs, "utf8"));
    if (reasons.length) {
      errors.push(
        `${basename(ledgerPath)}:${i + 1}: L4 lane lint — Lane-A row "${rel}" is ${status} but the file uses ` +
        `an in-process API (${reasons.join(", ")}); it must be BLOCKED(P9) (§6.2 — a Lane-A pass cannot observe the child)`);
    }
  }
  if (errors.length) {
    for (const e of errors) console.error("LANE-LINT FAIL: " + e);
    process.exit(1);
  }
  console.log(`lint-lanes ok: ${basename(ledgerPath)} (Lane-A rows are validity-clean)`);
  process.exit(0);
}

// ── legacy file-mode (human-readable per-file verdict) ────────────────────────
function fileMode(files) {
  let blocked = 0;
  for (const f of files) {
    if (!existsSync(f)) { console.error(`lint-lanes: no such file ${f}`); blocked++; continue; }
    const reasons = inProcessReasons(read(f, "utf8"));
    if (reasons.length) {
      console.error(`BLOCKED(P9) ${f}  — in-process API: ${reasons.join(", ")} (Lane-A cannot observe the child; §6.2/P9.2)`);
      blocked++;
    } else {
      console.log(`clean ${f}  — Lane-A valid (assertions observe the child)`);
    }
  }
  process.exit(blocked ? 1 : 0);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function isMain() {
  return process.argv[1] && process.argv[1].endsWith("lint-lanes.mjs");
}
if (isMain()) {
  const argv = process.argv.slice(2);
  if (argv.includes("--gate")) {
    gateMode();
  } else if (argv.includes("--report")) {
    const files = argv.filter((a) => a !== "--report" && !a.startsWith("--"));
    if (files.length === 0) { console.error("usage: lint-lanes.mjs --report <file.ts>…"); process.exit(2); }
    reportMode(files);
  } else {
    const lx = argv.indexOf("--ledger");
    if (lx >= 0) {
      const ledger = argv[lx + 1];
      if (!ledger) { console.error("lint-lanes: --ledger needs a path"); process.exit(2); }
      const rx = argv.indexOf("--root");
      const root = rx >= 0 ? argv[rx + 1] : process.cwd();
      ledgerMode(ledger, root);
    } else {
      const files = argv.filter((a) => !a.startsWith("--"));
      if (files.length === 0) {
        console.error("usage: lint-lanes.mjs --report <f…> | --gate | --ledger <l.tsv> [--root <d>] | <f…>");
        process.exit(2);
      }
      fileMode(files);
    }
  }
}
