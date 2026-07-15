/**
 * Stage 5 (unit-misuse detection) gate tests — real catalog data.
 *
 * Trigger contract (Part 2 §五 check order): user_input source only, legal
 * conversion, and range status exactly "extreme_warning" — invalid and plain
 * warning never trigger. Candidates re-interpret the same number in the other
 * allowed units; only normal-range landings become suggestions. The engine
 * never switches units on its own.
 */

import { loadCatalog } from "../loader.mjs";
import { createEngineFromData } from "../index.mjs";
import { repoReader } from "./node_reader.mjs";
import { test, assert, assertEqual, assertClose, assertDeepEqual } from "./harness.mjs";

const MISUSE_CODE = "unit_misuse_suspected";
const F002 = "F002_vehicle_speed_from_engine_speed";

export async function run() {
  console.log("test_unit_misuse (Stage 5)");

  const { ok, data } = await loadCatalog(repoReader());
  assert(ok, "catalog must load before unit-misuse tests");

  // u1: 13.8 foot for wheel_radius -> extreme_warning + exactly one suggestion
  // (inch; 13.8 in sits inside the calibrated 9–22 in normal range). Also
  // exercises the Stage 5 foot unit and the new 22 in upper bound.
  await test("13.8 foot wheel_radius triggers exactly one inch suggestion", () => {
    const engine = createEngineFromData(data);
    const r = engine.setUserInput("wheel_radius", 13.8, "foot");
    assert(r.ok, "extreme values are stored, never rejected");
    assertEqual(r.result.range_status, "extreme_warning", "13.8 ft is far outside the wheel_radius envelope");
    const codes = r.result.warnings.map((w) => w.code);
    assert(codes.indexOf("range_extreme") !== -1, "range warning present");
    const misuseIndex = codes.indexOf(MISUSE_CODE);
    assert(misuseIndex !== -1, "misuse warning present");
    assert(codes.indexOf("range_extreme") < misuseIndex, "misuse mounts after the range warnings");

    const misuse = r.result.warnings[misuseIndex];
    assertEqual(misuse.context.suggestions.length, 1, "exactly one candidate lands normal");
    const suggestion = misuse.context.suggestions[0];
    assertEqual(suggestion.unit_id, "inch", "the inch re-interpretation is suggested");
    assertClose(suggestion.value_si, 13.8 * 0.0254, 1e-12, "value_si is the re-interpreted SI value (~0.35052 m)");
    assertEqual(suggestion.would_be_status, "normal", "candidate status recorded");
    assert(!misuse.context.suggestions.some((s) => ["millimeter", "meter", "foot"].includes(s.unit_id)),
      "millimeter/meter do not land normal and the entered unit is excluded");
  });

  // u2: a normal value never triggers.
  await test("normal-range input (13 inch) does not trigger misuse detection", () => {
    const engine = createEngineFromData(data);
    const r = engine.setUserInput("wheel_radius", 13, "inch");
    assert(r.ok, "stored");
    assertEqual(r.result.range_status, "normal", "normal range");
    assertEqual(r.result.warnings.length, 0, "no warnings at all");
  });

  // u3: variables with unit_misuse_check=false never trigger, even at extreme.
  await test("misuse-check-disabled variable (vehicle_speed 500 mph) does not trigger", () => {
    const engine = createEngineFromData(data);
    const r = engine.setUserInput("vehicle_speed", 500, "mile_per_hour");
    assert(r.ok, "stored");
    assertEqual(r.result.range_status, "extreme_warning", "500 mph is extreme");
    assert(!r.result.warnings.some((w) => w.code === MISUSE_CODE), "no misuse warning without the opt-in flag");
  });

  // u4: plain warning tier never triggers (negative on the warning layer).
  await test("warning-tier input (vehicle_mass 3000 slug) does not trigger", () => {
    const engine = createEngineFromData(data);
    const r = engine.setUserInput("vehicle_mass", 3000, "slug");
    assert(r.ok, "stored");
    assertEqual(r.result.range_status, "warning", "43782 kg sits in the warning band");
    assert(r.result.warnings.some((w) => w.code === "range_warning"), "range warning present");
    assert(!r.result.warnings.some((w) => w.code === MISUSE_CODE), "warning tier never triggers misuse detection");
  });

  // u5: invalid tier never triggers; the value still enters the pool
  // (store-not-reject) with status invalid.
  await test("invalid-tier input (engine_speed 5000 rad/s) stores without suggestions", () => {
    const engine = createEngineFromData(data);
    const r = engine.setUserInput("engine_speed", 5000, "radian_per_second");
    assert(r.ok, "invalid values are stored, not rejected");
    assertEqual(r.result.range_status, "invalid", "47746 rpm hits invalid_range");
    assert(!r.result.warnings.some((w) => w.code === MISUSE_CODE), "invalid tier never triggers misuse detection");
    const stored = engine.getResults("engine_speed").find((x) => x.source === "user_input");
    assert(stored, "instance present in the pool");
  });

  // u6: structural completeness of the mounted warning entry.
  await test("misuse warning entry carries the full structured shape", () => {
    const engine = createEngineFromData(data);
    const r = engine.setUserInput("wheel_radius", 13.8, "foot");
    const misuse = r.result.warnings.find((w) => w.code === MISUSE_CODE);
    assert(misuse, "misuse warning present");
    assertDeepEqual(Object.keys(misuse).sort(), ["code", "context", "message"], "entry keys");
    assert(typeof misuse.message === "string" && misuse.message.length > 0, "message non-empty");
    assertDeepEqual(
      Object.keys(misuse.context).sort(),
      ["entered_unit", "entered_value", "suggestions", "variable_id"],
      "context keys"
    );
    assertEqual(misuse.context.variable_id, "wheel_radius", "context.variable_id");
    assertEqual(misuse.context.entered_value, 13.8, "context.entered_value");
    assertEqual(misuse.context.entered_unit, "foot", "context.entered_unit");
    assert(Array.isArray(misuse.context.suggestions), "suggestions is an array");
    for (const s of misuse.context.suggestions) {
      assertDeepEqual(Object.keys(s).sort(), ["unit_id", "value_si", "would_be_status"], "suggestion keys");
    }
  });

  // u7: propagation channel — the misuse warning on a user input stays
  // reachable from downstream derived results via dependencies ->
  // getByResultId; no new mechanism is needed (rendering is Part 6 work).
  await test("misuse warning reaches downstream consumers via dependencies -> getByResultId", () => {
    const engine = createEngineFromData(data);
    const input = engine.setUserInput("wheel_radius", 13.8, "foot");            // (1)
    assert(input.ok, "input stored");
    const inputId = input.result.result_id;
    engine.setUserInput("engine_speed", 1000, "revolution_per_minute");
    engine.setUserInput("combined_gear_ratio", 10, "decimal");
    const solved = engine.solve();                                              // (2)
    assert(solved.ok, "solve reaches a fixed point");
    const vs = engine.getResults("vehicle_speed").find((r) => r.formula_id === F002); // (3)
    assert(vs, "F002 derived vehicle_speed");
    assertClose(vs.value_si, (13.8 * 0.3048) * (1000 * 2 * Math.PI / 60) / 10, 1e-12, "~44.05 m/s (~98.5 mph, normal)");
    assertEqual(vs.range_status, "normal", "derived value itself is unremarkable");
    assert(vs.dependencies.includes(inputId), "dependencies name the exact input instance"); // (4)
    const upstream = engine.getByResultId(inputId);                             // (5)
    assert(upstream, "input instance resolvable by result_id");
    assert(upstream.warnings.some((w) => w.code === MISUSE_CODE), "upstream misuse warning reachable through the channel");
  });
}
