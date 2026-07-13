#!/usr/bin/env node
// loop.mjs — the §2.5 dynamic-workflow STATE MACHINE skeleton (CLAUDE.md R9).
// A small, correct state machine — NO agent-spawning logic (the orchestrator does that).
// It reads a card, tracks the per-task state in work/loops/<task>/state.json, refuses
// illegal transitions, and scaffolds the loop artifact slots (implementer / review-1 /
// review-2 / fixer). WAVES.md stays human/orchestrator-driven for now.
//
//   States:  QUEUED → RED → IMPL → REVIEW → FIX → GREEN
//   The FIX↔REVIEW cycle: a reviewer that finds a bug sends REVIEW→FIX; the fixer sends
//   FIX→REVIEW for the re-review round (§2.5 "2 adversarial reviewers + 1 fixer"). GREEN
//   is only reachable from REVIEW (a clean review round) — never from IMPL/FIX directly.
//
//   exit 0 = transition applied (or --status printed)
//   exit 8 = illegal transition refused
//   exit 2 = usage
//   exit 1 = internal error
//
// Usage: loop.mjs --card <id> [--to <STATE>] [--status] [--root <dir>]
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXIT = { USAGE: 2, INTERNAL: 1, ILLEGAL: 8 };

const ORDER = ["QUEUED", "RED", "IMPL", "REVIEW", "FIX", "GREEN"];
// Allowed transitions. The linear advance plus the REVIEW⇄FIX re-review cycle.
const ALLOWED = {
  QUEUED: ["RED"],
  RED: ["IMPL"],
  IMPL: ["REVIEW"],
  REVIEW: ["FIX", "GREEN"],
  FIX: ["REVIEW"],
  GREEN: [],
};
const SLOTS = ["implementer.md", "review-1.md", "review-2.md", "fixer.md"];

function die(code, msg) {
  console.error("loop.mjs: " + msg);
  process.exit(code);
}

function parseArgs(argv) {
  const a = { card: null, to: null, status: false, root: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--card") a.card = argv[++i];
    else if (k === "--to") a.to = argv[++i];
    else if (k === "--status") a.status = true;
    else if (k === "--root") a.root = argv[++i];
    else die(EXIT.USAGE, `unknown argument ${JSON.stringify(k)}`);
  }
  return a;
}

function findCard(root, id) {
  const cards = join(root, "work", "cards");
  if (!existsSync(cards)) die(EXIT.INTERNAL, `no work/cards under ${root}`);
  const hits = readdirSync(cards).filter((f) => f.endsWith(".md") && (f === `${id}.md` || f.startsWith(`${id}-`)));
  if (hits.length === 0) die(EXIT.INTERNAL, `no card matches id ${JSON.stringify(id)}`);
  if (hits.length > 1) die(EXIT.INTERNAL, `card id ${JSON.stringify(id)} is ambiguous: ${hits.join(", ")}`);
  return join(cards, hits[0]);
}

function loopDir(root, id) { return join(root, "work", "loops", id); }
function statePath(root, id) { return join(loopDir(root, id), "state.json"); }

function readState(root, id) {
  const p = statePath(root, id);
  if (!existsSync(p)) return { card: id, state: "QUEUED", history: [] };
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch { die(EXIT.INTERNAL, `corrupt state file ${p}`); }
}

function scaffold(root, id) {
  const dir = loopDir(root, id);
  mkdirSync(dir, { recursive: true });
  for (const slot of SLOTS) {
    const p = join(dir, slot);
    if (!existsSync(p)) writeFileSync(p, `# ${id} — ${slot.replace(".md", "")} slot\n\n(empty — filled by the ${slot.replace(".md", "")} agent)\n`);
  }
  return dir;
}

function writeState(root, id, st) {
  scaffold(root, id);
  writeFileSync(statePath(root, id), JSON.stringify(st, null, 2) + "\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root || join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
  if (!args.card) die(EXIT.USAGE, "missing --card <id>");
  findCard(root, args.card); // validates the card exists (and id is unambiguous)

  const st = readState(root, args.card);

  if (args.status || !args.to) {
    console.log(JSON.stringify({ card: st.card, state: st.state, next: ALLOWED[st.state] }, null, 2));
    return;
  }

  const to = args.to.toUpperCase();
  if (!ORDER.includes(to)) die(EXIT.USAGE, `unknown target state ${JSON.stringify(args.to)} (states: ${ORDER.join(", ")})`);
  if (!ALLOWED[st.state].includes(to)) {
    die(EXIT.ILLEGAL, `illegal transition ${st.state} → ${to} (allowed from ${st.state}: ${ALLOWED[st.state].join(", ") || "<terminal>"}). §2.5 requires REVIEW before GREEN.`);
  }

  const next = { card: args.card, state: to, history: [...(st.history || []), { from: st.state, to, at: new Date().toISOString() }] };
  writeState(root, args.card, next);
  console.log(`loop.mjs: ${args.card} ${st.state} → ${to}`);
}

main();
