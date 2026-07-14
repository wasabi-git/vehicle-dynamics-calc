/** M3 gate tests: three-layer judgment, unit-mode routing, blocking, models, R001. */

import { loadCatalog, CATALOG_ENTRY_PATH, REQUIRED_DATA_ROLES } from "../loader.mjs";
import { createEngineFromData } from "../index.mjs";
import { compileExpression } from "../expr.mjs";
import { repoReader, virtualReader, REPO_ROOT } from "./node_reader.mjs";
import { test, assert, assertEqual, assertClose, assertDeepEqual } from "./harness.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const F001 = "F001_wheel_radius_from_tire_size";
const F002 = "F002_vehicle_speed_from_engine_speed";
const F003 = "F003_engine_power_from_torque_rpm";
const F004 = "F004_tractive_force_from_engine_torque";
const F005 = "F005_mass_factor_from_total_gear_ratio";
const F006 = "F006_vehicle_mass_from_weight";
const F007 = "F007_engine_limited_acceleration";
const F008 = "F008_ideal_power_acceleration_si";
const AX = "longitudinal_acceleration";

/** Full A1-style pool: tire size, gearing, efficiency, weight, torque, speed. */
function fillFullScenario(engine) {
  const inputs = [
    ["section_width", 235, "millimeter"],
    ["aspect_ratio", 45, "percent"],
    ["rim_diameter", 18, "inch"],
    ["combined_gear_ratio", 9, "decimal"],
    ["drivetrain_efficiency", 92, "percent"],
    ["vehicle_weight", 3686, "pound_force"],
    ["engine_torque", 310, "foot_pound_force"],
    ["engine_speed", 4800, "revolution_per_minute"],
  ];
  for (const [variableId, value, unitId] of inputs) {
    const r = engine.setUserInput(variableId, value, unitId);
    if (!r.ok) throw new Error(`setup failed for ${variableId}: ${r.diagnostic.message}`);
  }
}

/** Load a mutated clone of the real catalog through the virtual reader. */
async function loadMutatedClone(mutate) {
  const catalogText = await readFile(join(REPO_ROOT, CATALOG_ENTRY_PATH), "utf8");
  const catalog = JSON.parse(catalogText);
  const byPath = {};
  for (const entry of catalog.files) {
    if (REQUIRED_DATA_ROLES.includes(entry.role)) {
      byPath[entry.path] = JSON.parse(await readFile(join(REPO_ROOT, entry.path), "utf8"));
    }
  }
  mutate(byPath);
  const files = { [CATALOG_ENTRY_PATH]: catalogText };
  for (const [p, doc] of Object.entries(byPath)) files[p] = JSON.stringify(doc);
  return loadCatalog(virtualReader(files));
}

export async function run() {
  console.log("test_derive (M3)");

  const { ok, data } = await loadCatalog(repoReader());
  assert(ok, "catalog must load before derive tests");

  // ---- expression parser ---------------------------------------------------
  await test("expression parser: precedence, unary minus, sin, power", () => {
    const p = compileExpression("-(a + b) * c ^ 2 + sin(d)", ["a", "b", "c", "d"]);
    assert(p.ok, "compiles");
    const r = p.evaluate({ a: 1, b: 2, c: 3, d: Math.PI / 2 });
    assertClose(r.value, -(1 + 2) * 9 + 1, 1e-15, "evaluated value");

    const rightAssoc = compileExpression("a ^ b ^ c", ["a", "b", "c"]);
    assertClose(rightAssoc.evaluate({ a: 2, b: 3, c: 2 }).value, 512, 1e-15, "^ is right-associative");

    const unaryPow = compileExpression("-a ^ 2", ["a"]);
    assertClose(unaryPow.evaluate({ a: 3 }).value, -9, 1e-15, "unary minus binds outside the power");
  });

  await test("expression parser rejects unknown identifiers, functions, and syntax", () => {
    assertEqual(compileExpression("a + warp", ["a"]).ok, false, "unknown identifier");
    assertEqual(compileExpression("cos(a)", ["a"]).ok, false, "cos is not an allowed function");
    assertEqual(compileExpression("a +", ["a"]).ok, false, "dangling operator");
    assertEqual(compileExpression("a; b", ["a", "b"]).ok, false, "illegal character");
    assertEqual(compileExpression("sin a", ["a"]).ok, false, "function without parentheses");
  });

  // ---- fixed-point forward derivation ---------------------------------------
  await test("full scenario reaches fixed point and derives the whole chain", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    const solved = engine.solve();
    assert(solved.ok, "solve reaches a fixed point");

    const rw = engine.getResults("wheel_radius").find((r) => r.formula_id === F001);
    assert(rw, "F001 derived wheel_radius");
    assertClose(rw.value_si / 0.0254, 13.163386, 1e-6, "wheel radius [in]");

    const vs = engine.getResults("vehicle_speed").find((r) => r.formula_id === F002);
    assertClose(vs.value_si / 0.44704, 41.77171, 1e-4, "vehicle speed [mph]");

    const hp = engine.getResults("engine_power").find((r) => r.formula_id === F003);
    assertClose(hp.value_si / 745.6998715822702, 283.32064, 1e-6, "engine power [hp]");

    const fx = engine.getResults("tractive_force").find((r) => r.formula_id === F004);
    assertClose(fx.value_si / 4.4482216152605, 2339.94509, 1e-6, "tractive force [lbf]");

    const mf = engine.getResults("mass_factor").find((r) => r.formula_id === F005);
    assertClose(mf.value_si, 1.5625, 1e-12, "mass factor");

    const m = engine.getResults("vehicle_mass").find((r) => r.formula_id === F006);
    assertClose(m.value_si / 14.59390293720636, 114.56438, 1e-5, "vehicle mass [slug]");

    const a7 = engine.getResults(AX).find((r) => r.formula_id === F007);
    assertClose(a7.value_si / 0.3048, 13.07182, 1e-5, "engine-limited accel [ft/s^2]");

    const a8 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assert(a8, "F008 comparison result retained separately");
  });

  await test("provenance: dependencies, formula_path, assumptions_used", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    const a7 = engine.getResults(AX).find((r) => r.formula_id === F007);
    assertDeepEqual(
      a7.assumptions_used,
      ["aerodynamic_drag", "hitch_force", "road_grade_angle", "rolling_resistance"],
      "assumptions recorded transitively"
    );
    assertEqual(a7.formula_path[a7.formula_path.length - 1], F007, "path ends with the producing formula");
    for (const upstream of [F001, F004, F005, F006]) {
      assert(a7.formula_path.includes(upstream), `path includes ${upstream}`);
    }
    assert(!a7.formula_path.includes(F002) || a7.formula_path.indexOf(F002) < 0, "F002 not on the F007 path");
    const f004Instance = engine.getResults("tractive_force").find((r) => r.formula_id === F004);
    assert(a7.dependencies.includes(f004Instance.result_id), "dependency ids point at actual instances");
    const aeroAssumption = engine.getResults("aerodynamic_drag").find((r) => r.source === "assumption");
    assert(a7.dependencies.includes(aeroAssumption.result_id), "assumption dependency recorded");
  });

  await test("source_native routing uses the course-native form, not naive SI substitution", () => {
    const engine = createEngineFromData(data);
    engine.setUserInput("engine_torque", 310, "foot_pound_force");
    engine.setUserInput("engine_speed", 4800, "revolution_per_minute");
    engine.solve();
    const hp = engine.getResults("engine_power").find((r) => r.formula_id === F003);
    const nativeHp = (310 * 4800) / 5252;
    assertClose(hp.value_si, nativeHp * 745.6998715822702, 1e-9, "native hp converted to SI watts");
    const naiveSi = 310 * 1.3558179483314003 * (4800 * (2 * Math.PI / 60));
    assert(Math.abs(hp.value_si - naiveSi) > 1, "differs from naive SI product (5252 is a rounded constant)");
  });

  await test("user input is never displaced: derived kept for comparison", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.setUserInput("wheel_radius", 13.0, "inch");
    engine.solve();
    const instances = engine.getResults("wheel_radius");
    const user = instances.find((r) => r.source === "user_input");
    const derived = instances.find((r) => r.formula_id === F001);
    assert(user && derived, "both instances coexist");
    assertEqual(user.active, true, "user input Active");
    assertEqual(derived.active, false, "derived inactive but retained");
    // Downstream must use the Active user value: F002 at 13 in, 4800 rpm, N=9.
    const vs = engine.getResults("vehicle_speed").find((r) => r.formula_id === F002);
    const expected = (13 * 0.0254) * (4800 * 2 * Math.PI / 60) / 9;
    assertClose(vs.value_si, expected, 1e-12, "F002 consumed the user wheel_radius");
    assert(vs.dependencies.includes(user.result_id), "dependency records the exact user-input revision");
  });

  // ---- blocking semantics ----------------------------------------------------
  await test("missing input blocks only the affected branch", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.removeUserInput("drivetrain_efficiency");
    engine.solve();
    assertEqual(engine.getResults("tractive_force").length, 0, "F004 not computed");
    assert(!engine.getResults(AX).some((r) => r.formula_id === F007), "F007 blocked downstream");
    assert(engine.getResults("vehicle_speed").some((r) => r.formula_id === F002), "F002 unaffected");
    assert(engine.getResults(AX).some((r) => r.formula_id === F008), "F008 unaffected");
    const status = engine.getFormulaStatus(F004);
    assertEqual(status.state, "blocked", "F004 status recorded");
    assertEqual(status.reasons[0].code, "missing_input", "reason code");
    assertEqual(status.reasons[0].variable_id, "drivetrain_efficiency", "reason names the missing input");
  });

  await test("derived vehicle_speed = 0 blocks F008 by constraint, F007 unaffected", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.setUserInput("engine_speed", 0, "revolution_per_minute");
    engine.solve();
    const vs = engine.getResults("vehicle_speed").find((r) => r.formula_id === F002);
    assertEqual(vs.value_si, 0, "vehicle_speed derived as 0");
    assert(!engine.getResults(AX).some((r) => r.formula_id === F008), "F008 blocked");
    assertEqual(engine.getFormulaStatus(F008).reasons[0].code, "constraint_unsatisfied", "blocked by formula constraint");
    assert(engine.getResults(AX).some((r) => r.formula_id === F007), "F007 still computes");
  });

  await test("invalid input blocks dependent branch (invalid_range -> input_invalid)", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    const r = engine.setUserInput("drivetrain_efficiency", 120, "percent");
    assert(r.ok, "value stored despite invalid range");
    assertEqual(r.result.range_status, "invalid", "range_status invalid");
    engine.solve();
    assertEqual(engine.getResults("tractive_force").length, 0, "F004 blocked");
    assertEqual(engine.getFormulaStatus(F004).reasons[0].code, "input_invalid", "reason code");
    assert(engine.getResults("vehicle_speed").some((r2) => r2.formula_id === F002), "unrelated branch continues");
  });

  await test("disabling a road-load assumption blocks F007 but not F008", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    assert(engine.getResults(AX).some((r) => r.formula_id === F007), "F007 computed with default assumptions");

    engine.setAssumptionEnabled("road_grade_angle", false);
    engine.solve();
    assert(!engine.getResults(AX).some((r) => r.formula_id === F007), "F007 result removed once its assumption is gone");
    const status = engine.getFormulaStatus(F007);
    assertEqual(status.state, "blocked", "F007 blocked");
    assertEqual(status.reasons[0].code, "missing_input", "missing road_grade_angle");
    assert(engine.getResults(AX).some((r) => r.formula_id === F008), "F008 unaffected");
  });

  await test("computability outside the capability set blocks at layer 2", async () => {
    const clone = await loadMutatedClone((byPath) => {
      const f = byPath["data/formulas.v0.1.json"].formulas.find((x) => x.formula_id === F005);
      f.computability = "iterative";
    });
    assert(clone.ok, "clone loads");
    const engine = createEngineFromData(clone.data);
    fillFullScenario(engine);
    engine.solve();
    assertEqual(engine.getResults("mass_factor").length, 0, "F005 not computed");
    assertEqual(engine.getFormulaStatus(F005).reasons[0].code, "computability_unsupported", "layer-2 reason");
  });

  await test("assumption only fills inputs when the formula permits it", async () => {
    const clone = await loadMutatedClone((byPath) => {
      const f = byPath["data/formulas.v0.1.json"].formulas.find((x) => x.formula_id === F007);
      f.allowed_assumption_inputs = ["aerodynamic_drag", "rolling_resistance", "road_grade_angle"];
    });
    assert(clone.ok, "clone loads");
    const engine = createEngineFromData(clone.data);
    fillFullScenario(engine);
    engine.solve();
    assert(!engine.getResults(AX).some((r) => r.formula_id === F007), "F007 may not use the hitch_force assumption");
    const reasons = engine.getFormulaStatus(F007).reasons;
    assertEqual(reasons[0].code, "assumption_not_allowed_for_formula", "reason code");
    assertEqual(reasons[0].variable_id, "hitch_force", "names the disallowed assumption");
  });

  // ---- models and R001 ---------------------------------------------------------
  await test("R001: recommended model available -> default Active derived", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    const a7 = engine.getResults(AX).find((r) => r.formula_id === F007);
    const a8 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assertEqual(a7.active, true, "F007 result is the default Active derived");
    assertEqual(a8.active, false, "F008 stays a separate inactive comparison");
    const rec = engine.getRecommendationStates()[0];
    assertEqual(rec.mode, "recommended_default", "recommendation mode");
    assertEqual(rec.active_model, "engine_limited_acceleration", "active model recorded");
    assertEqual(rec.message, null, "no fallback message");
  });

  await test("R001: recommended unavailable -> no automatic fallback to F008", () => {
    const engine = createEngineFromData(data);
    engine.setUserInput("engine_power", 103.9, "horsepower_mechanical");
    engine.setUserInput("vehicle_speed", 137.5, "mile_per_hour");
    engine.setUserInput("vehicle_mass", 114.472, "slug");
    engine.solve();
    const a8 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assert(a8, "F008 result exists in the pool");
    assertEqual(a8.active, false, "F008 is not auto-activated");
    assertEqual(engine.getActive(AX), null, "no Active acceleration without user selection");
    const rec = engine.getRecommendationStates()[0];
    assertEqual(rec.mode, "require_user_selection", "mode per R001 fallback");
    assertEqual(rec.recommended_available, false, "recommended model unavailable");
    assertEqual(
      rec.message,
      "The recommended model is unavailable. Select another model explicitly to continue.",
      "message per R001"
    );
  });

  await test("R001: explicit user selection activates the comparison model", () => {
    const engine = createEngineFromData(data);
    engine.setUserInput("engine_power", 103.9, "horsepower_mechanical");
    engine.setUserInput("vehicle_speed", 137.5, "mile_per_hour");
    engine.setUserInput("vehicle_mass", 114.472, "slug");
    engine.solve();
    const selection = engine.selectModel(AX, "ideal_constant_power_acceleration");
    assert(selection.ok, "selection accepted");
    const a8 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assertEqual(a8.active, true, "explicit selection activates F008");
    assertEqual(engine.getRecommendationStates()[0].mode, "user_selected", "mode records the user selection");

    const bad = engine.selectModel(AX, "warp_drive_model");
    assertEqual(bad.ok, false, "unregistered model rejected");
    assertEqual(bad.diagnostic.code, "model_not_registered_for_output", "diagnostic code");
  });

  await test("R001: an Active user input is never overridden; state records it", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.setUserInput(AX, 10, "meter_per_second_squared");
    engine.solve();
    const active = engine.getActive(AX);
    assertEqual(active.source, "user_input", "user input stays Active");
    const a7 = engine.getResults(AX).find((r) => r.formula_id === F007);
    const a8 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assert(a7 && a8, "both model results computed and retained for comparison");
    assertEqual(a7.active, false, "F007 not Active");
    assertEqual(a8.active, false, "F008 not Active");
    const rec = engine.getRecommendationStates()[0];
    assertEqual(rec.mode, "user_input_active", "recommendation records state only");
    assertEqual(rec.recommended_available, true, "availability still tracked");
  });

  // ---- checkpoint-one corrections ---------------------------------------------
  await test("no automatic resumption through a displaced assumption (Part 2)", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    const initial = engine.getResults(AX).find((r) => r.formula_id === F007);
    assert(initial, "F007 computed with default assumptions");
    assert(initial.assumptions_used.includes("road_grade_angle"), "grade assumption participates initially");

    engine.setUserInput("road_grade_angle", 0.1, "radian");
    engine.solve();
    const withGrade = engine.getResults(AX).find((r) => r.formula_id === F007);
    assert(withGrade, "F007 recomputed with the user grade");
    assert(!withGrade.assumptions_used.includes("road_grade_angle"), "user value replaced the assumption");

    engine.removeUserInput("road_grade_angle");
    engine.solve();
    assert(
      !engine.getResults(AX).some((r) => r.formula_id === F007),
      "dependent formula must not auto-resume through the suppressed assumption"
    );
    const status = engine.getFormulaStatus(F007);
    assertEqual(status.state, "blocked", "F007 blocked after removal");
    assertEqual(status.reasons[0].code, "missing_input", "blocked as missing, not silently assumed");
    assertEqual(status.reasons[0].variable_id, "road_grade_angle", "the removed variable is the gap");
    const assumption = engine.getResults("road_grade_angle").find((r) => r.source === "assumption");
    assertEqual(assumption.active, false, "assumption stays inactive (suppressed)");

    const restored = engine.restoreAssumption("road_grade_angle");
    assert(restored.ok, "explicit restore accepted");
    engine.solve();
    const back = engine.getResults(AX).find((r) => r.formula_id === F007);
    assert(back, "recalculation restores the path only after the explicit restore");
    assert(back.assumptions_used.includes("road_grade_angle"), "assumption participates again");
  });

  await test("provenance survives input revision: retired chain keeps its exact input ids", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    const f004v1 = engine.getResults("tractive_force").find((r) => r.formula_id === F004);
    const f007v1 = engine.getResults(AX).find((r) => r.formula_id === F007);
    const oldF004Id = f004v1.result_id;
    const oldF007Id = f007v1.result_id;
    assert(f007v1.dependencies.includes(oldF004Id), "v1 references the v1 tractive-force instance");

    engine.setUserInput("engine_torque", 400, "foot_pound_force");
    engine.solve();
    const f004v2 = engine.getResults("tractive_force").find((r) => r.formula_id === F004);
    const f007v2 = engine.getResults(AX).find((r) => r.formula_id === F007);
    assert(f004v2.result_id !== oldF004Id, "recomputation mints a new tractive-force instance");
    assert(f007v2.result_id !== oldF007Id, "downstream recomputation mints a new instance");
    assert(f007v2.dependencies.includes(f004v2.result_id), "new result references the new input revision");
    assert(!f007v2.dependencies.includes(oldF004Id), "new result does not reference the old revision");

    const retiredF007 = engine.getByResultId(oldF007Id);
    assert(retiredF007 !== null, "retired result stays resolvable for audit");
    assert(retiredF007.dependencies.includes(oldF004Id), "retired result still names the exact old input revision");
    const retiredF004 = engine.getByResultId(oldF004Id);
    assert(retiredF004 !== null, "retired dependency resolvable too");
    assertClose(retiredF004.value_si / 4.4482216152605, 2339.94509, 1e-5, "retired dependency keeps its old value");
  });

  await test("reference-path results can never become Active", async () => {
    const clone = await loadMutatedClone((byPath) => {
      const f = byPath["data/formulas.v0.1.json"].formulas.find((x) => x.formula_id === F008);
      f.path_role = "reference";
    });
    assert(clone.ok, "clone loads");
    const engine = createEngineFromData(clone.data);
    engine.setUserInput("engine_power", 103.9, "horsepower_mechanical");
    engine.setUserInput("vehicle_speed", 137.5, "mile_per_hour");
    engine.setUserInput("vehicle_mass", 114.472, "slug");
    engine.solve();
    const a8 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assert(a8, "reference result exists for display");
    assertEqual(a8.active, false, "reference result inactive by default");
    engine.selectModel(AX, "ideal_constant_power_acceleration");
    assertEqual(
      engine.getResults(AX).find((r) => r.formula_id === F008).active,
      false,
      "selection cannot activate a reference path"
    );
  });
}
