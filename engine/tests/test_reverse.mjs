/** M5 gate tests: reverse query behavior (A5 assertions) and diagnostics. */

import { loadCatalog, CATALOG_ENTRY_PATH, REQUIRED_DATA_ROLES } from "../loader.mjs";
import { createEngineFromData } from "../index.mjs";
import { repoReader, virtualReader, REPO_ROOT } from "./node_reader.mjs";
import { test, assert, assertEqual } from "./harness.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const F001 = "F001_wheel_radius_from_tire_size";
const F002 = "F002_vehicle_speed_from_engine_speed";
const F004 = "F004_tractive_force_from_engine_torque";
const F007 = "F007_engine_limited_acceleration";
const F008 = "F008_ideal_power_acceleration_si";
const AX = "longitudinal_acceleration";

function candidate(query, formulaId) {
  return query.candidate_paths.find((c) => c.formula_id === formulaId) ?? null;
}

function missingIds(candidateEntry) {
  return candidateEntry.missing_inputs.map((m) => m.variable_id);
}

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

/** A5 pool: road loads and weight known, powertrain unknown. */
function fillA5(engine) {
  const inputs = [
    ["aerodynamic_drag", 311.3, "pound_force"],
    ["rolling_resistance", 146.36, "pound_force"],
    ["vehicle_weight", 13000, "pound_force"],
    ["road_grade_angle", 0.05, "radian"],
  ];
  for (const [variableId, value, unitId] of inputs) {
    const r = engine.setUserInput(variableId, value, unitId);
    if (!r.ok) throw new Error(`setup failed for ${variableId}: ${r.diagnostic.message}`);
  }
  engine.solve();
}

export async function run() {
  console.log("test_reverse (M5)");

  const { ok, data } = await loadCatalog(repoReader());
  assert(ok, "catalog must load before reverse tests");

  // ---- A5 behavior assertions (diagnostics_minimum subset semantics) ----
  await test("A5 query tractive_force: not computable, F004 path with missing inputs, no F007 inverse", () => {
    const engine = createEngineFromData(data);
    fillA5(engine);
    const query = engine.queryTarget("tractive_force");
    assert(query.ok, "query runs");
    assertEqual(query.outcome, "not_computable_in_pool", "outcome per A5");
    assertEqual(query.candidate_paths.length, 1, "exactly one registered direction produces tractive_force");
    const f004 = candidate(query, F004);
    assert(f004, "F004 is the registered path");
    assertEqual(f004.status, "blocked", "F004 blocked in this pool");
    const missing = missingIds(f004);
    // diagnostics_minimum: engine_torque must be listed; extras are allowed.
    assert(missing.includes("engine_torque"), "missing list includes engine_torque (diagnostics_minimum)");
    // registered_paths truth from the case: these are legitimately missing too.
    for (const expected of ["combined_gear_ratio", "drivetrain_efficiency"]) {
      assert(missing.includes(expected), `missing list includes ${expected}`);
    }
    // The a_x = 0 inverse of F007 is not registered and must not appear.
    assert(!candidate(query, F007), "no F007-derived direction for tractive_force");
  });

  await test("A5 query longitudinal_acceleration: F007/F008 paths with their missing lists", () => {
    const engine = createEngineFromData(data);
    fillA5(engine);
    const query = engine.queryTarget(AX);
    assertEqual(query.outcome, "not_computable_in_pool", "outcome per A5");

    const f007 = candidate(query, F007);
    assert(f007, "F007 path present");
    const f007Missing = missingIds(f007);
    for (const expected of ["tractive_force", "mass_factor"]) {
      assert(f007Missing.includes(expected), `F007 missing list includes ${expected} (diagnostics_minimum)`);
    }
    for (const available of ["vehicle_weight", "road_grade_angle", "aerodynamic_drag", "rolling_resistance", "hitch_force", "vehicle_mass"]) {
      assert(!f007Missing.includes(available), `${available} is available and must not be listed missing`);
    }

    const f008 = candidate(query, F008);
    assert(f008, "F008 path present as a separate model");
    const f008Missing = missingIds(f008);
    for (const expected of ["engine_power", "vehicle_speed"]) {
      assert(f008Missing.includes(expected), `F008 missing list includes ${expected}`);
    }
    assert(!f008Missing.includes("vehicle_mass"), "vehicle_mass derived via F006 is not missing");
    assert(f007.model_name !== f008.model_name, "candidates stay model-separated");
  });

  // ---- supplementary gate assertion: unregistered output direction ----
  await test("query engine_torque with F_x/r_w/N_tf/eta known -> no registered direction diagnostic", () => {
    const engine = createEngineFromData(data);
    for (const [variableId, value, unitId] of [
      ["tractive_force", 2000, "pound_force"],
      ["wheel_radius", 13, "inch"],
      ["combined_gear_ratio", 9, "decimal"],
      ["drivetrain_efficiency", 0.92, "decimal"],
    ]) {
      engine.setUserInput(variableId, value, unitId);
    }
    engine.solve();
    const query = engine.queryTarget("engine_torque");
    assertEqual(query.outcome, "no_registered_direction", "no inversion is offered");
    assertEqual(query.candidate_paths.length, 0, "no candidate paths");
    assertEqual(query.diagnostics[0].code, "no_registered_output_direction", "structured diagnostic present");
    assertEqual(query.can_be_user_input, true, "scheme A (direct input) is signposted");
  });

  // ---- recursive expansion with both schemes at every stop ----
  await test("empty pool: acceleration query expands recursively and offers scheme A at stops", () => {
    const engine = createEngineFromData(data);
    engine.solve();
    const query = engine.queryTarget(AX);
    assertEqual(query.outcome, "not_computable_in_pool", "nothing computable from an empty pool");

    const f007 = candidate(query, F007);
    const tf = f007.missing_inputs.find((m) => m.variable_id === "tractive_force");
    assert(tf, "tractive_force missing");
    assertEqual(tf.can_be_user_input, true, "scheme A offered for tractive_force");
    const f004 = tf.derivation_options.find((o) => o.formula_id === F004);
    assert(f004, "scheme B offers F004");
    assertEqual(f004.depth, 2, "F004 sits at formula depth 2");

    const wheel = f004.missing_inputs.find((m) => m.variable_id === "wheel_radius");
    assert(wheel, "wheel_radius missing inside F004");
    assertEqual(wheel.can_be_user_input, true, "scheme A offered for wheel_radius");
    const f001 = wheel.derivation_options.find((o) => o.formula_id === F001);
    assert(f001, "scheme B offers F001 at depth 3 (within the limit of 5)");
    assertEqual(f001.depth, 3, "formula-node depth counted");
    assert(f001.missing_inputs.some((m) => m.variable_id === "section_width"), "tire inputs surface at the leaves");

    const hitch = f007.missing_inputs.find((m) => m.variable_id === "hitch_force");
    assertEqual(hitch, undefined, "enabled default assumption satisfies hitch_force");
  });

  await test("depth limit counts formula nodes only and flags the boundary", async () => {
    const clone = await loadMutatedClone((byPath) => {
      byPath["data/engine-config.v0.1.json"].max_reverse_formula_depth = 2;
    });
    assert(clone.ok, "clone loads");
    const engine = createEngineFromData(clone.data);
    engine.solve();
    const query = engine.queryTarget(AX);
    const f007 = candidate(query, F007);
    const tf = f007.missing_inputs.find((m) => m.variable_id === "tractive_force");
    const f004 = tf.derivation_options.find((o) => o.formula_id === F004);
    assert(f004, "depth 2 still expands");
    const wheel = f004.missing_inputs.find((m) => m.variable_id === "wheel_radius");
    assert(wheel, "variable entries appear at the boundary (variables cost no depth)");
    assertEqual(wheel.depth_limit_reached, true, "expansion beyond 2 formula nodes is flagged");
    assertEqual(wheel.derivation_options.length, 0, "F001 is not expanded past the limit");
  });

  await test("a formula already on the expansion path is flagged as a cycle, never re-entered", async () => {
    const clone = await loadMutatedClone((byPath) => {
      const f002 = byPath["data/formulas.v0.1.json"].formulas.find((f) => f.formula_id === F002);
      f002.required_inputs.push("vehicle_speed"); // synthetic self-dependency
    });
    assert(clone.ok, "clone loads");
    const engine = createEngineFromData(clone.data);
    engine.solve();
    const query = engine.queryTarget("vehicle_speed");
    const f002 = candidate(query, F002);
    assert(f002, "F002 candidate present");
    const self = f002.missing_inputs.find((m) => m.variable_id === "vehicle_speed");
    assert(self, "self-referential missing input surfaces");
    const cyclic = self.derivation_options.find((o) => o.formula_id === F002);
    assert(cyclic && cyclic.cycle_detected === true, "cycle flagged instead of infinite recursion");
  });

  await test("query on an available target reports already_available", () => {
    const engine = createEngineFromData(data);
    for (const [variableId, value, unitId] of [
      ["section_width", 235, "millimeter"],
      ["aspect_ratio", 45, "percent"],
      ["rim_diameter", 18, "inch"],
    ]) {
      engine.setUserInput(variableId, value, unitId);
    }
    engine.solve();
    const query = engine.queryTarget("wheel_radius");
    assertEqual(query.outcome, "already_available", "active derived value satisfies the query");
    assertEqual(candidate(query, F001).status, "computed", "the producing path reports computed");
  });

  await test("unknown target returns a structured diagnostic", () => {
    const engine = createEngineFromData(data);
    const query = engine.queryTarget("warp_factor");
    assertEqual(query.ok, false, "unknown variable rejected");
    assertEqual(query.diagnostics[0].code, "unknown_variable", "diagnostic code");
  });
}
