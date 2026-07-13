// Fixture: bun:ffi in-process. dlopen runs in the host process, so a Lane-A pass proves
// nothing about the child. lint-lanes.mjs must mark it BLOCKED(P9). Lint target only.
import { test, expect } from "bun:test";
import { dlopen, FFIType } from "bun:ffi";

test("calls native in-process", () => {
  const lib = dlopen("libm.so", { pow: { args: [FFIType.f64, FFIType.f64], returns: FFIType.f64 } });
  expect(lib.symbols.pow(2, 3)).toBe(8);
});
