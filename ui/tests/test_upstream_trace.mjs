/**
 * test_upstream_trace.mjs — §7.5 recursive upstream-abnormality collection:
 * ≥2-hop chain on the real engine (wheel_radius abnormality -> F004 -> F007),
 * dedup, cycle guard, retired-instance resolution, confirmation state, and
 * the never-writes-into-warnings guarantee.
 */

import { createStore } from "../state/store.mjs";
import { submitValue } from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";
import { upstreamAbnormalities } from "../render/warnings_controller.mjs";
import { collectUpstreamAbnormalities } from "../adapter/upstream_trace.mjs";

export const name = "upstream_trace: ≥2-hop chain, real engine (§7.5)";

export async function run(t) {
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store };

  submitValue(app, "engine_torque", "310", "foot_pound_force");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute");
  submitValue(app, "combined_gear_ratio", "8.0", "decimal");
  submitValue(app, "drivetrain_efficiency", "0.90", "decimal");
  submitValue(app, "vehicle_weight", "3500", "pound_force");
  const wheel = submitValue(app, "wheel_radius", "13.8", "foot").result; // extreme + misuse
  runSolve(app);

  const f007 = engine.getResults("longitudinal_acceleration").find((r) => r.formula_id === "F007_engine_limited_acceleration");
  const f004 = engine.getResults("tractive_force").find((r) => r.source === "derived");
  t.ok("chain derived despite the extreme input", Boolean(f007) && Boolean(f004));

  t.section("two-hop chain: wheel_radius -> F004 -> F007");
  const trace007 = upstreamAbnormalities(app, f007);
  const wheelEntries = trace007.filter((e) => e.variableId === "wheel_radius");
  t.ok("F007 trace surfaces the wheel_radius abnormality", wheelEntries.length > 0);
  t.ok("annotated as 2 hops (indirect), source variable named",
    wheelEntries.every((e) => e.hops === 2 && e.direct === false && e.variableId === "wheel_radius"));
  const trace004 = upstreamAbnormalities(app, f004);
  t.ok("F004 trace reports the same abnormality as a direct dependency (1 hop)",
    trace004.some((e) => e.variableId === "wheel_radius" && e.hops === 1 && e.direct === true));

  t.section("both warning entries of one node survive dedup (keyed result:code)");
  const codes = wheelEntries.map((e) => e.code).sort();
  t.ok("range_extreme and unit_misuse_suspected both collected",
    JSON.stringify(codes) === JSON.stringify(["range_extreme", "unit_misuse_suspected"]));
  const keys = trace007.map((e) => `${e.resultId}:${e.code}`);
  t.ok("no duplicate result:code pairs", new Set(keys).size === keys.length);

  t.section("confirmation state is carried");
  store.state.confirmedResultIds.add(wheel.result_id);
  t.ok("confirmed flag reflects the store",
    upstreamAbnormalities(app, f007).filter((e) => e.variableId === "wheel_radius").every((e) => e.confirmed === true));

  t.section("retired instances stay resolvable");
  submitValue(app, "wheel_radius", "13.8", "foot"); // new instance; consumers stale, referencing the retired id
  const staleF004 = engine.getResults("tractive_force").find((r) => r.source === "derived");
  t.ok("consumer went stale and still references the retired input", staleF004.stale === true);
  const staleTrace = upstreamAbnormalities(app, staleF004);
  t.ok("trace resolves the retired instance and marks it superseded",
    staleTrace.some((e) => e.variableId === "wheel_radius" && e.resultId === wheel.result_id && e.retired === true));

  t.section("trace never writes into the consuming result");
  const before = JSON.stringify(f007.warnings);
  upstreamAbnormalities(app, f007);
  t.ok("consumer warnings unchanged", JSON.stringify(f007.warnings) === before);

  t.section("cycle guard (synthetic graph)");
  const nodes = {
    a: { result_id: "a", variable_id: "va", source: "derived", warnings: [{ code: "w", message: "m" }], dependencies: ["b"] },
    b: { result_id: "b", variable_id: "vb", source: "derived", warnings: [], dependencies: ["a"] },
  };
  const fakeEngine = {
    getByResultId: (id) => nodes[id] ?? null,
    getResults: () => Object.values(nodes),
  };
  const cyclic = collectUpstreamAbnormalities(
    { result_id: "root", dependencies: ["a"] },
    { engine: fakeEngine, confirmedResultIds: new Set() }
  );
  t.ok("cyclic graph terminates and collects each node once",
    cyclic.length === 1 && cyclic[0].resultId === "a");

  t.section("leaves terminate the walk");
  const leafTrace = upstreamAbnormalities(app, engine.getResults("vehicle_mass").find((r) => r.source === "derived"));
  t.ok("user-input/assumption/constant leaves end the recursion",
    Array.isArray(leafTrace)); // completes without error; vehicle_weight input is normal so no entries required
}
