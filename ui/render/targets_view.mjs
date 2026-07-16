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
import { formatFormula, plainSymbol } from "../adapter/formula_format.mjs";
import { formulaBlock, symbolSpan } from "./formula_view.mjs";
import { addVariable, submitValue } from "./inputs_controller.mjs";

export function initTargetsView(app) {
  const { store, adapter } = app;
  const select = document.getElementById("target-select");
  const queryBtn = document.getElementById("target-query-btn");
  const report = document.getElementById("target-report");

  select.disabled = false;
  queryBtn.disabled = false;
  for (const variable of adapter.variables) {
    if (variable.is_constant === true) continue;
    // Native <option> cannot carry <sub> markup: use the underscore-free
    // plain form of the symbol (F_x -> Fx), never the raw catalog string.
    select.append(el("option", { value: variable.variable_id, text: `${variable.name} (${plainSymbol(variable.symbol)})` }));
  }
  select.addEventListener("change", () => selectTarget(app, select.value));
  queryBtn.addEventListener("click", () => renderReport(true));
  const unsubscribeTargets = store.subscribe(() => renderReport(false));

  // Missing rows with an open inline-entry form (component-local view
  // state; content persists via the silent draft mechanism, C9R7).
  const inlineEntryOpen = new Set();

  function inlineEntry(m) {
    const variable = adapter.variablesById[m.variableId];
    const s = store.state;
    const entryUnit = s.displayUnitByVariableId.get(m.variableId) ?? variable.default_unit;
    const valueBox = el("input", {
      class: "text-input",
      type: "text",
      size: "8",
      placeholder: "value",
      value: s.inputDraftByVariableId.get(m.variableId) ?? "",
      "aria-label": `${variable.name} value`,
    });
    valueBox.addEventListener("input", () => {
      if (valueBox.value === "") s.inputDraftByVariableId.delete(m.variableId);
      else s.inputDraftByVariableId.set(m.variableId, valueBox.value);
    });
    const unitSelect = el(
      "select",
      {
        class: "select",
        "aria-label": `${variable.name} unit`,
        onchange: () => s.displayUnitByVariableId.set(m.variableId, unitSelect.value), // silent
      },
      variable.allowed_units.map((unitId) =>
        el("option", { value: unitId, text: adapter.unitsById[unitId]?.display_symbol ?? unitId })
      )
    );
    unitSelect.value = entryUnit;
    const commit = () => {
      const text = valueBox.value;
      const chosenUnit = unitSelect.value;
      inlineEntryOpen.delete(m.variableId);
      s.displayUnitByVariableId.set(m.variableId, chosenUnit); // silent; add notifies
      addVariable(app, m.variableId);
      if (text.trim() !== "") submitValue(app, m.variableId, text, chosenUnit);
    };
    valueBox.addEventListener("keydown", (event) => {
      if (event.key === "Enter") commit();
    });
    return el("div", { class: "field-row" }, [
      valueBox,
      unitSelect,
      el("button", { type: "button", class: "btn", text: "Add input", onclick: commit }),
    ]);
  }

  function missingList(missingInputs) {
    return el(
      "ul",
      { class: "missing-list" },
      missingInputs.map((m) => {
        const head = el("li", {}, [
          el("span", { text: `${adapter.variablesById[m.variableId]?.name ?? m.variableId} ` }),
          el("span", { class: "missing-list__reason", text: `— ${m.causeText}` }),
          m.canBeUserInput
            ? el("button", {
                type: "button",
                class: "btn",
                text: inlineEntryOpen.has(m.variableId) ? "Close" : "Enter value",
                onclick: () => {
                  if (inlineEntryOpen.has(m.variableId)) inlineEntryOpen.delete(m.variableId);
                  else inlineEntryOpen.add(m.variableId);
                  renderReport(false); // view-local toggle; no store notify
                },
              })
            : null,
          m.canBeUserInput && inlineEntryOpen.has(m.variableId) ? inlineEntry(m) : null,
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
              el("span", { class: "missing-list__reason", text:
                r.variableId
                  ? `${r.causeText}: ${adapter.variablesById[r.variableId]?.name ?? r.variableId}`
                  : r.causeText }),
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
      // Friendly copy from catalog names; the raw engine diagnostic stays in
      // view.diagnostics as developer fallback and never enters this DOM.
      nodes.push(el("p", { class: "status-text", text:
        `No registered formula produces ${variable.name}; the engine does not perform algebraic inversion.` +
        (view.canBeUserInput ? ` You can enter ${variable.name} directly as an input.` : "") }));
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

  /** Cleanup for test fixtures: detaches the store subscription. */
  return function dispose() {
    unsubscribeTargets();
  };
}
