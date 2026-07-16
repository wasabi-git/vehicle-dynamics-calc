/**
 * derivation_controller.mjs — derivation-detail view models (no DOM):
 * the eight fixed levels per result (summary / formula / substitution /
 * unit conversion / intermediates / assumptions+constants / sources+
 * dependencies / notes), the §7.14 comparison algorithm, the three
 * no-result state texts (verbatim), and expand/collapse bookkeeping.
 */

import { formatSignificant, PRECISION } from "../adapter/view_model.mjs";
import { presentFormulaSources } from "../adapter/source_presenter.mjs";
import { formatFormula } from "../adapter/formula_format.mjs";

/** Part 2 no-result three-state copy, verbatim. */
export const NO_RESULT_TEXT = Object.freeze({
  not_calculated: "No calculated results yet. Add known values and select Calculate.",
  nothing_derivable: "No result can currently be calculated. See Missing Conditions for required inputs.",
  target_unavailable: "Some results were calculated, but the requested result is not available. See Missing Conditions.",
});

/** Which of the three states applies (null = results render normally). */
export function noResultState({ engine, store }) {
  if (store.state.hasCompletedSolve !== true) return "not_calculated";
  const derived = engine.getResults().filter((r) => r.source === "derived");
  if (derived.length === 0) return "nothing_derivable";
  const target = store.state.selectedTarget;
  if (target) {
    const active = engine.getActive(target);
    if (!active || active.stale === true) return "target_unavailable";
  }
  return null;
}

/** §7.14 — absolute-value difference algorithm (owner-decided variant). */
export function compareUserAndDerived(user, derived, { engine, displayUnit }) {
  const absoluteSi = Math.abs(derived.value_si - user.value_si);
  const zeroReference = user.value_si === 0;
  const percentage = zeroReference ? null : (absoluteSi / Math.abs(user.value_si)) * 100;

  let displayDelta = null;
  if (displayUnit) {
    const u = engine.displayValue(user, displayUnit);
    const d = engine.displayValue(derived, displayUnit);
    if (u.ok && d.ok) displayDelta = Math.abs(d.value - u.value); // unrounded subtraction
  }

  return {
    userResultId: user.result_id,
    derivedResultId: derived.result_id,
    model: derived.model ? derived.model.name : null,
    absoluteSi,
    absoluteSiText: formatSignificant(absoluteSi, PRECISION.result),
    percentage,
    percentageText: zeroReference
      ? "Percentage difference unavailable (reference value is zero)."
      : `${formatSignificant(percentage, PRECISION.result)}%`,
    displayDelta,
    displayDeltaText: displayDelta === null ? null : formatSignificant(displayDelta, PRECISION.result),
    displayUnit: displayUnit ?? null,
    // No direction is shown; a future signed requirement must introduce its
    // own signed_delta field instead of re-using these absolute values.
  };
}

/** Every user/derived comparison row for one variable (one per model). */
export function comparisonsForVariable({ engine, store }, variableId) {
  const instances = engine.getResults(variableId);
  const user = instances.find((r) => r.source === "user_input");
  if (!user) return [];
  const displayUnit = store.state.displayUnitByVariableId.get(variableId) ?? null;
  return instances
    .filter((r) => r.source === "derived")
    .map((derived) => compareUserAndDerived(user, derived, { engine, displayUnit }));
}

function describeDependency({ engine, adapter, store }, resultId) {
  const node = engine.getByResultId(resultId);
  if (!node) return null;
  const variable = adapter.variablesById[node.variable_id];
  const snapshot = store.state.inputSnapshotByResultId.get(resultId) ?? null;
  const retired = engine.getResults(node.variable_id).every((live) => live.result_id !== resultId);
  const symbolOf = (unitId) => adapter.unitsById[unitId]?.display_symbol ?? unitId;
  return {
    resultId,
    variableId: node.variable_id,
    name: variable ? variable.name : node.variable_id,
    symbol: variable ? variable.symbol : "",
    source: node.source,
    formulaId: node.formula_id,
    entered: snapshot ? `${snapshot.enteredValue} ${symbolOf(snapshot.enteredUnit)}` : null,
    siText: `${formatSignificant(node.value_si, PRECISION.si)} ${symbolOf(node.internal_unit)}`,
    stale: node.stale === true,
    retired,
    warnings: node.warnings.length,
  };
}

/**
 * The eight-level derivation detail of one derived result.
 */
export function buildDerivationDetail(app, result) {
  const { adapter } = app;
  const formula = adapter.formulasById[result.formula_id];
  const dependencies = result.dependencies
    .map((id) => describeDependency(app, id))
    .filter(Boolean);

  const inputNames = dependencies.map((d) => d.name);
  const outputVariable = adapter.variablesById[result.variable_id];

  return {
    resultId: result.result_id,
    // 1. summary — engineering sentence, not a formula number
    summary: `${outputVariable.name} was derived from ${inputNames.join(", ")}.`,
    // 2. formula
    formulaName: formula ? formula.name : result.formula_id,
    formulaId: result.formula_id,
    formulaTree: formula ? formatFormula(formula.expression) : null,
    // 3.+4. substitution rows with entered value (snapshot) and SI conversion
    substitutions: dependencies.map((d) => ({
      ...d,
      conversion: d.entered ? `${d.entered} → ${d.siText}` : d.siText,
    })),
    // 5. intermediate variables (derived dependencies)
    intermediates: dependencies.filter((d) => d.source === "derived"),
    // 6. assumptions and constants
    assumptionsUsed: [...result.assumptions_used],
    constants: dependencies.filter((d) => d.source === "constant"),
    // 7. sources and dependencies — sources ONLY through the presenter
    sources: formula ? presentFormulaSources(adapter, formula) : [],
    dependencyIds: [...result.dependencies],
    formulaPath: [...result.formula_path],
    // 8. notes: warnings / stale
    stale: result.stale === true,
    warningCount: result.warnings.length,
  };
}

/**
 * Expand/collapse bookkeeping (expandedResultIds). IDEMPOTENT: when the
 * requested state already holds, nothing is written and — critically —
 * store.notify() is NOT called. The details renderer re-fires a toggle
 * event for elements created open; without this guard every render would
 * notify again and the region would re-render in a loop, destroying nodes
 * mid-scroll. Returns true only when the state actually changed.
 */
export function toggleExpanded({ store }, resultId, expanded) {
  const set = store.state.expandedResultIds;
  if (Boolean(expanded) === set.has(resultId)) return false;
  if (expanded) set.add(resultId);
  else set.delete(resultId);
  store.notify();
  return true;
}
