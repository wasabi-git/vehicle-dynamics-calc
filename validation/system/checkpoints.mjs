/**
 * checkpoints.mjs — the 49-checkpoint manifest (the work package's §8
 * master table, transcribed).
 *
 * Pure data, zero imports. The Node runner enforces N-set closure against
 * this list; the browser system page enforces B-set closure against the
 * same list. Channels: N = Node scenario suite (sys_scenarios.mjs);
 * B = browser system page (system.html). crossRef names existing-gate
 * evidence (A channel) — never counted for closure. Recipes are the §7.1
 * fixtures.
 */

export const CHECKPOINTS = Object.freeze([
  { id: "S1.1", title: "Compute currently available results", part2Lines: "2462-2470", channels: ["N", "B"], crossRef: null, recipe: "R-S1" },
  { id: "S1.2", title: "Show the primary result", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S1" },
  { id: "S1.3", title: "Show other derived results", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S1" },
  { id: "S1.4", title: "Collapse intermediate results", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S1" },
  { id: "S1.5", title: "Expanded view shows formula, substitution, conversion, sources, assumptions", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S1" },
  { id: "S2.1", title: "Compute the computable partial results", part2Lines: "2472-2480", channels: ["N"], crossRef: null, recipe: "R-S2" },
  { id: "S2.2", title: "Show missing conditions for important targets", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S2" },
  { id: "S2.3", title: "Explain what is missing per path scheme", part2Lines: null, channels: ["N", "B"], crossRef: "ui: test_path_view_model", recipe: "R-S2" },
  { id: "S2.4", title: "Recommend the next input", part2Lines: null, channels: ["N"], crossRef: "ui: test_targets", recipe: "R-S2" },
  { id: "S2.5", title: "Invalid / assumption-off never shown as plain Missing (missing-cause key-set identity, no Conflict class, D24)", part2Lines: null, channels: ["N"], crossRef: null, recipe: "R-S2/S5/S7" },
  { id: "S3.1", title: "Show the target variable", part2Lines: "2482-2492", channels: ["N", "B"], crossRef: null, recipe: "R-S3" },
  { id: "S3.2", title: "List feasible paths in reverse", part2Lines: null, channels: ["N", "B"], crossRef: "engine: test_reverse", recipe: "R-S3" },
  { id: "S3.3", title: "Show each path's required conditions", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S3" },
  { id: "S3.4", title: "Show already-satisfied conditions (U1 real product output: satisfiedInputs field + .path-satisfied row)", part2Lines: null, channels: ["N", "B"], crossRef: "ui: U1 regression group", recipe: "R-S3" },
  { id: "S3.5", title: "Show missing conditions", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S3" },
  { id: "S3.6", title: "Mark different physical-model paths", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S3" },
  { id: "S3.7", title: "No fabricated numeric results", part2Lines: null, channels: ["N"], crossRef: null, recipe: "R-S3" },
  { id: "S4.1", title: "Warn first of probable unit misuse", part2Lines: "2494-2503", channels: ["N", "B"], crossRef: "engine: test_unit_misuse", recipe: "R-S4" },
  { id: "S4.2", title: "Show the recommended unit", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S4" },
  { id: "S4.3", title: "Show the physical meaning under the recommended unit", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S4" },
  { id: "S4.4", title: "Never auto-modify the unit", part2Lines: null, channels: ["N"], crossRef: "ui: test_inputs_controller G4", recipe: "R-S4" },
  { id: "S4.5", title: "Accepting marks dependents needs-recalculation", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S4 branch b" },
  { id: "S4.6", title: "Keeping the original value keeps the warning", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S4 branch a" },
  { id: "S5.1", title: "Mark the value invalid", part2Lines: "2505-2513", channels: ["N", "B"], crossRef: null, recipe: "R-S5" },
  { id: "S5.2", title: "Invalid value never participates in calculation", part2Lines: null, channels: ["N"], crossRef: "engine: invalid blocking", recipe: "R-S5" },
  { id: "S5.3", title: "Block only dependent branches", part2Lines: null, channels: ["N"], crossRef: null, recipe: "R-S5" },
  { id: "S5.4", title: "Independent branches keep calculating", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S5" },
  { id: "S5.5", title: "Missing-conditions area says Invalid, not Missing", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S5" },
  { id: "S6.1", title: "Keep the user input value", part2Lines: "2515-2526", channels: ["N"], crossRef: null, recipe: "R-S6a" },
  { id: "S6.2", title: "Keep the derived value", part2Lines: null, channels: ["N"], crossRef: null, recipe: "R-S6a" },
  { id: "S6.3", title: "User input Active by default", part2Lines: null, channels: ["N"], crossRef: "engine: user_input_default_active", recipe: "R-S6a" },
  { id: "S6.4", title: "Derived value serves as a check", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S6a" },
  { id: "S6.5", title: "Show the absolute difference", part2Lines: null, channels: ["N", "B"], crossRef: "ui: test_comparison", recipe: "R-S6a" },
  { id: "S6.6", title: "Show the percentage difference", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S6a" },
  { id: "S6.7", title: "No silent overwrite of user input", part2Lines: null, channels: ["N"], crossRef: null, recipe: "R-S6a" },
  { id: "S6.8", title: "Use derived value -> pending recalculation (D25 seven steps, full-chain fixture, real dependent stale)", part2Lines: null, channels: ["N", "B"], crossRef: "ui: test_results_controller D25", recipe: "R-S6b" },
  { id: "S7.1", title: "Normal calculation with assumptions", part2Lines: "2528-2537", channels: ["N"], crossRef: null, recipe: "R-S7" },
  { id: "S7.2", title: "Show \"Uses assumptions\"", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S7" },
  { id: "S7.3", title: "Expanded view lists the specific assumptions", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S7" },
  { id: "S7.4", title: "Show source Assumed", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S7" },
  { id: "S7.5", title: "Disabling an assumption -> missing-conditions state", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S7" },
  { id: "S7.6", title: "Real value displaces the assumption", part2Lines: null, channels: ["N"], crossRef: "engine: displacement/suppression semantics", recipe: "R-S7" },
  { id: "S8.1", title: "Find affected results", part2Lines: "2539-2549", channels: ["N"], crossRef: null, recipe: "R-S8a" },
  { id: "S8.2", title: "Mark Needs recalculation", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S8a" },
  { id: "S8.3", title: "Keep old values for reference", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S8a" },
  { id: "S8.4", title: "Stale results never feed later calculation", part2Lines: null, channels: ["N"], crossRef: "engine: test_stale", recipe: "R-S8a" },
  { id: "S8.5", title: "Unaffected results stay valid", part2Lines: null, channels: ["N"], crossRef: null, recipe: "R-S8a" },
  { id: "S8.6", title: "Recalculate updates results and derivations", part2Lines: null, channels: ["N", "B"], crossRef: null, recipe: "R-S8a" },
  { id: "S8.7", title: "Recalc cannot reproduce the result -> moved out and explained as missing conditions", part2Lines: null, channels: ["N"], crossRef: null, recipe: "R-S8b" },
].map(Object.freeze));
