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
import { cancelPending, confirmPending, adoptMisuseSuggestion, ignoreMisuseSuggestion } from "./inputs_controller.mjs";
import { presentResultWarnings, upstreamAbnormalities } from "./warnings_controller.mjs";
import { warningBanner, upstreamSection } from "./warnings_view.mjs";
import {
  buildDerivationDetail,
  comparisonsForVariable,
  toggleExpanded,
  noResultState,
  NO_RESULT_TEXT,
} from "./derivation_controller.mjs";
import { formulaBlock, symbolSpan, proseWithSymbols } from "./formula_view.mjs";
import { formatFormula, isFallback } from "../adapter/formula_format.mjs";

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

  function derivationDetails(view) {
    if (view.source !== "derived") return null;
    const instance = app.engine.getByResultId(view.resultId);
    if (!instance) return null;
    const d = buildDerivationDetail(app, instance);
    const details = el("details", { class: "derivation", open: store.state.expandedResultIds.has(view.resultId) ? "open" : null }, [
      el("summary", { text: "Derivation details" }),
      el("p", { class: "status-text", text: d.summary }),
      el("p", { class: "micro-label", text: `Formula · ${d.formulaName}` }),
      d.formulaTree ? formulaBlock(d.formulaTree) : null,
      el("div", { class: "rail" },
        d.substitutions.map((s) =>
          el("div", { class: "rail-row" }, [
            el("span", { class: `dot ${s.source === "user_input" ? "dot--user" : s.source === "assumption" ? "dot--assumed" : s.source === "constant" ? "dot--assumed" : "dot--derived"}` }),
            el("span", { class: "num" }, [
              el("span", { text: `${s.name} (` }),
              symbolSpan(s.symbol, ""),
              el("span", { text: `): ${s.conversion}${s.stale ? " — stale" : ""}${s.retired ? " — superseded" : ""}` }),
            ]),
            el("span", { class: "micro-label", text: s.source.replace("_", " ") }),
          ])
        )
      ),
      d.intermediates.length
        ? el("p", { class: "status-text", text: `Intermediate variables: ${d.intermediates.map((i) => `${i.name} (${i.formulaId})`).join(", ")}` })
        : null,
      d.assumptionsUsed.length
        ? el("p", { class: "status-text", text: `Assumptions used: ${d.assumptionsUsed.map((id) => app.adapter.variablesById[id]?.name ?? id).join(", ")}` })
        : null,
      d.constants.length
        ? el("p", { class: "status-text", text: `Constants: ${d.constants.map((c) => `${c.name} = ${c.siText}`).join(", ")}` })
        : null,
      el("div", { class: "trace-section" }, [
        el("h4", { class: "section-label", text: "Sources" }),
        el("ul", { class: "step-list" },
          d.sources.map((s) => {
            // Notes go through the safe formula channel: a note that parses
            // under the closed M3 table renders as a formula block; anything
            // else is typeset as prose with real subscripts (no raw
            // underscore ever shows). Null note/locator (suppressed private
            // placeholders, C9R8) render as the label alone.
            const noteTree = s.note === null ? null : formatFormula(s.note);
            return el("li", {}, [
              el("span", { class: "micro-label", text: s.label }),
              s.note === null ? null : el("span", { text: " " }),
              s.note === null ? null : (isFallback(noteTree) ? proseWithSymbols(s.note) : formulaBlock(noteTree)),
              s.locator === null ? null : el("span", { text: ` (${s.locator})` }),
            ]);
          })
        ),
      ]),
      el("p", { class: "status-text", text: `Formula path: ${d.formulaPath.join(" → ")}` }),
      d.stale ? el("p", { class: "row-diagnostic row-diagnostic--warning", text: "This derivation is stale; recalculate to refresh it." }) : null,
    ]);
    details.addEventListener("toggle", () => toggleExpanded(app, view.resultId, details.open));
    return details;
  }

  function comparisonNodes(view) {
    if (view.source !== "user_input" || !view.useDerivedButton) return [];
    const unitSymbol = (id) => app.adapter.unitsById[id]?.display_symbol ?? id;
    const modelName = (name) => app.adapter.modelsById[name]?.display_name ?? name;
    return comparisonsForVariable(app, view.variableId).map((c) =>
      el("p", { class: "status-text num", text:
        `Difference vs derived${c.model ? ` (${modelName(c.model)})` : ""}: ` +
        `${c.absoluteSiText} SI` +
        (c.displayDeltaText ? ` · ${c.displayDeltaText} ${unitSymbol(c.displayUnit)}` : "") +
        ` · ${c.percentageText}` })
    );
  }

  function warningNodes(view) {
    const instance = app.engine.getByResultId(view.resultId);
    if (!instance) return [];
    const nodes = presentResultWarnings(app, instance).map((presented) =>
      warningBanner(presented, {
        app,
        onAdopt: (suggestion) => adoptMisuseSuggestion(app, suggestion),
        onIgnore: (p) => ignoreMisuseSuggestion(app, p.resultId),
      })
    );
    const trace = upstreamSection(
      upstreamAbnormalities(app, instance),
      (variableId) => app.adapter.variablesById[variableId]?.name ?? variableId
    );
    if (trace) nodes.push(trace);
    return nodes;
  }

  function cardTitle(view) {
    const title = el("h3", { class: "result-card__name", text: `${view.variableName} (` });
    title.append(symbolSpan(view.symbol, ""), el("span", { text: ")" }));
    return title;
  }

  function primaryCard(view, sections) {
    const card = el("div", { class: `result-card${view.stale ? " is-stale" : ""}` }, [
      cardTitle(view),
      el("div", { class: "hero-value" }, [
        el("span", { class: "num", text: view.display.ok ? view.display.text : "—" }),
        el("span", { class: "hero-value__unit", text: view.display.ok ? view.display.unitSymbol : "" }),
      ]),
      statusRow(view),
      el("p", { class: "status-text num", text: `SI: ${view.si.text} ${view.si.unitSymbol}` }),
      ...warningNodes(view),
      ...comparisonNodes(view),
      useDerivedControls(view),
      derivationDetails(view),
    ]);
    const section = sections[view.variableId];
    if (section && view.source === "derived" && view.active) {
      const parts = modelSection(section);
      if (parts) for (const part of parts) card.append(part);
    }
    return card;
  }

  function secondaryRow(view, sections) {
    const rowTitle = el("span", { text: `${view.variableName} (` });
    rowTitle.append(symbolSpan(view.symbol, ""), el("span", { text: ")" }));
    const row = el("div", { class: `result-row${view.stale ? " is-stale" : ""}` }, [
      rowTitle,
      ...view.labels.map((l) => el("span", { class: "micro-label", text: l.text })),
      el("span", { class: "result-row__value num", text: view.display.ok ? `${view.display.text} ${view.display.unitSymbol}` : "—" }),
    ]);
    const extras = [...warningNodes(view), ...comparisonNodes(view)];
    const controls = useDerivedControls(view);
    if (controls) extras.push(controls);
    const details = derivationDetails(view);
    if (details) extras.push(details);
    if (extras.length === 0) return row;
    // Row + its own extras (warnings, comparisons, derivation details) form
    // ONE group: the separator draws under the whole group, never between a
    // row and its own details (owner-directed C9R10).
    return el("div", { class: "result-group" }, [row, ...extras]);
  }

  function render() {
    const state = buttonStateFor(store.state.calculationPhase, store.state.lastSolveDiagnostics);
    button.textContent = state.text;
    button.disabled = !state.enabled;
    status.textContent = state.status;

    clear(region);
    const emptyState = noResultState(app);
    if (emptyState === "not_calculated" || emptyState === "nothing_derivable") {
      region.append(el("p", { class: "empty-note", id: "results-empty-note", text: NO_RESULT_TEXT[emptyState] }));
      return;
    }
    const vm = buildResultsViewModel(app);
    if (emptyState === "target_unavailable") {
      region.append(el("p", { class: "empty-note", text: NO_RESULT_TEXT.target_unavailable }));
    }
    if (!vm.hasAny) {
      region.append(el("p", { class: "empty-note", id: "results-empty-note", text: NO_RESULT_TEXT.nothing_derivable }));
      return;
    }

    for (const view of vm.layers.primary) {
      if (view.kind === "selection_pending") {
        const card = el("div", { class: "result-card" }, [
          cardTitle(view),
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
      // Section title sits at the same level as "Query a target"; the
      // expanded/collapsed state is component-local view state that
      // survives re-renders — an action inside the section no longer
      // snaps it shut (owner-directed C9R7).
      const intermediateDetails = el(
        "details",
        { class: "derivation", open: intermediatesOpen ? "open" : null },
        [
          el("summary", { text: `Show intermediate results (${vm.layers.intermediate.length})` }),
          ...vm.layers.intermediate.map((v) => secondaryRow(v, vm.modelSections)),
        ]
      );
      intermediateDetails.addEventListener("toggle", () => {
        intermediatesOpen = intermediateDetails.open; // silent view state, no notify
      });
      region.append(
        el("div", { class: "card" }, [
          el("h2", { class: "section-label", text: "Intermediate results" }),
          intermediateDetails,
        ])
      );
    }
  }

  let intermediatesOpen = false;

  const unsubscribeResults = store.subscribe(render);
  render();

  /** Cleanup for test fixtures: detaches the store subscription. */
  return function dispose() {
    unsubscribeResults();
  };
}
