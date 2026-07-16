/**
 * test_derivation_view.mjs — eight-level derivation detail (§ Part 2
 * derivation display), snapshot-reconstructed conversion rows (§7.4), the
 * three verbatim no-result states, and expand/collapse bookkeeping.
 */

import { createStore } from "../state/store.mjs";
import { submitValue, confirmPending } from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";
import {
  buildDerivationDetail,
  noResultState,
  NO_RESULT_TEXT,
  toggleExpanded,
} from "../render/derivation_controller.mjs";

export const name = "derivation detail: eight levels + no-result states";

export async function run(t) {
  t.section("no-result state 1: nothing calculated yet (verbatim)");
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store };
  t.ok("state not_calculated before the first solve", noResultState(app) === "not_calculated");
  t.ok("copy is verbatim",
    NO_RESULT_TEXT.not_calculated === "No calculated results yet. Add known values and select Calculate." &&
    NO_RESULT_TEXT.nothing_derivable === "No result can currently be calculated. See Missing Conditions for required inputs." &&
    NO_RESULT_TEXT.target_unavailable === "Some results were calculated, but the requested result is not available. See Missing Conditions.");

  t.section("no-result state 2: solved but nothing derivable");
  submitValue(app, "engine_torque", "310", "foot_pound_force"); // torque alone derives nothing
  runSolve(app);
  t.ok("state nothing_derivable", noResultState(app) === "nothing_derivable");

  t.section("no-result state 3: partial results, requested target unavailable");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute"); // F003 power derives
  runSolve(app);
  store.state.selectedTarget = "tractive_force";
  t.ok("state target_unavailable", noResultState(app) === "target_unavailable");
  store.state.selectedTarget = "engine_power";
  t.ok("an available target clears the state", noResultState(app) === null);
  store.state.selectedTarget = null;

  t.section("eight-level derivation detail");
  submitValue(app, "combined_gear_ratio", "8.0", "decimal");
  submitValue(app, "drivetrain_efficiency", "0.90", "decimal");
  submitValue(app, "wheel_radius", "0.311", "meter");
  submitValue(app, "vehicle_weight", "3500", "pound_force");
  runSolve(app);
  const f007 = engine.getResults("longitudinal_acceleration").find((r) => r.formula_id === "F007_engine_limited_acceleration");
  const d = buildDerivationDetail(app, f007);
  t.ok("1 summary is an engineering sentence naming the inputs",
    d.summary.startsWith("Longitudinal acceleration was derived from") && !d.summary.includes("F00"));
  t.ok("2 formula: name + parsed tree (no fallback)",
    d.formulaName.length > 0 && d.formulaTree.type !== "fallback");
  t.ok("3 substitution rows cover every dependency",
    d.substitutions.length === f007.dependencies.length);
  t.ok("4 conversion rows reconstruct entered -> SI from the snapshot (§7.4)",
    (() => {
      // F007's direct dependencies are derived/assumption instances, so the
      // entered→SI reconstruction is asserted on F004, whose direct
      // dependencies are the user inputs themselves.
      const dF004 = buildDerivationDetail(app, engine.getResults("tractive_force").find((r) => r.source === "derived"));
      const torqueRow = dF004.substitutions.find((s) => s.variableId === "engine_torque");
      // units render as registered display symbols (owner-directed C10)
      return torqueRow.entered === "310 ft·lbf" && torqueRow.conversion.includes("→") && torqueRow.conversion.includes("N·m");
    })());
  t.ok("5 intermediates list the derived dependencies with their formulas",
    d.intermediates.some((i) => i.variableId === "tractive_force" && i.formulaId));
  t.ok("6 assumptions and constants are named",
    d.assumptionsUsed.length === 4 &&
    buildDerivationDetail(app, engine.getResults("vehicle_mass").find((r) => r.source === "derived")).constants.some((c) => c.variableId === "gravity"));
  t.ok("7 sources come only through the presenter; dependencies and path are listed",
    d.sources.every((s) => JSON.stringify(Object.keys(s).sort()) === JSON.stringify(["label", "locator", "note"])) &&
    d.dependencyIds.length === f007.dependencies.length &&
    d.formulaPath[d.formulaPath.length - 1] === "F007_engine_limited_acceleration");
  t.ok("8 stale/warning notes", d.stale === false && typeof d.warningCount === "number");

  t.section("per-path details: the non-active model has its own");
  const f008 = engine.getResults("longitudinal_acceleration").find((r) => r.formula_id === "F008_ideal_power_acceleration_si");
  const d8 = buildDerivationDetail(app, f008);
  t.ok("F008 detail is independent and names its own path",
    d8.formulaPath[d8.formulaPath.length - 1] === "F008_ideal_power_acceleration_si" && d8.resultId !== d.resultId);

  t.section("stale chain: superseded dependencies are marked, snapshots survive");
  submitValue(app, "wheel_radius", "0.311", "meter"); // new instance -> downstream stale
  const staleF004 = engine.getResults("tractive_force").find((r) => r.source === "derived");
  const dStale = buildDerivationDetail(app, staleF004);
  t.ok("stale detail flags the superseded input row via the retired instance",
    dStale.stale === true && dStale.substitutions.some((s) => s.variableId === "wheel_radius" && s.retired === true));
  t.ok("the retired row still reconstructs its entered value from the snapshot",
    dStale.substitutions.find((s) => s.variableId === "wheel_radius").entered === "0.311 m");
  runSolve(app);

  t.section("expand/collapse bookkeeping");
  toggleExpanded(app, f007.result_id, true);
  t.ok("expanded set records the result", store.state.expandedResultIds.has(f007.result_id));
  toggleExpanded(app, f007.result_id, false);
  t.ok("collapse removes it", !store.state.expandedResultIds.has(f007.result_id));
}
