/**
 * tire_code.mjs — tire-code quick input (§7.12, precheck version).
 *
 * The ONLY accepted shape is width/aspectRrim (e.g. 195/55R16). Any suffix
 * (load index, speed rating, …) rejects the whole string. The mapping is
 * fixed to each variable's default unit:
 *   group 1 -> section_width  @ millimeter
 *   group 2 -> aspect_ratio   @ percent
 *   group 3 -> rim_diameter   @ inch
 *
 * Precheck runs entirely against a SCRATCH engine (never the live one):
 * syntax, positive values, variable existence + can_be_user_input, unit
 * legality, then a sequential dry run of the three setUserInput calls.
 * Writing to the live engine happens only after a full precheck pass, one
 * item at a time; the first live failure stops the remaining writes and the
 * caller must present the already-written items honestly. No rollback is
 * promised: the engine retires/mints instances, propagates stale, and
 * suppresses assumptions — none of that can be unwound to the pre-call
 * runtime state. No side calculations are performed here.
 */

export const TIRE_CODE_SYNTAX = /^\s*(\d{2,3})\s*\/\s*(\d{2})\s*[Rr]\s*(\d{2})\s*$/;

export const TIRE_CODE_HINT = "Enter tire code as width/aspectRrim, e.g. 195/55R16.";

export const TIRE_FIELDS = Object.freeze([
  Object.freeze({ variableId: "section_width", unitId: "millimeter", group: 1 }),
  Object.freeze({ variableId: "aspect_ratio", unitId: "percent", group: 2 }),
  Object.freeze({ variableId: "rim_diameter", unitId: "inch", group: 3 }),
]);

/** Parse the tire-code string. Returns {ok, values} or {ok:false, message}. */
export function parseTireCode(text) {
  const match = TIRE_CODE_SYNTAX.exec(String(text ?? ""));
  if (!match) return { ok: false, message: TIRE_CODE_HINT };
  const values = TIRE_FIELDS.map((field) => ({
    variableId: field.variableId,
    unitId: field.unitId,
    value: Number(match[field.group]),
  }));
  return { ok: true, values };
}

/**
 * Full precheck. `createScratchEngine` must build a throwaway engine (in the
 * browser: createEngine(cachingReadText) — cache hit, zero network).
 * Returns {ok} or {ok:false, stage, message}.
 */
export async function precheckTireCode(parsed, { adapter, createScratchEngine }) {
  if (!parsed.ok) return { ok: false, stage: "syntax", message: parsed.message };

  // User-facing copy uses variable names and unit display symbols; internal
  // ids appear only in developerFallback fields.
  const nameOf = (variableId) => adapter.variablesById?.[variableId]?.name ?? "this tire-code field";
  const unitSymbolOf = (unitId) => adapter.unitsById?.[unitId]?.display_symbol ?? unitId;

  for (const item of parsed.values) {
    if (!(item.value > 0)) {
      return { ok: false, stage: "positive", message: `The ${nameOf(item.variableId)} part of the tire code must be positive.` };
    }
    const variable = adapter.variablesById[item.variableId];
    if (!variable) {
      return {
        ok: false,
        stage: "variable",
        message: "The tire code cannot be applied with the current catalog.",
        developerFallback: `Variable ${item.variableId} is not registered.`,
      };
    }
    if (variable.can_be_user_input !== true) {
      return {
        ok: false,
        stage: "variable",
        message: `${variable.name} does not accept direct input.`,
      };
    }
    if (!variable.allowed_units.includes(item.unitId)) {
      return {
        ok: false,
        stage: "unit",
        message: `The unit ${unitSymbolOf(item.unitId)} is not allowed for ${variable.name}.`,
        developerFallback: `Unit ${item.unitId} is not allowed for ${item.variableId}.`,
      };
    }
  }

  const scratch = await createScratchEngine();
  for (const item of parsed.values) {
    const outcome = scratch.setUserInput(item.variableId, item.value, item.unitId);
    if (outcome.ok !== true) {
      return {
        ok: false,
        stage: "dry_run",
        message: `The tire code cannot be applied: the ${nameOf(item.variableId)} value was rejected.`,
        developerFallback: outcome.diagnostic ? outcome.diagnostic.message : null,
      };
    }
  }
  return { ok: true };
}

/**
 * Write the three values to the LIVE engine, sequentially. Stops at the
 * first failure. Returns:
 *   { ok: true,  applied: [{variableId, unitId, value, result}] }
 *   { ok: false, applied: [...already written...],
 *     failure: {variableId, message} }
 * The caller presents applied items as real writes (the user may remove
 * them manually) and must never claim the engine state is unchanged.
 */
export function applyTireCode(parsed, engine) {
  const applied = [];
  for (const item of parsed.values) {
    const outcome = engine.setUserInput(item.variableId, item.value, item.unitId);
    if (outcome.ok !== true) {
      return {
        ok: false,
        applied,
        failure: {
          variableId: item.variableId,
          message: `The write was rejected at this tire-code field.`,
          developerFallback: outcome.diagnostic ? outcome.diagnostic.message : `setUserInput failed for ${item.variableId}.`,
        },
      };
    }
    applied.push({ variableId: item.variableId, unitId: item.unitId, value: item.value, result: outcome.result });
  }
  return { ok: true, applied, failure: null };
}
