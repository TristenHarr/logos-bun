# Engine correctness roadmap — fix-order for the 2026-07-23 bug-hunt (~35 defects)

The raw finds are logged chronologically in `BUGS_FOUND.md`; this is the **fix plan**. The key
insight from the hunt: the defects **cluster by shared root cause**, so a single well-placed fix
often closes several bugs at once. Ordered by (impact × leverage), highest first. Task #32.

Repro convention: `bun run file.js` vs `node -e`. All verified.

---

## Cluster A — the coercion/ToNumber gap (one root, ~7 bugs) ★ highest leverage

Non-`+` arithmetic and unary-`+` never run **ToNumber** on a string operand, and `==` never runs
ToNumber for the `boolean`/`""`/`null≈undefined` cases. These share one fix: a real `ToNumber`
applied at the numeric-operator boundary.

- `+"7"` → **stack overflow** (unary plus recurses; the crashing symptom of the same missing ToNumber)
- `"5"-2`→5, `"3"*2`→3, `"10"/2`→10 (return the left operand; want 3/6/5)
- `0==""`→false, `false==0`→false (want true — ToNumber("")=0, ToNumber(false)=0)
- `null==undefined`→false (want true — the one special `==` rule, not ToNumber but same site)

**Fix:** implement `ToNumber(v)` (string→number parse, bool→0/1, ""→0, null→0, undefined→NaN) and
route `-` `*` `/` `%` unary-`+` `<` `>` through it; add the null≈undefined rule + ToNumber path to
`==`. One change, ~7 bugs. Guard the unary-plus recursion (the crash) first.

## Cluster B — ToPrimitive for `+` and string output (one root, ~3 bugs)

`+` with an array/object operand, and stringification of arrays, don't run **ToPrimitive**
(→ `Array.join(",")` / `[object Object]`).

- `[1,2,3]+""`→`"2 + \"\""` (want `"1,2,3"`); `[]+[]`→garbage (want `""`); `[]+{}`→garbage (want
  `"[object Object]"`)

**Fix:** ToPrimitive(obj, "default") = array→join, plain obj→`"[object Object]"`, before the `+`
string/number decision.

## Cluster C — strict-equality type identity (1 root, 2 bugs) ★

`===`/`!==` compare the **materialized** text, which strips the string tag, so a number and a
numeric string collapse equal.

- `1==="1"`→true (want false); `2!=="2"`→false (want true). (`1===1`, `"a"==="a"`, `true===1`,
  `NaN===NaN`, `null===undefined` are all already correct.)

**Fix:** strict-eq must compare the RAW tagged representation (or check type tags first): a chr(3)-
tagged string is never `===` a bare-numeric token. Small, high test262 value.

## Cluster D — statement forms that don't execute their body (~3 bugs) ★

- `do{…}while(…)` → body runs **0 times** (even braced)
- `for(…)stmt` / `while(…)stmt` **braceless** bodies → run 0 times (braceless-`if` already works)
- Fix pattern is shared: the loop executors must take the body correctly (mirror the working
  braceless-`if` path; for do-while, run the body once BEFORE testing the guard).

## Cluster E — `throw` on bad member access (1 root, 2+ bugs) ★

- `null.x` / `undefined.foo` → no error (want `TypeError`); a `try/catch` guard silently no-ops.

**Fix:** member access on `null`/`undefined` receivers throws a `TypeError` (feeds the pending-throw
channel). Unblocks a large class of test262 + real defensive code.

## Cluster F — hoisting & scoping (~3 bugs)

- Function declarations not hoisted: `f(); function f(){}` → NaN (want the call to succeed)
- `let` in `for` — no per-iteration binding (closures capture the final value) + the header `let`
  leaks past the loop (`typeof i`→"number")

**Fix:** hoist `function` decls to the top of their scope during the statement pre-pass; give `let`
loop headers a fresh per-iteration binding scoped to the loop.

## Cluster G — regex: `/g` iteration, `$N` templates, AND missing engine features (~6 bugs)

- `"a1b2c3".match(/\d/g)` → only first match (want all — `/g` iteration in `String.match`)
- `replace(/([a-z])(\d)/g,"$2$1")` → no substitution (want capture-ref templates `$1`/`$2`/`$&`)
- **Engine gaps (bigger):** alternation `|` (`/cat|dog/`), non-capturing `(?:…)`, lookahead `(?=…)`
  are all unsupported (literals/classes/quantifiers/anchors work). Alternation is common → high value.

## Cluster K — array index-iterators & tagged templates (~3 bugs)

- `Array.prototype.keys()/entries()/values()` unimplemented (`[1,2].entries()` → empty). Feeds
  `for (const [i,x] of arr.entries())`.
- Tagged template application crashes (see Priority-0). `String.fromCodePoint`/`localeCompare` missing.

## Cluster H — recursion into nested structures (2 bugs)

- `super.method()` (super() ctor works); nested destructuring `[[a],[b]]` / `{a:{b}}` (single level
  works). Both are "handle one level but don't recurse" — extend the existing handler to recurse.

## Cluster I — string is UTF-8 bytes, not UTF-16 code units (architectural)

- `"café".length`→5 (want 4); affects length/index/slice/iterate on non-ASCII. Deepest change
  (string representation); schedule deliberately.

## Cluster J — partial/missing builtins (long tail, low risk each)

`JSON.stringify` omit-undefined; `Array.fill(v,start)` range; `instanceof` for built-ins (Array/Date);
labeled `continue`/`break`; `void`; `map(String)` builtin-as-callback; `Object.is`; `split(sep,limit)`;
`toPrecision`; `toLocaleString`; integer-key ascending order; `(1e21).toString()`.

---

## Priority 0 — the 9 CRASHES (fix first; each is a one-spot guard)

A JS engine must never abort the process on ordinary input. All 9 are small, local fixes:

| Crash | Input | Want | Fix |
|-------|-------|------|-----|
| unary `+` on string | `+"7"` | `7` | ToNumber, no recursion |
| `exec` w/ groups | `/(\d+)-(\d+)/.exec("12-34")` | match | terminate group walk |
| modulo by zero | `10%0` | `NaN` | guard `%` 0-divisor |
| neg int exponent | `2**-1` | `0.5` | float pow when exp<0/non-int |
| `Object.defineProperty` | `defineProperty(o,"x",{value:5})` | `5` | implement (no overflow) |
| `Object.getOwnPropertyDescriptor` | `…("a")` | desc | implement |
| `~` on non-integer | `~3.7` | `-4` | ToInt32 before bitwise |
| bitwise w/ NaN + hex≥0x100 | `0xFF\|0x100` | `511` | fix hex parse + ToInt32(NaN)=0 |
| `Error.prototype.toString` | `String(new Error("x"))` | `"Error: x"` | `name+": "+message`, no recurse |
| tagged template call | `` f`hi` `` | `"hi"` | handle tag-fn application (plain `` `${}` `` works) |
| `Map.delete` + keys | `m.delete("a"); [...m.keys()]` | `["b"]` | fix delete/key-iter recursion |

These 11 are the highest value/effort ratio in the whole backlog.

## Recommended fix order (impact × shared-fix leverage)

0. **The 9 crashes above** — robustness floor; trivial each.
1. **A** (ToNumber) + the `+"str"` crash guard — ~7 bugs, one subsystem.
2. **E** (null/undefined throw) — big test262 class, small fix.
3. **C** (strict-eq type) — small, high value.
4. **D** (do-while + braceless bodies) — common loops.
5. **F** (hoisting + let-scoping) — pervasive.
6. **B** (ToPrimitive), **G** (regex), **H** (recursion) — medium.
7. **J** (builtin long tail) — grind by test262 dir yield.
8. **I** (UTF-16) — architectural, deliberate.

Clusters A–F alone likely move the sampled `--baseline --sample 50` baseline well above 93.94% and
fix the bulk of real-program breakage. Each cluster becomes a RED differential fuzzer
(`coercion-diff`, `stricteq-diff`, `dowhile-diff`, `throwmember-diff`, `hoist-diff`, …) the moment
its fix lands.

*Synthesis of the 2026-07-23 differential hunt; no code touched (engine under concurrent edit).*

## Cluster L — Map/Set mutation & iteration + the `arguments` object (batch 8, ~5 bugs)

- `Set.delete` is a no-op (returns NaN); `Map.delete` **crashes** (Priority-0); `Map/Set.forEach`
  never invoke the callback. (set/add/get/has/size/`[...m]` spread work — only delete + forEach.)
- The magic `arguments` object isn't populated (`arguments[0]`→NaN, `.length` wrong). Named/rest/
  default/destructured params work → the fix is to bind `arguments` at call entry.
- `WeakMap` (task #26) + `Number.toExponential` missing.

## Cluster M — generator advanced protocol + async-fn return + freeze (batch 9, ~5 bugs)

- Generators: `yield*` delegation, `return` value delivery, and bidirectional `next(arg)` all broken
  (basic `yield` + `[...g()]` work). Extend the generator state machine (it currently only forwards
  simple yields).
- `async function` plain `return v` isn't wrapped so `.then` fires (await + `Promise.resolve().then`
  chains work → the microtask engine is fine; the async-fn return→resolve bridge is the one gap).
- `Object.freeze` is a NO-OP (mutation not prevented; `isFrozen`→NaN) — enforce frozen semantics.
- `String.matchAll` over-yields (per-char, not per-match).

---
*Batches 7-9 fold-in (2026-07-23). Full tally: ~66 verified defects, 11 P0 crashes. The crash table
+ Clusters A-M are the complete fix plan; task #32. No code touched (engine under concurrent edit).*
