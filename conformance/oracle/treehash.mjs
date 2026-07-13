// conformance/oracle/treehash.mjs — canonical manifest of a directory tree (§6.4 treehash).
//
// Emits one line per entry, sorted by relpath, as:
//
//     relpath <TAB> mode <TAB> (symlink-target | sha256 | "dir")
//
//   * mode  — st_mode & 0o7777, in OCTAL, no leading zero (files/dirs); the literal `link`
//             for symlinks (symlink permission bits are not portable/meaningful).
//   * col3  — a symlink's TARGET (verbatim, as stored), a file's content sha256, or `dir`.
//   * order — a lexicographic sort of POSIX-style relpaths ('/' separators), so the manifest
//             is deterministic across runs, filesystems, and readdir orderings.
//
// This is a MANIFEST, meant to be diffed. Two node_modules trees are "the same layout" iff
// their manifests are byte-identical. A 1-byte content flip changes a sha256 -> a manifest
// diff; a mode change (exec bit) changes the mode column; a moved/renamed file changes a
// relpath. Nothing about the tree that we care about is invisible to this hash.
import { readdirSync, lstatSync, readlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const octal = (mode) => (mode & 0o7777).toString(8);

/**
 * Walk `root` and return the canonical manifest string (trailing newline included).
 * Directories are emitted (col3 = "dir") so empty dirs and structure are captured.
 * @param {string} root  absolute path to the tree root
 * @returns {string}
 */
export function treehash(root) {
  /** @type {{ rel: string, line: string }[]} */
  const rows = [];

  const walk = (absDir, relDir) => {
    // Sort at every level for a deterministic, readdir-order-independent walk.
    const names = readdirSync(absDir).sort();
    for (const name of names) {
      const abs = join(absDir, name);
      const rel = relDir ? `${relDir}/${name}` : name;
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        // Store the target with '\' -> '/' so Windows-authored links normalize too.
        const target = readlinkSync(abs).replaceAll("\\", "/");
        rows.push({ rel, line: `${rel}\tlink\t${target}` });
      } else if (st.isDirectory()) {
        rows.push({ rel, line: `${rel}\t${octal(st.mode)}\tdir` });
        walk(abs, rel);
      } else if (st.isFile()) {
        rows.push({ rel, line: `${rel}\t${octal(st.mode)}\t${sha256(readFileSync(abs))}` });
      }
      // Sockets/FIFOs/devices are intentionally skipped: they never occur in a node_modules
      // tree, and hashing them would be nondeterministic. If one appears it's a real anomaly
      // and its ABSENCE from the manifest surfaces as a diff against the expected layout.
    }
  };

  walk(root, "");
  // Belt-and-suspenders: sort the full row set by relpath so the manifest order is a pure
  // function of the path set, independent of directory-recursion interleaving.
  rows.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return rows.map((r) => r.line).join("\n") + (rows.length ? "\n" : "");
}

/** Convenience: sha256 of the whole manifest (a single fingerprint for a tree). */
export function treehashDigest(root) {
  return sha256(treehash(root));
}

// CLI: `node treehash.mjs <dir>` prints the manifest to stdout.
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: node treehash.mjs <dir>");
    process.exit(2);
  }
  process.stdout.write(treehash(dir));
}
