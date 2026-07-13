// W1.2 RED — the BUN_ASSERT_COUNT_FILE sink parser (conformance/runner.mjs). This battery IS
// the spec for how the runner turns the documented executed-assertion sink into the `asserts`
// count it records. Two writer formats feed the SAME sink and both MUST parse:
//   • the REAL bun counter (0002-assert-counter.patch) appends `<file>\t<count>\n` — one line
//     per test file, e.g. `/abs/path/lane-a.test.ts\t4`. A run that executes several files
//     appends several lines; the executed total is their SUM.
//   • the toy sidecar (red/p0/runner/toy/assert-counter.mjs) writes a BARE number (`4`).
// The old parser was `Number.parseInt(readFileSync(sink).trim(), 10)`, which returns 4 on the
// bare toy number but NaN on any `<file>\t<count>` line (parseInt of a string that starts with
// `/abs/path…`) → clamped to executed=0. That silently disarmed the anti-skip `asserts`
// invariant (L5) for EVERY real bun-hosted test. This battery pins the correct semantics.
//
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9 with the rest of the runner battery.
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const RUNNER = join(ROOT, "conformance", "runner.mjs");
const fails = [];
const eq = (got, want, msg) => { if (got !== want) fails.push(`${msg}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

// import the runner's sink parser. RED if the module does not export parseAssertSink yet.
let parseAssertSink;
try {
  ({ parseAssertSink } = await import(pathToFileURL(RUNNER).href));
} catch (e) {
  console.error("FAIL assert-sink-parse: cannot import conformance/runner.mjs:\n" + (e.stack || e));
  process.exit(1);
}
if (typeof parseAssertSink !== "function") {
  console.error("FAIL assert-sink-parse: runner.mjs must export parseAssertSink(rawText) → integer count");
  process.exit(1);
}

// ── the real bun patch format: `<file>\t<count>\n` ──────────────────────────────
// This is the case the old parseInt code got WRONG (parseInt of "/abs/path…" is NaN → 0).
eq(parseAssertSink("/abs/path/lane-a.test.ts\t4\n"), 4, "single bun-patch line `<file>\\t4` must parse to 4");
eq(parseAssertSink("/abs/path/lane-a.test.ts\t4"), 4, "single bun-patch line without trailing newline must parse to 4");

// ── the multi-file case: one line per file, SUM the trailing counts ─────────────
eq(parseAssertSink("a.ts\t3\nb.ts\t2\n"), 5, "two bun-patch lines `a\\t3` + `b\\t2` must SUM to 5");
eq(parseAssertSink("/x/a.test.ts\t3\n/x/b.test.ts\t2\n/x/c.test.ts\t7\n"), 12, "three bun-patch lines must SUM to 12");

// ── the toy sidecar format: a BARE number (no file prefix) ──────────────────────
// The parser must still handle the toy's `writeFileSync(sink, String(executed))` output.
eq(parseAssertSink("4"), 4, "bare toy number `4` must parse to 4");
eq(parseAssertSink("4\n"), 4, "bare toy number with trailing newline must parse to 4");
eq(parseAssertSink("0"), 0, "bare toy zero must parse to 0");

// ── empty / absent sink ⇒ 0 (a file that executed no assertions) ─────────────────
eq(parseAssertSink(""), 0, "empty sink must parse to 0");
eq(parseAssertSink("   \n\n"), 0, "whitespace-only sink must parse to 0");

// ── malformed robustness: a bad trailing field is 0 for THAT line, never NaN for the whole ──
eq(parseAssertSink("a.ts\tnope\nb.ts\t5\n"), 5, "a malformed line must not poison the sum with NaN (counts as 0 for that line)");
eq(parseAssertSink("garbage-no-tab\nb.ts\t5\n"), 5, "a bare non-integer line must not poison the sum (0 for that line)");
eq(parseAssertSink("a.ts\t-3\nb.ts\t5\n"), 5, "a negative trailing count is treated as 0 for that line, sum stays 5");

if (fails.length) {
  for (const f of fails) console.error("FAIL assert-sink-parse: " + f);
  process.exit(1);
}
console.log("PASS assert-sink-parse");
