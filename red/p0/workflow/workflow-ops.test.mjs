// W1.5 RED — the workflow-ops harness enforces the runner discipline (CLAUDE.md R4/R9,
// BAKE_A_BUN §2.5). Five planted violations, each MUST be REJECTED by the (real) tools:
//   1. commit.mjs with an out-of-manifest path          → exit 3 (manifest)
//   2. commit.mjs touching vendor/**                     → exit 4 (vendor)
//   3. commit.mjs impl file while card RED uncommitted   → exit 5 (RED-first, L10)
//   4. a fixture script containing `git reset --hard`    → ops-lint exit 7 (forbidden verb, L8)
//   5. loop.mjs transition skipping REVIEW               → refused (illegal transition)
// Every git MUTATION here happens inside a THROWAWAY temp repo fixture — NEVER the real
// logos-bun repo (that would violate the very discipline under test). Read-only git only
// against the real tree. SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WF = join(ROOT, "scripts", "workflow");
const LINTS = join(ROOT, "scripts", "lints");
const fails = [];

// Run a tool; capture {code, out}. Never throws — a nonzero exit is the expected result.
function run(cmd, args, opts = {}) {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8", stdio: "pipe", ...opts });
    return { code: 0, out };
  } catch (e) {
    return { code: typeof e.status === "number" ? e.status : 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

// A throwaway git repo standing in for logos-bun: a fake card with a Manifest, a committed
// RED path, plus vendor/ and out-of-manifest scaffolding so every plant has a target.
function makeFixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), "w15-fixture-"));
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "fixture@logos-bun.test");
  git("config", "user.name", "fixture");
  git("config", "commit.gpgsign", "false");
  mkdirSync(join(dir, "work", "cards"), { recursive: true });
  mkdirSync(join(dir, "red", "p0", "demo"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "vendor", "bun"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  // A card whose Manifest allows src/** and red/p0/demo/**, nothing else.
  writeFileSync(join(dir, "work", "cards", "WX.1-demo.md"),
    "# WX.1 — demo card\n\nrepo: logos-bun\n\n## Manifest\nsrc/**, red/p0/demo/**\n");
  // A gate stub that always passes (so we test refusals, not gate flakiness).
  writeFileSync(join(dir, "scripts", "gate.sh"), "#!/usr/bin/env bash\nexit 0\n");
  execFileSync("chmod", ["+x", join(dir, "scripts", "gate.sh")]);
  writeFileSync(join(dir, "red", "p0", "demo", "spec.test.mjs"), "// red spec\n");
  writeFileSync(join(dir, "src", "impl.txt"), "impl\n");
  return { dir, git };
}

const commit = join(WF, "commit.mjs");
const loop = join(WF, "loop.mjs");
const opsLint = join(LINTS, "workflow-ops-lint.mjs");

// ── Plant 1: out-of-manifest path → exit 3 ──────────────────────────────────────
{
  const { dir } = makeFixtureRepo();
  writeFileSync(join(dir, "elsewhere.txt"), "nope\n");
  const r = run("node", [commit, "--root", dir, "--card", "WX.1", "--paths", "elsewhere.txt", "-m", "x"]);
  if (r.code !== 3) fails.push(`plant1 out-of-manifest: expected exit 3, got ${r.code}\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── Plant 2: vendor/** path → exit 4 ────────────────────────────────────────────
{
  const { dir } = makeFixtureRepo();
  writeFileSync(join(dir, "vendor", "bun", "touched.txt"), "nope\n");
  const r = run("node", [commit, "--root", dir, "--card", "WX.1", "--paths", "vendor/bun/touched.txt", "-m", "x"]);
  if (r.code !== 4) fails.push(`plant2 vendor: expected exit 4, got ${r.code}\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── Plant 3: impl file while card RED path has NO committed history → exit 5 ─────
{
  const { dir } = makeFixtureRepo();
  // RED spec.test.mjs is in-manifest but has NEVER been committed → impl commit must refuse.
  const r = run("node", [commit, "--root", dir, "--card", "WX.1", "--paths", "src/impl.txt", "-m", "impl before red"]);
  if (r.code !== 5) fails.push(`plant3 RED-first: expected exit 5, got ${r.code}\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── Plant 4: a fixture script containing `git reset --hard` → ops-lint exit 7 ────
{
  const dir = mkdtempSync(join(tmpdir(), "w15-lintfix-"));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts", "bad.sh"), "#!/usr/bin/env bash\ngit reset --hard HEAD\n");
  const r = run("node", [opsLint, "--root", dir]);
  if (r.code !== 7) fails.push(`plant4 forbidden-verb: expected exit 7, got ${r.code}\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── Plant 5: loop.mjs transition skipping REVIEW (IMPL → GREEN) → refused ────────
{
  const dir = mkdtempSync(join(tmpdir(), "w15-loop-"));
  mkdirSync(join(dir, "work", "cards"), { recursive: true });
  mkdirSync(join(dir, "work", "loops"), { recursive: true });
  writeFileSync(join(dir, "work", "cards", "WX.1-demo.md"),
    "# WX.1 — demo card\n\nrepo: logos-bun\n\n## Manifest\nsrc/**\n");
  const drive = (to) => run("node", [loop, "--card", "WX.1", "--to", to, "--root", dir]);
  // Legal walk up to IMPL.
  for (const st of ["RED", "IMPL"]) {
    const ok = drive(st);
    if (ok.code !== 0) fails.push(`plant5 setup: legal transition to ${st} refused (exit ${ok.code})\n${ok.out}`);
  }
  // Illegal jump IMPL → GREEN (skips REVIEW/FIX): MUST refuse (nonzero).
  const bad = drive("GREEN");
  if (bad.code === 0) fails.push(`plant5 skip-REVIEW: IMPL→GREEN was ACCEPTED (must refuse)\n${bad.out}`);
  rmSync(dir, { recursive: true, force: true });
}

if (fails.length) {
  for (const f of fails) console.error("FAIL workflow-ops: " + f);
  process.exit(1);
}
console.log("PASS workflow-ops");
