/**
 * acceptance.mjs — one-shot acceptance runner (M3 minimal scan, extended in
 * M6 to the full suite semantics).
 *
 * Consumes validation/acceptance/cases.v0.1.json directly:
 *   numeric cases      — every expected value judged; each run is one
 *                        independent solve (global inputs + run additions);
 *                        relative tolerance from tolerance_default (1%);
 *                        subset semantics (extra derived values never fail);
 *   behavior case (A5) — two judged assertions: reachability outcomes of the
 *                        queries, and diagnostics_minimum missing-input
 *                        subsets (listing more missing inputs is not a
 *                        failure);
 *   stored_not_judged (A7) — "stored, not judged" means the result MUST be
 *                        produced and stored, while its magnitude is not
 *                        judged (low-speed threshold policy pending, work
 *                        branch 5). The storage contract is enforced: a
 *                        derived, finite, auditable result must exist for
 *                        every query — for A7 specifically an F008-derived
 *                        longitudinal_acceleration with active=false (R001:
 *                        no auto-activation). A missing result fails the
 *                        gate.
 *
 * Standalone:  node engine/tests/acceptance.mjs
 */

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../loader.mjs";
import { createEngineFromData } from "../index.mjs";
import { resolveUnitNotation } from "./notation.mjs";
import { repoReader, REPO_ROOT } from "./node_reader.mjs";

function runLabel(caseId, run) {
  return run.id === "single" ? caseId : `${caseId}-${run.id}`;
}

function applyInputs(engine, data, c, run) {
  for (const input of [...(c.global_inputs || []), ...(run.inputs || [])]) {
    const unitId = resolveUnitNotation(input.unit, data.units);
    if (unitId === null) return `${input.variable_id}: unit token ${input.unit} unresolved`;
    const r = engine.setUserInput(input.variable_id, input.value, unitId);
    if (!r.ok) return `${input.variable_id}: ${r.diagnostic.message}`;
  }
  const solved = engine.solve();
  if (!solved.ok) return solved.diagnostics.map((d) => d.message).join("; ");
  return null;
}

function judgeNumericRun(engine, data, run, label, tolerance, items) {
  for (const expected of run.expected || []) {
    const item = {
      label,
      variable_id: expected.variable_id,
      unit: expected.unit,
      expected: expected.value,
      got: null,
      deviation: null,
      pass: false,
      note: null,
    };
    const unitId = resolveUnitNotation(expected.unit, data.units);
    let best = null;
    for (const instance of engine.getResults(expected.variable_id)) {
      const display = engine.displayValue(instance, unitId);
      if (!display.ok) continue;
      const deviation = Math.abs(display.value - expected.value) / Math.abs(expected.value);
      if (best === null || deviation < best.deviation) {
        best = { got: display.value, deviation, source: instance.source, formula_id: instance.formula_id };
      }
    }
    if (best === null) {
      item.note = "no pool instance for this variable";
    } else {
      item.got = best.got;
      item.deviation = best.deviation;
      item.pass = best.deviation <= tolerance;
      item.note = best.formula_id ?? best.source;
    }
    items.push(item);
  }
}

function judgeBehaviorRun(engine, run, label, items) {
  const expected = run.expected_behavior;
  const queryResults = new Map();

  // Judged item 1: reachability outcomes of every query.
  const outcomeDetails = [];
  let outcomesPass = true;
  for (const target of run.queries || []) {
    const q = engine.queryTarget(target);
    queryResults.set(target, q);
    const okOutcome = q.outcome === expected.outcome;
    if (!okOutcome) outcomesPass = false;
    outcomeDetails.push(`${target} -> ${q.outcome}${okOutcome ? "" : ` (expected ${expected.outcome})`}`);
  }
  items.push({
    label,
    name: "reachability outcomes",
    pass: outcomesPass,
    detail: outcomeDetails.join("; "),
  });

  // Judged item 2: diagnostics_minimum missing-input subsets.
  const minDetails = [];
  let minimumPass = true;
  for (const entry of expected.diagnostics_minimum || []) {
    let found = null;
    for (const q of queryResults.values()) {
      for (const c of q.candidate_paths) {
        if (c.formula_id.startsWith(entry.formula)) found = c;
      }
    }
    if (!found) {
      minimumPass = false;
      minDetails.push(`${entry.formula}: candidate path not returned`);
      continue;
    }
    const missing = found.missing_inputs.map((m) => m.variable_id);
    const absent = entry.missing.filter((v) => !missing.includes(v));
    if (absent.length > 0) minimumPass = false;
    minDetails.push(
      `${entry.formula} missing >= [${entry.missing.join(", ")}]: ` +
      (absent.length === 0 ? `ok (reported: ${missing.join(", ")})` : `NOT LISTED: ${absent.join(", ")}`)
    );
  }
  items.push({
    label,
    name: "diagnostics_minimum subsets",
    pass: minimumPass,
    detail: minDetails.join(" | "),
  });
}

/**
 * Enforce the stored-not-judged storage contract for one run. Exported for
 * the gate's negative regression tests. Judged checks (no magnitude
 * judgment anywhere):
 *   - at least one derived result exists per query (missing -> FAIL);
 *   - every stored result is finite and auditable (frozen result_id,
 *     resolvable via getByResultId);
 *   - A7 specifically: the stored result is F008-derived
 *     longitudinal_acceleration and is not Active (per R001, the comparison
 *     model never auto-activates).
 */
export function judgeStoredRun(engine, run, label, items) {
  for (const target of run.queries || []) {
    const derived = engine.getResults(target).filter((r) => r.source === "derived");
    const item = { label, target, pass: false, detail: null };
    if (derived.length === 0) {
      item.detail = "storage contract violated: no derived result was produced and stored";
      items.push(item);
      continue;
    }
    const problems = [];
    for (const instance of derived) {
      if (!Number.isFinite(instance.value_si)) problems.push(`${instance.formula_id}: value not finite`);
      if (typeof instance.result_id !== "string") problems.push(`${instance.formula_id}: no auditable result_id`);
      else if (engine.getByResultId(instance.result_id) !== instance) problems.push(`${instance.formula_id}: not resolvable by result_id`);
    }
    if (label.startsWith("A7")) {
      const f008 = derived.find((r) => r.formula_id === "F008_ideal_power_acceleration_si");
      if (!f008) {
        problems.push("A7 contract: no F008-derived instance stored");
      } else {
        if (f008.variable_id !== "longitudinal_acceleration") problems.push("A7 contract: stored target is not longitudinal_acceleration");
        if (f008.active !== false) problems.push("A7 contract: F008 result must not be Active without explicit selection (R001)");
      }
    }
    item.pass = problems.length === 0;
    item.detail = item.pass
      ? derived
          .map((r) => `${target} = ${r.value_si.toFixed(5)} ${r.internal_unit} (${r.formula_id}, active=${r.active}, ${r.result_id})`)
          .join("; ") + " - stored and verified, magnitude not judged (low-speed threshold policy pending, work branch 5)"
      : problems.join("; ");
    items.push(item);
  }
}

/**
 * Execute the full acceptance scan.
 * Returns { numeric, behavior, stored, lines, failed }.
 */
export async function runAcceptance() {
  const loaded = await loadCatalog(repoReader());
  if (!loaded.ok) {
    throw new Error("catalog failed to load: " + JSON.stringify(loaded.diagnostics));
  }
  const data = loaded.data;
  const suite = JSON.parse(
    await readFile(join(REPO_ROOT, "validation/acceptance/cases.v0.1.json"), "utf8")
  );
  const tolerance = suite.tolerance_default.value;

  const numericItems = [];
  const behaviorItems = [];
  const storedItems = [];

  for (const c of suite.cases) {
    for (const run of c.runs) {
      const label = runLabel(c.id, run);
      const engine = createEngineFromData(data);
      const setupFailure = applyInputs(engine, data, c, run);
      if (setupFailure !== null) {
        const item = { label, pass: false, note: `run setup failed: ${setupFailure}` };
        if (c.type === "numeric") numericItems.push({ ...item, variable_id: "-", unit: "-", expected: NaN, got: null, deviation: null });
        else if (c.type === "behavior") behaviorItems.push({ ...item, name: "setup", detail: setupFailure });
        else storedItems.push({ label, target: "-", pass: false, detail: `setup failed: ${setupFailure}` });
        continue;
      }
      if (c.type === "numeric") judgeNumericRun(engine, data, run, label, tolerance, numericItems);
      else if (c.type === "behavior") judgeBehaviorRun(engine, run, label, behaviorItems);
      else if (c.type === "stored_not_judged") judgeStoredRun(engine, run, label, storedItems);
    }
  }

  const numericFailed = numericItems.filter((i) => !i.pass).length;
  const behaviorFailed = behaviorItems.filter((i) => !i.pass).length;
  const storedFailed = storedItems.filter((i) => !i.pass).length;

  const lines = [];
  const width = Math.max(
    ...numericItems.map((i) => (i.label + "  " + i.variable_id + " [" + i.unit + "]").length)
  );
  lines.push("--- numeric judgments ---");
  lines.push("=".repeat(width + 46));
  for (const i of numericItems) {
    const head = (i.label + "  " + i.variable_id + " [" + i.unit + "]").padEnd(width);
    if (i.got === null) {
      lines.push(`${head}  FAIL: ${i.note}`);
    } else {
      const tag = i.pass ? "PASS" : "FAIL";
      lines.push(
        `${head}  got=${i.got.toFixed(5).padStart(12)}  exp=${i.expected.toFixed(4).padStart(10)}  dev=${(i.deviation * 100).toFixed(3).padStart(6)}%  ${tag}`
      );
    }
  }
  lines.push("=".repeat(width + 46));
  lines.push(`numeric: ${numericItems.length} judged, FAIL = ${numericFailed}`);
  lines.push("");
  lines.push("--- behavior assertions (A5) ---");
  for (const i of behaviorItems) {
    lines.push(`${i.label}  ${i.name}: ${i.pass ? "PASS" : "FAIL"}`);
    lines.push(`      ${i.detail}`);
  }
  lines.push(`behavior: ${behaviorItems.length} judged, FAIL = ${behaviorFailed}`);
  lines.push("");
  lines.push("--- stored, not judged (A7): storage contract enforced, magnitude not judged ---");
  for (const i of storedItems) {
    lines.push(`${i.label}  storage contract: ${i.pass ? "PASS" : "FAIL"}`);
    lines.push(`      ${i.detail}`);
  }
  lines.push(`stored: ${storedItems.length} contract-checked, FAIL = ${storedFailed}`);

  return {
    numeric: { items: numericItems, failed: numericFailed },
    behavior: { items: behaviorItems, failed: behaviorFailed },
    stored: { items: storedItems, failed: storedFailed },
    lines,
    failed: numericFailed + behaviorFailed + storedFailed,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { lines, failed } = await runAcceptance();
  for (const line of lines) console.log(line);
  process.exit(failed === 0 ? 0 : 1);
}
