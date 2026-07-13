#!/usr/bin/env node
// workflow-ops-lint.mjs — L8 (CLAUDE.md R4). Destructive / wholesale git verbs are
// forbidden EVERYWHERE in logos-bun: the runner only ever `git commit <named paths>`.
// This lint scans scripts/** and work/cards/** for the forbidden verbs and fails loud.
//
//   exit 0 = clean
//   exit 7 = at least one forbidden verb found (machine-checkable, joins the gate-audit)
//   exit 2 = usage
//
// Usage: workflow-ops-lint.mjs [--root <dir>]
//
// Forbidden verbs (regexes):
//   git stash | git reset | git checkout - | git clean | git rebase |
//   push --force (incl. -f / --force-with-lease) | git add -A | git add . | git commit -a
//
// Allowlist heuristic (kept deliberately SIMPLE and documented):
//   (a) THIS lint file itself (it must name the verbs to forbid them).
//   (b) A line that also contains the words `forbidden` or `refuse` (documentation that
//       QUOTES a verb as banned — e.g. a rule text or a refusal message).
//   (c) Any line INSIDE a fenced code block whose opening fence is tagged as a
//       counter-example: a ``` fence whose info string contains `counter-example`
//       (or `counterexample`). The block stays exempt until the closing ```.
//   (d) In MARKDOWN files (cards/prompts, .md), a verb that appears entirely inside an
//       inline-code span (`…backticks…`, possibly wrapped across a line break) is a
//       QUOTATION, not an invocation — cards routinely quote the banned verbs to describe
//       them. Inline code is stripped before matching in .md files ONLY. Scripts get NO
//       such exemption: in a shell script, `…` is command substitution = a real invocation.
// Anything else that matches a forbidden verb is a violation.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  let root = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") root = argv[++i];
    else { console.error(`workflow-ops-lint: unknown argument ${JSON.stringify(argv[i])}`); process.exit(2); }
  }
  return { root };
}

// Each forbidden verb as a labeled regex. Word-ish boundaries keep `git resetter` etc. out.
const FORBIDDEN = [
  ["git stash", /\bgit\s+stash\b/],
  ["git reset", /\bgit\s+reset\b/],
  ["git checkout -", /\bgit\s+checkout\s+-/],
  ["git clean", /\bgit\s+clean\b/],
  ["git rebase", /\bgit\s+rebase\b/],
  ["push --force", /\bpush\b[^\n]*(?:--force(?:-with-lease)?|\s-f\b)/],
  ["git add -A", /\bgit\s+add\s+-A\b/],
  ["git add .", /\bgit\s+add\s+\.(?:\s|$)/],
  ["git commit -a", /\bgit\s+commit\s+(?:-a\b|--all\b|-[a-zA-Z]*a[a-zA-Z]*\b)/],
];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".git") continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// (d) neutralize inline-code spans in markdown while preserving newlines (and thus line
// numbers): replace the span's interior with spaces. Handles spans wrapped across a line
// break (as cards do when a `…` list wraps). Fenced ``` blocks are left to the line scan.
function stripInlineCodeMarkdown(text) {
  return text.replace(/`[^`]*`/g, (m) => m.replace(/[^\n]/g, " "));
}

function lintFile(absPath, root) {
  const rel = relative(root, absPath).replace(/\\/g, "/");
  // (a) the lint file itself is always exempt.
  if (resolve(absPath) === resolve(HERE)) return [];
  const violations = [];
  let text;
  try { text = readFileSync(absPath, "utf8"); } catch { return []; }
  if (rel.endsWith(".md")) text = stripInlineCodeMarkdown(text);
  const lines = text.split("\n");
  let inCounterExampleFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // (c) track fenced code blocks tagged as counter-examples.
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      const info = fence[1].toLowerCase();
      if (!inCounterExampleFence) {
        inCounterExampleFence = info.includes("counter-example") || info.includes("counterexample");
      } else {
        inCounterExampleFence = false; // closing fence
      }
      continue;
    }
    if (inCounterExampleFence) continue;
    // (b) a documentation line that quotes a verb as banned.
    const lower = line.toLowerCase();
    if (lower.includes("forbidden") || lower.includes("refuse")) continue;
    for (const [label, re] of FORBIDDEN) {
      if (re.test(line)) violations.push({ rel, line: i + 1, label, text: line.trim() });
    }
  }
  return violations;
}

function main() {
  const { root: rootArg } = parseArgs(process.argv.slice(2));
  const root = resolve(rootArg || join(dirname(HERE), "..", ".."));
  const targets = [join(root, "scripts"), join(root, "work", "cards")];
  const all = [];
  for (const t of targets) all.push(...walk(t));
  const violations = [];
  for (const f of all) violations.push(...lintFile(f, root));
  if (violations.length) {
    for (const v of violations) {
      console.error(`FAIL ops-lint: forbidden verb \`${v.label}\` at ${v.rel}:${v.line}  →  ${v.text}`);
    }
    console.error(`ops-lint: ${violations.length} forbidden-verb violation(s) — no destructive git, ever (CLAUDE.md R4/L8)`);
    process.exit(7);
  }
  console.log("PASS ops-lint");
}

main();
