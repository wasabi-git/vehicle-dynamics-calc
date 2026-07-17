/**
 * test_targets.mjs — C8: reverse-query region logic — §7.10 fixed rules
 * (missing-path ordering, recommended next input, no-target default) and
 * their repeatability across fresh engines.
 */

import { createStore } from "../state/store.mjs";
import { submitValue } from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";
import {
  pathMetrics,
  comparePaths,
  recommendNextInput,
  queryTargetView,
  defaultTargets,
  selectTarget,
  groupTargetOptions,
} from "../render/targets_controller.mjs";

export const name = "targets: §7.10 fixed rules + reverse-query views";

export async function run(t) {
  t.section("empty pool: ordered candidate paths for the primary output");
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store };
  const view = queryTargetView(app, "longitudinal_acceleration");
  t.ok("two candidate paths", view.paths.length === 2);
  t.ok("fewest missing sorts first: F008 (3 missing) before F007 (4 missing, incl. vehicle_weight)",
    view.paths[0].formulaId === "F008_ideal_power_acceleration_si" &&
    pathMetrics(view.paths[0]).missing === 3 &&
    pathMetrics(view.paths[1]).missing === 4);
  t.ok("formula_id breaks exact ties",
    comparePaths(
      { cycleDetected: false, formulaId: "F00A", missingInputs: [] },
      { cycleDetected: false, formulaId: "F00B", missingInputs: [] }
    ) < 0);

  t.section("repeatability across fresh engines (fixed rules, never program order)");
  const { engine: e2 } = await t.freshApp();
  const view2 = queryTargetView({ engine: e2 }, "longitudinal_acceleration");
  t.ok("same order and same path set on a fresh engine",
    JSON.stringify(view.paths.map((p) => p.formulaId)) === JSON.stringify(view2.paths.map((p) => p.formulaId)));
  t.ok("comparePaths is deterministic under re-sorting",
    JSON.stringify([...view.paths].reverse().sort(comparePaths).map((p) => p.formulaId)) ===
    JSON.stringify(view.paths.map((p) => p.formulaId)));

  t.section("missing counts drive the order");
  submitValue(app, "engine_torque", "310", "foot_pound_force");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute");
  submitValue(app, "combined_gear_ratio", "8.0", "decimal");
  submitValue(app, "wheel_radius", "0.311", "meter");
  runSolve(app); // F002 vehicle_speed + F003 engine_power + F005 mass_factor now exist
  const after = queryTargetView(app, "longitudinal_acceleration");
  const metrics = Object.fromEntries(after.paths.map((p) => [p.formulaId, pathMetrics(p).missing]));
  t.ok("F008 now misses only vehicle_mass; F007 still misses three",
    metrics.F008_ideal_power_acceleration_si === 1 && metrics.F007_engine_limited_acceleration === 3);
  t.ok("fewest-missing path moves first",
    after.paths[0].formulaId === "F008_ideal_power_acceleration_si");

  t.section("recommended next input: most-frequent missing inputtable variable");
  t.ok("vehicle_mass appears on both paths and wins",
    after.recommendedNext === "vehicle_mass");
  const tie = recommendNextInput([
    { cycleDetected: false, missingInputs: [{ variableId: "b_var", canBeUserInput: true, derivationOptions: [] }] },
    { cycleDetected: false, missingInputs: [{ variableId: "a_var", canBeUserInput: true, derivationOptions: [] }] },
  ]);
  t.ok("frequency ties break by variable_id", tie === "a_var");
  t.ok("non-inputtable variables are never recommended",
    recommendNextInput([{ cycleDetected: false, missingInputs: [{ variableId: "x", canBeUserInput: false, derivationOptions: [] }] }]) === null);

  t.section("no-target default: unmet primary outputs only");
  t.ok("before completion the primary output is offered",
    JSON.stringify(defaultTargets(app)) === JSON.stringify(["longitudinal_acceleration"]));
  submitValue(app, "drivetrain_efficiency", "0.90", "decimal");
  submitValue(app, "vehicle_weight", "3500", "pound_force");
  runSolve(app);
  t.ok("after the chain completes, no default target remains", defaultTargets(app).length === 0);

  t.section("target selection lands in the store");
  selectTarget(app, "tractive_force");
  t.ok("selectedTarget records the choice", store.state.selectedTarget === "tractive_force");
  selectTarget(app, "");
  t.ok("clearing returns to null", store.state.selectedTarget === null);

  t.section("C9R9: honest target grouping (19 = 4 primary + 3 intermediates + 12 input-only)");
  const groups = groupTargetOptions(adapter);
  t.ok("primary results are the four user-facing answers",
    JSON.stringify([...groups.primary].sort()) ===
    JSON.stringify(["engine_power", "longitudinal_acceleration", "tractive_force", "vehicle_speed"]));
  t.ok("derived intermediates are the three intermediate producers",
    JSON.stringify([...groups.intermediates].sort()) ===
    JSON.stringify(["mass_factor", "vehicle_mass", "wheel_radius"]));
  t.ok("twelve variables are direct-input only (no registered output direction)",
    groups.inputOnly.length === 12 &&
    groups.inputOnly.every((id) => !adapter.formulas.some((f) => f.output === id)));
  t.ok("constants never appear and the groups cover all 19 options exactly once",
    (() => {
      const all = [...groups.primary, ...groups.intermediates, ...groups.inputOnly];
      return all.length === 19 && new Set(all).size === 19 && !all.includes("gravity");
    })());

  t.section("no-registered-direction target (fresh engine, no user input present)");
  const torque = queryTargetView({ engine: e2 }, "engine_torque");
  t.ok("engine_torque reports no registered direction with the engine's message",
    torque.noRegisteredDirection && torque.diagnostics.some((d) => d.code === "no_registered_output_direction"));

  t.section("U1: satisfiedInputs through the sorted controller view");
  const { engine: e5, adapter: a5 } = await t.freshApp();
  e5.setUserInput("engine_torque", 310, "foot_pound_force");
  e5.setUserInput("engine_speed", 4800, "revolution_per_minute");
  const withAdapter = queryTargetView({ engine: e5, adapter: a5 }, "longitudinal_acceleration");
  const f007Sorted = withAdapter.paths.find((p) => p.formulaId === "F007_engine_limited_acceleration");
  t.ok("path ordering keeps the satisfied list intact (F007: the four default assumptions)",
    JSON.stringify(f007Sorted.satisfiedInputs) ===
    JSON.stringify(["aerodynamic_drag", "rolling_resistance", "road_grade_angle", "hitch_force"]));
  const withoutAdapter = queryTargetView({ engine: e5 }, "longitudinal_acceleration");
  t.ok("the no-adapter call form still reports satisfiedInputs === null on every path",
    withoutAdapter.paths.length > 0 && withoutAdapter.paths.every((p) => p.satisfiedInputs === null));
}
