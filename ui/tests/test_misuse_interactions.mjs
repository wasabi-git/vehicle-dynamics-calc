/**
 * test_misuse_interactions.mjs — §7.3 track 3 / C7: adopting a unit-misuse
 * suggestion re-calls setUserInput with the same number in the suggested
 * unit; ignoring is zero engine operations and links into the
 * result_id-keyed confirmation flow; the engine never switches units on its
 * own. Confirmed example: 13.8 ft wheel radius -> 13.8 in.
 */

import { createStore } from "../state/store.mjs";
import {
  submitValue,
  adoptMisuseSuggestion,
  ignoreMisuseSuggestion,
} from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";
import { presentResultWarnings } from "../render/warnings_controller.mjs";

export const name = "misuse interactions: adopt / ignore (§7.3.3, C7)";

function poolFingerprint(engine) {
  return JSON.stringify(
    engine.getResults().map((r) => `${r.result_id}:${r.stale}:${r.active}`).sort()
  );
}

export async function run(t) {
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store };

  submitValue(app, "engine_torque", "310", "foot_pound_force");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute");
  submitValue(app, "combined_gear_ratio", "8.0", "decimal");
  submitValue(app, "drivetrain_efficiency", "0.90", "decimal");
  submitValue(app, "vehicle_weight", "3500", "pound_force");
  const misused = submitValue(app, "wheel_radius", "13.8", "foot").result;
  runSolve(app);

  t.section("the engine never switches units on its own");
  t.ok("the stored instance keeps the entered physical value (13.8 ft in SI)",
    Math.abs(misused.value_si - 13.8 * 0.3048) < 1e-9);
  const misuseWarning = misused.warnings.find((w) => w.code === "unit_misuse_suspected");
  t.ok("misuse warning suggests inch with the SAME number",
    misuseWarning.context.entered_value === 13.8 &&
    misuseWarning.context.suggestions.some((s) => s.unit_id === "inch"));

  t.section("ignore: zero engine operations, linked into the confirmation flow");
  const before = poolFingerprint(engine);
  const presented = presentResultWarnings(app, misused).find((p) => p.code === "unit_misuse_suspected");
  t.ok("misuse banner offers adopt + keep-my-input",
    presented.actions.map((a) => a.kind).join(",") === "adopt_suggestion,ignore_misuse");
  ignoreMisuseSuggestion(app, misused.result_id);
  t.ok("pool untouched by ignore", poolFingerprint(engine) === before);
  t.ok("ignore records the result_id in confirmedResultIds",
    store.state.confirmedResultIds.has(misused.result_id));
  const afterIgnore = presentResultWarnings(app, misused);
  t.ok("misuse actions collapse once confirmed",
    afterIgnore.find((p) => p.code === "unit_misuse_suspected").actions.length === 0);
  t.ok("range banner reports the confirmed state",
    afterIgnore.find((p) => p.code === "range_extreme").confirmed === true);

  t.section("natural reset: a replacement instance resurfaces the suggestion");
  const replaced = submitValue(app, "wheel_radius", "13.8", "foot").result;
  t.ok("new result_id is unconfirmed with live actions",
    presentResultWarnings(app, replaced)
      .find((p) => p.code === "unit_misuse_suspected")
      .actions.length === 2);

  t.section("adopt: setUserInput(id, same number, suggested unit)");
  runSolve(app);
  const suggestion = presentResultWarnings(app, replaced)
    .find((p) => p.code === "unit_misuse_suspected")
    .actions.find((a) => a.kind === "adopt_suggestion").suggestion;
  t.ok("suggestion carries the original number and the inch unit",
    suggestion.enteredValue === 13.8 && suggestion.suggestedUnit === "inch" && suggestion.variableId === "wheel_radius");
  const adopted = adoptMisuseSuggestion(app, suggestion);
  t.ok("adoption mints a new user-input instance", adopted.submitted === true && adopted.result.result_id !== replaced.result_id);
  t.ok("the physical value changed (13.8 in, in SI)",
    Math.abs(adopted.result.value_si - 13.8 * 0.0254) < 1e-9);
  t.ok("the adopted value lands in the normal range with no misuse warning",
    adopted.result.range_status === "normal" && adopted.result.warnings.length === 0);
  t.ok("snapshot records the adopted unit", (() => {
    const s = store.state.inputSnapshotByResultId.get(adopted.result.result_id);
    return s.enteredValue === 13.8 && s.enteredUnit === "inch";
  })());
  t.ok("the row display unit follows the adopted unit",
    store.state.displayUnitByVariableId.get("wheel_radius") === "inch");
  t.ok("dependents went stale and Recalculate is required",
    engine.getResults().some((r) => r.stale) && store.state.calculationPhase === "needs_recalc");
  runSolve(app);
  t.ok("after recalculation the chain is fresh again",
    engine.getResults().every((r) => r.stale === false) && store.state.calculationPhase === "complete");
}
