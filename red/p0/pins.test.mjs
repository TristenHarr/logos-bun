// W0.C RED: pins are internally consistent — TOOLCHAIN_PIN == vendor/logicaffeine HEAD,
// SPEC_PIN tag SHA == vendor/bun HEAD, CLAUDE.md carries every rule anchor (L15 seed).
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fails = [];
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const head = (dir) => execFileSync("git", ["-C", join(ROOT, dir), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const toolchainPin = read("TOOLCHAIN_PIN.md").match(/Pinned commit \| `([0-9a-f]{40})`/)?.[1];
const specTagSha = read("SPEC_PIN.md").match(/Tag commit SHA \| `([0-9a-f]{40})`/)?.[1];
if (!toolchainPin) fails.push("TOOLCHAIN_PIN.md missing pinned commit");
if (!specTagSha) fails.push("SPEC_PIN.md missing tag commit SHA");

for (const [dir, want, name] of [["vendor/logicaffeine", toolchainPin, "TOOLCHAIN_PIN"], ["vendor/bun", specTagSha, "SPEC_PIN"]]) {
  if (!existsSync(join(ROOT, dir, ".git"))) { fails.push(`${dir} submodule missing`); continue; }
  const got = head(dir);
  if (want && got !== want) fails.push(`${dir} HEAD ${got} != ${name} ${want}`);
}

const claude = read("CLAUDE.md");
for (let i = 1; i <= 10; i++) {
  const anchors = ["R1-RATCHET-IS-LAW","R2-NEVER-MODIFY-RED","R3-TESTS-IN-LOGOS","R4-GIT-SPLIT","R5-VENDOR-PRISTINE","R6-DONE-MEANS-GATE","R7-DUAL-REPO","R8-BUILD-DISCIPLINE","R9-FIX-THE-PROCESS","R10-GIFTS"];
  if (!claude.includes(`<!-- ANCHOR:${anchors[i-1]} -->`)) fails.push(`CLAUDE.md lost anchor ${anchors[i-1]}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL pins: " + f);
  process.exit(1);
}
console.log("PASS pins");
