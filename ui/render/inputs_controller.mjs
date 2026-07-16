/**
 * inputs_controller.mjs — Inputs-region controller logic (no DOM).
 *
 * Responsibilities: variable search/category filtering, add/submit/remove
 * flows, the clear-all and remove confirmations (single pendingConfirmation
 * slot), display-unit switching (§7.3 track 1 — display only, zero engine
 * operations), input snapshots (§7.4), draft handling (§7.2 — unfinished
 * drafts never reach setUserInput), and calculationPhase upkeep.
 *
 * The DOM view (inputs_view.mjs) calls these functions and re-renders on
 * store notifications. Everything here is Node-testable.
 */

import {
  judgeCalculationPhase,
  countEffectiveUserInputs,
  hasStaleInstances,
} from "../state/store.mjs";
import { parseTireCode, precheckTireCode, applyTireCode, TIRE_CODE_HINT } from "../adapter/tire_code.mjs";

/** Unfinished draft shapes that must never reach the engine (spec-fixed). */
const DRAFT_SHAPES = new Set(["", "-", ".", "-.", "+", "+."]);

export function isUnfinishedDraft(text) {
  return DRAFT_SHAPES.has(String(text).trim());
}

/**
 * Recompute calculationPhase after a controller event.
 * `changed` marks a computational change (input/assumption/model). A failed
 * solve stops short-circuiting once conditions change (lastSolve -> null).
 */
export function recomputePhase({ engine, store }, { changed = false, isCalculating = false, afterSolve = false } = {}) {
  const s = store.state;
  if (changed && s.lastSolveDiagnostics !== null) s.lastSolveDiagnostics = null;
  s.calculationPhase = judgeCalculationPhase({
    isCalculating,
    lastSolve: s.lastSolveDiagnostics,
    hasCompletedSolve: s.hasCompletedSolve,
    effectiveUserInputCount: countEffectiveUserInputs(engine),
    hasStale: hasStaleInstances(engine),
    // A completed solve consumes every pending computational change; the
    // sticky needs_recalc otherwise persists until the user recalculates.
    hasUnrecalculatedChange: afterSolve ? false : changed || s.calculationPhase === "needs_recalc",
  });
}

/** Variables eligible for the picker under current search/category state. */
export function filterVariables({ adapter, store }) {
  const query = store.state.variableSearchQuery.trim().toLowerCase();
  const category = store.state.selectedCategory;
  return adapter.variables.filter((v) => {
    if (v.can_be_user_input !== true) return false;
    if (category && v.category !== category) return false;
    if (!query) return true;
    return (
      v.name.toLowerCase().includes(query) ||
      v.symbol.toLowerCase().includes(query) ||
      v.variable_id.toLowerCase().includes(query)
    );
  });
}

/** Categories that contain at least one user-inputtable variable. */
export function availableCategories({ adapter }) {
  const seen = [];
  for (const v of adapter.variables) {
    if (v.can_be_user_input === true && !seen.includes(v.category)) seen.push(v.category);
  }
  return seen;
}

/**
 * Add a variable row. A duplicate add highlights and locates the existing
 * row instead of adding a second one (single input per variable).
 */
export function addVariable({ store }, variableId) {
  const s = store.state;
  if (s.uiInputOrder.includes(variableId)) {
    s.highlightedVariableId = variableId;
    store.notify();
    return { added: false, duplicate: true };
  }
  s.uiInputOrder.push(variableId);
  s.highlightedVariableId = variableId;
  store.notify();
  return { added: true, duplicate: false };
}

/** Clear the duplicate-add highlight (the view calls this on timeout). */
export function clearHighlight({ store }) {
  store.state.highlightedVariableId = null;
  store.notify();
}

/**
 * Submit the value text of an input row (§7.2 draft rules):
 *   unfinished draft -> stored as draft, no engine call, no error;
 *   non-numeric text -> row diagnostic, no engine call;
 *   number -> setUserInput in the row's current entry unit; on success the
 *   snapshot is recorded under the new result_id (§7.4).
 */
export function submitValue({ engine, store }, variableId, rawText, unitId) {
  const s = store.state;
  const text = String(rawText ?? "").trim();

  if (isUnfinishedDraft(text)) {
    s.inputDraftByVariableId.set(variableId, text);
    s.inputDiagnosticByVariableId.set(variableId, {
      kind: "draft",
      message: "Enter a number to submit this value.",
    });
    store.notify();
    return { submitted: false, kind: "draft" };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    s.inputDraftByVariableId.set(variableId, text);
    s.inputDiagnosticByVariableId.set(variableId, {
      kind: "not_a_number",
      message: "Not a number. Enter a numeric value.",
    });
    store.notify();
    return { submitted: false, kind: "not_a_number" };
  }

  const outcome = engine.setUserInput(variableId, value, unitId);
  if (outcome.ok !== true) {
    s.inputDiagnosticByVariableId.set(variableId, {
      kind: "rejected",
      message: outcome.diagnostic ? outcome.diagnostic.message : "The engine rejected this input.",
    });
    store.notify();
    return { submitted: false, kind: "rejected", diagnostic: outcome.diagnostic };
  }

  s.inputSnapshotByResultId.set(outcome.result.result_id, {
    variableId,
    enteredValue: value,
    enteredUnit: unitId,
  });
  s.inputDraftByVariableId.delete(variableId);
  s.inputDiagnosticByVariableId.delete(variableId);
  if (!s.uiInputOrder.includes(variableId)) s.uiInputOrder.push(variableId);
  recomputePhase({ engine, store }, { changed: true });
  store.notify();
  return { submitted: true, kind: "ok", result: outcome.result };
}

/**
 * §7.3 track 1 — pure display switch: update displayUnitByVariableId only.
 * Never calls setUserInput (the engine would retire/mint instances and
 * propagate stale); result_ids, instance counts, and stale sets stay
 * untouched. G4 negative tests assert exactly that.
 */
export function setDisplayUnit({ store }, variableId, unitId) {
  store.state.displayUnitByVariableId.set(variableId, unitId);
  store.notify();
}

/** Request removal of one input (goes through the confirmation slot). */
export function requestRemoveInput({ store }, variableId) {
  store.state.pendingConfirmation = {
    kind: "remove_input",
    payload: { variableId },
  };
  store.notify();
}

/** Request clearing every input (second-step confirmation, Part 2). */
export function requestClearAll({ store }) {
  store.state.pendingConfirmation = { kind: "clear_all", payload: null };
  store.notify();
}

/** Cancel whatever confirmation is pending. */
export function cancelPending({ store }) {
  store.state.pendingConfirmation = null;
  store.notify();
}

/**
 * Execute the pending confirmation (remove_input / clear_all / use_derived).
 * use_derived is the D25 flow (§7.8): removeUserInput only — the derived
 * value does NOT become Active here; promotion happens exclusively inside
 * solve(), after the user clicks Recalculate.
 * Returns {done, kind} — a no-op when nothing is pending.
 */
export function confirmPending({ engine, store }) {
  const pending = store.state.pendingConfirmation;
  if (!pending) return { done: false, kind: null };
  const s = store.state;

  if (pending.kind === "remove_input" || pending.kind === "use_derived") {
    const { variableId } = pending.payload;
    engine.removeUserInput(variableId);
    s.uiInputOrder = s.uiInputOrder.filter((id) => id !== variableId);
    s.inputDraftByVariableId.delete(variableId);
    s.inputDiagnosticByVariableId.delete(variableId);
    s.pendingConfirmation = null;
    recomputePhase({ engine, store }, { changed: true });
    store.notify();
    return { done: true, kind: pending.kind };
  }

  if (pending.kind === "clear_all") {
    for (const variableId of s.uiInputOrder) engine.removeUserInput(variableId);
    s.uiInputOrder = [];
    s.inputDraftByVariableId.clear();
    s.inputDiagnosticByVariableId.clear();
    s.pendingConfirmation = null;
    recomputePhase({ engine, store }, { changed: true });
    store.notify();
    return { done: true, kind: "clear_all" };
  }

  return { done: false, kind: pending.kind };
}

/**
 * §7.3 track 3 — adopt a unit-misuse suggestion: setUserInput with the SAME
 * number in the suggested unit (the engine never switches units on its own).
 * The physical value changes, so this is a computational change: a new
 * result_id is minted, dependents go stale, and Recalculate is required.
 * The row's display unit follows the adopted unit.
 */
export function adoptMisuseSuggestion(app, suggestion) {
  const { variableId, enteredValue, suggestedUnit } = suggestion;
  app.store.state.displayUnitByVariableId.set(variableId, suggestedUnit);
  return submitValue(app, variableId, String(enteredValue), suggestedUnit);
}

/**
 * Ignore a unit-misuse suggestion: ZERO engine operations. Keeping the
 * original value links into the result_id-keyed confirmation flow, so the
 * suggestion collapses and the row shows "User confirmed warning"; a
 * replacement instance (new result_id) naturally resurfaces it.
 */
export function ignoreMisuseSuggestion({ store }, resultId) {
  store.state.confirmedResultIds.add(resultId);
  store.notify();
  return { ignored: true, resultId };
}

/**
 * Tire-code flow: parse -> full precheck on a scratch engine -> live writes.
 * On success (or partial failure) every written instance gets its §7.4
 * snapshot and joins uiInputOrder; the returned report is presented as-is.
 */
export async function applyTireCodeFlow({ engine, store, adapter, createScratchEngine }, text) {
  const parsed = parseTireCode(text);
  if (!parsed.ok) return { ok: false, stage: "syntax", message: TIRE_CODE_HINT, applied: [] };

  const precheck = await precheckTireCode(parsed, { adapter, createScratchEngine });
  if (precheck.ok !== true) return { ...precheck, applied: [] };

  const report = applyTireCode(parsed, engine);
  const s = store.state;
  for (const item of report.applied) {
    s.inputSnapshotByResultId.set(item.result.result_id, {
      variableId: item.variableId,
      enteredValue: item.value,
      enteredUnit: item.unitId,
    });
    if (!s.uiInputOrder.includes(item.variableId)) s.uiInputOrder.push(item.variableId);
    s.inputDraftByVariableId.delete(item.variableId);
    s.inputDiagnosticByVariableId.delete(item.variableId);
  }
  if (report.applied.length > 0) recomputePhase({ engine, store }, { changed: true });
  store.notify();
  return report.ok
    ? { ok: true, stage: "applied", applied: report.applied, failure: null }
    : { ok: false, stage: "live_write", applied: report.applied, failure: report.failure };
}
