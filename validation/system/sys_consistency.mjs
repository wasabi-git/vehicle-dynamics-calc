/**
 * sys_consistency.mjs — §7.2 consistency audit.
 *
 * Frozen literal count baselines, three-way reconciliation (data files <->
 * validation report <-> README summary block), catalog.meta.json checked
 * against its real content, report semantic fields, and data invariants.
 * Read-only: parses repository files and queries HEAD blobs; no engine
 * mutation, no writes.
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readText } from "./harness.mjs";

export const name = "sys_consistency: counts, registry, and invariants (§7.2)";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function blobExists(path) {
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${path}`], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

/** Parse the README "Current validation summary" text block into {label: number}. */
function parseReadmeSummary(readme) {
  const afterHeading = readme.split("Current validation summary:")[1] ?? "";
  const block = afterHeading.split("```")[1] ?? "";
  const summary = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z -]*?):\s+(\d+)$/);
    if (match) summary[match[1]] = Number(match[2]);
  }
  return summary;
}

export async function run(t) {
  const variables = JSON.parse(await readText("data/variables.v0.1.json"));
  const formulas = JSON.parse(await readText("data/formulas.v0.1.json"));
  const models = JSON.parse(await readText("data/models.v0.1.json"));
  const recommendations = JSON.parse(await readText("data/recommendations.v0.1.json"));
  const sources = JSON.parse(await readText("data/sources.v0.1.json"));
  const units = JSON.parse(await readText("data/units.v0.1.json"));
  const engineConfig = JSON.parse(await readText("data/engine-config.v0.1.json"));
  const meta = JSON.parse(await readText("data/catalog.meta.json"));
  const report = JSON.parse(await readText("validation/validation-report.v0.1.json"));
  const readme = await readText("README.md");

  t.section("frozen literal baselines: data arrays");
  t.ok("variables array holds exactly 20", variables.variables.length === 20);
  t.ok("formulas array holds exactly 8", formulas.formulas.length === 8);
  t.ok("model groups array holds exactly 3", models.model_groups.length === 3);
  t.ok("models array holds exactly 8", models.models.length === 8);
  t.ok("recommendations array holds exactly 1", recommendations.recommendations.length === 1);
  t.ok("sources array holds exactly 3", sources.sources.length === 3);
  t.ok("units array holds exactly 27", units.units.length === 27);

  t.section("frozen literal baselines: report graph counts and engine config");
  t.ok("report dependency_nodes is exactly 28", report.counts.dependency_nodes === 28);
  t.ok("report dependency_edges is exactly 34", report.counts.dependency_edges === 34);
  t.ok("report maximum_formula_depth is exactly 3", report.counts.maximum_formula_depth === 3);
  t.ok("graph section repeats the same depth", report.graph_validation.maximum_formula_depth === 3);
  t.ok("engine-config max_reverse_formula_depth is exactly 5", engineConfig.max_reverse_formula_depth === 5);
  t.ok("report records the same configured reverse depth limit",
    report.graph_validation.configured_reverse_depth_limit === 5);

  t.section("three-way reconciliation: data <-> report <-> README");
  const summary = parseReadmeSummary(readme);
  const registryRows = [
    ["Variables", variables.variables.length, report.counts.variables],
    ["Formulas", formulas.formulas.length, report.counts.formulas],
    ["Model groups", models.model_groups.length, report.counts.model_groups],
    ["Models", models.models.length, report.counts.models],
    ["Recommendations", recommendations.recommendations.length, report.counts.recommendations],
    ["Sources", sources.sources.length, report.counts.sources],
    ["Units", units.units.length, report.counts.units],
  ];
  for (const [label, dataCount, reportCount] of registryRows) {
    t.ok(`${label}: data array, report count, and README row agree`,
      dataCount === reportCount && summary[label] === reportCount);
  }
  t.ok("Dependency nodes: report and README agree",
    summary["Dependency nodes"] === report.counts.dependency_nodes);
  t.ok("Dependency edges: report and README agree",
    summary["Dependency edges"] === report.counts.dependency_edges);
  t.ok("Maximum formula depth: report and README agree",
    summary["Maximum formula depth"] === report.counts.maximum_formula_depth);
  t.ok("Reverse-search limit: README and engine-config agree",
    summary["Reverse-search limit"] === engineConfig.max_reverse_formula_depth);

  t.section("catalog.meta.json against its real content");
  const paths = meta.files.map((f) => f.path);
  t.ok("every registered file path exists as a HEAD blob", paths.every(blobExists));
  t.ok("the registry carries no duplicate path", new Set(paths).size === paths.length);
  const versioned = [variables, formulas, models, recommendations, sources, units, engineConfig, report];
  t.ok("schema_version and data_version are uniform across meta, data files, and report",
    versioned.every((j) => j.schema_version === meta.schema_version && j.data_version === meta.data_version));
  const requiredRegistered = [
    "docs/generated/VARIABLES.generated.md",
    "docs/generated/FORMULAS.generated.md",
    "docs/generated/MODELS.generated.md",
    "docs/generated/DEPENDENCIES.generated.md",
    "validation/validation-report.v0.1.json",
  ];
  t.ok("the four generated docs and the validation report are registered",
    requiredRegistered.every((p) => paths.includes(p)));

  t.section("report semantic fields");
  t.ok("overall_status is pass_with_warnings", report.overall_status === "pass_with_warnings");
  t.ok("warnings hold exactly one entry, verbatim the standing F005 sentence",
    report.warnings.length === 1 &&
    report.warnings[0] ===
      "F005 is an empirical mass-factor approximation with no source error bound (accepted v0.1 limitation).");

  t.section("data invariants");
  const gravity = variables.variables.find((v) => v.variable_id === "gravity");
  t.ok("gravity is the catalog constant and carries 9.80665 in variables",
    gravity.is_constant === true && gravity.constant_value_si === 9.80665);
  const standardGravity = units.units.find((u) => u.unit_id === "standard_gravity");
  t.ok("standard_gravity converts through a constant_reference pointing at gravity",
    standardGravity.si_conversion.type === "constant_reference" &&
    standardGravity.si_conversion.variable_id === "gravity");
  t.ok("automatic algebraic inversion stays disabled",
    engineConfig.allow_automatic_algebraic_inversion === false);
}
