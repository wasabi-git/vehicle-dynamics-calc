/**
 * test_assumptions.mjs — §7.7 five behaviors on the real engine: disable
 * one / disable all / restore defaults / restore displaced (with
 * assumption_disabled routing) / enable-while-input-active message.
 */

import { createStore } from "../state/store.mjs";
import { submitValue } from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";
import {
  listAssumptions,
  setAssumptionFlow,
  disableAllAssumptions,
  restoreDefaultAssumptions,
  restoreAssumptionFlow,
  listConstants,
  RE_ENABLED_MESSAGE,
} from "../render/assumptions_controller.mjs";

export const name = "assumptions panel: §7.7 operation mapping";

export async function run(t) {
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store };

  t.section("panel lists the four registered assumptions, active by default");
  const rows = listAssumptions(app);
  t.ok("four assumable variables", rows.length === 4);
  t.ok("all default-enabled and Active",
    rows.every((r) => r.enabledByDefault && r.enabled && r.active));
  t.ok("default values are displayed", rows.every((r) => typeof r.valueText === "string"));

  t.section("1. disable one -> setAssumptionEnabled(id,false)");
  setAssumptionFlow(app, "road_grade_angle", false);
  t.ok("instance retired and row shows Disabled",
    !engine.getResults("road_grade_angle").some((r) => r.source === "assumption") &&
    listAssumptions(app).find((r) => r.variableId === "road_grade_angle").enabled === false);

  t.section("2. disable all");
  disableAllAssumptions(app);
  t.ok("no assumption instance remains",
    engine.getResults().every((r) => r.source !== "assumption"));

  t.section("3. restore defaults -> enable exactly the enabled_by_default set");
  restoreDefaultAssumptions(app);
  t.ok("all four default assumptions return Active",
    listAssumptions(app).every((r) => r.enabled && r.active));

  t.section("4. restore displaced (suppressed) assumption");
  submitValue(app, "road_grade_angle", "8.0", "degree"); // displaces the assumption
  const displacedRow = listAssumptions(app).find((r) => r.variableId === "road_grade_angle");
  t.ok("displaced: instance kept, not Active, user input present",
    displacedRow.enabled && !displacedRow.active && displacedRow.userInputPresent && displacedRow.displaced);
  engine.removeUserInput("road_grade_angle");
  t.ok("removing the input does NOT auto-restore (stays suppressed)",
    listAssumptions(app).find((r) => r.variableId === "road_grade_angle").active === false);
  const restored = restoreAssumptionFlow(app, "road_grade_angle");
  t.ok("explicit restore reactivates it",
    restored.ok === true &&
    listAssumptions(app).find((r) => r.variableId === "road_grade_angle").active === true);

  t.section("4b. restore on a disabled assumption routes to enable");
  setAssumptionFlow(app, "hitch_force", false);
  const routed = restoreAssumptionFlow(app, "hitch_force");
  t.ok("assumption_disabled is routed, not surfaced as a dead end",
    routed.ok === false && routed.routed === "enable_instead");
  setAssumptionFlow(app, "hitch_force", true);
  t.ok("the enable path then works",
    listAssumptions(app).find((r) => r.variableId === "hitch_force").active === true);

  t.section("5. enable/restore while a user input is Active");
  submitValue(app, "aerodynamic_drag", "310", "newton");
  setAssumptionFlow(app, "aerodynamic_drag", false);
  const reEnabled = setAssumptionFlow(app, "aerodynamic_drag", true);
  t.ok("assumption instance exists but the user input stays Active",
    engine.getResults("aerodynamic_drag").some((r) => r.source === "assumption" && !r.active) &&
    engine.getResults("aerodynamic_drag").some((r) => r.source === "user_input" && r.active));
  t.ok("the fixed re-enabled message is returned",
    reEnabled.reEnabledMessage === RE_ENABLED_MESSAGE);

  t.section("assumption toggling is a computational change");
  submitValue(app, "engine_torque", "310", "foot_pound_force");
  runSolve(app);
  setAssumptionFlow(app, "rolling_resistance", false);
  t.ok("phase turns needs_recalc after a toggle", store.state.calculationPhase === "needs_recalc");

  t.section("constants panel");
  const constants = listConstants(app);
  t.ok("gravity is visible with value and unit",
    constants.length === 1 && constants[0].variableId === "gravity" && constants[0].valueText.includes("m/s"));
}
