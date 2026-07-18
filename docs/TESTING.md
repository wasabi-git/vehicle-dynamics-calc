# TESTING.md — Part 8 living document (system testing and validation)

> Part 8 builds on the Part 6 closure baseline recorded below. Engine, data,
> schemas, and tools stay frozen. UI product code is frozen with exactly one
> owner-approved change in this branch: U1, the satisfied-conditions display
> on target paths (Part 2 S3.4). All Part 8 system tests live under
> `validation/system/`; the existing `ui/tests/` suite stays frozen except
> the three U1 regression files.

## Baseline (six fields, verbatim from the approved Part 8 work package)

```text
Part 8 基线 full SHA:      8d23e48f6d6c316885a1d8f5293de9e68c924d4a
Part 8 基线 short SHA:     8d23e48        （= Part 6 收口 C11R4；净树；与 origin/main 及 ls-remote 一致）
B1（数据卫生基线）:         93875fa80df0f770fc20c20b617a4ce28a135c53
sha256(patterns.txt):      b1fe82c51392fcd8179fdbcffd7c6776aa59ed5dab1965221459ecde55f7bf15
sha256(g8_exceptions.txt): 4875f5ef4e77719bb48fe8d6a7f181bda03693a06e6da15aa6ef948187ed1298
sha256(g8_scan.sh):        e9806b3e95804f97b06f7b26410d2b854c66c85de6ca0f8c5262efe0282ddbfd
```

Kickoff preflight (work-package §5.0, 2026-07-17): all sixteen checks green —
package self-hash match; branch, clean-tree, HEAD, and remote identity;
tooling and GNU `timeout` present; governance-file hashes 3/3; validator
`pass_with_warnings` with the single standing F005 warning; engine gate
121/121 ALL GREEN; UI gate 387/387; G8 struct and tree scans PASS; clean
tree at exit.

## Plan — commit sequence

| Commit | Content | Files touched |
|---|---|---|
| T1 | System plan (this document) + Pages content-fingerprint verifier | `docs/TESTING.md`, `validation/system/pages_check.sh` |
| U1 | Satisfied-conditions display on target paths (Part 2 S3.4, owner-approved product change) + public regression tests | `ui/adapter/path_view_model.mjs`, `ui/render/targets_controller.mjs`, `ui/render/targets_view.mjs`, `ui/tests/test_path_view_model.mjs`, `ui/tests/test_targets.mjs`, `ui/tests/tests.html` |
| T2 | System runner + real-module harness + consistency and payload gates | `validation/system/run.js`, `validation/system/harness.mjs`, `validation/system/sys_consistency.mjs`, `validation/system/sys_payload.mjs` |
| T3 | Eight-scenario mechanization + 49-checkpoint manifest closure | `validation/system/checkpoints.mjs`, `validation/system/sys_scenarios.mjs`, `validation/system/run.js` |
| T4 | Bootstrap degradation and system error paths | `validation/system/sys_degradation.mjs`, `validation/system/run.js` |
| T5 | Browser system assertion page | `validation/system/system.html` |
| R8-1 | Duplicate checkpoint-id registrations fail coverage closure on both sides (owner-approved fix, ruling D65) | `validation/system/harness.mjs`, `validation/system/run.js`, `validation/system/system.html` |
| T6 | Evidence recording (this document) + README testing entry | `docs/TESTING.md`, `README.md` |
| T7 | Final verification record + roadmap advance — executed only after the reviewer's §9.4 PASS and owner approval | `docs/TESTING.md`, `README.md` |

Per-commit gate chain (fixed seventeen-step order): construction → porcelain
status check against the commit's exact file set → `python
tools/validate_catalog.py --no-write` → `node engine/tests/run.js` → `node
ui/tests/run.js` → `node validation/system/run.js` (from T2 on; skipped for
the T1 and U1 trees) → G8 tree scan → exact-path `git add` → `git diff
--cached --check` → staged name-only match against the same file set → G8
struct scan → commit → G8 head, msg, and struct scans → clean-tree check →
`git push` wrapped in a 300-second timeout. Every network command carries a
single-attempt time limit (curl `--connect-timeout 10 --max-time 60`; gh and
`git ls-remote` wrapped in a 60-second GNU `timeout`).

Per-push Pages discipline: before every push, a read-only status probe of
the leftover queued Actions run (watch item below); after every push,
deployment-identity verification — the Pages workflow run for exactly the
pushed HEAD must complete successfully, and the latest Pages build must
report that HEAD as its commit — followed by content fingerprints of the
changed paths via `sh validation/system/pages_check.sh` (an unchanged file's
stable hash is never taken as deployment proof). The closure fingerprint set
(31 paths) additionally runs after the T6 and T7 pushes.

## Frozen count baselines

Engine gate 121; acceptance reconciliation 23/23 enforced; catalog counts
20/8/3/8/1/3/27 (variables, formulas, model groups, models, recommendations,
sources, units); dependency graph 28 nodes, 34 edges, maximum formula depth
3; reverse-search limit 5. Any drift stops the branch.

Pre-U1 interface baselines: Node gate 387 assertions (16 modules); browser
assertion page 50 assertions; startup payload 42 files, 328,502 bytes (sum
of HEAD blob sizes). U1 re-pins these three values as N₁/B₁/P₁ below; after
U1 any drift in the re-pinned values stops the branch.

## U1 re-pinned baselines (measured at U1, recorded here at T6)

| Value | Meaning | Result |
|---|---|---|
| N₁ | `node ui/tests/run.js` passing count after U1 | **397** (397 passed, 0 failed; measured inside U1 construction, 2026-07-17) |
| B₁ | `ui/tests/tests.html` passing count after U1 | **53** (53 passed, 0 failed, UI BROWSER PASS; measured inside U1 construction) |
| P₁ | startup payload byte total after U1 (sum of the 42 HEAD blob sizes; file list and count unchanged) | **330,250 bytes** (42 files; measured after the U1 commit and before its push, re-derived identically by `sys_payload.mjs` at T2) |

## Coverage manifest — 49 checkpoints

Channels: N = Node scenario suite (`sys_scenarios.mjs`); B = browser system
page (`system.html`); A = existing-gate cross-reference (not counted for
closure). The runner enforces N-set identity (all 49) from T3 on; the
browser page enforces B-set identity (the 32 rows marked B). Evidence cells
were filled at T6: "N green" means the row's labeled assertions passed in
the Node system gate (104 passed, 0 failed; coverage closure 49/49), which
runs at every applicable commit gate (step 6, from the T2 tree on);
"B green" means they passed on the browser system page (41 passed, 0
failed; B-set closure 32/32), which was run in the four T6 matrix
environments below. The cells record the T6-time terminal state,
2026-07-17.

| ID | Checkpoint (Part 2 lines) | Channels | Recipe | Evidence |
|---|---|---|---|---|
| S1.1 | Compute currently available results (2462–2470) | N+B | R-S1 | N green; B green |
| S1.2 | Show the primary result | N+B | R-S1 | N green; B green |
| S1.3 | Show other derived results | N+B | R-S1 | N green; B green |
| S1.4 | Collapse intermediate results | N+B | R-S1 | N green; B green |
| S1.5 | Expanded view shows formula, substitution, conversion, sources, assumptions | N+B | R-S1 | N green; B green |
| S2.1 | Compute the computable partial results (2472–2480) | N | R-S2 | N green |
| S2.2 | Show missing conditions for important targets | N+B | R-S2 | N green; B green |
| S2.3 | Explain what is missing per path scheme | N+B+A (ui: test_path_view_model) | R-S2 | N green; B green |
| S2.4 | Recommend the next input | N+A (ui: test_targets) | R-S2 | N green |
| S2.5 | Invalid / assumption-off never shown as plain Missing (missing-cause key-set identity, no Conflict class, D24) | N | R-S2/S5/S7 | N green |
| S3.1 | Show the target variable (2482–2492) | N+B | R-S3 | N green; B green |
| S3.2 | List feasible paths in reverse | N+B+A (engine: test_reverse) | R-S3 | N green; B green |
| S3.3 | Show each path's required conditions | N+B | R-S3 | N green; B green |
| S3.4 | Show already-satisfied conditions (U1 real product output: satisfiedInputs field + `.path-satisfied` row) | N+B+A (ui: U1 regression group) | R-S3 | N green; B green |
| S3.5 | Show missing conditions | N+B | R-S3 | N green; B green |
| S3.6 | Mark different physical-model paths | N+B | R-S3 | N green; B green |
| S3.7 | No fabricated numeric results | N | R-S3 | N green |
| S4.1 | Warn first of probable unit misuse (2494–2503) | N+B+A (engine: test_unit_misuse) | R-S4 | N green; B green |
| S4.2 | Show the recommended unit | N+B | R-S4 | N green; B green |
| S4.3 | Show the physical meaning under the recommended unit | N+B | R-S4 | N green; B green |
| S4.4 | Never auto-modify the unit | N+A (ui: test_inputs_controller G4) | R-S4 | N green |
| S4.5 | Accepting marks dependents needs-recalculation | N+B | R-S4 branch b | N green; B green |
| S4.6 | Keeping the original value keeps the warning | N+B | R-S4 branch a | N green; B green |
| S5.1 | Mark the value invalid (2505–2513) | N+B | R-S5 | N green; B green |
| S5.2 | Invalid value never participates in calculation | N+A (engine: invalid blocking) | R-S5 | N green |
| S5.3 | Block only dependent branches | N | R-S5 | N green |
| S5.4 | Independent branches keep calculating | N+B | R-S5 | N green; B green |
| S5.5 | Missing-conditions area says Invalid, not Missing | N+B | R-S5 | N green; B green |
| S6.1 | Keep the user input value (2515–2526) | N | R-S6a | N green |
| S6.2 | Keep the derived value | N | R-S6a | N green |
| S6.3 | User input Active by default | N+A (engine: user-input default Active) | R-S6a | N green |
| S6.4 | Derived value serves as a check | N+B | R-S6a | N green; B green |
| S6.5 | Show the absolute difference | N+B+A (ui: test_comparison) | R-S6a | N green; B green |
| S6.6 | Show the percentage difference | N+B | R-S6a | N green; B green |
| S6.7 | No silent overwrite of user input | N | R-S6a | N green |
| S6.8 | Use derived value → pending recalculation (D25 seven steps; full-chain fixture with the real dependent going stale) | N+B+A (ui: test_results_controller D25) | R-S6b | N green; B green |
| S7.1 | Normal calculation with assumptions (2528–2537) | N | R-S7 | N green |
| S7.2 | Show "Uses assumptions" | N+B | R-S7 | N green; B green |
| S7.3 | Expanded view lists the specific assumptions | N+B | R-S7 | N green; B green |
| S7.4 | Show source Assumed | N+B | R-S7 | N green; B green |
| S7.5 | Disabling an assumption → missing-conditions state | N+B | R-S7 | N green; B green |
| S7.6 | Real value displaces the assumption | N+A (engine: displacement/suppression semantics) | R-S7 | N green |
| S8.1 | Find affected results (2539–2549) | N | R-S8a | N green |
| S8.2 | Mark Needs recalculation | N+B | R-S8a | N green; B green |
| S8.3 | Keep old values for reference | N+B | R-S8a | N green; B green |
| S8.4 | Stale results never feed later calculation | N+A (engine: test_stale) | R-S8a | N green |
| S8.5 | Unaffected results stay valid | N | R-S8a | N green |
| S8.6 | Recalculate updates results and derivations | N+B | R-S8a | N green; B green |
| S8.7 | Recalc cannot reproduce the result → moved out and explained as missing conditions | N | R-S8b | N green |

## Recipe correspondence (work-package §7.1)

Common input group CHAIN = `engine_torque` 310 foot_pound_force;
`engine_speed` 4800 revolution_per_minute; `combined_gear_ratio` 8.0
decimal; `drivetrain_efficiency` 0.90 decimal; `wheel_radius` 0.311 meter;
`vehicle_weight` 3500 pound_force. Every recipe and every branch runs on its
own fresh app fixture (real engine + adapter + store, no test doubles);
every assertion label starts with its checkpoint ID and registers coverage
with the manifest.

| Recipe | Fixture | Checkpoints |
|---|---|---|
| R-S1 | CHAIN → solve | S1.1–S1.5 |
| R-S2 | CHAIN minus `wheel_radius` → solve; partial-result exact set {engine_power, mass_factor, vehicle_mass} | S2.1–S2.5 (S2.5 jointly with R-S5/R-S7) |
| R-S3 | fresh app with `engine_torque` 310 + `engine_speed` 4800 only → target query for longitudinal_acceleration | S3.1–S3.7 |
| R-S4 | CHAIN with `wheel_radius` 13.8 foot (misuse fixture) → solve; branch a keeps the value, branch b adopts the suggestion | S4.1–S4.6 |
| R-S5 | `drivetrain_efficiency` 1.2 (invalid) + 310 / 4800 / 8.0 / 0.311 → solve | S5.1–S5.5 |
| R-S6a | CHAIN + tire code 195/55R16 → solve; display-unit comparison on `wheel_radius` | S6.1–S6.7 |
| R-S6b | full CHAIN → solve → user `vehicle_mass` 3500 pound_mass → solve → use-derived seven-step flow (D25) | S6.8 |
| R-S7 | CHAIN → solve; disable the `road_grade_angle` assumption; then real value 8.0 degree | S7.1–S7.6 |
| R-S8a | CHAIN → solve → re-enter `vehicle_weight` 3575 | S8.1–S8.6 |
| R-S8b | CHAIN → solve → remove `wheel_radius` + confirm → solve | S8.7 |

## Release cycle log (per push; T1–T5, U1, and R8-1 recorded at T6, T6 recorded at T7)

The eight completed push cycles below (T1, U1, T2–T5, R8-1, T6) all
pushed on 2026-07-17; the T6 row was recorded at T7. Only the T7 cycle
itself remains in the closure report, outside the repository.
"queued / queued" is the leftover-run probe before and after the push;
deployment identity means the Pages workflow run for exactly the pushed
commit reached completed success and the latest Pages build reported that
commit.

| Cycle | Pre/post probe | Deployment identity | Changed-path fingerprints | Notes |
|---|---|---|---|---|
| T1 (c1e9d92) | queued / queued | success; built c1e9d92 | 2/2 PASS | |
| U1 (16d2b6e) | queued / queued | success; built 16d2b6e | 6/6 PASS | |
| T2 (0269a6a) | queued / queued | success; built 0269a6a | 4/4 PASS | |
| T3 (c41a2cd) | queued / queued | success; built c41a2cd | 3/3 PASS | |
| T4 (7cef8ca) | queued / queued | success; built 7cef8ca | 2/2 PASS | |
| T5 (c4235d5) | queued / queued | success; built c4235d5 | 1/1 PASS | |
| R8-1 (e0ea84d) | queued / queued | success; built e0ea84d | 3/3 PASS | owner-approved fix (register below) |
| T6 (fda1da0) | queued / queued | success; built fda1da0 | 2/2 PASS | closure set additionally, see below |
| T7 | closure report | closure report | closure report | recorded in the closure report, not in the repository |

After the T6 push, the §7.6 closure fingerprint set ran against the
deployed site: all 31 paths matched their HEAD blobs byte for byte
(31/31 PASS) at commit fda1da0. The T7 cycle itself is recorded in the
closure report, outside the repository.

## Leftover Actions run (read-only watch item)

Actions run 29540514903 (an incident-period leftover on the Pages
build-and-deployment workflow; head commit bfc9418): status observed
`queued` at T1 construction time, 2026-07-17, and `queued` again on all
seventeen read-only probes recorded in this repository — sixteen
push-cycle probes (one before and one after each of the eight pushes: T1,
U1, T2–T5, R8-1, T6) plus one pre-matrix probe at T6; the T7 cycle's own
pre/post probes are recorded in the closure report, outside the
repository. Discipline: probed read-only before and after every push. Still `queued`, or gone/recycled → proceed
(deployment-identity verification is mandatory regardless); any transition
to `in_progress` or another state → stop and report. Never rerun, never
request builds, never touch Pages or Actions configuration.

## Environment facts (tool names and versions only)

Git Bash with GNU coreutils 8.32 (`timeout`, `sha256sum`); node v24.18.0;
Python 3.11.9; gh 2.96.0; curl 8.14.1. Browsers (exact product versions,
read from the installed binaries at T6): Chrome 150.0.7871.128, Edge
150.0.4078.65, Firefox 149.0; the online environment is the public GitHub
Pages site.

## Deviation and correction register

- **D65 bounded exception (owner ruling, 2026-07-17).** During early Part 8
  execution, one broad wildcard file listing over the validation tree run
  by the execution session also surfaced file names from its private,
  excluded areas; the execution session reported that it read no file
  contents, and no such contents have been found entering any public
  artifact. The owner ruled this a one-time bounded exception: the T1–T5
  commits stand unchanged, and from the ruling on the execution session may
  access only the validation paths explicitly allowlisted in the work
  package — any further wildcard, recursive, or broad enumeration there
  stops the work and ends the session. Recorded here in generalized wording
  per the same ruling.
- **R8-1 (owner-approved fix under D65, commit e0ea84d).** Duplicate
  checkpoint-id registrations now fail coverage closure explicitly on both
  sides: the Node collector records second registrations and the runner
  fails on them; the browser page detects both B-manifest duplicates and
  cover-call duplicates inside its single closure assertion. With no
  duplicates the measured counts stay 104 (Node) and 41 (browser). Proven
  with read-only negative examples on both sides, including the masquerade
  case (full 49-id coverage plus one duplicate still fails).

## Acceptance records

**SB1 (owner batch, after T5, before T6 construction)** — signed 2026-07-17:
the owner broadly reviewed the system page, the mechanical suite results,
the U1 satisfied row on the live page, and the three re-pinned values;
no issue reported. The R8-1 fix (register above) was owner-approved and
landed before the sign-off.

**SB2 (owner batch, during T6 construction, before the T6 commit)** —
signed 2026-07-17: the owner broadly reviewed the four-environment matrix
evidence and the README diff preview; no issue reported. One reviewer round
(D67) landed before the sign-off: the Firefox external-console observation
was re-taken with a validated stdout-echo observer and five documentation
wordings were corrected; the sign-off covers the corrected state.

Owner-review evidence is always recorded as "broadly reviewed, no issue
reported" — never as exhaustive per-item verification.

**Browser matrix (four fixed environments, executed and recorded during T6
construction, 2026-07-17)**. Before the matrix, the same-day deployment
identity check passed for the current commit (e0ea84d: workflow completed
success; latest Pages build reported it) and the three-path load-surface
fingerprint (root page, tests page, system page) passed. Local cells were
served from the clean working tree equal to that commit; online cells from
the byte-verified Pages deployment.

| Environment | tests.html | system.html | Bootstrap console (external observation) |
|---|---|---|---|
| Local Chrome 150.0.7871.128 (headed, driven) | 53 passed, 0 failed — UI BROWSER PASS | 41 passed, 0 failed — SYSTEM BROWSER PASS | console read across the full system-page run incl. the bootstrap frame: zero errors |
| Local Edge 150.0.4078.65 (headless run) | 53 passed, 0 failed — UI BROWSER PASS | 41 passed, 0 failed — SYSTEM BROWSER PASS | stderr console capture: zero page-source error or warning lines |
| Local Firefox 149.0 (headed run) | 53 passed, 0 failed — UI BROWSER PASS | 41 passed, 0 failed — SYSTEM BROWSER PASS | dedicated system-page re-run under the browser's stdout console echo (clean profile; observer first validated with a positive control that echoes both log and error lines): zero page-content console lines across the full run incl. the bootstrap frame, same-session terminal state 41 passed, 0 failed; stderr carried only browser-internal Windows-integration noise, no page content |
| Pages online, Chrome 150.0.7871.128 | 53 passed, 0 failed — UI BROWSER PASS | 41 passed, 0 failed — SYSTEM BROWSER PASS | console read: zero errors |

**System suite measured counts** (terminal state at the R8-1 tree,
2026-07-17): Node runner — `system tests: 104 passed, 0 failed`, coverage
closure 49/49; browser system page — `system assertions: 41 passed, 0
failed`, B-set closure 32/32.

## Final verification (§9.4)

- [x] Final branch verification record (reviewer re-run, §9.4): PASS —
  independent reviewer terminal verification, 2026-07-17, across the full
  §9.4 scope: per-tree re-runs of the gate commands over the Part 8 commits
  (T1, U1, T2–T6, R8-1 included; the system gate from the T2 tree on); the
  post-T6 HEAD baseline taken independently via ls-remote and matched
  against the execution session's reported closure value (fda1da0);
  independent deployment-identity verification and the 31-path closure
  fingerprint set; 49/49 and 32/32 closure confirmed; the completion and
  delivery standard cross-references checked; the three re-pinned values
  re-measured (N₁ 397, B₁ 53, P₁ 330,250 bytes); TESTING.md wording and
  evidence-strength audit passed; and both private validations PASS
  (reviewer evidence archived privately). The owner approved T7 on that
  verdict, 2026-07-17.
