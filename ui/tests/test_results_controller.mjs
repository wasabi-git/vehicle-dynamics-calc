/**
 * test_results_controller.mjs — solve flow, six button states, three-layer
 * results with fixed ordering, model section (verbatim reminder + R001
 * no-fallback message), stale marking, and the D25 seven-step flow with the
 * solve-only promotion assertion (§7.8).
 */

import { createStore } from "../state/store.mjs";
import { submitValue, confirmPending, cancelPending } from "../render/inputs_controller.mjs";
import {
  runSolve,
  selectModelFlow,
  requestUseDerived,
  buttonStateFor,
  buildResultsViewModel,
  buildModelSection,
  MODEL_DIFFERENCE_REMINDER,
  useDerivedConfirmText,
} from "../render/results_controller.mjs";

export const name = "results_controller: solve + layers + models + D25 (§7.8)";

async function fullScenario(t) {
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store };
  submitValue(app, "engine_torque", "310", "foot_pound_force");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute");
  submitValue(app, "combined_gear_ratio", "8.0", "decimal");
  submitValue(app, "drivetrain_efficiency", "0.90", "decimal");
  submitValue(app, "wheel_radius", "0.311", "meter");
  submitValue(app, "vehicle_weight", "3500", "pound_force");
  return app;
}

export async function run(t) {
  t.section("six button states");
  t.ok("idle disables Calculate", JSON.stringify(buttonStateFor("idle", null).enabled) === "false" && buttonStateFor("idle", null).text === "Calculate");
  t.ok("ready enables Calculate", buttonStateFor("ready", null).enabled === true && buttonStateFor("ready", null).text === "Calculate");
  t.ok("calculating shows Calculating…", buttonStateFor("calculating", null).text === "Calculating…" && buttonStateFor("calculating", null).enabled === false);
  t.ok("complete shows a finished state with the button parked", buttonStateFor("complete", null).enabled === false && buttonStateFor("complete", null).status.includes("up to date"));
  t.ok("needs_recalc enables Recalculate", buttonStateFor("needs_recalc", null).text === "Recalculate" && buttonStateFor("needs_recalc", null).enabled === true);
  const failed = buttonStateFor("failed", { ok: false, diagnostics: [{ severity: "error", message: "fixed point not reached" }] });
  t.ok("failed names the specific reason and allows retry", failed.enabled === true && failed.status.includes("fixed point not reached"));

  t.section("solve flow");
  const app = await fullScenario(t);
  const { engine, store } = app;
  t.ok("phase is ready before the first solve", store.state.calculationPhase === "ready");
  const phases = [];
  const unsub = store.subscribe((s) => phases.push(s.calculationPhase));
  const outcome = runSolve(app);
  unsub();
  t.ok("solve succeeds and records diagnostics", outcome.ok === true && store.state.lastSolveDiagnostics === outcome);
  t.ok("calculating phase was observable, then complete", phases.includes("calculating") && store.state.calculationPhase === "complete");
  t.ok("hasCompletedSolve is set and persists", store.state.hasCompletedSolve === true);

  t.section("three layers, display_role driven");
  const vm = buildResultsViewModel(app);
  const idsIn = (layer) => vm.layers[layer].map((v) => `${v.variableId}:${v.source}`);
  t.ok("primary layer holds the primary output", idsIn("primary").some((id) => id.startsWith("longitudinal_acceleration:derived")));
  t.ok("one hero card per primary variable: the non-active model twin stays in the model section",
    vm.layers.primary.filter((v) => v.variableId === "longitudinal_acceleration").length === 1 &&
    vm.layers.primary.find((v) => v.variableId === "longitudinal_acceleration").active === true);
  t.ok("intermediates are collapsed into their own layer",
    ["mass_factor", "vehicle_mass"].every((v) => idsIn("intermediate").some((id) => id.startsWith(`${v}:`))));
  t.ok("derived outputs sit in the secondary layer",
    ["vehicle_speed", "engine_power", "tractive_force"].every((v) => idsIn("secondary").some((id) => id === `${v}:derived`)));
  const allViews = [...vm.layers.primary, ...vm.layers.secondary, ...vm.layers.intermediate];
  t.ok("plain user inputs never duplicate into the results region",
    !allViews.some((v) => v.source === "user_input" && (v.variableId === "engine_torque" || v.variableId === "wheel_radius")));

  t.section("fixed ordering: strong warnings first");
  submitValue(app, "vehicle_speed", "4800", "mile_per_hour"); // whitelist literal in a wrong slot -> extreme warning
  const vmWarn = buildResultsViewModel(app);
  t.ok("an extreme-warning user input is promoted to the primary layer, first",
    vmWarn.layers.primary.length > 0 && vmWarn.layers.primary[0].variableId === "vehicle_speed" && vmWarn.layers.primary[0].rangeStatus === "extreme_warning");
  const removeReq = { engine, store };
  store.state.pendingConfirmation = { kind: "remove_input", payload: { variableId: "vehicle_speed" } };
  confirmPending(removeReq);
  runSolve(app);

  t.section("model section");
  const section = buildModelSection("longitudinal_acceleration", app);
  t.ok("both models appear as rows", section.rows.length === 2);
  t.ok("the verbatim multi-model reminder is attached", section.reminder === MODEL_DIFFERENCE_REMINDER);
  t.ok("recommended default carries no R001 message", section.recommendation.message === null);
  const activeRow = section.rows.find((r) => r.active);
  t.ok("recommended model is Active and not selectable", activeRow.model.name === "engine_limited_acceleration" && activeRow.selectable === false);

  t.section("explicit model selection");
  const sel = selectModelFlow(app, "longitudinal_acceleration", "ideal_constant_power_acceleration");
  t.ok("selection succeeds", sel.ok === true);
  const afterSel = buildModelSection("longitudinal_acceleration", app);
  t.ok("selected model becomes Active", afterSel.rows.find((r) => r.active).model.name === "ideal_constant_power_acceleration");
  t.ok("selection is a computational change (phase needs_recalc)", store.state.calculationPhase === "needs_recalc");
  runSolve(app);
  selectModelFlow(app, "longitudinal_acceleration", null);
  runSolve(app);
  t.ok("clearing the selection returns to the recommended default",
    buildModelSection("longitudinal_acceleration", app).rows.find((r) => r.active).model.name === "engine_limited_acceleration");

  t.section("R001 no-fallback message (recommended unavailable)");
  const partial = await (async () => {
    const { engine: e2, adapter: a2 } = await t.freshApp();
    const s2 = createStore();
    const app2 = { engine: e2, adapter: a2, store: s2 };
    submitValue(app2, "engine_torque", "310", "foot_pound_force");
    submitValue(app2, "engine_speed", "4800", "revolution_per_minute");
    submitValue(app2, "combined_gear_ratio", "8.0", "decimal");
    submitValue(app2, "wheel_radius", "0.311", "meter");
    submitValue(app2, "vehicle_weight", "3500", "pound_force");
    runSolve(app2);
    return app2;
  })();
  const partialSection = buildModelSection("longitudinal_acceleration", partial);
  t.ok("R001 message is surfaced when the recommended model is unavailable",
    typeof partialSection.recommendation.message === "string" && partialSection.recommendation.message.length > 0);
  t.ok("no automatic fallback: the ideal-model row is not Active",
    partialSection.rows.every((r) => r.active === false));
  const partialVm = buildResultsViewModel(partial);
  t.ok("with no Active instance the primary layer shows a selection-pending placeholder",
    partialVm.layers.primary.some((v) => v.kind === "selection_pending" && v.variableId === "longitudinal_acceleration"));
  t.ok("no hero card carries a non-active model value in that state",
    !partialVm.layers.primary.some((v) => v.variableId === "longitudinal_acceleration" && v.source === "derived"));

  t.section("stale marking touches only affected results");
  submitValue(app, "drivetrain_efficiency", "0.90", "decimal"); // new instance -> stale F004/F007 only
  const staleIds = engine.getResults().filter((r) => r.stale).map((r) => r.formula_id).sort();
  t.ok("exactly F004 and F007 are stale",
    JSON.stringify(staleIds) === JSON.stringify(["F004_tractive_force_from_engine_torque", "F007_engine_limited_acceleration"]));
  const vmStale = buildResultsViewModel(app);
  const staleViews = [...vmStale.layers.primary, ...vmStale.layers.secondary, ...vmStale.layers.intermediate].filter((v) => v.stale);
  t.ok("view flags stale on exactly those results",
    staleViews.every((v) => ["F004_tractive_force_from_engine_torque", "F007_engine_limited_acceleration"].includes(v.formulaId)) && staleViews.length === 2);
  runSolve(app);

  t.section("D25 seven-step flow (§7.8)");
  // user input for a variable that also has a derived twin
  submitValue(app, "vehicle_mass", "3500", "pound_mass");
  runSolve(app);
  const twins = engine.getResults("vehicle_mass");
  t.ok("user value and derived value coexist for comparison",
    twins.some((r) => r.source === "user_input" && r.active) && twins.some((r) => r.source === "derived" && !r.active));
  const vmTwin = buildResultsViewModel(app);
  const userRow = [...vmTwin.layers.primary, ...vmTwin.layers.secondary, ...vmTwin.layers.intermediate]
    .find((v) => v.variableId === "vehicle_mass" && v.source === "user_input");
  t.ok("the user row offers the D25 button", userRow && userRow.useDerivedButton === true);
  t.ok("confirmation copy names the variable",
    useDerivedConfirmText("Vehicle mass").startsWith("This removes your input for Vehicle mass."));

  requestUseDerived(app, "vehicle_mass");
  t.ok("request fills the single confirmation slot", store.state.pendingConfirmation.kind === "use_derived");
  cancelPending(app);
  t.ok("cancel keeps the user input active",
    engine.getResults("vehicle_mass").some((r) => r.source === "user_input" && r.active));

  requestUseDerived(app, "vehicle_mass");
  confirmPending(app);
  const afterConfirm = engine.getResults("vehicle_mass");
  t.ok("confirm removes the user input", afterConfirm.every((r) => r.source !== "user_input"));
  t.ok("the derived value is NOT promoted before the recalculation (promotion only in solve)",
    afterConfirm.every((r) => r.active === false));
  t.ok("dependents went stale and the button turned Recalculate",
    store.state.calculationPhase === "needs_recalc" &&
    buttonStateFor(store.state.calculationPhase, null).text === "Recalculate");
  runSolve(app);
  t.ok("after Recalculate the derived value is Active",
    engine.getResults("vehicle_mass").some((r) => r.source === "derived" && r.active === true));
}
