# ENGINE.md — v0.1 Core Derivation Engine (API & Semantics)

Zero-dependency ES modules; runs in Node (tests) and the browser (fetch reader).
One-shot gate: `node engine/tests/run.js`. Browser smoke: serve the repo root and open `/engine/smoke.html`.

## Modules

| Module | Responsibility |
|---|---|
| `loader.mjs` | Catalog-driven loading (entry `data/catalog.meta.json`, roles resolved from its registration — no directory enumeration, no hardcoded version file names). Defensive validation: malformed input yields structured diagnostics `{severity, code, file, path, message}`, never a throw. Refuses to load if `allow_automatic_algebraic_inversion` is not `false`. |
| `units.mjs` | Three-layer unit system. L1 base converter: any two registered same-dimension units via SI; cross-dimension/unknown → diagnostics. L2 variable-facing: additionally enforces `allowed_units`. L3 substitution/native-output: ignores `allowed_units`, requires registration + variable-dimension match. |
| `conditions.mjs` | Shared explicit all/any condition evaluation in SI + four-tier range semantics (`normal` / `warning` / `extreme_warning` / `invalid`). *(Addition to the suggested layout; shared by pool and solver.)* |
| `result.mjs` | Result objects + known-quantity pool (four coexisting sources). |
| `expr.mjs` | Restricted expression parser: `+ - * / ^ ( )`, unary sign, `sin()`; identifiers must come from `required_inputs`; recursive-descent AST walk — **no `eval`, no `Function`**. *(Addition to the suggested layout.)* |
| `derive.mjs` | Fixed-point forward derivation, three-layer judgment, unit-mode routing, Active selection, R001, model selection. |
| `reverse.mjs` | Target reverse query — registered output directions only, never algebraic inversion. |
| `index.mjs` | Public facade. |
| `tests/notation.mjs` | Test-side ASCII unit-token resolution for the acceptance bank (TESTS.md semantics #8). Not part of the core engine; the core accepts registered `unit_id`s only. |

## API (`index.mjs`)

`await createEngine(readText)` → `{ ok, engine, diagnostics }`; `createEngineFromData(data)` for a preloaded catalog. Engine methods:

- `setUserInput(variableId, value, unitId)` / `removeUserInput(variableId)`
- `setAssumptionEnabled(variableId, enabled)` / `restoreAssumption(variableId)`
- `solve()` — fixed-point scan; re-derives stale results on demand
- `selectModel(outputVariableId, modelName | null)` — explicit cross-model choice
- `queryTarget(variableId)` — reverse query (candidate paths + missing-input lists)
- `getResults(variableId?)`, `getActive(variableId)`, `getByResultId(resultId)`
- `getFormulaStatus(formulaId)`, `getRecommendationStates()`
- `displayValue(result, unitId)` — layer-2 display conversion, on demand only

## Result contract

Every Result carries the full fixed field set (`key`, `result_id`, `revision`, `variable_id`, `value_si`, `internal_unit`, `source`, `formula_id`, `formula_path`, `dependencies`, `assumptions_used`, `model`, `active`, `stale`, `range_status`, `warnings`); not-applicable fields are `null`, collections are `[]`. `display_value`/`display_unit` never enter the pool.

**Results returned by the public API are read-only for callers.** `result_id` and `revision` are frozen (strict-mode writes throw); `active`/`stale` are engine-managed runtime flags — do not mutate them externally. `key` is the logical slot; `result_id` is the immutable physical-instance identity: every value/source revision mints a new one, `dependencies` reference the exact input `result_id`s consumed, and replaced/removed instances stay resolvable via `getByResultId` for provenance audits.

## Semantics essentials

- **Three-layer judgment**: registered direction → `computability` within the capability set (v0.1: `direct` only) → runtime (inputs resolvable; assumptions usable only via `allowed_assumption_inputs`; stale/invalid/`valid_domain` block; machine applicability and `formula_constraints` evaluated explicitly).
- **Unit-mode routing**: `source_native` = SI → `substitution_units` → evaluate → `native_output_unit` → SI; `si_consistent` = direct SI. Registered course-native forms are never replaced by naive SI substitution.
- **Blocking**: an `invalid` range status blocks only dependent branches; blocked formulas report structured reasons (missing/invalid/stale/constraint/computability), never a bare "cannot calculate".
- **R001**: default selection among derived acceleration models only. Recommended model computable → default Active derived; unavailable → **no automatic fallback** (explicit `selectModel` required; message per R001). An Active user input is never displaced; reference paths can never be Active.
- **Assumption displacement (Part 2)**: `enabled` (user allows the assumption) is tracked separately from `suppressed` (displaced by a real source). Deleting the displacing input never auto-restores the assumption — only `restoreAssumption` or an explicit re-enable does. *Current boundary*: suppression triggers on user inputs only, because no v0.1 formula outputs an assumable variable; when road-load formulas are registered later, derived-displaces-assumption (and no silent restore when the derived value disappears) must be added.
- **Stale propagation (instance-level)**: edges are `result_id`-based only — a changed/removed/displaced instance seeds the walk; consumers of a *different* instance of the same variable are untouched. Triggers: input add/remove/change, assumption toggle, user input displacing derived/assumed values, Active-source/model-selection change. `solve()` re-derives on demand; retired ids stay auditable.
- **Reverse query**: registered outputs only; per-candidate model identity and missing-input lists; recursion offers scheme A (direct input) and scheme B (further formulas) at every user-inputtable stop; depth limit from `max_reverse_formula_depth` (5) counting formula nodes only; cycles flagged, never re-entered.

## Risk warnings (`risk_warnings`)

Formulas may carry an optional `risk_warnings` array. Each entry is `{condition, code, message}` where `condition` is a **single** condition (per `condition.schema.json#/$defs/singleCondition`) that must name a variable from the formula's `required_inputs`; the registered semantics key is `condition_semantics.risk_warnings = "single_condition_warn_when_satisfied"` in the engine config.

- **Warn-when-satisfied**: the condition describes a *risk zone*. After a formula derives successfully, each entry is evaluated against the resolved inputs; a satisfied condition appends `{code, message}` to the derived result's `warnings`. An unsatisfied condition adds nothing. Risk warnings never block a derivation by themselves.
- **Deterministic mount order**: output range warnings come first, then risk warnings in catalog data order.
- **Evaluation failure blocks**: a risk condition that cannot be evaluated (e.g. unresolvable unit) blocks the formula with structured reasons — the same shape as applicability/constraint evaluation failures. This path is unreachable behind the loader/validator pre-checks; reaching it means the catalog is inconsistent, and the engine prefers blocking over deriving with an unevaluated risk zone.
- **Equivalence semantics**: `warnings` participate in the solver's `sameResult` comparison, so a fixed-point re-derivation that only differs in warnings is treated as a changed result (defensive; order is deterministic).
- **Validation**: loader and `tools/validate_catalog.py` both enforce — array of plain objects; `condition.variable` present and within `required_inputs`; comparison/between conditions need a registered, dimension-consistent `unit`; finite/not_finite conditions carry no unit; `code` matches `^[a-z][a-z0-9_]*$`; `message` non-empty. Violations are structured diagnostics, never throws.

## Boundaries

The engine adapts to `data/` and `schemas/` — never the reverse (gate G2). No new formulas, variables, units, or models; no algebraic inversion. The F008 low-speed policy is enacted (Stage 5): below 10 mph, F008 results carry the low_speed_ideal_model risk warning; V = 0 remains constraint-blocked. Plausibility-range calibration and unit-misuse copy belong to work branch 5.
