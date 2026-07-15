/**
 * loader.mjs — catalog-driven data loading for the v0.1 derivation engine.
 *
 * Loading contract (Part 3 §3.10; engine work-branch M0):
 *   1. Read data/catalog.meta.json first — the only fixed entry path.
 *   2. Every other file is resolved through the catalog's registered roles.
 *      No directory enumeration, no hardcoded versioned file names.
 *   3. Malformed input of any shape must produce structured diagnostics,
 *      never an exception escaping this module.
 *
 * The reader is injected so the same module runs in Node (fs) and in the
 * browser (fetch): `readText(relativePath) -> Promise<string>`.
 */

export const CATALOG_ENTRY_PATH = "data/catalog.meta.json";

/** Data roles the engine consumes. All must be registered in the catalog. */
export const REQUIRED_DATA_ROLES = Object.freeze([
  "variables",
  "formulas",
  "models",
  "recommendations",
  "sources",
  "units",
  "engine_config",
]);

/** Engine capability set for the computability field (v0.1). */
export const SUPPORTED_COMPUTABILITY = Object.freeze(["direct"]);

const COMPARISON_OPERATORS = Object.freeze(["gt", "gte", "lt", "lte", "eq", "neq"]);
const FINITE_OPERATORS = Object.freeze(["finite", "not_finite"]);

/** Identifier extraction for the load-time light check of expressions.
 *  The full parser (expr.mjs) re-validates at execution time. */
const IDENTIFIER_RE = /[A-Za-z_][A-Za-z0-9_]*/g;
const ALLOWED_FUNCTIONS = Object.freeze(["sin"]);

function diagnostic(severity, code, file, path, message) {
  return { severity, code, file, path, message };
}

class Collector {
  constructor() {
    this.items = [];
  }
  error(code, file, path, message) {
    this.items.push(diagnostic("error", code, file, path, message));
  }
  warning(code, file, path, message) {
    this.items.push(diagnostic("warning", code, file, path, message));
  }
  get hasErrors() {
    return this.items.some((d) => d.severity === "error");
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Validate one condition object (comparison / between / finite form).
 * Returns true when structurally usable by the evaluator.
 */
function checkConditionObject(cond, diags, file, path) {
  if (!isPlainObject(cond)) {
    diags.error("condition_not_object", file, path, "Condition must be an object.");
    return false;
  }
  const op = cond.operator;
  if (COMPARISON_OPERATORS.includes(op)) {
    let ok = true;
    if (!isFiniteNumber(cond.value)) {
      diags.error("condition_value_invalid", file, `${path}.value`, `Comparison condition requires a finite numeric value (operator ${op}).`);
      ok = false;
    }
    if (!isNonEmptyString(cond.unit)) {
      diags.error("condition_unit_missing", file, `${path}.unit`, `Comparison condition requires an explicit unit (operator ${op}).`);
      ok = false;
    }
    return ok;
  }
  if (op === "between") {
    let ok = true;
    for (const key of ["min", "max"]) {
      if (!isFiniteNumber(cond[key])) {
        diags.error("condition_value_invalid", file, `${path}.${key}`, `Between condition requires finite numeric ${key}.`);
        ok = false;
      }
    }
    for (const key of ["min_inclusive", "max_inclusive"]) {
      if (typeof cond[key] !== "boolean") {
        diags.error("condition_flag_invalid", file, `${path}.${key}`, `Between condition requires boolean ${key}.`);
        ok = false;
      }
    }
    if (!isNonEmptyString(cond.unit)) {
      diags.error("condition_unit_missing", file, `${path}.unit`, "Between condition requires an explicit unit.");
      ok = false;
    }
    return ok;
  }
  if (FINITE_OPERATORS.includes(op)) {
    return true;
  }
  diags.error("condition_operator_unknown", file, `${path}.operator`, `Unknown condition operator: ${JSON.stringify(op)}.`);
  return false;
}

/**
 * Validate a condition expression under an explicit-wrapper policy.
 * policy: "all" | "any" | "all_or_any" | "single_or_group"
 * Bare condition arrays are never permitted (Part 3 §3.10 十三).
 * Returns a normalized { kind: "all"|"any"|"single", conditions: [...] } or null.
 */
function checkConditionExpression(expr, policy, diags, file, path) {
  if (Array.isArray(expr)) {
    diags.error(
      "bare_condition_array",
      file,
      path,
      "Bare condition arrays are not permitted; wrap conditions in explicit all/any."
    );
    return null;
  }
  if (!isPlainObject(expr)) {
    diags.error("condition_group_not_object", file, path, "Condition expression must be an object.");
    return null;
  }
  const hasAll = Object.prototype.hasOwnProperty.call(expr, "all");
  const hasAny = Object.prototype.hasOwnProperty.call(expr, "any");
  if (hasAll && hasAny) {
    diags.error("condition_group_ambiguous", file, path, "Condition expression must not contain both all and any.");
    return null;
  }
  if (hasAll || hasAny) {
    const kind = hasAll ? "all" : "any";
    if (policy === "all" && kind !== "all") {
      diags.error("condition_semantics_violation", file, path, "This field requires an explicit all group.");
      return null;
    }
    if (policy === "any" && kind !== "any") {
      diags.error("condition_semantics_violation", file, path, "This field requires an explicit any group.");
      return null;
    }
    const group = expr[kind];
    if (!Array.isArray(group)) {
      diags.error("condition_group_not_array", file, `${path}.${kind}`, `${kind} group must be an array of conditions.`);
      return null;
    }
    let ok = true;
    group.forEach((cond, index) => {
      if (!checkConditionObject(cond, diags, file, `${path}.${kind}[${index}]`)) ok = false;
    });
    return ok ? { kind, conditions: group } : null;
  }
  // Single bare condition object — only allowed where policy permits it.
  if (policy === "single_or_group") {
    return checkConditionObject(expr, diags, file, path) ? { kind: "single", conditions: [expr] } : null;
  }
  diags.error(
    "condition_semantics_violation",
    file,
    path,
    policy === "all_or_any"
      ? "This field requires an explicit all or any wrapper."
      : `This field requires an explicit ${policy} wrapper.`
  );
  return null;
}

function checkRangeObject(range, diags, file, path) {
  if (!isPlainObject(range)) {
    diags.error("range_not_object", file, path, "Range must be an object with min, max, and unit.");
    return false;
  }
  let ok = true;
  if (!isFiniteNumber(range.min) || !isFiniteNumber(range.max)) {
    diags.error("range_bounds_invalid", file, path, "Range min and max must be finite numbers.");
    ok = false;
  }
  if (!isNonEmptyString(range.unit)) {
    diags.error("range_unit_missing", file, path, "Range must declare an explicit unit; default_unit is never assumed.");
    ok = false;
  }
  return ok;
}

function extractExpressionIdentifiers(expression) {
  const found = new Set();
  const matches = expression.match(IDENTIFIER_RE);
  if (matches) {
    for (const name of matches) {
      if (!ALLOWED_FUNCTIONS.includes(name)) found.add(name);
    }
  }
  return found;
}

async function readJsonFile(readText, relPath, diags) {
  let text;
  try {
    text = await readText(relPath);
  } catch (cause) {
    diags.error("file_read_failed", relPath, null, `Could not read file: ${cause && cause.message ? cause.message : String(cause)}`);
    return null;
  }
  if (typeof text !== "string") {
    diags.error("file_read_failed", relPath, null, "Reader did not return text.");
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    diags.error("json_parse_failed", relPath, null, `Invalid JSON: ${cause.message}`);
    return null;
  }
}

/** Require `doc[key]` to be an array of plain objects; report and return [] otherwise. */
function requireObjectArray(doc, key, diags, file) {
  if (!isPlainObject(doc)) {
    diags.error("top_level_not_object", file, "$", "Top-level JSON value must be an object.");
    return [];
  }
  const value = doc[key];
  if (!Array.isArray(value)) {
    diags.error("missing_field", file, `$.${key}`, `Expected an array at $.${key}.`);
    return [];
  }
  const rows = [];
  value.forEach((row, index) => {
    if (isPlainObject(row)) {
      rows.push(row);
    } else {
      diags.error("row_not_object", file, `$.${key}[${index}]`, "Entry must be an object.");
    }
  });
  return rows;
}

function indexUnique(rows, idField, diags, file, arrayKey) {
  const map = new Map();
  rows.forEach((row, index) => {
    const id = row[idField];
    if (!isNonEmptyString(id)) {
      diags.error("id_missing", file, `$.${arrayKey}[${index}].${idField}`, `Entry lacks a usable ${idField}.`);
      return;
    }
    if (map.has(id)) {
      diags.error("duplicate_id", file, `$.${arrayKey}[${index}].${idField}`, `Duplicate ${idField}: ${id}`);
      return;
    }
    map.set(id, row);
  });
  return map;
}

/**
 * Resolve a unit's linear scale-to-SI factor, following constant references.
 * Returns a finite number or null (with a diagnostic).
 */
function resolveUnitScale(unitId, units, variables, diags, file, stack = []) {
  if (stack.includes(unitId)) {
    diags.error("unit_conversion_cycle", file, null, `Unit conversion cycle: ${[...stack, unitId].join(" -> ")}`);
    return null;
  }
  const unit = units.get(unitId);
  if (!unit) {
    diags.error("unknown_unit", file, null, `Unknown unit: ${unitId}`);
    return null;
  }
  const conv = unit.si_conversion;
  if (!isPlainObject(conv)) {
    diags.error("unit_conversion_invalid", file, null, `Unit ${unitId} lacks a usable si_conversion object.`);
    return null;
  }
  if (conv.type === "linear") {
    if (!isFiniteNumber(conv.scale) || conv.scale <= 0) {
      diags.error("unit_scale_invalid", file, null, `Unit ${unitId} must have a positive finite linear scale.`);
      return null;
    }
    if (!isFiniteNumber(conv.offset)) {
      diags.error("unit_offset_invalid", file, null, `Unit ${unitId} must have a finite linear offset.`);
      return null;
    }
    return conv.scale;
  }
  if (conv.type === "constant_reference") {
    const variable = variables.get(conv.variable_id);
    if (!variable) {
      diags.error("unknown_reference", file, null, `Unit ${unitId} references unknown constant variable ${conv.variable_id}.`);
      return null;
    }
    if (variable.is_constant !== true || !isFiniteNumber(variable.constant_value_si)) {
      diags.error("unit_constant_invalid", file, null, `Unit ${unitId} must reference a constant variable with a numeric constant_value_si.`);
      return null;
    }
    if (variable.dimension !== unit.dimension) {
      diags.error("dimension_mismatch", file, null, `Unit ${unitId} dimension differs from constant variable ${conv.variable_id}.`);
      return null;
    }
    const innerScale = resolveUnitScale(variable.internal_unit, units, variables, diags, file, [...stack, unitId]);
    if (innerScale === null) return null;
    return variable.constant_value_si * innerScale;
  }
  diags.error("unit_conversion_invalid", file, null, `Unit ${unitId} has unsupported conversion type ${JSON.stringify(conv.type)}.`);
  return null;
}

function checkConditionUnits(normalized, ownerDimension, units, diags, file, path, variables, requiredSet) {
  if (!normalized) return;
  normalized.conditions.forEach((cond, index) => {
    const condPath = normalized.kind === "single" ? path : `${path}.${normalized.kind}[${index}]`;
    let dimension = ownerDimension;
    if (isNonEmptyString(cond.variable)) {
      if (requiredSet && !requiredSet.has(cond.variable)) {
        diags.error("condition_variable_not_input", file, `${condPath}.variable`, `Condition references ${cond.variable}, which is not among required_inputs.`);
      }
      const target = variables ? variables.get(cond.variable) : null;
      if (variables && !target) {
        diags.error("unknown_reference", file, `${condPath}.variable`, `Condition references unknown variable ${cond.variable}.`);
        return;
      }
      if (target) dimension = target.dimension;
    }
    if (isNonEmptyString(cond.unit)) {
      const unit = units.get(cond.unit);
      if (!unit) {
        diags.error("unknown_unit", file, `${condPath}.unit`, `Condition uses unknown unit ${cond.unit}.`);
      } else if (dimension && unit.dimension !== dimension) {
        diags.error("dimension_mismatch", file, `${condPath}.unit`, `Condition unit ${cond.unit} does not match dimension ${dimension}.`);
      }
    }
  });
}

/**
 * Load and structurally validate the whole catalog.
 *
 * @param {(relPath: string) => Promise<string>} readText
 * @returns {Promise<{ok: boolean, data: object|null, diagnostics: object[]}>}
 */
export async function loadCatalog(readText) {
  const diags = new Collector();

  // --- 1. Catalog entry -------------------------------------------------
  const catalog = await readJsonFile(readText, CATALOG_ENTRY_PATH, diags);
  if (catalog === null) {
    return { ok: false, data: null, diagnostics: diags.items };
  }
  if (!isPlainObject(catalog)) {
    diags.error("top_level_not_object", CATALOG_ENTRY_PATH, "$", "Catalog must be a JSON object.");
    return { ok: false, data: null, diagnostics: diags.items };
  }

  const rolePaths = new Map();
  const files = Array.isArray(catalog.files) ? catalog.files : null;
  if (!files) {
    diags.error("missing_field", CATALOG_ENTRY_PATH, "$.files", "Catalog must register its files in a files array.");
    return { ok: false, data: null, diagnostics: diags.items };
  }
  files.forEach((entry, index) => {
    if (!isPlainObject(entry) || !isNonEmptyString(entry.role) || !isNonEmptyString(entry.path)) {
      diags.error("catalog_entry_invalid", CATALOG_ENTRY_PATH, `$.files[${index}]`, "File entry must be an object with role and path.");
      return;
    }
    if (rolePaths.has(entry.role)) {
      diags.error("duplicate_role", CATALOG_ENTRY_PATH, `$.files[${index}].role`, `Role registered twice: ${entry.role}`);
      return;
    }
    rolePaths.set(entry.role, entry.path);
  });

  const missingRoles = REQUIRED_DATA_ROLES.filter((role) => !rolePaths.has(role));
  if (missingRoles.length > 0) {
    diags.error(
      "catalog_missing_role",
      CATALOG_ENTRY_PATH,
      "$.files",
      `Catalog does not register required data roles: ${missingRoles.join(", ")}`
    );
    return { ok: false, data: null, diagnostics: diags.items };
  }

  // --- 2. Role files -----------------------------------------------------
  const paths = Object.fromEntries(REQUIRED_DATA_ROLES.map((role) => [role, rolePaths.get(role)]));
  const docs = {};
  for (const role of REQUIRED_DATA_ROLES) {
    docs[role] = await readJsonFile(readText, paths[role], diags);
  }
  if (Object.values(docs).some((doc) => doc === null)) {
    return { ok: false, data: null, diagnostics: diags.items };
  }

  const variableRows = requireObjectArray(docs.variables, "variables", diags, paths.variables);
  const formulaRows = requireObjectArray(docs.formulas, "formulas", diags, paths.formulas);
  const modelGroupRows = requireObjectArray(docs.models, "model_groups", diags, paths.models);
  const modelRows = requireObjectArray(docs.models, "models", diags, paths.models);
  const recommendationRows = requireObjectArray(docs.recommendations, "recommendations", diags, paths.recommendations);
  const sourceRows = requireObjectArray(docs.sources, "sources", diags, paths.sources);
  const unitRows = requireObjectArray(docs.units, "units", diags, paths.units);
  const engineConfig = isPlainObject(docs.engine_config) ? docs.engine_config : null;
  if (!engineConfig) {
    diags.error("top_level_not_object", paths.engine_config, "$", "engine-config must be a JSON object.");
  }

  const variables = indexUnique(variableRows, "variable_id", diags, paths.variables, "variables");
  const formulas = indexUnique(formulaRows, "formula_id", diags, paths.formulas, "formulas");
  const modelGroups = indexUnique(modelGroupRows, "model_group", diags, paths.models, "model_groups");
  const models = indexUnique(modelRows, "model_name", diags, paths.models, "models");
  const recommendations = indexUnique(recommendationRows, "recommendation_id", diags, paths.recommendations, "recommendations");
  const sources = indexUnique(sourceRows, "source_id", diags, paths.sources, "sources");
  const units = indexUnique(unitRows, "unit_id", diags, paths.units, "units");

  // --- 3. Engine config guardrails ---------------------------------------
  if (engineConfig) {
    if (engineConfig.allow_automatic_algebraic_inversion !== false) {
      diags.error(
        "inversion_must_stay_disabled",
        paths.engine_config,
        "$.allow_automatic_algebraic_inversion",
        "allow_automatic_algebraic_inversion must be false; the engine refuses to load a config that enables it (gate G2)."
      );
    }
    if (engineConfig.internal_unit_system !== "SI") {
      diags.error("engine_config_invalid", paths.engine_config, "$.internal_unit_system", "internal_unit_system must be SI.");
    }
    if (!Number.isInteger(engineConfig.max_reverse_formula_depth) || engineConfig.max_reverse_formula_depth < 1) {
      diags.error("engine_config_invalid", paths.engine_config, "$.max_reverse_formula_depth", "max_reverse_formula_depth must be a positive integer.");
    }
  }

  // --- 4. Units ------------------------------------------------------------
  for (const [unitId, unit] of units) {
    if (!isNonEmptyString(unit.dimension)) {
      diags.error("missing_field", paths.units, `$.units[${unitId}].dimension`, `Unit ${unitId} lacks a dimension.`);
      continue;
    }
    const canonical = units.get(unit.canonical_si_unit);
    if (!canonical) {
      diags.error("unknown_reference", paths.units, `$.units[${unitId}].canonical_si_unit`, `Unit ${unitId} references unknown canonical_si_unit ${unit.canonical_si_unit}.`);
    } else if (canonical.dimension !== unit.dimension) {
      diags.error("dimension_mismatch", paths.units, `$.units[${unitId}].canonical_si_unit`, `Unit ${unitId} dimension does not match canonical unit ${unit.canonical_si_unit}.`);
    }
    resolveUnitScale(unitId, units, variables, diags, paths.units);
  }

  // --- 5. Variables ----------------------------------------------------------
  for (const [variableId, variable] of variables) {
    const vPath = `$.variables[${variableId}]`;
    if (!isNonEmptyString(variable.dimension)) {
      diags.error("missing_field", paths.variables, `${vPath}.dimension`, `Variable ${variableId} lacks a dimension.`);
      continue;
    }
    for (const field of ["internal_unit", "default_unit"]) {
      const unitId = variable[field];
      const unit = isNonEmptyString(unitId) ? units.get(unitId) : null;
      if (!unit) {
        diags.error("unknown_unit", paths.variables, `${vPath}.${field}`, `Variable ${variableId} references unknown ${field} ${JSON.stringify(unitId)}.`);
      } else if (unit.dimension !== variable.dimension) {
        diags.error("dimension_mismatch", paths.variables, `${vPath}.${field}`, `Variable ${variableId} ${field} dimension mismatch.`);
      }
    }
    if (!Array.isArray(variable.allowed_units) || variable.allowed_units.length === 0) {
      diags.error("missing_field", paths.variables, `${vPath}.allowed_units`, `Variable ${variableId} must list allowed_units.`);
    } else {
      for (const unitId of variable.allowed_units) {
        const unit = units.get(unitId);
        if (!unit) {
          diags.error("unknown_unit", paths.variables, `${vPath}.allowed_units`, `Variable ${variableId} allows unknown unit ${JSON.stringify(unitId)}.`);
        } else if (unit.dimension !== variable.dimension) {
          diags.error("dimension_mismatch", paths.variables, `${vPath}.allowed_units`, `Variable ${variableId} allowed unit ${unitId} dimension mismatch.`);
        }
      }
      if (isNonEmptyString(variable.default_unit) && !variable.allowed_units.includes(variable.default_unit)) {
        diags.error("default_unit_not_allowed", paths.variables, `${vPath}.default_unit`, `Variable ${variableId} default_unit is not in allowed_units.`);
      }
    }

    for (const rangeName of ["normal_range", "warning_range"]) {
      if (checkRangeObject(variable[rangeName], diags, paths.variables, `${vPath}.${rangeName}`)) {
        const unit = units.get(variable[rangeName].unit);
        if (!unit) {
          diags.error("unknown_unit", paths.variables, `${vPath}.${rangeName}.unit`, `Variable ${variableId} ${rangeName} uses unknown unit ${variable[rangeName].unit}.`);
        } else if (unit.dimension !== variable.dimension) {
          diags.error("dimension_mismatch", paths.variables, `${vPath}.${rangeName}.unit`, `Variable ${variableId} ${rangeName} unit dimension mismatch.`);
        }
      }
    }

    const invalidRange = checkConditionExpression(variable.invalid_range, "any", diags, paths.variables, `${vPath}.invalid_range`);
    checkConditionUnits(invalidRange, variable.dimension, units, diags, paths.variables, `${vPath}.invalid_range`, null, null);
    const validDomain = checkConditionExpression(variable.valid_domain, "single_or_group", diags, paths.variables, `${vPath}.valid_domain`);
    checkConditionUnits(validDomain, variable.dimension, units, diags, paths.variables, `${vPath}.valid_domain`, null, null);

    if (variable.can_be_assumed === true) {
      const assumption = variable.default_assumption;
      if (!isPlainObject(assumption)) {
        diags.error("assumption_invalid", paths.variables, `${vPath}.default_assumption`, `Variable ${variableId} can_be_assumed but lacks a default_assumption object.`);
      } else {
        if (!isFiniteNumber(assumption.value)) {
          diags.error("assumption_invalid", paths.variables, `${vPath}.default_assumption.value`, `Variable ${variableId} default_assumption value must be numeric.`);
        }
        const unit = units.get(assumption.unit);
        if (!unit) {
          diags.error("unknown_unit", paths.variables, `${vPath}.default_assumption.unit`, `Variable ${variableId} default_assumption uses unknown unit ${JSON.stringify(assumption.unit)}.`);
        } else if (unit.dimension !== variable.dimension) {
          diags.error("dimension_mismatch", paths.variables, `${vPath}.default_assumption.unit`, `Variable ${variableId} default_assumption unit dimension mismatch.`);
        }
      }
    }
    if (variable.is_constant === true) {
      if (!isFiniteNumber(variable.constant_value_si)) {
        diags.error("constant_invalid", paths.variables, `${vPath}.constant_value_si`, `Constant variable ${variableId} must carry a numeric constant_value_si.`);
      }
      if (variable.can_be_user_input !== false) {
        diags.error("constant_invalid", paths.variables, `${vPath}.can_be_user_input`, `Constant variable ${variableId} must not allow user input.`);
      }
    }
  }

  // --- 6. Models -----------------------------------------------------------
  for (const [modelName, model] of models) {
    if (!modelGroups.has(model.model_group)) {
      diags.error("unknown_reference", paths.models, `$.models[${modelName}].model_group`, `Model ${modelName} references unknown model_group ${JSON.stringify(model.model_group)}.`);
    }
  }

  // --- 7. Formulas ------------------------------------------------------------
  for (const [formulaId, formula] of formulas) {
    const fPath = `$.formulas[${formulaId}]`;

    const requiredInputs = Array.isArray(formula.required_inputs) ? formula.required_inputs.filter(isNonEmptyString) : null;
    if (!requiredInputs) {
      diags.error("missing_field", paths.formulas, `${fPath}.required_inputs`, `Formula ${formulaId} lacks a required_inputs array.`);
    }
    const requiredSet = new Set(requiredInputs || []);
    for (const inputId of requiredSet) {
      if (!variables.has(inputId)) {
        diags.error("unknown_reference", paths.formulas, `${fPath}.required_inputs`, `Formula ${formulaId} references unknown input ${inputId}.`);
      }
    }

    if (!isNonEmptyString(formula.output)) {
      diags.error("missing_field", paths.formulas, `${fPath}.output`, `Formula ${formulaId} must declare a single string output.`);
    } else if (!variables.has(formula.output)) {
      diags.error("unknown_reference", paths.formulas, `${fPath}.output`, `Formula ${formulaId} references unknown output ${formula.output}.`);
    }

    const model = models.get(formula.model_name);
    if (!model) {
      diags.error("unknown_reference", paths.formulas, `${fPath}.model_name`, `Formula ${formulaId} references unknown model_name ${JSON.stringify(formula.model_name)}.`);
    } else if (model.model_group !== formula.model_group) {
      diags.error("model_group_mismatch", paths.formulas, `${fPath}.model_group`, `Formula ${formulaId} model_name is registered under another group.`);
    }
    if (!modelGroups.has(formula.model_group)) {
      diags.error("unknown_reference", paths.formulas, `${fPath}.model_group`, `Formula ${formulaId} references unknown model_group ${JSON.stringify(formula.model_group)}.`);
    }

    if (Array.isArray(formula.source_reference)) {
      formula.source_reference.forEach((ref, index) => {
        if (!isPlainObject(ref) || !isNonEmptyString(ref.source_id)) {
          diags.error("source_reference_invalid", paths.formulas, `${fPath}.source_reference[${index}]`, `Formula ${formulaId} has a malformed source reference.`);
        } else if (!sources.has(ref.source_id)) {
          diags.error("unknown_reference", paths.formulas, `${fPath}.source_reference[${index}]`, `Formula ${formulaId} references unknown source ${ref.source_id}.`);
        }
      });
    }

    const allowedAssumptions = Array.isArray(formula.allowed_assumption_inputs) ? formula.allowed_assumption_inputs : [];
    for (const inputId of allowedAssumptions) {
      if (!requiredSet.has(inputId)) {
        diags.error("assumption_not_input", paths.formulas, `${fPath}.allowed_assumption_inputs`, `Formula ${formulaId} allows an assumption for ${inputId}, which is not a required input.`);
      }
      const variable = variables.get(inputId);
      if (variable && variable.can_be_assumed !== true) {
        diags.error("assumption_not_permitted", paths.formulas, `${fPath}.allowed_assumption_inputs`, `Formula ${formulaId} allows an assumption for non-assumable ${inputId}.`);
      }
    }

    if (!isNonEmptyString(formula.calculation_expression)) {
      diags.error("missing_field", paths.formulas, `${fPath}.calculation_expression`, `Formula ${formulaId} lacks a calculation_expression.`);
    } else {
      const identifiers = extractExpressionIdentifiers(formula.calculation_expression);
      const unknown = [...identifiers].filter((name) => !requiredSet.has(name)).sort();
      if (unknown.length > 0) {
        diags.error("expression_identifier_unknown", paths.formulas, `${fPath}.calculation_expression`, `Formula ${formulaId} expression uses identifiers outside required_inputs: ${unknown.join(", ")}.`);
      }
    }

    if (!isNonEmptyString(formula.computability)) {
      diags.error("missing_field", paths.formulas, `${fPath}.computability`, `Formula ${formulaId} lacks a computability field.`);
    }

    // formula_constraints: explicit all only (v0.1 forbids OR-form constraints).
    const constraints = checkConditionExpression(formula.formula_constraints, "all", diags, paths.formulas, `${fPath}.formula_constraints`);
    checkConditionUnits(constraints, null, units, diags, paths.formulas, `${fPath}.formula_constraints`, variables, requiredSet);
    if (constraints) {
      constraints.conditions.forEach((cond, index) => {
        if (!isNonEmptyString(cond.variable)) {
          diags.error("condition_variable_missing", paths.formulas, `${fPath}.formula_constraints.all[${index}]`, `Formula ${formulaId} constraint must name a required-input variable.`);
        }
      });
    }

    // applicability_conditions.machine: explicit all or any.
    const applicability = formula.applicability_conditions;
    if (!isPlainObject(applicability)) {
      diags.error("missing_field", paths.formulas, `${fPath}.applicability_conditions`, `Formula ${formulaId} lacks an applicability_conditions object.`);
    } else {
      const machine = checkConditionExpression(applicability.machine, "all_or_any", diags, paths.formulas, `${fPath}.applicability_conditions.machine`);
      checkConditionUnits(machine, null, units, diags, paths.formulas, `${fPath}.applicability_conditions.machine`, variables, requiredSet);
    }

    // risk_warnings: optional warn-when-satisfied entries. Each entry carries a
    // single condition that must name a required-input variable; comparison and
    // between operators need a registered, dimension-consistent unit, while
    // finite/not_finite carry no unit. Mirrored by tools/validate_catalog.py.
    if (formula.risk_warnings !== undefined) {
      if (!Array.isArray(formula.risk_warnings)) {
        diags.error("risk_warnings_not_array", paths.formulas, `${fPath}.risk_warnings`, `Formula ${formulaId} risk_warnings must be an array.`);
      } else {
        formula.risk_warnings.forEach((entry, index) => {
          const ePath = `${fPath}.risk_warnings[${index}]`;
          if (!isPlainObject(entry)) {
            diags.error("risk_warning_not_object", paths.formulas, ePath, `Formula ${formulaId} risk_warnings entry must be an object.`);
            return;
          }
          if (checkConditionObject(entry.condition, diags, paths.formulas, `${ePath}.condition`)) {
            if (!isNonEmptyString(entry.condition.variable)) {
              diags.error("condition_variable_missing", paths.formulas, `${ePath}.condition.variable`, `Formula ${formulaId} risk warning condition must name a required-input variable.`);
            }
            checkConditionUnits({ kind: "single", conditions: [entry.condition] }, null, units, diags, paths.formulas, `${ePath}.condition`, variables, requiredSet);
          }
          if (!isNonEmptyString(entry.code) || !/^[a-z][a-z0-9_]*$/.test(entry.code)) {
            diags.error("risk_warning_code_invalid", paths.formulas, `${ePath}.code`, `Formula ${formulaId} risk warning code must match ^[a-z][a-z0-9_]*$.`);
          }
          if (!isNonEmptyString(entry.message)) {
            diags.error("risk_warning_message_invalid", paths.formulas, `${ePath}.message`, `Formula ${formulaId} risk warning message must be a non-empty string.`);
          }
        });
      }
    }

    // expression_unit_mode routing metadata.
    if (formula.expression_unit_mode === "source_native") {
      const su = formula.substitution_units;
      if (!isPlainObject(su)) {
        diags.error("substitution_units_missing", paths.formulas, `${fPath}.substitution_units`, `Source-native formula ${formulaId} lacks substitution_units.`);
      } else {
        const keys = new Set(Object.keys(su));
        const sameSize = keys.size === requiredSet.size;
        if (!sameSize || ![...requiredSet].every((k) => keys.has(k))) {
          diags.error("substitution_units_incomplete", paths.formulas, `${fPath}.substitution_units`, `Source-native formula ${formulaId} substitution_units must cover exactly required_inputs.`);
        }
        for (const [inputId, unitId] of Object.entries(su)) {
          const unit = units.get(unitId);
          const variable = variables.get(inputId);
          if (!unit) {
            diags.error("unknown_unit", paths.formulas, `${fPath}.substitution_units.${inputId}`, `Formula ${formulaId} substitution unit ${JSON.stringify(unitId)} is not registered.`);
          } else if (variable && unit.dimension !== variable.dimension) {
            diags.error("dimension_mismatch", paths.formulas, `${fPath}.substitution_units.${inputId}`, `Formula ${formulaId} substitution unit dimension mismatch for ${inputId}.`);
          }
        }
      }
      const nativeOut = formula.native_output_unit;
      const outUnit = isNonEmptyString(nativeOut) ? units.get(nativeOut) : null;
      const outVariable = variables.get(formula.output);
      if (!outUnit) {
        diags.error("native_output_unit_invalid", paths.formulas, `${fPath}.native_output_unit`, `Source-native formula ${formulaId} lacks a registered native_output_unit.`);
      } else if (outVariable && outUnit.dimension !== outVariable.dimension) {
        diags.error("dimension_mismatch", paths.formulas, `${fPath}.native_output_unit`, `Formula ${formulaId} native_output_unit dimension mismatch.`);
      }
    } else if (formula.expression_unit_mode === "si_consistent") {
      if (formula.substitution_units !== undefined || formula.native_output_unit !== undefined) {
        diags.error("si_formula_declares_native_units", paths.formulas, `${fPath}`, `SI-consistent formula ${formulaId} must not declare source-native units.`);
      }
    } else {
      diags.error("expression_unit_mode_invalid", paths.formulas, `${fPath}.expression_unit_mode`, `Formula ${formulaId} has unknown expression_unit_mode ${JSON.stringify(formula.expression_unit_mode)}.`);
    }
  }

  // --- 8. Recommendations ------------------------------------------------------
  for (const [recId, rec] of recommendations) {
    const rPath = `$.recommendations[${recId}]`;
    if (!variables.has(rec.output)) {
      diags.error("unknown_reference", paths.recommendations, `${rPath}.output`, `Recommendation ${recId} references unknown output ${JSON.stringify(rec.output)}.`);
    }
    const model = models.get(rec.recommended_model_name);
    if (!model) {
      diags.error("unknown_reference", paths.recommendations, `${rPath}.recommended_model_name`, `Recommendation ${recId} references unknown model ${JSON.stringify(rec.recommended_model_name)}.`);
    } else if (model.model_group !== rec.model_group) {
      diags.error("model_group_mismatch", paths.recommendations, `${rPath}.model_group`, `Recommendation ${recId} model/group mismatch.`);
    }
    const applicabilityRef = rec.applicability_reference;
    if (!isPlainObject(applicabilityRef) || !isNonEmptyString(applicabilityRef.formula_id)) {
      diags.error("recommendation_reference_invalid", paths.recommendations, `${rPath}.applicability_reference`, `Recommendation ${recId} lacks a usable applicability_reference.`);
    } else {
      const formula = formulas.get(applicabilityRef.formula_id);
      if (!formula) {
        diags.error("unknown_reference", paths.recommendations, `${rPath}.applicability_reference.formula_id`, `Recommendation ${recId} references unknown formula ${applicabilityRef.formula_id}.`);
      } else {
        if (formula.output !== rec.output) {
          diags.error("recommendation_mismatch", paths.recommendations, `${rPath}`, `Recommendation ${recId} formula/output mismatch.`);
        }
        if (formula.model_name !== rec.recommended_model_name) {
          diags.error("recommendation_mismatch", paths.recommendations, `${rPath}`, `Recommendation ${recId} formula/model mismatch.`);
        }
      }
    }
    const fallback = rec.fallback_behavior;
    if (isPlainObject(fallback) && Array.isArray(fallback.alternative_models)) {
      for (const alternative of fallback.alternative_models) {
        if (!models.has(alternative)) {
          diags.error("unknown_reference", paths.recommendations, `${rPath}.fallback_behavior.alternative_models`, `Recommendation ${recId} references unknown alternative model ${JSON.stringify(alternative)}.`);
        }
      }
    }
  }

  const data = {
    catalog,
    paths,
    engineConfig,
    variables,
    formulas,
    models,
    modelGroups,
    recommendations,
    sources,
    units,
  };
  return { ok: !diags.hasErrors, data: diags.hasErrors ? null : data, diagnostics: diags.items };
}
