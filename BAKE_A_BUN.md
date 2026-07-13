# BAKE_A_BUN.md — The logos-bun Campaign

## 0. North Star

Rewrite Bun in LOGOS. Not a clone, not a subset — **the `bun` binary itself,
reborn**: same CLI, same lockfiles, same registry protocol, same bunfig, passes
Bun's own test suite. To everyone else it looks and acts like bun. Underneath,
it is LOGOS: the toolkit is LOGOS source compiled AOT-to-native, and JavaScript
itself becomes **a DSL whose engine is derived — not written — via the Futamura
projections over our bytecode VM**. One semantics artifact, conformance-tested
once; every execution tier proven equivalent to it mechanically.

**This is the third metamorphosis.** Bun began as a Go→Zig port (2021, one
person, one year). In May 2026 it was reborn Zig→Rust — 11 days, ~64 Claudes
in ~50 dynamic workflows, 6,778 commits, **0 tests skipped or deleted**, the
TypeScript test suite as the language-independent constitution ("Rewriting Bun
in Rust", Jarred Sumner, July 2026). Rust→LOGOS is next, and it runs on the
same published, *proven* playbook (§2.5). The shipping bar is Jarred's own:
when Claude Code moved to Rust bun, *"barely anyone noticed. Boring is good."*
— zero user-facing impact at every stage, while the internals transform.

**"World's best" is not parity plus speed.** It is parity, plus speed, plus
capabilities no JavaScript toolchain can copy, because they fall out of a
platform nobody else has: a certified SAT solver explains *why* your dependency
conflict is unsolvable with a machine-checkable proof; the supply chain is
post-quantum-ready — PQ signatures and attestations we control end-to-end, and
hybrid-PQ transport wherever the registry endpoint supports it; lifecycle
scripts run under capability policies; the compiler that executes your JS is
*derived from its own tested semantics* and formally validated; every async
test and GC pause replays deterministically from a seed.

**The mission is migration.** logos-bun is the Trojan horse for the LOGOS
ecosystem. People install it because it is a faster, better bun. Then they
discover what only we can offer:

- `bun run main.lg` works natively — the runtime *is* LOGOS.
- `import { hot } from "./kernel.lg"` — JS↔LOGOS interop; convert an app to
  LOGOS one file at a time, each converted file getting 2.5×-C speed.
- `bun build --native` — real AOT native binaries from JS (via Proj-1 +
  AOT-to-Rust). Bun's `--compile` ships an engine + bytecode; we ship machine
  code. A capability bun cannot match.
- `bun test --replay-seed` — deterministic replay of async tests and GC timing
  on the deterministic runtime. JSC cannot offer this.
- One package manager for both worlds: `bun install` also resolves LOGOS
  packages (the largo registry), and `bun publish` speaks to both.

**The mission is also the gift.** This campaign runs differential fuzzing
against bun's actual code, continuously — it *will* find real bun bugs, and
**we patch them upstream as we find them**. Every confirmed bun bug becomes a
gift PR: minimized repro, regression test in their format, clean fix, filed
from our own fork (`TristenHarr/bun`) under the covenant in §9.4. The goal is
explicit: earn genuine standing with the Bun team and Anthropic by making bun
itself better while we build logos-bun. Gifts are a first-class output of
this campaign, not a byproduct — the ledger tracks them like conformance rows.

Perfect and better **from the get-go**: every unit of work in this campaign is
born RED, every win is locked by a ratchet, and no ratchet ever loosens.

New sibling repo: `/home/tristen/logos-bun`. Spec source: the Bun checkout at
`logicaffeine/bun` (the real oven-sh/bun, rewritten in Rust + JavaScriptCore).

---

## 1. We are not starting from scratch — the corpus we stand on

### 1.1 The spec already exists (Bun's side)

Bun's repo IS the specification. We write almost no specs — we conquer a ledger.

| Asset | Where | Scale |
|---|---|---|
| The test suite | `bun/test/` | **1,941 `.test.*` files** (glob `*.test.{ts,tsx,js,jsx,mjs,cjs,mts}` — counting `.test.ts` only silently drops ~257 files, fatal for a "0 tests skipped" constitution): `test/js` 1,134 (49 Bun-API dirs + 38 node-compat dirs + 16 web dirs), `test/regression` 405, `test/cli` 175 (install, run, hot, watch…), `test/bundler` 97, `test/napi` 60, `test/integration` 26, `test/v8` 1, plus smaller dirs; every category is lane-assigned in §6.2. Plus ~2.8k direct-exec node parallel tests |
| The harness seam | `bun/test/harness.ts` — `bunExe()` (line 120) | Tests spawn the binary under test through one overridable function |
| The bundler seam | `bun/test/bundler/expectBundled.ts:147` | Already honors a `BUN_EXE` env var; `backend: "cli" \| "api"` switch at `resolveBackend` |
| The runner | `bun/scripts/runner.node.mjs` | Runs under **Node**, `--exec-path` plumbing built in |
| CLI surface | `bun/src/options_types/command_tag.rs` | 32 `Tag` variants (incl. `Reserved` + argv0-dispatched `RunAsNodeCommand`) |
| Config surface | `bun/src/bunfig/bunfig.rs`, `bun/src/bun_core/env_var.rs` | bunfig.toml schema; ~91 typed env vars |
| Lockfiles | `bun/src/install/lockfile/bun.lock.rs` (text), `bun.lockb.rs` (binary) | Deterministic text format = byte-comparable; binary format documented by its own reader |
| Registry protocol | `bun/src/install/npm.rs`, cache `~/.bun/install/cache` | Manifest GETs, tarballs, SHA512 integrity |
| Benchmarks | `bun/bench/` | ~33 suite dirs vs node/deno — our speed targets |
| Component oracles | The pure-Rust crates themselves | Path-linkable: our fuzz oracles are bun's *actual code*, not a spec reading |

Bun's internal layering (measured):

- **Pure-Rust toolkit, no JSC dependency**: `src/install` (80K LOC),
  `src/bundler` (48K), `src/js_parser` (47K) + `src/js_printer` (9.7K),
  `src/resolver` (17K), `src/http` (18K), `src/sys` (20K), `src/io` (12K),
  `src/collections` (12.6K), `src/watcher` (fs watching for `--hot`/`--watch`),
  `src/sql` (Postgres/MySQL) + `src/valkey`, `src/analytics` (telemetry), a
  whole **parser family** beyond JS — Markdown (`src/md`, a full 20-file
  crate), YAML, JSON5/JSONC, TOML, INI, CSS colors, `.patch`, Bun Shell — and
  leaf crates (`semver` 3.7K, `glob` 3.2K, `url`, `base64`, `paths`, `dns`,
  `zlib`/`zstd`/`brotli`…). Bun runs 24/7 coverage-guided fuzz on every one of
  those parsers; **fuzz-surface parity is a ledger row for us** (§8).
  **`bun install` and the bundler core need no JS engine at all.**
- **JSC-bound layer**: `src/jsc` (54K Rust FFI) + `src/jsc/bindings` (~349K LOC
  C++ across ~1,240 `.cpp`+`.h`), `src/runtime` (327K; node-compat spans ~38
  `test/js/node` dirs / 64 modules, `webcore/`,
  `api/` Bun.*, `server/`, `test_runner/`, shell), `src/js` (82K TS builtins
  using JSC `$`-intrinsics, lowered by `src/codegen/bundle-*.ts`).
- **JSC itself**: a pinned WebKit fork (`scripts/build/deps/webkit.ts`,
  `WEBKIT_VERSION = c9ad5813…`), prebuilt download, with a documented ABI
  landmine (ASAN changes `WTF::Vector` layout → silent corruption if mixed).
  This — ~2M LOC of C++ fork plus 349K LOC of their own C++ bindings — is the
  nasty source we sever.
- **The C/C++ that survived the Rust rewrite** — even Rust bun still embeds
  uWebSockets/usockets (the HTTP/WS server + event loop, C++; `src/uws`/
  `src/uws_sys`), BoringSSL (`src/boringssl_sys`), lshpack/lsquic (HPACK +
  HTTP/3), and SQLite. **Our sever map**: JSC → the M5 flip; BoringSSL →
  rustls(+PQ, task S3); lsquic/lshpack → quinn (G5 — one move, and it's the
  quinn+rustls choice `QUANTUM_MAP.md` already made); uws → the G6
  io_uring server, severed when `Bun.serve` lands on it in P9; SQLite →
  declared accepted external for now (like JSC pre-flip; revisit post-M5).
  The M1 hybrid inherits them all via bun's crates — expected, ledgered,
  shrinking.

### 1.2 The machine already exists (LOGOS's side)

| Asset | Where | Why it matters here |
|---|---|---|
| AOT-to-Rust tier | `compile_to_rust` in `crates/logicaffeine_compile/src/compile.rs`; largo build in `apps/logicaffeine_cli/src/project/build.rs` | LOGOS programs become real native CLI binaries (argv/stdio/exit codes); `Largo.toml` names the binary — ours is named `bun` |
| Five tiers, one semantics | tree-walker, register VM (`src/vm/`), EXODIA copy-and-patch JIT (`logicaffeine_forge` + `logicaffeine_jit`), AOT-to-Rust, WASM | The engine ladder JS will ride. Byte-identity across tiers is the house differential lock |
| **Self-applicable partial evaluator + genuine Futamura projections** | `compile.rs` — `count_dispatch` (line 5590), genuine P2 `PE(pe, interp)` (line 8120), genuine P3 (line 8369); test infra `crates/logicaffeine_tests/tests/pe_support/mod.rs` (`decompile`, `decompile_on_vm`, `run_p1`, `run_via_dialect(bti)`, `run_all`, `behavior_diff`); locks `futamura_ratchet.rs`, `jones_fidelity_lock.rs`, `jones_whole_language_lock.rs`, `phase_futamura.rs` | **The engine factory.** Jones optimality (`count_dispatch == 0`) is CI-locked across all three projections today. This is the machinery §3 aims at JavaScript |
| NaN-box encoding | `crates/logicaffeine_compile/src/vm/nanbox.rs` (`Narrow`, int-favored; its own docs describe the float-favored "classic JS" profile) | The JS value/handle encoding is a re-profile of proven machinery |
| Deterministic runtime | `crates/logicaffeine_runtime` — cooperative M:1 `scheduler.rs`, work-stealing M:N `executor.rs`, channels, seeded replay | Install parallelism; the `--replay-seed` feature moat |
| Native interop | `## To native` kernels (`crates/logicaffeine_compile/src/semantics/builtins.rs` registry, impls in `logicaffeine_system`); `## Requires <crate>` injection into the generated Cargo.toml | The syscall-level substrate for the stdlib gap workstream |
| Multi-file projects | `Largo.toml` (`apps/logicaffeine_cli/src/project/manifest.rs`), module loader (`crates/logicaffeine_compile/src/loader.rs`, `file:`/`logos:` URIs) | logos-bun is a real largo project, many `.lg` modules |
| Scale precedent | `crypto.lg` — 2,943 lines of LOGOS: full ML-KEM-768 + ML-DSA-65 + Keccak/SHA-3, bit-exact vs FIPS oracles at every tier | Systems code of real complexity, written in LOGOS, proven differentially. The template for every module below |

Known LOGOS stdlib gaps (each becomes a task, §7 P3): JSON, TOML, subprocess
spawn, dir-walk/streaming file IO, TCP/TLS, HTTP client/server, tar/gzip/zstd/
brotli, regex.

### 1.3 The platform exploitation map — every crown jewel put to work

The audit question: *what parts of the platform should the world's best bun
use?* Answer: **all of them.** Assets beyond the execution tiers, each mapped
to its job (tasks in §10):

| LOGOS asset | Where it lives | Its job in logos-bun |
|---|---|---|
| **Certified SAT / proof engine** | `logicaffeine_proof` — `solve.rs` (`solve_structured`/`solve_comprehensive`), `cdcl.rs`, `certifier.rs`, DRAT/RUP certificates (`ProofStep::Rup`, xor_drat, drat-trim-checkable) | **The certified resolver** (§7 P4): dependency conflicts explained from an UNSAT certificate — PubGrub-class "here is exactly why this is unsolvable" messages, machine-checkable; resolution audits; opt-in `--resolution=optimal` solver mode |
| **SMT translation validation** | `logicaffeine_tv` — `symexec.rs`, `equiv.rs`, `summarize_logos` | Formal layer above differential testing: Proj-1 residuals symbolically checked equivalent to `jsint` on the corpus (§3.4); optimizer changes validated, not just fuzzed |
| **Wire codec** | `concurrency/marshal.rs` — `T_STRUCT_VIEW` offset-table views (`view_message`/`struct_field` O(1) field jump), type-id elision, per-column compression menu, SIMD group-varint | **Every internal format**: install cache manifests, bundler incremental graph cache, Proj-2 compiler-artifact/module cache, heap snapshots, `--hot` state transfer, worker `postMessage` fast path. Random-access reads without parsing — beats JSON/lockb-style formats structurally |
| **PQC crypto stack** | ML-KEM-768 + ML-DSA-65 + SHA-3 in `crypto.lg` (FIPS-oracle bit-exact); X-Wing hybrid + PQ roadmap in `QUANTUM_MAP.md` | **Post-quantum supply chain** (§9.2): ML-DSA package signing + provenance attestations (registry-independent, PQ end-to-end), hybrid-PQ transport where the endpoint negotiates it, SHA-NI/SIMD-lane integrity hashing. First package manager with a PQ-native signing/attestation chain |
| **Capability policies** | `semantics/policy.rs` (`check_policy`), zones/CheckPolicy language surface | **Sandboxed lifecycle scripts** (§9.2): `--secure` install profile — postinstall runs under a declared capability policy (fs scope, net deny, env allowlist). Default stays bun-compatible; the policy engine already exists |
| **io_uring layer** | `logicaffeine_system/src/fs/uring.rs` + `uring_worker.rs` | Linux install fast path (batch open/read/link syscalls in rings) and the `node:fs` backend; server accept loops |
| **CRDTs + relay/mesh** | `logicaffeine_data` CRDTs, `Distributed<T>`, WS relay + libp2p gossip (`logicaffeine_system`) | **Serverless team cache** (§9.3): opt-in CRDT-synced shared install cache over the relay — Turborepo-style remote cache with no server to run; content-addressed tarball exchange |
| **HOTSWAP machinery** | `work/HOTSWAP.md` — 24 phases done, 3 tiering axes, runtime re-optimization | `bun --hot` done right (§7 P8): state-preserving hot reload above bun's module-replacement; plus engine tier re-optimization at runtime |
| **Numeric tower** | Native BigInt (WASM-linked end-to-end), Decimal, Rational | JS BigInt = native BigInt, no shim; **lossless JSON** opt-in (`Bun.JSON` exact mode — decimal-precise numbers; "JSON numbers ruin lives" answered) |
| **Value-type substrate** | RFC 9562 UUID complete in `uuid.lg` (all versions); temporal types (`logicaffeine_system/temporal.rs`); Quantity/Money | `crypto.randomUUID`/uuid backed by proven `.lg`; the Temporal proposal (engine E12) backed by native temporal machinery instead of raw grind |
| **largo registry client** | `apps/logicaffeine_cli/src/project/registry.rs` (publish, tarballs, token auth) | **The two-way ecosystem door** (§9.3): `bun install` resolves `logos:` packages; `bun publish` targets npm and the largo registry; `.lg` deps in package.json |
| **Mutation-testing culture** | cargo-mutants infra (`mutants.toml`, `mutants.out/`) | `bun test --mutate` (§9.3): built-in mutation testing for JS suites — no JS test runner ships this |
| **Hash oracle + SIMD lanes** | `logicaffeine_base/hash.rs`; `Lanes4Word32/64`, SHA-NI kernels (`sha1rnds4` family in `builtins.rs`) | Content addressing everywhere (caches, dedup); SIMD-structured JSON scanning (G1 kernel, simdjson-class); tarball SHA512 at line speed |
| **Direct WASM backend** | `vm/wasm/` + `link.rs` (rust-lld relocatable objects) | The toolchain in the browser (playground: transpile/bundle client-side); a sandbox target for running untrusted code |

Anti-features we delete on purpose: `src/analytics` telemetry is **not
reimplemented** — logos-bun phones home never; crash reporting is local-only
with explicit opt-in upload. Privacy is a feature of the world's best bun.

---

## 2. Doctrine — the three laws + the TDD contract

1. **The spec already exists.** Bun's ~1,940 test files + bench suites are the
   acquired IP. We do not write the spec; we conquer the ledger. Where we must
   author tests (stdlib gaps, the JS interpreter, the beyond-bun features),
   test262, RFC vectors, and bun-the-binary are the external authorities.
2. **The ratchet is law.** Every proven behavior lands in a checked-in ledger
   whose PASS set may only grow. A PASS entry failing in CI is a regression =
   **merge freeze on the whole repo** until fixed or formally reverted with an
   incident file. Nobody hand-edits PASS entries; promotion is a bot's job.
3. **Everything is differential.** Four oracle rings, innermost to outermost:
   - **LOGOS tier identity**: every `.lg` module byte-identical across
     tree-walker == VM == JIT == AOT (== WASM where applicable). Non-negotiable
     for all logos-bun source.
   - **Formal equivalence**: where `logicaffeine_tv` reaches, residuals and
     optimized forms are SMT-checked against the definitional semantics — a
     ring *inside* testing, not instead of it.
   - **Component oracles**: bun's own Rust crates, path-linked into fuzz shims
     — the oracle is bun's *actual code*.
   - **Behavior oracle**: the real bun binary, pinned (`SPEC_PIN.md`), driven
     head-to-head on identical inputs.

**The TDD contract, per unit of work** (this is how every task in §10 runs):

- **RED**: the failing test exists first — a conformance row flipped from
  BLOCKED to FAIL, a KAT file, a fuzz probe protocol, a projection lock — and
  is committed before implementation starts.
- **GREEN**: implement until the exact RED battery passes. Never touch a RED
  test to make it pass; the test is the spec.
- **LOCK**: the pass enters a ratchet (conformance ledger / fuzz regression
  corpus / `futamura_ratchet`-style floor constant / bench LEDGER) so it can
  never silently regress.
- **SWEEP**: full logos-bun suite green before the task closes. A failing test
  anywhere is a regression; we do not move forward on red.

### 2.5 The execution engine: dynamic workflow loops (the proven playbook)

The Zig→Rust rewrite published the how, at exactly our scale: ~1M lines in 11
days, every line adversarially reviewed pre-commit. We adopt it wholesale —
this section is the operating manual for every mass phase in §7.

- **The unit of work**: 1 implementer + **2 adversarial reviewers** + 1 fixer,
  in **split context windows**. Reviewers get ONLY the diff — none of the
  implementer's reasoning — and are told to assume the code is wrong; their
  only job is to find why. Implementers never review; reviewers never
  implement. (The Claude that wrote the code wants it merged; the Claude that
  reviews wants to find the bug. Same as humans.)
- **Plan docs are reviewed before code is.** Prep artifacts (§7's
  `PORTING_RUST_TO_LOGOS.md`, `SEMANTIC_TRAPS.tsv`, every PROBE.md) get their
  own adversarial-review round to kill conflicting guidance before it fans out
  into a thousand files — the PORTING.md/LIFETIMES.tsv ritual.
- **The trial-run rule**: every mass workflow runs on **3 files first** — full
  loop, implementer/reviewers/fixer — before fanning out to the rest (they
  trialed 3 of 1,448 `.zig` files; we do the same per port target).
- **Fix the process, not the code.** When output is wrong at scale, the bug is
  in the workflow prompt: edit the loop, not the files (their false starts:
  "get crates compiling" read as "stub the functions out"; suspiciously long
  justification comments). Reviewer rule, verbatim: *"If you need a
  paragraph-long comment to justify why the workaround is OK, the code is
  wrong — fix the code."*
- **Failures are work queues.** Compiler errors / test failures / stack traces
  dump to files, grouped per module, divvied across worktree shards (their
  shape: 4 worktrees × 16 Claudes ≈ 64 concurrent), fixed module-by-module;
  expensive commands (cargo, full builds) run once at loop boundaries, never
  inside the fan-out.
- **Workflow ops discipline**: the dynamic-workflow **runner** (a script, the
  harness — *not* an interactive agent typing git) performs commits, and only
  `git commit <specific-files>` / `git push` of named paths — **never**
  `git stash`, `git reset`, `git checkout`, or any destructive/wholesale git.
  No slow commands inside the fan-out; provision disk IOPS before a mass run
  (one slow grep froze bun's box for minutes); stress-class tests (TCP
  exhaustion, ~10k process spawns, GB disk writes) run under `systemd-run`
  cgroup isolation (memory/CPU/pid-namespace) — "please" is not isolation.
  **This does not contradict the "Claude never runs git" house rule**: that
  rule governs *interactive agent sessions* and everything touching a
  *remote* (push, PR, fork — always user-driven, §9.4 invariant 20). The
  workflow runner's scoped local commits inside logos-bun's **own** repo are
  automation the user configures and authorizes once when starting a loop —
  the same way CI commits. logos-bun ships its own `CLAUDE.md` encoding
  exactly this split; nothing here reaches into the `logicaffeine` repo, whose
  rule 1 stays absolute.
- **Anti-skip verification**: green is not enough — the ledger records
  **executed-assertion counts** per test file per platform, compared against
  oracle-bun's counts (bun publishes ~1.39M `expect()` calls on Linux). A
  silently-skipped test can no longer hide behind a passing run; their manual
  "I verified the tests were in fact running" becomes mechanical.
- **Envelope honesty**: the Zig→Rust port cost 11 days / ~$165K API-priced /
  ~64 concurrent Claudes, with the suite as spec and the languages
  structurally close. Our toolkit phases (P2/P4/P5/P6, P9 modules) sit in that
  envelope class — mechanical port against an existing green suite. The
  engine (M2–M4) does not; it keeps its own QuickJS-scale calibration (§4).

---

## 3. The prize: JavaScript as a DSL, the engine derived by Futamura

This is the architectural center — not a late-phase speed trick. **We do not
write a JS engine. We write JavaScript's semantics once, as a definitional
interpreter over our bytecode VM, and derive the engine from it.**

### 3.1 The single artifact: `jsint`

`src/engine/jsint/*.lg` — a definitional interpreter for ECMAScript, written in
LOGOS, structured from day one for binding-time separation:

- **Static** (known at specialization time): the JS program — its parsed form,
  scopes, property-name literals, shape tables, function bodies.
- **Dynamic** (runtime only): the JS heap, values, this-bindings, IO.

`jsint` is the *only* artifact that carries JS conformance. test262 runs
against it. The JSC differential (§4) runs against it. Everything else is
derived and proven equivalent mechanically.

### 3.2 The projection ladder — the engine falls out

Exactly the machinery already CI-locked in `phase_futamura.rs` /
`futamura_ratchet.rs`, aimed at its first industrial payload:

The three projections are written **`Proj-1 / Proj-2 / Proj-3`** throughout
this doc (never `P1/P2/P3` — those are campaign phases in §7/§10; the two
namespaces are kept strictly disjoint):

| Projection | Computation | What it yields for logos-bun |
|---|---|---|
| **Run** | `VM(jsint, program.js)` | The definitional tier: slow, correct, the in-repo oracle. Ship-mode `jsint` is itself AOT-compiled-to-Rust (a native-speed interpreter — no interpreter-on-interpreter tax) |
| **Proj-1** | `PE(jsint, program.js)` → residual LOGOS program | **The JS program compiled to VM bytecode with the interpreter dispatch specialized away** (`count_dispatch == 0`). The residual rides the existing tiers: VM → EXODIA copy-and-patch on hot loops → AOT-to-Rust for `bun build --native` |
| **Proj-2** | `PE(pe, jsint)` → standalone compiler | The JS→bytecode compiler as an artifact — fast compilation without re-running specialization per program. `compile.rs` already performs genuine Proj-2 by self-application |
| **Proj-3** | `PE(pe, pe)` → compiler-generator | When TC39 ships a new feature, we **edit the semantics** (`jsint`) and the compiler regenerates. The engine is maintained at the spec level, forever |

Why this is the perfect-from-the-get-go TDD story:

- **One artifact to verify.** A hand-written engine (JSC, V8) must verify an
  interpreter AND a baseline JIT AND an optimizing JIT against the spec
  independently — divergence between them is the classic engine bug class. We
  verify `jsint` and then prove `Proj-1(jsint, p) ≡ run(jsint, p)` per program
  with the same lock pattern as `jones_fidelity_lock.rs`. The compiler cannot
  disagree with the interpreter, **by construction plus by ratchet**.
- **The residual is LOGOS.** Nothing JS-specific enters the shared semantics
  kernel or the VM ISA; the five-tier byte-identity locks keep their meaning,
  and JS inherits every tier (and every future tier — WASM, silicon) for free.
- **Speed is inherited, not built.** EXODIA's proven stencils and the AOT tier
  are the "optimizing JIT" no from-scratch engine ever gets.

### 3.3 What must be true (the honest engineering, each item a §10 task)

- **PE at scale.** Today's Jones locks cover the LOGOS construct matrix on
  small corpora; `jsint` is orders of magnitude bigger. The answer is
  granularity: **specialize per JS function, not per program** (polyvariant,
  cached, incremental). The `futamura_ratchet.rs` floor-constant pattern is
  extended with a `jsint` corpus and may only rise.
- **Dynamic residue is legal.** `eval`, `with`, megamorphic sites, dynamic
  property names resist static binding. The residual simply keeps `jsint`
  fragments inline at those sites — specialization degrades gracefully,
  correctness never depends on it. This is also the deopt story: invalidated
  assumptions fall back to interpreter fragments (RED battery: mid-run
  invalidation fuzz, residual-vs-definitional differential).
- **Shapes and inline caches are interpreter *data*.** Hidden classes, shape
  tables, and IC state live in `jsint`'s data model with a deliberate
  static/dynamic split so the PE specializes property access on shapes. PE is
  static where ICs are adaptive — designing the data model so specialization
  captures the monomorphic 90% is a day-one requirement, not a retrofit.
- **The GC.** JS requires observable collection (`WeakRef`, `WeakMap`
  ephemerons, `FinalizationRegistry` — test262 tests it); Rc/arenas cannot host
  it. Design: **the JS heap is explicit interpreter data** — a slab store of
  cells addressed by 48-bit handles (a float-favored profile of
  `vm/nanbox.rs`'s `Narrow`), never host pointers, so the Rc world and the JS
  heap cannot entangle. The collector is **mark-sweep, stop-the-world,
  non-moving, written in LOGOS** over the store: ephemeron fixpoint for
  WeakMap, FinalizationRegistry drained at event-loop checkpoints, precise
  roots by construction (tag-scannable registers; interpreter frames live *in
  the store*, which also makes generators/async suspension trivial).
  Non-moving ⇒ zero pointer fixups in EXODIA code. Generational/compaction
  later, driven by benchmarks. Dividend: an explicit heap serializes ⇒
  **startup heap snapshots** (builtins baked into the binary, encoded on the
  wire codec) and, with the deterministic scheduler, **seeded-replay of GC
  timing**.
- **Declared native seams** (seam discipline). Each is a native kernel first,
  and — where a pure-`.lg` replacement is planned — carries a `Kx`
  replacement task in §10; where the native kernel is the *permanent* choice,
  the doc says so instead of implying a milestone that doesn't exist:
  - JS/TS parser — reuse `bun/src/js_parser`'s grammar knowledge, ported to
    `.lg` in **P5** (shared by transpiler, bundler, engine — transpile-vs-
    execute divergence impossible). *Not* a permanent native seam; P5 *is* the
    replacement.
  - RegExp — ES-semantics backtracking engine as a native kernel (E8);
    `.lg` replacement is **K-RegExp** (§10, post-M3, optional — the kernel may
    stay if it wins).
  - dtoa/strtod — Ryu/Grisu native kernels (task **G12**); these are
    **permanent** (exact float↔string is a solved numeric-kernel problem, not
    a LOGOS-rewrite target). No milestone implied.
  - Intl — ICU4X (pure Rust; also severs the ICU C++ fight in `webkit.ts`).
    **Permanent** — reimplementing CLDR in `.lg` is out of scope, stated
    plainly.
  - WebAssembly execution — wasmtime seam (E14) first; `.lg`/own-executor
    replacement is **K-Wasm** (§10, uses our `vm/wasm/` encoder+linker;
    optional, benchmark-driven).
  BigInt is **not** a seam — JS BigInt lands directly on the native BigInt
  already proven through the tiers.
- **Strings are a day-one data model, not a detail.** JS string perf lives and
  dies on concatenation and slicing: the two-arm WTF-16 representation needs
  **ropes** (concat trees flattened lazily) and atom/interning tables in the
  heap design from the start — retrofitting ropes into a GC'd heap is misery.
- **Workers, SharedArrayBuffer, Atomics.** `worker_threads`/Web Workers mean
  **one slab heap per worker** (bun's worker model is per-thread heaps —
  matches our design), with SharedArrayBuffer as shared native buffers living
  *outside* every heap, referenced by handle; `Atomics` (incl. wait/notify)
  operate on those buffers directly. The deterministic scheduler must model
  cross-worker nondeterminism explicitly — which is exactly what makes
  `--replay-seed` extendable to worker programs, something no other runtime
  can do.
- **The WebAssembly JS API is part of the engine surface** (bun ships it;
  `test/js/bun/wasm` tests it). Strategy: a native seam first (wasmtime behind
  the engine contract — instantiate/imports/exports/memory sharing with the
  slab heap), replaced later by our own WASM machinery (we already own an
  encoder/linker in `vm/wasm/`; a validator/executor is the missing half).
- **Portability — elevated, because Apple Silicon is bun's home turf.**
  EXODIA is x86_64-SysV; macOS/aarch64 and Windows ride VM + AOT (the AOT tier
  is the portable optimizing backend, and Proj-1 residuals AOT-compile per-module,
  so "no JIT" ≠ slow). **aarch64 copy-and-patch stencils are a named campaign
  (F8)**, not a footnote; Windows additionally needs the `windows-shim`
  launcher counterpart (`bun/src/install/windows-shim`) and the macOS release
  needs codesigning/entitlements parity (`bun/entitlements.plist`).

### 3.4 Engine TDD — the RED batteries

1. `test262/` directory ratchets: per-directory monotone pass-count floors
   (`language/` first, `built-ins/` staged, `intl402` last), the
   `futamura_ratchet.rs` pattern verbatim. Target: ≥99% ex-Intl (QuickJS-class)
   before the flip.
2. **In-binary JSC differential** (§4 gives us JSC behind a seam): every
   corpus program runs on both engines — compare stdout, completion value,
   exception class+message. The tree-walker==VM lock aimed at JSC. Fuzzed
   nightly with structure-aware JS generation; mismatches minimize and bank
   forever.
3. **Projection locks**: for the growing `jsint` corpus, `Proj-1 residual ≡
   definitional run` (behavior), `count_dispatch(residual) == 0` (Jones),
   Proj-2 compiler output ≡ Proj-1 residual (already the house pattern in
   `phase_futamura.rs`).
4. **Translation validation**: `logicaffeine_tv` (symexec + equiv) SMT-checks
   residual-vs-`jsint` equivalence on every corpus program where the summary
   fits the solver — the formal ring inside the differential ring. New
   optimizer passes must pass TV before they may touch residuals.
5. GC observability battery: `Bun.gc(true)` stress loops, WeakRef/ephemeron/
   FinalizationRegistry semantics, heap-snapshot round-trip (wire-codec
   encoded).
6. Tier identity: residuals byte-identical across VM/EXODIA/AOT — the existing
   lock, inherited free because residuals are LOGOS.
7. **The swamp batteries** — the compat traps where runtimes actually die,
   each a named, seeded differential battery vs JSC (later vs node too):
   - **CJS↔ESM interop matrix**: require-of-ESM, synthetic default exports,
     `__esModule`, `require.cache`, circular imports, dual-package hazards.
   - **`error.stack` format**: V8-style traces are observable, string-parsed
     by real code, and bun mimics them — ours must match to the column.
   - **Ordering fidelity**: `process.nextTick` vs microtasks vs `setImmediate`
     vs timers (incl. clamping) — a golden-trace corpus, byte-compared.
   - **structuredClone + transferables** (and `postMessage` semantics —
     encoded on the wire codec internally, observable behavior identical).
   - **AsyncLocalStorage / async_hooks**: the framework ecosystem
     load-bearing wall (`test/js/node/async_hooks` is the spec).

---

## 4. Shipping strategy: the staged hijack

The engine of §3 is the destination; the hijack is how every stage ships a
complete, bun-shaped product with an oracle in-binary. **v1 ships everything**
— LOGOS toolkit + JSC behind a narrow seam — and the derived engine grows
behind the same seam until JSC is severed.

- **M0 — Seam extraction.** Promote bun's de-facto boundary (`src/jsc/lib.rs`
  already documents that `src/runtime` consumes engine services only through
  its types) into a contract: `engine_api` with `engine_jsc` behind it, later
  `engine_logos`. Contract groups: VM lifecycle; compile/modules; opaque 64-bit
  EngineValue; two-arm WTF-16 strings; objects/MOP with exceptions-as-Result;
  host-class codegen (`src/codegen/generate-classes.ts` gains a second emitter
  so the 327K-LOC runtime layer is retargeted by codegen, not rewritten);
  Strong/Weak GC contract; event-loop hooks (the loop is already bun's —
  `USE_BUN_EVENT_LOOP`; JSC is the guest); `$`-intrinsic builtins lowering;
  capability-gated NAPI/inspector/v8-shim. **Seam grep-lock** (house style): no
  JSC extern symbol referenced outside `engine_jsc` — CI-enforced. Oracle: full
  `test/js` green + startup ratchet within noise.
- **M1 — logos-bun v1** = LOGOS toolkit (§7 P1–P6, P8) + JSC-behind-seam.
  Acts like bun everywhere; tooling faster (§9); JS execution parity by
  construction. This is the migration beachhead — users switch for install and
  cold-start speed and lose nothing.
- **M2 — Engine seed.** `jsint` core semantics + slab heap + GC; dual-engine
  builds (`--engine=logos|jsc`); the §3.4 batteries activate. Engine selection
  is per-workload (objects never cross heaps — no per-object fallback).
- **M3 — Semantics completion.** Async/generators (frames in the store),
  Proxy/Reflect full MOP, RegExp, TypedArrays/detach, Annex B, Intl, Temporal
  (backed by the native temporal types).
- **M4 — The projections pay.** Per-function Proj-1 by default; Proj-2
  compiler artifact in the wire-codec module cache; ICs/shapes specialized;
  heap-snapshot startup; `bun build --native` ships.
- **M5 — The flip.** NAPI over the seam (LOGOS handles), v8-shim (bun already
  fakes V8 over JSC; we fake it over LOGOS), inspector protocol. Default
  engine flips **per workload class** as its win-matrix row goes green. JSC is
  removed when `test/js` + `test/napi` + `test/v8` are green on `engine_logos`
  and no bench class regresses beyond its declared budget. The nasty source is
  severed.

Honest calibration: M2+M3 is the QuickJS-scale grind (QuickJS: ~85K LOC,
>99% test262, still 10–50× slower than JSC on hot loops — which is exactly why
our bet is derived compilation onto proven tiers, not a hand-built speculative
JIT). Hot dynamic-dispatch-heavy JS stays JSC's for a while; the flip is
per-workload for precisely that reason. Every stage before the flip is already
a shipping, better-than-bun product.

### 4.1 The M1 hybrid binary — the build architecture, stated plainly

Between M1 and the flip, the shipping binary is a **hybrid**, and pretending
otherwise would hide a whole workstream. One Cargo workspace links three
worlds:

1. **Our world**: largo compiles the `.lg` toolkit to generated Rust crates
   (the normal AOT pipeline of `project/build.rs`, emitting into the workspace
   instead of a standalone project).
2. **Bun's runtime world (temporary), in `bun-engine/`**: the seam extraction
   (M0) and codegen retargeting are *modifications to bun's source*, so they
   cannot live in the pristine `vendor/bun` submodule (the conformance oracle,
   never dirtied — §5, §9.4) nor on the gift fork (mirror + gift branches
   only). They live in **`bun-engine/`, a vendored working copy of exactly the
   bun crates the hybrid links** (`engine_api`/`engine_jsc`, `bun_runtime` and
   its support crates), imported from `vendor/bun` at a known SHA by a
   scripted **re-vendor step** (`scripts/revendor-engine.mjs`) and then
   modified in-tree. `bun-engine/` is regenerable from the pin + a checked-in
   patch/transform set, so a re-baseline replays mechanically. Its codegen
   (`.classes.ts` → Rust/C++ with the second LOGOS-targeting emitter, bundled
   `src/js` builtins) runs through our fork of `scripts/build.ts` (configure →
   codegen → cargo → C++ compile → link). The JSC prebuilt (pinned,
   ASAN-ABI-matched) and the C++ bindings objects join at the final `clang++`
   link. **The three bun trees never mix**: `vendor/bun` (oracle, pristine),
   `bun-engine/` (hybrid, modified), gift checkout (fork, mirror+branches).
3. **The delegation seam**: `main.lg` owns the process — argv dispatch, env,
   bunfig, and every toolkit command natively. Engine-requiring commands
   (`run <file>`, `test`, `repl`, `-e/--print`) cross **one C-ABI boundary**
   into the runtime layer (the same direction our FFI already supports:
   cdylib/staticlib exports both ways). That boundary is grep-locked like the
   engine seam, and it only ever **shrinks**: every P8/P9 module rewritten in
   LOGOS moves the line, and M5 deletes `bun-engine/` and the bun-Rust world
   entirely.

The hybrid is not a compromise of the thesis — it is the hijack, mid-bite:
the binary is already `bun`-shaped on day one, and the LOGOS fraction of it is
a ratcheted, ledgered number (`scripts/loc-ledger.mjs`: % of the binary's
code that is generated-from-`.lg` — it may only rise).

**M0's oracle, evaluable where it runs.** M0 lands with P6, and its gate —
"full `test/js` green + startup ratchet within noise" — is evaluated on the
`bun-engine/` build (bun's own crates, seam-extracted but behavior-identical,
still executing on JSC), *not* on logos-bun's yet-nonexistent engine. It is a
refactor-safety gate on the extraction: prove the seam changed nothing. That
is buildable and runnable at P6 because it is still bun.

---

## 5. Repo layout & toolchain

```
logos-bun/
├── Largo.toml                 # [package] name = "bun", entry = "src/main.lg" → binary named `bun`
├── BAKE_A_BUN.md              # this file (moves here at bootstrap)
├── SPEC_PIN.md                # pinned bun commit + `bun --version`; re-baseline = deliberate event
├── TOOLCHAIN_PIN.md           # pinned logicaffeine commit
├── src/                       # the LOGOS source, mirroring bun's crate seam
│   ├── main.lg                # entry: argv → dispatch (incl. argv0=="node" → run-as-node)
│   ├── cli/                   # per-subcommand modules; env-var registry; help text
│   ├── config/                # bunfig.lg, package_json.lg, npmrc.lg
│   ├── util/                  # semver.lg glob.lg url.lg base64.lg ini.lg dotenv.lg jsonc.lg json5.lg
│   │                          # yaml.lg md.lg css_colors.lg patch.lg wyhash.lg
│   ├── install/               # npm.lg resolve.lg solver.lg lockfile_text.lg lockb_read.lg tree.lg
│   │                          # extract.lg integrity.lg bin_link.lg lifecycle.lg workspaces.lg …
│   ├── parser/                # JS/TS lexer.lg parser.lg ast.lg printer.lg sourcemap.lg
│   ├── resolver/              # module resolution
│   ├── bundler/               # graph.lg tree_shaking.lg splitting.lg css.lg html.lg cache.lg
│   ├── engine/                # jsint/*.lg  heap.lg  gc.lg  shapes.lg  builtins/
│   ├── runtime/               # node-compat modules, Bun.* APIs, server, shell, sql, watcher
│   └── test_runner/           # expect matchers, snapshots, hooks, reporters, mutate
├── probes/                    # fuzz probe entrypoints (each a small largo target)
├── vendor/bun                 # submodule @ SPEC_PIN — the pristine conformance ORACLE, never dirtied
│                              # (worktree + patch series at runtime); URL may be the TristenHarr/bun fork
│                              # (mirror), SHAs always upstream (§9.4)
├── bun-engine/                # vendored WORKING COPY of the bun crates the M1 hybrid links (§4.1);
│                              # re-vendored from vendor/bun @ pin + transform set, modified in-tree;
│                              # deleted at M5 — DISTINCT from vendor/bun and the gift fork
├── vendor/logicaffeine        # submodule @ TOOLCHAIN_PIN (CI hermeticity)
├── conformance/
│   ├── runner.mjs             # fork of bun/scripts/runner.node.mjs (--exec-path plumbing kept)
│   ├── patches/               # 0001-bunexe-override.patch (3-line harness.ts change), 0002-…
│   ├── ledger/                # *.tsv ratchet files (§6.3)
│   ├── oracle/                # diffcli.mjs, treehash.mjs, shims/ (Cargo workspace → bun's crates)
│   ├── normalize.ts           # ported normalizeBunSnapshot + per-command allowlist
│   ├── lint-lanes.mjs         # Lane-A validity lint (§6.2)
│   ├── corpus/  fixtures/     # lockfile corpus, registry snapshot, pinned real-world repos
│   └── incidents/             # mandatory post-mortems for any ratchet break
├── fuzz/<component>/          # PROBE.md, gen.mjs, corpus/{seed,regressions}
├── bench/                     # our bench runner + LEDGER.json (§9); wraps bun's bench/ where engine allows
└── scripts/                   # ratchet.mjs, promote.mjs, loc-ledger.mjs, revendor-engine.mjs,
                               # install-local.sh (dist/bun + `node` symlink)
```

Toolchain dependency is dual-mode: local dev via sibling checkout override
(`/home/tristen/logicaffeine`, fast iteration); CI builds largo from
`vendor/logicaffeine` — hermetic, pinned. **Stdlib-gap native kernels land as
PRs into logicaffeine** (`builtins.rs` registry + `assets/std/*.lg` surfaces),
then the pin advances; bun-specific pure-LOGOS code stays in logos-bun.
`## Requires` covers crates.io deps in the generated Cargo project.

**Toolchain readiness is its own workstream (G11).** logos-bun will be the
largest largo project ever built by an order of magnitude, and the campaign
will hit the toolchain's own walls before it hits bun's: **incremental
compilation** (module-level codegen caching keyed on `.lg` content hashes —
recompile only changed modules' generated Rust), parallel per-module codegen,
and incremental linking of the hybrid workspace. These land upstream in
logicaffeine (they make *every* largo user faster — lift and shift left), and
logos-bun's own build time is a tracked bench suite from P1: the world's best
bun cannot take minutes to rebuild itself.

---

## 6. Phase 0 — the conformance harness (the keystone)

Built first, before any product code. Nothing counts unless the harness says so.

### 6.1 Two binaries, every CI run

- **oracle-bun**: real bun built from `vendor/bun` @ SPEC_PIN (cached artifact).
- **logos-bun**: ours, `largo build --release` → a binary literally named `bun`.

### 6.2 Three lanes (resolving the chicken-and-egg)

Bun's tests run *inside* bun — the test file is both host (assertions) and
subject (spawns `bunExe()`). We split the roles:

| Lane | Host | Subject | Unlocks | Covers |
|---|---|---|---|---|
| **A — PUPPET** | oracle-bun | logos-bun, via `bunExe()` override | P1 (needs only a binary) | `test/cli` (175: install/run/test-cli/…), `test/bundler` CLI-mode (97), the CLI-observable slice of `test/integration` + `test/regression` |
| **C — EXEC** | none — `logos-bun <file>`, exit 0 = pass | logos-bun | M2 seeds it; most rows need **P9** node/Bun-API compat (see note) | ~2.8k direct-exec node/bun parallel tests |
| **B — SELF** | logos-bun (`logos-bun test <file>`) | logos-bun | **P9** (test runner + enough node/Bun-API for `harness.ts`) | `test/js` (1,134), `test/napi` (60), `test/v8` (1), full-fidelity everything |

**Lane assignment is total**: every category in §1.1 maps to a lane —
cli/bundler + CLI-observable integration/regression → Lane A; the engine-
and API-dependent remainder (`test/js`, `test/napi`, `test/v8`, in-process
integration/regression) → Lanes B/C, `BLOCKED` on their gate until then. No
test file is outside a lane.

Mechanics: `test/bundler` needs **zero patching** (`expectBundled.ts:147`
honors `BUN_EXE`; one env-gated line forces `backend:"cli"`). Everything else
uses a checked-in patch series — a 3-line change to `bunExe()` honoring
`BUN_EXE_OVERRIDE` — applied to a scratch worktree of `vendor/bun` at runner
startup; the submodule is never dirtied, and a patch that fails to apply on
re-baseline is a loud error.

**Why Lanes B and C unlock at P9, not P8.** Both need more than a test
runner. `test/harness.ts` is built on `Bun.spawn`/`Bun.spawnSync`/`Bun.which`/
`Bun.$` and node builtins; `conformance/runner.mjs` runs under Node and, to
run under logos-bun, needs `node:child_process`/`fs`/`path` compat. All of
that is P9 (Bun.* APIs + node modules). So the **test runner alone (P8) does
not unlock self-hosting** — it unlocks Lane-A `test/cli/test`+`test/cli/run`
coverage and *partial* Lane B (the subset of `test/js` whose harness usage is
already satisfied). Full Lane B / SH-1 is a P9 gate.

**Lane-A validity lint** (`lint-lanes.mjs`): a Lane-A pass only counts if the
assertions observe the *child*. Tests exercising in-process APIs
(`Bun.build(`, `Bun.serve(`, `bun:ffi`, direct module import) are auto-marked
**`BLOCKED(P9)`** (that is where the plugin host / in-process API surface
lands, §7 P9.2) — real bun's in-process behavior can never false-green us.

**SH-1, the self-hosting gate** (a **P9** flag-plant, not P8): `conformance/
runner.mjs` itself executes under logos-bun and every Lane-A green is re-proven
in Lane B. After SH-1, oracle-bun demotes to comparator-only.

### 6.3 The ratchet ledger

`conformance/ledger/*.tsv`, one row per test (later per test-name):
`STATUS ⇥ LANE ⇥ path[::name] ⇥ first-green-commit ⇥ note`. Statuses:

- `PASS` — proven; locked, may only leave via the demotion path below.
- `FAIL` — the aspirational frontier.
- `BLOCKED(<gate>)` — mechanically impossible until a named gate lands, where
  `<gate>` is a phase (`P7`), a milestone (`M2`, `M5`), or a lane
  (`LaneB`). Covers engine-, flip-, and self-hosting-gated tests that phases
  alone can't express.
- `NOTIMPL` — a subcommand stub that answers honestly "not implemented yet"
  (a *not-yet* state, distinct from…).
- `DIVERGE(reason)` — **deliberately and permanently not matched** (bun's
  `src/analytics` telemetry, its telemetry env vars — §1.3 anti-features). A
  first-class stance, not a gap: its expected behavior is *our* behavior
  (e.g. telemetry is a no-op), and the row asserts that, so "passes bun's
  suite" and "we don't phone home" coexist truthfully in one ledger.
- `QUARANTINE(expires=…)` — flaky; expiry mandatory, expired = lint failure.

**Demotion path (the flake safety valve).** A `PASS` that fails in
ratchet-verify does **not** instantly freeze the repo. First failure →
auto-demote to `QUARANTINE(expires=+14d)` and open a tracking incident; the
repo stays open. A merge freeze triggers only on a **confirmed reproducible**
failure (fails a confirmatory re-run on the same shard) — that is the real
regression signal. This closes the "a 5%-flaky test locked at 3/3 randomly
freezes main" trap: flakes quarantine themselves; only deterministic breakage
freezes.

CI jobs:
- **ratchet-verify** (every PR, sharded): replay the full PASS set. A
  *confirmed* failure = repo-wide merge freeze (only `fix-regression` PRs may
  land); an unconfirmed failure demotes to QUARANTINE per above.
- **ledger-lint** (every PR): any `PASS →` transition requires an incident
  file + `ratchet-break` label in the same commit (the auto-demotion writes
  both mechanically). Humans never hand-edit PASS.
- **frontier-scan** (nightly): FAIL/QUARANTINE set vs HEAD; a candidate is
  promoted to PASS only after passing **5/5 reruns across 2 distinct
  nightlies** (not 3/3 in one sitting — that admits ~5%-flaky tests) via an
  auto-generated promote PR. Humans never hand-edit PASS.
- **fuzz-replay** (every PR): all banked regression seeds, deterministic.
- **drift-canary** (nightly, non-blocking): run **upstream bun HEAD's newest
  tests** (files added since SPEC_PIN) against logos-bun into a separate
  `ledger/drift.tsv` — never gates merges, but shows where upstream is moving
  before a re-baseline, so pin bumps are a planned absorption, not a surprise.
  The re-baseline ritual itself is documented in `SPEC_PIN.md`: bump pin →
  re-apply patch series (failure is loud) → frontier-scan the new files →
  triage new FAILs into phases.

### 6.4 The comparators

- **diffcli**: identical `(argv, cwd, env)` under both binaries; compare exit
  code + normalized stdout/stderr (normalizers ported from
  `normalizeBunSnapshot`: temp paths, PIDs, timings, version strings; the
  per-command normalizer allowlist is itself checked in — byte-exact wherever
  deterministic).
- **treehash**: canonical node_modules manifest (sorted walk of
  `relpath ⇥ mode ⇥ symlink-target|sha256`), compared as diffable manifests;
  `bun.lock` **byte equality** (deterministic text); `bun.lockb` read-compat
  proven by migrating lockb→lock under both binaries and byte-comparing;
  install-cache layout equality.
- **exec-equivalence** (bundler): output bytes may legally differ; instead run
  the bundle under oracle-bun (and node) and byte-compare *program output*;
  sourcemaps compared by decoded mappings.

### 6.5 Stability lanes & the platform matrix (the bar the Rust rewrite set)

The whole point of bun's Rust rewrite was stability; matching bun now means
matching that bar, not just its features:

- **The leak lane**: bun's end-to-end memory-leak tests and LeakSanitizer
  integration (`bun/test/leaksan.supp` is in-tree) run against logos-bun.
  The bar is theirs: *every instrumentable leak fixed*. Their published
  `Bun.build()` ×2000 benchmark (v1.3.14: 6,745 MB → v1.4.0: 609 MB) becomes
  a bench suite with their numbers as the oracle floor.
- **Miri + ASAN in CI** on our unsafe surface — the native kernels, the FFI
  seams, and the generated-Rust artifacts. (They run Miri on a growing chunk
  of their unsafe Rust; our unsafe footprint is smaller by construction —
  LOGOS-generated code is safe Rust — which is itself a ledgered claim:
  `unsafe`-count per crate, ratcheted downward.)
- **The platform matrix is six, not three**: Linux x64/arm64, macOS
  x64/arm64, Windows x64/**arm64** — per-platform ledgers, per-platform
  race-to-green (their chart: Linux green a full day before Windows; plan for
  the same shape in P9).

---

## 7. The phase ladder

Every phase: **LOGOS deliverable → RED battery (first) → oracle → ratchet →
exit criteria.** P3 runs in parallel from day 1; engine milestones (§4 M0–M5)
interleave from P6 onward.

**Port strategy — mechanical first, idiomatic second.** Within each toolkit
phase (P2/P4/P5/P6 and the P9 runtime-module rewrites), the path is
**mechanical port → suite green → idiomatic-LOGOS refactor**, not clean-room
reimplementation — "all at once" *within* a subsystem, exactly as the Rust
rewrite proved ("do the rewrite that looks like we transpiled it; refactor
after it ships"). The staged hijack still gates shipping between phases. Two
prep artifacts seed every port workflow and are adversarially reviewed before
any code (§2.5):

- **`PORTING_RUST_TO_LOGOS.md`** — the pattern map: how bun's Rust idioms
  (Result plumbing, slices, iterators, traits, arenas, Box/Rc ownership,
  const generics) render as LOGOS idioms; written via the long-discussion
  ritual, then frozen.
- **`SEMANTIC_TRAPS.tsv`** — the Rust→LOGOS analog of the Rust rewrite's
  19-regression taxonomy, where every regression was *syntactically similar,
  semantically different* code. Our known trap classes, each with a dedicated
  fuzz-generator focus (§8): **1-based vs 0-based indexing** (the documented
  LOGOS bracket footgun), integer division/overflow/wrapping semantics, UTF-8
  `Text` vs WTF-16 vs raw-byte string handling, value semantics vs reference
  semantics on collections/structs, arena-vs-Rc lifetime mapping,
  assert-with-side-effects analogs (their `debug_assert!` regression),
  comptime/const-generic analogs (their `Output.pretty` regression), and
  **recursive-descent stack depth** — every LOGOS parser gets explicit depth
  limits with RangeError semantics (their TOML 25k-nesting test is the spec).

### P1 — Walking skeleton: `bun --version`
- **Deliverable**: `src/main.lg` dispatching all 32 command tags (incl.
  argv0-as-node), env-var registry (~91 vars declared), `config/bunfig.lg`
  (pulls the TOML gap forward), canonical help text.
- **RED**: `conformance/red/p1/cli-surface.test.ts` (runs Lane A):
  `--version` byte-exact vs pin; `--help`; every subcommand either works or
  exits with the canonical `error: not implemented` (ledgered `NOTIMPL` — so
  "missing" and "broken" stay distinguishable forever); unknown-flag exit codes.
- **Oracle**: diffcli. **Exit**: `largo build --release` emits a binary named
  `bun`; all p1 rows PASS.

### P2 — Leaf utilities in pure LOGOS
- **Deliverable**: `util/semver.lg`, `glob.lg`, `url.lg`, `base64.lg`,
  `ini.lg`, `dotenv.lg`, `jsonc.lg`, `json5.lg`, `yaml.lg`, `md.lg`
  (Markdown, mirroring `src/md`), `css_colors.lg`, `wyhash.lg` —
  crypto.lg-style modules, ported per the §7 mechanical-first strategy.
- **RED**: KAT files per component + the §8 fuzz batteries + the 5-tier lock +
  depth-limit batteries for every recursive parser (SEMANTIC_TRAPS).
- **Oracle**: bun's actual crates via shims. **Exit**: 24h fuzz-clean for each
  P2 parser. The **fuzz-surface-parity row is accumulating, not a P2 gate**:
  it lists bun's full 24/7-fuzzed surface (§8) and each entry flips to PASS as
  *its* phase lands (P2 leaves here; JS/TS/JSX at P5; CSS at P6; Bun Shell at
  P8; `.patch` via `util/patch.lg`, task P2.13). The row reaches full PASS
  around P8 — the ledger shows exactly which parsers are covered at any time,
  so partial coverage never reads as complete.

### P3 — Stdlib gap workstream (parallel, upstreamed to logicaffeine)
G1 JSON (SIMD-structured scanning kernel; exact-decimal mode for §9.3) ·
G2 subprocess (spawn/pipes/env/cwd/exit — unblocks lifecycle scripts) ·
G3 dir-walk/stat/streaming IO (**io_uring backend on Linux** via
`fs/uring.rs`) · G4 TCP/TLS (rustls kernel) · G5 HTTP/1.1 + 2 + **3** client
(quinn + rustls per `QUANTUM_MAP.md` — severs lsquic/lshpack/BoringSSL) ·
G6 HTTP server (io_uring accept path; the eventual uws replacement) ·
G7 tar/gzip/zstd/brotli · G8 regex ·
G9 TOML (pulled into P1) · G10 fs-watch kernel (bun/src/watcher counterpart —
feeds `--hot`/`--watch`). Each: native kernel + `.lg` surface + RFC/real-crate
oracles + tier-differential lock, RED first, in `ledger/stdlib.tsv`.

### P4 — `bun install` end-to-end (first headline; resolution/linking need no engine)
- **Deliverable**: the full installer in LOGOS (`src/install/*` per §5), then
  satellites: add/remove/update/link/unlink/outdated/why/audit/info/pack/patch/
  publish.
- **Engine dependency, stated honestly**: resolution, lockfile read/write,
  tree linking, cache/integrity, bin links — the headline — need **zero JS
  engine**, and that is where the P4 speed and correctness wins are proven.
  But **lifecycle scripts (P4.10) execute JavaScript** (`postinstall` etc.),
  so they depend on the M1 hybrid's JSC-behind-seam (§4.1) and are gated
  accordingly: until M1's engine boundary is live, the install core runs and
  is validated with `--ignore-scripts`, and the 25-repo gauntlet runs first
  in `--ignore-scripts` mode (proving tree + lockfile parity) and then, once
  M1 lands, with scripts enabled (proving lifecycle parity). No claim of full
  real-repo install predates the engine boundary.
- **The semantics matrix is the spec, not the happy path**: peer-dependency
  auto-install, optional-dep failure tolerance, `os`/`cpu`/`libc` gating,
  `overrides`/`resolutions`, workspace **catalogs** (the lockb magic tags
  `oVeRriDs`/`cAtAlOgS` are the format's own confession), global installs
  (`-g`) + the `bun link` workflow, `--frozen-lockfile`/`--production`/offline
  modes, text-lockfile versions v0–v2, npm auth flows (scoped tokens, `.npmrc`,
  publish OTP), and bunfig `minimumReleaseAge` (bun's own supply-chain gate —
  it composes with §9.2: age-gating + signatures + sandbox in one profile).
  Each row of this matrix is a fixture + Lane-A test before it is code.
- **The certified resolver** (`install/solver.lg` + `logicaffeine_proof`):
  default resolution is bun-compatible bit-for-bit (the treehash oracle demands
  it). The proof engine rides alongside: (a) the chosen resolution is **encoded
  as constraints and verified satisfying** — an install that violates a range
  can't ship silently; (b) on conflict, the solver produces an **UNSAT
  certificate rendered as a human explanation** ("A needs C@^2, B needs C@^1,
  and A@x is the only version compatible with your engines field — here is the
  chain"), drat-trim-checkable; (c) `--resolution=optimal` opt-in mode uses
  CDCL to find e.g. the minimal-duplication or newest-compatible solution.
  `bun why` upgrades from tree-walk to proof-backed.
- **RED order**: registry-protocol probes → **lockfile corpus** (top-1000 npm
  projects harvested into `conformance/corpus/lockfiles/`; round-trip
  byte-exact) → tree-shape tests → solver KATs (hand-built conflict scenarios +
  certificate checks) → Lane A activation of `test/cli/install/*.test.ts`
  (their `dummy.registry.ts` runs under oracle-bun as host).
- **Oracle**: treehash + lockfile byte-equality vs oracle-bun against a
  snapshotted registry (`conformance/fixtures/registry-snapshot/`); drat-trim
  for certificates.
- **Exit**: 25 pinned real-world repos (Next.js app, Vite app, express
  monorepo, …) → byte-identical `bun.lock`, manifest-identical node_modules
  in `--ignore-scripts` mode (lifecycle-enabled parity is a P9 exit once M1's
  engine boundary is live); ≥90% of Lane-A install rows that don't require
  lifecycle-script execution PASS. **First bench locks land (§9): cold-start
  and install (time + RSS).**

### P5 — JS/TS parser, printer, resolver, sourcemap (the 47K-LOC crown jewel)
- **Deliverable**: `src/parser/*` in LOGOS (lexer hot loops may take perf
  kernels), `src/resolver/*`, sourcemaps. **TypeScript is transforms, not just
  stripping**: enums (incl. `const enum` inlining), namespaces, decorators
  (legacy + TC39), JSX with the full jsx-config surface, tsconfig `paths`.
  **This parser is shared by transpiler, bundler, and the engine** — one
  grammar, no transpile-vs-execute divergence class.
- **RED**: parse corpus (test262-parser-tests + bun's transpiler snapshots);
  print-fixpoint property (parse→print→parse ≡ AST); resolver tables; §8 fuzz
  vs an `oracle-parser` shim linking bun's `js_parser`/`js_printer` (canonical
  AST dump protocol). Free giant corpus: every `.js`/`.ts` in the P4 registry
  cache.
- **Exit**: 100% transpiler-snapshot parity; 24h fuzz-clean; resolver
  differential green.

### P6 — Bundler
- **Deliverable**: `src/bundler/*` (graph, tree-shaking, splitting, CSS, HTML)
  + **deterministic-by-construction outputs** (byte-identical given identical
  inputs — locked, which makes the incremental cache content-addressed) +
  `bundler/cache.lg` on the wire codec (struct-view graph nodes, O(1) reads).
- **Scope honesty**: the core bundler is engine-free, but **plugins
  (`onResolve`/`onLoad`), macros, `Bun.Transpiler`, and API-mode `Bun.build`
  are in-process JS — they need the engine**. Those tests are ledgered
  `BLOCKED(P9)` from day one (the Lane-A lint catches them mechanically); the
  plugin host lands at P9.2 as an engine consumer, not as a P6 hack — the same
  `BLOCKED(P9)` used everywhere else for in-process API tests, so the whole
  ledger is consistent.
- **RED**: Lane A on `test/bundler` (97 files) via `BUN_EXE` + forced CLI
  backend; determinism lock (same-input double-build byte-compare, in CI
  forever).
- **Oracle**: exec-equivalence + decoded-sourcemap comparators.
- **Exit**: ≥85% of CLI-mode bundler rows PASS; bench recording (not locking)
  starts for bundle suites. **M0 seam extraction lands here** (its oracle runs
  on the `bun-engine/` build — §4.1).

### P7 — The engine (§3–§4: M2 seed → M3 completion → M4 projections)
- **Deliverable**: `src/engine/*` per §3 — `jsint`, slab heap, GC, the Proj-1
  specialization pipeline. Seeds Lane C (`logos-bun -e '…'` and simple
  direct-exec files enter the ledger); full Lane C is a P9 grind (most rows
  need node/Bun-API compat).
- **RED battery / oracle**: §3.4 — test262 directory ratchets, the in-binary
  JSC differential, the projection locks, the `logicaffeine_tv` equivalence
  gate, GC observability. Ledgers: `ledger/test262-*.tsv`,
  `ledger/engine-diff.tsv`, the projection floor constants in the
  `futamura_ratchet` extension, the TV verdict ledger.
- **Exit**: test262 `language/` ratchet at its declared floor and rising;
  Proj-1 `≡ run` + `count_dispatch==0` locked on the `jsint` corpus; the JSC
  differential green on the M2 corpus. (Full ≥99%-ex-Intl is an M3 target, not
  a P7 gate — P7 exits when the seed engine is correct and self-consistent,
  M3/M4 continue inside P7's span.)

### P8 — Test runner, `bun run`, shell (test-runner-over-JSC; SH-1 is P9)
- **Deliverable**: `src/test_runner/*` (expect matchers, snapshots incl.
  inline, hooks, `test.each`/concurrent, junit), `src/runtime/shell/*`,
  run/bunx dispatch over G2 — including the **workspace script runner**
  (`--filter <pattern>` across packages, `--elide-lines` output framing) —
  and `--hot`/`--watch` over G10. **`--hot` fidelity is staged, honestly**:
  pre-flip, JS state lives in JSC's heap, so `--hot` delivers *bun-parity*
  module replacement (via the engine seam) — HOTSWAP's LOGOS-tier machinery
  cannot preserve state inside JSC. **HOTSWAP-grade state-preserving reload is
  a post-engine (M-engine) capability**, claimed only once JS state lives in
  the LOGOS slab heap; the doc never promises it on JSC.
- **RED**: Lane A on `test/cli/test` + `test/cli/run` + `test/cli/hot` +
  `test/cli/watch`; then **partial Lane B** — logos-bun runs the subset of
  `test/js` whose `harness.ts` usage is already satisfied (glob, semver,
  transpiler…).
- **Exit**: `test/cli/test` + `test/cli/run` Lane-A rows PASS; the runnable
  partial-Lane-B subset PASS. (Full self-hosting SH-1 needs the P9 node/Bun-API
  surface that `harness.ts` and `runner.mjs` require — it is a **P9** gate,
  §6.2.)

### P9 — Node-compat + Bun-API long tail → **the Flip to self-hosting**
64 node modules ordered by **yield** (`coverage-map.mjs` ranks modules by how
many blocked test files each unlocks — expect fs/path/events/stream/buffer/
child_process/http to dominate; `node:fs` rides G3/io_uring;
`crypto.randomUUID` rides `uuid.lg`; `node:test` compat rides the P8 runner);
Bun.* APIs (serve, file, spawn, `bun:sqlite`, `bun:ffi` over the C-ABI seam,
SQL — Postgres/MySQL per `bun/src/sql` — and valkey) likewise. Also here: the
engine-consuming CLI tail (`repl`, `-e`/`--print`, stdin execution), the
bundler plugin host + macros + `Bun.Transpiler` (unblocking the P6
`BLOCKED(P9)` rows), and **bake** — bun's dev-server/SSR framework
(`bun/src/runtime/bake`, HTML imports, HMR) — which composes with HOTSWAP for
a dev server whose hot reload preserves state (once JS runs on the LOGOS
engine). Lane C's ~2.8k parallel tests are the grind metric; frontier-scan
promotes nightly; ledger granularity goes per-test-name.
- **Mid-P9 gate — SH-1 self-hosting**: `harness.ts` + `runner.mjs` run under
  logos-bun; all Lane-A greens re-proven in Lane B; oracle-bun demotes to
  comparator-only.
- **The win matrix** (defined here, referenced by §4 M5 and §9): a table in
  `ledger/win-matrix.tsv`, one row per **workload class** — {startup, install,
  bundle, test-run, http-server, json, numeric-hot, string-heavy,
  property-heavy/dynamic-dispatch} — each carrying its current
  `engine_logos`-vs-JSC verdict (conformance-green? bench-within-budget?). A
  row goes green when its conformance slice passes on `--engine=logos` **and**
  its bench class is within budget. The M5 default-engine flip is per-row.
- **Exit / M5 flip criteria** (single reconciled statement, superseding the
  two earlier partial mentions): JSC is removed when — (a) `test/js` +
  `test/napi` + `test/v8` PASS on `--engine=logos`; (b) test262 ≥99% ex-Intl
  (intl402 tracked separately); (c) every win-matrix row is green (no bench
  class regressed beyond its declared budget); (d) NAPI + v8-shim + inspector
  capability rows PASS. Until all four hold, JSC stays as `--engine=jsc`.

### P10 — Perf campaign + the beyond-bun features armed (§9)
Every bench suite either locked-won or carrying an explicit budget row; every
§9.2/§9.3 feature ledgered with its own battery. **Exit / campaign end**: the
win matrix (§P9) and the M5 flip criteria are all green, JSC is removed, and
every ledger + bench ratchet is locked — after which the ratchets ensure it
can never quietly un-end.

---

## 8. The differential fuzz pattern (mechanical, per component)

Four artifacts per component; driver, minimizer, corpus layout, CI wiring all
shared:

```
conformance/oracle/shims/<c>/main.rs   # ~50 lines: stdin protocol → bun's crate → canonical stdout
                                       # Cargo path-dep from shims/<c>/ up to repo root then down:
                                       # { path = "../../../../vendor/bun/src/<c>" }  (four ..: <c>→shims→oracle→conformance→root)
probes/<c>.lg                          # LOGOS side of the same protocol (largo target probe-<c>)
fuzz/<c>/PROBE.md                      # the wire protocol, versioned, human-readable
fuzz/<c>/gen.mjs                       # seeded, structure-aware generator (deterministic)
```

`conformance/fuzz-driver.mjs` spawns both, byte-compares, ddmin-minimizes any
mismatch, and banks it in `fuzz/<c>/corpus/regressions/` **forever** (replayed
on every PR). Generation runs nightly, budgeted per component. For P5 the
generator is grammar-aware JS/TS plus the npm-cache corpus; for P4 it mutates
real package.json graphs; for the engine it feeds the JSC differential (§3.4).

**Definition of done, any component**: 24h generation with zero mismatches +
the LOGOS 5-tier internal differential green. And we eat our own dog food:
**cargo-mutants runs over our native kernels and the conformance tooling** —
the mutation score is a tracked metric on the harness itself, because a
harness that can't catch mutants can't catch regressions.

**Fuzz findings close their own loop.** A mismatch is ddmin-minimized, banked,
and **auto-drafted into a PR** carrying the repro test + a candidate fix,
human-reviewed before merge — the same fuzzer→Claude→PR pipeline bun runs in
production (100 billion parser executions → ~15 fix PRs). Our fuzz lanes must
cover at least bun's own 24/7 fuzz surface (JS, TS, JSX, CSS, JSON5, JSONC,
TOML, YAML, Markdown, INI, Bun Shell, semver ranges, `.patch`, CSS colors) —
that coverage-parity row lives in the ledger.

---

## 9. Speed, security, and "better" — the world's-best case

### 9.1 Speed & the never-slower ratchet

Winnable order (each win locks on arrival):

1. **Cold start** (locks at P4): logos-bun is a plain AOT-native binary — no
   engine boot for engine-free commands (`--version`, script-name resolution,
   warm-cache no-op install).
2. **Install** (locks at P4): the M:N work-stealing executor drives HTTP/2-
   multiplexed manifest fetches with a download→extract→link pipeline (G5+G7
   kernels), **io_uring batched fs on Linux**, hardlink/clonefile fast paths,
   SIMD SHA512 integrity at line speed. A systems fight, not an engine fight —
   winnable.
3. **CLI-driven micro suites** (P2+): glob, semver, hashing benchmarked
   **through the CLI surface** (`bun <cmd>` / dedicated probe binaries) via
   hyperfine — *not* bun's in-process `bench/glob` JS harnesses, which need
   the engine (P7) to run. The CLI framing is measurable the moment the
   command exists; the in-process JS versions join at P7 with the runtime
   suites.
4. **Bundler throughput** (P6): parallel parse across the executor;
   content-addressed incremental cache (wire codec) makes rebuilds
   near-no-ops.
5. **Runtime / in-process JS suites** (P7+): bun's `bench/` harnesses that run
   under the runtime — tracked from M2, locked only as each workload class is
   genuinely won; hot dynamic-dispatch JS is expected to be JSC's the
   longest — that is why the M5 flip is per-workload.

Mechanics (arithmetic designed so noise cannot deadlock the ratchet): each
run reports `ratio = ours / oracle` as a **3-run median** on pinned hardware,
with measured run-to-run noise `σ` per suite (recomputed from a rolling
window, floor 5%). Two thresholds, deliberately separated by **more than the
noise band** so an ordinary run can never trip the wire:

- **Regression wire** = `locked_ratio × (1 + 3σ)`. A run above it is red only
  after a **confirmatory re-run** also exceeds it (single-sample outliers
  never freeze the repo); a confirmed regression uses the conformance
  merge-freeze protocol.
- **Win lock**: a new, better `locked_ratio` is recorded only when the median
  improves by **more than `3σ` across 3 consecutive nightlies**, and the value
  locked is the **conservative (worse) end of that window**, never a
  single best-ever sample. `locked_ratio` only ever decreases.

This guarantees the wire sits a full `3σ` above the conservatively-locked
floor, so steady-state runs pass with margin; only a real, sustained
regression turns it red. A suite whose engine dependency isn't met yet
carries a `BLOCKED(P<n>)`/`BLOCKED(M<n>)` row instead of a ratio.

**Time is not the only metric.** Bun's pitch is startup *and* memory, so the
ledger carries three first-class metric kinds, all ratcheted identically:
wall-clock, **peak RSS** (per bench suite, vs oracle-bun), and **binary size**
(the shipped `bun` binary — watched from P1, because ICU4X data, baked heap
snapshots, and the hybrid link are all size hazards; the flip at M5 should
*shrink* the binary when JSC leaves, and the ledger will prove it). Our own
build time (`largo build` of logos-bun, per G11) is a fourth tracked suite.

### 9.2 The trust story — supply chain no one else can build

npm's supply chain is the industry's open wound; we own the exact tools to
close it. All additive — default behavior stays bun-compatible; the ledger
proves it.

- **Sandboxed lifecycle scripts**: `--secure` install profile (and a bunfig
  `[install.security]` section) runs postinstall/preinstall under **capability
  policies** on the existing `check_policy` engine — fs scoped to the package
  dir, network denied, env allowlisted. Default remains bun's
  trustedDependencies semantics; `--secure` is the mode the security-conscious
  switch to and never leave.
- **Post-quantum supply chain** (honest about the boundary): the parts we
  control are PQ end-to-end — **ML-DSA-65 signatures** (our own FIPS-verified
  `crypto.lg`) for package signing and provenance attestations (`bun pm
  attest` / verify-on-install), which do not depend on the registry. Transport
  is **hybrid-PQ (X-Wing, per `QUANTUM_MAP.md`) wherever the registry endpoint
  negotiates it** — npm does not today, so this is opportunistic, not
  universal, and the doc says so rather than claiming a PQ path npm can't
  provide. The claim is "the first package manager with a PQ-native signing +
  attestation chain," not "every byte is PQ regardless of the far end."
- **Proof-backed resolution** (§7 P4): the installed tree is *verified* against
  the constraint set; conflicts explain themselves with machine-checkable
  certificates; `bun audit` gains a mode that proves, not lists.
- **No telemetry, ever**: `src/analytics` is not reimplemented. Crash reports
  are local files; uploading is a per-incident explicit act.

### 9.3 Migration hooks & capabilities beyond bun (each with RED battery + ledger rows)

- `bun run main.lg` + `import "./mod.lg"` from JS — the file-at-a-time on-ramp
  into LOGOS.
- **The two-way registry door**: package.json may declare `logos:` deps;
  `bun install` resolves them via the largo registry client
  (`project/registry.rs`); `bun publish` targets npm or largo. One tool, both
  ecosystems — the migration is a dependency line, not a rewrite.
- `bun build --native` — AOT machine-code binaries from JS via Proj-1 + AOT-to-Rust.
- `bun test --replay-seed <n>` — deterministic async + GC replay.
- `bun test --mutate` — built-in mutation testing for JS test suites; no JS
  runner ships this, and we already live the methodology.
- **Lossless JSON**: opt-in exact-decimal `Bun.JSON` mode on the numeric tower
  — money and 64-bit IDs stop corrupting silently.
- **Serverless team cache** (opt-in): CRDT-synced shared install cache over
  the relay/mesh — remote-cache benefits with no server to operate;
  content-addressed, integrity-checked tarballs.
- Startup heap snapshots — apps boot with builtins pre-initialized
  (wire-codec-encoded, content-addressed).
- The engine's semantics are a readable artifact (`jsint`) — auditable,
  provable, regenerable; TC39 features land as semantics edits, and Proj-3
  regenerates the compiler.

### 9.4 The gift covenant — the fork, the rules, the invariants

Differential fuzzing against bun's *actual crates* will inevitably find real
bun bugs (their own fuzzing found ~15 in 100B executions; ours drives two
independent implementations head-to-head, which finds a class theirs
structurally can't). **We patch what we find, upstream, as we go.** This
section is the complete rulebook; every rule is a review-gate or a lint where
mechanizable.

**The fork architecture — `TristenHarr/bun`:**

- `TristenHarr/bun` is the personal GitHub fork of `oven-sh/bun` and the
  delivery vehicle for every gift. On the gift checkout: `origin` = the fork,
  `upstream` = oven-sh/bun.
- **Fork `main` is a pure mirror**: fast-forward from upstream only, never a
  commit of ours. The fork never becomes a soft fork — it holds exactly two
  things: the mirror, and gift branches.
- **Gift branches must be named `claude/gift-<slug>`.** Bun's CI requires
  branches to start with `claude/` (their `CLAUDE.md`, rule 12); the
  `gift-` infix marks provenance. PRs target `oven-sh/bun`.
- logos-bun's `vendor/bun` submodule may use the fork URL for hermetic CI,
  but **pinned SHAs are always upstream commits** (mirrored, byte-identical).
  We never depend on fork-only content — the Lane-A harness patches stay
  runtime-applied from `conformance/patches/` and never land on the fork.
- The gift checkout is a **separate working tree** from both `vendor/bun`
  (the pristine conformance oracle) and the `bun-engine/` hybrid working copy
  (§4.1) — three distinct roles, never conflated, so a gift build/test never
  disturbs conformance state.

**The invariants — grounded in bun's own reviewer criteria.** Bun's
`CLAUDE.md` carries a *"Landing PRs: What Bun Reviewers Catch"* section
distilled from ~2,500 merged PRs; it is the acceptance spec. We treat it as
binding and encode it as gates. Every rule below is a pre-push checklist item
or a lint where mechanizable (task GIFT.3).

*Correctness & scope*
1. **One bug, one fix, one test — but fix the whole bug class.** No drive-by
   refactors or style opinions, yet bun explicitly requires fixing *every
   sibling site sharing the pattern* in the same PR (parallel switch arms,
   sync/async twins, POSIX/Windows branches, every caller of a changed
   helper) — scoping too narrow is rejected as surely as too wide. If a site
   is intentionally excluded, say so in the PR.
2. **Fix at the layer that owns the invariant**, never where the symptom
   appears; prove the mechanism ("the crash goes away" is not a root cause).
3. **Match the file's exact local conventions** — namespace aliases, in-tree
   helpers over hand-rolled primitives, error-path sequencing, `bun.sys`/
   `bun_core` idioms. Being the only file touching a raw primitive is a red
   flag bun reviewers catch.

*The test (bun's most-enforced category)*
4. **Every behavioral change ships an automated test in the same PR** — in
   *their* format and folder (`test/js/bun/`, `test/js/node/`, `test/cli/`,
   `test/bundler` with `itBundled`; a test in the existing file for the
   module, not a new file). "Verified manually" does not count.
5. **`test/regression/issue/<N>.test.ts` is reserved** for true regressions
   (worked before, then broke) with a **REAL** GitHub issue number — never a
   placeholder, never for never-worked behavior. Our differential finds are
   usually never-worked → they go in the module's existing test file.
6. **Prove the test fails for the right reason**: it must fail under
   `USE_SYSTEM_BUN=1 bun test <file>` and pass under `bun bd test <file>`;
   deleting each load-bearing clause of the fix must break at least one
   assertion. Assert exact normalized values (class/code/message, `toBe` over
   `toContain`), drain subprocess pipes concurrently, `port: 0`, hermetic (no
   live network), release resources via `using` before assertions.
7. **Prove non-flaky**: no `setTimeout`, await the condition; the gifted test
   passes N reruns under their runner before filing (bun rejects flaky tests
   outright). Never write tests asserting "no panic/uncaught exception" — they
   never fail in CI, so they are worthless as gifts.
8. **Crash/UAF/leak fixes carry the specific proof**: the crashing input as a
   spawned fixture; an ASan repro on the unfixed build or a leak regression
   test (`Bun.gc(true)` + `heapStats`, RSS thresholds with ~2× headroom).

*Memory safety (bun's most-blocked category — our differential's richest vein)*
9. RAII/`Drop` paired at the acquisition site; exception checks after every
   call that can enter JS; never let a pointer outlive its memory; root or
   copy every JSValue held beyond the call; balanced refcounts on every
   terminal path. A memory-safety gift must read as if written by someone
   fluent in these rules — because the reviewer is.

*Process, disclosure, legal*
10. **Security findings never go public first.** Memory-safety, crash, and
    integrity findings route to `security@bun.com` (their `SECURITY.md`;
    ack within 5 days) — never a public PR or issue until coordinated.
    Classification happens **before** filing and is recorded in the ledger.
11. **Search first.** Before filing, search their issues + open PRs for an
    existing report or in-flight fix (invariant 15's `duplicate` state). No
    duplicates, no re-filing what upstream already has.
12. **Full provenance & AI-authorship honesty.** Every gift discloses (a) how
    the bug was found — differential fuzzing vs an independent
    reimplementation — and (b) that the fix and test are Claude-authored,
    human-reviewed. Bun's own rule 11 is "be humble & honest — never overstate
    what works." The PR body follows their template (*What does this PR do? /
    How did you verify?*) and states the differential evidence plainly.
13. **License & contributor terms.** Gift code must be clean-room MIT-
    compatible and **contain nothing derived from the BSL-licensed
    logicaffeine/logos-bun sources** — a gift is a *fix to bun*, expressed in
    bun's own idioms, never a transplant of our code. Satisfy oven-sh/bun's
    contributor terms (CLA/DCO) as GitHub presents them at PR time; this is a
    user-confirmed step (bun is Anthropic-owned — provenance must be
    impeccable).
14. **Cross-platform proof.** Run `bun run rust:check-all` (linux/macos/
    windows × x64/aarch64) so `#[cfg]`-gated code type-checks everywhere;
    perf-flavored gifts carry *their* bench-suite numbers, not our claims;
    the fix reasons about every platform branch it touches.

*Cadence, ownership, non-interference*
15. **Triage before filing, and track it.** Every divergence is classified:
    **ours** (fix logos-bun, zero upstream noise) / **theirs** (gift) /
    **spec-ambiguity** (document; file an issue asking intent only when the
    answer matters). The ledger `conformance/upstream-gifts.md` tracks each
    finding through the full state machine: `found → classified →
    {embargoed | ready} → filed → {in-review | changes-requested} →
    {merged | declined | duplicate | superseded-upstream | stale} →
    re-baselined`.
16. **Own the review.** The pipeline does not end at "filed": respond to
    maintainer comments (`bun run pr:comments`), re-pass the §2.5 adversarial
    gate on every revision, keep the branch green. A gift is finished when it
    merges, is declined with thanks, or is withdrawn — never abandoned mid-
    review.
17. **Quality over volume, rate-limited.** No firehosing: a standing cap
    (default ≤ N open gift PRs at once, configurable) enforced by GIFT.3;
    crashes/correctness/leaks first, trivia batched or dropped. Every PR must
    individually be worth a maintainer's review minute.
18. **Adversarially reviewed like everything else.** A gift passes the §2.5
    loop (two diff-only reviewers + fixer) and `bun bd test <file>` green
    before it is pushed. Comments ≤ 3 lines (their rule 13); regression tests
    get exactly one comment — the issue URL.
19. **Never load-bearing, never blocking.** logos-bun never depends on a gift
    being accepted; conformance runs against SPEC_PIN regardless. If upstream
    fixes the same bug differently, we adopt theirs at re-baseline
    (`superseded-upstream`) and move on.
20. **Remote operations are user-driven.** Fork creation, pushes, and PR
    open/update are performed — or explicitly authorized per batch — by the
    user (house rule: Claude never runs git; §2.5). Claude prepares the
    branch-ready content: fix, test, PR body, platform-check evidence. The
    user pulls the trigger.

We treat their test suite as a shared constitution and never fork away from
it; the drift-canary (P0.8) tracks their velocity so re-baselines stay
routine. Strengthening bun strengthens our spec — that is the relationship,
stated once and honored.

---

## 10. Task backlog (dependency-ordered; every task lands RED-first)

**P0 — harness** (blocks everything; harness before product code — the P0.1
skeleton is the *minimal* main.lg that lets the harness run, not a feature)
- [ ] P0.1 Repo bootstrap: Largo.toml (`name="bun"`), pins, submodules (`vendor/bun`, `vendor/logicaffeine`), `bun-engine/` re-vendor script, CI skeleton, 6-platform matrix stubs. RED: `red/p0/binary-name.test.mjs` (build produces a binary named `bun` that runs `--version`). (This minimal skeleton is the harness's subject-under-test; full CLI dispatch is P1.)
- [ ] P0.2 `conformance/runner.mjs` fork (+`--oracle-path`, `--lane`, `--ledger`, per-test junit, assertion-count capture). RED: runner self-test on a 3-file toy suite.
- [ ] P0.3 Patch series + worktree materializer + `lint-lanes.mjs`. RED: patched harness returns override path; lint flags a known in-process test → `BLOCKED(P9)`.
- [ ] P0.4 Ledger + ratchet.mjs + promote.mjs + CI jobs (ratchet-verify with confirm-before-freeze, ledger-lint, frontier-scan 5/5×2-nightly, fuzz-replay). RED: confirmed PASS→FAIL flips CI red; single-sample flake auto-demotes to QUARANTINE; hand-edited PASS rejected.
- [ ] P0.5 Comparators: diffcli + normalize.ts, treehash, exec-equivalence. RED: golden fixtures for each normalizer.
- [ ] P0.6 Oracle-bun CI artifact build from pin.
- [ ] P0.7 `conformance/fuzz-driver.mjs` + shared corpus/ddmin/regression-bank machinery (the §8 driver every component reuses). RED: a seeded mismatch minimizes and banks.
- [ ] P0.8 `bench/` runner + `LEDGER.json` schema + the `3σ`-separated ratchet arithmetic (§9.1) + metric kinds (time/RSS/binary-size/build-time). RED: a synthetic regression above the wire (confirmed) turns red; a noise-band blip does not.
- [ ] P0.9 drift-canary lane + re-baseline ritual in SPEC_PIN.md. RED: canary detects a synthetic "new upstream test".
- [ ] P0.10 workflow-ops harness (§2.5): cgroup-isolation wrapper for stress tests, worktree-shard scripts, anti-skip **assertion-count parity** in the ledger, loop lint (runner may only `git commit/push <named-paths>`; no destructive git; no slow commands). RED: a workflow step running `git stash` is rejected; a skipped-test run shows an assertion-count delta vs oracle.
- [ ] P0.11 Mutation gate — cargo-mutants over the **Rust** surface (native kernels + oracle shims) once they exist (activates at P2, tracked from here); JS/TS harness code (`runner.mjs`, comparators) covered by a JS mutation pass (e.g. Stryker) instead. RED: a planted mutant in a shim survives → gate fails.

**PORT — prep gate for every mass port** (§7): PORT.1 `PORTING_RUST_TO_LOGOS.md` (+ adversarial review round) · PORT.2 `SEMANTIC_TRAPS.tsv` (+ review; every trap class gets a fuzz-generator focus) · PORT.3 **3-file trial port** of one leaf crate through the full implementer/2-reviewer/fixer loop — no mass workflow launches until PORT.3 is green.

**GIFT — the upstream pipeline (§9.4, 20 invariants; parallel from day 1, continuous forever)**
- [ ] GIFT.1 Fork bootstrap (user-driven): `TristenHarr/bun` created, gift-checkout remotes set (`origin`=fork, `upstream`=oven-sh), fork-main = fast-forward mirror, `claude/gift-*` branch convention. RED: a mirror-drift check reports fork-main == upstream-main.
- [ ] GIFT.2 Ledger + templates: `conformance/upstream-gifts.md` with the full state machine (invariant 15: `found→classified→{embargoed|ready}→filed→{in-review|changes-requested}→{merged|declined|duplicate|superseded-upstream|stale}→re-baselined`), gift-PR body template following bun's PR template + provenance/AI-authorship disclosure (invariants 12–13), security-routing checklist to `security@bun.com` (invariant 10), duplicate-search checklist (invariant 11).
- [ ] GIFT.3 Gift review-gate wiring: §2.5 adversarial loop + `bun bd test <file>` green + `USE_SYSTEM_BUN=1` fails-for-right-reason + `bun run rust:check-all` cross-platform (invariants 4–9, 14, 18) as pre-push gates; triage classification (invariant 15) as the fuzz-driver's first post-mismatch step; the standing open-PR cap (invariant 17); license/CLA confirmation step (invariant 13, user-confirmed).
- [ ] GIFT.4 **First gift** — the flag-plant, **when the pipeline surfaces its first confirmed bun bug** (not schedulable to a date; the fuzz lanes from P2 onward feed it continuously). If the fuzzed surface is clean, the task simply stays open — honestly — until a real defect appears; we never manufacture a gift.

**P1 — skeleton**: P1.1 dispatch (32 tags + argv0-node) · P1.2 env registry · P1.3 bunfig.lg — **depends on G9 (TOML), which is therefore pulled forward as the first P3 gap so P1.3 is unblocked** · P1.4 NOTIMPL canonicalization. RED battery: `red/p1/cli-surface.test.ts`.

**P2 — leaves** (each: KATs → probe+shim+gen → 24h clean): P2.1 semver · P2.2 glob · P2.3 url · P2.4 base64 · P2.5 ini/dotenv · P2.6 jsonc/json5 · P2.7 wyhash · P2.8 yaml · P2.9 md (Markdown) · P2.10 css-colors · P2.13 `.patch` parser (`util/patch.lg`) · P2.11 fuzz-surface-parity row (accumulating — each parser flips as its phase lands) · P2.12 depth-limit batteries (all recursive parsers).

**P3 — stdlib gaps** (each: kernel PR to logicaffeine + .lg surface + tier lock): G1 JSON (SIMD scan + exact-decimal mode) · G2 subprocess · G3 fs-walk/streams (io_uring backend) · G4 TCP/TLS (rustls) · G5 HTTP client (1.1+2+**3**, quinn — severs lsquic/lshpack/BoringSSL) · G6 HTTP server (eventual uws sever) · G7 archives/compression · G8 regex · G9 TOML · G10 fs-watch · **G11 toolchain scalability (upstream: incremental module-level codegen cache, parallel codegen, hybrid-workspace incremental link; logos-bun build time = tracked bench)** · **G12 dtoa/strtod exact kernels (Ryu/Grisu — permanent native seam, §3.3)**. Order note: **G9 (TOML) lands first** (unblocks P1.3); the rest by phase demand (G5 before P4, G2 before P4.10).

**P4 — install**: P4.1 registry client (G5) · P4.2 manifest/dist-tags · P4.3 resolution (bun-compatible; peers auto-install, optionals, os/cpu/libc gating, overrides/resolutions/catalogs) · **R1 constraint encoding + satisfaction verification (proof engine)** · **R2 UNSAT-certificate conflict explanations (drat-trim-checked)** · **R3 `--resolution=optimal` CDCL mode + proof-backed `bun why`** · P4.4 bun.lock writer (corpus round-trip, v0–v2) · P4.5 bun.lockb reader (migration equality) · P4.6 cache+integrity (SIMD SHA512; **W1 wire-codec cache manifests**) · P4.7 hoisted linker · P4.8 isolated linker · P4.9 bin links · P4.10 lifecycle scripts (G2 + **M1.6 engine boundary** — JS execution) · **S1 `--secure` capability-policy sandbox (check_policy) + minimumReleaseAge** · P4.11 workspaces · P4.12 satellites (add/remove/update/outdated/why/audit/pack/patch/publish incl. OTP auth) · P4.13 globals + `bun link` workflow · P4.14 frozen/production/offline modes · P4.15 Lane-A install activation (non-lifecycle rows) · P4.16 25-repo gauntlet (`--ignore-scripts` mode here; lifecycle-enabled mode at P9 post-M1) · P4.17 **bench locks: cold-start, install (time + RSS)**.

**P5 — parser**: P5.1 lexer · P5.2 parser (JS) · P5.3 TS transforms (strip + enums/const-enum + namespaces + decorators legacy&TC39 + tsconfig paths) · P5.4 JSX (full jsx-config) · P5.5 printer (+fixpoint) · P5.6 sourcemap · P5.7 resolver (incl. CJS/ESM resolution rules) · P5.8 oracle-parser shim + fuzz · P5.9 snapshot parity.

**P6 — bundler**: P6.1 graph · P6.2 tree-shaking · P6.3 splitting · P6.4 CSS · P6.5 HTML · P6.6 determinism lock (double-build byte-compare) · **W2 wire-codec incremental graph cache (content-addressed)** · P6.7 Lane-A bundler activation (plugin/macro/Transpiler/API-`Bun.build` tests → `BLOCKED(P9)`). **M0**: M0.1 `bun-engine/` re-vendor + `engine_api` extraction · M0.2 classes-codegen second emitter · M0.3 seam grep-lock · M0.4 `bun-engine/` test/js-green + startup-noise gate (runs on the seam-extracted-but-still-JSC build, §4.1). **M1 hybrid build (§4.1)**: M1.1 largo-emits-into-workspace mode · M1.2 build.ts fork (codegen + C++ + link absorbed) · M1.3 delegation C-ABI seam + grep-lock · M1.4 LOC-ledger (%-LOGOS ratchet) · M1.5 binary-size ledger baseline · M1.6 lifecycle-script execution over the M1 engine boundary (unblocks P4.10 real-repo mode).

**P7 — engine**: E1 jsint core (values/objects/scopes/functions/exceptions; ropes + atom tables in the string model) · E2 slab heap + nanbox JS profile (BigInt = native BigInt) · E3 GC (mark-sweep, ephemerons, FinalizationRegistry) + observability battery · E4 test262 language/ ratchet · E5 JSC-differential fuzz loop · **T1 logicaffeine_tv residual-equivalence gate (new optimizer passes must pass TV)** · E6 async/generators (frames-in-store) · E7 Proxy/Reflect MOP · E8 RegExp kernel · E9 TypedArrays/detach · E10 Annex B · E11 Intl (ICU4X; size budget on the data) · E12 Temporal (native temporal types) · **E13 Workers + SharedArrayBuffer + Atomics (heap-per-worker, SAB outside heaps, deterministic cross-worker replay)** · **E14 WebAssembly JS API (wasmtime seam)** · E15 structuredClone/transferables · **C1–C5 swamp batteries (CJS↔ESM matrix, error.stack format, nextTick/microtask/setImmediate/timer golden traces, postMessage semantics, AsyncLocalStorage/async_hooks)** · **F1 Proj-1-per-function specialization + `count_dispatch==0` jsint floor** · F2 deopt/invalidation fuzz · F3 shapes/ICs as specializable data · **F4 Proj-2 compiler artifact + wire-codec module cache (W3)** · F5 heap-snapshot startup (W4) · F6 `bun build --native` · F7 Proj-3 regeneration pipeline (semantics-edit → compiler regen, locked) · **F8 EXODIA aarch64 stencils campaign (Apple Silicon JIT tier)** · *optional, benchmark-driven `.lg` replacements (§3.3):* K-RegExp · K-Wasm.

**P8 — test runner / run / shell (test-runner-over-JSC)**: P8.1 expect/matchers · P8.2 snapshots (incl. inline; `normalizeBunSnapshot` parity) · P8.3 hooks/each/concurrent · P8.4 reporters (junit) · P8.5 shell · P8.6 run/bunx + workspace `--filter`/`--elide-lines` · P8.7 `--hot`/`--watch` (G10; **bun-parity module replacement pre-flip**, HOTSWAP state-preservation deferred to post-engine) · P8.8 partial-Lane-B activation (harness-satisfied subset).

**P9 — long tail → the Flip**: N1..N64 node modules by coverage-map yield (fs→io_uring, crypto.randomUUID→uuid.lg, node:test→P8 runner) · B1..Bn Bun.* APIs (serve — **lands on G6, severing uws** — file, spawn, `bun:sqlite`, `bun:ffi`, SQL/valkey, …) · P9.1 repl/`-e`/`--print`/stdin exec · P9.2 plugin host + macros + `Bun.Transpiler` + API-`Bun.build` (unblocks the P6 `BLOCKED(P9)` rows) · P9.3 bake dev-server/SSR + HTML imports (HMR composed with HOTSWAP, once on the LOGOS engine) · P9.4 **SH-1 self-hosting gate** (harness+runner under logos-bun; Lane-A greens re-proven in Lane B) · P9.5 **win-matrix** (`ledger/win-matrix.tsv`, workload-class rows) · L1 Lane-C grind (**6-platform ledger split; per-platform race-to-green**) · **ST1 leak lane + LeakSan integration** · **ST2 Bun.build×2000 leak bench (their table = oracle floor)** · **ST3 Miri/ASAN CI on kernels + `unsafe`-count downward ratchet** · **S2 ML-DSA signing + provenance (`bun pm attest`)** · **S3 hybrid-PQ transport (X-Wing) where the registry negotiates it** · M5.1 NAPI · M5.2 v8-shim · M5.3 inspector · M5.4 per-workload-class flips · M5.5 **JSC removal — delete `bun-engine/` (binary-size ledger proves the shrink)** · P9.x Windows x64+arm64 (windows-shim counterpart) + macOS codesign/entitlements parity.

**P10 — closeout**: every bench suite locked or budgeted · **X1 `.lg` interop (`bun run main.lg`, JS↔LOGOS imports)** · **X2 largo-registry two-way door (`logos:` deps, dual publish)** · **X3 `bun test --mutate`** · **X4 lossless-JSON mode** · **X5 CRDT team cache** · X6 `--replay-seed` ledgered · migration-hook batteries all green.

---

## 11. Session-zero checklist (what to do first, next session)

1. User creates `/home/tristen/logos-bun` (git init + remotes — user-driven).
2. **User creates the gift fork** (GIFT.1, user-driven):
   `gh repo fork oven-sh/bun --clone=false` (lands at `TristenHarr/bun`), then
   on the existing `bun/` checkout: `git remote rename origin upstream &&
   git remote add origin git@github.com:TristenHarr/bun.git`. Fork-main stays
   a fast-forward mirror forever (§9.4).
3. Move this file there; write `SPEC_PIN.md` (record `bun/` checkout commit) and `TOOLCHAIN_PIN.md`.
4. P0.1 RED: `red/p0/binary-name.test.mjs` fails (no Largo.toml yet). Make it green.
5. GIFT.2 lands with P0 (ledger + templates exist before the first fuzz lane does).
6. Proceed down §10 in order; P3/G-tasks may run as a parallel stream in logicaffeine.
7. Open decisions, user-level:
   - **Distribution posture** (not blocking early phases): the public name of
     the shipped binary. Engineering assumes drop-in compatibility either way.
   - **License clearance for gifts** (blocks GIFT.4, not P0–P3): logos-bun/
     logicaffeine are BSL, bun is MIT — confirm oven-sh/bun's contributor
     terms (CLA/DCO) and that gift code is clean-room MIT-compatible with
     nothing derived from BSL sources (§9.4 invariant 13). Must be resolved
     before the first gift PR, not before writing logos-bun code.

*The ratchet is law. The spec already exists. Everything is differential. Bake the bun.*
