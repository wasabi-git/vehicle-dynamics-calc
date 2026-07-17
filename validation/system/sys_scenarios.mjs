/**
 * sys_scenarios.mjs — §7.1: the eight Part 2 §2.8 acceptance scenarios,
 * mechanized against the real engine, adapter, store, and controllers.
 *
 * Every recipe and every branch runs on its own fresh app fixture; every
 * assertion label starts with its checkpoint ID and registers coverage via
 * t.cover(id). Numeric inputs are the registered whitelist values only;
 * self-consistency assertions recompute the §7.14 comparison semantics
 * (×100 percentage, PRECISION formatting, zero-denominator sentence)
 * without introducing new physical judgment values.
 */

import {
  submitValue,
  setDisplayUnit,
  requestRemoveInput,
  confirmPending,
  adoptMisuseSuggestion,
  ignoreMisuseSuggestion,
  applyTireCodeFlow,
} from "../../ui/render/inputs_controller.mjs";
import {
  runSolve,
  requestUseDerived,
  useDerivedConfirmText,
  buildResultsViewModel,
  buildModelSection,
  buttonStateFor,
} from "../../ui/render/results_controller.mjs";
import { presentResultWarnings } from "../../ui/render/warnings_controller.mjs";
import { queryTargetView, selectTarget } from "../../ui/render/targets_controller.mjs";
import {
  NO_RESULT_TEXT,
  noResultState,
  compareUserAndDerived,
  comparisonsForVariable,
  buildDerivationDetail,
} from "../../ui/render/derivation_controller.mjs";
import { setAssumptionFlow } from "../../ui/render/assumptions_controller.mjs";
import { MISSING_CAUSE_CLASSES } from "../../ui/adapter/path_view_model.mjs";
import { formatSignificant, PRECISION } from "../../ui/adapter/view_model.mjs";

export const name = "sys_scenarios: the eight Part 2 §2.8 scenarios (§7.1)";

/** Common input group CHAIN (§7.1). */
const CHAIN = [
  ["engine_torque", "310", "foot_pound_force"],
  ["engine_speed", "4800", "revolution_per_minute"],
  ["combined_gear_ratio", "8.0", "decimal"],
  ["drivetrain_efficiency", "0.90", "decimal"],
  ["wheel_radius", "0.311", "meter"],
  ["vehicle_weight", "3500", "pound_force"],
];

function enterChain(app, { omit = [], override = new Map() } = {}) {
  for (const [variableId, text, unitId] of CHAIN) {
    if (omit.includes(variableId)) continue;
    const [t2, u2] = override.get(variableId) ?? [text, unitId];
    submitValue(app, variableId, t2, u2);
  }
}

const derivedOf = (engine, variableId) =>
  engine.getResults(variableId).filter((r) => r.source === "derived");
const userOf = (engine, variableId) =>
  engine.getResults(variableId).find((r) => r.source === "user_input") ?? null;

export async function run(t) {
  const cover = (id, label, condition) => {
    t.cover(id);
    return t.ok(`${id}: ${label}`, condition);
  };

  // ---- R-S1 (S1.1–S1.5): normal forward calculation --------------------
  {
    const app = await t.freshApp();
    enterChain(app);
    const outcome = runSolve(app);
    cover("S1.1", "a sufficient input set solves and produces derived results",
      outcome.ok === true && app.engine.getResults().some((r) => r.source === "derived"));
    const vm = buildResultsViewModel(app);
    cover("S1.2", "the primary layer carries the active longitudinal acceleration hero",
      vm.layers.primary.some((v) => v.variableId === "longitudinal_acceleration" && v.source === "derived" && v.active === true));
    cover("S1.3", "other derived results render in the secondary layer",
      ["vehicle_speed", "engine_power", "tractive_force"].every((id) =>
        vm.layers.secondary.some((v) => v.variableId === id && v.source === "derived")));
    cover("S1.4", "intermediates sit in their own layer and nothing is expanded by default",
      ["mass_factor", "vehicle_mass"].every((id) => vm.layers.intermediate.some((v) => v.variableId === id)) &&
      app.store.state.expandedResultIds.size === 0);
    const hero = app.engine.getActive("longitudinal_acceleration");
    const detail = buildDerivationDetail(app, hero);
    cover("S1.5", "the expanded detail carries formula, substitution, conversion, sources, and assumptions",
      detail.formulaTree !== null &&
      detail.substitutions.length > 0 &&
      detail.substitutions.some((s) => s.entered !== null && s.conversion.includes("→")) &&
      detail.sources.length > 0 &&
      detail.assumptionsUsed.length > 0);
  }

  // ---- R-S2 (S2.1–S2.5): missing key variable --------------------------
  {
    const app = await t.freshApp();
    enterChain(app, { omit: ["wheel_radius"] });
    const outcome = runSolve(app);
    const derivedIds = [...new Set(app.engine.getResults().filter((r) => r.source === "derived").map((r) => r.variable_id))].sort();
    cover("S2.1", "the partial derived set is exactly {engine_power, mass_factor, vehicle_mass}",
      outcome.ok === true &&
      JSON.stringify(derivedIds) === JSON.stringify(["engine_power", "mass_factor", "vehicle_mass"]));
    const view = queryTargetView(app, "longitudinal_acceleration");
    cover("S2.2", "the unmet primary target reports its missing conditions",
      view.outcome === "not_computable_in_pool" &&
      view.paths.length > 0 &&
      view.paths.every((p) => p.cycleDetected || p.missingInputs.length > 0 || p.blockedReasons.length > 0));
    cover("S2.3", "every missing entry explains itself per path with a registered cause class",
      view.paths.every((p) => p.missingInputs.every((m) =>
        m.causeClass in MISSING_CAUSE_CLASSES && m.causeText === MISSING_CAUSE_CLASSES[m.causeClass])));
    cover("S2.4", "a next input is recommended and it is user-inputtable",
      view.recommendedNext !== null &&
      app.adapter.variablesById[view.recommendedNext].can_be_user_input === true);
    const keys = Object.keys(MISSING_CAUSE_CLASSES);
    cover("S2.5", "the missing-cause key set is the closed ten-class registry with no Conflict class (D24)",
      keys.length === 10 &&
      ["missing_input", "invalid_input", "assumption_disabled", "applicability_or_constraint",
        "model_selection_required", "recommended_model_unavailable", "circular_dependency",
        "no_registered_direction", "depth_limit_reached", "blocked_other"].every((k) => keys.includes(k)) &&
      keys.every((k) => !k.toLowerCase().includes("conflict")));
  }

  // ---- R-S3 (S3.1–S3.7): reverse target query --------------------------
  {
    const app = await t.freshApp();
    submitValue(app, "engine_torque", "310", "foot_pound_force");
    submitValue(app, "engine_speed", "4800", "revolution_per_minute");
    const view = queryTargetView(app, "longitudinal_acceleration");
    cover("S3.1", "the target variable itself is reported",
      view.target === "longitudinal_acceleration" && view.outcome === "not_computable_in_pool");
    const byFormula = Object.fromEntries(view.paths.map((p) => [p.formulaId, p]));
    const f007 = byFormula.F007_engine_limited_acceleration;
    const f008 = byFormula.F008_ideal_power_acceleration_si;
    cover("S3.2", "feasible paths are listed in reverse: both registered acceleration formulas",
      view.paths.length === 2 && Boolean(f007) && Boolean(f008));
    cover("S3.3", "each path lists its own required conditions",
      view.paths.every((p) => p.missingInputs.length > 0 &&
        p.missingInputs.every((m) => typeof m.variableId === "string" && typeof m.causeText === "string")));
    const nested = (path, missingId, formulaId) =>
      path.missingInputs.find((m) => m.variableId === missingId)
        ?.derivationOptions.find((o) => o.formulaId === formulaId) ?? null;
    const f004 = nested(f007, "tractive_force", "F004_tractive_force_from_engine_torque");
    const f003 = nested(f008, "engine_power", "F003_engine_power_from_torque_rpm");
    const f002 = nested(f008, "vehicle_speed", "F002_vehicle_speed_from_engine_speed");
    const unionOf = (path) => {
      const acc = new Set(path.satisfiedInputs ?? []);
      for (const m of path.missingInputs ?? []) {
        for (const option of m.derivationOptions) for (const id of unionOf(option)) acc.add(id);
      }
      return acc;
    };
    const u7 = unionOf(f007);
    const u8 = unionOf(f008);
    cover("S3.4", "already-satisfied conditions are real product output (U1): F007 four assumptions, F003 both inputs, F002 engine_speed, family unions",
      JSON.stringify(f007.satisfiedInputs) ===
        JSON.stringify(["aerodynamic_drag", "rolling_resistance", "road_grade_angle", "hitch_force"]) &&
      f004 !== null && f004.satisfiedInputs.includes("engine_torque") &&
      f003 !== null && JSON.stringify(f003.satisfiedInputs) === JSON.stringify(["engine_torque", "engine_speed"]) &&
      f002 !== null && JSON.stringify(f002.satisfiedInputs) === JSON.stringify(["engine_speed"]) &&
      u7.has("engine_torque") && !u7.has("engine_speed") &&
      u8.has("engine_torque") && u8.has("engine_speed"));
    cover("S3.5", "missing conditions are listed and never overlap the satisfied list",
      view.paths.every((p) => p.missingInputs.every((m) => !p.satisfiedInputs.includes(m.variableId))) &&
      f008.missingInputs.map((m) => m.variableId).includes("engine_power"));
    cover("S3.6", "the two paths carry different physical models",
      new Set(view.paths.map((p) => p.modelName)).size === 2 &&
      view.paths.every((p) => typeof p.modelName === "string" && p.modelName.length > 0));
    cover("S3.7", "no numeric result is fabricated for the unmet target",
      app.engine.getActive("longitudinal_acceleration") === null &&
      !("value" in view) && !("valueSi" in view) &&
      view.paths.every((p) => !("value" in p) && !("valueSi" in p)));
  }

  // ---- R-S4 (S4.1–S4.6): unit misuse, two fresh branches ---------------
  const misuseFixture = async () => {
    const app = await t.freshApp();
    enterChain(app, { override: new Map([["wheel_radius", ["13.8", "foot"]]]) });
    const wheel = userOf(app.engine, "wheel_radius");
    runSolve(app);
    return { app, wheel };
  };
  {
    const { app, wheel } = await misuseFixture();
    const presented = presentResultWarnings(app, wheel);
    const misuse = presented.find((p) => p.code === "unit_misuse_suspected");
    cover("S4.1", "a probable unit mistake is flagged before any value judgment is final",
      Boolean(misuse) && misuse.title === "Possible unit mistake");
    const adopt = misuse.actions.find((a) => a.kind === "adopt_suggestion");
    cover("S4.2", "the recommended unit is shown as an adoptable action (inch)",
      Boolean(adopt) && adopt.suggestion.suggestedUnit === "inch" &&
      String(adopt.suggestion.enteredValue) === "13.8");
    cover("S4.3", "the physical meaning under the recommended unit is explained",
      misuse.reason.includes("far outside its plausible range") &&
      misuse.reason.includes("normal range"));
    const liveWheel = userOf(app.engine, "wheel_radius");
    const snapshot = app.store.state.inputSnapshotByResultId.get(wheel.result_id);
    cover("S4.4", "the unit is never auto-modified: same instance, entered unit still foot",
      liveWheel.result_id === wheel.result_id &&
      snapshot.enteredUnit === "foot" && String(snapshot.enteredValue) === "13.8");

    // branch a: keep the original value
    const poolBefore = app.engine.getResults().map((r) => r.result_id).sort().join(",");
    ignoreMisuseSuggestion(app, wheel.result_id);
    const poolAfter = app.engine.getResults().map((r) => r.result_id).sort().join(",");
    const rePresented = presentResultWarnings(app, userOf(app.engine, "wheel_radius"))
      .find((p) => p.code === "unit_misuse_suspected");
    cover("S4.6", "keeping the original value performs zero engine operations and the warning persists",
      poolBefore === poolAfter &&
      Boolean(rePresented) && rePresented.actions.length === 0 &&
      userOf(app.engine, "wheel_radius").warnings.some((w) => w.code === "unit_misuse_suspected"));
  }
  {
    // branch b: adopt the suggestion
    const { app, wheel } = await misuseFixture();
    const misuse = presentResultWarnings(app, wheel).find((p) => p.code === "unit_misuse_suspected");
    const adopt = misuse.actions.find((a) => a.kind === "adopt_suggestion");
    const submitOutcome = adoptMisuseSuggestion(app, adopt.suggestion);
    const newWheel = userOf(app.engine, "wheel_radius");
    cover("S4.5", "adopting mints a new instance in the suggested unit and marks dependents needs-recalculation",
      submitOutcome.submitted === true &&
      newWheel.result_id !== wheel.result_id &&
      app.store.state.inputSnapshotByResultId.get(newWheel.result_id).enteredUnit === "inch" &&
      newWheel.range_status === "normal" &&
      app.engine.getResults().some((r) => r.source === "derived" && r.stale === true) &&
      app.store.state.calculationPhase === "needs_recalc");
  }

  // ---- R-S5 (S5.1–S5.5): invalid input blocks only its branch ----------
  {
    const app = await t.freshApp();
    submitValue(app, "drivetrain_efficiency", "1.2", "decimal");
    submitValue(app, "engine_torque", "310", "foot_pound_force");
    submitValue(app, "engine_speed", "4800", "revolution_per_minute");
    submitValue(app, "combined_gear_ratio", "8.0", "decimal");
    submitValue(app, "wheel_radius", "0.311", "meter");
    runSolve(app);
    const eff = userOf(app.engine, "drivetrain_efficiency");
    cover("S5.1", "the out-of-domain efficiency value is marked invalid",
      eff.range_status === "invalid");
    const derived = app.engine.getResults().filter((r) => r.source === "derived");
    cover("S5.2", "the invalid value participates in no derivation",
      derived.every((r) => !r.dependencies.includes(eff.result_id)));
    cover("S5.3", "only the dependent branch is blocked: no tractive force, no engine-limited acceleration",
      derivedOf(app.engine, "tractive_force").length === 0 &&
      derivedOf(app.engine, "longitudinal_acceleration").length === 0);
    cover("S5.4", "independent branches keep calculating: engine power and vehicle speed exist",
      derivedOf(app.engine, "engine_power").length > 0 &&
      derivedOf(app.engine, "vehicle_speed").length > 0);
    const view = queryTargetView(app, "tractive_force");
    const f004 = view.paths.find((p) => p.formulaId === "F004_tractive_force_from_engine_torque");
    const effAsInvalid =
      f004.blockedReasons.some((r) => r.variableId === "drivetrain_efficiency" && r.causeClass === "invalid_input") ||
      f004.missingInputs.some((m) => m.variableId === "drivetrain_efficiency" && m.causeClass === "invalid_input");
    cover("S5.5", "the missing-conditions area classifies the efficiency as Invalid, never plain Missing",
      effAsInvalid &&
      !f004.missingInputs.some((m) => m.variableId === "drivetrain_efficiency" && m.causeClass === "missing_input"));
  }

  // ---- R-S6a (S6.1–S6.7): user value and derived value coexist ---------
  {
    const app = await t.freshApp();
    enterChain(app);
    const tire = await applyTireCodeFlow(app, "195/55R16");
    runSolve(app);
    const user = userOf(app.engine, "wheel_radius");
    const derived = derivedOf(app.engine, "wheel_radius");
    cover("S6.1", "the user wheel-radius input is kept after the tire-code derivation",
      tire.ok === true && Boolean(user));
    cover("S6.2", "the derived wheel radius (tire formula) is kept alongside it",
      derived.length > 0 && derived.every((r) => r.formula_id === "F001_wheel_radius_from_tire_size"));
    cover("S6.3", "the user input is Active by default; the derived twin is not",
      user.active === true && derived.every((r) => r.active === false));
    setDisplayUnit(app, "wheel_radius", "foot");
    const comparisons = comparisonsForVariable(app, "wheel_radius");
    cover("S6.4", "the derived value serves as a check: a comparison row exists per derived instance",
      comparisons.length === derived.length && comparisons.length > 0);
    const c = comparisons[0];
    cover("S6.5", "the absolute difference is shown in SI and in the chosen display unit, PRECISION-formatted",
      typeof c.absoluteSi === "number" &&
      c.absoluteSiText === formatSignificant(c.absoluteSi, PRECISION.result) &&
      c.displayUnit === "foot" && c.displayDelta !== null &&
      c.displayDeltaText === formatSignificant(c.displayDelta, PRECISION.result));
    cover("S6.6", "the percentage difference recomputes identically (absolute / |user SI| × 100)",
      c.percentage !== null &&
      c.percentage === (c.absoluteSi / Math.abs(user.value_si)) * 100 &&
      c.percentageText === `${formatSignificant(c.percentage, PRECISION.result)}%`);
    const zero = compareUserAndDerived(
      { result_id: user.result_id, value_si: 0 },
      { result_id: derived[0].result_id, value_si: derived[0].value_si, model: null },
      { engine: app.engine, displayUnit: null });
    t.ok("S6.6: zero-reference percentage renders the fixed unavailable sentence",
      zero.percentage === null &&
      zero.percentageText === "Percentage difference unavailable (reference value is zero).");
    cover("S6.7", "nothing silently overwrites the user input after recalculation",
      userOf(app.engine, "wheel_radius").result_id === user.result_id &&
      userOf(app.engine, "wheel_radius").active === true &&
      derivedOf(app.engine, "wheel_radius").every((r) => r.active === false));
    const section = buildModelSection("longitudinal_acceleration", app);
    t.ok("S6.7: both acceleration model rows coexist in the model section",
      section !== null && section.rows.length === 2);
  }

  // ---- R-S6b (S6.8): use derived value, full-chain D25 seven steps -----
  {
    const app = await t.freshApp();
    enterChain(app);
    runSolve(app);
    submitValue(app, "vehicle_mass", "3500", "pound_mass");
    runSolve(app);
    const userMass = userOf(app.engine, "vehicle_mass");
    const accConsumers = app.engine.getResults("longitudinal_acceleration")
      .filter((r) => r.source === "derived" && r.dependencies.includes(userMass.result_id));
    t.ok("S6.8: after recalculation the user vehicle mass is Active and feeds the real acceleration chain",
      userMass.active === true && accConsumers.length > 0 && accConsumers.every((r) => r.stale !== true));
    requestUseDerived(app, "vehicle_mass");
    t.ok("S6.8: the request fills the single confirmation slot with the vehicle-mass payload",
      app.store.state.pendingConfirmation.kind === "use_derived" &&
      app.store.state.pendingConfirmation.payload.variableId === "vehicle_mass");
    t.ok("S6.8: the confirmation copy names the variable by display name",
      useDerivedConfirmText(app.adapter.variablesById.vehicle_mass.name)
        .startsWith("This removes your input for Vehicle mass."));
    confirmPending(app);
    const accAfter = accConsumers.map((r) => app.engine.getByResultId(r.result_id));
    const derivedMid = derivedOf(app.engine, "vehicle_mass");
    t.ok("S6.8: confirming removes the input and the REAL acceleration dependents go stale",
      userOf(app.engine, "vehicle_mass") === null &&
      accAfter.length > 0 && accAfter.every((r) => r.stale === true));
    t.ok("S6.8: the phase is needs_recalc and the derived mass is not yet Active (promotion only in solve)",
      app.store.state.calculationPhase === "needs_recalc" &&
      buttonStateFor(app.store.state.calculationPhase, null).text === "Recalculate" &&
      derivedMid.length > 0 && derivedMid.every((r) => r.active === false));
    runSolve(app);
    const activeMass = derivedOf(app.engine, "vehicle_mass").find((r) => r.active === true);
    const finalAcc = app.engine.getActive("longitudinal_acceleration");
    cover("S6.8", "after Recalculate the derived mass is Active and the dependent acceleration is fresh again",
      Boolean(activeMass) &&
      Boolean(finalAcc) && finalAcc.stale !== true &&
      finalAcc.dependencies.includes(activeMass.result_id));
  }

  // ---- R-S7 (S7.1–S7.6): assumptions participate -----------------------
  {
    const app = await t.freshApp();
    enterChain(app);
    const outcome = runSolve(app);
    const hero = app.engine.getActive("longitudinal_acceleration");
    cover("S7.1", "the calculation completes normally with default assumptions participating",
      outcome.ok === true && Boolean(hero) && hero.assumptions_used.length > 0);
    const vm = buildResultsViewModel(app);
    const heroView = vm.layers.primary.find((v) => v.resultId === hero.result_id);
    cover("S7.2", "the hero row carries the Uses assumptions label",
      Boolean(heroView) && heroView.labels.some((l) => l.key === "uses_assumptions" && l.text === "Uses assumptions"));
    const detail = buildDerivationDetail(app, hero);
    cover("S7.3", "the expanded detail lists the specific assumptions used",
      detail.assumptionsUsed.length > 0 &&
      JSON.stringify(detail.assumptionsUsed).includes("road_grade_angle"));
    cover("S7.4", "assumption dependencies show the assumption source",
      detail.substitutions.some((s) => s.source === "assumption"));
    setAssumptionFlow(app, "road_grade_angle", false);
    const view = queryTargetView(app, "longitudinal_acceleration");
    const gradeEntries = view.paths
      .flatMap((p) => p.missingInputs)
      .filter((m) => m.variableId === "road_grade_angle");
    cover("S7.5", "disabling the assumption moves the dependent into a missing-conditions state classified Assumption disabled",
      app.store.state.calculationPhase === "needs_recalc" &&
      gradeEntries.length > 0 &&
      gradeEntries.every((m) => m.causeClass === "assumption_disabled" &&
        m.causeText === MISSING_CAUSE_CLASSES.assumption_disabled));
    submitValue(app, "road_grade_angle", "8.0", "degree");
    runSolve(app);
    const userGrade = userOf(app.engine, "road_grade_angle");
    const finalAcc = app.engine.getActive("longitudinal_acceleration");
    cover("S7.6", "a real value replaces the assumption in the recalculated chain",
      Boolean(userGrade) && userGrade.active === true &&
      Boolean(finalAcc) && finalAcc.stale !== true &&
      finalAcc.dependencies.includes(userGrade.result_id) &&
      app.engine.getResults("road_grade_angle").every((r) => r.source !== "assumption" || r.active === false));
  }

  // ---- R-S8a (S8.1–S8.6): input change marks affected results stale ----
  {
    const app = await t.freshApp();
    enterChain(app);
    runSolve(app);
    const prevAcc = app.engine.getActive("longitudinal_acceleration");
    const prevValue = prevAcc.value_si;
    submitValue(app, "vehicle_weight", "3575", "pound_force");
    const staleVariables = [...new Set(app.engine.getResults()
      .filter((r) => r.source === "derived" && r.stale === true)
      .map((r) => r.variable_id))].sort();
    cover("S8.1", "exactly the weight-dependent results are found affected: vehicle mass and acceleration",
      JSON.stringify(staleVariables) === JSON.stringify(["longitudinal_acceleration", "vehicle_mass"]));
    const vm = buildResultsViewModel(app);
    const staleViews = [...vm.layers.primary, ...vm.layers.secondary, ...vm.layers.intermediate]
      .filter((v) => v.stale === true);
    cover("S8.2", "affected rows carry the Needs recalculation label and the phase turns needs_recalc",
      app.store.state.calculationPhase === "needs_recalc" &&
      staleViews.length > 0 &&
      staleViews.every((v) => v.labels.some((l) => l.key === "needs_recalculation" && l.text === "Needs recalculation")));
    const keptAcc = app.engine.getByResultId(prevAcc.result_id);
    cover("S8.3", "the old value is kept for reference on the stale instance",
      Boolean(keptAcc) && keptAcc.stale === true && keptAcc.value_si === prevValue);
    cover("S8.5", "unaffected results stay valid and fresh",
      ["engine_power", "vehicle_speed", "tractive_force", "mass_factor"].every((id) =>
        derivedOf(app.engine, id).some((r) => r.stale !== true)));
    runSolve(app);
    const newAcc = app.engine.getActive("longitudinal_acceleration");
    const newWeight = userOf(app.engine, "vehicle_weight");
    cover("S8.6", "Recalculate updates the result and its derivation to the new input",
      Boolean(newAcc) && newAcc.stale !== true &&
      newAcc.result_id !== prevAcc.result_id &&
      buildDerivationDetail(app, newAcc).substitutions.some((s) => s.resultId === newWeight.result_id));
    const depNodes = newAcc.dependencies.map((id) => app.engine.getByResultId(id));
    cover("S8.4", "the fresh recalculation consumes no stale instance",
      depNodes.every((d) => d && d.stale !== true) &&
      !newAcc.dependencies.includes(prevAcc.result_id));
  }

  // ---- R-S8b (S8.7): recalculation cannot reproduce the result ---------
  {
    const app = await t.freshApp();
    enterChain(app);
    runSolve(app);
    requestRemoveInput(app, "wheel_radius");
    confirmPending(app);
    runSolve(app);
    selectTarget(app, "longitudinal_acceleration");
    const active = app.engine.getActive("longitudinal_acceleration");
    const vm = buildResultsViewModel(app);
    const accRows = [...vm.layers.primary, ...vm.layers.secondary, ...vm.layers.intermediate]
      .filter((v) => v.variableId === "longitudinal_acceleration" && v.stale !== true);
    const view = queryTargetView(app, "longitudinal_acceleration");
    const missingUnion = new Set(view.paths.flatMap((p) => [
      ...p.missingInputs.map((m) => m.variableId),
      ...p.missingInputs.flatMap((m) => m.derivationOptions.flatMap((o) => o.missingInputs.map((n) => n.variableId))),
    ]));
    cover("S8.7", "the acceleration leaves the valid results area and turns into a missing-conditions explanation",
      (active === null || active.stale === true) &&
      accRows.length === 0 &&
      noResultState(app) === "target_unavailable" &&
      NO_RESULT_TEXT.target_unavailable.includes("Missing Conditions") &&
      view.outcome === "not_computable_in_pool" &&
      missingUnion.has("wheel_radius"));
  }
}
