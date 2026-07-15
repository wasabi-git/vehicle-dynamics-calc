/**
 * path_view_model.mjs — path/formula status views.
 *
 * Sources: engine.queryTarget() and engine.getFormulaStatus(). These views
 * never hang off Result instances — they describe why something is NOT
 * available. Pure functions; no DOM, no engine mutation.
 */

/** Fixed missing-cause classes (key -> user-facing text). */
export const MISSING_CAUSE_CLASSES = Object.freeze({
  missing_input: "Missing input",
  invalid_input: "Invalid input",
  assumption_disabled: "Assumption disabled",
  applicability_or_constraint: "Applicability or constraint unsatisfied",
  model_selection_required: "Model selection required",
  recommended_model_unavailable: "Recommended model unavailable",
  circular_dependency: "Circular dependency",
  no_registered_direction: "No registered output direction",
  depth_limit_reached: "Depth limit reached",
  blocked_other: "Blocked (other)",
});

/** Fixed engine-reason-code -> cause-class table; unknown codes fall to blocked_other. */
const REASON_CLASS = Object.freeze({
  missing_input: "missing_input",
  assumption_not_allowed_for_formula: "missing_input",
  input_stale: "missing_input",
  input_invalid: "invalid_input",
  input_outside_valid_domain: "invalid_input",
  not_applicable: "applicability_or_constraint",
  constraint_unsatisfied: "applicability_or_constraint",
  condition_evaluation_failed: "applicability_or_constraint",
  no_registered_output_direction: "no_registered_direction",
});

export function classifyBlockedReason(code) {
  return REASON_CLASS[code] ?? "blocked_other";
}

/**
 * Refine the cause class of a missing variable: a variable that could come
 * from a registered assumption which is currently disabled or suppressed is
 * reported as "Assumption disabled" rather than a bare missing input.
 */
export function classifyMissingVariable(variableEntry) {
  const a = variableEntry.assumption;
  if (a && (a.enabled !== true || a.suppressed === true)) return "assumption_disabled";
  return "missing_input";
}

/** Cause class contributed by a recommendation state (R001), if any. */
export function classifyRecommendationMode(mode) {
  if (mode === "require_user_selection" || mode === "user_selection_unavailable") {
    return "recommended_model_unavailable";
  }
  return null;
}

function buildVariableView(entry) {
  return {
    variableId: entry.variable_id,
    canBeUserInput: entry.can_be_user_input === true,
    assumption: entry.assumption,
    causeClass: classifyMissingVariable(entry),
    causeText: MISSING_CAUSE_CLASSES[classifyMissingVariable(entry)],
    depthLimitReached: entry.depth_limit_reached === true,
    derivationOptions: (entry.derivation_options ?? []).map(buildPathView),
  };
}

function buildPathView(candidate) {
  if (candidate.cycle_detected === true) {
    return {
      formulaId: candidate.formula_id,
      cycleDetected: true,
      causeClass: "circular_dependency",
      causeText: MISSING_CAUSE_CLASSES.circular_dependency,
      status: "blocked",
      blockedReasons: [],
      missingInputs: [],
    };
  }
  return {
    formulaId: candidate.formula_id,
    modelGroup: candidate.model_group,
    modelName: candidate.model_name,
    pathRole: candidate.path_role,
    depth: candidate.depth,
    status: candidate.status,
    cycleDetected: false,
    blockedReasons: (candidate.blocked_reasons ?? []).map((r) => ({
      code: r.code,
      message: r.message,
      variableId: r.variable_id ?? null,
      causeClass: classifyBlockedReason(r.code),
      causeText: MISSING_CAUSE_CLASSES[classifyBlockedReason(r.code)],
    })),
    missingInputs: (candidate.missing_inputs ?? []).map(buildVariableView),
  };
}

/**
 * Build the target-query view from engine.queryTarget(variableId) output.
 */
export function buildTargetView(query) {
  return {
    target: query.target,
    ok: query.ok === true,
    outcome: query.outcome,
    canBeUserInput: query.can_be_user_input === true,
    noRegisteredDirection: query.outcome === "no_registered_direction",
    causeClass: query.outcome === "no_registered_direction" ? "no_registered_direction" : null,
    paths: (query.candidate_paths ?? []).map(buildPathView),
    diagnostics: query.diagnostics ?? [],
  };
}

/**
 * Build a view of engine.getFormulaStatus(formulaId) output
 * ({state, reasons, resultKey} or null).
 */
export function buildFormulaStatusView(status) {
  if (!status) return null;
  return {
    state: status.state,
    resultKey: status.resultKey ?? null,
    reasons: (status.reasons ?? []).map((r) => ({
      code: r.code,
      message: r.message,
      variableId: r.variable_id ?? null,
      causeClass: classifyBlockedReason(r.code),
      causeText: MISSING_CAUSE_CLASSES[classifyBlockedReason(r.code)],
    })),
  };
}
