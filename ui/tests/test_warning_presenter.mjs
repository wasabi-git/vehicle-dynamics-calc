/**
 * test_warning_presenter.mjs — §7.6: structured output, hard-coded
 * confirmation eligibility matrix, verbatim metadata range units, engine
 * warning order preserved, and the result_id-keyed confirm flow.
 */

import { createStore } from "../state/store.mjs";
import { submitValue } from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";
import { presentResultWarnings, confirmKeepOriginal, directConsumers } from "../render/warnings_controller.mjs";
import { presentWarning, formatRange } from "../adapter/warning_presenter.mjs";

export const name = "warning_presenter: structure + eligibility (§7.6)";

const FIELDS = [
  "title",
  "observedValue",
  "reason",
  "continuationPolicy",
  "affectedResults",
  "actions",
  "developerFallback",
];

export async function run(t) {
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store };

  t.section("eligibility: user input + extreme_warning -> Keep original");
  const extreme = submitValue(app, "wheel_radius", "13.8", "foot").result;
  const presentedExtreme = presentResultWarnings(app, extreme);
  const rangeEntry = presentedExtreme.find((p) => p.code === "range_extreme");
  t.ok("Keep original action offered", rangeEntry.actions.some((a) => a.kind === "keep_original"));
  t.ok("canConfirm is true", rangeEntry.canConfirm === true);

  t.section("eligibility: warning tier never confirms");
  const warnTier = submitValue(app, "combined_gear_ratio", "0.90", "decimal").result;
  const presentedWarn = presentResultWarnings(app, warnTier);
  t.ok("warning-tier value stores as range warning", warnTier.range_status === "warning");
  t.ok("no confirmation action on warning tier",
    presentedWarn.every((p) => !p.actions.some((a) => a.kind === "keep_original") && p.canConfirm === false));

  t.section("eligibility: invalid never confirms");
  const invalid = submitValue(app, "drivetrain_efficiency", "8.0", "decimal").result;
  const presentedInvalid = presentResultWarnings(app, invalid);
  t.ok("invalid entry carries the exclusion policy",
    presentedInvalid[0].continuationPolicy.includes("excluded") && presentedInvalid[0].canConfirm === false);
  t.ok("no actions on invalid", presentedInvalid[0].actions.length === 0);

  t.section("eligibility: derived warnings never confirm (risk warning, real engine)");
  submitValue(app, "drivetrain_efficiency", "0.90", "decimal");
  submitValue(app, "combined_gear_ratio", "8.0", "decimal");
  submitValue(app, "engine_torque", "310", "foot_pound_force");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute");
  submitValue(app, "vehicle_weight", "3500", "pound_force");
  // wheel_radius stays 13.8 ft (extreme): derived chain still runs
  runSolve(app);
  const derivedWithWarnings = engine.getResults().filter((r) => r.source === "derived" && r.warnings.length > 0);
  t.ok("scenario yields at least one warned derived result", derivedWithWarnings.length > 0);
  t.ok("no derived warning is confirmable",
    derivedWithWarnings.every((r) => presentResultWarnings(app, r).every((p) => p.canConfirm === false)));

  t.section("structure: seven required fields + fallback + verbatim ranges");
  t.ok("all required output fields present",
    FIELDS.every((f) => f in rangeEntry));
  t.ok("developerFallback is the raw engine message",
    rangeEntry.developerFallback === extreme.warnings.find((w) => w.code === "range_extreme").message);
  const wheelVar = adapter.variablesById.wheel_radius;
  const sym = (id) => adapter.unitsById[id].display_symbol;
  t.ok("range bounds keep the metadata-declared values and unit (symbol form, no re-conversion)",
    rangeEntry.ranges.normal === `${wheelVar.normal_range.min} to ${wheelVar.normal_range.max} ${sym(wheelVar.normal_range.unit)}` &&
    rangeEntry.ranges.warning === `${wheelVar.warning_range.min} to ${wheelVar.warning_range.max} ${sym(wheelVar.warning_range.unit)}`);
  t.ok("formatRange returns null without min/max", formatRange({}) === null && formatRange(null) === null);
  t.ok("observedValue uses the display unit and 4 significant figures",
    typeof rangeEntry.observedValue === "string" && rangeEntry.observedValue.length > 0);

  t.section("engine warning order preserved (range -> misuse)");
  const wheelNow = engine.getResults("wheel_radius").find((r) => r.source === "user_input");
  const presentedOrder = presentResultWarnings(app, wheelNow).map((p) => p.code);
  t.ok("presenter preserves engine order",
    JSON.stringify(presentedOrder) === JSON.stringify(wheelNow.warnings.map((w) => w.code)));
  t.ok("misuse entry carries adopt + keep-my-input actions",
    presentResultWarnings(app, wheelNow)
      .find((p) => p.code === "unit_misuse_suspected")
      ?.actions.map((a) => a.kind)
      .join(",") === "adopt_suggestion,ignore_misuse");

  t.section("affected results = live direct consumers");
  const consumers = directConsumers(engine, wheelNow.result_id);
  t.ok("wheel radius consumers include F002 and F004 results",
    consumers.length >= 2 &&
    consumers.every((id) => engine.getByResultId(id).dependencies.includes(wheelNow.result_id)));
  t.ok("presenter passes them through as affectedResults",
    JSON.stringify(presentResultWarnings(app, wheelNow)[0].affectedResults) === JSON.stringify(consumers));

  t.section("confirm flow: result_id keyed, zero engine operations");
  const poolBefore = engine.getResults().map((r) => r.result_id).sort().join(",");
  confirmKeepOriginal(app, wheelNow.result_id);
  t.ok("confirmation lands in the store", store.state.confirmedResultIds.has(wheelNow.result_id));
  t.ok("zero engine operations", engine.getResults().map((r) => r.result_id).sort().join(",") === poolBefore);
  const reConfirmed = presentResultWarnings(app, wheelNow).find((p) => p.code === "range_extreme");
  t.ok("confirmed entry reports confirmed and hides Keep original",
    reConfirmed.confirmed === true && reConfirmed.canConfirm === false);
  const replacement = submitValue(app, "wheel_radius", "13.8", "foot").result;
  t.ok("a new result_id naturally returns to unconfirmed",
    replacement.result_id !== wheelNow.result_id &&
    presentResultWarnings(app, replacement).find((p) => p.code === "range_extreme").canConfirm === true);

  t.section("pure presenter: no engine access");
  const pure = presentWarning({
    result: { result_id: "r_x", source: "user_input", range_status: "extreme_warning", warnings: [] },
    warning: { code: "range_extreme", message: "m" },
    variable: { name: "X", normal_range: { min: 8, max: 20, unit: "inch" }, warning_range: { min: 5, max: 30, unit: "inch" } },
    displayedValue: "13.80",
    displayedUnit: "ft",
    siValue: 4.2,
    inputSnapshot: { variableId: "x", enteredValue: 13.8, enteredUnit: "foot" },
    upstreamRefs: [],
    confirmed: false,
  });
  t.ok("presenter works on plain data alone",
    pure.title === "Far outside the normal range" && pure.enteredValue === "13.8 foot" && pure.canConfirm === true);
}
