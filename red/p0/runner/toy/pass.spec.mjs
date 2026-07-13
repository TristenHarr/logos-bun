// toy PASS spec — three executed assertions, all green, process exits 0.
// The runner must classify this file PASS and record asserts=3 (the anti-skip baseline).
// `expect`/`report` come from the injected assert-counter.mjs (--assert-import).
expect(1 + 1).toBe(2);
report("pass one", "pass");
expect("logos").toBeTruthy();
report("pass two", "pass");
expect(true).toBe(true);
report("pass three", "pass");
