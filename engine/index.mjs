/**
 * index.mjs — public engine API (v0.1).
 *
 * const { ok, engine, diagnostics } = await createEngine(readText);
 *   engine.setUserInput(variableId, value, unitId)
 *   engine.removeUserInput(variableId)
 *   engine.setAssumptionEnabled(variableId, enabled)
 *   engine.solve()
 *   engine.selectModel(outputVariableId, modelName | null)
 *   engine.getResults(variableId?) / engine.getActive(variableId)
 *   engine.getFormulaStatus(formulaId)
 *   engine.getRecommendationStates()
 *   engine.displayValue(result, unitId)      // layer-2 conversion, on demand
 *
 * All stored values are SI; display conversion never enters the pool.
 */

import { loadCatalog } from "./loader.mjs";
import { createUnitSystem } from "./units.mjs";
import { createPool } from "./result.mjs";
import { createSolver } from "./derive.mjs";

export { loadCatalog } from "./loader.mjs";

export function createEngineFromData(data) {
  const unitSystem = createUnitSystem(data);
  const pool = createPool(data, unitSystem);
  const solver = createSolver(data, unitSystem, pool);

  return {
    data,
    unitSystem,
    pool,

    setUserInput: (variableId, value, unitId) => pool.setUserInput(variableId, value, unitId),
    removeUserInput: (variableId) => pool.removeUserInput(variableId),
    setAssumptionEnabled: (variableId, enabled) => pool.setAssumptionEnabled(variableId, enabled),

    solve: () => solver.solve(),
    selectModel: (output, modelName) => solver.selectModel(output, modelName),

    getResults: (variableId) => (variableId === undefined ? pool.allInstances() : pool.instances(variableId)),
    getActive: (variableId) => pool.active(variableId),
    getFormulaStatus: (formulaId) => solver.getFormulaStatus(formulaId),
    getRecommendationStates: () => solver.getRecommendationStates(),

    displayValue: (result, unitId) => unitSystem.variableOutputFromSI(result.variable_id, result.value_si, unitId),
  };
}

export async function createEngine(readText) {
  const loaded = await loadCatalog(readText);
  if (!loaded.ok) return { ok: false, engine: null, diagnostics: loaded.diagnostics };
  return { ok: true, engine: createEngineFromData(loaded.data), diagnostics: loaded.diagnostics };
}
