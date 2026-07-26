# 🥐 logos-bun

### A JavaScript runtime whose engine is written in **English.**

`logos-bun` is a from-scratch reimplementation of [Bun](https://bun.sh) in
[**LOGOS**](https://logicaffeine.com) — an English programming language. The JavaScript
engine isn't C++. It isn't Rust. It's **English prose that compiles to a native binary**,
and it runs your `.js` files byte-for-byte identically to Node.

```
$ bun run hello.js          # ← our bun. no JavaScriptCore. no V8.
hello, Hacker News!
```

> **Status: audacious work-in-progress, not a Bun replacement (yet).** The engine runs real
> programs today and is relentlessly differential-tested against Node. The bundler, package
> manager, and the speed story are still being built. Scroll to [**Honest status**](#-honest-status)
> before you get excited — we'd rather you be impressed by what's *real*.

---

## Wait — the engine is *English*?

Yes. Here is actual source code from the JavaScript engine (`src/main.lg`):

```logos
## To urlIsSpecial (scheme: Text) -> Bool:
    If concat(scheme, "") is equal to "http": Return true.
    If concat(scheme, "") is equal to "https": Return true.
    If concat(scheme, "") is equal to "wss": Return true.
    If concat(scheme, "") is equal to "file": Return true.
    Return false.
```

That's not pseudocode. That's LOGOS — a real language with a real compiler. ~15,000 lines of
it *are* the JS interpreter: lexer, parser, a heap-based value model with reference semantics,
classes/prototypes, `async`/`await`, generators, a backtracking regex engine, ES modules, and a
growing slab of the Node standard library. It compiles down to Rust, then to a single native
binary called `bun`.

## The demo (this really runs, output verified byte-identical to Node)

```js
import { EventEmitter } from "events";
import { readFileSync, writeFileSync } from "fs";

class Bus extends EventEmitter {
  constructor() { super(); this.count = 0; }
  ping(msg) { this.count++; this.emit("pong", msg); }
}

const bus = new Bus();
bus.on("pong", (msg) => console.log(`#${bus.count}: ${msg.toUpperCase()}`));
bus.ping("hello");
bus.ping("hacker news");

writeFileSync("out.txt", JSON.stringify({ count: bus.count }));
console.log("saved count:", JSON.parse(readFileSync("out.txt", "utf8")).count);

const b = Buffer.from("LOGOS").toString("base64");
console.log("base64:", b, "->", Buffer.from(b, "base64").toString());
```

```
#1: HELLO
#2: HACKER NEWS
saved count: 2
base64: TE9HT1M= -> LOGOS
```

`class … extends EventEmitter`, template literals, `fs`, `JSON`, `Buffer` round-trips — all
served by an interpreter written in English, all matching Node character-for-character.

## The thesis — why this isn't just a party trick

Bun is **Rust + JavaScriptCore**: a world-class C++ JIT that Bun didn't write and doesn't own.
`logos-bun` is **LOGOS all the way down**, and the JS engine is **derived, not hand-written**:

- `jsint` is a *definitional interpreter* in LOGOS.
- LOGOS already compiles through a proven five-tier stack: **tree-walker → register bytecode VM
  → copy-and-patch JIT → AOT-to-Rust → direct WASM.**
- Via the **[Futamura projections](https://en.wikipedia.org/wiki/Partial_evaluation#Futamura_projections)**,
  specializing the interpreter over a JS program yields a *residual native program* — i.e. the JS
  compiled to machine code, with interpreter overhead specialized away.

**We don't maintain a JIT. We generate one.** `PE(jsint, prog.js)` is your JavaScript, compiled.
That is the whole bet: JavaScript's engine *derived* from a compiler we own, then made fast by the
tiers underneath it — as a smaller, safer, provable, English-native binary.

*(The engine today is the correct tree-walker. Riding it down the tiers is Track C below — real,
scoped, and not yet done. We're telling you that up front.)*

## How we know it works

- **366 differential fuzzers** (`fuzz/jsint/*.mjs`) generate randomized JS programs, run them on
  **both `logos-bun` and Node**, and diff the output. Hundreds of thousands of checks. Currently:
  **0 diffs.** Every feature is locked against Node before it lands.
- **[test262](https://github.com/tc39/test262)** (the official ECMAScript conformance suite) is
  wired up as an objective, fail-loud metric. Current baseline sample: **~94% pass**, with the
  failure taxonomy driving what we build next.
- A gate (`scripts/gate.sh`) with pass-only-grows ledgers so nothing quietly regresses.

## 📊 Honest status

We take a "warm lighthouse, honest costs" approach. Here's exactly where things stand:

| Area | State |
|------|-------|
| **JS engine** (`jsint`) — objects/arrays, classes/`extends`, closures, `async`/generators, regex, ES modules, most `Math`/`String`/`Array`/`Object`/`JSON` | ✅ Real, runs `bun run file.js` byte-identical to Node |
| **node-compat core** — `fs`, `path`, `os`, `url`, `process`, `events` (EventEmitter + subclassing), `buffer`, `util`, `assert`, `querystring` | ✅ Comprehensive, each differential-locked vs Node |
| **test262 conformance** | 🟡 ~94% on the baseline sample; grinding toward ≥99% |
| **Speed** | 🟡 Correct tree-walker today. The JIT/AOT/WASM tiers exist; specializing the engine over them (the thesis above) is in progress — **it is not fast yet.** |
| **JS/TS parser, bundler, `bun install`, `Bun.*` APIs** | 🔴 In progress / stubbed |
| **Long tail** — Proxy/Reflect, TypedArrays, real GC, `Intl`/`Temporal`, Workers | 🔴 On the roadmap |

If you came here for a drop-in Bun that's faster than Bun today: it isn't, and we won't pretend
otherwise. If you came here because *a JavaScript engine written in English that passes Node's own
tests* is the kind of thing that makes you go "wait, **what?**" — welcome.

## Try it

This repo is built against the LOGOS toolchain. See `BAKE_A_BUN.md` for the master plan and
`scripts/build.sh` for the build. Once built:

```bash
bun run your-script.js      # execute a JS file (Node-compatible)
bun --version
node fuzz/jsint/events-diff.mjs 1 90   # watch a differential fuzzer agree with Node
```

## Why

Because if an English programming language can *derive* a correct, verifiable JavaScript engine —
and then make it fast by riding a compiler stack it already owns — then "which language is this
written in" stops being the interesting question. The interesting question becomes: **what else can
you derive?**

---

*Not affiliated with Bun or Oven. `logos-bun` is an independent, clean-room reimplementation — it
shares Bun's goals and (for now) some of its CLI surface, not its code. "Bun" is a trademark of its
respective owner.*

*Built with [LOGOS](https://logicaffeine.com). Follow the build in `BUGS_FOUND.md` (live narrative)
and `WAVES.md` (milestones).*
