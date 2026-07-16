/**
 * test_source_presenter.mjs — §7.13 sentinel-substitution method, six
 * assertions: no title pass-through, original S001/S003 titles absent,
 * unknown source fallback, exact label map, closed field set, and the
 * renderer-only-through-presenter structural convention.
 */

import { presentSource, presentFormulaSources } from "../adapter/source_presenter.mjs";
import { buildDerivationDetail } from "../render/derivation_controller.mjs";
import { createStore } from "../state/store.mjs";
import { submitValue } from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";

export const name = "source_presenter: sentinel six assertions (§7.13)";

export async function run(t) {
  const { engine, adapter } = await t.freshApp();

  t.section("① sentinel substitution: title never passes through");
  const sentinel = `SENTINEL_${Math.trunc(Math.PI * 1e8)}`; // deterministic, no RNG in tests
  const doctored = { ...adapter.sourcesById.S003_course_subtitles, title: sentinel };
  const out = presentSource(doctored, {
    source_id: "S003_course_subtitles",
    locator: "(reference kept privately)",
    note: "(engine-power derivation reference kept privately)",
  });
  t.ok("label is the fixed approved string despite the doctored title",
    out.label === "Validated lecture reference");
  t.ok("the sentinel appears nowhere in the output",
    !JSON.stringify(out).includes(sentinel));

  t.section("② original S001/S003 titles never appear in any output");
  const allOutputs = adapter.formulas.flatMap((f) => presentFormulaSources(adapter, f));
  const s001Title = adapter.sourcesById.S001_vehicle_dynamics_formulae.title;
  const s003Title = adapter.sourcesById.S003_course_subtitles.title;
  const serialized = JSON.stringify(allOutputs);
  t.ok("S001 raw title absent from every presented source", !serialized.includes(s001Title));
  t.ok("S003 raw title absent from every presented source", !serialized.includes(s003Title));

  t.section("③ unknown source falls back to Reference");
  t.ok("unknown -> Reference",
    presentSource(null, { source_id: "S999_unknown", locator: "x", note: "y" }).label === "Reference");

  t.section("④ approved label map, one by one");
  t.ok("S001 -> Formula reference",
    presentSource(null, { source_id: "S001_vehicle_dynamics_formulae", locator: "", note: "" }).label === "Formula reference");
  t.ok("S002 -> the approved textbook label (mapping constant, not data pass-through)",
    presentSource(null, { source_id: "S002_fundamentals_vehicle_dynamics", locator: "", note: "" }).label ===
      "Fundamentals of Vehicle Dynamics, Revised Edition");
  t.ok("S003 -> Validated lecture reference",
    presentSource(null, { source_id: "S003_course_subtitles", locator: "", note: "" }).label === "Validated lecture reference");

  t.section("⑤ closed output field set {label, locator, note}");
  t.ok("no extra fields ever",
    allOutputs.every((o) => JSON.stringify(Object.keys(o).sort()) === JSON.stringify(["label", "locator", "note"])));
  t.ok("locator and note pass through verbatim",
    (() => {
      const f008 = adapter.formulasById.F008_ideal_power_acceleration_si;
      const presented = presentFormulaSources(adapter, f008);
      return f008.source_reference.every((ref, i) =>
        presented[i].locator === ref.locator && presented[i].note === ref.note);
    })());

  t.section("⑥ renderers receive presenter output only (structural convention)");
  const store = createStore();
  const app = { engine, adapter, store };
  submitValue(app, "engine_torque", "310", "foot_pound_force");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute");
  runSolve(app);
  const power = engine.getResults("engine_power").find((r) => r.source === "derived");
  const detail = buildDerivationDetail(app, power);
  t.ok("derivation-detail sources are presenter-shaped objects only",
    detail.sources.length > 0 &&
    detail.sources.every((s) => JSON.stringify(Object.keys(s).sort()) === JSON.stringify(["label", "locator", "note"])));
  t.ok("no raw source record fields (title/file_name/type/status) reach the view model",
    !detail.sources.some((s) => "title" in s || "file_name" in s || "type" in s || "status" in s));
}
