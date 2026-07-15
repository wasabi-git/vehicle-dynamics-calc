/**
 * test_view_model.mjs — deriveLabels matrix, display_role fallback, and
 * significant-figure formatting, against the real engine and catalog.
 */

import {
  PRECISION,
  formatSignificant,
  deriveLabels,
  displayRoleOf,
  hasOtherModelInstances,
  buildResultView,
  LABELS,
} from "../adapter/view_model.mjs";
import { createStore } from "../state/store.mjs";

export const name = "view_model: labels + formatting (§7.2b)";

const keysOf = (labels) => labels.map((l) => l.key);

export async function run(t) {
  t.section("formatSignificant");
  t.ok("4 significant figures on a sub-unity value", formatSignificant(0.311, 4) === "0.3110");
  t.ok("4 significant figures on an integer value", formatSignificant(310, 4) === "310.0");
  t.ok("6 significant figures for SI expansion", formatSignificant(0.311, 6) === "0.311000");
  t.ok("non-finite values fall back to String()", formatSignificant(Number.NaN, 4) === "NaN");
  t.ok("precision constants match the tokens.css parameters", PRECISION.result === 4 && PRECISION.si === 6);

  t.section("display_role fallback");
  t.ok("missing display_role falls back to derived_output", displayRoleOf({}) === "derived_output");
  t.ok("null variable falls back to derived_output", displayRoleOf(null) === "derived_output");

  t.section("real-engine label matrix (whitelist scenario)");
  const { engine, adapter } = await t.freshApp();
  const store = createStore();

  engine.setUserInput("engine_torque", 310, "foot_pound_force");
  engine.setUserInput("engine_speed", 4800, "revolution_per_minute");
  engine.setUserInput("combined_gear_ratio", 8.0, "decimal");
  engine.setUserInput("drivetrain_efficiency", 0.90, "decimal");
  engine.setUserInput("wheel_radius", 0.311, "meter");
  engine.setUserInput("vehicle_weight", 3500, "pound_force");
  const solved = engine.solve();
  t.ok("full whitelist scenario solves", solved.ok === true);

  const accel = engine.getResults("longitudinal_acceleration");
  const f007 = accel.find((r) => r.formula_id === "F007_engine_limited_acceleration");
  const f008 = accel.find((r) => r.formula_id === "F008_ideal_power_acceleration_si");
  t.ok("both acceleration models derived", Boolean(f007) && Boolean(f008));

  const ctx007 = {
    confirmedResultIds: store.state.confirmedResultIds,
    otherModelExists: hasOtherModelInstances(f007, accel),
  };
  const ctx008 = {
    confirmedResultIds: store.state.confirmedResultIds,
    otherModelExists: hasOtherModelInstances(f008, accel),
  };
  const labels007 = keysOf(deriveLabels(f007, ctx007));
  const labels008 = keysOf(deriveLabels(f008, ctx008));
  t.ok(
    "recommended model result: Active + Different model + Uses assumptions",
    labels007.includes("active") &&
      labels007.includes("different_model") &&
      labels007.includes("uses_assumptions") &&
      !labels007.includes("alternative")
  );
  t.ok(
    "non-active model result: Alternative + Different model, no assumptions",
    labels008.includes("alternative") &&
      labels008.includes("different_model") &&
      !labels008.includes("uses_assumptions") &&
      !labels008.includes("active")
  );

  t.section("warning / confirmed / stale / invalid labels");
  const misuse = engine.setUserInput("wheel_radius", 13.8, "foot");
  t.ok("13.8 ft wheel radius stores as extreme_warning", misuse.ok && misuse.result.range_status === "extreme_warning");
  const misuseLabels = keysOf(
    deriveLabels(misuse.result, { confirmedResultIds: store.state.confirmedResultIds, otherModelExists: false })
  );
  t.ok("extreme-warning input carries the Warning label", misuseLabels.includes("warning"));
  store.state.confirmedResultIds.add(misuse.result.result_id);
  const confirmedLabels = keysOf(
    deriveLabels(misuse.result, { confirmedResultIds: store.state.confirmedResultIds, otherModelExists: false })
  );
  t.ok("confirmation adds User confirmed warning", confirmedLabels.includes("user_confirmed_warning"));

  t.ok("editing an input stales downstream results", engine.getResults().some((r) => r.stale));
  const staleResult = engine.getResults().find((r) => r.stale);
  const staleLabels = keysOf(
    deriveLabels(staleResult, { confirmedResultIds: new Set(), otherModelExists: false })
  );
  t.ok("stale result carries Needs recalculation", staleLabels.includes("needs_recalculation"));

  const invalid = engine.setUserInput("aspect_ratio", 310, "percent");
  t.ok("whitelist literal 310 percent aspect ratio is range-invalid", invalid.ok && invalid.result.range_status === "invalid");
  const invalidLabels = keysOf(
    deriveLabels(invalid.result, { confirmedResultIds: new Set(), otherModelExists: false })
  );
  t.ok(
    "invalid result carries Invalid and Warning, never Alternative",
    invalidLabels.includes("invalid") && invalidLabels.includes("warning") && !invalidLabels.includes("alternative")
  );

  t.section("Different model requires a derived source and a model");
  const torque = engine.getResults("engine_torque").find((r) => r.source === "user_input");
  t.ok(
    "user inputs never get Different model even with model context",
    hasOtherModelInstances(torque, engine.getResults("engine_torque")) === false
  );

  t.section("buildResultView");
  const view = buildResultView(f007, { engine, adapter, store });
  t.ok("view carries the variable name and symbol from the frozen adapter",
    view.variableName === adapter.variablesById.longitudinal_acceleration.name &&
    view.symbol === adapter.variablesById.longitudinal_acceleration.symbol);
  t.ok("view display unit defaults to the variable default_unit",
    view.display.unitId === adapter.variablesById.longitudinal_acceleration.default_unit);
  t.ok("view display text uses 4 significant figures",
    view.display.ok && view.display.text === formatSignificant(view.display.rawValue, 4));
  t.ok("view SI expansion uses 6 significant figures",
    view.si.text === formatSignificant(f007.value_si, 6));
  t.ok("view model carries the catalog display name",
    view.model !== null && view.model.displayName === adapter.modelsById[f007.model.name].display_name);
  t.ok("display-unit override in the store changes only the view",
    (() => {
      store.state.displayUnitByVariableId.set("longitudinal_acceleration", "foot_per_second_squared");
      const overridden = buildResultView(f007, { engine, adapter, store });
      return overridden.display.unitId === "foot_per_second_squared" && overridden.si.text === view.si.text;
    })());

  t.section("label vocabulary is closed (D24: no Conflict/Verified)");
  t.ok(
    "LABELS contains exactly the eight approved keys",
    JSON.stringify(Object.keys(LABELS).sort()) ===
      JSON.stringify([
        "active",
        "alternative",
        "different_model",
        "invalid",
        "needs_recalculation",
        "user_confirmed_warning",
        "uses_assumptions",
        "warning",
      ])
  );
}
