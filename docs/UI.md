# UI.md — Part 6 living document (v0.1 interface)

> Baseline (B1, data-hygiene commit): `93875fa80df0f770fc20c20b617a4ce28a135c53`
> Part 6 builds on B1. Engine, data, schemas, and tools are byte-frozen for this
> branch; the UI consumes the engine strictly through its public API.

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

Additional register entries:
- Solve-failure status line shows fixed friendly copy; the raw engine diagnostics stay in `lastSolveDiagnostics` as developer fallback (owner-directed; tension with the "show the specific reason" reading of the button-state rules recorded here).
- Owner ruling (risk recalibration): no history migration, no repository rename/visibility change/deletion/force-push. A prior assistant statement that pre-sanitization content had been "removed from commit history" was inaccurate and is corrected here: the B1 data-hygiene commit sanitized the working tree only; earlier commits remain in the public history and were assessed by the owner as non-identity residue. D33R2: the sanitized placeholders remain in public data/tests; UI suppression (C9R8) accepted as the final state.
- Store registry unchanged: exactly the fifteen registered items; no additions were needed through C9R10.
- Render-layer files (self-organized registry): dom_util, inputs_controller, inputs_view, results_controller, results_view, warnings_controller, warnings_view, formula_view, targets_controller, targets_view, derivation_controller, assumptions_controller, assumptions_view.

## Acceptance records (C11)

**Gate terminal state** (every commit ran the full chain; values at C11):
- `python tools/validate_catalog.py --no-write` — pass_with_warnings, F005 standing warning only
- `node engine/tests/run.js` — 121 passed, 0 failed, one-shot gate ALL GREEN
- `node ui/tests/run.js` — 387 passed, 0 failed (14 modules incl. the §11.2 contrast matrix)
- `ui/tests/tests.html` — 48 passed, 0 failed, UI BROWSER PASS (incl. real-view DOM regressions and a zero-window-error observation window)
- G8 scans tree/head/msg/struct — PASS on every commit

**C10 (visual polish)**: owner reviewed the live page and approved with **zero parameter changes** — `ui/tokens.css` ships with its C1 values.

**UI-A manual checklist** (§8 master table + the nine Part 2 §2.8 scenarios):
- Mechanically verified rows are evidenced by the automated gates above (state machine, labels, ordering, precision, conversion tracks incl. G4, misuse flows, confirmation keying, D25 promotion-only-in-solve, source presenter closure, formula parsing incl. malicious fallback, contrast matrix, tire-code pipeline, range-display rules).
- Owner-observation rows (interaction/visual) are signed in short batches; the sign-off record follows below.

| Batch | Scope | Owner sign-off |
|---|---|---|
| B1 | Inputs region: search/category, picker direct entry with units, duplicate locate-highlight, tire three-box, clear-all confirm, display-unit switch | pending |
| B2 | Results: hero card + model rows/switch, stale styling, warning banners + Keep original, misuse adopt/ignore, comparison + use-derived flow, intermediates | pending |
| B3 | Targets and frame: grouped selector, missing rows + inline entry, recommended next, no-result three states, assumptions/constants panels, 900px collapse | pending |
| B4 | Part 2 §2.8 nine acceptance scenarios walked on the live page | pending |

- [ ] Final branch verification record (reviewer re-run, §9.4)
