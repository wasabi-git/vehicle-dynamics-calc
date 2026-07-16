/**
 * inputs_view.mjs — DOM view of the Inputs region.
 *
 * Renders the search box, category chips, variable picker, input rows
 * (value + display-unit selector + remove), the tire-code quick input, the
 * clear-all flow, and the single confirmation banner. All state lives in the
 * store; all logic lives in inputs_controller.mjs / tire_code.mjs. This file
 * only wires DOM events to controller calls and re-renders on notify.
 */

import { el, clear } from "./dom_util.mjs";
import { formatSignificant, PRECISION } from "../adapter/view_model.mjs";
import { presentResultWarnings } from "./warnings_controller.mjs";
import { warningBanner } from "./warnings_view.mjs";
import { symbolSpan } from "./formula_view.mjs";
import { composeTireCode } from "../adapter/tire_code.mjs";
import {
  filterVariables,
  availableCategories,
  addVariable,
  submitValue,
  setDisplayUnit,
  requestRemoveInput,
  requestClearAll,
  cancelPending,
  confirmPending,
  applyTireCodeFlow,
  adoptMisuseSuggestion,
  ignoreMisuseSuggestion,
} from "./inputs_controller.mjs";

const CATEGORY_TEXT = {
  tire_wheel: "Tire and wheel",
  powertrain: "Powertrain",
  vehicle_properties: "Vehicle properties",
  road_loads_external_forces: "Road loads and external forces",
  motion_performance: "Motion and performance",
  constants: "Constants",
};

export function initInputsView(app) {
  const { store } = app;
  const searchInput = document.getElementById("variable-search");
  const tireWidth = document.getElementById("tire-width");
  const tireAspect = document.getElementById("tire-aspect");
  const tireRim = document.getElementById("tire-rim");
  const tireApply = document.getElementById("tire-apply");
  const clearAllBtn = document.getElementById("clear-all");

  searchInput.disabled = false;
  tireWidth.disabled = false;
  tireAspect.disabled = false;
  tireRim.disabled = false;
  tireApply.disabled = false;
  clearAllBtn.disabled = false;

  searchInput.addEventListener("input", () => {
    store.state.variableSearchQuery = searchInput.value;
    store.notify();
  });
  // Three boxes compose the canonical code string; §7.12's parser stays the
  // single syntax gate for whatever lands in the boxes.
  tireApply.addEventListener("click", async () => {
    const report = await applyTireCodeFlow(app, composeTireCode(tireWidth.value, tireAspect.value, tireRim.value));
    renderTireReport(report);
    if (report.ok) {
      tireWidth.value = "";
      tireAspect.value = "";
      tireRim.value = "";
    }
  });
  clearAllBtn.addEventListener("click", () => requestClearAll(app));

  let highlightTimer = null;
  let focusedForHighlight = null;

  function renderTireReport(report) {
    const slot = document.getElementById("tire-report") ?? el("p", { id: "tire-report", class: "row-diagnostic" });
    if (!slot.isConnected) tireApply.closest(".field-row").after(slot);
    if (report.ok) {
      slot.className = "row-diagnostic row-diagnostic--muted";
      slot.textContent = `Tire code applied: ${report.applied.map((a) => app.adapter.variablesById[a.variableId]?.name ?? a.variableId).join(", ")}.`;
    } else {
      slot.className = "row-diagnostic row-diagnostic--danger";
      const appliedNote = report.applied.length
        ? ` Already written before the failure: ${report.applied.map((a) => app.adapter.variablesById[a.variableId]?.name ?? a.variableId).join(", ")} — remove them manually if unwanted.`
        : "";
      slot.textContent = `${report.message ?? report.failure?.message ?? "Tire code failed."}${appliedNote}`;
    }
  }

  function renderChips() {
    const row = document.getElementById("category-filter");
    clear(row);
    const mkChip = (label, value) =>
      el("button", {
        type: "button",
        class: `chip${store.state.selectedCategory === value ? " chip--active" : ""}`,
        text: label,
        onclick: () => {
          store.state.selectedCategory = store.state.selectedCategory === value ? null : value;
          store.notify();
        },
      });
    for (const category of availableCategories(app)) {
      row.append(mkChip(CATEGORY_TEXT[category] ?? category, category));
    }
  }

  function renderPicker() {
    const list = document.getElementById("variable-picker");
    clear(list);
    const s = store.state;
    // Keep the search box in sync when the controller clears the query on
    // add (never clobber while the user is typing in it).
    if (searchInput.value !== s.variableSearchQuery && document.activeElement !== searchInput) {
      searchInput.value = s.variableSearchQuery;
    }
    if (!s.variableSearchQuery.trim() && !s.selectedCategory) return;
    for (const variable of filterVariables(app)) {
      const alreadyAdded = s.uiInputOrder.includes(variable.variable_id);

      // Direct entry in the picker row itself (owner-directed C9R5/C9R6):
      // type a value right here, pick any allowed unit in the row's own
      // selector, and press Enter — added and submitted in one step. The
      // chosen unit becomes the row's display unit, so the landed row shows
      // exactly what was entered.
      let valueBox = null;
      let unitSelect = null;
      const commitFromPicker = () => {
        const text = valueBox.value;
        const chosenUnit = unitSelect.value;
        s.displayUnitByVariableId.set(variable.variable_id, chosenUnit); // silent; the add below notifies
        addVariable(app, variable.variable_id);
        if (text.trim() !== "") submitValue(app, variable.variable_id, text, chosenUnit);
      };
      if (!alreadyAdded) {
        // Uncommitted picker entry is keyed by variable_id in the store
        // (inputDraftByVariableId for the text, displayUnitByVariableId for
        // the unit — both within their registered purposes) and written
        // SILENTLY on every keystroke, so any store re-render rebuilds the
        // row with the content intact (C9R6R1).
        const entryUnit = s.displayUnitByVariableId.get(variable.variable_id) ?? variable.default_unit;
        valueBox = el("input", {
          class: "text-input",
          type: "text",
          size: "8",
          placeholder: "value",
          value: s.inputDraftByVariableId.get(variable.variable_id) ?? "",
          "aria-label": `${variable.name} value`,
        });
        valueBox.addEventListener("input", () => {
          if (valueBox.value === "") s.inputDraftByVariableId.delete(variable.variable_id);
          else s.inputDraftByVariableId.set(variable.variable_id, valueBox.value);
        });
        valueBox.addEventListener("keydown", (event) => {
          if (event.key === "Enter") commitFromPicker();
        });
        unitSelect = el(
          "select",
          {
            class: "select",
            "aria-label": `${variable.name} unit`,
            onchange: () => s.displayUnitByVariableId.set(variable.variable_id, unitSelect.value), // silent
          },
          variable.allowed_units.map((unitId) =>
            el("option", {
              value: unitId,
              text: app.adapter.unitsById[unitId]?.display_symbol ?? unitId,
            })
          )
        );
        unitSelect.value = entryUnit;
      }

      list.append(
        el("li", { class: "picker-row" }, [
          el("span", { text: variable.name }),
          symbolSpan(variable.symbol, "picker-row__symbol"),
          valueBox,
          unitSelect,
          el("button", {
            type: "button",
            class: "btn picker-row__add",
            text: alreadyAdded ? "Added — locate" : "Add",
            onclick: () => {
              if (alreadyAdded) {
                addVariable(app, variable.variable_id);
                return;
              }
              commitFromPicker();
            },
          }),
        ])
      );
    }
  }

  function currentEntry(variableId) {
    const instance = app.engine
      .getResults(variableId)
      .find((r) => r.source === "user_input");
    if (!instance) return { instance: null, snapshot: null };
    return { instance, snapshot: store.state.inputSnapshotByResultId.get(instance.result_id) ?? null };
  }

  function rowValueText(variableId, displayUnit) {
    const s = store.state;
    if (s.inputDraftByVariableId.has(variableId)) return s.inputDraftByVariableId.get(variableId);
    const { instance, snapshot } = currentEntry(variableId);
    if (!instance) return "";
    if (snapshot && snapshot.enteredUnit === displayUnit) return String(snapshot.enteredValue);
    const converted = app.engine.displayValue(instance, displayUnit);
    return converted.ok ? formatSignificant(converted.value, PRECISION.result) : "";
  }

  function renderRows() {
    const list = document.getElementById("input-list");
    const empty = document.getElementById("inputs-empty-note");
    clear(list);
    const s = store.state;
    empty.classList.toggle("hidden", s.uiInputOrder.length > 0);

    for (const variableId of s.uiInputOrder) {
      const variable = app.adapter.variablesById[variableId];
      const displayUnit = s.displayUnitByVariableId.get(variableId) ?? variable.default_unit;
      const { instance } = currentEntry(variableId);

      const valueInput = el("input", {
        class: "text-input",
        type: "text",
        value: rowValueText(variableId, displayUnit),
        "aria-label": `${variable.name} value`,
      });
      // In-progress typing persists as a silent draft keyed by variable_id,
      // so a re-render mid-typing rebuilds the row with the text intact
      // (same mechanism as the picker box, C9R6R2).
      valueInput.addEventListener("input", () => {
        if (valueInput.value === "") s.inputDraftByVariableId.delete(variableId);
        else s.inputDraftByVariableId.set(variableId, valueInput.value);
      });
      const commit = () => submitValue(app, variableId, valueInput.value, s.displayUnitByVariableId.get(variableId) ?? variable.default_unit);
      valueInput.addEventListener("change", commit);
      valueInput.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });

      const unitSelect = el(
        "select",
        {
          class: "select",
          "aria-label": `${variable.name} unit`,
          onchange: () => setDisplayUnit(app, variableId, unitSelect.value),
        },
        variable.allowed_units.map((unitId) =>
          el("option", {
            value: unitId,
            text: app.adapter.unitsById[unitId]?.display_symbol ?? unitId,
            selected: unitId === displayUnit ? "selected" : null,
          })
        )
      );
      unitSelect.value = displayUnit;

      const diagnostic = s.inputDiagnosticByVariableId.get(variableId);
      let diagnosticNode = null;
      if (diagnostic) {
        diagnosticNode = el("p", {
          class: `row-diagnostic ${diagnostic.kind === "draft" ? "row-diagnostic--muted" : "row-diagnostic--danger"}`,
          text: diagnostic.message,
        });
      } else if (instance && instance.warnings.length > 0) {
        diagnosticNode = el(
          "div",
          {},
          presentResultWarnings(app, instance).map((presented) =>
            warningBanner(presented, {
              app,
              onAdopt: (suggestion) => adoptMisuseSuggestion(app, suggestion),
              onIgnore: (p) => ignoreMisuseSuggestion(app, p.resultId),
            })
          )
        );
      }

      const row = el(
        "li",
        {
          class: `input-row${s.highlightedVariableId === variableId ? " input-row--highlight" : ""}`,
          id: `input-row-${variableId}`,
        },
        [
          el("div", { class: "input-row__head" }, [
            el("span", { class: "input-row__name", text: variable.name }),
            symbolSpan(variable.symbol, "input-row__symbol"),
            el("button", {
              type: "button",
              class: "btn input-row__remove",
              text: "Remove",
              onclick: () => requestRemoveInput(app, variableId),
            }),
          ]),
          el("div", { class: "input-row__controls" }, [valueInput, unitSelect]),
          diagnosticNode,
        ]
      );
      list.append(row);
    }

    if (s.highlightedVariableId) {
      const target = document.getElementById(`input-row-${s.highlightedVariableId}`);
      if (target) {
        target.scrollIntoView({ block: "nearest" });
        // Locate + focus (Part 2 single-input rule): the freshly added or
        // duplicate-located row is immediately typeable — no scrolling hunt.
        // Re-focus also when a re-render replaced the focused node and focus
        // fell back to <body> (one-step submit renders twice, C9R6R1 #5).
        const focusLost = document.activeElement === document.body || document.activeElement === null;
        if (focusedForHighlight !== s.highlightedVariableId || focusLost) {
          focusedForHighlight = s.highlightedVariableId;
          target.querySelector("input")?.focus();
        }
      }
      if (highlightTimer) clearTimeout(highlightTimer);
      // Silent expiry (C9R6R2): the highlight is visual-only, so clearing it
      // must NOT notify — a notify here rebuilt every view 1.6s after each
      // add ("one automatic refresh") and wiped in-progress typing. The
      // class is removed directly; the store field clears silently.
      highlightTimer = setTimeout(() => {
        highlightTimer = null;
        store.state.highlightedVariableId = null;
        focusedForHighlight = null;
        target.classList.remove("input-row--highlight");
      }, 1600);
    } else {
      focusedForHighlight = null; // a later re-add of the same variable refocuses
    }
  }

  function renderConfirmation() {
    const slot = document.getElementById("inputs-confirm-slot");
    clear(slot);
    const pending = store.state.pendingConfirmation;
    if (!pending || (pending.kind !== "clear_all" && pending.kind !== "remove_input")) return;
    const text =
      pending.kind === "clear_all"
        ? "Remove all inputs? Derived results that depended on them become unavailable after you recalculate."
        : `Remove your input for ${app.adapter.variablesById[pending.payload.variableId]?.name ?? pending.payload.variableId}? Dependent results go stale until you recalculate.`;
    slot.append(
      el("div", { class: "banner banner--neutral" }, [
        el("p", { class: "banner__body", text }),
        el("div", { class: "banner__actions" }, [
          el("button", { type: "button", class: "btn", text: "Confirm", onclick: () => confirmPending(app) }),
          el("button", { type: "button", class: "btn", text: "Cancel", onclick: () => cancelPending(app) }),
        ]),
      ])
    );
  }

  function render() {
    renderChips();
    renderPicker();
    renderRows();
    renderConfirmation();
  }

  const unsubscribe = store.subscribe(render);
  render();

  /**
   * Cleanup (C9R6R1 #3): cancels the pending highlight timer and detaches
   * the store subscription. Test fixtures MUST call this before removing
   * the view's DOM, so no late timer or notify renders into detached nodes.
   */
  return function dispose() {
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = null;
    unsubscribe();
  };
}
