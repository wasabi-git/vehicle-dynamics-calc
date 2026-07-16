/**
 * results_controller.mjs — solve flow, result layering/ordering, model
 * section, and the D25 use-derived request (no DOM; Node-testable).
 *
 * Layering (display_role driven, Part 2 result-display rules):
 *   primary      — display_role primary_output, plus any strong-warning
 *                  (extreme_warning / invalid) result promoted for visibility;
 *   secondary    — other valid derived results (derived_output, input_only);
 *   intermediate — display_role intermediate, collapsed by default.
 * User inputs enter the results region only when a derived twin exists
 * (comparison), or the input itself carries warnings.
 *
 * Fixed ordering inside the region (never program order): strong warnings →
 * primary results → Active endpoints → model-selectable alternatives →
 * other derived → intermediates; ties break by variable_id then formula_id.
 */

import { buildResultView } from "../adapter/view_model.mjs";
import { classifyRecommendationMode } from "../adapter/path_view_model.mjs";
import { recomputePhase } from "./inputs_controller.mjs";

/** Part 2 line 1627, verbatim (multi-model reminder). */
export const MODEL_DIFFERENCE_REMINDER =
  "These paths use different physical models and may not produce equivalent results.";

/** D25 confirmation copy (§7.8), with {variable} substituted. */
export function useDerivedConfirmText(variableName) {
  return `This removes your input for ${variableName}. The derived value becomes active after you recalculate.`;
}

/**
 * Run one solve (§7.8 / Part 2 recalculation rules). The solve is
 * synchronous, so the calculating phase may be instantaneous; both
 * notifications still fire so the button can show "Calculating…".
 */
export function runSolve({ engine, store }) {
  const s = store.state;
  recomputePhase({ engine, store }, { isCalculating: true });
  store.notify();
  const outcome = engine.solve();
  s.lastSolveDiagnostics = outcome;
  if (outcome.ok === true) s.hasCompletedSolve = true;
  recomputePhase({ engine, store }, { afterSolve: outcome.ok === true });
  store.notify();
  return outcome;
}

/** Explicit model selection (or null to clear); a computational change. */
export function selectModelFlow({ engine, store }, output, modelName) {
  const outcome = engine.selectModel(output, modelName);
  if (outcome.ok === true) {
    recomputePhase({ engine, store }, { changed: true });
    store.notify();
  }
  return outcome;
}

/** Request the D25 flow; execution happens in confirmPending (use_derived). */
export function requestUseDerived({ store }, variableId) {
  store.state.pendingConfirmation = { kind: "use_derived", payload: { variableId } };
  store.notify();
}

/** Button state per calculationPhase (Part 2 six button states). */
export function buttonStateFor(phase, lastSolve) {
  switch (phase) {
    case "idle":
      return { text: "Calculate", enabled: false, status: "Add inputs to enable calculation." };
    case "ready":
      return { text: "Calculate", enabled: true, status: "Ready to calculate." };
    case "calculating":
      return { text: "Calculating…", enabled: false, status: "Working." };
    case "complete":
      return { text: "Recalculate", enabled: false, status: "Calculation complete. Results are up to date." };
    case "needs_recalc":
      return { text: "Recalculate", enabled: true, status: "Inputs changed. Affected results are marked stale until you recalculate." };
    case "failed": {
      const detail = (lastSolve?.diagnostics ?? []).map((d) => d.message).join(" ") || "The calculation could not be completed.";
      return { text: "Recalculate", enabled: true, status: `Calculation failed: ${detail} Adjust the conditions and try again.` };
    }
    default:
      return { text: "Calculate", enabled: false, status: "" };
  }
}

const STRONG = (r) => r.range_status === "extreme_warning" || r.range_status === "invalid";

function layerOf(view, variable) {
  if (STRONG({ range_status: view.rangeStatus })) return "primary";
  if (view.displayRole === "primary_output") return "primary";
  if (view.displayRole === "intermediate") return "intermediate";
  return "secondary";
}

function rankOf(view) {
  if (view.rangeStatus === "extreme_warning" || view.rangeStatus === "invalid") return 0;
  if (view.displayRole === "primary_output") return 1;
  if (view.active) return 2;
  if (view.model !== null && !view.active) return 3;
  if (view.displayRole !== "intermediate") return 4;
  return 5;
}

function compareViews(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.variableId !== b.variableId) return a.variableId < b.variableId ? -1 : 1;
  const fa = a.formulaId ?? "";
  const fb = b.formulaId ?? "";
  return fa < fb ? -1 : fa > fb ? 1 : 0;
}

/**
 * Build the model section for one output variable, when it has multiple
 * model instances or a recommendation record.
 */
export function buildModelSection(variableId, { engine, adapter, store }) {
  const derived = engine.getResults(variableId).filter((r) => r.source === "derived");
  const recState = engine.getRecommendationStates().find((s) => s.output === variableId) ?? null;
  if (derived.length < 2 && !recState) return null;

  const rows = derived
    .map((r) => buildResultView(r, { engine, adapter, store }))
    .sort((a, b) => (a.model?.name ?? "") < (b.model?.name ?? "") ? -1 : 1)
    .map((view) => ({
      ...view,
      selectable: !view.active,
    }));

  const recCause = recState ? classifyRecommendationMode(recState.mode) : null;
  return {
    variableId,
    rows,
    reminder: rows.length >= 2 ? MODEL_DIFFERENCE_REMINDER : null,
    recommendation: recState
      ? {
          mode: recState.mode,
          recommendedModelName: recState.recommended_model_name,
          message: recCause !== null ? recState.message : null,
        }
      : null,
  };
}

/**
 * Build the full results-region view model: layered, fixed-ordered items.
 */
export function buildResultsViewModel({ engine, adapter, store }) {
  const items = [];
  const byVariable = new Map();
  for (const r of engine.getResults()) {
    if (!byVariable.has(r.variable_id)) byVariable.set(r.variable_id, []);
    byVariable.get(r.variable_id).push(r);
  }

  const selectionPending = [];
  for (const [variableId, instances] of byVariable) {
    const variable = adapter.variablesById[variableId];
    if (!variable || variable.is_constant === true) continue;
    const derived = instances.filter((r) => r.source === "derived");
    const userInput = instances.find((r) => r.source === "user_input") ?? null;

    // One hero card per primary variable: the Active instance anchors it and
    // the other-model rows live in the model section (§11.4). Non-active
    // primary-role twins never become standalone cards; with no Active
    // instance at all a selection-pending placeholder card is emitted.
    const primaryRole = variable.display_role === "primary_output";
    if (primaryRole && derived.length > 0 && !derived.some((r) => r.active) && !userInput?.active) {
      selectionPending.push(variableId);
    }
    for (const r of derived) {
      const view = buildResultView(r, { engine, adapter, store });
      if (primaryRole && !r.active && !STRONG(r)) continue; // model section carries it
      items.push({ ...view, layer: layerOf(view, variable), rank: rankOf(view), useDerivedButton: false });
    }

    if (userInput) {
      const includeForComparison = derived.length > 0;
      const includeForWarnings = userInput.warnings.length > 0;
      if (includeForComparison || includeForWarnings) {
        const view = buildResultView(userInput, { engine, adapter, store });
        items.push({
          ...view,
          layer: layerOf(view, variable),
          rank: rankOf(view),
          useDerivedButton: includeForComparison,
        });
      }
    }
  }

  items.sort(compareViews);
  const layers = { primary: [], secondary: [], intermediate: [] };
  for (const item of items) layers[item.layer].push(item);

  const modelSections = {};
  for (const variableId of byVariable.keys()) {
    const section = buildModelSection(variableId, { engine, adapter, store });
    if (section) modelSections[variableId] = section;
  }

  for (const variableId of selectionPending) {
    layers.primary.push({
      kind: "selection_pending",
      variableId,
      variableName: adapter.variablesById[variableId].name,
      symbol: adapter.variablesById[variableId].symbol,
    });
  }

  return { layers, modelSections, hasAny: items.length > 0 || selectionPending.length > 0 };
}
