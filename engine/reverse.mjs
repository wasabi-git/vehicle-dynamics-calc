/**
 * reverse.mjs — target-quantity reverse query and diagnostics (M5).
 *
 * A reverse query is NOT algebraic inversion (Part 3 §3.3 九): it only walks
 * formulas whose registered output is the queried variable, reports each
 * candidate path with its missing-input list, and recursively explains how a
 * missing input could itself be obtained — offering both options at every
 * user-inputtable variable (§3.8 十二):
 *   scheme A — enter the variable directly (can_be_user_input);
 *   scheme B — derive it through further registered formulas.
 *
 * Depth policy comes from engine-config: max_reverse_formula_depth (5 in
 * v0.1), counting formula nodes only — variable hops are free
 * (reverse_depth_counts = formula_nodes_only). Beyond the limit an entry is
 * flagged depth_limit_reached instead of expanding. A formula already on the
 * current expansion path is flagged cycle_detected and never re-entered.
 *
 * Missing-condition reporting keeps models separate (§3.4 十二): every
 * candidate carries its model_group/model_name/path_role, and blocked
 * candidates name their reasons instead of a bare "cannot calculate".
 */

export function createReverseQuery(data, pool, solver) {
  const variables = data.variables;
  const formulas = data.formulas;
  const maxFormulaDepth = data.engineConfig.max_reverse_formula_depth;
  const pathRoleOrder = data.engineConfig.path_roles;

  /** variableId -> registered producing formulas, in deterministic order. */
  const producers = new Map();
  for (const [, formula] of formulas) {
    if (!producers.has(formula.output)) producers.set(formula.output, []);
    producers.get(formula.output).push(formula);
  }
  for (const list of producers.values()) {
    list.sort((a, b) => {
      const roleDelta = pathRoleOrder.indexOf(a.path_role) - pathRoleOrder.indexOf(b.path_role);
      if (roleDelta !== 0) return roleDelta;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.formula_id < b.formula_id ? -1 : 1;
    });
  }

  /** Codes whose subject variable counts as a missing/unusable input. */
  const MISSING_CODES = ["missing_input", "assumption_not_allowed_for_formula", "input_stale"];

  function assumptionInfo(variableId) {
    const variable = variables.get(variableId);
    if (variable.can_be_assumed !== true) return null;
    return {
      enabled: pool.isAssumptionEnabled(variableId),
      suppressed: pool.isAssumptionSuppressed(variableId),
    };
  }

  /** Describe one candidate formula path at the given formula-node depth. */
  function describeFormula(formula, formulaDepth, pathFormulas) {
    const existing = pool
      .instances(formula.output)
      .find((r) => r.formula_id === formula.formula_id && !r.stale);
    const evaluation = solver.evaluateFormula(formula);
    const reasons = evaluation.state === "blocked" ? evaluation.reasons : [];
    const missingIds = [];
    for (const reason of reasons) {
      if (MISSING_CODES.includes(reason.code) && reason.variable_id && !missingIds.includes(reason.variable_id)) {
        missingIds.push(reason.variable_id);
      }
    }
    const nextPath = [...pathFormulas, formula.formula_id];
    return {
      formula_id: formula.formula_id,
      model_group: formula.model_group,
      model_name: formula.model_name,
      path_role: formula.path_role,
      depth: formulaDepth,
      status: existing ? "computed" : evaluation.state === "computed" ? "computable_now" : "blocked",
      blocked_reasons: reasons.map((r) => ({ code: r.code, message: r.message, variable_id: r.variable_id ?? null })),
      missing_inputs: missingIds.map((variableId) => describeVariable(variableId, formulaDepth, nextPath)),
      cycle_detected: false,
    };
  }

  /**
   * Describe how a missing variable could be obtained. `formulaDepth` is the
   * number of formula nodes already consumed on this expansion path.
   */
  function describeVariable(variableId, formulaDepth, pathFormulas) {
    const variable = variables.get(variableId);
    const entry = {
      variable_id: variableId,
      can_be_user_input: variable.can_be_user_input === true,
      assumption: assumptionInfo(variableId),
      derivation_options: [],
      depth_limit_reached: false,
    };
    for (const formula of producers.get(variableId) ?? []) {
      if (pathFormulas.includes(formula.formula_id)) {
        entry.derivation_options.push({
          formula_id: formula.formula_id,
          cycle_detected: true,
        });
        continue;
      }
      if (formulaDepth + 1 > maxFormulaDepth) {
        entry.depth_limit_reached = true;
        continue;
      }
      entry.derivation_options.push(describeFormula(formula, formulaDepth + 1, pathFormulas));
    }
    return entry;
  }

  /**
   * Query how a target variable can be obtained from the current pool.
   * Returns { ok, target, outcome, can_be_user_input, candidate_paths,
   * diagnostics } with outcome one of:
   *   already_available | computable | not_computable_in_pool |
   *   no_registered_direction
   */
  function queryTarget(variableId) {
    const variable = variables.get(variableId);
    if (!variable) {
      return {
        ok: false,
        target: variableId,
        outcome: null,
        can_be_user_input: null,
        candidate_paths: [],
        diagnostics: [
          { severity: "error", code: "unknown_variable", file: null, path: null, message: `Unknown variable: ${JSON.stringify(variableId)}.` },
        ],
      };
    }

    const candidates = (producers.get(variableId) ?? []).map((formula) => describeFormula(formula, 1, []));
    const activeInstance = pool.active(variableId);
    const diagnostics = [];

    let outcome;
    if (activeInstance && !activeInstance.stale) {
      outcome = "already_available";
    } else if (candidates.length === 0) {
      outcome = "no_registered_direction";
      diagnostics.push({
        severity: "error",
        code: "no_registered_output_direction",
        file: null,
        path: null,
        message:
          `No registered formula outputs ${variableId}; the engine does not perform algebraic inversion ` +
          `(allow_automatic_algebraic_inversion = false).` +
          (variable.can_be_user_input === true ? ` ${variableId} can be entered directly as a user input.` : ""),
      });
    } else if (candidates.some((c) => c.status !== "blocked")) {
      outcome = "computable";
    } else {
      outcome = "not_computable_in_pool";
    }

    return {
      ok: true,
      target: variableId,
      outcome,
      can_be_user_input: variable.can_be_user_input === true,
      candidate_paths: candidates,
      diagnostics,
    };
  }

  return { queryTarget };
}
