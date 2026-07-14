/**
 * result.mjs — runtime Result objects and the known-quantity pool (M2).
 *
 * Four sources coexist and never overwrite each other:
 *   user_input / derived / assumption / constant
 *
 * Every Result carries the full field set; fields that do not apply are null
 * and collection fields are empty arrays — never empty strings, never
 * omitted. display_value / display_unit do not enter the core pool.
 */

import { computeRangeStatus } from "./conditions.mjs";

export const RESULT_SOURCES = Object.freeze(["user_input", "derived", "assumption", "constant"]);

/** The complete, fixed Result field set (tested in M2). */
export const RESULT_FIELDS = Object.freeze([
  "key",
  "variable_id",
  "value_si",
  "internal_unit",
  "source",
  "formula_id",
  "formula_path",
  "dependencies",
  "assumptions_used",
  "model",
  "active",
  "stale",
  "range_status",
  "warnings",
]);

export function instanceKey(variableId, source, formulaId = null) {
  return source === "derived" ? `${variableId}::derived::${formulaId}` : `${variableId}::${source}`;
}

/**
 * Construct a Result with the fixed null/empty-array structure.
 * `fields` must provide variable_id, value_si, internal_unit, source; the
 * remaining fields default to their fixed not-applicable values.
 */
export function makeResult(fields) {
  if (!RESULT_SOURCES.includes(fields.source)) {
    throw new Error(`invalid result source: ${JSON.stringify(fields.source)}`);
  }
  const formulaId = fields.formula_id ?? null;
  return {
    key: instanceKey(fields.variable_id, fields.source, formulaId),
    variable_id: fields.variable_id,
    value_si: fields.value_si,
    internal_unit: fields.internal_unit,
    source: fields.source,
    formula_id: formulaId,
    formula_path: fields.formula_path ?? [],
    dependencies: fields.dependencies ?? [],
    assumptions_used: fields.assumptions_used ?? [],
    model: fields.model ?? null,
    active: fields.active ?? false,
    stale: fields.stale ?? false,
    range_status: fields.range_status ?? null,
    warnings: fields.warnings ?? [],
  };
}

function failure(code, message) {
  return {
    ok: false,
    result: null,
    diagnostic: { severity: "error", code, file: null, path: null, message },
  };
}

/**
 * Known-quantity pool for one solve session.
 *
 * @param {object} data - validated catalog data (loadCatalog).
 * @param {object} unitSystem - createUnitSystem(data).
 */
export function createPool(data, unitSystem) {
  const variables = data.variables;
  const userInputDefaultActive = data.engineConfig.user_input_default_active === true;

  /** variableId -> Map(instanceKey -> Result) */
  const store = new Map();
  /** variableId -> boolean for assumable variables */
  const assumptionEnabled = new Map();

  function bucket(variableId) {
    if (!store.has(variableId)) store.set(variableId, new Map());
    return store.get(variableId);
  }

  function put(result) {
    bucket(result.variable_id).set(result.key, result);
    return result;
  }

  function instances(variableId) {
    return [...bucket(variableId).values()];
  }

  function allInstances() {
    const out = [];
    for (const map of store.values()) out.push(...map.values());
    return out;
  }

  function bySource(variableId, source) {
    return instances(variableId).filter((r) => r.source === source);
  }

  function userInput(variableId) {
    return bySource(variableId, "user_input")[0] ?? null;
  }

  function assumptionInstance(variableId) {
    return bySource(variableId, "assumption")[0] ?? null;
  }

  /** The Active instance of a variable, if any (at most one is active). */
  function active(variableId) {
    return instances(variableId).find((r) => r.active) ?? null;
  }

  function refreshAssumptionActivity(variableId) {
    const assumption = assumptionInstance(variableId);
    if (assumption) {
      assumption.active = assumptionEnabled.get(variableId) === true && userInput(variableId) === null;
    }
  }

  // ---- initialization: constants and default-enabled assumptions ----------
  for (const [variableId, variable] of variables) {
    if (variable.is_constant === true) {
      put(
        makeResult({
          variable_id: variableId,
          value_si: variable.constant_value_si,
          internal_unit: variable.internal_unit,
          source: "constant",
          active: true,
          range_status: computeRangeStatus(variable, variable.constant_value_si, unitSystem).status,
        })
      );
    }
    if (variable.can_be_assumed === true) {
      assumptionEnabled.set(variableId, variable.default_assumption.enabled_by_default === true);
      if (assumptionEnabled.get(variableId)) instantiateAssumption(variableId);
    }
  }

  function instantiateAssumption(variableId) {
    const variable = variables.get(variableId);
    const si = unitSystem.toSI(variable.default_assumption.value, variable.default_assumption.unit);
    if (!si.ok) return failure(si.diagnostic.code, si.diagnostic.message);
    const range = computeRangeStatus(variable, si.value, unitSystem);
    const result = put(
      makeResult({
        variable_id: variableId,
        value_si: si.value,
        internal_unit: variable.internal_unit,
        source: "assumption",
        active: userInput(variableId) === null,
        range_status: range.status,
        warnings: range.warnings,
      })
    );
    return { ok: true, result, diagnostic: null };
  }

  // ---- user inputs -----------------------------------------------------------
  /**
   * Set (or replace) the single user-input value of a variable.
   * Conversion goes through the variable-facing unit layer; the stored value
   * is SI. Invalid-range values are stored with range_status "invalid" —
   * blocking is the derivation core's job, silent rejection is not.
   */
  function setUserInput(variableId, value, unitId) {
    const variable = variables.get(variableId);
    if (!variable) return failure("unknown_variable", `Unknown variable: ${JSON.stringify(variableId)}.`);
    if (variable.can_be_user_input !== true) {
      return failure("user_input_not_permitted", `Variable ${variableId} does not accept user input.`);
    }
    const si = unitSystem.variableInputToSI(variableId, value, unitId);
    if (!si.ok) return { ok: false, result: null, diagnostic: si.diagnostic };

    const range = computeRangeStatus(variable, si.value, unitSystem);
    const result = makeResult({
      variable_id: variableId,
      value_si: si.value,
      internal_unit: variable.internal_unit,
      source: "user_input",
      active: userInputDefaultActive,
      range_status: range.status,
      warnings: range.warnings,
    });
    put(result); // same key -> replaces the previous user input only

    // A user input takes Active away from assumption and derived instances of
    // the same variable; those instances are retained for comparison.
    for (const other of instances(variableId)) {
      if (other.key !== result.key && other.source !== "constant") other.active = false;
    }
    return { ok: true, result, diagnostic: null };
  }

  /** Remove the user-input value of a variable (if present). */
  function removeUserInput(variableId) {
    const existing = userInput(variableId);
    if (!existing) return false;
    bucket(variableId).delete(existing.key);
    refreshAssumptionActivity(variableId);
    return true;
  }

  // ---- assumptions ----------------------------------------------------------
  /** Enable or disable a variable's registered default assumption. */
  function setAssumptionEnabled(variableId, enabled) {
    const variable = variables.get(variableId);
    if (!variable) return failure("unknown_variable", `Unknown variable: ${JSON.stringify(variableId)}.`);
    if (variable.can_be_assumed !== true) {
      return failure("assumption_not_permitted", `Variable ${variableId} has no registered assumption.`);
    }
    assumptionEnabled.set(variableId, enabled === true);
    const existing = assumptionInstance(variableId);
    if (!enabled) {
      if (existing) bucket(variableId).delete(existing.key);
      return { ok: true, result: null, diagnostic: null };
    }
    if (existing) {
      refreshAssumptionActivity(variableId);
      return { ok: true, result: existing, diagnostic: null };
    }
    return instantiateAssumption(variableId);
  }

  function isAssumptionEnabled(variableId) {
    return assumptionEnabled.get(variableId) === true;
  }

  // ---- derived (used by the derivation core) ---------------------------------
  /** Insert or replace a derived result instance (same formula -> same key). */
  function putDerived(result) {
    if (result.source !== "derived") throw new Error("putDerived requires source=derived");
    return put(result);
  }

  function removeDerived(key) {
    for (const map of store.values()) {
      if (map.has(key) && map.get(key).source === "derived") {
        map.delete(key);
        return true;
      }
    }
    return false;
  }

  return {
    instances,
    allInstances,
    bySource,
    userInput,
    assumptionInstance,
    active,
    setUserInput,
    removeUserInput,
    setAssumptionEnabled,
    isAssumptionEnabled,
    refreshAssumptionActivity,
    putDerived,
    removeDerived,
  };
}
