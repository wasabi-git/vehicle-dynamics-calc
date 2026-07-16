/**
 * test_comparison.mjs — §7.14 absolute-value difference algorithm:
 * denominator = user value, zero-denominator sentence, one row per derived
 * model, display-unit delta from unrounded subtraction, no sign direction.
 */

import { createStore } from "../state/store.mjs";
import { submitValue, setDisplayUnit } from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";
import { compareUserAndDerived, comparisonsForVariable } from "../render/derivation_controller.mjs";

export const name = "comparison: §7.14 absolute-difference algorithm";

export async function run(t) {
  t.section("pure algorithm");
  const fakeEngine = {
    displayValue: (r, unit) => ({ ok: true, value: unit === "u" ? r.value_si * 2 : r.value_si }),
  };
  const user = { result_id: "u1", value_si: 8.0, source: "user_input" };
  const derivedLow = { result_id: "d1", value_si: 0.9, source: "derived", model: { name: "m_a" } };
  const c = compareUserAndDerived(user, derivedLow, { engine: fakeEngine, displayUnit: "u" });
  t.ok("absolute difference in SI", Math.abs(c.absoluteSi - 7.1) < 1e-12);
  t.ok("percentage uses the USER value as denominator",
    Math.abs(c.percentage - (7.1 / 8.0) * 100) < 1e-9);
  t.ok("display-unit delta subtracts unrounded converted values",
    Math.abs(c.displayDelta - 14.2) < 1e-12);
  t.ok("no sign: derived above or below gives the same magnitude",
    compareUserAndDerived({ ...user, value_si: 0.9 }, { ...derivedLow, value_si: 8.0 }, { engine: fakeEngine, displayUnit: null }).absoluteSi === c.absoluteSi);
  t.ok("no signed field is exposed",
    !("signedDelta" in c) && !("direction" in c));

  t.section("zero reference value");
  const zero = compareUserAndDerived({ result_id: "u0", value_si: 0 }, derivedLow, { engine: fakeEngine, displayUnit: null });
  t.ok("percentage is unavailable with the fixed sentence",
    zero.percentage === null &&
    zero.percentageText === "Percentage difference unavailable (reference value is zero).");
  t.ok("absolute difference still shows", zero.absoluteSiText.length > 0);

  t.section("real engine: one comparison row per derived model");
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store };
  submitValue(app, "engine_torque", "310", "foot_pound_force");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute");
  submitValue(app, "combined_gear_ratio", "8.0", "decimal");
  submitValue(app, "drivetrain_efficiency", "0.90", "decimal");
  submitValue(app, "wheel_radius", "0.311", "meter");
  submitValue(app, "vehicle_weight", "3500", "pound_force");
  runSolve(app);
  // user input on the dual-model output: both models keep deriving for comparison
  submitValue(app, "longitudinal_acceleration", "0.311", "meter_per_second_squared");
  runSolve(app);
  const rows = comparisonsForVariable(app, "longitudinal_acceleration");
  t.ok("two rows, one per model", rows.length === 2 && new Set(rows.map((r) => r.model)).size === 2);
  t.ok("model names are carried",
    rows.every((r) => ["engine_limited_acceleration", "ideal_constant_power_acceleration"].includes(r.model)));
  const userInstance = engine.getResults("longitudinal_acceleration").find((r) => r.source === "user_input");
  t.ok("each row keys the exact user and derived result_ids",
    rows.every((r) => r.userResultId === userInstance.result_id && engine.getByResultId(r.derivedResultId)?.source === "derived"));

  t.section("display-unit delta follows the display selection");
  setDisplayUnit(app, "longitudinal_acceleration", "foot_per_second_squared");
  const converted = comparisonsForVariable(app, "longitudinal_acceleration");
  t.ok("delta is reported in the selected display unit",
    converted.every((r) => r.displayUnit === "foot_per_second_squared" && r.displayDelta !== null));
  t.ok("percentage is unit-independent",
    converted.every((r, i) => r.percentageText === rows[i].percentageText));

  t.section("variables without a user input yield no rows");
  t.ok("no comparison for derived-only variables",
    comparisonsForVariable(app, "engine_power").length === 0);
}
