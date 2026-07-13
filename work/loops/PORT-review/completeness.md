# PORT docs — completeness review — VERDICT: NOT freeze-ready, add H1-H4+M1/M2 first

## HIGH (block P2/P4/P5 day one)
- **H1 Ordering (3-way cmp)**: semver Version.rs:419-459 `order_without_tag → Ordering` ladder +
  `match Ordering`; SemverRange.rs:256. Neither doc names Ordering/cmp/partial_cmp. → add a
  `## An Ordering is one of: Less/Equal/Greater` rendering + Inspect; fuzz = total-order axioms.
- **H2 no usable `sort`** (QUICKGUIDE:137 proposed): install picks max-satisfying by sorting
  (Version.rs:106 sort_gt). **TOOLCHAIN GAP → G-task**: a ported semver must hand-write
  selection sort via Repeat+If+swap+H1, OR LOGOS gets a real sort primitive (upstream).
- **H3 install concurrency ABSENT**: PackageManager.rs:27 ThreadPool/UnboundedQueue, :394 Batch,
  :18 MiniEventLoop, 15× AtomicU32/AtomicBool (NOT async/tokio). LOGOS has only actor+CRDT
  Shared — **NO atomic-shared-counter analog** (value-COW fights it). **TOOLCHAIN GAP → G-task**:
  the pending_task_count/finished_installing pattern needs upstream LOGOS concurrency primitives.
- **H4 labeled break / no Continue**: glob/matcher.rs:188 `'main_loop: while`, continue/break
  'label, break-with-value. LOGOS Break=innermost-only, NO Continue, no labeled/value break.
  → glob matcher needs structural rewrite (flag threading), not transliteration.

## MED
- M1 `matches!(x, A|B|C)` (ini 5×, json 16×) → Inspect/If-chain.
- M2 match OR-patterns + guards + `0x30..=0x37` ranges (json.rs:555/627, lexer.rs:688) — THE
  lexer shape (P5). → `is between` / If-chains. Load-bearing for P5.
- M3 leaf crates = FFI over simdutf C++ (base64/lib.rs:1 `bun_simdutf_sys`) → REIMPLEMENT the
  algorithm in LOGOS (Word8 6-bit tables), don't transliterate. base64 = the P2 worked example.
- M4 lockfile byte-serialization > discriminant: Buffers.rs:191 bytemuck::Pod, _padding fields,
  Aligner padding, 0xDEADBEEF prefix → explicit to_bytes; fuzz = bun.lockb round-trip byte-exact.
- M5 SHA-512 SRI integrity (integrity.rs, npm.rs:679 `sha512-`+base64) → LOGOS crypto stdlib +
  verify-before-extract Check-that gate.

## LOW: L1 Cow→owned; L2 hand-written Ord=H1; L3 bitflags (none in P2/P4/P5, out of scope).

## TSV fuzz-focus actionability: 14/17 give a writable generator; TRAP-11/12/13 are AUDIT-shaped
(mislabeled as fuzz-focus) — 12/13 need a build-mode differential HARNESS, not a corpus fuzzer.

## Most important missing thing: H1+H2 (Ordering + no sort) — semver is literally the first P2
leaf crate + the install resolver backbone; a porter cannot render Version.rs:419 or pick the
max satisfying version with the current docs.

## → FIXER: add H1-H4 + M1/M2 to the docs; record H2+H3 as G-task candidates (toolchain gaps).
