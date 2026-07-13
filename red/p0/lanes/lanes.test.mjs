// W1.3 RED — P0.3 patch series + scratch-worktree materializer + Lane-A validity lint.
// This driver exercises the whole card end-to-end against the real oracle bun binary
// and the pristine vendor/bun submodule. It is a bootstrap node shim (allowlisted in
// tests-shim-allowlist.tsv → replaced-by W2.9); the subject it drives is TS/JS harness
// patching + git-worktree materialization + a source-scanning lint, none yet expressible
// in .lg at the pinned toolchain.
//
// Battery (per the card):
//   1. patched worktree: bunExe() returns process.env.BUN_EXE_OVERRIDE when set.
//   2. corrupt patch fixture → worktree.mjs exits loud (nonzero) — the re-baseline tripwire.
//   3. expectBundled.ts still honors BUN_EXE at the pin (the pin-bump canary; no patch needed).
//   4. lint fixture: Bun.build( / Bun.serve( / bun:ffi / bun-internal import → BLOCKED(P9);
//      a spawn-only test → clean.
//   5. vendor/bun pristine after materialize+clean (git status --porcelain empty).
//   6. L4 (lane lint over a Lane-A ledger row) catches an in-process file marked PASS.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const FIX = join(HERE, "fixtures");
const WORKTREE = join(ROOT, "scripts", "worktree.mjs");
const LINT = join(ROOT, "conformance", "lint-lanes.mjs");
const ORACLE = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");
const VENDOR = join(ROOT, "vendor", "bun");
const PATCH1 = join(ROOT, "conformance", "patches", "0001-bunexe-override.patch");
const PATCH2 = join(ROOT, "conformance", "patches", "0002-assert-counter.patch");

const fails = [];
const chk = (cond, msg) => { if (!cond) fails.push(msg); };

function git(dir, ...args) {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function pristine(label) {
  const st = git(VENDOR, "status", "--porcelain").trim();
  chk(st === "", `vendor/bun DIRTY (${label}): ${JSON.stringify(st)}`);
}
function run(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? "", stderr: e.stderr?.toString() ?? "" };
  }
}

// Pre-flight: the pieces this driver drives must exist.
chk(existsSync(PATCH1), "missing conformance/patches/0001-bunexe-override.patch");
chk(existsSync(PATCH2), "missing conformance/patches/0002-assert-counter.patch");
chk(existsSync(WORKTREE), "missing scripts/worktree.mjs");
chk(existsSync(LINT), "missing conformance/lint-lanes.mjs");

pristine("start");

// ── 3. Pin-bump canary: expectBundled.ts honors BUN_EXE at the pin (zero patching). ──
{
  const eb = readFileSync(join(VENDOR, "test", "bundler", "expectBundled.ts"), "utf8");
  chk(/process\.env\.BUN_EXE\b/.test(eb),
    "CANARY: expectBundled.ts no longer references process.env.BUN_EXE at the pin — bundler-lane assumption broke (re-triage before bumping the pin)");
}

// ── 1 + 5. Materialize the patched worktree; bunExe() honors BUN_EXE_OVERRIDE; clean. ──
if (existsSync(ORACLE)) {
  const id = "red-lanes-" + process.pid;
  const mat = run("node", [WORKTREE, id]);
  chk(mat.code === 0, `worktree.mjs materialize FAILED (code ${mat.code}): ${mat.stderr || mat.stdout}`);
  const wtPath = (mat.stdout || "").trim().split("\n").filter(Boolean).pop();
  chk(wtPath && existsSync(wtPath), `worktree.mjs did not print a live worktree path; got ${JSON.stringify(wtPath)}`);

  if (wtPath && existsSync(wtPath)) {
    // The patched harness.ts must honor BUN_EXE_OVERRIDE. Prove it by running a tiny
    // script against the patched harness via the oracle binary.
    const probe = mkdtempSync(join(tmpdir(), "lanes-probe-"));
    const harness = join(wtPath, "test", "harness.ts");
    const probeFile = join(probe, "p.test.ts");
    const SENTINEL = "/opt/sentinel-logos-bun";
    writeFileSync(probeFile,
      `import { bunExe } from ${JSON.stringify(harness)};\n` +
      `import { test, expect } from "bun:test";\n` +
      `test("override", () => { expect(bunExe()).toBe(${JSON.stringify(SENTINEL)}); });\n`);
    const r = run(ORACLE, ["test", probeFile], { env: { ...process.env, BUN_EXE_OVERRIDE: SENTINEL } });
    chk(r.code === 0, `patched bunExe() did NOT return BUN_EXE_OVERRIDE (test failed):\n${r.stdout}\n${r.stderr}`);
    rmSync(probe, { recursive: true, force: true });
  }

  // ── clean; vendor pristine afterward. ──
  const clean = run("node", [WORKTREE, "--clean", id]);
  chk(clean.code === 0, `worktree.mjs --clean FAILED (code ${clean.code}): ${clean.stderr || clean.stdout}`);
  chk(!(wtPath && existsSync(wtPath)), `worktree ${wtPath} still present after --clean`);
  pristine("after materialize+clean");
} else {
  fails.push(`oracle binary missing at ${ORACLE} — cannot prove the override end-to-end`);
}

// ── 2. Corrupt patch fixture → worktree.mjs exits loud (the re-baseline tripwire). ──
{
  const id = "red-lanes-corrupt-" + process.pid;
  const bad = run("node", [WORKTREE, id, "--patches", join(FIX, "corrupt.patch")]);
  chk(bad.code !== 0, `worktree.mjs accepted a corrupt patch (want loud nonzero exit); output:\n${bad.stdout}\n${bad.stderr}`);
  chk(/apply|patch|fail/i.test(bad.stdout + bad.stderr),
    `worktree.mjs corrupt-patch failure did not mention the apply failure; output:\n${bad.stdout}\n${bad.stderr}`);
  // and it must not leak a worktree / dirty vendor even on the failure path.
  run("node", [WORKTREE, "--clean", id]); // best-effort cleanup if a partial dir was left
  pristine("after corrupt-patch attempt");
}

// ── 4. Lane-A validity lint over single files. ──
function lintVerdict(file) {
  return run("node", [LINT, file]);
}
// The in-process fixtures — direct APIs AND the anti-false-negative locks (an aliased
// named import off "bun" used bare, and bracket member access) that a naive `Bun.build(`
// word-boundary lint would silently miss and thereby false-green a Lane-A row.
for (const f of [
  "inprocess-bunbuild.test.ts", "inprocess-serve.test.ts", "inprocess-ffi.test.ts",
  "inprocess-internal.test.ts", "inprocess-aliased-build.test.ts", "inprocess-bracket-serve.test.ts",
]) {
  const r = lintVerdict(join(FIX, f));
  chk(r.code !== 0, `lint passed an in-process file ${f} (want nonzero); output:\n${r.stdout}${r.stderr}`);
  chk(/BLOCKED\(P9\)/.test(r.stdout + r.stderr), `lint on ${f} did not emit BLOCKED(P9); output:\n${r.stdout}${r.stderr}`);
}
{
  const r = lintVerdict(join(FIX, "spawn-only.test.ts"));
  chk(r.code === 0, `lint FAILED a clean spawn-only test (want clean/exit 0); output:\n${r.stdout}${r.stderr}`);
  chk(!/BLOCKED\(P9\)/.test(r.stdout + r.stderr), `lint wrongly marked a spawn-only test BLOCKED(P9); output:\n${r.stdout}${r.stderr}`);
}

// ── 6. L4: lane lint over a Lane-A LEDGER — an in-process file marked PASS is a lint fail. ──
{
  // A Lane-A PASS row whose file uses Bun.build( must be rejected; the file lives in-tree
  // so the ledger key resolves. Use a fixture ledger (no chain needed — L4 is a lane check).
  const relIn = "red/p0/lanes/fixtures/inprocess-bunbuild.test.ts";
  const relOk = "red/p0/lanes/fixtures/spawn-only.test.ts";
  const tmp = mkdtempSync(join(tmpdir(), "lanes-ledger-"));
  const badLedger = join(tmp, "bad.tsv");
  const okLedger = join(tmp, "ok.tsv");
  // Rows: STATUS ⇥ LANE ⇥ path ⇥ commit ⇥ asserts ⇥ note
  writeFileSync(badLedger,
    `PASS\tA\t${relIn}\t${"a".repeat(40)}\t1\tin-process file wrongly Lane-A PASS\n`);
  writeFileSync(okLedger,
    `PASS\tA\t${relOk}\t${"b".repeat(40)}\t2\tclean spawn-only Lane-A pass\n`);
  const bad = run("node", [LINT, "--ledger", badLedger, "--root", ROOT]);
  chk(bad.code !== 0, `L4 lane lint passed a Lane-A PASS on an in-process file (want nonzero); output:\n${bad.stdout}${bad.stderr}`);
  chk(/BLOCKED\(P9\)/.test(bad.stdout + bad.stderr), `L4 lint did not name BLOCKED(P9) for the in-process Lane-A row; output:\n${bad.stdout}${bad.stderr}`);
  const ok = run("node", [LINT, "--ledger", okLedger, "--root", ROOT]);
  chk(ok.code === 0, `L4 lane lint FAILED a clean Lane-A ledger (want exit 0); output:\n${ok.stdout}${ok.stderr}`);
  rmSync(tmp, { recursive: true, force: true });
}

pristine("end");

if (fails.length) {
  for (const f of fails) console.error("FAIL lanes: " + f);
  process.exit(1);
}
console.log("PASS lanes (patch series + worktree materializer + Lane-A validity lint)");
