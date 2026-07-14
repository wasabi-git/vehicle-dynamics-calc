/**
 * derive.mjs — forward derivation core (M3).
 *
 * The pool is scanned to a fixed point — no hardcoded formula order. Each
 * formula passes the three-layer check (Part 3 §3.3 四):
 *   layer 1  registered      — the formula record exists in the catalog;
 *   layer 2  computability   — must be within the engine capability set;
 *   layer 3  runtime         — inputs resolvable (assumptions only where the
 *                              formula permits), inputs not invalid/stale and
 *                              inside valid_domain, applicability machine
 *                              conditions and formula_constraints satisfied.
 *
 * expression_unit_mode routing (Part 3 §3.10 二十):
 *   source_native — SI inputs -> substitution_units -> evaluate ->
 *                   native_output_unit -> SI;
 *   si_consistent — evaluate directly on SI values.
 *
 * Model-qualified results stay separate instances. R001 only performs the
 * default Active selection among derived model results of
 * longitudinal_acceleration and never displaces an Active user input; the
 * recommended model never falls back automatically (require_user_selection).
 */

import { compileExpression } from "./expr.mjs";
import { evaluateConditionExpression, computeRangeStatus } from "./conditions.mjs";
import { makeResult, instanceKey } from "./result.mjs";
import { SUPPORTED_COMPUTABILITY } from "./loader.mjs";

function reason(code, message, context = {}) {
  return { code, message, ...context };
}

export function createSolver(data, unitSystem, pool) {
  const formulas = data.formulas;
  const variables = data.variables;

  // Compile every calculation_expression once, against required_inputs.
  const compiled = new Map();
  for (const [formulaId, formula] of formulas) {
    compiled.set(formulaId, compileExpression(formula.calculation_expression, formula.required_inputs));
  }

  /** User-made explicit model selections: output variable -> model_name|null. */
  const modelSelections = new Map();

  /** Last evaluation status per formula: formulaId -> {state, reasons, resultKey}. */
  const formulaStatus = new Map();

  /** Recommendation state records, refreshed on every solve. */
  let recommendationStates = [];

  /**
   * Resolve one required input of a formula.
   * Returns { instance } or { blockedReason }.
   */
  function resolveInput(formula, variableId) {
    const variable = variables.get(variableId);
    const activeInstance = pool.active(variableId);
    let instance = activeInstance;

    if (instance && instance.source === "assumption") {
      const allowed = Array.isArray(formula.allowed_assumption_inputs)
        && formula.allowed_assumption_inputs.includes(variableId);
      if (!allowed) {
        return {
          blockedReason: reason(
            "assumption_not_allowed_for_formula",
            `${variableId} is only available as an assumption, which ${formula.formula_id} does not permit.`,
            { variable_id: variableId }
          ),
        };
      }
    }

    if (!instance) {
      return {
        blockedReason: reason("missing_input", `Missing required input ${variableId}.`, {
          variable_id: variableId,
        }),
      };
    }
    if (instance.stale) {
      return {
        blockedReason: reason("input_stale", `Input ${variableId} is stale and must be re-derived first.`, {
          variable_id: variableId,
        }),
      };
    }
    if (instance.range_status === "invalid") {
      return {
        blockedReason: reason("input_invalid", `Input ${variableId} hits its invalid_range; the branch is blocked.`, {
          variable_id: variableId,
        }),
      };
    }
    const domain = evaluateConditionExpression(variable.valid_domain, () => instance.value_si, unitSystem);
    if (!domain.ok) {
      return { blockedReason: reason("condition_evaluation_failed", `valid_domain of ${variableId} could not be evaluated.`, { variable_id: variableId }) };
    }
    if (!domain.satisfied) {
      return {
        blockedReason: reason("input_outside_valid_domain", `Input ${variableId} violates its valid_domain.`, {
          variable_id: variableId,
        }),
      };
    }
    return { instance };
  }

  /**
   * Evaluate one formula against the current pool.
   * Returns { state: "computed", result } or { state: "blocked", reasons }.
   */
  function evaluateFormula(formula) {
    // Layer 2: computability within the engine capability set.
    if (!SUPPORTED_COMPUTABILITY.includes(formula.computability)) {
      return {
        state: "blocked",
        reasons: [reason("computability_unsupported", `computability ${JSON.stringify(formula.computability)} is outside the v0.1 engine capability set.`)],
      };
    }
    const expr = compiled.get(formula.formula_id);
    if (!expr.ok) {
      return { state: "blocked", reasons: [reason(expr.diagnostic.code, expr.diagnostic.message)] };
    }

    // Layer 3a: resolve every required input from the pool.
    const reasons = [];
    const inputs = new Map();
    for (const variableId of formula.required_inputs) {
      const resolved = resolveInput(formula, variableId);
      if (resolved.blockedReason) {
        reasons.push(resolved.blockedReason);
      } else {
        inputs.set(variableId, resolved.instance);
      }
    }
    if (reasons.length > 0) return { state: "blocked", reasons };

    const valueOf = (cond) => {
      const target = cond.variable ? inputs.get(cond.variable) : null;
      return target ? target.value_si : null;
    };

    // Layer 3b: applicability machine conditions (explicit all/any).
    const applicability = evaluateConditionExpression(
      formula.applicability_conditions.machine,
      valueOf,
      unitSystem
    );
    if (!applicability.ok) {
      return { state: "blocked", reasons: applicability.diagnostics.map((d) => reason(d.code, d.message)) };
    }
    if (!applicability.satisfied) {
      return { state: "blocked", reasons: [reason("not_applicable", `Machine applicability conditions of ${formula.formula_id} are not satisfied.`)] };
    }

    // Layer 3c: formula_constraints (explicit all).
    const constraints = evaluateConditionExpression(formula.formula_constraints, valueOf, unitSystem);
    if (!constraints.ok) {
      return { state: "blocked", reasons: constraints.diagnostics.map((d) => reason(d.code, d.message)) };
    }
    if (!constraints.satisfied) {
      return { state: "blocked", reasons: [reason("constraint_unsatisfied", `formula_constraints of ${formula.formula_id} are not satisfied.`)] };
    }

    // Evaluation with expression_unit_mode routing.
    const env = {};
    if (formula.expression_unit_mode === "source_native") {
      for (const [variableId, instance] of inputs) {
        const native = unitSystem.substitutionFromSI(variableId, instance.value_si, formula.substitution_units[variableId]);
        if (!native.ok) {
          return { state: "blocked", reasons: [reason(native.diagnostic.code, native.diagnostic.message)] };
        }
        env[variableId] = native.value;
      }
    } else {
      for (const [variableId, instance] of inputs) env[variableId] = instance.value_si;
    }

    const evaluated = expr.evaluate(env);
    if (!evaluated.ok) {
      return { state: "blocked", reasons: [reason(evaluated.diagnostic.code, evaluated.diagnostic.message)] };
    }

    let valueSi = evaluated.value;
    if (formula.expression_unit_mode === "source_native") {
      const si = unitSystem.nativeOutputToSI(formula.output, valueSi, formula.native_output_unit);
      if (!si.ok) {
        return { state: "blocked", reasons: [reason(si.diagnostic.code, si.diagnostic.message)] };
      }
      valueSi = si.value;
    }
    if (!Number.isFinite(valueSi)) {
      return { state: "blocked", reasons: [reason("evaluation_not_finite", `${formula.formula_id} evaluated to a non-finite value.`)] };
    }

    // Provenance: actual instances used, transitive assumptions, formula path.
    // dependencies reference immutable result_ids, so this result keeps
    // naming the exact input revisions it was computed from even after a
    // slot is overwritten by a newer revision.
    const dependencies = [];
    const assumptionsUsed = new Set();
    const formulaPath = [];
    for (const variableId of formula.required_inputs) {
      const instance = inputs.get(variableId);
      dependencies.push(instance.result_id);
      if (instance.source === "assumption") assumptionsUsed.add(variableId);
      for (const upstream of instance.assumptions_used) assumptionsUsed.add(upstream);
      for (const formulaId of instance.formula_path) {
        if (!formulaPath.includes(formulaId)) formulaPath.push(formulaId);
      }
    }
    formulaPath.push(formula.formula_id);

    const outputVariable = variables.get(formula.output);
    const range = computeRangeStatus(outputVariable, valueSi, unitSystem);

    const result = makeResult({
      variable_id: formula.output,
      value_si: valueSi,
      internal_unit: outputVariable.internal_unit,
      source: "derived",
      formula_id: formula.formula_id,
      formula_path: formulaPath,
      dependencies,
      assumptions_used: [...assumptionsUsed].sort(),
      model: { group: formula.model_group, name: formula.model_name },
      active: false, // activation is decided per variable after the scan
      stale: false,
      range_status: range.status,
      warnings: range.warnings,
    });
    return { state: "computed", result };
  }

  function sameResult(a, b) {
    return (
      a.value_si === b.value_si &&
      a.range_status === b.range_status &&
      JSON.stringify(a.dependencies) === JSON.stringify(b.dependencies) &&
      JSON.stringify(a.assumptions_used) === JSON.stringify(b.assumptions_used) &&
      JSON.stringify(a.formula_path) === JSON.stringify(b.formula_path)
    );
  }

  /**
   * Scan the pool to a fixed point. Every pass re-evaluates every formula;
   * the pass repeats while any derived instance appears, changes, or leaves.
   * Active selection runs at the end of every pass so newly derived results
   * become resolvable inputs on the next pass — no hardcoded order.
   */
  function solve() {
    const guard = formulas.size + 2;
    let passes = 0;
    let changed = true;
    while (changed) {
      passes += 1;
      if (passes > guard) {
        return {
          ok: false,
          diagnostics: [
            { severity: "error", code: "fixed_point_not_reached", file: null, path: null, message: `Derivation did not reach a fixed point within ${guard} passes.` },
          ],
        };
      }
      changed = false;
      for (const [formulaId, formula] of formulas) {
        const outcome = evaluateFormula(formula);
        const key = instanceKey(formula.output, "derived", formulaId);
        const existing = pool
          .instances(formula.output)
          .find((r) => r.key === key) ?? null;

        if (outcome.state === "computed") {
          formulaStatus.set(formulaId, { state: "computed", reasons: [], resultKey: key });
          if (!existing || !sameResult(existing, outcome.result)) {
            // Preserve activation across recomputation; selection runs later.
            outcome.result.active = existing ? existing.active : false;
            pool.putDerived(outcome.result);
            changed = true;
          } else if (existing.stale) {
            existing.stale = false;
            changed = true;
          }
        } else {
          formulaStatus.set(formulaId, { state: "blocked", reasons: outcome.reasons, resultKey: null });
          if (existing) {
            // Inputs regressed (removed/blocked): the stored instance no
            // longer has a valid derivation and leaves the pool.
            pool.removeDerived(key);
            changed = true;
          }
        }
      }
      applyActiveSelection();
    }
    return { ok: true, diagnostics: [] };
  }

  /**
   * Per-variable Active selection after a scan.
   * - An Active user input is never displaced by derived results.
   * - reference-path results are never Active.
   * - With a recommendation record (R001): recommended model computable ->
   *   its result is the default Active derived; otherwise no automatic
   *   fallback — an explicit user selection is required (message per R001).
   * - Without a recommendation and a single producing model: that result is
   *   Active. Multiple models without a recommendation stay inactive and
   *   wait for user selection (v0.1 conservative rule).
   */
  function applyActiveSelection() {
    recommendationStates = [];
    const recommendationByOutput = new Map();
    for (const [, rec] of data.recommendations) recommendationByOutput.set(rec.output, rec);

    const outputs = new Set();
    for (const [, formula] of formulas) outputs.add(formula.output);

    for (const output of outputs) {
      const derived = pool.bySource(output, "derived");
      const userInput = pool.userInput(output);
      const selectable = derived.filter((r) => {
        const formula = formulas.get(r.formula_id);
        return formula && formula.path_role !== "reference";
      });
      for (const r of derived) r.active = false;

      const rec = recommendationByOutput.get(output) ?? null;
      const selection = modelSelections.get(output) ?? null;

      if (userInput && userInput.active) {
        if (rec) {
          recommendationStates.push(buildRecommendationState(rec, derived, null, "user_input_active", null));
        }
        continue;
      }

      let activeModel = null;
      let message = null;
      let mode = null;

      if (selection) {
        const chosen = selectable.find((r) => r.model.name === selection);
        if (chosen) {
          chosen.active = true;
          activeModel = selection;
          mode = "user_selected";
        } else {
          mode = "user_selection_unavailable";
          message = rec ? rec.fallback_behavior.message : null;
        }
      } else if (rec) {
        const recommended = selectable.find((r) => r.model.name === rec.recommended_model_name);
        if (recommended) {
          recommended.active = true;
          activeModel = rec.recommended_model_name;
          mode = "recommended_default";
        } else if (selectable.length > 0) {
          // Recommended model unavailable: no automatic fallback.
          mode = "require_user_selection";
          message = rec.fallback_behavior.message;
        } else {
          mode = "no_model_available";
        }
      } else if (selectable.length === 1) {
        selectable[0].active = true;
        activeModel = selectable[0].model.name;
        mode = "single_model_default";
      } else if (selectable.length > 1) {
        mode = "require_user_selection";
      }

      if (rec) {
        recommendationStates.push(buildRecommendationState(rec, derived, activeModel, mode, message));
      }
    }
  }

  function buildRecommendationState(rec, derived, activeModel, mode, message) {
    const recommendedAvailable = derived.some(
      (r) => r.model.name === rec.recommended_model_name && !r.stale
    );
    return {
      recommendation_id: rec.recommendation_id,
      output: rec.output,
      recommended_model_name: rec.recommended_model_name,
      recommended_available: recommendedAvailable,
      active_model: activeModel,
      user_selection: modelSelections.get(rec.output) ?? null,
      mode,
      message,
    };
  }

  /**
   * Record an explicit user model selection for an output variable
   * (modelName null clears the selection). Re-runs Active selection.
   */
  function selectModel(output, modelName) {
    if (modelName === null) {
      modelSelections.delete(output);
      applyActiveSelection();
      return { ok: true, diagnostic: null };
    }
    const producing = [...formulas.values()].some(
      (f) => f.output === output && f.model_name === modelName
    );
    if (!producing) {
      return {
        ok: false,
        diagnostic: { severity: "error", code: "model_not_registered_for_output", file: null, path: null, message: `No registered formula produces ${output} with model ${modelName}.` },
      };
    }
    modelSelections.set(output, modelName);
    applyActiveSelection();
    return { ok: true, diagnostic: null };
  }

  return {
    solve,
    evaluateFormula,
    selectModel,
    applyActiveSelection,
    getFormulaStatus: (formulaId) => formulaStatus.get(formulaId) ?? null,
    getRecommendationStates: () => recommendationStates.map((s) => ({ ...s })),
  };
}
