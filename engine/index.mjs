/**
 * index.mjs — public engine API (v0.1).
 *
 * const { ok, engine, diagnostics } = await createEngine(readText);
 *   engine.setUserInput(variableId, value, unitId)
 *   engine.removeUserInput(variableId)
 *   engine.setAssumptionEnabled(variableId, enabled)
 *   engine.restoreAssumption(variableId)     // explicit restore after displacement
 *   engine.solve()
 *   engine.selectModel(outputVariableId, modelName | null)
 *   engine.queryTarget(variableId)          // reverse query, no inversion
 *   engine.getResults(variableId?) / engine.getActive(variableId)
 *   engine.getByResultId(resultId)           // live or retired instance
 *   engine.getFormulaStatus(formulaId)
 *   engine.getRecommendationStates()
 *   engine.displayValue(result, unitId)      // layer-2 conversion, on demand
 *   engine.convertUnitValue(value, fromUnitId, toUnitId)
 *                                            // layer-1 bare-value conversion,
 *                                            // pure read-only (C9R3a)
 *
 * All stored values are SI; display conversion never enters the pool.
 */

import { loadCatalog } from "./loader.mjs";
import { createUnitSystem } from "./units.mjs";
import { createPool } from "./result.mjs";
import { createSolver } from "./derive.mjs";
import { createReverseQuery } from "./reverse.mjs";

export { loadCatalog } from "./loader.mjs";

export function createEngineFromData(data) {
  const unitSystem = createUnitSystem(data);
  const pool = createPool(data, unitSystem);
  const solver = createSolver(data, unitSystem, pool);
  const reverse = createReverseQuery(data, pool, solver);

  return {
    data,
    unitSystem,
    pool,

    setUserInput: (variableId, value, unitId) => pool.setUserInput(variableId, value, unitId),
    removeUserInput: (variableId) => pool.removeUserInput(variableId),
    setAssumptionEnabled: (variableId, enabled) => pool.setAssumptionEnabled(variableId, enabled),
    restoreAssumption: (variableId) => pool.restoreAssumption(variableId),

    solve: () => solver.solve(),
    selectModel: (output, modelName) => solver.selectModel(output, modelName),
    queryTarget: (variableId) => reverse.queryTarget(variableId),

    getResults: (variableId) => (variableId === undefined ? pool.allInstances() : pool.instances(variableId)),
    getActive: (variableId) => pool.active(variableId),
    getByResultId: (resultId) => pool.getByResultId(resultId),
    getFormulaStatus: (formulaId) => solver.getFormulaStatus(formulaId),
    getRecommendationStates: () => solver.getRecommendationStates(),

    displayValue: (result, unitId) => unitSystem.variableOutputFromSI(result.variable_id, result.value_si, unitId),

    // Pure read-only bare-value conversion between two REGISTERED units of
    // the same dimension (owner-approved C9R3a: the UI presents metadata
    // range bounds in the current display unit). Pure delegation to the
    // layer-1 converter: never touches the pool, mints no Result, marks
    // nothing stale, and does not expose the unit system itself.
    convertUnitValue: (value, fromUnitId, toUnitId) => unitSystem.convert(value, fromUnitId, toUnitId),
  };
}

export async function createEngine(readText) {
  const loaded = await loadCatalog(readText);
  if (!loaded.ok) return { ok: false, engine: null, diagnostics: loaded.diagnostics };
  return { ok: true, engine: createEngineFromData(loaded.data), diagnostics: loaded.diagnostics };
}
