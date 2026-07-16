/**
 * warnings_controller.mjs — controller side of §7.6/§7.5 (no DOM).
 *
 * Precomputes everything the pure presenter needs (display conversion via
 * engine.displayValue, unrounded, then §11.2 formatting; snapshot lookup;
 * direct live consumers as affected results) and owns the result_id-keyed
 * confirmation flow ("Keep original" writes confirmedResultIds only).
 */

import { presentWarnings } from "../adapter/warning_presenter.mjs";
import { collectUpstreamAbnormalities } from "../adapter/upstream_trace.mjs";
import { formatSignificant, PRECISION } from "../adapter/view_model.mjs";

/** Direct live consumers of a result (their dependencies name it). */
export function directConsumers(engine, resultId) {
  return engine
    .getResults()
    .filter((r) => r.source === "derived" && r.dependencies.includes(resultId))
    .map((r) => r.result_id);
}

/**
 * Range display data for one metadata range (owner-approved C9R3b):
 * conversion to the current display unit goes EXCLUSIVELY through the
 * public engine.convertUnitValue — read-only, zero pool effects. The
 * warning tier itself stays whatever the engine already judged; the UI
 * never re-evaluates ranges. When the display unit equals the declared
 * unit, or ANY endpoint fails to convert, `converted` is null and the
 * presenter falls back to the registered metadata values verbatim.
 */
export function buildRangeDisplay(engine, range, displayUnitId) {
  if (!range || range.min === undefined || range.max === undefined) return null;
  const registered = { min: range.min, max: range.max, unitId: range.unit };
  if (!displayUnitId || displayUnitId === range.unit) return { registered, converted: null };
  const min = engine.convertUnitValue(range.min, range.unit, displayUnitId);
  const max = engine.convertUnitValue(range.max, range.unit, displayUnitId);
  if (min.ok !== true || max.ok !== true) return { registered, converted: null };
  return { registered, converted: { min: min.value, max: max.value, unitId: displayUnitId } };
}

/** Presented warning list for one result (engine order preserved). */
export function presentResultWarnings({ engine, adapter, store }, result) {
  if (result.warnings.length === 0) return [];
  const variable = adapter.variablesById[result.variable_id];
  const unitId = store.state.displayUnitByVariableId.get(result.variable_id) ?? variable.default_unit;
  const converted = engine.displayValue(result, unitId);
  const displayedValue = converted.ok === true ? formatSignificant(converted.value, PRECISION.result) : "—";
  const unit = adapter.unitsById[unitId];

  return presentWarnings(result, {
    variable,
    displayedValue,
    displayedUnit: unit ? unit.display_symbol : unitId,
    siValue: result.value_si,
    inputSnapshot: store.state.inputSnapshotByResultId.get(result.result_id) ?? null,
    upstreamRefs: directConsumers(engine, result.result_id),
    confirmed: store.state.confirmedResultIds.has(result.result_id),
    unitSymbolOf: (id) => adapter.unitsById[id]?.display_symbol ?? id,
    rangeDisplays: {
      normal: buildRangeDisplay(engine, variable.normal_range, unitId),
      warning: buildRangeDisplay(engine, variable.warning_range, unitId),
    },
    // Converted bounds are formatted only at this last step (§11.2 precision).
    formatValue: (v) => formatSignificant(v, PRECISION.result),
  });
}

/**
 * "Keep original": records the confirmation under the exact result_id.
 * Zero engine operations; a replacement instance (new result_id) is
 * naturally unconfirmed again.
 */
export function confirmKeepOriginal({ store }, resultId) {
  store.state.confirmedResultIds.add(resultId);
  store.notify();
  return { confirmed: true, resultId };
}

/** Upstream abnormalities of one result, for its own trace section. */
export function upstreamAbnormalities({ engine, store }, result) {
  return collectUpstreamAbnormalities(result, {
    engine,
    confirmedResultIds: store.state.confirmedResultIds,
  });
}
