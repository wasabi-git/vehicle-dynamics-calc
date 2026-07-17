/**
 * targets_controller.mjs — reverse-query region logic (no DOM).
 *
 * §7.10 fixed rules (never program order):
 *   missing-path ordering: fewest missing → fewest selections needed →
 *   fewest assumptions needed → shortest path; ties break by formula_id.
 *   Metric definitions are fixed for v0.1 and repeatable:
 *     missing     = direct missing-input count of the candidate;
 *     selections  = missing inputs with more than one derivation option
 *                   (obtaining them needs a user choice);
 *     assumptions = missing inputs that a registered assumption could fill;
 *     pathLength  = 1 + missing inputs that would need their own derivation.
 *   Recommended next input = the missing user-inputtable variable that
 *   appears on the MOST candidate paths; ties break by variable_id; the
 *   value is never pre-filled.
 *   With no explicit target, only unmet primary_output variables expand
 *   their missing conditions (v0.1: longitudinal_acceleration).
 */

import { buildTargetView } from "../adapter/path_view_model.mjs";

export function pathMetrics(path) {
  if (path.cycleDetected) {
    return { missing: Infinity, selections: Infinity, assumptions: Infinity, length: Infinity };
  }
  const missing = path.missingInputs.length;
  const selections = path.missingInputs.filter((m) => m.derivationOptions.length > 1).length;
  const assumptions = path.missingInputs.filter((m) => m.assumption !== null).length;
  const length = 1 + path.missingInputs.filter((m) => m.derivationOptions.length > 0 && !m.canBeUserInput).length;
  return { missing, selections, assumptions, length };
}

export function comparePaths(a, b) {
  const ma = pathMetrics(a);
  const mb = pathMetrics(b);
  if (ma.missing !== mb.missing) return ma.missing - mb.missing;
  if (ma.selections !== mb.selections) return ma.selections - mb.selections;
  if (ma.assumptions !== mb.assumptions) return ma.assumptions - mb.assumptions;
  if (ma.length !== mb.length) return ma.length - mb.length;
  return a.formulaId < b.formulaId ? -1 : a.formulaId > b.formulaId ? 1 : 0;
}

/**
 * Recommended next input across the candidate paths: the missing
 * user-inputtable variable appearing on the most viable paths; ties break
 * by variable_id. Returns a variable_id or null. Never fills a value.
 */
export function recommendNextInput(paths) {
  const counts = new Map();
  for (const path of paths) {
    if (path.cycleDetected) continue;
    const seenOnPath = new Set();
    for (const missing of path.missingInputs) {
      if (!missing.canBeUserInput || seenOnPath.has(missing.variableId)) continue;
      seenOnPath.add(missing.variableId);
      counts.set(missing.variableId, (counts.get(missing.variableId) ?? 0) + 1);
    }
  }
  let best = null;
  for (const [variableId, count] of counts) {
    if (
      best === null ||
      count > best.count ||
      (count === best.count && variableId < best.variableId)
    ) {
      best = { variableId, count };
    }
  }
  return best ? best.variableId : null;
}

/**
 * Query one target and return the ordered view plus the recommendation.
 * The adapter (U1) feeds the satisfied-inputs column; callers without one
 * keep the pre-U1 behavior (`satisfiedInputs: null` on every path).
 */
export function queryTargetView({ engine, adapter }, variableId) {
  const view = buildTargetView(engine.queryTarget(variableId), adapter);
  view.paths = [...view.paths].sort(comparePaths);
  view.recommendedNext = recommendNextInput(view.paths);
  return view;
}

/**
 * Targets to expand when the user picked none: primary_output variables
 * without a fresh Active instance (v0.1: longitudinal_acceleration).
 */
export function defaultTargets({ engine, adapter }) {
  return adapter.variables
    .filter((v) => v.display_role === "primary_output")
    .filter((v) => {
      const active = engine.getActive(v.variable_id);
      return !active || active.stale === true;
    })
    .map((v) => v.variable_id);
}

/** Store the explicit target selection. */
export function selectTarget({ store }, variableId) {
  store.state.selectedTarget = variableId || null;
  store.notify();
}

/**
 * Honest target grouping (owner-directed C9R9; registered coverage: 19
 * options = 7 with a registered output direction + 12 direct-input only).
 * Derived from the catalog, never hardcoded:
 *   primary       — producers whose display_role is primary_output or
 *                   derived_output (the results users treat as answers);
 *   intermediates — producers with display_role intermediate;
 *   inputOnly     — no registered formula outputs them (v0.1 minimal
 *                   acceleration chain; new computable targets are
 *                   Part 7/v0.2 scope, G9).
 * Constants never appear.
 */
export function groupTargetOptions(adapter) {
  const producers = new Set(adapter.formulas.map((f) => f.output));
  const groups = { primary: [], intermediates: [], inputOnly: [] };
  for (const variable of adapter.variables) {
    if (variable.is_constant === true) continue;
    if (!producers.has(variable.variable_id)) groups.inputOnly.push(variable.variable_id);
    else if (variable.display_role === "intermediate") groups.intermediates.push(variable.variable_id);
    else groups.primary.push(variable.variable_id);
  }
  return groups;
}
