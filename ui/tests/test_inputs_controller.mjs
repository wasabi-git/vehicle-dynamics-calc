/**
 * test_inputs_controller.mjs — Inputs-region controller: search/category,
 * add/submit/remove/clear flows, snapshots (§7.4), drafts (§7.2), and the
 * G4 negative: display-unit switching has zero engine side effects (§7.3).
 */

import { createStore } from "../state/store.mjs";
import {
  filterVariables,
  availableCategories,
  addVariable,
  clearHighlight,
  submitValue,
  setDisplayUnit,
  requestRemoveInput,
  requestClearAll,
  cancelPending,
  confirmPending,
  applyTireCodeFlow,
  isUnfinishedDraft,
} from "../render/inputs_controller.mjs";

export const name = "inputs_controller: flows + G4 zero-side-effect switch";

function poolFingerprint(engine) {
  const rows = engine
    .getResults()
    .map((r) => `${r.result_id}:${r.key}:${r.stale}:${r.active}`)
    .sort();
  return JSON.stringify(rows);
}

export async function run(t) {
  const { engine, adapter } = await t.freshApp();
  const store = createStore();
  const app = { engine, adapter, store, createScratchEngine: async () => (await t.freshApp()).engine };

  t.section("search and category filtering");
  store.state.variableSearchQuery = "torque";
  t.ok("name/id search finds engine_torque",
    filterVariables(app).some((v) => v.variable_id === "engine_torque"));
  store.state.variableSearchQuery = "T_e";
  t.ok("symbol search finds engine_torque",
    filterVariables(app).some((v) => v.variable_id === "engine_torque"));
  store.state.variableSearchQuery = "";
  store.state.selectedCategory = "tire_wheel";
  const tireVars = filterVariables(app);
  t.ok("category filter groups the tire/wheel variables",
    tireVars.length > 0 && tireVars.every((v) => v.category === "tire_wheel"));
  store.state.selectedCategory = null;
  t.ok("only user-inputtable variables are offered",
    filterVariables(app).every((v) => v.can_be_user_input === true));
  t.ok("gravity (constant) is never offered",
    !filterVariables(app).some((v) => v.variable_id === "gravity"));
  t.ok("available categories exclude constants",
    !availableCategories(app).includes("constants"));

  t.section("add + duplicate locate-highlight");
  t.ok("first add succeeds", addVariable(app, "engine_torque").added === true);
  t.ok("row order records the add", store.state.uiInputOrder.includes("engine_torque"));
  const dup = addVariable(app, "engine_torque");
  t.ok("duplicate add does not add a second row",
    dup.duplicate === true && store.state.uiInputOrder.filter((v) => v === "engine_torque").length === 1);
  t.ok("duplicate add highlights the existing row", store.state.highlightedVariableId === "engine_torque");
  clearHighlight(app);
  t.ok("highlight clears on timeout", store.state.highlightedVariableId === null);

  t.section("drafts never reach the engine (§7.2)");
  t.ok("draft shapes recognized", ["", "-", ".", " - "].every(isUnfinishedDraft));
  const beforeDraft = poolFingerprint(engine);
  const draftOutcome = submitValue(app, "engine_torque", "-", "foot_pound_force");
  t.ok("draft is stored, not submitted",
    draftOutcome.kind === "draft" && store.state.inputDraftByVariableId.get("engine_torque") === "-");
  t.ok("draft produces a row diagnostic, not an error",
    store.state.inputDiagnosticByVariableId.get("engine_torque").kind === "draft");
  t.ok("engine pool untouched by drafts", poolFingerprint(engine) === beforeDraft);
  const junkOutcome = submitValue(app, "engine_torque", "abc", "foot_pound_force");
  t.ok("non-numeric text is diagnosed without an engine call",
    junkOutcome.kind === "not_a_number" && poolFingerprint(engine) === beforeDraft);

  t.section("submit + snapshot (§7.4)");
  const submit = submitValue(app, "engine_torque", "310", "foot_pound_force");
  t.ok("numeric submit reaches the engine", submit.submitted === true && submit.result.source === "user_input");
  const snap = store.state.inputSnapshotByResultId.get(submit.result.result_id);
  t.ok("snapshot keyed by result_id records entered value and unit",
    snap && snap.variableId === "engine_torque" && snap.enteredValue === 310 && snap.enteredUnit === "foot_pound_force");
  t.ok("draft and diagnostic are cleared on success",
    !store.state.inputDraftByVariableId.has("engine_torque") &&
    !store.state.inputDiagnosticByVariableId.has("engine_torque"));
  t.ok("phase moves to ready before the first solve", store.state.calculationPhase === "ready");

  const resubmit = submitValue(app, "engine_torque", "310", "foot_pound_force");
  t.ok("re-submit mints a new result_id", resubmit.result.result_id !== submit.result.result_id);
  t.ok("snapshots for retired instances are retained for the session",
    store.state.inputSnapshotByResultId.has(submit.result.result_id) &&
    store.state.inputSnapshotByResultId.has(resubmit.result.result_id));

  t.section("engine rejection is surfaced as a row diagnostic");
  const rejected = submitValue(app, "gravity", "310", "meter_per_second_squared");
  t.ok("constant rejects user input with a diagnostic",
    rejected.kind === "rejected" && store.state.inputDiagnosticByVariableId.get("gravity").kind === "rejected");
  const rejectedDiag = store.state.inputDiagnosticByVariableId.get("gravity");
  t.ok("C9R2: rejection copy is friendly (variable name), raw diagnostic only as developerFallback",
    rejectedDiag.message.includes("Gravity") &&
    !rejectedDiag.message.includes("gravity ") &&
    typeof rejectedDiag.developerFallback === "string" && rejectedDiag.developerFallback.length > 0);

  t.section("G4 negative: display switch has zero engine side effects (§7.3)");
  submitValue(app, "engine_speed", "4800", "revolution_per_minute");
  engine.solve();
  const before = poolFingerprint(engine);
  setDisplayUnit(app, "engine_torque", "newton_meter");
  setDisplayUnit(app, "engine_power", "kilowatt");
  setDisplayUnit(app, "engine_torque", "foot_pound_force");
  t.ok("instance count, result_id set, stale set, and active set all unchanged",
    poolFingerprint(engine) === before);
  t.ok("display unit selections landed in the store",
    store.state.displayUnitByVariableId.get("engine_power") === "kilowatt");
  const power = engine.getResults("engine_power").find((r) => r.source === "derived");
  const kw = engine.displayValue(power, "kilowatt");
  t.ok("displayValue converts on demand without touching the pool",
    kw.ok === true && poolFingerprint(engine) === before);

  t.section("remove flow via the confirmation slot");
  requestRemoveInput(app, "engine_torque");
  t.ok("confirmation slot holds remove_input", store.state.pendingConfirmation.kind === "remove_input");
  cancelPending(app);
  t.ok("cancel leaves the input in place",
    store.state.pendingConfirmation === null && engine.getResults("engine_torque").some((r) => r.source === "user_input"));
  requestRemoveInput(app, "engine_torque");
  const removed = confirmPending(app);
  t.ok("confirm removes the input and the row",
    removed.done === true &&
    !engine.getResults("engine_torque").some((r) => r.source === "user_input") &&
    !store.state.uiInputOrder.includes("engine_torque"));
  t.ok("removal stales the derived consumers",
    engine.getResults().some((r) => r.stale === true));

  t.section("clear-all flow (second-step confirmation)");
  requestClearAll(app);
  t.ok("confirmation slot holds clear_all", store.state.pendingConfirmation.kind === "clear_all");
  const constantsBefore = engine.getResults().filter((r) => r.source === "constant").length;
  const assumptionsBefore = engine.getResults().filter((r) => r.source === "assumption").length;
  confirmPending(app);
  t.ok("all user inputs are removed",
    engine.getResults().every((r) => r.source !== "user_input") && store.state.uiInputOrder.length === 0);
  t.ok("constants and assumption instances survive clear-all",
    engine.getResults().filter((r) => r.source === "constant").length === constantsBefore &&
    engine.getResults().filter((r) => r.source === "assumption").length === assumptionsBefore);

  t.section("tire-code flow records snapshots and rows");
  const tire = await applyTireCodeFlow(app, "195/55R16");
  t.ok("tire flow applies all three inputs", tire.ok === true && tire.applied.length === 3);
  t.ok("all three rows joined uiInputOrder",
    ["section_width", "aspect_ratio", "rim_diameter"].every((v) => store.state.uiInputOrder.includes(v)));
  t.ok("all three snapshots recorded under their result_ids",
    tire.applied.every((a) => {
      const s = store.state.inputSnapshotByResultId.get(a.result.result_id);
      return s && s.variableId === a.variableId && s.enteredUnit === a.unitId;
    }));
  const badTire = await applyTireCodeFlow(app, "195/55R16 91V");
  t.ok("syntax rejection reports the fixed hint and applies nothing",
    badTire.ok === false && badTire.stage === "syntax" && badTire.applied.length === 0);
}
