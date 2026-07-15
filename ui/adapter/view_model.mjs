/**
 * view_model.mjs — Result display objects and deriveLabels.
 *
 * Pure functions over engine Result instances plus explicit context; no DOM,
 * no engine mutation. Labels follow the fixed rules of the work package:
 * Conflict/Verified are not implemented in v0.1 (deferred, D24).
 */

/**
 * Display precision (significant figures). ui/tokens.css carries the
 * authoritative parameters (--precision-result, --precision-si); these are
 * the same values so the Node gate runs without CSS parsing. Internal
 * calculation never uses rounded values — formatting is display-only.
 */
export const PRECISION = Object.freeze({ result: 4, si: 6 });

/** Format a finite number to `sig` significant figures for display. */
export function formatSignificant(value, sig) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  return value.toPrecision(sig);
}

/** Fixed label vocabulary (key -> user-facing text). */
export const LABELS = Object.freeze({
  active: "Active",
  alternative: "Alternative",
  different_model: "Different model",
  uses_assumptions: "Uses assumptions",
  warning: "Warning",
  user_confirmed_warning: "User confirmed warning",
  needs_recalculation: "Needs recalculation",
  invalid: "Invalid",
});

/** display_role with the fixed fallback (never expected to trigger). */
export function displayRoleOf(variable) {
  return variable && variable.display_role ? variable.display_role : "derived_output";
}

/**
 * Does `result` share its variable with a derived instance of another model?
 * (Context input for the "Different model" label.)
 */
export function hasOtherModelInstances(result, instancesOfVariable) {
  if (result.source !== "derived" || result.model == null) return false;
  return instancesOfVariable.some(
    (other) =>
      other !== result &&
      other.source === "derived" &&
      other.model != null &&
      other.model.name !== result.model.name
  );
}

/**
 * deriveLabels(result, ctx) — labels for an existing Result instance only.
 * ctx: {
 *   confirmedResultIds: Set<result_id>,
 *   otherModelExists: boolean   (precomputed via hasOtherModelInstances)
 * }
 * Returns an array of {key, text} in fixed order.
 */
export function deriveLabels(result, ctx) {
  const confirmed = ctx && ctx.confirmedResultIds ? ctx.confirmedResultIds : new Set();
  const labels = [];
  const push = (key) => labels.push({ key, text: LABELS[key] });

  if (result.active === true) push("active");
  if (
    result.source === "derived" &&
    result.active !== true &&
    result.range_status !== "invalid"
  ) {
    push("alternative");
  }
  if (ctx && ctx.otherModelExists === true) push("different_model");
  if (result.assumptions_used.length > 0) push("uses_assumptions");
  if (
    result.warnings.length > 0 ||
    result.range_status === "warning" ||
    result.range_status === "extreme_warning"
  ) {
    push("warning");
  }
  if (confirmed.has(result.result_id)) push("user_confirmed_warning");
  if (result.stale === true) push("needs_recalculation");
  if (result.range_status === "invalid") push("invalid");
  return labels;
}

/**
 * Build the display object for one Result.
 * ctx: { engine, adapter, store } — read-only use; display unit comes from
 * store.displayUnitByVariableId with the variable's default_unit as fallback.
 */
export function buildResultView(result, { engine, adapter, store }) {
  const variable = adapter.variablesById[result.variable_id];
  const unitId =
    store.state.displayUnitByVariableId.get(result.variable_id) ?? variable.default_unit;
  const converted = engine.displayValue(result, unitId);
  const unit = adapter.unitsById[unitId];
  const instances = engine.getResults(result.variable_id);

  return {
    resultId: result.result_id,
    variableId: result.variable_id,
    variableName: variable.name,
    symbol: variable.symbol,
    source: result.source,
    formulaId: result.formula_id,
    model: result.model
      ? {
          group: result.model.group,
          name: result.model.name,
          displayName: adapter.modelsById[result.model.name]?.display_name ?? result.model.name,
        }
      : null,
    displayRole: displayRoleOf(variable),
    display: {
      ok: converted.ok === true,
      unitId,
      unitSymbol: unit ? unit.display_symbol : unitId,
      text: converted.ok === true ? formatSignificant(converted.value, PRECISION.result) : null,
      rawValue: converted.ok === true ? converted.value : null,
    },
    si: {
      unitId: result.internal_unit,
      text: formatSignificant(result.value_si, PRECISION.si),
    },
    labels: deriveLabels(result, {
      confirmedResultIds: store.state.confirmedResultIds,
      otherModelExists: hasOtherModelInstances(result, instances),
    }),
    active: result.active === true,
    stale: result.stale === true,
    rangeStatus: result.range_status,
    assumptionsUsed: [...result.assumptions_used],
    warnings: result.warnings,
    dependencies: [...result.dependencies],
  };
}
