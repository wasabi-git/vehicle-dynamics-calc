/**
 * warnings_view.mjs — DOM builders for presented warnings and the
 * "Upstream abnormalities" section. Shared by the Inputs and Results views.
 * Text via textContent only; actions call the handlers passed in.
 */

import { el } from "./dom_util.mjs";
import { confirmKeepOriginal } from "./warnings_controller.mjs";

/**
 * One presented warning -> banner element.
 * handlers: {app, onAdopt?, onIgnore?} — adopt/ignore are wired by the
 * misuse commit; absent handlers hide those buttons.
 */
export function warningBanner(presented, { app, onAdopt, onIgnore } = {}) {
  const danger = presented.code === "range_invalid";
  const actions = [];
  for (const action of presented.actions) {
    if (action.kind === "keep_original") {
      actions.push(
        el("button", {
          type: "button",
          class: "btn",
          text: action.text,
          onclick: () => confirmKeepOriginal(app, presented.resultId),
        })
      );
    } else if (action.kind === "adopt_suggestion" && onAdopt) {
      actions.push(
        el("button", { type: "button", class: "btn", text: action.text, onclick: () => onAdopt(action.suggestion) })
      );
    } else if (action.kind === "ignore_misuse" && onIgnore) {
      actions.push(
        el("button", { type: "button", class: "btn", text: action.text, onclick: () => onIgnore(presented) })
      );
    }
  }

  const rangeBits = [];
  if (presented.ranges.normal) rangeBits.push(`Normal: ${presented.ranges.normal}`);
  if (presented.ranges.warning) rangeBits.push(`Warning envelope: ${presented.ranges.warning}`);

  return el("div", { class: `banner ${danger ? "banner--danger" : "banner--warning"}` }, [
    el("p", { class: "banner__title", text: presented.title }),
    el("p", { class: "banner__body", text: `${presented.reason} ${presented.continuationPolicy}` }),
    rangeBits.length ? el("p", { class: "banner__meta", text: rangeBits.join(" · ") }) : null,
    presented.confirmed ? el("p", { class: "banner__meta", text: "User confirmed warning." }) : null,
    actions.length ? el("div", { class: "banner__actions" }, actions) : null,
  ]);
}

/** Upstream abnormality entries -> a titled trace section (or null). */
export function upstreamSection(entries) {
  if (entries.length === 0) return null;
  return el("div", { class: "trace-section" }, [
    el("h4", { class: "section-label", text: "Upstream abnormalities" }),
    el(
      "ul",
      { class: "step-list" },
      entries.map((entry) =>
        el("li", {}, [
          el("span", {
            text:
              `${entry.variableId} (${entry.source}${entry.retired ? ", superseded" : ""}) — ${entry.message} ` +
              `[${entry.direct ? "direct dependency" : `${entry.hops} hops upstream`}` +
              `${entry.confirmed ? ", user confirmed" : ""}]`,
          }),
        ])
      )
    ),
  ]);
}
