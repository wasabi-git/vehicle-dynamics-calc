/** M4 gate tests: instance-level stale propagation and on-demand re-derivation.
 *
 * Propagation edges are result_id-based only: a changed/removed/displaced
 * instance seeds the walk; consumers referencing a *different* instance of
 * the same variable must never go stale.
 */

import { loadCatalog } from "../loader.mjs";
import { createEngineFromData } from "../index.mjs";
import { repoReader } from "./node_reader.mjs";
import { test, assert, assertEqual, assertClose } from "./harness.mjs";

const F001 = "F001_wheel_radius_from_tire_size";
const F002 = "F002_vehicle_speed_from_engine_speed";
const F003 = "F003_engine_power_from_torque_rpm";
const F004 = "F004_tractive_force_from_engine_torque";
const F005 = "F005_mass_factor_from_total_gear_ratio";
const F006 = "F006_vehicle_mass_from_weight";
const F007 = "F007_engine_limited_acceleration";
const F008 = "F008_ideal_power_acceleration_si";
const AX = "longitudinal_acceleration";

const FORMULA_OUTPUT = {
  [F001]: "wheel_radius",
  [F002]: "vehicle_speed",
  [F003]: "engine_power",
  [F004]: "tractive_force",
  [F005]: "mass_factor",
  [F006]: "vehicle_mass",
  [F007]: AX,
  [F008]: AX,
};

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

function derivedOf(engine, formulaId) {
  return engine.getResults(FORMULA_OUTPUT[formulaId]).find((r) => r.formula_id === formulaId) ?? null;
}

function assertStaleMap(engine, expectations, label) {
  for (const [formulaId, expected] of Object.entries(expectations)) {
    const result = derivedOf(engine, formulaId);
    assert(result, `${label}: ${formulaId} result must exist`);
    assertEqual(result.stale, expected, `${label}: ${formulaId} stale flag`);
  }
}

export async function run() {
  console.log("test_stale (M4)");

  const { ok, data } = await loadCatalog(repoReader());
  assert(ok, "catalog must load before stale tests");

  // ---- review-mandated test 1 + gate scenario: combined_gear_ratio edit ----
  await test("editing combined_gear_ratio after a full chain: exact downstream set goes stale", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    engine.setUserInput("combined_gear_ratio", 6, "decimal");
    assertStaleMap(
      engine,
      { [F002]: true, [F004]: true, [F005]: true, [F007]: true, [F008]: true,
        [F001]: false, [F003]: false, [F006]: false },
      "after gear edit"
    );
  });

  await test("on-demand re-derivation clears stale and recomputes along the new revision", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    const staleF002Id = (() => {
      engine.setUserInput("combined_gear_ratio", 6, "decimal");
      return derivedOf(engine, F002).result_id;
    })();
    const solved = engine.solve();
    assert(solved.ok, "re-solve reaches a fixed point");
    for (const formulaId of [F001, F002, F003, F004, F005, F006, F007, F008]) {
      const result = derivedOf(engine, formulaId);
      assert(result, `${formulaId} present after re-solve`);
      assertEqual(result.stale, false, `${formulaId} fresh after re-solve`);
    }
    const f002 = derivedOf(engine, F002);
    assert(f002.result_id !== staleF002Id, "recomputation minted a new vehicle_speed instance");
    const expected = (13.163385826771653 * 0.0254) * (4800 * 2 * Math.PI / 60) / 6;
    assertClose(f002.value_si, expected, 1e-9, "vehicle_speed recomputed with the new gear ratio");
    const f005 = derivedOf(engine, F005);
    assertClose(f005.value_si, 1 + 0.04 * 6 + 0.0025 * 36, 1e-12, "mass_factor recomputed");
  });

  // ---- review-mandated test 2: same-variable dual source, instance-level edges ----
  await test("dual-source engine_power: torque edit stales F003 but not F008 (user-input consumer)", () => {
    const engine = createEngineFromData(data);
    engine.setUserInput("engine_torque", 310, "foot_pound_force");
    engine.setUserInput("engine_speed", 4800, "revolution_per_minute");
    engine.setUserInput("engine_power", 103.9, "horsepower_mechanical");
    engine.setUserInput("vehicle_speed", 137.5, "mile_per_hour");
    engine.setUserInput("vehicle_mass", 114.472, "slug");
    engine.solve();

    const f003 = derivedOf(engine, F003);
    const f008 = derivedOf(engine, F008);
    assert(f003 && f008, "both engine_power sources coexist with an F008 result");
    const userPower = engine.getResults("engine_power").find((r) => r.source === "user_input");
    assert(f008.dependencies.includes(userPower.result_id), "F008 actually consumed the user engine_power");
    assert(!f008.dependencies.includes(f003.result_id), "F008 did not consume the derived engine_power");

    engine.setUserInput("engine_torque", 400, "foot_pound_force");
    assertEqual(derivedOf(engine, F003).stale, true, "F003 derived engine_power goes stale");
    assertEqual(derivedOf(engine, F008).stale, false, "F008 stays fresh — its actual input instance is untouched");
  });

  await test("variable-level spread is rejected: tire edit never stales consumers of a user wheel_radius", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.setUserInput("wheel_radius", 13.0, "inch");
    engine.solve();
    const f002 = derivedOf(engine, F002);
    const userWheel = engine.getResults("wheel_radius").find((r) => r.source === "user_input");
    assert(f002.dependencies.includes(userWheel.result_id), "F002 consumed the user wheel_radius");

    engine.setUserInput("section_width", 255, "millimeter");
    assertEqual(derivedOf(engine, F001).stale, true, "F001 derived wheel_radius goes stale");
    assertEqual(derivedOf(engine, F002).stale, false, "F002 untouched — same variable, different instance");
    assertEqual(derivedOf(engine, F004).stale, false, "F004 untouched too");
  });

  // ---- review-mandated test 3: drivetrain_efficiency edit ----
  await test("editing drivetrain_efficiency stales F004/F007 only", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    engine.setUserInput("drivetrain_efficiency", 85, "percent");
    assertStaleMap(
      engine,
      { [F004]: true, [F007]: true,
        [F001]: false, [F002]: false, [F003]: false, [F005]: false, [F006]: false, [F008]: false },
      "after efficiency edit"
    );
  });

  // ---- review-mandated test 4 + gate scenario: assumption toggle / replacement ----
  await test("disabling the road_grade_angle assumption stales only its actual consumer F007", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    engine.setAssumptionEnabled("road_grade_angle", false);
    assertStaleMap(
      engine,
      { [F007]: true,
        [F001]: false, [F002]: false, [F003]: false, [F004]: false, [F005]: false, [F006]: false, [F008]: false },
      "after assumption disable"
    );
    engine.solve();
    assert(!derivedOf(engine, F007), "blocked F007 leaves the pool on re-solve");
    assertEqual(derivedOf(engine, F008).stale, false, "F008 still fresh after re-solve");
  });

  await test("replacing the road_grade_angle assumption with a user value stales only F007", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    engine.setUserInput("road_grade_angle", 0.1, "radian");
    assertStaleMap(
      engine,
      { [F007]: true,
        [F002]: false, [F003]: false, [F004]: false, [F005]: false, [F006]: false, [F008]: false },
      "after assumption displacement"
    );
    engine.solve();
    const f007 = derivedOf(engine, F007);
    assertEqual(f007.stale, false, "F007 re-derived with the user grade");
    assert(!f007.assumptions_used.includes("road_grade_angle"), "assumption no longer participates");
  });

  // ---- review-mandated test 5: retired ids as propagation seeds + audit ----
  await test("a retired input revision seeds propagation; the stale chain stays auditable", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    const oldTorque = engine.getResults("engine_torque").find((r) => r.source === "user_input");
    const f004Before = derivedOf(engine, F004);
    assert(f004Before.dependencies.includes(oldTorque.result_id), "F004 references torque v1");

    engine.setUserInput("engine_torque", 400, "foot_pound_force"); // retires torque v1, no solve yet
    const f004Stale = derivedOf(engine, F004);
    assertEqual(f004Stale.stale, true, "propagation started from the retired torque v1 id");
    assertEqual(f004Stale.result_id, f004Before.result_id, "the stale instance is the original one");
    assert(f004Stale.dependencies.includes(oldTorque.result_id), "stale result still names torque v1");

    const retired = engine.getByResultId(oldTorque.result_id);
    assert(retired !== null, "torque v1 resolvable from history");
    assertClose(retired.value_si, 310 * 1.3558179483314003, 1e-12, "torque v1 keeps its value");

    engine.solve();
    const f004Fresh = derivedOf(engine, F004);
    assertEqual(f004Fresh.stale, false, "re-derived fresh");
    assert(f004Fresh.result_id !== f004Before.result_id, "fresh instance has a new id");
    const newTorque = engine.getResults("engine_torque").find((r) => r.source === "user_input");
    assert(f004Fresh.dependencies.includes(newTorque.result_id), "fresh instance references torque v2");
  });

  // ---- model-selection trigger (Active source switch) ----
  await test("model selection switch propagates from the previously Active instance only", () => {
    const engine = createEngineFromData(data);
    fillFullScenario(engine);
    engine.solve();
    const before = engine.getResults(AX).map((r) => [r.formula_id, r.stale]);
    const r = engine.selectModel(AX, "ideal_constant_power_acceleration");
    assert(r.ok, "selection accepted");
    assertEqual(derivedOf(engine, F008).active, true, "F008 now Active");
    // v0.1 has no consumers of longitudinal_acceleration: nothing may go stale.
    for (const [formulaId, wasStale] of before) {
      const now = engine.getResults(AX).find((x) => x.formula_id === formulaId);
      assertEqual(now.stale, wasStale, `${formulaId} stale flag unchanged by selection`);
    }
  });

  // ---- identity hardening (review note 1) ----
  await test("result_id and revision are frozen; active/stale stay mutable", () => {
    const engine = createEngineFromData(data);
    engine.setUserInput("engine_torque", 310, "foot_pound_force");
    const result = engine.getResults("engine_torque")[0];
    const idDescriptor = Object.getOwnPropertyDescriptor(result, "result_id");
    const revDescriptor = Object.getOwnPropertyDescriptor(result, "revision");
    assertEqual(idDescriptor.writable, false, "result_id not writable");
    assertEqual(idDescriptor.configurable, false, "result_id not configurable");
    assertEqual(revDescriptor.writable, false, "revision not writable");
    let threw = false;
    try {
      result.result_id = "changed";
    } catch {
      threw = true;
    }
    assertEqual(threw, true, "strict-mode assignment to result_id throws");
    result.stale = true;
    assertEqual(result.stale, true, "stale remains a mutable runtime flag");
    result.stale = false;
  });
}
