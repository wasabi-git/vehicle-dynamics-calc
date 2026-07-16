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
import { queryTargetView, defaultTargets, selectTarget, groupTargetOptions } from "./targets_controller.mjs";
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
  // Honest grouping (C9R9): computable answers first, then derivable
  // intermediates, then variables that can only be entered directly.
  // Native <option> cannot carry <sub> markup: use the underscore-free
  // plain form of the symbol (F_x -> Fx), never the raw catalog string.
  const optionFor = (variableId) => {
    const variable = adapter.variablesById[variableId];
    return el("option", { value: variable.variable_id, text: `${variable.name} (${plainSymbol(variable.symbol)})` });
  };
  const grouped = groupTargetOptions(adapter);
  for (const [label, ids] of [
    ["Primary results", grouped.primary],
    ["Derived intermediates", grouped.intermediates],
    ["Direct-input only", grouped.inputOnly],
  ]) {
    select.append(el("optgroup", { label: `${label} (${ids.length})` }, ids.map(optionFor)));
  }
  select.addEventListener("change", () => selectTarget(app, select.value));
  queryBtn.addEventListener("click", () => renderReport(true));
  const unsubscribeTargets = store.subscribe(() => renderReport(false));

  // Inline-entry state (C9R7R1): a SINGLE open entry, keyed by the stable
  // occurrence key of the clicked row — `t:<target>/<formula chain>#<var>` —
  // so the same missing variable on other paths stays closed. Toggling
  // mutates only the clicked row's DOM (no report rebuild — ancestor
  // <details> stay open); full re-renders re-mount the entry at the same
  // occurrence. Submitting clears the slot, so a variable that later goes
  // missing again never re-opens by itself. Value/unit drafts stay keyed by
  // variable_id (one eventual input per variable).
  let openEntryKey = null;
  let openEntryRefs = null; // {mount, button} of the currently open row

  function toggleEntry(m, occKey, mount, button) {
    if (openEntryKey === occKey) {
      openEntryKey = null;
      openEntryRefs = null;
      clear(mount);
      button.textContent = "Enter value";
      return;
    }
    if (openEntryRefs) {
      clear(openEntryRefs.mount);
      openEntryRefs.button.textContent = "Enter value";
    }
    openEntryKey = occKey;
    openEntryRefs = { mount, button };
    mount.append(inlineEntry(m));
    button.textContent = "Close";
    mount.querySelector("input")?.focus();
  }

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
      openEntryKey = null; // slot cleared: no auto-reopen if it goes missing again
      openEntryRefs = null;
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

  function missingList(missingInputs, prefix) {
    return el(
      "ul",
      { class: "missing-list" },
      missingInputs.map((m) => {
        const occKey = `${prefix}#${m.variableId}`;
        const mount = el("div");
        let button = null;
        if (m.canBeUserInput) {
          button = el("button", {
            type: "button",
            class: "btn",
            text: openEntryKey === occKey ? "Close" : "Enter value",
          });
          button.addEventListener("click", () => toggleEntry(m, occKey, mount, button));
          if (openEntryKey === occKey) {
            // A full re-render re-mounts the single open entry at exactly
            // this occurrence and refreshes the live refs.
            mount.append(inlineEntry(m));
            openEntryRefs = { mount, button };
          }
        }
        const head = el("li", {}, [
          el("span", { text: `${adapter.variablesById[m.variableId]?.name ?? m.variableId} ` }),
          el("span", { class: "missing-list__reason", text: `— ${m.causeText}` }),
          button,
          mount,
        ]);
        if (m.derivationOptions.length > 0) {
          head.append(
            el("details", { class: "derivation" }, [
              el("summary", { text: `or derive it (${m.derivationOptions.length} option${m.derivationOptions.length > 1 ? "s" : ""})` }),
              ...m.derivationOptions.map((option) => pathOption(option, occKey)),
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

  function pathOption(path, prefix) {
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
    const myPrefix = `${prefix}/${path.formulaId}`;
    return el("div", { class: "path-option" }, [
      el("div", { class: "path-option__head" }, [
        el("span", { text: formula ? formula.name : path.formulaId }),
        modelName ? el("span", { class: "micro-label", text: modelName }) : null,
        el("span", { class: "micro-label", text: path.status }),
      ]),
      formula ? formulaBlock(formatFormula(formula.expression)) : null,
      path.missingInputs.length > 0 ? missingList(path.missingInputs, myPrefix) : null,
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
    nodes.push(...view.paths.map((path) => pathOption(path, `t:${variableId}`)));
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
    openEntryRefs = null; // rebuilt rows re-establish the live refs below
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
