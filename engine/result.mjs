/**
 * result.mjs — runtime Result objects and the known-quantity pool (M2;
 * instance identity and assumption-suppression semantics per the
 * checkpoint-one review).
 *
 * Four sources coexist and never overwrite each other:
 *   user_input / derived / assumption / constant
 *
 * Every Result carries the full field set; fields that do not apply are null
 * and collection fields are empty arrays — never empty strings, never
 * omitted. display_value / display_unit do not enter the core pool.
 *
 * Instance identity:
 *   key       — logical slot (variable::source[::formula]), stable across
 *               revisions; the pool indexes by it.
 *   result_id — immutable per physical instance; a new value or source
 *               revision in a slot mints a new result_id. dependencies of
 *               derived results reference result_ids, so a stale result keeps
 *               naming the exact input revisions it was computed from.
 *   revision  — 1-based counter per slot, monotonically increasing.
 * Replaced or removed instances are retired to a history index and stay
 * resolvable by result_id for provenance audits.
 */

import { computeRangeStatus, computeUnitMisuseSuggestions } from "./conditions.mjs";

export const RESULT_SOURCES = Object.freeze(["user_input", "derived", "assumption", "constant"]);

/** The complete, fixed Result field set (tested in M2). */
export const RESULT_FIELDS = Object.freeze([
  "key",
  "result_id",
  "revision",
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
    result_id: fields.result_id ?? null, // assigned by the pool on insertion
    revision: fields.revision ?? null,   // assigned by the pool on insertion
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
  /** variableId -> boolean: does the user allow this default assumption at all */
  const assumptionEnabled = new Map();
  /** variableId -> boolean: was the assumption displaced by a real source and
   *  not yet explicitly restored (Part 2: no automatic restoration) */
  const assumptionSuppressed = new Map();
  /** retired instances by result_id, for provenance audits */
  const retired = new Map();
  /** slot key -> last issued revision (survives instance removal) */
  const slotRevisions = new Map();
  let resultSequence = 0;

  function retire(result) {
    if (result.result_id !== null) retired.set(result.result_id, result);
  }

  function bucket(variableId) {
    if (!store.has(variableId)) store.set(variableId, new Map());
    return store.get(variableId);
  }

  /** Insert a result: mints an immutable result_id, bumps the slot revision,
   *  and retires any instance previously occupying the slot. result_id and
   *  revision are frozen — active/stale stay mutable runtime state. */
  function put(result) {
    const map = bucket(result.variable_id);
    const previous = map.get(result.key);
    if (previous) retire(previous);
    resultSequence += 1;
    Object.defineProperty(result, "result_id", {
      value: `r_${String(resultSequence).padStart(6, "0")}`,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    const revision = (slotRevisions.get(result.key) ?? 0) + 1;
    slotRevisions.set(result.key, revision);
    Object.defineProperty(result, "revision", {
      value: revision,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    map.set(result.key, result);
    return result;
  }

  /**
   * M4 stale propagation. Edges are strictly instance-level:
   * a changed/removed/displaced result_id seeds the walk; every live derived
   * result whose dependencies include a seed id goes stale, and its own
   * result_id propagates further downstream. Never keyed by variable_id —
   * results that consumed a different instance of the same variable are
   * untouched. Retired ids are valid seeds (the consumers still reference
   * them until re-derived). Returns the result_ids marked stale.
   */
  function propagateStaleFrom(seedResultIds) {
    const queue = seedResultIds.filter((id) => typeof id === "string");
    const staled = [];
    while (queue.length > 0) {
      const id = queue.shift();
      for (const map of store.values()) {
        for (const result of map.values()) {
          if (result.source === "derived" && !result.stale && result.dependencies.includes(id)) {
            result.stale = true;
            staled.push(result.result_id);
            queue.push(result.result_id);
          }
        }
      }
    }
    return staled;
  }

  /** Resolve a result_id against live instances, then the retired history. */
  function getByResultId(resultId) {
    for (const map of store.values()) {
      for (const result of map.values()) {
        if (result.result_id === resultId) return result;
      }
    }
    return retired.get(resultId) ?? null;
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

  /**
   * An assumption is Active only when the user allows it (enabled), it was
   * never displaced by a real source — or was explicitly restored after
   * displacement (not suppressed) — and no user input occupies the variable.
   */
  function refreshAssumptionActivity(variableId) {
    const assumption = assumptionInstance(variableId);
    if (assumption) {
      assumption.active =
        assumptionEnabled.get(variableId) === true &&
        assumptionSuppressed.get(variableId) !== true &&
        userInput(variableId) === null;
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
      assumptionSuppressed.set(variableId, false);
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
        active: false,
        range_status: range.status,
        warnings: range.warnings,
      })
    );
    refreshAssumptionActivity(variableId);
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
    // Unit-misuse detection (Stage 5): user inputs only, mounted after the
    // range warnings. Assumption and derived instances never enter this path.
    const warnings = [...range.warnings];
    const misuse = computeUnitMisuseSuggestions(variable, value, unitId, unitSystem);
    if (misuse) warnings.push(misuse);

    // Trigger surface (M4): a new/changed user input outdates the consumers
    // of the replaced input instance and of any instance that loses Active
    // to it (displaced assumption or derived value).
    const staleSeeds = [];
    const previousInput = userInput(variableId);
    if (previousInput) staleSeeds.push(previousInput.result_id);
    for (const other of instances(variableId)) {
      if (other !== previousInput && other.source !== "constant" && other.active) {
        staleSeeds.push(other.result_id);
      }
    }

    const result = makeResult({
      variable_id: variableId,
      value_si: si.value,
      internal_unit: variable.internal_unit,
      source: "user_input",
      active: userInputDefaultActive,
      range_status: range.status,
      warnings,
    });
    put(result); // same key -> retires and replaces the previous user input only

    // A user input takes Active away from assumption and derived instances of
    // the same variable; those instances are retained for comparison. A
    // displaced assumption becomes suppressed: deleting the user input later
    // must NOT restore it automatically (Part 2) — only an explicit
    // restoreAssumption / re-enable does.
    if (variable.can_be_assumed === true) assumptionSuppressed.set(variableId, true);
    for (const other of instances(variableId)) {
      if (other.key !== result.key && other.source !== "constant") other.active = false;
    }
    propagateStaleFrom(staleSeeds);
    return { ok: true, result, diagnostic: null };
  }

  /** Remove the user-input value of a variable (if present).
   *  A previously displaced assumption stays suppressed and inactive; the
   *  removed instance seeds stale propagation to its actual consumers. */
  function removeUserInput(variableId) {
    const existing = userInput(variableId);
    if (!existing) return false;
    retire(existing);
    bucket(variableId).delete(existing.key);
    refreshAssumptionActivity(variableId); // suppressed assumptions stay inactive
    propagateStaleFrom([existing.result_id]);
    return true;
  }

  // ---- assumptions ----------------------------------------------------------
  /** Enable or disable a variable's registered default assumption.
   *  Both directions are explicit user actions on the assumption itself, so
   *  enabling also clears any suppression left by an earlier displacement. */
  function setAssumptionEnabled(variableId, enabled) {
    const variable = variables.get(variableId);
    if (!variable) return failure("unknown_variable", `Unknown variable: ${JSON.stringify(variableId)}.`);
    if (variable.can_be_assumed !== true) {
      return failure("assumption_not_permitted", `Variable ${variableId} has no registered assumption.`);
    }
    assumptionEnabled.set(variableId, enabled === true);
    const existing = assumptionInstance(variableId);
    if (!enabled) {
      if (existing) {
        retire(existing);
        bucket(variableId).delete(existing.key);
        // Trigger surface (M4): consumers of the removed assumption instance
        // are outdated. Enabling later only offers new availability — nothing
        // referenced the fresh instance yet, so no seeds on that side.
        propagateStaleFrom([existing.result_id]);
      }
      return { ok: true, result: null, diagnostic: null };
    }
    assumptionSuppressed.set(variableId, false);
    if (existing) {
      refreshAssumptionActivity(variableId);
      return { ok: true, result: existing, diagnostic: null };
    }
    return instantiateAssumption(variableId);
  }

  /**
   * Explicitly restore an assumption that was suppressed when a real source
   * displaced it. Only this (or a full re-enable) makes it Active again;
   * removal of the displacing user input never does.
   */
  function restoreAssumption(variableId) {
    const variable = variables.get(variableId);
    if (!variable) return failure("unknown_variable", `Unknown variable: ${JSON.stringify(variableId)}.`);
    if (variable.can_be_assumed !== true) {
      return failure("assumption_not_permitted", `Variable ${variableId} has no registered assumption.`);
    }
    if (assumptionEnabled.get(variableId) !== true) {
      return failure("assumption_disabled", `Assumption for ${variableId} is disabled; enable it instead of restoring.`);
    }
    assumptionSuppressed.set(variableId, false);
    const existing = assumptionInstance(variableId);
    if (!existing) return instantiateAssumption(variableId);
    refreshAssumptionActivity(variableId);
    return { ok: true, result: existing, diagnostic: null };
  }

  function isAssumptionEnabled(variableId) {
    return assumptionEnabled.get(variableId) === true;
  }

  function isAssumptionSuppressed(variableId) {
    return assumptionSuppressed.get(variableId) === true;
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
        retire(map.get(key));
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
    getByResultId,
    propagateStaleFrom,
    setUserInput,
    removeUserInput,
    setAssumptionEnabled,
    restoreAssumption,
    isAssumptionEnabled,
    isAssumptionSuppressed,
    refreshAssumptionActivity,
    putDerived,
    removeDerived,
  };
}
