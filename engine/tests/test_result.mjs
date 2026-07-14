/** M2 gate tests: four-source coexistence and fixed Result field structure. */

import { loadCatalog } from "../loader.mjs";
import { createUnitSystem } from "../units.mjs";
import { createPool, makeResult, RESULT_FIELDS, instanceKey } from "../result.mjs";
import { repoReader } from "./node_reader.mjs";
import { test, assert, assertEqual, assertDeepEqual, assertClose } from "./harness.mjs";

const DEFAULT_ASSUMED = ["aerodynamic_drag", "rolling_resistance", "road_grade_angle", "hitch_force"];

function checkFullShape(result) {
  const keys = Object.keys(result).sort();
  assertDeepEqual(keys, [...RESULT_FIELDS].sort(), `field set for ${result.key}`);
  assert(!("display_value" in result) && !("display_unit" in result), "display fields must not enter the core pool");
  for (const field of ["formula_path", "dependencies", "assumptions_used", "warnings"]) {
    assert(Array.isArray(result[field]), `${field} must always be an array on ${result.key}`);
  }
  for (const field of ["formula_id", "model", "range_status"]) {
    assert(result[field] !== "", `${field} must never be an empty string on ${result.key}`);
    assert(result[field] !== undefined, `${field} must never be undefined on ${result.key}`);
  }
  assertEqual(typeof result.active, "boolean", `active must be boolean on ${result.key}`);
  assertEqual(typeof result.stale, "boolean", `stale must be boolean on ${result.key}`);
}

export async function run() {
  console.log("test_result (M2)");

  const { ok, data } = await loadCatalog(repoReader());
  assert(ok, "catalog must load before result tests");
  const us = createUnitSystem(data);

  await test("pool initializes the gravity constant and default assumptions", () => {
    const pool = createPool(data, us);
    const g = pool.bySource("gravity", "constant")[0];
    assert(g, "gravity constant instance exists");
    assertEqual(g.active, true, "constant is active");
    assertEqual(g.value_si, 9.80665, "constant value is the registered SI value");
    assertEqual(g.internal_unit, "meter_per_second_squared", "constant internal unit");
    for (const variableId of DEFAULT_ASSUMED) {
      const a = pool.assumptionInstance(variableId);
      assert(a, `${variableId} default assumption instantiated`);
      assertEqual(a.active, true, `${variableId} assumption active by default`);
      assertEqual(a.value_si, 0, `${variableId} assumption SI value`);
    }
  });

  await test("every source produces the full fixed field structure", () => {
    const pool = createPool(data, us);
    const input = pool.setUserInput("wheel_radius", 13.16, "inch");
    assert(input.ok, "user input accepted");
    pool.putDerived(
      makeResult({
        variable_id: "wheel_radius",
        value_si: 0.3343,
        internal_unit: "meter",
        source: "derived",
        formula_id: "F001_wheel_radius_from_tire_size",
        formula_path: ["F001_wheel_radius_from_tire_size"],
        dependencies: ["section_width::user_input", "aspect_ratio::user_input", "rim_diameter::user_input"],
        model: { group: "tire_and_wheel_geometry", name: "tire_size_radius_model" },
        range_status: "normal",
      })
    );
    const all = [
      input.result,
      ...pool.instances("wheel_radius"),
      pool.bySource("gravity", "constant")[0],
      pool.assumptionInstance("aerodynamic_drag"),
    ];
    for (const result of all) checkFullShape(result);

    const user = pool.userInput("wheel_radius");
    assertEqual(user.formula_id, null, "user input formula_id is null");
    assertEqual(user.model, null, "user input model is null");
    assertDeepEqual(user.formula_path, [], "user input formula_path is []");
    assertDeepEqual(user.dependencies, [], "user input dependencies is []");
    assertDeepEqual(user.assumptions_used, [], "user input assumptions_used is []");

    const derived = pool.instances("wheel_radius").find((r) => r.source === "derived");
    assertDeepEqual(derived.model, { group: "tire_and_wheel_geometry", name: "tire_size_radius_model" }, "derived model");
    assertEqual(derived.formula_id, "F001_wheel_radius_from_tire_size", "derived formula_id");
  });

  await test("sources coexist and never overwrite each other", () => {
    const pool = createPool(data, us);
    pool.putDerived(
      makeResult({
        variable_id: "wheel_radius",
        value_si: 0.3343,
        internal_unit: "meter",
        source: "derived",
        formula_id: "F001_wheel_radius_from_tire_size",
        model: { group: "tire_and_wheel_geometry", name: "tire_size_radius_model" },
        active: true,
        range_status: "normal",
      })
    );
    const before = pool.instances("wheel_radius").length;
    assertEqual(before, 1, "derived instance in pool");

    const input = pool.setUserInput("wheel_radius", 13.0, "inch");
    assert(input.ok, "user input accepted");
    const after = pool.instances("wheel_radius");
    assertEqual(after.length, 2, "user input coexists with derived");

    const derived = after.find((r) => r.source === "derived");
    const user = after.find((r) => r.source === "user_input");
    assert(derived && user, "both instances retained");
    assertEqual(derived.active, false, "derived loses Active to the user input");
    assertEqual(user.active, true, "user input is Active by default");
    assertClose(derived.value_si, 0.3343, 1e-15, "derived value untouched");
  });

  await test("at most one user input per variable; replacement updates in place", () => {
    const pool = createPool(data, us);
    pool.setUserInput("engine_torque", 100, "foot_pound_force");
    pool.setUserInput("engine_torque", 310, "foot_pound_force");
    const inputs = pool.bySource("engine_torque", "user_input");
    assertEqual(inputs.length, 1, "single user-input instance");
    assertClose(inputs[0].value_si, 310 * 1.3558179483314003, 1e-12, "replacement value stored");
  });

  await test("user input on an assumable variable retains the assumption for comparison", () => {
    const pool = createPool(data, us);
    const input = pool.setUserInput("aerodynamic_drag", 100, "pound_force");
    assert(input.ok, "user input accepted");
    const assumption = pool.assumptionInstance("aerodynamic_drag");
    assert(assumption, "assumption instance retained");
    assertEqual(assumption.active, false, "assumption is no longer Active");
    assertEqual(pool.active("aerodynamic_drag").source, "user_input", "user input is Active");

    pool.removeUserInput("aerodynamic_drag");
    assertEqual(pool.assumptionInstance("aerodynamic_drag").active, true, "assumption reactivates after removal");
  });

  await test("assumption toggle removes and restores the instance", () => {
    const pool = createPool(data, us);
    pool.setAssumptionEnabled("road_grade_angle", false);
    assertEqual(pool.assumptionInstance("road_grade_angle"), null, "disabled assumption leaves the pool");
    assertEqual(pool.isAssumptionEnabled("road_grade_angle"), false, "state recorded");
    const r = pool.setAssumptionEnabled("road_grade_angle", true);
    assert(r.ok, "re-enable succeeds");
    assertEqual(pool.assumptionInstance("road_grade_angle").value_si, 0, "restored with registered value");
  });

  await test("range_status follows the four-tier semantics", () => {
    const pool = createPool(data, us);
    const cases = [
      [235, "normal"],
      [450, "warning"],
      [600, "extreme_warning"],
      [-5, "invalid"],
    ];
    for (const [mm, expected] of cases) {
      const r = pool.setUserInput("section_width", mm, "millimeter");
      assert(r.ok, `value ${mm} mm stored`);
      assertEqual(r.result.range_status, expected, `range_status for ${mm} mm`);
      if (expected !== "normal") {
        assert(r.result.warnings.length > 0, `warnings recorded for ${mm} mm`);
      }
    }
  });

  await test("user input rejections are structured diagnostics", () => {
    const pool = createPool(data, us);
    const constant = pool.setUserInput("gravity", 9.81, "meter_per_second_squared");
    assertEqual(constant.ok, false, "constants reject user input");
    assertEqual(constant.diagnostic.code, "user_input_not_permitted", "diagnostic code");

    const unknown = pool.setUserInput("warp_factor", 1, "meter");
    assertEqual(unknown.ok, false, "unknown variable rejected");
    assertEqual(unknown.diagnostic.code, "unknown_variable", "diagnostic code");

    const notAllowed = pool.setUserInput("vehicle_mass", 3200, "pound_mass");
    assertEqual(notAllowed.ok, false, "layer-2 unit admission enforced");
    assertEqual(notAllowed.diagnostic.code, "unit_not_allowed_for_variable", "diagnostic code");
  });

  await test("instance keys separate sources and derived formulas", () => {
    assertEqual(instanceKey("wheel_radius", "user_input"), "wheel_radius::user_input", "user input key");
    assertEqual(
      instanceKey("longitudinal_acceleration", "derived", "F008_ideal_power_acceleration_si"),
      "longitudinal_acceleration::derived::F008_ideal_power_acceleration_si",
      "derived key embeds the formula"
    );
  });
}
