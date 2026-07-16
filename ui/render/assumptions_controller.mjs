/**
 * assumptions_controller.mjs — §7.7 assumption operations and the
 * constants panel data (no DOM). The interface-to-engine mapping is fixed:
 *   disable one      -> setAssumptionEnabled(id, false)
 *   disable all      -> loop false over every can_be_assumed variable
 *   restore defaults -> setAssumptionEnabled(id, true) for every variable
 *                       whose default_assumption.enabled_by_default is true
 *   restore displaced-> restoreAssumption(id); an assumption_disabled
 *                       diagnostic routes to the enable flow instead
 * Enabling/restoring while a user input holds the variable keeps the input
 * Active; the UI reports it with the fixed re-enabled message.
 */

import { formatSignificant, PRECISION } from "../adapter/view_model.mjs";
import { recomputePhase } from "./inputs_controller.mjs";

export const RE_ENABLED_MESSAGE =
  "Assumption re-enabled — your input remains the active value.";

/** Rows for the Assumptions panel. */
export function listAssumptions({ engine, adapter }) {
  return adapter.variables
    .filter((v) => v.can_be_assumed === true)
    .map((variable) => {
      const variableId = variable.variable_id;
      // Public API only: an instantiated assumption instance means enabled
      // (disable retires the instance); instance && !active && no user input
      // means displaced-and-suppressed awaiting an explicit restore.
      const instance = engine
        .getResults(variableId)
        .find((r) => r.source === "assumption") ?? null;
      const userInput = engine.getResults(variableId).find((r) => r.source === "user_input") ?? null;
      const display = instance
        ? engine.displayValue(instance, variable.default_unit)
        : null;
      return {
        variableId,
        name: variable.name,
        symbol: variable.symbol,
        defaultText: `${variable.default_assumption.value} ${variable.default_assumption.unit}`,
        enabledByDefault: variable.default_assumption.enabled_by_default === true,
        enabled: instance !== null,
        active: instance ? instance.active === true : false,
        displaced: instance !== null && !instance.active,
        valueText: display && display.ok ? `${formatSignificant(display.value, PRECISION.result)} ${variable.default_unit}` : null,
        userInputPresent: userInput !== null,
      };
    });
}

/** Enable/disable one assumption; a computational change. */
export function setAssumptionFlow(app, variableId, enabled) {
  const outcome = app.engine.setAssumptionEnabled(variableId, enabled);
  if (outcome.ok === true) {
    recomputePhase(app, { changed: true });
    app.store.notify();
  }
  const userActive = app.engine
    .getResults(variableId)
    .some((r) => r.source === "user_input" && r.active);
  return {
    ...outcome,
    reEnabledMessage: outcome.ok === true && enabled === true && userActive ? RE_ENABLED_MESSAGE : null,
  };
}

/** Disable every registered assumption. */
export function disableAllAssumptions(app) {
  for (const row of listAssumptions(app)) {
    app.engine.setAssumptionEnabled(row.variableId, false);
  }
  recomputePhase(app, { changed: true });
  app.store.notify();
}

/** Re-enable exactly the defaults (enabled_by_default === true). */
export function restoreDefaultAssumptions(app) {
  const messages = [];
  for (const variable of app.adapter.variables) {
    if (variable.can_be_assumed !== true) continue;
    if (variable.default_assumption.enabled_by_default !== true) continue;
    const outcome = setAssumptionFlow(app, variable.variable_id, true);
    if (outcome.reEnabledMessage) messages.push({ variableId: variable.variable_id, message: outcome.reEnabledMessage });
  }
  return messages;
}

/**
 * Explicitly restore a displaced (enabled but suppressed) assumption.
 * assumption_disabled routes the caller to the enable flow.
 */
export function restoreAssumptionFlow(app, variableId) {
  const outcome = app.engine.restoreAssumption(variableId);
  if (outcome.ok === true) {
    recomputePhase(app, { changed: true });
    app.store.notify();
    const userActive = app.engine
      .getResults(variableId)
      .some((r) => r.source === "user_input" && r.active);
    return { ...outcome, routed: null, reEnabledMessage: userActive ? RE_ENABLED_MESSAGE : null };
  }
  if (outcome.diagnostic && outcome.diagnostic.code === "assumption_disabled") {
    return { ...outcome, routed: "enable_instead", reEnabledMessage: null };
  }
  return { ...outcome, routed: null, reEnabledMessage: null };
}

/** Rows for the Constants panel (visible system constants). */
export function listConstants({ engine, adapter }) {
  return adapter.variables
    .filter((v) => v.is_constant === true)
    .map((variable) => {
      const instance = engine
        .getResults(variable.variable_id)
        .find((r) => r.source === "constant");
      const display = instance ? engine.displayValue(instance, variable.default_unit) : null;
      return {
        variableId: variable.variable_id,
        name: variable.name,
        symbol: variable.symbol,
        valueText: display && display.ok
          ? `${formatSignificant(display.value, PRECISION.result)} ${adapter.unitsById[variable.default_unit]?.display_symbol ?? variable.default_unit}`
          : "—",
      };
    });
}
