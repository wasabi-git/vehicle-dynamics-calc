/**
 * catalog_adapter.mjs — metadata plan B (D27).
 *
 * The adapter shares the engine's single catalog fetch: `readText` must be
 * the same caching reader handed to `createEngine`, so every path is
 * fetched exactly once. The adapter parses its own copy of the raw JSON
 * text and freezes it recursively; the UI reads catalog metadata only
 * through this frozen copy and never through engine internals.
 */

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function indexBy(rows, idField) {
  const byId = Object.create(null);
  for (const row of rows) byId[row[idField]] = row;
  return byId;
}

export async function buildCatalogAdapter(readText) {
  const meta = JSON.parse(await readText("data/catalog.meta.json"));
  const pathByRole = new Map(meta.files.map((f) => [f.role, f.path]));

  async function parseRole(role) {
    const path = pathByRole.get(role);
    if (!path) throw new Error(`catalog.meta.json does not register role: ${role}`);
    return JSON.parse(await readText(path));
  }

  const [variablesDoc, unitsDoc, formulasDoc, modelsDoc, recommendationsDoc, sourcesDoc, engineConfigDoc] =
    await Promise.all([
      parseRole("variables"),
      parseRole("units"),
      parseRole("formulas"),
      parseRole("models"),
      parseRole("recommendations"),
      parseRole("sources"),
      parseRole("engine_config"),
    ]);

  const adapter = {
    catalogMeta: meta,

    variables: variablesDoc.variables,
    units: unitsDoc.units,
    formulas: formulasDoc.formulas,
    models: modelsDoc.models,
    modelGroups: modelsDoc.model_groups,
    recommendations: recommendationsDoc.recommendations,
    sources: sourcesDoc.sources,
    engineConfig: engineConfigDoc,

    variablesById: indexBy(variablesDoc.variables, "variable_id"),
    unitsById: indexBy(unitsDoc.units, "unit_id"),
    formulasById: indexBy(formulasDoc.formulas, "formula_id"),
    modelsById: indexBy(modelsDoc.models, "model_name"),
    modelGroupsById: indexBy(modelsDoc.model_groups, "model_group"),
    recommendationsById: indexBy(recommendationsDoc.recommendations, "recommendation_id"),
    sourcesById: indexBy(sourcesDoc.sources, "source_id"),
  };

  return deepFreeze(adapter);
}
