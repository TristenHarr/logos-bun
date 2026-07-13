// W0.B RED: oracle-bun exists, sha256-matches SPEC_PIN, and `--version` matches.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9 (needs G2 + sha256 digest).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BIN = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");
const pin = readFileSync(join(ROOT, "SPEC_PIN.md"), "utf8");

const shaField = pin.match(/Binary sha256 \| `([^`]+)`/)?.[1];
const verField = pin.match(/`bun --version` output \| `([^`]+)`/)?.[1];
const fails = [];

if (!existsSync(BIN)) fails.push(`oracle binary missing at ${BIN} — run scripts/bootstrap/fetch-oracle.sh`);
if (!shaField || shaField.startsWith("PENDING")) fails.push("SPEC_PIN sha256 is PENDING-FETCH");
if (!verField || verField.startsWith("PENDING")) fails.push("SPEC_PIN version output is PENDING-FETCH");

if (fails.length === 0) {
  const got = createHash("sha256").update(readFileSync(BIN)).digest("hex");
  if (got !== shaField) fails.push(`sha256 mismatch: pin=${shaField} got=${got}`);
  const out = execFileSync(BIN, ["--version"], { encoding: "utf8" });
  if (out !== verField + "\n") fails.push(`--version printed ${JSON.stringify(out)}, pin says ${JSON.stringify(verField + "\n")}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL oracle-pin: " + f);
  process.exit(1);
}
console.log("PASS oracle-pin");
