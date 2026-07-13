// W2.1 RED — conformance/fuzz-driver.mjs: the shared §8 differential-fuzz driver every P2+
// component reuses. This battery IS the spec. It drives the WHOLE loop over a TOY component
// whose probe/shim are node stubs (real largo probes need the toolchain, land at P2):
//
//   • probe   = "reverse a string correctly" (stdin bytes → reversed bytes on stdout)
//   • shim    = "reverse a string, but DROP the first space it sees" — deliberately buggy on
//               any input containing a space. The minimal witness is the single byte " ".
//
// The loop proven here, every step asserted:
//   (a) a seeded input that contains a space is DETECTED as a byte-mismatch;
//   (b) ddmin MINIMIZES it down to the shortest reproducing witness (exactly " ", 1 byte);
//   (c) the minimized witness is BANKED in fuzz/<c>/corpus/regressions/ (append-only, forever);
//   (d) --replay REDS on the next run while the bug is still live (the banked seed reproduces);
//   (e) once the shim's bug is FIXED, --replay GREENS (no banked seed reproduces any more).
//
// Determinism: everything runs in a hermetic tmp fuzz root (FUZZ_ROOT env), no writes to the
// committed fuzz/ tree. The generator is seeded; ddmin is deterministic; replay reads the bank
// in sorted order. Two runs of any phase produce byte-identical artifacts.
//
// SHIM (tests-shim-allowlist.tsv): the driver itself is legit node (npm-world tooling, CLAUDE.md
// R3 carve-out); this RED test migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const DRIVER = join(ROOT, "conformance", "fuzz-driver.mjs");
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// import the driver's pure helpers (ddmin, banking, replay) — RED if the module is absent.
let ddmin, bankRegression, listRegressions;
try {
  ({ ddmin, bankRegression, listRegressions } = await import(pathToFileURL(DRIVER).href));
} catch (e) {
  console.error("FAIL fuzz-driver: cannot import conformance/fuzz-driver.mjs (does not exist yet?):\n" + (e.stack || e));
  process.exit(1);
}

// ── the toy component: a hermetic fuzz root with a probe + a (buggy|fixed) shim ─────────────
const COMP = "toyrev";
function scaffold(buggy) {
  const work = mkdtempSync(join(tmpdir(), "w21-fuzz-"));
  const compDir = join(work, "fuzz", COMP);
  mkdirSync(join(compDir, "corpus", "seed"), { recursive: true });
  mkdirSync(join(compDir, "corpus", "regressions"), { recursive: true });

  // PROBE.md declares the wire protocol + the ddmin granularity.
  writeFileSync(join(compDir, "PROBE.md"), [
    "# toyrev probe protocol", "",
    "- stdin: raw UTF-8 bytes", "- stdout: the input bytes reversed", "- granularity: byte", "",
  ].join("\n"));

  // probe: reverse stdin bytes exactly (the "LOGOS side", correct). Stubs are .cjs so the tiny
  // one-liner can `require("node:fs").readFileSync(0)` (fd 0 = stdin) — ESM has no sync fd read.
  const probe = join(work, "probe.cjs");
  writeFileSync(probe,
    `const b=require("node:fs").readFileSync(0);process.stdout.write(Buffer.from([...b].reverse()));\n`);

  // shim: reverse, but if BUGGY drop the FIRST 0x20 (space) byte before reversing.
  const shim = join(work, "shim.cjs");
  const body = buggy
    ? `let a=[...b];const i=a.indexOf(0x20);if(i>=0)a.splice(i,1);process.stdout.write(Buffer.from(a.reverse()));`
    : `process.stdout.write(Buffer.from([...b].reverse()));`;
  writeFileSync(shim, `const b=require("node:fs").readFileSync(0);${body}\n`);

  return { work, compDir, probe, shim };
}

function runDriver(args, env) {
  try {
    return { out: execFileSync("node", [DRIVER, ...args], { encoding: "utf8", env: { ...process.env, ...env } }), code: 0 };
  } catch (e) {
    return { out: (e.stdout || "") + (e.stderr || ""), code: e.status ?? 1 };
  }
}

// ── UNIT: ddmin is a real 1-minimal delta-debugger ──────────────────────────────────────────
// Property: reverse-then-drop-first-space differs from plain-reverse IFF the input has a space.
// So "the input still reproduces" ⟺ "the input contains a space". ddmin over the bytes of a
// long spaced string must collapse to a SINGLE space byte — the global minimum here.
{
  const input = Buffer.from("abc def ghi");            // 11 bytes, two spaces
  const repro = (buf) => buf.includes(0x20);           // reproduces ⟺ contains a space
  const min = ddmin(input, repro);
  ok(Buffer.isBuffer(min), "ddmin must return a Buffer");
  ok(repro(min), "ddmin result must still reproduce (contain a space)");
  ok(min.length === 1 && min[0] === 0x20, `ddmin must minimize to the single space byte, got ${JSON.stringify(min.toString())} (len ${min.length})`);
  // 1-minimality: removing the last atom must break reproduction.
  ok(!repro(Buffer.alloc(0)), "empty input must NOT reproduce (guards against a vacuous minimizer)");
}

// ── UNIT: ddmin never loops forever + preserves reproduction on a pathological predicate ─────
{
  // a predicate that is true for everything: ddmin should drive length toward the floor and STOP.
  const input = Buffer.from("xxxxxxxxxxxxxxxx");
  let calls = 0;
  const alwaysRepro = () => { calls++; return true; };
  const min = ddmin(input, alwaysRepro);
  ok(min.length <= input.length, "ddmin must never grow the input");
  ok(alwaysRepro(min), "ddmin result must reproduce");
  ok(calls < 100000, `ddmin must terminate in a bounded number of probes, made ${calls}`);
}

// ── (a)+(b)+(c): a seeded mismatch is detected, minimized, and banked ────────────────────────
const S = scaffold(true /* buggy */);
{
  // Seed a KNOWN-mismatching input so the run is deterministic (no reliance on gen.mjs luck).
  writeFileSync(join(S.compDir, "corpus", "seed", "0001.bin"), "hello world");   // has a space
  writeFileSync(join(S.compDir, "corpus", "seed", "0002.bin"), "noSpacesHere");  // no space (matches)

  const r = runDriver(
    ["--component", COMP, "--probe", S.probe, "--shim", S.shim, "--run-seeds"],
    { FUZZ_ROOT: S.work },
  );
  // a mismatch was found → driver signals nonzero (a live divergence is not a green state).
  ok(r.code !== 0, `driver must exit nonzero when a mismatch is found and banked; output:\n${r.out}`);

  const bankDir = join(S.compDir, "corpus", "regressions");
  const banked = readdirSync(bankDir).filter((f) => f.endsWith(".bin")).sort();
  ok(banked.length === 1, `exactly one regression must be banked (the 0002 seed matches), got ${banked.length}: ${banked.join(", ")}`);
  if (banked.length) {
    const witness = readFileSync(join(bankDir, banked[0]));
    ok(witness.length === 1 && witness[0] === 0x20,
      `banked witness must be the ddmin-minimal single space, got ${JSON.stringify(witness.toString())} (len ${witness.length})`);
  }

  // banking is CONTENT-ADDRESSED + idempotent: re-running the same mismatch must NOT double-bank.
  runDriver(["--component", COMP, "--probe", S.probe, "--shim", S.shim, "--run-seeds"], { FUZZ_ROOT: S.work });
  const banked2 = readdirSync(bankDir).filter((f) => f.endsWith(".bin"));
  ok(banked2.length === 1, `re-running an identical mismatch must not double-bank (content-addressed), got ${banked2.length}`);
}

// ── (d): --replay REDS while the bug is live (the banked witness reproduces) ──────────────────
{
  const r = runDriver(["--component", COMP, "--probe", S.probe, "--shim", S.shim, "--replay"], { FUZZ_ROOT: S.work });
  ok(r.code !== 0, `--replay must RED while the bug is live (banked witness reproduces); output:\n${r.out}`);
  ok(/toyrev/.test(r.out), `--replay red output should name the failing component; output:\n${r.out}`);
}

// ── replay is deterministic: two live-bug replays give byte-identical output ──────────────────
{
  const a = runDriver(["--component", COMP, "--probe", S.probe, "--shim", S.shim, "--replay"], { FUZZ_ROOT: S.work });
  const b = runDriver(["--component", COMP, "--probe", S.probe, "--shim", S.shim, "--replay"], { FUZZ_ROOT: S.work });
  ok(a.out === b.out && a.code === b.code, "replay must be deterministic (byte-identical output across runs)");
}

// ── (e): fix the shim's bug → --replay GREENS over the SAME banked witness ────────────────────
{
  // Rewrite the shim to be correct (still a .cjs stub); the banked regression seed(s) survive.
  writeFileSync(S.shim, `const b=require("node:fs").readFileSync(0);process.stdout.write(Buffer.from([...b].reverse()));\n`);
  const bankDir = join(S.compDir, "corpus", "regressions");
  const stillBanked = readdirSync(bankDir).filter((f) => f.endsWith(".bin"));
  ok(stillBanked.length === 1, `the bank must be append-only across a fix (witness survives), got ${stillBanked.length}`);

  const r = runDriver(["--component", COMP, "--probe", S.probe, "--shim", S.shim, "--replay"], { FUZZ_ROOT: S.work });
  ok(r.code === 0, `--replay must GREEN once the bug is fixed (no banked witness reproduces); output:\n${r.out}`);
}

// ── L13 EMPTY GUARD: --replay over a fuzz root with NO regression dirs passes trivially ───────
{
  const empty = mkdtempSync(join(tmpdir(), "w21-empty-"));
  mkdirSync(join(empty, "fuzz"), { recursive: true });   // fuzz/ exists but no <c>/corpus/regressions
  const r = runDriver(["--replay-all"], { FUZZ_ROOT: empty });
  ok(r.code === 0, `--replay-all must pass trivially when no regression dirs exist (l17-style empty guard); output:\n${r.out}`);
  rmSync(empty, { recursive: true, force: true });
}

// ── the programmatic helpers compose: bankRegression is content-addressed, listRegressions sorts ─
{
  const t = mkdtempSync(join(tmpdir(), "w21-api-"));
  const bank = join(t, "regressions");
  mkdirSync(bank, { recursive: true });
  const w1 = bankRegression(bank, Buffer.from(" "));
  const w1again = bankRegression(bank, Buffer.from(" "));
  ok(w1 === w1again, "bankRegression must be content-addressed (same bytes → same path, no dup)");
  bankRegression(bank, Buffer.from("  "));
  const listed = listRegressions(bank);
  ok(Array.isArray(listed) && listed.length === 2, `listRegressions must find both distinct witnesses, got ${listed.length}`);
  const a = listRegressions(bank), b = listRegressions(bank);
  ok(JSON.stringify(a) === JSON.stringify(b), "listRegressions must be deterministically ordered");
  rmSync(t, { recursive: true, force: true });
}

rmSync(S.work, { recursive: true, force: true });

if (fails.length) {
  for (const f of fails) console.error("FAIL fuzz-driver: " + f);
  process.exit(1);
}
console.log("PASS fuzz-driver");
