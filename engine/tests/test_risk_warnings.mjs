/**
 * Stage 5 (risk_warnings mechanism) gate tests.
 *
 * Fixture half (m1–m6): every catalog is a mutated clone injected through
 * the virtual reader (same technique as fixtures/malformed.mjs and
 * test_derive.mjs), proving the mechanism without touching real data.
 * Real-data half (t1–t4): the enacted F008 low-speed policy — below 10 mph
 * the derived F008 instance carries low_speed_ideal_model, at exactly
 * 10 mph it does not (lt is strict), and V = 0 stays constraint-blocked.
 */

import { loadCatalog, CATALOG_ENTRY_PATH, REQUIRED_DATA_ROLES } from "../loader.mjs";
import { createEngineFromData } from "../index.mjs";
import { repoReader, virtualReader, REPO_ROOT } from "./node_reader.mjs";
import { test, assert, assertEqual, hasDiagnostic } from "./harness.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const F005 = "F005_mass_factor_from_total_gear_ratio";
const F008 = "F008_ideal_power_acceleration_si";
const AX = "longitudinal_acceleration";
const LOW_SPEED_CODE = "low_speed_ideal_model";

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

/** Inject a risk_warnings value into the F005 fixture formula. */
function withRiskWarnings(riskWarnings) {
  return (byPath) => {
    const f = byPath["data/formulas.v0.1.json"].formulas.find((x) => x.formula_id === F005);
    f.risk_warnings = riskWarnings;
  };
}

const RATIO_ENTRY = {
  condition: { variable: "combined_gear_ratio", operator: "gt", value: 10, unit: "decimal" },
  code: "high_ratio_check",
  message: "Fixture risk zone: combined gear ratio above 10.",
};

export async function run() {
  console.log("test_risk_warnings (Stage 5)");

  // m1: satisfied condition -> code mounted after the output range warnings.
  await test("fixture risk warning fires when satisfied and mounts after range warnings", async () => {
    const clone = await loadMutatedClone(withRiskWarnings([RATIO_ENTRY]));
    assert(clone.ok, `fixture must load: ${JSON.stringify(clone.diagnostics)}`);
    const engine = createEngineFromData(clone.data);
    engine.setUserInput("combined_gear_ratio", 35, "decimal");
    engine.solve();
    const mf = engine.getResults("mass_factor").find((r) => r.formula_id === F005);
    assert(mf, "F005 derived");
    assertEqual(mf.range_status, "warning", "output sits in the warning band");
    const codes = mf.warnings.map((w) => w.code);
    const rangeIndex = codes.indexOf("range_warning");
    const riskIndex = codes.indexOf("high_ratio_check");
    assert(rangeIndex !== -1, `range warning present; got ${JSON.stringify(codes)}`);
    assert(riskIndex !== -1, `risk warning present; got ${JSON.stringify(codes)}`);
    assert(rangeIndex < riskIndex, "range warnings mount before risk warnings");
    assertEqual(mf.warnings[riskIndex].message, RATIO_ENTRY.message, "message carried through");
  });

  // m2: unsatisfied condition -> no risk code.
  await test("fixture risk warning stays silent when its condition is not satisfied", async () => {
    const clone = await loadMutatedClone(withRiskWarnings([RATIO_ENTRY]));
    assert(clone.ok, "fixture must load");
    const engine = createEngineFromData(clone.data);
    engine.setUserInput("combined_gear_ratio", 9, "decimal");
    engine.solve();
    const mf = engine.getResults("mass_factor").find((r) => r.formula_id === F005);
    assert(mf, "F005 derived");
    assertEqual(mf.range_status, "normal", "output in the normal range");
    assert(!mf.warnings.some((w) => w.code === "high_ratio_check"), "risk code absent");
    assertEqual(mf.warnings.length, 0, "no warnings at all for a normal, unsatisfied case");
  });

  // m3: five structural negatives -> structured diagnostics, never a throw.
  const NEGATIVES = [
    {
      name: "missing condition.variable",
      entry: {
        condition: { operator: "gt", value: 10, unit: "decimal" },
        code: "high_ratio_check",
        message: "Fixture risk zone.",
      },
      expectCode: "condition_variable_missing",
    },
    {
      name: "illegal operator",
      entry: {
        condition: { variable: "combined_gear_ratio", operator: "approx", value: 10, unit: "decimal" },
        code: "high_ratio_check",
        message: "Fixture risk zone.",
      },
      expectCode: "condition_operator_unknown",
    },
    {
      name: "comparison condition with unregistered unit",
      entry: {
        condition: { variable: "combined_gear_ratio", operator: "gt", value: 10, unit: "warp_unit" },
        code: "high_ratio_check",
        message: "Fixture risk zone.",
      },
      expectCode: "unknown_unit",
    },
    {
      name: "condition variable outside required_inputs",
      entry: {
        condition: { variable: "vehicle_weight", operator: "gt", value: 10, unit: "newton" },
        code: "high_ratio_check",
        message: "Fixture risk zone.",
      },
      expectCode: "condition_variable_not_input",
    },
    {
      name: "illegal warning code",
      entry: {
        condition: { variable: "combined_gear_ratio", operator: "gt", value: 10, unit: "decimal" },
        code: "Bad_Code",
        message: "Fixture risk zone.",
      },
      expectCode: "risk_warning_code_invalid",
    },
  ];
  for (const negative of NEGATIVES) {
    await test(`malformed risk_warnings: ${negative.name}`, async () => {
      const clone = await loadMutatedClone(withRiskWarnings([negative.entry]));
      assertEqual(clone.ok, false, "malformed fixture must not load ok");
      assert(
        hasDiagnostic(clone.diagnostics, negative.expectCode),
        `expected diagnostic code ${negative.expectCode}; got ${JSON.stringify(clone.diagnostics.map((d) => d.code))}`
      );
    });
  }

  // m4: risk_warnings is not an array.
  await test("malformed risk_warnings: not an array", async () => {
    const clone = await loadMutatedClone(withRiskWarnings("not-an-array"));
    assertEqual(clone.ok, false, "malformed fixture must not load ok");
    assert(
      hasDiagnostic(clone.diagnostics, "risk_warnings_not_array"),
      `expected risk_warnings_not_array; got ${JSON.stringify(clone.diagnostics.map((d) => d.code))}`
    );
  });

  // m5: finite-class condition carries no unit, passes validation, evaluates.
  await test("finite-class risk condition (no unit) passes validation and evaluates", async () => {
    const entry = {
      condition: { variable: "combined_gear_ratio", operator: "finite" },
      code: "ratio_finite_check",
      message: "Fixture finite-class risk condition.",
    };
    const clone = await loadMutatedClone(withRiskWarnings([entry]));
    assert(clone.ok, `finite-class fixture must load: ${JSON.stringify(clone.diagnostics)}`);
    const engine = createEngineFromData(clone.data);
    engine.setUserInput("combined_gear_ratio", 9, "decimal");
    engine.solve();
    const mf = engine.getResults("mass_factor").find((r) => r.formula_id === F005);
    assert(mf, "F005 derived");
    assert(mf.warnings.some((w) => w.code === "ratio_finite_check"), "finite condition satisfied and mounted");
  });

  // m6: array element is not a plain object.
  await test("malformed risk_warnings: array element is not a plain object", async () => {
    const clone = await loadMutatedClone(withRiskWarnings(["not-an-object"]));
    assertEqual(clone.ok, false, "malformed fixture must not load ok");
    assert(
      hasDiagnostic(clone.diagnostics, "risk_warning_not_object"),
      `expected risk_warning_not_object; got ${JSON.stringify(clone.diagnostics.map((d) => d.code))}`
    );
  });

  // ---- real data: the enacted F008 low-speed policy (t1–t4) -----------------
  const real = await loadCatalog(repoReader());
  assert(real.ok, "real catalog must load for F008 policy tests");

  function fillF008(engine, power, speed, mass) {
    for (const [variableId, value, unitId] of [
      ["engine_power", ...power],
      ["vehicle_speed", ...speed],
      ["vehicle_mass", ...mass],
    ]) {
      const r = engine.setUserInput(variableId, value, unitId);
      if (!r.ok) throw new Error(`setup failed for ${variableId}: ${r.diagnostic.message}`);
    }
    engine.solve();
  }

  // t1: the A7 point (5 mph) derives and carries the code on the F008 instance.
  await test("F008 at 5 mph derives and its instance carries low_speed_ideal_model", () => {
    const engine = createEngineFromData(real.data);
    fillF008(engine, [103.9, "horsepower_mechanical"], [5, "mile_per_hour"], [114.472, "slug"]);
    const f008 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assert(f008, "F008 derived");
    assert(Number.isFinite(f008.value_si), "finite result");
    assert(f008.warnings.some((w) => w.code === LOW_SPEED_CODE), "low-speed risk warning mounted");
  });

  // t2: exactly 10 mph carries no low-speed code (lt is strict).
  await test("F008 at exactly 10 mph carries no low-speed warning (lt is strict)", () => {
    const engine = createEngineFromData(real.data);
    fillF008(engine, [103.9, "horsepower_mechanical"], [10, "mile_per_hour"], [114.472, "slug"]);
    const f008 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assert(f008, "F008 derived");
    assert(!f008.warnings.some((w) => w.code === LOW_SPEED_CODE), "no low-speed code at the boundary");
  });

  // t3: V = 0 stays blocked by the existing formula constraint.
  await test("F008 at V = 0 stays constraint-blocked (policy scheme A)", () => {
    const engine = createEngineFromData(real.data);
    fillF008(engine, [103.9, "horsepower_mechanical"], [0, "mile_per_hour"], [114.472, "slug"]);
    assert(!engine.getResults(AX).some((r) => r.formula_id === F008), "no F008 result at V = 0");
    const status = engine.getFormulaStatus(F008);
    assertEqual(status.state, "blocked", "F008 blocked");
    assertEqual(status.reasons[0].code, "constraint_unsatisfied", "blocked by the existing constraint");
  });

  // t4: mild low-speed case — normal range status AND the risk warning coexist
  // (closes the zero-warning gap: the warning does not depend on range tiers).
  await test("mild low-speed F008 result is range-normal yet still carries the risk warning", () => {
    const engine = createEngineFromData(real.data);
    fillF008(engine, [40, "horsepower_mechanical"], [5, "mile_per_hour"], [3000, "kilogram"]);
    const f008 = engine.getResults(AX).find((r) => r.formula_id === F008);
    assert(f008, "F008 derived");
    assertEqual(f008.range_status, "normal", "output value sits in the normal range");
    assert(!f008.warnings.some((w) => w.code === "range_warning"), "no range warning");
    assert(f008.warnings.some((w) => w.code === LOW_SPEED_CODE), "risk warning still mounted");
  });
}
