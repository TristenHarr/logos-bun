import { expect, test } from "bun:test";
import { something } from "bun:internal-for-testing";

test("reaches into a bun-internal module — engine internals, never CLI-observable", () => {
  expect(typeof something).not.toBe("undefined");
});
