/**
 * test_path_view_model.mjs — missing-cause classification and target views
 * (§7.2c), against the real engine and catalog.
 */

import {
  MISSING_CAUSE_CLASSES,
  classifyBlockedReason,
  classifyMissingVariable,
  classifyRecommendationMode,
  buildTargetView,
  buildFormulaStatusView,
} from "../adapter/path_view_model.mjs";

export const name = "path_view_model: missing-cause classes (§7.2c)";

export async function run(t) {
  t.section("cause-class vocabulary");
  t.ok(
    "exactly the ten approved classes exist",
    Object.keys(MISSING_CAUSE_CLASSES).length === 10 &&
      [
        "missing_input",
        "invalid_input",
        "assumption_disabled",
        "applicability_or_constraint",
        "model_selection_required",
        "recommended_model_unavailable",
        "circular_dependency",
        "no_registered_direction",
        "depth_limit_reached",
        "blocked_other",
      ].every((k) => k in MISSING_CAUSE_CLASSES)
  );

  t.section("reason-code classification table");
  t.ok("missing_input -> missing_input", classifyBlockedReason("missing_input") === "missing_input");
  t.ok("assumption_not_allowed_for_formula -> missing_input", classifyBlockedReason("assumption_not_allowed_for_formula") === "missing_input");
  t.ok("input_stale -> missing_input", classifyBlockedReason("input_stale") === "missing_input");
  t.ok("input_invalid -> invalid_input", classifyBlockedReason("input_invalid") === "invalid_input");
  t.ok("input_outside_valid_domain -> invalid_input", classifyBlockedReason("input_outside_valid_domain") === "invalid_input");
  t.ok("not_applicable -> applicability_or_constraint", classifyBlockedReason("not_applicable") === "applicability_or_constraint");
  t.ok("constraint_unsatisfied -> applicability_or_constraint", classifyBlockedReason("constraint_unsatisfied") === "applicability_or_constraint");
  t.ok("unknown codes fall to blocked_other", classifyBlockedReason("computability_unsupported") === "blocked_other");

  t.section("recommendation modes");
  t.ok("require_user_selection -> recommended_model_unavailable", classifyRecommendationMode("require_user_selection") === "recommended_model_unavailable");
  t.ok("user_selection_unavailable -> recommended_model_unavailable", classifyRecommendationMode("user_selection_unavailable") === "recommended_model_unavailable");
  t.ok("recommended_default carries no cause", classifyRecommendationMode("recommended_default") === null);
  t.ok("user_input_active carries no cause", classifyRecommendationMode("user_input_active") === null);

  t.section("empty pool: reverse query view");
  const { engine } = await t.freshApp();
  const view = buildTargetView(engine.queryTarget("longitudinal_acceleration"));
  t.ok("outcome not_computable_in_pool with two candidate paths", view.outcome === "not_computable_in_pool" && view.paths.length === 2);
  t.ok(
    "every blocked reason in the view carries a cause class and text",
    view.paths.every((p) =>
      p.blockedReasons.every((r) => r.causeClass in MISSING_CAUSE_CLASSES && r.causeText === MISSING_CAUSE_CLASSES[r.causeClass])
    )
  );
  const missingIds = view.paths.flatMap((p) => p.missingInputs.map((m) => m.variableId));
  t.ok("missing inputs include tractive_force and mass_factor (F007 branch)",
    missingIds.includes("tractive_force") && missingIds.includes("mass_factor"));
  t.ok(
    "missing variables recursively expose derivation options",
    view.paths.some((p) => p.missingInputs.some((m) => m.derivationOptions.length > 0))
  );
  t.ok(
    "enabled default assumptions are not flagged assumption_disabled",
    view.paths.every((p) => p.missingInputs.every((m) => m.causeClass !== "assumption_disabled"))
  );

  t.section("assumption disabled refinement");
  engine.setAssumptionEnabled("road_grade_angle", false);
  const view2 = buildTargetView(engine.queryTarget("longitudinal_acceleration"));
  const f007Path = view2.paths.find((p) => p.formulaId === "F007_engine_limited_acceleration");
  const grade = f007Path.missingInputs.find((m) => m.variableId === "road_grade_angle");
  t.ok("disabled assumption variable is classified Assumption disabled",
    Boolean(grade) && grade.causeClass === "assumption_disabled");
  engine.setAssumptionEnabled("road_grade_angle", true);

  t.section("no registered output direction");
  const torqueView = buildTargetView(engine.queryTarget("engine_torque"));
  t.ok("engine_torque has no producing formula", torqueView.outcome === "no_registered_direction");
  t.ok("view carries the no_registered_direction cause class", torqueView.causeClass === "no_registered_direction");
  t.ok("diagnostics mention direct user input", torqueView.diagnostics.some((d) => d.message.includes("can be entered directly")));

  t.section("R001 recommended-unavailable, real engine");
  const { engine: e2 } = await t.freshApp();
  e2.setUserInput("engine_torque", 310, "foot_pound_force");
  e2.setUserInput("engine_speed", 4800, "revolution_per_minute");
  e2.setUserInput("combined_gear_ratio", 8.0, "decimal");
  e2.setUserInput("wheel_radius", 0.311, "meter");
  e2.setUserInput("vehicle_weight", 3500, "pound_force");
  // drivetrain_efficiency withheld: F004 -> F007 blocked, F008 computable
  const solved = e2.solve();
  t.ok("partial scenario solves", solved.ok === true);
  const rec = e2.getRecommendationStates().find((s) => s.output === "longitudinal_acceleration");
  t.ok("recommended model unavailable -> require_user_selection with R001 message",
    rec.mode === "require_user_selection" && typeof rec.message === "string" && rec.message.length > 0);
  t.ok("mode classifies as recommended_model_unavailable",
    classifyRecommendationMode(rec.mode) === "recommended_model_unavailable");

  t.section("formula status view");
  const blocked = buildFormulaStatusView(e2.getFormulaStatus("F004_tractive_force_from_engine_torque"));
  t.ok("blocked F004 names drivetrain_efficiency as missing",
    blocked.state === "blocked" &&
      blocked.reasons.some((r) => r.variableId === "drivetrain_efficiency" && r.causeClass === "missing_input"));
  const computed = buildFormulaStatusView(e2.getFormulaStatus("F008_ideal_power_acceleration_si"));
  t.ok("computed F008 reports state computed with no reasons",
    computed.state === "computed" && computed.reasons.length === 0);
  t.ok("unknown formula id yields null view", buildFormulaStatusView(e2.getFormulaStatus("F999_missing")) === null);

  t.section("U1: satisfied-conditions field (Part 2 S3.4)");
  // ① no-adapter form: the new field is null and the existing field set holds.
  const bare = buildTargetView(engine.queryTarget("longitudinal_acceleration"));
  t.ok("without an adapter every path reports satisfiedInputs === null",
    bare.paths.length > 0 && bare.paths.every((p) => p.satisfiedInputs === null));
  t.ok("existing path fields are all still present alongside the new column",
    bare.paths.every((p) =>
      ["formulaId", "modelGroup", "modelName", "pathRole", "depth", "status", "cycleDetected", "blockedReasons", "missingInputs"]
        .every((k) => k in p)));
  // ② with the adapter, against the real engine: torque + speed entered.
  const { engine: e3, adapter } = await t.freshApp();
  e3.setUserInput("engine_torque", 310, "foot_pound_force");
  e3.setUserInput("engine_speed", 4800, "revolution_per_minute");
  const satView = buildTargetView(e3.queryTarget("longitudinal_acceleration"), adapter);
  const f007 = satView.paths.find((p) => p.formulaId === "F007_engine_limited_acceleration");
  const f008 = satView.paths.find((p) => p.formulaId === "F008_ideal_power_acceleration_si");
  t.ok("F007 top level: exactly the four enabled default assumptions, in required_inputs order",
    JSON.stringify(f007.satisfiedInputs) ===
    JSON.stringify(["aerodynamic_drag", "rolling_resistance", "road_grade_angle", "hitch_force"]));
  const f004 = f007.missingInputs.find((m) => m.variableId === "tractive_force")
    .derivationOptions.find((o) => o.formulaId === "F004_tractive_force_from_engine_torque");
  t.ok("nested F004 under tractive_force lists the entered engine_torque as satisfied",
    f004.satisfiedInputs.includes("engine_torque"));
  const f003 = f008.missingInputs.find((m) => m.variableId === "engine_power")
    .derivationOptions.find((o) => o.formulaId === "F003_engine_power_from_torque_rpm");
  t.ok("nested F003 under engine_power is exactly [engine_torque, engine_speed]",
    JSON.stringify(f003.satisfiedInputs) === JSON.stringify(["engine_torque", "engine_speed"]));
  const f002 = f008.missingInputs.find((m) => m.variableId === "vehicle_speed")
    .derivationOptions.find((o) => o.formulaId === "F002_vehicle_speed_from_engine_speed");
  t.ok("nested F002 under vehicle_speed is exactly [engine_speed]",
    JSON.stringify(f002.satisfiedInputs) === JSON.stringify(["engine_speed"]));
  // ③ family unions across each candidate tree.
  const unionOf = (path) => {
    const acc = new Set(path.satisfiedInputs ?? []);
    for (const m of path.missingInputs ?? []) {
      for (const option of m.derivationOptions) {
        for (const id of unionOf(option)) acc.add(id);
      }
    }
    return acc;
  };
  const u7 = unionOf(f007);
  const u8 = unionOf(f008);
  t.ok("F007 family union sees engine_torque (via F004) but never engine_speed",
    u7.has("engine_torque") && !u7.has("engine_speed"));
  t.ok("F008 family union sees both engine_torque and engine_speed",
    u8.has("engine_torque") && u8.has("engine_speed"));
}
