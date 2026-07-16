/**
 * warning_presenter.mjs — §7.6 structured warning presentation.
 *
 * PURE function layer: the controller precomputes every conversion
 * (displayed value via engine.displayValue, unrounded, then formatted) and
 * passes plain data in. Range bounds are always presented in the units the
 * metadata declares (normal_range / warning_range carry their own unit
 * field) — the UI has no conversion authority of its own.
 *
 * Confirmation eligibility is hard-coded: a "Keep original" action appears
 * ONLY for source === "user_input" && range_status === "extreme_warning".
 * Invalid values can never be confirmed. Warning-tier values, formula risk
 * warnings, and derived-result warnings never get a confirmation button.
 * "Keep original" writes confirmedResultIds only — zero engine operations —
 * and a new result_id naturally returns to the unconfirmed state.
 *
 * Warnings keep the engine's deterministic order (range → risk → misuse);
 * the presenter never re-sorts.
 */

/** Fixed title/policy copy per warning code family. */
const COPY = Object.freeze({
  range_warning: {
    title: "Outside the normal range",
    policy: "Calculation continues with this value.",
  },
  range_extreme: {
    title: "Far outside the normal range",
    policy: "Calculation continues; confirm to keep this value.",
  },
  range_invalid: {
    title: "Invalid value",
    policy: "This value is excluded from calculation; dependent branches are blocked.",
  },
  unit_misuse_suspected: {
    title: "Possible unit mistake",
    policy: "Calculation continues with your original value unless you adopt a suggestion.",
  },
  risk_default: {
    title: "Model applicability warning",
    policy: "Calculation continues; review whether the model applies here.",
  },
});

function copyFor(code) {
  return COPY[code] ?? COPY.risk_default;
}

/**
 * Fixed user-facing title for a warning code (upstream-trace rows use this
 * instead of the raw engine message, which stays developer-fallback only).
 */
export function warningTitleFor(code) {
  return copyFor(code).title;
}

/**
 * Format one metadata range in its declared unit. The VALUES stay exactly
 * as the metadata declares them (no re-conversion — the UI has no
 * conversion authority); `symbolOf` only maps the declared unit id to its
 * registered display symbol (owner-directed C10 polish).
 */
export function formatRange(range, symbolOf = (u) => u) {
  if (!range || range.min === undefined || range.max === undefined) return null;
  return `${range.min} to ${range.max} ${symbolOf(range.unit)}`;
}

/**
 * Present one warning entry of one result.
 *
 * input: {
 *   result,          — the engine Result carrying the warning
 *   warning,         — one entry of result.warnings (engine order)
 *   variable,        — frozen adapter variable record
 *   displayedValue,  — string, precomputed by the controller (formatted)
 *   displayedUnit,   — unit id used for display
 *   siValue,         — result.value_si (number)
 *   inputSnapshot,   — {variableId, enteredValue, enteredUnit} | null
 *   upstreamRefs,    — result_ids of live consumers (affected results)
 *   confirmed,       — result_id ∈ confirmedResultIds
 * }
 * output: {title, observedValue, reason, continuationPolicy,
 *          affectedResults, actions[], developerFallback,
 *          code, resultId, canConfirm, ranges, misuseContext}
 */
export function presentWarning(input) {
  const { result, warning, variable, displayedValue, displayedUnit, siValue, inputSnapshot, upstreamRefs, confirmed } = input;
  const copy = copyFor(warning.code);
  const symbolOf = input.unitSymbolOf ?? ((u) => u);

  const canConfirm =
    result.source === "user_input" &&
    result.range_status === "extreme_warning" &&
    warning.code === "range_extreme" &&
    confirmed !== true;

  const actions = [];
  if (canConfirm) actions.push({ kind: "keep_original", text: "Keep original" });
  // Misuse actions collapse once the user has decided to keep the value
  // (ignore links into the same result_id-keyed confirmation flow).
  if (warning.code === "unit_misuse_suspected" && warning.context && confirmed !== true) {
    for (const suggestion of warning.context.suggestions) {
      actions.push({
        kind: "adopt_suggestion",
        text: `Adopt ${symbolOf(suggestion.unit_id)}`,
        suggestion: {
          variableId: warning.context.variable_id,
          enteredValue: warning.context.entered_value,
          suggestedUnit: suggestion.unit_id,
        },
      });
    }
    actions.push({ kind: "ignore_misuse", text: "Keep my input" });
  }

  const entered = inputSnapshot
    ? `${inputSnapshot.enteredValue} ${symbolOf(inputSnapshot.enteredUnit)}`
    : null;

  return {
    code: warning.code,
    resultId: result.result_id,
    title: copy.title,
    observedValue: `${displayedValue} ${displayedUnit}`,
    enteredValue: entered,
    reason:
      warning.code === "range_warning" || warning.code === "range_extreme" || warning.code === "range_invalid"
        ? `${variable.name} is ${displayedValue} ${displayedUnit}.`
        : warning.code === "unit_misuse_suspected" && warning.context
          ? `${variable.name} entered as ${warning.context.entered_value} ${symbolOf(warning.context.entered_unit)} is far outside its plausible range; the same number lands in the normal range as ${warning.context.suggestions.map((s) => symbolOf(s.unit_id)).join(", ")}.`
          : warning.message, // risk warnings carry catalog-authored copy
    continuationPolicy: copy.policy,
    affectedResults: [...(upstreamRefs ?? [])],
    actions,
    canConfirm,
    confirmed: confirmed === true,
    ranges: {
      normal: formatRange(variable.normal_range, symbolOf),
      warning: formatRange(variable.warning_range, symbolOf),
    },
    misuseContext: warning.code === "unit_misuse_suspected" ? warning.context ?? null : null,
    developerFallback: warning.message,
    siValue,
  };
}

/**
 * Present every warning of a result, preserving engine order.
 */
export function presentWarnings(result, shared) {
  return result.warnings.map((warning) => presentWarning({ ...shared, result, warning }));
}
