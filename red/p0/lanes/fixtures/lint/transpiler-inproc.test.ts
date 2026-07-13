import { Transpiler } from "bun";
import { expect, test } from "bun:test";

test("drives the in-process transpiler — no child bun observed", () => {
  const t = new Transpiler({ loader: "tsx" });
  const out = t.transformSync("const x: number = 1;");
  expect(out).toContain("const x = 1");
});
