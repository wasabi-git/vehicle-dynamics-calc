/**
 * targets_view.mjs — DOM view of the "Query a target" region.
 *
 * Populates the target selector, renders ordered candidate paths (formula
 * block, model labels, blocked reasons with their fixed cause classes,
 * recursive missing-input expansion inside nested details), the
 * recommended-next-input box (never pre-filled), and the no-target default
 * (unmet primary outputs only). Logic lives in targets_controller.mjs and
 * path_view_model.mjs.
 */

import { el, clear } from "./dom_util.mjs";
import { queryTargetView, defaultTargets, selectTarget } from "./targets_controller.mjs";
import { formatFormula } from "../adapter/formula_format.mjs";
import { formulaBlock, symbolSpan } from "./formula_view.mjs";

export function initTargetsView(app) {
  const { store, adapter } = app;
  const select = document.getElementById("target-select");
  const queryBtn = document.getElementById("target-query-btn");
  const report = document.getElementById("target-report");

  select.disabled = false;
  queryBtn.disabled = false;
  for (const variable of adapter.variables) {
    if (variable.is_constant === true) continue;
    select.append(el("option", { value: variable.variable_id, text: `${variable.name} (${variable.symbol})` }));
  }
  select.addEventListener("change", () => selectTarget(app, select.value));
  queryBtn.addEventListener("click", () => renderReport(true));
  store.subscribe(() => renderReport(false));

  function missingList(missingInputs) {
    return el(
      "ul",
      { class: "missing-list" },
      missingInputs.map((m) => {
        const head = el("li", {}, [
          el("span", { text: `${adapter.variablesById[m.variableId]?.name ?? m.variableId} ` }),
          el("span", { class: "missing-list__reason", text: `— ${m.causeText}` }),
          m.canBeUserInput ? el("span", { class: "micro-label", text: " enter directly" }) : null,
        ]);
        if (m.derivationOptions.length > 0) {
          head.append(
            el("details", { class: "derivation" }, [
              el("summary", { text: `or derive it (${m.derivationOptions.length} option${m.derivationOptions.length > 1 ? "s" : ""})` }),
              ...m.derivationOptions.map(pathOption),
            ])
          );
        }
        if (m.depthLimitReached) {
          head.append(el("p", { class: "missing-list__reason", text: "Depth limit reached — expansion stops here." }));
        }
        return head;
      })
    );
  }

  function pathOption(path) {
    if (path.cycleDetected) {
      return el("div", { class: "path-option" }, [
        el("div", { class: "path-option__head" }, [
          el("span", { text: path.formulaId }),
          el("span", { class: "micro-label", text: "Circular dependency" }),
        ]),
      ]);
    }
    const formula = adapter.formulasById[path.formulaId];
    const modelName = path.modelName ? adapter.modelsById[path.modelName]?.display_name ?? path.modelName : null;
    return el("div", { class: "path-option" }, [
      el("div", { class: "path-option__head" }, [
        el("span", { text: formula ? formula.name : path.formulaId }),
        modelName ? el("span", { class: "micro-label", text: modelName }) : null,
        el("span", { class: "micro-label", text: path.status }),
      ]),
      formula ? formulaBlock(formatFormula(formula.expression)) : null,
      path.missingInputs.length > 0 ? missingList(path.missingInputs) : null,
      path.missingInputs.length === 0 && path.blockedReasons.length > 0
        ? el("ul", { class: "missing-list" },
            path.blockedReasons.map((r) => el("li", {}, [
              el("span", { class: "missing-list__reason", text: `${r.causeText}: ${r.message}` }),
            ])))
        : null,
    ]);
  }

  function renderTarget(variableId, showAlways) {
    const view = queryTargetView(app, variableId);
    const variable = adapter.variablesById[variableId];
    const nodes = [];
    if (view.outcome === "already_available" && !showAlways) return nodes;
    const heading = el("h3", { class: "result-card__name", text: `${variable.name} (` });
    heading.append(symbolSpan(variable.symbol, ""), el("span", { text: ")" }));
    nodes.push(heading);
    if (view.outcome === "already_available") {
      nodes.push(el("p", { class: "status-text", text: "Already available in the current results." }));
      return nodes;
    }
    if (view.noRegisteredDirection) {
      for (const d of view.diagnostics) nodes.push(el("p", { class: "status-text", text: d.message }));
      return nodes;
    }
    nodes.push(...view.paths.map(pathOption));
    if (view.recommendedNext) {
      const rec = adapter.variablesById[view.recommendedNext];
      const box = el("div", { class: "recommended-next", text: `Recommended next input: ${rec.name} (` });
      box.append(symbolSpan(rec.symbol, ""), el("span", { text: ") — it unlocks the most candidate paths. Enter the value yourself; nothing is pre-filled." }));
      nodes.push(box);
    }
    return nodes;
  }

  function renderReport(explicit) {
    clear(report);
    const target = store.state.selectedTarget;
    if (target) {
      for (const node of renderTarget(target, explicit)) report.append(node);
      return;
    }
    // No explicit target: expand missing conditions only for unmet primary outputs.
    for (const variableId of defaultTargets(app)) {
      for (const node of renderTarget(variableId, false)) report.append(node);
    }
  }

  renderReport(false);
}
