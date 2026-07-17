/**
 * sys_degradation.mjs — §7.3 degradation, error paths, and bootstrap
 * static checks (Node side).
 *
 * Covers: controlled catalog failure through a throwing reader (structured
 * engine diagnostics; catchable adapter error), the three verbatim
 * empty-state texts, unfinished drafts never reaching the engine, and the
 * bootstrap statics — exactly one module script booting ./ui/main.mjs and
 * the 42-file startup list present and non-empty on disk. The browser-side
 * bootstrap and controlled-failure fixtures live in system.html.
 */

import { createEngine } from "../../engine/index.mjs";
import { buildCatalogAdapter } from "../../ui/adapter/catalog_adapter.mjs";
import { NO_RESULT_TEXT } from "../../ui/render/derivation_controller.mjs";
import { isUnfinishedDraft, submitValue } from "../../ui/render/inputs_controller.mjs";
import { readText } from "./harness.mjs";

export const name = "sys_degradation: bootstrap and error paths (§7.3)";

/** The §7.4 startup list, re-transcribed for the on-disk static check. */
const STARTUP_FILES = [
  "index.html",
  "ui/tokens.css",
  "ui/app.css",
  "ui/main.mjs",
  "ui/adapter/catalog_adapter.mjs",
  "ui/adapter/formula_format.mjs",
  "ui/adapter/path_view_model.mjs",
  "ui/adapter/source_presenter.mjs",
  "ui/adapter/tire_code.mjs",
  "ui/adapter/upstream_trace.mjs",
  "ui/adapter/view_model.mjs",
  "ui/adapter/warning_presenter.mjs",
  "ui/render/assumptions_controller.mjs",
  "ui/render/assumptions_view.mjs",
  "ui/render/derivation_controller.mjs",
  "ui/render/dom_util.mjs",
  "ui/render/formula_view.mjs",
  "ui/render/inputs_controller.mjs",
  "ui/render/inputs_view.mjs",
  "ui/render/results_controller.mjs",
  "ui/render/results_view.mjs",
  "ui/render/targets_controller.mjs",
  "ui/render/targets_view.mjs",
  "ui/render/warnings_controller.mjs",
  "ui/render/warnings_view.mjs",
  "ui/state/store.mjs",
  "engine/conditions.mjs",
  "engine/derive.mjs",
  "engine/expr.mjs",
  "engine/index.mjs",
  "engine/loader.mjs",
  "engine/reverse.mjs",
  "engine/result.mjs",
  "engine/units.mjs",
  "data/catalog.meta.json",
  "data/engine-config.v0.1.json",
  "data/formulas.v0.1.json",
  "data/models.v0.1.json",
  "data/recommendations.v0.1.json",
  "data/sources.v0.1.json",
  "data/units.v0.1.json",
  "data/variables.v0.1.json",
];

export async function run(t) {
  t.section("controlled catalog failure (throwing reader)");
  const failingReadText = async () => {
    throw new Error("controlled reader failure");
  };
  const engineOutcome = await createEngine(failingReadText);
  t.ok("createEngine reports ok:false with structured diagnostics",
    engineOutcome.ok === false &&
    Array.isArray(engineOutcome.diagnostics) &&
    engineOutcome.diagnostics.length > 0 &&
    engineOutcome.diagnostics.every((d) => typeof d.message === "string" && d.message.length > 0));
  let adapterError = null;
  try {
    await buildCatalogAdapter(failingReadText);
  } catch (error) {
    adapterError = error;
  }
  t.ok("buildCatalogAdapter fails through a catchable error",
    adapterError instanceof Error && adapterError.message.length > 0);

  t.section("three empty-state texts, verbatim (Part 2 twelve)");
  t.ok("not-calculated state text is verbatim",
    NO_RESULT_TEXT.not_calculated === "No calculated results yet. Add known values and select Calculate.");
  t.ok("nothing-derivable state text is verbatim",
    NO_RESULT_TEXT.nothing_derivable === "No result can currently be calculated. See Missing Conditions for required inputs.");
  t.ok("target-unavailable state text is verbatim",
    NO_RESULT_TEXT.target_unavailable === "Some results were calculated, but the requested result is not available. See Missing Conditions.");

  t.section("unfinished drafts never touch the engine");
  const app = await t.freshApp();
  for (const draft of ["", "-", "."]) {
    const poolBefore = app.engine.getResults().map((r) => r.result_id).sort().join(",");
    const outcome = submitValue(app, "engine_torque", draft, "foot_pound_force");
    const poolAfter = app.engine.getResults().map((r) => r.result_id).sort().join(",");
    t.ok(`draft shape "${draft}" is recognized and performs zero engine operations`,
      isUnfinishedDraft(draft) === true &&
      outcome.submitted === false && outcome.kind === "draft" &&
      poolBefore === poolAfter &&
      app.engine.getResults("engine_torque").every((r) => r.source !== "user_input"));
  }

  t.section("bootstrap static checks");
  const indexHtml = await readText("index.html");
  const bootScripts = indexHtml.match(/<script type="module" src="\.\/ui\/main\.mjs"><\/script>/g) ?? [];
  const anyScripts = indexHtml.match(/<script\b/g) ?? [];
  t.ok("index.html carries exactly one script tag and it boots ./ui/main.mjs as a module",
    bootScripts.length === 1 && anyScripts.length === 1);
  const contents = await Promise.all(STARTUP_FILES.map((p) => readText(p)));
  t.ok("the 42-file startup list is exactly 42 entries with no duplicate",
    STARTUP_FILES.length === 42 && new Set(STARTUP_FILES).size === STARTUP_FILES.length);
  t.ok("every startup file exists on disk and is non-empty",
    contents.every((c) => typeof c === "string" && c.length > 0));
}
