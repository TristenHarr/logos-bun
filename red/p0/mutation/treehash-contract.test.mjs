// W2.5 RED: the treehash comparator's full behavioral contract, oracle-free — the KILL harness
// Stryker runs against every mutant it injects into conformance/oracle/treehash.mjs (§8: eat our
// own dog food). SHIM (tests-shim-allowlist.tsv): ports to .lg at W2.9.
//
// treehash is the §6.4 canonical directory-tree manifest ("two node_modules trees are the same
// layout iff their manifests are byte-identical"). Its correctness is load-bearing for every
// "does the linked tree match?" check, so its OWN contract must be pinned tightly enough that a
// mutation-testing tool cannot flip a `===`, an offset, or a sort direction without a test going
// red. This file asserts, over a fixed hand-built tree:
//   * exact manifest text (relpath TAB mode TAB col3), sorted ascending by relpath
//   * the mode column is octal, no leading zero; dirs say `dir`, files carry a sha256, links `link`
//   * determinism (hashing twice = byte-identical)
//   * 1-byte content flip changes the manifest (the whole point of a content hash)
//   * a mode (exec-bit) change changes the mode column
//   * symlink target is reported verbatim
// Every one of these kills a class of treehash mutants. RED-first: authored against the SPEC, not
// the code — the goldens below are computed by hand from the tree, not by running treehash.
import { treehash } from "../../../conformance/oracle/treehash.mjs";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function build(root) {
  mkdirSync(join(root, "bin"), { recursive: true });
  mkdirSync(join(root, "sub"), { recursive: true });
  writeFileSync(join(root, "a.txt"), "alpha\n");
  writeFileSync(join(root, "z.txt"), "zeta\n");
  writeFileSync(join(root, "bin", "run.sh"), "#!/bin/sh\necho hi\n");
  writeFileSync(join(root, "sub", "b.txt"), "beta\n");
  chmodSync(join(root, "a.txt"), 0o644);
  chmodSync(join(root, "z.txt"), 0o644);
  chmodSync(join(root, "sub", "b.txt"), 0o644);
  chmodSync(join(root, "bin", "run.sh"), 0o755);
  chmodSync(join(root, "bin"), 0o755);
  chmodSync(join(root, "sub"), 0o755);
  symlinkSync("a.txt", join(root, "link"));
}

function main() {
  const root = mkdtempSync(join(tmpdir(), "w25-th-"));
  try {
    build(root);
    const manifest = treehash(root);

    // ── exact manifest text (the goldens are computed by hand from the tree) ──
    const expected = [
      `a.txt\t644\t${sha256("alpha\n")}`,
      `bin\t755\tdir`,
      `bin/run.sh\t755\t${sha256("#!/bin/sh\necho hi\n")}`,
      `link\tlink\ta.txt`,
      `sub\t755\tdir`,
      `sub/b.txt\t644\t${sha256("beta\n")}`,
      `z.txt\t644\t${sha256("zeta\n")}`,
    ].join("\n") + "\n";
    if (manifest !== expected) {
      const gl = manifest.split("\n"), wl = expected.split("\n");
      let i = 0; while (i < gl.length && i < wl.length && gl[i] === wl[i]) i++;
      fails.push(`manifest mismatch at line ${i + 1}\n   want: ${JSON.stringify(wl[i])}\n    got: ${JSON.stringify(gl[i])}`);
    }

    // ── ascending sort by relpath (kills a reversed/absent sort comparator) ──
    const rels = manifest.trimEnd().split("\n").map((l) => l.split("\t")[0]);
    const sorted = [...rels].sort();
    ok(JSON.stringify(rels) === JSON.stringify(sorted), `manifest not sorted ascending by relpath: ${rels.join(",")}`);
    ok(rels[0] === "a.txt" && rels[rels.length - 1] === "z.txt", `first/last relpath wrong: ${rels[0]}..${rels[rels.length - 1]}`);

    // ── octal mode, no leading zero; dir/link/file col3 shapes ──────────────
    ok(/^a\.txt\t644\t[0-9a-f]{64}$/m.test(manifest), "file row is not `relpath TAB 644 TAB sha256`");
    ok(/^bin\t755\tdir$/m.test(manifest), "dir row is not `relpath TAB 755 TAB dir`");
    ok(/^link\tlink\ta\.txt$/m.test(manifest), "symlink row is not `relpath TAB link TAB target`");
    ok(!/\t0[0-7]{3}\t/.test(manifest), "mode column has a leading zero (should be bare octal)");

    // ── determinism: hashing twice is byte-identical ────────────────────────
    ok(treehash(root) === manifest, "treehash non-deterministic across two runs");

    // ── 1-byte content flip must change the manifest ────────────────────────
    writeFileSync(join(root, "a.txt"), "alpha\r"); // \n -> \r, still 6 bytes
    const flipped = treehash(root);
    ok(flipped !== manifest, "treehash blind to a 1-byte content flip (content hash is not load-bearing)");
    writeFileSync(join(root, "a.txt"), "alpha\n"); // restore

    // ── an exec-bit change must change the mode column ──────────────────────
    chmodSync(join(root, "a.txt"), 0o755);
    const chmodded = treehash(root);
    ok(/^a\.txt\t755\t/m.test(chmodded), "treehash blind to an exec-bit (mode) change");
    ok(chmodded !== manifest, "mode change did not alter the manifest");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main();
if (fails.length) {
  for (const f of fails) console.error("FAIL treehash-contract: " + f);
  process.exit(1);
}
console.log("PASS treehash-contract");
