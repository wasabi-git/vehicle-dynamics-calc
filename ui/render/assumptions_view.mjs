/**
 * assumptions_view.mjs — DOM view of the Assumptions and Constants panels.
 * Logic lives in assumptions_controller.mjs; this file wires buttons and
 * re-renders on store notifications.
 */

import { el, clear } from "./dom_util.mjs";
import { symbolSpan } from "./formula_view.mjs";
import {
  listAssumptions,
  setAssumptionFlow,
  disableAllAssumptions,
  restoreDefaultAssumptions,
  restoreAssumptionFlow,
  listConstants,
} from "./assumptions_controller.mjs";

export function initAssumptionsView(app) {
  const { store } = app;
  const list = document.getElementById("assumption-list");
  const emptyNote = document.getElementById("assumptions-empty-note");
  const disableAllBtn = document.getElementById("assumptions-disable-all");
  const restoreBtn = document.getElementById("assumptions-restore-defaults");
  const constants = document.getElementById("constant-list");
  const constantsNote = document.getElementById("constants-empty-note");

  disableAllBtn.disabled = false;
  restoreBtn.disabled = false;
  disableAllBtn.addEventListener("click", () => disableAllAssumptions(app));
  restoreBtn.addEventListener("click", () => {
    const messages = restoreDefaultAssumptions(app);
    noteText = messages.length > 0 ? messages[0].message : null;
    render();
  });

  let noteText = null;

  function statusText(row) {
    if (!row.enabled) return "Disabled";
    if (row.active) return `Active · ${row.valueText}`;
    if (row.userInputPresent) return `Displaced by your input · default ${row.defaultText}`;
    return `Suppressed · restore to use ${row.defaultText}`;
  }

  function render() {
    clear(list);
    const rows = listAssumptions(app);
    emptyNote.classList.toggle("hidden", rows.length > 0);
    for (const row of rows) {
      const actions = [];
      if (row.enabled) {
        actions.push(
          el("button", {
            type: "button", class: "btn assumption-row__action", text: "Disable",
            onclick: () => setAssumptionFlow(app, row.variableId, false),
          })
        );
        if (row.displaced) {
          actions.push(
            el("button", {
              type: "button", class: "btn", text: "Restore",
              onclick: () => {
                const outcome = restoreAssumptionFlow(app, row.variableId);
                noteText = outcome.reEnabledMessage;
                if (outcome.routed === "enable_instead") setAssumptionFlow(app, row.variableId, true);
                render();
              },
            })
          );
        }
      } else {
        actions.push(
          el("button", {
            type: "button", class: "btn assumption-row__action", text: "Enable",
            onclick: () => {
              const outcome = setAssumptionFlow(app, row.variableId, true);
              noteText = outcome.reEnabledMessage;
              render();
            },
          })
        );
      }
      list.append(
        el("li", { class: "assumption-row" }, [
          el("span", { class: "dot dot--assumed" }),
          (() => {
            const label = el("span", { text: `${row.name} (` });
            label.append(symbolSpan(row.symbol, ""), el("span", { text: ")" }));
            return label;
          })(),
          el("span", { class: "assumption-row__status", text: statusText(row) }),
          ...actions,
        ])
      );
    }
    if (noteText) {
      list.append(el("li", { class: "assumption-row" }, [el("span", { class: "assumption-row__status", text: noteText })]));
    }

    clear(constants);
    const constantRows = listConstants(app);
    constantsNote.classList.toggle("hidden", constantRows.length > 0);
    for (const row of constantRows) {
      const label = el("span", { text: `${row.name} (` });
      label.append(symbolSpan(row.symbol, ""), el("span", { text: ")" }));
      constants.append(
        el("li", { class: "constant-row" }, [
          label,
          el("span", { class: "micro-label", text: "Constant" }),
          el("span", { class: "constant-row__value num", text: row.valueText }),
        ])
      );
    }
  }

  store.subscribe(render);
  render();
}
