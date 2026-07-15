/**
 * Stage 5 (risk_warnings mechanism) gate tests.
 *
 * C1 scope: fixtures only — every catalog here is a mutated clone injected
 * through the virtual reader (same technique as fixtures/malformed.mjs and
 * test_derive.mjs). The real catalog carries no risk_warnings at this stage,
 * so the mechanism proves itself without touching real formula data.
 */

import { loadCatalog, CATALOG_ENTRY_PATH, REQUIRED_DATA_ROLES } from "../loader.mjs";
import { createEngineFromData } from "../index.mjs";
import { virtualReader, REPO_ROOT } from "./node_reader.mjs";
import { test, assert, assertEqual, hasDiagnostic } from "./harness.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const F005 = "F005_mass_factor_from_total_gear_ratio";

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
}
