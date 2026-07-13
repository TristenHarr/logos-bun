// assert-counter.mjs — the toy stand-in for bun's executed-assertion counter
// (W1.3's 0002-assert-counter.patch, which does not exist yet). conformance/runner.mjs
// injects this module into the subject via `node --import <this>` (the --assert-import seam),
// exactly as the real runner will point bun's patched counter at the documented sink.
//
// Contract (the documented sink): every executed `expect(...)` bumps a process-wide counter;
// at process exit the total is written to the file named by $BUN_ASSERT_COUNT_FILE. A file the
// subject SKIPPED executes zero expect()s ⇒ the sink reads 0 ⇒ a visible delta vs. a passing
// sibling (the anti-skip L5 signal). A `report(name, status)` helper prints the per-test result
// lines the runner classifies (✓ pass / ✗ fail / » skip), so verdict + count come from one run.
import { writeFileSync } from "node:fs";

let executed = 0;

globalThis.expect = function expect(value) {
  // a real expectation executed — count it (the count is what the anti-skip gate reads).
  executed++;
  return {
    toBe(other) { if (value !== other) { throw new Error(`expect(${value}).toBe(${other}) failed`); } },
    toBeTruthy() { if (!value) { throw new Error(`expect(${value}).toBeTruthy() failed`); } },
  };
};

// print a runner-classifiable result line. status ∈ {pass, fail, skip}. A `skip` executes no
// expect() (the whole point), so it never bumps the counter.
globalThis.report = function report(name, status) {
  const glyph = status === "pass" ? "✓" : status === "fail" ? "✗" : "»";
  process.stdout.write(`${glyph} ${name}\n`);
};

// dump the executed count into the documented sink at exit (mirrors the bun counter patch).
process.on("exit", () => {
  const sink = process.env.BUN_ASSERT_COUNT_FILE;
  if (sink) { try { writeFileSync(sink, String(executed)); } catch { /* best effort */ } }
});
