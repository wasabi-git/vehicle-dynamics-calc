/**
 * units.mjs — three-layer unit system (engine work-branch M1).
 *
 * Layer 1 — base converter: any two *registered* units of the same dimension
 *   convert through SI; cross-dimension requests return a structured
 *   diagnostic, never a throw.
 * Layer 2 — variable-facing conversion: the unit must additionally belong to
 *   the variable's allowed_units, otherwise a structured diagnostic.
 * Layer 3 — formula-internal substitution: substitution_units and
 *   native_output_unit conversions are NOT restricted by allowed_units, but
 *   the unit must be registered and match the variable's dimension.
 *
 * All values crossing these APIs are IEEE double; internal storage is SI.
 * Construction assumes loader-validated data (loadCatalog ok === true).
 */

function err(code, message) {
  return {
    ok: false,
    value: null,
    diagnostic: { severity: "error", code, file: null, path: null, message },
  };
}

function ok(value) {
  return { ok: true, value, diagnostic: null };
}

/**
 * @param {object} data - validated catalog data from loadCatalog().
 */
export function createUnitSystem(data) {
  const units = data.units;
  const variables = data.variables;

  // Precompute linear scale/offset to SI for every registered unit.
  // constant_reference units resolve through the referenced constant.
  const linear = new Map();
  for (const [unitId, unit] of units) {
    const conv = unit.si_conversion;
    if (conv.type === "linear") {
      linear.set(unitId, { scale: conv.scale, offset: conv.offset, dimension: unit.dimension });
    } else if (conv.type === "constant_reference") {
      const constant = variables.get(conv.variable_id);
      const inner = constant ? units.get(constant.internal_unit) : null;
      const innerScale = inner && inner.si_conversion.type === "linear" ? inner.si_conversion.scale : null;
      if (constant && innerScale !== null) {
        linear.set(unitId, {
          scale: constant.constant_value_si * innerScale,
          offset: 0,
          dimension: unit.dimension,
        });
      }
      // A broken reference is unreachable behind a passing loader; leaving the
      // unit unmapped makes conversions report unknown_unit defensively.
    }
  }

  function unitInfo(unitId) {
    return linear.get(unitId) || null;
  }

  /** Layer 1: value in `unitId` -> SI. */
  function toSI(value, unitId) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return err("value_not_finite", `Cannot convert non-finite value ${String(value)} (${unitId}).`);
    }
    const info = unitInfo(unitId);
    if (!info) return err("unknown_unit", `Unit is not registered: ${JSON.stringify(unitId)}.`);
    return ok(value * info.scale + info.offset);
  }

  /** Layer 1: SI value -> value in `unitId`. */
  function fromSI(valueSi, unitId) {
    if (typeof valueSi !== "number" || !Number.isFinite(valueSi)) {
      return err("value_not_finite", `Cannot convert non-finite SI value ${String(valueSi)} (${unitId}).`);
    }
    const info = unitInfo(unitId);
    if (!info) return err("unknown_unit", `Unit is not registered: ${JSON.stringify(unitId)}.`);
    return ok((valueSi - info.offset) / info.scale);
  }

  /** Layer 1: registered unit -> registered unit, same dimension only. */
  function convert(value, fromUnitId, toUnitId) {
    const fromInfo = unitInfo(fromUnitId);
    if (!fromInfo) return err("unknown_unit", `Unit is not registered: ${JSON.stringify(fromUnitId)}.`);
    const toInfo = unitInfo(toUnitId);
    if (!toInfo) return err("unknown_unit", `Unit is not registered: ${JSON.stringify(toUnitId)}.`);
    if (fromInfo.dimension !== toInfo.dimension) {
      return err(
        "dimension_mismatch",
        `Cannot convert ${fromUnitId} (${fromInfo.dimension}) to ${toUnitId} (${toInfo.dimension}).`
      );
    }
    const si = toSI(value, fromUnitId);
    if (!si.ok) return si;
    return fromSI(si.value, toUnitId);
  }

  function requireVariable(variableId) {
    const variable = variables.get(variableId);
    if (!variable) {
      return { variable: null, failure: err("unknown_variable", `Unknown variable: ${JSON.stringify(variableId)}.`) };
    }
    return { variable, failure: null };
  }

  /** Layer 2 admission: unit must be registered, allowed for the variable, and dimension-consistent. */
  function checkVariableUnit(variable, unitId) {
    const info = unitInfo(unitId);
    if (!info) return err("unknown_unit", `Unit is not registered: ${JSON.stringify(unitId)}.`);
    if (info.dimension !== variable.dimension) {
      return err(
        "dimension_mismatch",
        `Unit ${unitId} (${info.dimension}) does not match ${variable.variable_id} dimension (${variable.dimension}).`
      );
    }
    if (!variable.allowed_units.includes(unitId)) {
      return err(
        "unit_not_allowed_for_variable",
        `Unit ${unitId} is not in allowed_units of ${variable.variable_id} (${variable.allowed_units.join(", ")}).`
      );
    }
    return null;
  }

  /** Layer 2: user-facing input in `unitId` -> SI (internal_unit magnitude). */
  function variableInputToSI(variableId, value, unitId) {
    const { variable, failure } = requireVariable(variableId);
    if (failure) return failure;
    const admission = checkVariableUnit(variable, unitId);
    if (admission) return admission;
    return toSI(value, unitId);
  }

  /** Layer 2: SI value of a variable -> user-facing display unit. */
  function variableOutputFromSI(variableId, valueSi, unitId) {
    const { variable, failure } = requireVariable(variableId);
    if (failure) return failure;
    const admission = checkVariableUnit(variable, unitId);
    if (admission) return admission;
    return fromSI(valueSi, unitId);
  }

  /** Layer 3: SI value of an input variable -> registered substitution unit.
   *  Not restricted by allowed_units; dimension must match the variable. */
  function substitutionFromSI(variableId, valueSi, unitId) {
    const { variable, failure } = requireVariable(variableId);
    if (failure) return failure;
    const info = unitInfo(unitId);
    if (!info) return err("unknown_unit", `Substitution unit is not registered: ${JSON.stringify(unitId)}.`);
    if (info.dimension !== variable.dimension) {
      return err(
        "dimension_mismatch",
        `Substitution unit ${unitId} (${info.dimension}) does not match ${variableId} dimension (${variable.dimension}).`
      );
    }
    return fromSI(valueSi, unitId);
  }

  /** Layer 3: native expression result in `unitId` -> SI for the output variable.
   *  Not restricted by allowed_units; dimension must match the variable. */
  function nativeOutputToSI(variableId, value, unitId) {
    const { variable, failure } = requireVariable(variableId);
    if (failure) return failure;
    const info = unitInfo(unitId);
    if (!info) return err("unknown_unit", `Native output unit is not registered: ${JSON.stringify(unitId)}.`);
    if (info.dimension !== variable.dimension) {
      return err(
        "dimension_mismatch",
        `Native output unit ${unitId} (${info.dimension}) does not match ${variableId} dimension (${variable.dimension}).`
      );
    }
    return toSI(value, unitId);
  }

  return {
    toSI,
    fromSI,
    convert,
    variableInputToSI,
    variableOutputFromSI,
    substitutionFromSI,
    nativeOutputToSI,
  };
}
