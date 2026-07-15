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

## Acceptance records

To be completed at C11:

- [ ] Browser assertion page (`ui/tests/tests.html`) run record
- [ ] UI-A manual checklist result (owner sign-off)
- [ ] Final branch verification record
