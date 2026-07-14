/**
 * conditions.mjs — machine-condition evaluation and range semantics.
 *
 * Shared by the result pool (variable ranges) and the derivation core
 * (formula_constraints, applicability, valid_domain). All comparisons happen
 * in SI: condition thresholds carry explicit units and are converted before
 * comparing (Part 3 §3.10 十三/十四).
 */

/**
 * Normalize a loader-validated condition expression into
 * { kind: "all"|"any"|"single", conditions: [...] }.
 */
export function normalizeConditionExpression(expr) {
  if (expr === undefined || expr === null) return null;
  if (Object.prototype.hasOwnProperty.call(expr, "all")) return { kind: "all", conditions: expr.all };
  if (Object.prototype.hasOwnProperty.call(expr, "any")) return { kind: "any", conditions: expr.any };
  return { kind: "single", conditions: [expr] };
}

/**
 * Evaluate one condition object against an SI value.
 * Returns { ok, satisfied, diagnostic } — ok=false only for conversion
 * problems (unknown unit etc.), which callers surface as diagnostics.
 */
export function evaluateCondition(cond, valueSi, unitSystem) {
  const op = cond.operator;
  if (op === "finite") return { ok: true, satisfied: Number.isFinite(valueSi), diagnostic: null };
  if (op === "not_finite") return { ok: true, satisfied: !Number.isFinite(valueSi), diagnostic: null };

  if (op === "between") {
    const minSi = unitSystem.toSI(cond.min, cond.unit);
    if (!minSi.ok) return { ok: false, satisfied: false, diagnostic: minSi.diagnostic };
    const maxSi = unitSystem.toSI(cond.max, cond.unit);
    if (!maxSi.ok) return { ok: false, satisfied: false, diagnostic: maxSi.diagnostic };
    const aboveMin = cond.min_inclusive ? valueSi >= minSi.value : valueSi > minSi.value;
    const belowMax = cond.max_inclusive ? valueSi <= maxSi.value : valueSi < maxSi.value;
    return { ok: true, satisfied: aboveMin && belowMax, diagnostic: null };
  }

  const threshold = unitSystem.toSI(cond.value, cond.unit);
  if (!threshold.ok) return { ok: false, satisfied: false, diagnostic: threshold.diagnostic };
  const t = threshold.value;
  let satisfied;
  switch (op) {
    case "gt": satisfied = valueSi > t; break;
    case "gte": satisfied = valueSi >= t; break;
    case "lt": satisfied = valueSi < t; break;
    case "lte": satisfied = valueSi <= t; break;
    case "eq": satisfied = valueSi === t; break;
    case "neq": satisfied = valueSi !== t; break;
    default:
      return {
        ok: false,
        satisfied: false,
        diagnostic: { severity: "error", code: "condition_operator_unknown", file: null, path: null, message: `Unknown operator ${JSON.stringify(op)}.` },
      };
  }
  return { ok: true, satisfied, diagnostic: null };
}

/**
 * Evaluate a condition expression with explicit all/any semantics.
 * `resolveValueSi(cond)` supplies the SI value the condition applies to
 * (the owning variable's value, or a named input variable's value).
 * Returns { ok, satisfied, diagnostics }.
 */
export function evaluateConditionExpression(expr, resolveValueSi, unitSystem) {
  const normalized = normalizeConditionExpression(expr);
  if (normalized === null) return { ok: true, satisfied: true, diagnostics: [] };
  const diagnostics = [];
  const outcomes = [];
  for (const cond of normalized.conditions) {
    const valueSi = resolveValueSi(cond);
    if (valueSi === null) {
      diagnostics.push({
        severity: "error",
        code: "condition_value_unresolved",
        file: null,
        path: null,
        message: `No value available to evaluate condition on ${JSON.stringify(cond.variable ?? null)}.`,
      });
      return { ok: false, satisfied: false, diagnostics };
    }
    const r = evaluateCondition(cond, valueSi, unitSystem);
    if (!r.ok) {
      diagnostics.push(r.diagnostic);
      return { ok: false, satisfied: false, diagnostics };
    }
    outcomes.push(r.satisfied);
  }
  const satisfied =
    normalized.kind === "any" ? outcomes.some(Boolean) : outcomes.every(Boolean);
  return { ok: true, satisfied, diagnostics };
}

/**
 * Four-tier range semantics for one variable value (Part 3 §3.10 十四):
 *   invalid_range hit                -> "invalid"   (blocks dependent branch)
 *   inside normal_range              -> "normal"
 *   inside warning_range             -> "warning"
 *   outside warning, not invalid     -> "extreme_warning"
 * Returns { status, warnings } with structured warning entries.
 */
export function computeRangeStatus(variable, valueSi, unitSystem) {
  const warnings = [];

  const invalid = evaluateConditionExpression(
    variable.invalid_range,
    () => valueSi,
    unitSystem
  );
  if (invalid.ok && invalid.satisfied) {
    warnings.push({
      code: "range_invalid",
      message: `${variable.variable_id} value hits invalid_range; dependent branches are blocked.`,
    });
    return { status: "invalid", warnings };
  }

  const inRange = (range) => {
    const minSi = unitSystem.toSI(range.min, range.unit);
    const maxSi = unitSystem.toSI(range.max, range.unit);
    if (!minSi.ok || !maxSi.ok) return null;
    const aboveMin = range.min_inclusive === false ? valueSi > minSi.value : valueSi >= minSi.value;
    const belowMax = range.max_inclusive === false ? valueSi < maxSi.value : valueSi <= maxSi.value;
    return aboveMin && belowMax;
  };

  if (inRange(variable.normal_range) === true) {
    return { status: "normal", warnings };
  }
  if (inRange(variable.warning_range) === true) {
    warnings.push({
      code: "range_warning",
      message: `${variable.variable_id} value is outside the normal range but within the warning envelope.`,
    });
    return { status: "warning", warnings };
  }
  warnings.push({
    code: "range_extreme",
    message: `${variable.variable_id} value is outside the warning envelope; confirm before relying on it.`,
  });
  return { status: "extreme_warning", warnings };
}
