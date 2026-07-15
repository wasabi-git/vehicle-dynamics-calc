/**
 * store.mjs — UI state store.
 *
 * Registry: exactly the fifteen items documented in docs/UI.md (core ten +
 * supplementary five). Any further item must be registered there first.
 * Component-local ephemeral state (focus, hover, running animations) stays
 * outside the store and outside the test contract.
 *
 * The store never talks to the engine. Controllers mutate state through
 * the store and call notify(); the render layer subscribes.
 */

export function createStore() {
  const state = {
    // ---- core ten ----------------------------------------------------------
    /** variableId -> uncommitted draft text ("-", ".", ""); never sent to setUserInput */
    inputDraftByVariableId: new Map(),
    /** result_id -> {variableId, enteredValue, enteredUnit}; survives the session incl. retired */
    inputSnapshotByResultId: new Map(),
    /** variableId -> display unit id (display-only; zero engine effect) */
    displayUnitByVariableId: new Map(),
    /** result_ids whose extreme warning the user confirmed to keep */
    confirmedResultIds: new Set(),
    /** result_ids with expanded derivation details */
    expandedResultIds: new Set(),
    /** reverse-query target variable id or null */
    selectedTarget: null,
    /** idle | ready | calculating | needs_recalc | complete | failed */
    calculationPhase: "idle",
    /** true after the first successful user-triggered solve; stays true for the session */
    hasCompletedSolve: false,
    /** variableIds in the order the user added them (stable row order) */
    uiInputOrder: [],
    /** most recent solve outcome: null | {ok, diagnostics}; controllers reset
     *  it to null when calculation conditions change after a failed solve */
    lastSolveDiagnostics: null,

    // ---- supplementary five ------------------------------------------------
    /** Inputs search text */
    variableSearchQuery: "",
    /** Inputs category filter (category id or null = all) */
    selectedCategory: null,
    /** variableId -> {kind, message} for unfinished drafts and invalid rows */
    inputDiagnosticByVariableId: new Map(),
    /** single slot: null | {kind: "clear_all"|"remove_input"|"use_derived", payload} */
    pendingConfirmation: null,
    /** variableId flashed after a duplicate add; cleared on timeout */
    highlightedVariableId: null,
  };

  const listeners = new Set();

  return {
    state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of [...listeners]) listener(state);
    },
  };
}

/**
 * Effective user inputs: submitted (present in the pool — drafts never call
 * setUserInput) and not range-invalid. Constants and default-assumption
 * instances never count.
 */
export function countEffectiveUserInputs(engine) {
  return engine
    .getResults()
    .filter((r) => r.source === "user_input" && r.range_status !== "invalid")
    .length;
}

/** Any stale instance in the pool (only derived results ever go stale). */
export function hasStaleInstances(engine) {
  return engine.getResults().some((r) => r.stale === true);
}

/** lastSolveDiagnostics -> did the most recent solve fail? */
export function solveFailed(lastSolve) {
  if (lastSolve === null || lastSolve === undefined) return false;
  if (lastSolve.ok !== true) return true;
  return (lastSolve.diagnostics ?? []).some((d) => d.severity === "error");
}

/**
 * calculationPhase decision procedure (fixed priority order, no gaps):
 *   1. calculating while a solve executes;
 *   2. failed while the most recent solve failed (controllers null out
 *      lastSolve when calculation conditions change, which re-judges);
 *   3. before the first completed solve: >=1 effective user input -> ready,
 *      otherwise idle (invalid rows and drafts are tolerated in idle; the
 *      Calculate action stays disabled);
 *   4. after the first completed solve: stale instances or an
 *      unrecalculated computational change -> needs_recalc, else complete.
 */
export function judgeCalculationPhase({
  isCalculating,
  lastSolve,
  hasCompletedSolve,
  effectiveUserInputCount,
  hasStale,
  hasUnrecalculatedChange,
}) {
  if (isCalculating === true) return "calculating";
  if (solveFailed(lastSolve)) return "failed";
  if (hasCompletedSolve !== true) {
    return effectiveUserInputCount >= 1 ? "ready" : "idle";
  }
  return hasStale === true || hasUnrecalculatedChange === true ? "needs_recalc" : "complete";
}
