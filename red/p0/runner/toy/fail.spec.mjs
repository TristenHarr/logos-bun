// toy FAIL spec — one assertion passes, the second fails and throws (nonzero exit).
// The runner must classify this file FAIL. Being non-PASS, its queue row carries `-` for both
// first-green-commit and asserts (SCHEMA §2.2).
expect(1 + 1).toBe(2);
report("fail setup", "pass");
report("fail assertion", "fail");
expect(1 + 1).toBe(3); // throws — the process exits nonzero
