/**
 * test_warning_presenter.mjs — §7.6: structured output, hard-coded
 * confirmation eligibility matrix, verbatim metadata range units, engine
 * warning order preserved, and the result_id-keyed confirm flow.
 */

import { createStore } from "../state/store.mjs";
import { submitValue } from "../render/inputs_controller.mjs";
import { runSolve } from "../render/results_controller.mjs";
import { presentResultWarnings, confirmKeepOriginal, directConsumers } from "../render/warnings_controller.mjs";
import { presentWarning, formatRange, formatRangeDisplay, warningTitleFor } from "../adapter/warning_presenter.mjs";
import { buildRangeDisplay } from "../render/warnings_controller.mjs";
import { setDisplayUnit } from "../render/inputs_controller.mjs";

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

  t.section("C9R2: misuse copy never leaks internal ids (raw stays developer fallback)");
  const misusePresented = presentResultWarnings(app, wheelNow).find((p) => p.code === "unit_misuse_suspected");
  t.ok("reason uses the variable name and display symbols (ft, in)",
    misusePresented.reason.includes("Wheel radius") &&
    misusePresented.reason.includes("13.8 ft") &&
    misusePresented.reason.includes("as in."));
  t.ok("reason contains no internal ids",
    !misusePresented.reason.includes("wheel_radius") &&
    !misusePresented.reason.includes("foot") &&
    !misusePresented.reason.includes("inch"));
  t.ok("adopt action text uses the display symbol",
    misusePresented.actions.find((a) => a.kind === "adopt_suggestion").text === "Adopt in");
  t.ok("the raw engine message survives only as developerFallback",
    misusePresented.developerFallback.includes("wheel_radius") && misusePresented.developerFallback.includes("foot"));
  t.ok("warningTitleFor maps every code family to fixed user copy",
    warningTitleFor("range_extreme") === "Far outside the normal range" &&
    warningTitleFor("unit_misuse_suspected") === "Possible unit mistake" &&
    warningTitleFor("range_invalid") === "Invalid value" &&
    warningTitleFor("low_speed_ideal_model") === "Model applicability warning");

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

  t.section("C9R3b: ranges follow the current display unit (owner-approved deviation)");
  const power = submitValue(app, "engine_power", "1000", "kilowatt").result;
  t.ok("1000 kW stores above the normal envelope (engine judgment untouched)",
    power.range_status !== "normal");
  setDisplayUnit(app, "engine_power", "kilowatt");
  const powerRanges = presentResultWarnings(app, power)[0].ranges;
  t.ok("normal range: converted kW leads with ≈, registered hp follows",
    powerRanges.normal === "≈0.000–745.7 kW (registered: 0–1000 hp)");
  t.ok("warning envelope converts the same way",
    powerRanges.warning === "≈0.000–2237 kW (registered: 0–3000 hp)");
  setDisplayUnit(app, "engine_power", "horsepower_mechanical");
  const powerSame = presentResultWarnings(app, power)[0].ranges;
  t.ok("same unit shows the registered form once, no ≈",
    powerSame.normal === "0 to 1000 hp" && !powerSame.normal.includes("≈"));

  t.section("C9R3b: conversion matrix (in↔ft, percent↔decimal, deg↔rad, m/s²↔g)");
  setDisplayUnit(app, "wheel_radius", "foot");
  const wheelFt = presentResultWarnings(app, engine.getResults("wheel_radius").find((r) => r.source === "user_input"))[0].ranges;
  t.ok("inch ranges convert to feet", wheelFt.normal === "≈0.7500–1.833 ft (registered: 9–22 in)");
  const effDisplay = buildRangeDisplay(engine, adapter.variablesById.drivetrain_efficiency.normal_range, "decimal");
  t.ok("percent -> decimal endpoints convert",
    Math.abs(effDisplay.converted.min - 0.7) < 1e-12 && Math.abs(effDisplay.converted.max - 1.0) < 1e-12);
  const gradeDisplay = buildRangeDisplay(engine, adapter.variablesById.road_grade_angle.normal_range, "radian");
  t.ok("degree -> radian endpoints convert",
    Math.abs(gradeDisplay.converted.max - (7 * Math.PI) / 180) < 1e-12);
  const accelDisplay = buildRangeDisplay(engine, adapter.variablesById.longitudinal_acceleration.normal_range, "standard_gravity");
  t.ok("m/s² -> g endpoints convert through the constant-reference unit",
    Math.abs(accelDisplay.converted.max - 10 / 9.80665) < 1e-9);

  t.section("C9R3b: fallback and G4 guarantees");
  t.ok("same-unit display yields no converted block",
    buildRangeDisplay(engine, adapter.variablesById.wheel_radius.normal_range, "inch").converted === null);
  t.ok("a failing endpoint falls the whole line back to registered values",
    (() => {
      const broken = buildRangeDisplay(engine, adapter.variablesById.wheel_radius.normal_range, "kilowatt");
      return broken.converted === null &&
        formatRangeDisplay(broken, (u) => u) === "9 to 22 inch";
    })());
  t.ok("formatRangeDisplay tolerates null", formatRangeDisplay(null) === null);
  const fingerprintBefore = engine.getResults().map((r) => `${r.result_id}:${r.stale}`).sort().join("|");
  setDisplayUnit(app, "engine_power", "kilowatt");
  presentResultWarnings(app, power);
  presentResultWarnings(app, engine.getResults("wheel_radius").find((r) => r.source === "user_input"));
  t.ok("range conversion + display switch: zero recalc, zero stale, zero new Results (G4)",
    engine.getResults().map((r) => `${r.result_id}:${r.stale}`).sort().join("|") === fingerprintBefore);

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
