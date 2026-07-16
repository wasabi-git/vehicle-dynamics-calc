# UI.md — Part 6 living document (v0.1 interface)

> Baseline (B1, data-hygiene commit): `93875fa80df0f770fc20c20b617a4ce28a135c53`
> Part 6 builds on B1. Engine, data, schemas, and tools are frozen for this
> branch, with exactly one owner-approved deviation: the read-only
> `convertUnitValue` engine API (C9R3a, recorded in the register below).
> The UI consumes the engine strictly through its public API.

## Architecture summary

- **Stack (D26/T1)**: zero-dependency vanilla ES Modules, no build step.
  Entry point is the repository-root `index.html`. Layout L2: responsive
  dual column, collapsing to a single column at the only approved
  breakpoint, 900px.
- **Metadata plan B (D27)**: `cachingReadText` fetches every catalog path
  exactly once. The same raw JSON text feeds `createEngine(readText)` and,
  in parallel, the adapter's own `JSON.parse` copy, which is recursively
  frozen. The UI reads metadata only from that frozen copy through the
  adapter indexes: `variablesById / unitsById / formulasById / modelsById /
  modelGroupsById / recommendationsById / sourcesById / engineConfig`.
  Engine internals (`engine.data / engine.pool / engine.unitSystem`) are
  never touched.
- **Formula rendering (D28/M3)**: two layers. The parser
  (`ui/adapter/formula_format.mjs`) is pure JS and returns a safe render
  tree of plain objects; it never touches `document`, `HTMLElement`, or
  `innerHTML`. The renderer (`ui/render/formula*.mjs`) converts the safe
  tree to DOM with `textContent` only. Any unsupported token causes a
  whole-expression fallback (`{type: "fallback", text}`) rendered as an
  escaped monospace block (M1).
- **Acceptance (D29/V-A)**: Node logic gate `node ui/tests/run.js` on every
  commit from C3 onward, plus the browser manual assertion page
  `ui/tests/tests.html`, plus the UI-A manual checklist (recorded here at
  C11).
- **Visual system (D30)**: every visual parameter converges in
  `ui/tokens.css`. `ui/app.css` references tokens only; structural layout
  values (grid, fr, percentages, flex) are the sole exception. The C10
  polish pass may change token values only.
- **Copyright and privacy (D31)**: no font files, no third-party assets, no
  `@font-face`; icons are Unicode characters or self-drawn inline SVG only;
  demo values restricted to the approved whitelist; attribution only in the
  README author field.

## File map

```text
index.html                       root entry (product page)
ui/tokens.css                    visual parameter single source
ui/app.css                       components and layout (complete at C1)
ui/main.mjs                      bootstrap: cachingReadText -> createEngine + adapter -> first frame
ui/adapter/catalog_adapter.mjs   plan-B frozen indexes
ui/adapter/view_model.mjs        Result display objects + deriveLabels
ui/adapter/path_view_model.mjs   path/formula status views (queryTarget, getFormulaStatus)
ui/adapter/warning_presenter.mjs structured warning objects + confirmation eligibility
ui/adapter/source_presenter.mjs  sole outlet for source display fields
ui/adapter/upstream_trace.mjs    recursive upstream-abnormality collection
ui/adapter/formula_format.mjs    restricted LaTeX-subset parser (pure JS, no DOM)
ui/adapter/tire_code.mjs         tire-code parsing + precheck (no pseudo-transaction)
ui/state/store.mjs               UI state store
ui/render/*.mjs                  render layer (self-organized; responsibilities in file headers)
ui/tests/run.js                  Node gate runner
ui/tests/test_*.mjs              Node gate cases
ui/tests/tests.html              browser manual assertion page
docs/UI.md                       this document
```

## Store registry

Core ten:

| Item | Purpose |
|---|---|
| `inputDraftByVariableId` | uncommitted text drafts (`-`, `.`, empty); never reach `setUserInput` |
| `inputSnapshotByResultId` | entered value/unit per user-input result_id; kept for the whole session (incl. retired) |
| `displayUnitByVariableId` | display-only unit selection; never triggers engine calls |
| `confirmedResultIds` | extreme-warning confirmations, keyed by result_id |
| `expandedResultIds` | derivation-detail expansion state |
| `selectedTarget` | current reverse-query target variable |
| `calculationPhase` | idle / ready / calculating / needs_recalc / complete / failed |
| `hasCompletedSolve` | true after the first successful user-triggered solve; persists for the session |
| `uiInputOrder` | stable ordering of input rows as the user added them |
| `lastSolveDiagnostics` | diagnostics of the most recent solve |

Supplementary five:

| Item | Purpose |
|---|---|
| `variableSearchQuery` | Inputs search text |
| `selectedCategory` | Inputs category filter |
| `inputDiagnosticByVariableId` | per-row diagnostics incl. unfinished drafts and invalid rows |
| `pendingConfirmation` | single slot `{kind: clear_all \| remove_input \| use_derived, payload}` |
| `highlightedVariableId` | duplicate-add locate highlight; cleared on timeout |

Component-local ephemeral state (focus, hover, running animations) stays
out of the store and out of the test contract. Any store item beyond these
fifteen must be registered here first.

### calculationPhase decision order (fixed)

1. `calculating` while solve executes;
2. `failed` if the latest solve returned not-ok or engine diagnostics
   contain an error (re-judged when calculation conditions change);
3. before the first completed solve: at least one effective user input
   (submitted, `range_status !== "invalid"`) → `ready`, otherwise `idle`.
   Idle tolerates invalid rows and drafts; diagnostics render per row and
   Calculate stays disabled;
4. after the first completed solve: stale instances or unrecalculated
   computational changes → `needs_recalc`, otherwise `complete`.

Constant and default-assumption instances created at engine startup never
count as "already calculated".

## Deviation register

| ID | Deviation | Status |
|---|---|---|
| D24 (Z1) | Same-model multi-path consistency judgments, the Conflict/Verified mechanism, and their UI are not implemented in v0.1. The corresponding v0.1 clauses of the confirmed product rules are deferred to v0.2 (scope reduction under G9). | Deferred to v0.2 |
| D25 (Z2) | "Switch to derived value" ships as **Remove input and use derived result**: confirmation → `removeUserInput` → dependents go stale → derived value becomes Active only after the user recalculates. This deviates from the original "coexist" wording; registered for v0.2 review. | Registered; revisit in v0.2 |

## Numeric precision

Results and substitution lines: 4 significant figures. SI expansion: 6
significant figures. Internal calculation never uses rounded values.
`ui/tokens.css` carries the authoritative parameters
(`--precision-result`, `--precision-si`); `ui/adapter/view_model.mjs`
holds the same defaults so the Node gate runs without CSS parsing.

## Owner-directed correction series (post-C9, all gated and pushed)

| Commit | Content |
|---|---|
| C9R1 (two commits; the earlier one is mislabeled `ui(C10)` in its message — label correction recorded here, the C10 slot below is the real C10) | Display layer: every user-facing unit renders its registered display_symbol; variable symbols typeset with real subscripts (symbolSpan); underscore-free plain form for native option text |
| C9R2 | Idempotent detail toggling (re-render loop fix) + display boundaries: names/display symbols everywhere, raw engine diagnostics demoted to developer fallback, source notes through the safe formula channel, add-focus |
| C9R3a (engine) | Owner-approved deviation from the frozen-engine clause: public read-only `convertUnitValue` (pure layer-1 delegation); engine gate 117 -> 121 |
| C9R3b | Owner-approved deviation from §7.6 verbatim-range clause and its §9.1 assertion: warning ranges follow the current display unit (≈converted + registered values; whole-line fallback on any failed endpoint; G4 preserved) |
| C9R4 | Add-to-top + search clear + focus; tire quick input as three boxes feeding the unchanged §7.12 pipeline (owner-approved index.html edit) |
| C9R5 / C9R6 / C9R6R1 / C9R6R2 | Picker direct entry with unit selector; per-variable silent drafts (uncommitted content survives re-renders and never enters the engine); silent highlight expiry (no auto re-render); dispose() hygiene |
| C9R6R3 / C9R6R4 | Assertion-page presentation (product styling, labeled fixtures, finally-cleanup); draft-persistence regression hardened to a distinguishable value |
| C9R7 / C9R7R1 | Intermediates section keeps its expanded state and carries a section-label title; target-report inline entry, re-keyed to stable path occurrences with single-open semantics |
| C9R8 | The three approved private-reference placeholders are suppressed from rendered sources (exact match only; data untouched) |
| C9R9 | Honest target grouping: Primary results (4) / Derived intermediates (3) / Direct-input only (12), catalog-derived. Registered coverage: 19 options = 7 with a registered output direction + 12 direct-input only; new computable targets are Part 7/v0.2 scope |
| C9R10 | Separator misattribution fix in Other derived results: row + own details form one group (owner-approved app.css structural addition under the separate-approval clause) |
| C9R11 | Owner-proposed change, explicitly requested during UI-A B4 and re-verified by the owner: the single-input remove confirmation moved into the owning input row, next to the clicked Remove button (the bottom slot keeps only the clear-all confirmation) |

Additional register entries:
- Solve-failure status line shows fixed friendly copy; the raw engine diagnostics stay in `lastSolveDiagnostics` as developer fallback (owner-directed; tension with the "show the specific reason" reading of the button-state rules recorded here).
- Owner ruling (risk recalibration): no history migration, no repository rename/visibility change/deletion/force-push. A prior assistant statement that pre-sanitization content had been "removed from commit history" was inaccurate and is corrected here: the B1 data-hygiene commit sanitized the working tree only; earlier commits remain in the public history and were assessed by the owner as non-identity residue. D33R2: the sanitized placeholders remain in public data/tests; UI suppression (C9R8) accepted as the final state.
- Store registry unchanged: exactly the fifteen registered items; no additions were needed through C9R11.
- Render-layer files (self-organized registry): dom_util, inputs_controller, inputs_view, results_controller, results_view, warnings_controller, warnings_view, formula_view, targets_controller, targets_view, derivation_controller, assumptions_controller, assumptions_view.

## Acceptance records (C11)

**Gate terminal state** (every commit ran the full chain; values at C11):
- `python tools/validate_catalog.py --no-write` — pass_with_warnings, F005 standing warning only
- `node engine/tests/run.js` — 121 passed, 0 failed, one-shot gate ALL GREEN
- `node ui/tests/run.js` — 387 passed, 0 failed (16 modules incl. the §11.2 contrast matrix)
- `ui/tests/tests.html` — 50 passed, 0 failed, UI BROWSER PASS (incl. real-view DOM regressions and a zero-window-error observation window; 50 reflects the C9R11 additions at sign-off time)
- G8 scans tree/head/msg/struct — PASS on every commit

**C10 (visual polish)**: owner reviewed the live page and approved with **zero parameter changes** — `ui/tokens.css` ships with its C1 values.

**UI-A manual checklist** (§8 master table + the eight Part 2 §2.8 scenarios —
the package tally says nine; see the count note below):

Owner review batches (interaction/visual coverage — the owner broadly
reviewed each batch on the live page and reported no issues; this is not an
exhaustive per-item owner verification):

| Batch | Scope | Owner sign-off |
|---|---|---|
| B1 | Inputs region: search/category, picker direct entry with units, duplicate locate-highlight, tire three-box, clear-all confirm, display-unit switch | signed 2026-07-16 — owner broadly reviewed, no issue reported |
| B2 | Results: hero card + model rows/switch, stale styling, warning banners + Keep original, misuse adopt/ignore, comparison + use-derived flow, intermediates | signed 2026-07-16 — owner broadly reviewed, no issue reported |
| B3 | Targets and frame: grouped selector, missing rows + inline entry, recommended next, no-result three states, assumptions/constants panels, 900px collapse | signed 2026-07-16 — owner broadly reviewed, no issue reported |
| B4 | Part 2 §2.8 acceptance scenarios (eight) walked end-to-end on the live page | signed 2026-07-16 — owner broadly reviewed, no issue reported; one owner-proposed change applied as C9R11 and re-verified |

**Evidence matrix — §8 master table, row by row** (tiers: full = 必做,
minimal = 最简, n/a per the source text). "Owner review Bn" means the row's
interaction/visual side was covered by that broadly-reviewed batch.
Node = `ui/tests/test_*.mjs` module; engine = `engine/tests` gate;
browser = `ui/tests/tests.html` assertion.

| # | Row (Part 2 lines) | Evidence |
|---|---|---|
| 1 | Search name/symbol/ID (34–41); Chinese-name search n/a | Node test_inputs_controller (search section); owner review B1 |
| 2 | Category browsing (34–42), minimal | Node test_inputs_controller (category filter, constants excluded); owner review B1 |
| 3 | Value + unit, mixed units (44–48) | Node test_inputs_controller (submit + snapshots); engine M1 unit gates; owner review B1 |
| 4 | Single input + duplicate locate-highlight (49–54), minimal | Node test_inputs_controller (duplicate add); browser (focus/one-step entry); owner review B1 |
| 5 | Edit value/unit/delete, conversion keeps the quantity (56–68) | Node test_inputs_controller (re-submit new result_id, G4 zero-side-effect switch, remove flow); owner review B1 |
| 6 | Clear-all + confirm (69–70); manual Calculate/stale (72–78) | Node test_inputs_controller (clear-all), test_results_controller (solve flow); owner review B1/B2 |
| 7 | User value / derived value coexist + comparison (80–94), D25 form | Node test_results_controller (D25 seven steps, promotion only in solve), test_comparison (§7.14); owner review B2 |
| 8 | Four sources (96–103); invalid excluded (105–113); non-blocking warnings (115–121) | engine M2/M3 gates; Node test_store (invalid not effective), test_warning_presenter; owner review B2 |
| 9 | Misuse suggestion trio (123–132) | Node test_misuse_interactions; engine unit-misuse gate; owner review B2 |
| 10 | Tire quick input (134–144), minimal; other shortcuts n/a | Node test_tire_code (syntax/precheck/live-stop/three-box compose); browser; owner review B1 |
| 11 | Constants visible (169–177); never guess parameters (179–192) | Node test_assumptions (constants panel); engine M3 (missing input blocks branch); owner review B3 |
| 12 | Assumptions visible/controllable/displaceable (194–242) | Node test_assumptions (§7.7 five behaviors incl. assumption_disabled routing); owner review B3 |
| 13 | First-calc button semantics (254–259); only affected marked (261–276); stale styling (278–285) | Node test_store (phase order), test_results_controller (exact stale set); owner review B2 |
| 14 | Display switch never recalculates (287–303) | Node G4 assertions (test_inputs_controller, test_warning_presenter ranges); browser (phase unchanged); owner review B1 |
| 15 | Add/remove consequences, Recalculate eight items (305–335) | Node test_results_controller + test_inputs_controller (removal stales consumers); engine M4 gates; owner review B2/B4 |
| 16 | Button six states (337–352), minimal | Node test_results_controller (six-state table incl. friendly failed copy — registered deviation) |
| 17 | Four-tier status (374–383); unit suspected before value judged (413–433); candidate six elements (435–456) | engine conditions/misuse gates; Node test_warning_presenter, test_misuse_interactions; owner review B2 |
| 18 | Confirm-continue without candidates (458–466); confirmation retention flow (468–478) | Node test_warning_presenter (result_id-keyed confirm, natural reset); browser; owner review B2 |
| 19 | Invalid never bypassed, branch-only blocking (480–511); no fabricated results (513–522) | engine M3 gate (invalid blocks dependent branch only); Node test_derivation_view (no-result states); owner review B4 |
| 20 | Abnormality propagates to dependents (524–535) | Node test_upstream_trace (≥2-hop real-engine chain, retired resolution); owner review B2 |
| 21 | Warning seven elements (537–555), minimal | Node test_warning_presenter (structured output fields); owner review B2 |
| 22 | In-place warnings (557–565), minimal (no summary area) | browser (banner placement in rows/cards); owner review B2 |
| 23 | Check timing (567–593); warning refresh (595–602) | engine gates (setUserInput immediate range/misuse); Node test_warning_presenter (new result_id resets); owner review B2 |
| 24 | Sources retained, never overwritten (639–676) | engine M2 gate (sources coexist, replacement in place); owner review B2 |
| 25 | Same-model Conflict/Verified family (697–728, 863–893) | Deferred to v0.2 (D24) — not implemented, registered |
| 26 | Different models side by side + switching (730–758, 895–926) | Node test_results_controller (model section, selectModel, R001 no-fallback, verbatim reminder); owner review B2 |
| 27 | Assumption priority/displacement record (760–786); independence/cycles (788–818) | engine M2 (suppression semantics) + M5 (cycle flag) gates; Node test_assumptions; owner review B3 |
| 28 | Status label set (820–831, 987–1000), minimal; Conflict/Verified excluded (D24) | Node test_view_model (closed eight-label vocabulary); owner review B2 |
| 29 | Three-layer display (940–952); inputs not duplicated into results (954–963, 1119–1134) | Node test_results_controller (layers, inclusion rules); owner review B2 |
| 30 | Ordering (1002–1016), minimal | Node test_results_controller (strong warnings first), test_targets (fixed path ordering, repeatability) |
| 31 | Multi-path display form (1018–1032); unit display / SI expansion (1034–1048) | Node test_view_model (display + 6-sig SI expansion); owner review B2 |
| 32 | Stale display (1050–1060); assumption display (1062–1071); confirmation persists (1073–1079) | Node test_view_model (labels), test_warning_presenter (confirmed stays visible); owner review B2 |
| 33 | No-result three states (1081–1095), verbatim | Node test_derivation_view (three verbatim texts + state machine); owner review B3 |
| 34 | display_role driven + fallback (1181–1208) | Node test_view_model (derived_output fallback), test_results_controller (role-driven layers) |
| 35 | Same graph forward/reverse (1245–1271); eight missing-cause classes (1273–1288) | Node test_path_view_model (ten fixed classes incl. assumption-disabled refinement); owner review B3 |
| 36 | Missing-cause copy per class (1290–1379); reverse ≠ inversion (1381–1410) | Node test_targets (no-direction copy via names), test_path_view_model; owner review B3 |
| 37 | Path scheme display (1412–1446); recursive expansion / depth 5 / cycle stop (1448–1465, 1643–1669) | engine M5 gates (depth, cycle); Node test_path_view_model (recursion views); owner review B3 |
| 38 | Path ordering + top-3 focus (1467–1480); recommended next (1482–1499), minimal | Node test_targets (fewest-missing order, most-frequent recommendation, never pre-filled); owner review B3 |
| 39 | No target -> only key outputs expanded (1501–1511), minimal | Node test_targets (defaultTargets = unmet primary outputs); owner review B3 |
| 40 | Target seven elements (1513–1525); model-path eight elements + reminder (1592–1641) | Node test_targets + test_results_controller (line-1627 verbatim reminder); owner review B3 |
| 41 | Derivations collapsed by default, per-path details, eight levels (1694–1723) | Node test_derivation_view (eight levels, per-path independence); browser (expand stability); owner review B2 |
| 42 | Summary in engineering language (1725–1735), minimal | Node test_derivation_view (sentence names inputs, no formula numbers) |
| 43 | Formula / substitution / conversion display (1737–1806) | Node test_formula_format (8/8 fixtures, malicious fallback), test_derivation_view (snapshot-reconstructed conversion rows); owner review B2 |
| 44 | Assumptions/constants/intermediates (1808–1863); multi-path/model annotation (1865–1960) | Node test_derivation_view (levels 5–6), test_results_controller (model sections); owner review B2 |
| 45 | Stale/invalid-path/reverse display without fabrication (1962–2033) | Node test_derivation_view (stale detail, superseded rows); engine gates; owner review B4 |
| 46 | Chain form (2035–2052), minimal; traceable / no code internals (2054–2083) | browser (rail step list DOM); formula-path anchors are registered catalog ids (registered decision); owner review B2 |
| 47 | Rounding never flows back (2085–2093) | Node test_view_model (display-only formatting), test_comparison (unrounded subtraction, last-step formatting) |
| 48 | Part 2 §2.8 acceptance scenarios (2462–2549) — eight in the cited range | owner review B4 (end-to-end walkthrough) |
| 49 | Not-doing guardrails (2.1 十 / 2.5 二十一 / 2.7 二十五 / 2.8 二十四) | Guardrail respected: none of the listed features exist in the branch; owner review B1–B4 raised none |

Scenario-count note: the work package cites "nine acceptance scenarios" for the
Part 2 §2.8 range; the cited range contains eight scenario sections (十六–二十三,
the separately-listed "not-doing" list and completion standard excluded). B4
covered the full cited range; the count difference is a package-side tally slip
recorded here for the reviewer.

**GitHub Pages**: enabled by the owner (settings untouched by the implementation
session, per the deployment boundary); root page, catalog fetch, module and
assertion-page URLs verified 200 by both sides on 2026-07-16.

- [ ] Final branch verification record (reviewer re-run, §9.4)
