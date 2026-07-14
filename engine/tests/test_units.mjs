/** M1 gate tests: acceptance-suite unit round-trips + illegal-conversion diagnostics. */

import { loadCatalog } from "../loader.mjs";
import { createUnitSystem } from "../units.mjs";
import { resolveUnitNotation } from "./notation.mjs";
import { repoReader, REPO_ROOT } from "./node_reader.mjs";
import { test, assert, assertEqual, assertClose } from "./harness.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROUND_TRIP_TOL = 1e-12;

export async function run() {
  console.log("test_units (M1)");

  const { ok, data } = await loadCatalog(repoReader());
  assert(ok, "catalog must load before unit tests");
  const us = createUnitSystem(data);
  const cases = JSON.parse(
    await readFile(join(REPO_ROOT, "validation/acceptance/cases.v0.1.json"), "utf8")
  );

  // ---- acceptance-suite coverage: every (variable, unit) token in the bank ----
  const pairs = [];
  for (const c of cases.cases) {
    for (const input of c.global_inputs || []) pairs.push(input);
    for (const run of c.runs || []) {
      for (const input of run.inputs || []) pairs.push(input);
      for (const exp of run.expected || []) pairs.push(exp);
    }
  }

  await test(`every case unit token resolves against registered units (${pairs.length} entries)`, () => {
    for (const p of pairs) {
      const unitId = resolveUnitNotation(p.unit, data.units);
      assert(unitId !== null, `unresolved unit token ${JSON.stringify(p.unit)} for ${p.variable_id}`);
    }
  });

  await test("every case unit is allowed for its variable and round-trips through SI", () => {
    for (const p of pairs) {
      const unitId = resolveUnitNotation(p.unit, data.units);
      const toSi = us.variableInputToSI(p.variable_id, p.value, unitId);
      assert(toSi.ok, `variableInputToSI failed for ${p.variable_id} [${unitId}]: ${toSi.diagnostic && toSi.diagnostic.message}`);
      const back = us.variableOutputFromSI(p.variable_id, toSi.value, unitId);
      assert(back.ok, `variableOutputFromSI failed for ${p.variable_id} [${unitId}]`);
      assertClose(back.value, p.value, ROUND_TRIP_TOL, `round trip ${p.variable_id} [${unitId}]`);
    }
  });

  await test("all allowed_units of all variables round-trip through SI", () => {
    for (const [variableId, variable] of data.variables) {
      for (const unitId of variable.allowed_units) {
        const sample = 123.456;
        const toSi = us.variableInputToSI(variableId, sample, unitId);
        assert(toSi.ok, `toSI failed for ${variableId} [${unitId}]`);
        const back = us.variableOutputFromSI(variableId, toSi.value, unitId);
        assert(back.ok, `fromSI failed for ${variableId} [${unitId}]`);
        assertClose(back.value, sample, ROUND_TRIP_TOL, `round trip ${variableId} [${unitId}]`);
      }
    }
  });

  // ---- layer 1: base converter ----
  await test("base converter handles registered same-dimension pairs", () => {
    const mph = us.convert(60, "mile_per_hour", "kilometer_per_hour");
    assert(mph.ok, "mph -> km/h must convert");
    assertClose(mph.value, 96.56064, 1e-12, "60 mph in km/h");

    const rpm = us.convert(5252, "revolution_per_minute", "radian_per_second");
    assert(rpm.ok, "rpm -> rad/s must convert");
    assertClose(rpm.value, 5252 * (2 * Math.PI / 60), 1e-12, "5252 rpm in rad/s");

    const g = us.convert(1, "standard_gravity", "meter_per_second_squared");
    assert(g.ok, "standard_gravity -> m/s^2 must convert");
    assertClose(g.value, 9.80665, 1e-15, "1 g in m/s^2 uses the registered constant");

    const percent = us.convert(45, "percent", "decimal");
    assert(percent.ok, "percent -> decimal must convert");
    assertClose(percent.value, 0.45, 1e-15, "45% as decimal");
  });

  await test("cross-dimension conversion returns a structured diagnostic", () => {
    const r = us.convert(1, "meter", "kilogram");
    assertEqual(r.ok, false, "meter -> kilogram must fail");
    assertEqual(r.diagnostic.code, "dimension_mismatch", "diagnostic code");
    const r2 = us.convert(1, "newton_meter", "newton");
    assertEqual(r2.ok, false, "torque -> force must fail (distinct dimensions)");
    assertEqual(r2.diagnostic.code, "dimension_mismatch", "diagnostic code");
  });

  await test("unregistered units return a structured diagnostic", () => {
    for (const r of [
      us.convert(1, "furlong", "meter"),
      us.convert(1, "meter", "cubit"),
      us.toSI(1, "stone"),
      us.fromSI(1, "stone"),
    ]) {
      assertEqual(r.ok, false, "unregistered unit must fail");
      assertEqual(r.diagnostic.code, "unknown_unit", "diagnostic code");
    }
  });

  await test("non-finite values return a structured diagnostic", () => {
    const r = us.toSI(Number.NaN, "meter");
    assertEqual(r.ok, false, "NaN must fail");
    assertEqual(r.diagnostic.code, "value_not_finite", "diagnostic code");
  });

  // ---- layer 2: allowed_units enforcement ----
  await test("variable layer rejects registered but not-allowed units", () => {
    // pound_mass is registered with the mass dimension, but vehicle_mass
    // only allows kilogram and slug.
    const r = us.variableInputToSI("vehicle_mass", 3200, "pound_mass");
    assertEqual(r.ok, false, "pound_mass must be rejected for vehicle_mass");
    assertEqual(r.diagnostic.code, "unit_not_allowed_for_variable", "diagnostic code");

    const out = us.variableOutputFromSI("vehicle_mass", 1500, "pound_mass");
    assertEqual(out.ok, false, "output side must also reject");
    assertEqual(out.diagnostic.code, "unit_not_allowed_for_variable", "diagnostic code");
  });

  await test("variable layer rejects wrong-dimension and unknown units", () => {
    const wrongDim = us.variableInputToSI("engine_torque", 100, "watt");
    assertEqual(wrongDim.ok, false, "watt must be rejected for engine_torque");
    assertEqual(wrongDim.diagnostic.code, "dimension_mismatch", "diagnostic code");

    const unknown = us.variableInputToSI("engine_torque", 100, "cubit");
    assertEqual(unknown.ok, false, "unknown unit must be rejected");
    assertEqual(unknown.diagnostic.code, "unknown_unit", "diagnostic code");

    const noVar = us.variableInputToSI("warp_factor", 1, "meter");
    assertEqual(noVar.ok, false, "unknown variable must be rejected");
    assertEqual(noVar.diagnostic.code, "unknown_variable", "diagnostic code");
  });

  // ---- layer 3: substitution conversions are not allowed_units-restricted ----
  await test("substitution layer accepts registered same-dimension units outside allowed_units", () => {
    const r = us.substitutionFromSI("vehicle_mass", 1451.5, "pound_mass");
    assert(r.ok, "substitution conversion must ignore allowed_units");
    assertClose(r.value, 1451.5 / 0.45359237, 1e-12, "kg -> lbm magnitude");
  });

  await test("substitution layer still enforces registration and dimension", () => {
    const unknown = us.substitutionFromSI("vehicle_mass", 1, "cubit");
    assertEqual(unknown.ok, false, "unknown substitution unit must fail");
    assertEqual(unknown.diagnostic.code, "unknown_unit", "diagnostic code");

    const wrongDim = us.substitutionFromSI("vehicle_mass", 1, "watt");
    assertEqual(wrongDim.ok, false, "wrong-dimension substitution must fail");
    assertEqual(wrongDim.diagnostic.code, "dimension_mismatch", "diagnostic code");

    const nativeWrong = us.nativeOutputToSI("engine_power", 1, "newton");
    assertEqual(nativeWrong.ok, false, "wrong-dimension native output must fail");
    assertEqual(nativeWrong.diagnostic.code, "dimension_mismatch", "diagnostic code");
  });

  await test("registered substitution/native units of F001 and F003 convert", () => {
    for (const [formulaId, formula] of data.formulas) {
      if (formula.expression_unit_mode !== "source_native") continue;
      for (const [inputId, unitId] of Object.entries(formula.substitution_units)) {
        const r = us.substitutionFromSI(inputId, 1, unitId);
        assert(r.ok, `${formulaId} substitution ${inputId} [${unitId}] must convert`);
      }
      const out = us.nativeOutputToSI(formula.output, 1, formula.native_output_unit);
      assert(out.ok, `${formulaId} native output [${formula.native_output_unit}] must convert`);
    }
  });
}
