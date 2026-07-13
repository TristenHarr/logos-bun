// W1.4 RED: P0.5 comparators — normalize, treehash, diffcli, exec-equivalence.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9 (needs G2 subprocess + sha256
// digest kernel + a LOGOS tree-walk). Until then this is the executable spec for §6.4.
//
// This battery drives every comparator against checked-in GOLDEN fixtures. The goldens are
// the spec: they were authored by hand (the intended normalized/hashed output), never by
// running the code under test. RED-first — before the comparators exist, every assertion
// below fails at import.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, chmodSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const FIX = join(HERE, "fixtures");
const ORACLE = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const eqText = (got, want, label) => {
  if (got !== want) {
    const gl = got.split("\n"), wl = want.split("\n");
    let i = 0; while (i < gl.length && i < wl.length && gl[i] === wl[i]) i++;
    fails.push(`${label}: first diff at line ${i + 1}\n   want: ${JSON.stringify(wl[i])}\n    got: ${JSON.stringify(gl[i])}`);
  }
};

// Fixed, machine-independent path/version values so the goldens are deterministic.
const ENV = {
  cwd: "/home/tristen/logos-bun",
  tmp: "/tmp",
  home: "/home/tristen",
  version: "1.3.14",
  version_with_sha: "1.3.14 (0d9b2960aa)",
  revision: "0d9b2960aa",
};

async function main() {
  const N = await import("../../../conformance/normalize.ts");

  // ── per-class normalizers ────────────────────────────────────────────────
  for (const [file, fn] of [
    ["temp-paths", (s) => N.registry.tempPaths(s, ENV)],
    ["pids", (s) => N.registry.pids(s, ENV)],
    ["timings", (s) => N.registry.timings(N.registry.durations(s, ENV), ENV)],
    ["versions", (s) => N.registry.versions(s, ENV)],
  ]) {
    const input = readFileSync(join(FIX, "normalize", `${file}.input.txt`), "utf8");
    const golden = readFileSync(join(FIX, "normalize", `${file}.golden.txt`), "utf8");
    eqText(fn(input), golden, `normalize/${file}`);
  }

  // ── full normalizeBunSnapshot parity ─────────────────────────────────────
  {
    const input = readFileSync(join(FIX, "normalize", "snapshot-full.input.txt"), "utf8");
    const golden = readFileSync(join(FIX, "normalize", "snapshot-full.golden.txt"), "utf8");
    eqText(N.normalizeBunSnapshot(input, { env: ENV }), golden, "normalize/snapshot-full");
  }

  // ── over-eagerness guard: a bare integer that is NOT a pid/time survives ──
  ok(N.registry.pids("handled 42 requests", ENV) === "handled 42 requests",
     "pids normalizer over-eager: ate a non-pid integer");
  ok(N.registry.durations("port 3000 open", ENV) === "port 3000 open",
     "durations normalizer over-eager: ate a non-duration integer");

  // ── treehash: build the fixture tree, hash it, compare golden manifest ────
  const T = await import("../../../conformance/oracle/treehash.mjs");
  const scratch = mkdtempSync(join(tmpdir(), "w14-tree-"));
  try {
    mkdirSync(join(scratch, "bin"), { recursive: true });
    mkdirSync(join(scratch, "sub"), { recursive: true });
    writeFileSync(join(scratch, "a.txt"), "alpha\n");
    writeFileSync(join(scratch, "bin", "run.sh"), "#!/bin/sh\necho hi\n");
    chmodSync(join(scratch, "bin", "run.sh"), 0o755);
    chmodSync(join(scratch, "a.txt"), 0o644);
    writeFileSync(join(scratch, "sub", "b.txt"), "beta\n");
    chmodSync(join(scratch, "sub", "b.txt"), 0o644);
    symlinkSync("a.txt", join(scratch, "link"));
    // Pin directory modes explicitly: mkdirSync honors the process umask (0755 vs 0775 vs
    // 0777 varies per host), which would make the golden machine-dependent. treehash reports
    // the REAL mode faithfully; the FIXTURE must therefore fix its own dir modes to 0755.
    chmodSync(join(scratch, "bin"), 0o755);
    chmodSync(join(scratch, "sub"), 0o755);

    const golden = readFileSync(join(FIX, "treehash", "tree.golden.manifest"), "utf8");
    const manifest = T.treehash(scratch);
    eqText(manifest, golden, "treehash/manifest");

    // determinism: hashing twice yields byte-identical manifests
    ok(T.treehash(scratch) === manifest, "treehash non-deterministic across runs");

    // 1-byte flip in ONE file must change the manifest
    writeFileSync(join(scratch, "a.txt"), "alpha\r"); // last byte \n -> \r (still 6 bytes)
    ok(T.treehash(scratch) !== manifest, "treehash blind to a 1-byte content flip");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  // ── diffcli: oracle vs oracle == equal; oracle vs sed-wrapped == diff ─────
  const D = await import("../../../conformance/oracle/diffcli.mjs");
  {
    const v = D.diffcli({ argv: ["--version"], cwd: ROOT, a: ORACLE, b: ORACLE });
    ok(v.equal === true, `diffcli oracle-vs-oracle should be equal, got ${JSON.stringify(v)}`);
    ok(v.exitA === 0 && v.exitB === 0, "diffcli oracle exit codes not both 0");
    ok(Array.isArray(v.diffs) && v.diffs.length === 0, "diffcli reported phantom diffs on equal run");
  }
  {
    const wrap = join(FIX, "diffcli", "wrapped-sed.sh");
    const v = D.diffcli({
      argv: ["--version"], cwd: ROOT, a: ORACLE, b: wrap,
      envB: { ...process.env, DIFFCLI_ORACLE: ORACLE },
    });
    ok(v.equal === false, "diffcli MISSED a real divergence (oracle vs sed-wrapped)");
    ok(v.diffs.some((d) => d.stream === "stdout"), "diffcli did not attribute the diff to stdout");
    ok(v.diffs.some((d) => /9\.9\.9|1\.3\.14/.test(d.firstLine)),
       "diffcli diff line did not surface the version divergence");
  }

  // ── exec-equivalence: stub interface present; loud beyond implemented surface ─
  const X = await import("../../../conformance/oracle/exec-equivalence.mjs");
  ok(typeof X.execEquivalence === "function", "exec-equivalence harness stub missing");
  ok(typeof X.compareSourceMaps === "function", "sourcemap comparator stub missing");
  let threw = false;
  try { X.compareSourceMaps("{}", "{}"); } catch { threw = true; }
  ok(threw, "sourcemap comparator STUB must throw (fail loud), not silently pass");
}

main().then(() => {
  if (fails.length) {
    for (const f of fails) console.error("FAIL comparators: " + f);
    process.exit(1);
  }
  console.log("PASS comparators");
}).catch((e) => {
  console.error("FAIL comparators (threw): " + (e && e.stack || e));
  process.exit(1);
});
