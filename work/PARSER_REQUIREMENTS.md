# B1 Parser — test262 early-error requirements (the negative-test lever)

**Why this is the single biggest test262 lever.** jsint is a *lenient tree-walker*: it never
rejects malformed source. test262's `language/` tree contains **4,449 parse-phase negative tests**
(`negative: { phase: parse, type: SyntaxError }`) — each expects a `SyntaxError` *before any code
runs*. Every one of them fails today; in the 20-dir `--baseline --sample 50` cross-section they are
the **`negative-not-thrown` bucket (~52–53 of 56 failures)** — i.e. essentially the *entire* gap
between 93.94% and ~99% on the sampled surface is parse-validation, not missing builtins. A real
parser (task #29, B1) is therefore worth more test262 points than all remaining builtin work
combined, and it also unblocks the bundler/transpiler (one grammar shared by execute + transpile, per
the plan — no execute-vs-transpile divergence).

Corpus: `vendor-artifacts/test262/test` @ pin `9e61c12` (gitignored). Phase split across
`language/`: **4,449 parse**, 34 resolution, 32 runtime.

## The test shape

```js
// (frontmatter) negative: { phase: parse, type: SyntaxError }
$DONOTEVALUATE();
1 ?? 2 = 1;          // must be rejected at parse time
```

`$DONOTEVALUATE()` is a harness stub that throws if reached. The runner's pass/fail signal is the
process exit code (uncaught throw → non-zero). For a negative *parse* test to PASS we must reject
the source at parse time — reaching `$DONOTEVALUATE()` (as our lenient walker does) is a FAIL even
though it throws, because the throw is the wrong kind at the wrong time.

> **Interim runner note (cheap, no parser):** the runner could special-case `$DONOTEVALUATE()` — if
> a `phase: parse` test's body executes far enough to *call* it, that is definitively a
> not-rejected-at-parse fail, and could be reported distinctly from a real SyntaxError. This does not
> *fix* any test (still needs the parser) but sharpens the taxonomy. Do NOT let it mask the gap.

## Parse-negative distribution (implementable early-error groups, by count)

Ranked by test count in `language/` — this is the parser build order (biggest win first):

| Rank | Group | ~Tests | What must be rejected |
|-----:|-------|-------:|-----------------------|
| 1 | `expressions/dynamic-import/syntax/invalid` | 374 | malformed `import(...)` — no args, spread-only, `new import`, missing paren |
| 2 | `expressions/assignmenttargettype` | 316 | invalid LHS of `=`: `1 = x`, `(a+b) = x`, `this = x`, `a?.b = x`, `1 ?? 2 = 1` — **AssignmentTargetType = invalid** |
| 3 | `module-code` | 155 | `import`/`export` outside module, dup export names, `export` of undeclared |
| 4 | `class/dstr` (stmt+expr) | 288 | invalid destructuring in class contexts |
| 5 | `literals/regexp` (+named-groups) | 183 | invalid regex flags/classes, dup named groups, bad `\` escapes |
| 6 | `identifiers` | 116 | reserved word as binding (`let yield`, `const await` in module), invalid `\u` escapes in idents |
| 7 | `object/method-definition` | 101 | dup `__proto__`, bad getter/setter arity, generator-method misuse |
| 8 | `class/elements/syntax/early-errors` (+`/delete`) | 388 | `#priv` misuse: `delete this.#x`, dup private names, `#x` outside class, `constructor` as field/getter |
| 9 | `for-await-of` | 92 | `for await` outside async, bad head |
| 10 | `block-scope`/`switch` **redeclaration** | 155 | `let x; let x;`, `let`/`function` clash, `const`+`var` clash in one scope |
| 11 | `assignment/dstr`, `for-of/dstr`, `arrow/dstr` | 192 | invalid destructuring patterns (holes, bad defaults, rest-not-last) |
| 12 | `async-generator` | 62 | `yield`/`await` misuse in async generators |
| 13 | `statements/function`, `variable`, `if` | 124 | bad function decls, `var`+lexical clash, single-statement-context decls |

(Long tail: `import-assertions`, `optional-chaining` misuse, `numeric-separators`, `bigint`, labeled
statements, `with` in strict, etc.)

## Highest ROI order for implementation

Front-load the groups that are **local, syntactic, and grammar-agnostic** (checkable without full
scope analysis) — they buy the most tests per unit of parser:

1. **AssignmentTargetType (group 2, 316)** — a static predicate over the LHS AST: literals, calls,
   binary/logical/conditional/parenthesized-non-simple, optional-chains are all *invalid* targets.
   Big, self-contained, no scope table needed.
2. **Redeclaration (group 10, 155)** — a per-scope binding table: `let`/`const`/`class` collide with
   any prior lexical *or* `var`/`function` in the same block. Needs the binder, reusable everywhere.
3. **Private-name early errors (group 8, 388)** — `#x` resolution set per class + `delete` guard.
   Structural, high count, isolated to class bodies.
4. **`import()` / module-context (groups 1+3, 529)** — requires knowing module vs script + a real
   argument-count check on `import(...)`.
5. Then regexp validation (5), identifiers/reserved-words (6), destructuring (4/11), the rest.

## Architectural constraints (from the campaign plan)

- **One grammar, shared** by the engine and the transpiler/bundler — the parser is *the* front end,
  not a second lenient path. Exit bar (plan B1): 100% transpiler-snapshot parity +
  `test262-parser-tests` + 24h fuzz-clean.
- Must produce a real AST with spans (for the LSP/bundler + sourcemaps), not just accept/reject.
- Early errors are **static semantics** over that AST, run before execution; a failing check is a
  `SyntaxError` with a Socratic message (LOGOS house style).
- The lenient tree-walker path can remain for the REPL's partial input, but `bun run` / test262 must
  go through the validating parser.

## Non-goals for the first parser slice

Getting to ≥99% ex-Intl does **not** require the runtime-phase negatives (32) or resolution-phase
(34) first — those are smaller and need scope resolution. Land the parse-phase early-error groups
above (the 4,449) and the sampled `negative-not-thrown` bucket collapses.

---
*Groundwork doc — no code. Written while the increment-operator work (task #31) was owned by a
concurrent session; this touches no `src/main.lg`. Counts from `vendor-artifacts/test262` @ 9e61c12.*
