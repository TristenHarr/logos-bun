// W2.5 RED: P0.11 mutation scaffold — the L14 floor-read + the planted-mutant loop (§8).
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9. Until then this is the executable
// spec for the mutation ratchet: the cheap gate check `scripts/mutation.mjs --check` reads the
// LAST RECORDED score from conformance/mutation-floor.json and verifies every target meets its
// per-target floor — it NEVER runs Stryker inline (§8 "eat our own dog food", but the gate must
// stay fast). A separate `--run` mode does the slow Stryker pass and rewrites the score file.
//
// RED-first — before scripts/mutation.mjs and conformance/mutation-floor.json exist, every
// assertion below fails. The three properties this pins are the whole point of the ratchet:
//   1. EMPTY-GUARD — no score file yet (or zero targets) → --check passes trivially (bootstrap).
//   2. FLOOR COMPLIANCE — a recorded score at/above floor is GREEN; drop it below → --check REDS.
//      (This is the "a planted surviving mutant drops the score below floor → L14 reds" loop.)
//   3. RATCHET — the floor only rises: a score file whose floor is BELOW the committed HEAD
//      floor is a fail (a hand-edit can't loosen the bar), and killed>total is malformed → fail.
// Plus the DOG-FOOD proof: a PLANTED mutant in a COPY of a real comparator (=== flipped to !==)
// must be KILLED by re-running that comparator's own contract — a mutant that survives means the
// test suite is too weak to catch a regression, which is exactly what the score is here to expose.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const CHECKER = join(ROOT, "scripts", "mutation.mjs");
const FLOOR = join(ROOT, "conformance", "mutation-floor.json");

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// Run `node scripts/mutation.mjs --check` against a chosen floor file. Returns {code, out}.
// MUTATION_FLOOR_FILE points the checker at a hermetic temp floor file so we never touch the
// committed conformance/mutation-floor.json — the same env-seam pattern the ledger fixtures use.
function check(floorFile) {
  try {
    const out = execFileSync("node", [CHECKER, "--check"], {
      cwd: ROOT, encoding: "utf8",
      env: { ...process.env, MUTATION_FLOOR_FILE: floorFile },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

function writeFloor(dir, doc) {
  const f = join(dir, "mutation-floor.json");
  writeFileSync(f, JSON.stringify(doc, null, 2) + "\n");
  return f;
}

function main() {
  ok(existsSync(CHECKER), `scripts/mutation.mjs missing (the L14 checker + --run driver)`);
  ok(existsSync(FLOOR), `conformance/mutation-floor.json missing (the committed score/ratchet)`);

  const scratch = mkdtempSync(join(tmpdir(), "w25-mut-"));
  try {
    // ── Property 1: EMPTY-GUARD ─────────────────────────────────────────────
    // No file at all → the bootstrap "no score yet" state passes trivially (l17-style).
    {
      const missing = join(scratch, "does-not-exist.json");
      const r = check(missing);
      ok(r.code === 0, `--check must PASS trivially when the floor file is absent (bootstrap), got exit ${r.code}: ${r.out}`);
    }
    // Zero targets → also trivially green.
    {
      const f = writeFloor(scratch, { $schema: "mutation-floor/v1", targets: {} });
      const r = check(f);
      ok(r.code === 0, `--check must PASS with zero targets (bootstrap), got exit ${r.code}: ${r.out}`);
    }

    // ── Property 2: FLOOR COMPLIANCE ────────────────────────────────────────
    // A recorded score AT floor → green.
    {
      const f = writeFloor(scratch, { $schema: "mutation-floor/v1", targets: {
        comparators: { path: "conformance/oracle/treehash.mjs", killed: 8, total: 10, floor: 0.8 },
      }});
      const r = check(f);
      ok(r.code === 0, `--check must PASS when killed/total == floor, got exit ${r.code}: ${r.out}`);
    }
    // A recorded score ABOVE floor → green.
    {
      const f = writeFloor(scratch, { $schema: "mutation-floor/v1", targets: {
        comparators: { path: "conformance/oracle/treehash.mjs", killed: 9, total: 10, floor: 0.8 },
      }});
      const r = check(f);
      ok(r.code === 0, `--check must PASS when killed/total > floor, got exit ${r.code}: ${r.out}`);
    }
    // THE PLANTED-SURVIVOR LOOP: a mutant survives → killed drops below floor → RED.
    {
      const f = writeFloor(scratch, { $schema: "mutation-floor/v1", targets: {
        comparators: { path: "conformance/oracle/treehash.mjs", killed: 7, total: 10, floor: 0.8 },
      }});
      const r = check(f);
      ok(r.code !== 0, `--check MUST RED when a surviving mutant drops killed/total below floor (7/10 < 0.8)`);
      ok(/floor|mutation|below/i.test(r.out), `--check RED message must name the floor breach, got: ${r.out}`);
    }

    // ── Property 3: RATCHET + malformed guards ──────────────────────────────
    // The floor may only RISE: a floor BELOW the committed HEAD floor is a loosening fail.
    // (We simulate by recording a target that exists in the committed file at a HIGHER floor.)
    if (existsSync(FLOOR)) {
      const committed = JSON.parse(readFileSync(FLOOR, "utf8"));
      const names = Object.keys(committed.targets ?? {});
      if (names.length && (committed.targets[names[0]].floor ?? 0) > 0) {
        const name = names[0];
        const baseFloor = committed.targets[name].floor;
        const doc = { $schema: "mutation-floor/v1", targets: {
          // __headFloor is the hermetic stand-in for "the committed HEAD floor of this target"
          // (the checker reads it from git for the real file; a temp fixture supplies it directly).
          [name]: { ...committed.targets[name], floor: Math.max(0, baseFloor - 0.1),
                    __headFloor: baseFloor,
                    killed: committed.targets[name].total, total: committed.targets[name].total },
        }};
        const f = writeFloor(scratch, doc);
        const r = check(f);
        ok(r.code !== 0, `--check MUST RED when a target's floor is LOWERED below its committed HEAD value (ratchet only rises)`);
      }
    }
    // killed > total is malformed → fail loud (never silently pass).
    {
      const f = writeFloor(scratch, { $schema: "mutation-floor/v1", targets: {
        bogus: { path: "x", killed: 11, total: 10, floor: 0.5 },
      }});
      const r = check(f);
      ok(r.code !== 0, `--check MUST RED on killed>total (malformed score), got exit ${r.code}`);
    }
    // total == 0 with a target present is malformed (division / empty measurement) → fail.
    {
      const f = writeFloor(scratch, { $schema: "mutation-floor/v1", targets: {
        bogus: { path: "x", killed: 0, total: 0, floor: 0.5 },
      }});
      const r = check(f);
      ok(r.code !== 0, `--check MUST RED on total==0 for a declared target (no measurement), got exit ${r.code}`);
    }

    // ── DOG-FOOD proof: a planted mutant in a COPY of a comparator must be KILLED ──
    // Copy treehash.mjs, flip a load-bearing `===` to `!==` (the isDirectory/isFile branch
    // selector logic is === on strings elsewhere; here we flip the symlink-detection identity),
    // and prove the comparator's OWN contract (determinism + 1-byte-flip sensitivity) now BREAKS.
    // If the mutated copy still satisfied the contract, the suite would be too weak to catch it.
    {
      const src = readFileSync(join(ROOT, "conformance", "oracle", "treehash.mjs"), "utf8");
      // A real, load-bearing equality in treehash: the octal mode compare is `(mode & 0o7777)`;
      // instead mutate the sort comparator's identity test, which decides manifest ORDER.
      ok(src.includes("a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0"),
         "treehash sort comparator shape changed — update the planted-mutant target");
      const mutated = src.replace(
        "a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0",
        "a.rel < b.rel ? 1 : a.rel > b.rel ? -1 : 0", // REVERSE sort order = the planted mutant
      );
      ok(mutated !== src, "planted mutant did not apply (source text drift)");
      const mdir = join(scratch, "mut");
      mkdirSync(mdir, { recursive: true });
      const mfile = join(mdir, "treehash.mjs");
      writeFileSync(mfile, mutated);

      // The comparator contract, re-expressed: two files a/b in known order must produce a
      // manifest whose FIRST relpath sorts ascending. The mutant reverses it → contract breaks.
      const tree = join(scratch, "tree");
      mkdirSync(tree, { recursive: true });
      writeFileSync(join(tree, "a.txt"), "alpha\n");
      writeFileSync(join(tree, "z.txt"), "zeta\n");

      const runManifest = (modulePath) => execFileSync(
        "node", ["--input-type=module", "-e",
          `import { treehash } from ${JSON.stringify(modulePath)}; process.stdout.write(treehash(${JSON.stringify(tree)}));`],
        { cwd: ROOT, encoding: "utf8" });

      const honest = runManifest(join(ROOT, "conformance", "oracle", "treehash.mjs"));
      const mutant = runManifest(mfile);
      // The suite's contract: manifest is ascending by relpath. Honest → a.txt before z.txt.
      const honestFirst = honest.split("\n")[0].split("\t")[0];
      const mutantFirst = mutant.split("\n")[0].split("\t")[0];
      ok(honestFirst === "a.txt", `sanity: honest treehash sorts a.txt first, got ${honestFirst}`);
      ok(mutantFirst !== honestFirst,
         `PLANTED MUTANT SURVIVED: the sort-reversal mutant produced the SAME first row (${mutantFirst}) as honest — the treehash order contract is too weak to catch it`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

main();
if (fails.length) {
  for (const f of fails) console.error("FAIL mutation-floor: " + f);
  process.exit(1);
}
console.log("PASS mutation-floor");
