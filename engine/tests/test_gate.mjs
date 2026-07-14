/** M6 gate-hardening tests (final-review corrections).
 *
 * Negative regressions proving the one-shot gate cannot go green when:
 *   - cross_check yields fewer than 23 parsable items;
 *   - a got value is tampered with while tags still read PASS;
 *   - the cases-only extra is not exactly A3 wheel_radius [in];
 *   - A7 produced no stored result (or violates its storage contract).
 */

import {
  reconcile,
  parseCrossCheckOutput,
  EXPECTED_CC_ITEMS,
  GOT_TOLERANCE_DEFAULT,
} from "./reconcile.mjs";
import { judgeStoredRun, runAcceptance } from "./acceptance.mjs";
import { loadCatalog } from "../loader.mjs";
import { createEngineFromData } from "../index.mjs";
import { repoReader } from "./node_reader.mjs";
import { test, assert, assertEqual } from "./harness.mjs";

const AX = "longitudinal_acceleration";
const F008 = "F008_ideal_power_acceleration_si";

/** 23 matching pairs + the expected A3 wheel_radius [in] cases-only extra. */
function syntheticPair() {
  const ccItems = [];
  const engineItems = [];
  for (let i = 0; i < EXPECTED_CC_ITEMS; i += 1) {
    const row = { label: `T${i}`, variable_id: `var_${i}`, unit: "u", got: 100 + i, expected: 100 + i };
    ccItems.push({ ...row, tag: "PASS" });
    engineItems.push({ ...row, pass: true });
  }
  engineItems.push({ label: "A3", variable_id: "wheel_radius", unit: "in", got: 16.20079, expected: 16.2, pass: true });
  return { ccItems, engineItems };
}

function fillA7(engine) {
  for (const [variableId, value, unitId] of [
    ["engine_power", 103.9, "horsepower_mechanical"],
    ["vehicle_speed", 5, "mile_per_hour"],
    ["vehicle_mass", 114.472, "slug"],
  ]) {
    const r = engine.setUserInput(variableId, value, unitId);
    if (!r.ok) throw new Error(`setup failed for ${variableId}: ${r.diagnostic.message}`);
  }
  engine.solve();
}

export async function run() {
  console.log("test_gate (M6 hardening)");

  // ---- reconciliation enforcement ------------------------------------------
  await test("sanity: a complete, agreeing pair reconciles green", () => {
    const { ccItems, engineItems } = syntheticPair();
    const result = reconcile(engineItems, ccItems);
    assertEqual(result.failed, false, `unexpected failures: ${result.failures.join(" | ")}`);
    assertEqual(result.matchedCount, EXPECTED_CC_ITEMS, "all 23 matched");
    assertEqual(result.casesOnly.length, 1, "exactly one cases-only extra");
  });

  await test("fewer than 23 cross_check items must fail the gate", () => {
    const { ccItems, engineItems } = syntheticPair();
    const result = reconcile(engineItems, ccItems.slice(0, 5));
    assertEqual(result.failed, true, "must fail");
    assert(result.failures.some((f) => f.includes(`exactly ${EXPECTED_CC_ITEMS} required`)), "names the count enforcement");
  });

  await test("a tampered got value with agreeing PASS tags must fail the gate", () => {
    const { ccItems, engineItems } = syntheticPair();
    ccItems[3].got += 0.001; // tag stays PASS on both sides
    const result = reconcile(engineItems, ccItems);
    assertEqual(result.failed, true, "must fail");
    assert(result.failures.some((f) => f.includes("got mismatch")), "names the got comparison");
  });

  await test("a PASS/FAIL tag disagreement must fail the gate", () => {
    const { ccItems, engineItems } = syntheticPair();
    ccItems[4].tag = "FAIL";
    const result = reconcile(engineItems, ccItems);
    assertEqual(result.failed, true, "must fail");
    assert(result.failures.some((f) => f.includes("tag mismatch")), "names the tag comparison");
  });

  await test("the cases-only extra must be exactly A3 wheel_radius [in]", () => {
    const wrongIdentity = syntheticPair();
    wrongIdentity.engineItems[EXPECTED_CC_ITEMS] = {
      label: "A4-1", variable_id: "mass_factor", unit: "-", got: 1.11, expected: 1.11, pass: true,
    };
    const r1 = reconcile(wrongIdentity.engineItems, wrongIdentity.ccItems);
    assertEqual(r1.failed, true, "wrong identity must fail");
    assert(r1.failures.some((f) => f.includes("unexpected cases-only item")), "names the identity enforcement");

    const twoExtras = syntheticPair();
    twoExtras.engineItems.push({ label: "A9", variable_id: "extra", unit: "u", got: 1, expected: 1, pass: true });
    const r2 = reconcile(twoExtras.engineItems, twoExtras.ccItems);
    assertEqual(r2.failed, true, "two extras must fail");
    assert(r2.failures.some((f) => f.includes("exactly 1 required")), "names the count enforcement");
  });

  await test("got tolerance: sole A3 long_accel exception holds, default stays strict", () => {
    const { ccItems, engineItems } = syntheticPair();
    // Recast pair 0 as the documented exception with the observed ~1e-5 gap.
    ccItems[0] = { label: "A3", variable_id: AX, unit: "ft/s^2", got: 0.31977, expected: 0.319, tag: "PASS" };
    engineItems[0] = { label: "A3", variable_id: AX, unit: "ft/s^2", got: 0.31978, expected: 0.319, pass: true };
    const ok = reconcile(engineItems, ccItems);
    assertEqual(ok.failed, false, `exception must absorb the documented gap: ${ok.failures.join(" | ")}`);

    // The same gap magnified on a non-exception item must fail.
    const strict = syntheticPair();
    strict.ccItems[1].got += 5 * GOT_TOLERANCE_DEFAULT;
    const bad = reconcile(strict.engineItems, strict.ccItems);
    assertEqual(bad.failed, true, "default tolerance stays strict");
  });

  await test("parseCrossCheckOutput maps script short names and ASCII units", () => {
    const items = parseCrossCheckOutput(
      "A1-b  long_accel [ft/s2]    got=    13.07182  exp=   13.0800  dev= 0.063%  PASS\n" +
      "A2  wheel_radius [in]       got=    16.20079  exp=   16.2000  dev= 0.005%  PASS\n" +
      "not a data line\n"
    );
    assertEqual(items.length, 2, "two rows parsed");
    assertEqual(items[0].variable_id, AX, "short name mapped");
    assertEqual(items[0].unit, "ft/s^2", "ASCII unit mapped");
  });

  // ---- A7 storage contract ---------------------------------------------------
  const { ok, data } = await loadCatalog(repoReader());
  assert(ok, "catalog must load for A7 contract tests");
  const a7Run = { queries: [AX] };

  await test("A7 storage contract passes when F008 stores an inactive, auditable result", () => {
    const engine = createEngineFromData(data);
    fillA7(engine);
    const items = [];
    judgeStoredRun(engine, a7Run, "A7", items);
    assertEqual(items.length, 1, "one contract judgment");
    assertEqual(items[0].pass, true, `contract must pass: ${items[0].detail}`);
    assert(items[0].detail.includes(F008), "detail names the storing formula");
  });

  await test("A7 with no stored result must fail the storage contract", () => {
    const engine = createEngineFromData(data); // no inputs -> F008 blocked
    engine.solve();
    const items = [];
    judgeStoredRun(engine, a7Run, "A7", items);
    assertEqual(items[0].pass, false, "missing result must fail");
    assert(items[0].detail.includes("storage contract violated"), "names the violation");
  });

  await test("A7 contract also rejects an Active F008 result (R001: no auto/implicit activation)", () => {
    const engine = createEngineFromData(data);
    fillA7(engine);
    engine.selectModel(AX, "ideal_constant_power_acceleration");
    const items = [];
    judgeStoredRun(engine, a7Run, "A7", items);
    assertEqual(items[0].pass, false, "Active F008 violates the A7 contract");
    assert(items[0].detail.includes("must not be Active"), "names the violation");
  });

  await test("acceptance failed count includes stored-contract failures", async () => {
    const acceptance = await runAcceptance();
    assertEqual(
      acceptance.failed,
      acceptance.numeric.failed + acceptance.behavior.failed + acceptance.stored.failed,
      "gate sum wiring"
    );
    assert(acceptance.stored.items.length > 0, "stored items judged");
    assert(acceptance.stored.items.every((i) => i.pass), "real-bank A7 contract passes");
  });
}
