/**
 * results_view.mjs — DOM view of the Calculation strip and Results region.
 *
 * Wires the Calculate/Recalculate button to runSolve, renders the three
 * result layers (primary hero cards, secondary rows, collapsed
 * intermediates), the per-variable model section (with the verbatim
 * multi-model reminder and the R001 no-fallback message), stale styling,
 * and the D25 "Remove input and use derived result" flow. All logic lives
 * in results_controller.mjs; this file is DOM wiring only.
 */

import { el, clear } from "./dom_util.mjs";
import {
  runSolve,
  selectModelFlow,
  requestUseDerived,
  buttonStateFor,
  buildResultsViewModel,
  useDerivedConfirmText,
} from "./results_controller.mjs";
import { cancelPending, confirmPending } from "./inputs_controller.mjs";
import { presentResultWarnings, upstreamAbnormalities } from "./warnings_controller.mjs";
import { warningBanner, upstreamSection } from "./warnings_view.mjs";

export function initResultsView(app) {
  const { store } = app;
  const button = document.getElementById("calculate-btn");
  const status = document.getElementById("calc-status");
  const region = document.getElementById("results-region");

  button.addEventListener("click", () => {
    const state = buttonStateFor(store.state.calculationPhase, store.state.lastSolveDiagnostics);
    if (state.enabled) runSolve(app);
  });

  function statusRow(view) {
    const parts = [
      el("span", {
        class: `dot ${view.source === "user_input" ? "dot--user" : view.source === "assumption" ? "dot--assumed" : "dot--derived"}`,
      }),
      el("span", {
        text: `${view.source === "user_input" ? "User input" : view.model ? view.model.displayName : "Derived"}${view.formulaId ? ` · ${view.formulaId}` : ""}`,
      }),
    ];
    for (const label of view.labels) parts.push(el("span", { class: "micro-label", text: label.text }));
    return el("div", { class: "status-row" }, parts);
  }

  function useDerivedControls(view) {
    if (!view.useDerivedButton || view.source !== "user_input") return null;
    const pending = store.state.pendingConfirmation;
    if (pending && pending.kind === "use_derived" && pending.payload.variableId === view.variableId) {
      return el("div", { class: "banner banner--neutral" }, [
        el("p", { class: "banner__body", text: useDerivedConfirmText(view.variableName) }),
        el("div", { class: "banner__actions" }, [
          el("button", { type: "button", class: "btn", text: "Confirm", onclick: () => confirmPending(app) }),
          el("button", { type: "button", class: "btn", text: "Cancel", onclick: () => cancelPending(app) }),
        ]),
      ]);
    }
    return el("div", { class: "banner__actions" }, [
      el("button", {
        type: "button",
        class: "btn",
        text: "Remove input and use derived result",
        onclick: () => requestUseDerived(app, view.variableId),
      }),
    ]);
  }

  function modelSection(section) {
    if (!section) return null;
    const children = [el("hr", { class: "separator" })];
    for (const row of section.rows) {
      children.push(
        el("div", { class: `model-row${row.stale ? " is-stale" : ""}` }, [
          el("span", { text: row.model ? row.model.displayName : row.formulaId }),
          el("span", { class: "model-row__value num", text: row.display.ok ? `${row.display.text} ${row.display.unitSymbol}` : "—" }),
          ...row.labels.map((l) => el("span", { class: "micro-label", text: l.text })),
          row.selectable
            ? el("button", {
                type: "button",
                class: "btn model-row__action",
                text: "Use this model",
                onclick: () => selectModelFlow(app, section.variableId, row.model.name),
              })
            : el("span", { class: "micro-label model-row__action", text: "Active" }),
        ])
      );
    }
    if (section.recommendation && section.recommendation.message) {
      children.push(
        el("div", { class: "banner banner--warning" }, [
          el("p", { class: "banner__body", text: section.recommendation.message }),
        ])
      );
    }
    if (section.reminder) {
      children.push(el("p", { class: "status-text", text: section.reminder }));
    }
    return children;
  }

  function warningNodes(view) {
    const instance = app.engine.getByResultId(view.resultId);
    if (!instance) return [];
    const nodes = presentResultWarnings(app, instance).map((presented) => warningBanner(presented, { app }));
    const trace = upstreamSection(upstreamAbnormalities(app, instance));
    if (trace) nodes.push(trace);
    return nodes;
  }

  function primaryCard(view, sections) {
    const card = el("div", { class: `result-card${view.stale ? " is-stale" : ""}` }, [
      el("h3", { class: "result-card__name", text: `${view.variableName} (${view.symbol})` }),
      el("div", { class: "hero-value" }, [
        el("span", { class: "num", text: view.display.ok ? view.display.text : "—" }),
        el("span", { class: "hero-value__unit", text: view.display.ok ? view.display.unitSymbol : "" }),
      ]),
      statusRow(view),
      el("p", { class: "status-text num", text: `SI: ${view.si.text} ${view.si.unitId}` }),
      ...warningNodes(view),
      useDerivedControls(view),
    ]);
    const section = sections[view.variableId];
    if (section && view.source === "derived" && view.active) {
      const parts = modelSection(section);
      if (parts) for (const part of parts) card.append(part);
    }
    return card;
  }

  function secondaryRow(view, sections) {
    const row = el("div", { class: `result-row${view.stale ? " is-stale" : ""}` }, [
      el("span", { text: `${view.variableName} (${view.symbol})` }),
      ...view.labels.map((l) => el("span", { class: "micro-label", text: l.text })),
      el("span", { class: "result-row__value num", text: view.display.ok ? `${view.display.text} ${view.display.unitSymbol}` : "—" }),
    ]);
    const extras = [...warningNodes(view)];
    const controls = useDerivedControls(view);
    if (controls) extras.push(controls);
    if (extras.length === 0) return row;
    return el("div", {}, [row, ...extras]);
  }

  function render() {
    const state = buttonStateFor(store.state.calculationPhase, store.state.lastSolveDiagnostics);
    button.textContent = state.text;
    button.disabled = !state.enabled;
    status.textContent = state.status;

    clear(region);
    const vm = buildResultsViewModel(app);
    if (!vm.hasAny || !store.state.hasCompletedSolve) {
      region.append(el("p", { class: "empty-note", id: "results-empty-note", text: "Results appear here after you calculate." }));
      return;
    }

    for (const view of vm.layers.primary) {
      if (view.kind === "selection_pending") {
        const card = el("div", { class: "result-card" }, [
          el("h3", { class: "result-card__name", text: `${view.variableName} (${view.symbol})` }),
          el("div", { class: "hero-value" }, [
            el("span", { class: "num", text: "—" }),
          ]),
          el("p", { class: "status-text", text: "No active result: select a model below." }),
        ]);
        const parts = modelSection(vm.modelSections[view.variableId]);
        if (parts) for (const part of parts) card.append(part);
        region.append(card);
      } else {
        region.append(primaryCard(view, vm.modelSections));
      }
    }

    if (vm.layers.secondary.length > 0) {
      region.append(
        el("div", { class: "card" }, [
          el("h2", { class: "section-label", text: "Other derived results" }),
          ...vm.layers.secondary.map((v) => secondaryRow(v, vm.modelSections)),
        ])
      );
    }

    if (vm.layers.intermediate.length > 0) {
      region.append(
        el("div", { class: "card" }, [
          el(
            "details",
            { class: "derivation" },
            [
              el("summary", { text: `Intermediate results (${vm.layers.intermediate.length})` }),
              ...vm.layers.intermediate.map((v) => secondaryRow(v, vm.modelSections)),
            ]
          ),
        ])
      );
    }
  }

  store.subscribe(render);
  render();
}
