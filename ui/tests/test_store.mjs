/**
 * test_store.mjs — store registry and calculationPhase decision procedure.
 */

import {
  createStore,
  countEffectiveUserInputs,
  hasStaleInstances,
  solveFailed,
  judgeCalculationPhase,
} from "../state/store.mjs";

export const name = "store: registry + calculationPhase (§7.2)";

const REGISTERED_ITEMS = [
  // core ten
  "inputDraftByVariableId",
  "inputSnapshotByResultId",
  "displayUnitByVariableId",
  "confirmedResultIds",
  "expandedResultIds",
  "selectedTarget",
  "calculationPhase",
  "hasCompletedSolve",
  "uiInputOrder",
  "lastSolveDiagnostics",
  // supplementary five
  "variableSearchQuery",
  "selectedCategory",
  "inputDiagnosticByVariableId",
  "pendingConfirmation",
  "highlightedVariableId",
];

export async function run(t) {
  t.section("registry");
  const store = createStore();
  const keys = Object.keys(store.state).sort();
  t.ok(
    "store holds exactly the fifteen registered items (docs/UI.md registry)",
    JSON.stringify(keys) === JSON.stringify([...REGISTERED_ITEMS].sort())
  );

  let notified = 0;
  const unsubscribe = store.subscribe(() => { notified += 1; });
  store.notify();
  unsubscribe();
  store.notify();
  t.ok("subscribe/notify/unsubscribe round-trips", notified === 1);

  t.section("judgeCalculationPhase priority matrix (full coverage)");
  const base = {
    isCalculating: false,
    lastSolve: null,
    hasCompletedSolve: false,
    effectiveUserInputCount: 0,
    hasStale: false,
    hasUnrecalculatedChange: false,
  };
  t.ok(
    "calculating wins over everything",
    judgeCalculationPhase({ ...base, isCalculating: true, lastSolve: { ok: false, diagnostics: [] }, hasCompletedSolve: true, hasStale: true }) === "calculating"
  );
  t.ok(
    "failed comes second (solve not ok)",
    judgeCalculationPhase({ ...base, lastSolve: { ok: false, diagnostics: [] }, hasCompletedSolve: true, hasStale: true }) === "failed"
  );
  t.ok(
    "failed also triggers on error-severity diagnostics with ok=true",
    judgeCalculationPhase({ ...base, lastSolve: { ok: true, diagnostics: [{ severity: "error" }] } }) === "failed"
  );
  t.ok(
    "controllers null lastSolve on computational change: failure no longer short-circuits",
    judgeCalculationPhase({ ...base, lastSolve: null, hasCompletedSolve: true, hasStale: true }) === "needs_recalc"
  );
  t.ok(
    "before first solve, zero effective inputs -> idle",
    judgeCalculationPhase(base) === "idle"
  );
  t.ok(
    "before first solve, one effective input -> ready",
    judgeCalculationPhase({ ...base, effectiveUserInputCount: 1 }) === "ready"
  );
  t.ok(
    "after first solve, stale instances -> needs_recalc",
    judgeCalculationPhase({ ...base, hasCompletedSolve: true, hasStale: true }) === "needs_recalc"
  );
  t.ok(
    "after first solve, unrecalculated change -> needs_recalc",
    judgeCalculationPhase({ ...base, hasCompletedSolve: true, hasUnrecalculatedChange: true }) === "needs_recalc"
  );
  t.ok(
    "after first solve, no stale and no change -> complete",
    judgeCalculationPhase({ ...base, hasCompletedSolve: true }) === "complete"
  );
  t.ok("solveFailed(null) is false (no solve yet)", solveFailed(null) === false);

  t.section("real engine: initialization instances never count as calculated");
  const { engine } = await t.freshApp();
  t.ok(
    "fresh engine pool is non-empty (constants + default assumptions)",
    engine.getResults().length > 0
  );
  t.ok("fresh engine has zero effective user inputs", countEffectiveUserInputs(engine) === 0);
  t.ok(
    "fresh engine judges idle despite the non-empty pool",
    judgeCalculationPhase({ ...base, effectiveUserInputCount: countEffectiveUserInputs(engine) }) === "idle"
  );

  t.section("real engine: invalid-only input stays idle (Calculate disabled)");
  const invalid = engine.setUserInput("drivetrain_efficiency", 8.0, "decimal");
  t.ok("whitelist literal 8.0 decimal stores as range-invalid efficiency", invalid.ok === true && invalid.result.range_status === "invalid");
  t.ok("invalid input does not count as effective", countEffectiveUserInputs(engine) === 0);
  t.ok(
    "phase stays idle with only an invalid input",
    judgeCalculationPhase({ ...base, effectiveUserInputCount: countEffectiveUserInputs(engine) }) === "idle"
  );

  t.section("real engine: drafts never reach the engine");
  const store2 = createStore();
  store2.state.inputDraftByVariableId.set("engine_torque", "-");
  store2.state.inputDraftByVariableId.set("vehicle_weight", ".");
  t.ok(
    "drafts live in the store only; engine pool has no such user inputs",
    engine.getResults().filter((r) => r.source === "user_input").length === 1
  );

  t.section("real engine: effective input and stale detection");
  const okInput = engine.setUserInput("engine_torque", 310, "foot_pound_force");
  t.ok("310 ft·lbf torque stores as a normal effective input", okInput.ok === true && countEffectiveUserInputs(engine) === 1);
  t.ok("no stale instances before any derivation", hasStaleInstances(engine) === false);
  engine.setUserInput("engine_speed", 4800, "revolution_per_minute");
  const solved = engine.solve();
  t.ok("solve succeeds on the real catalog", solved.ok === true);
  engine.setUserInput("engine_speed", 4800, "revolution_per_minute"); // new instance, same value
  t.ok("re-submitting an input stales its derived consumers", hasStaleInstances(engine) === true);
  t.ok(
    "after first solve with stale instances the phase is needs_recalc",
    judgeCalculationPhase({
      ...base,
      hasCompletedSolve: true,
      effectiveUserInputCount: countEffectiveUserInputs(engine),
      hasStale: hasStaleInstances(engine),
    }) === "needs_recalc"
  );
}
