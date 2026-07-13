// toy SKIP spec — the whole file is skipped, so ZERO expect()s execute. The process exits 0
// but nothing was actually asserted. This is the anti-skip probe (L5): the runner records
// asserts=0, a VISIBLE delta vs. pass.spec.mjs (asserts=3), so a silently-skipped test can no
// longer masquerade as a passing run.
report("skip one", "skip");
report("skip two", "skip");
report("skip three", "skip");
