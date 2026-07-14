/**
 * acceptance.mjs — minimal acceptance runner (M3).
 *
 * Consumes validation/acceptance/cases.v0.1.json directly and judges every
 * forward numeric expected value:
 *   - each run is one independent solve (global inputs + run additions);
 *   - relative tolerance from tolerance_default (1%);
 *   - subset semantics: extra derived values never fail a case; an expected
 *     value passes when any pool instance of that variable hits tolerance.
 * Behavior case A5 (reverse-query assertions) and stored-not-judged case A7
 * are outside the numeric scan and are reported as not judged here.
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

/**
 * Execute the numeric acceptance scan.
 * Returns { items, passed, failed, notJudged, lines }.
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

  const items = [];
  const notJudged = [];

  for (const c of suite.cases) {
    if (c.type !== "numeric") {
      notJudged.push(`${c.id} (${c.type})`);
      continue;
    }
    for (const run of c.runs) {
      const label = runLabel(c.id, run);
      const engine = createEngineFromData(data);

      let inputFailure = null;
      for (const input of [...(c.global_inputs || []), ...(run.inputs || [])]) {
        const unitId = resolveUnitNotation(input.unit, data.units);
        const r = unitId === null
          ? { ok: false, diagnostic: { message: `unit token ${input.unit} unresolved` } }
          : engine.setUserInput(input.variable_id, input.value, unitId);
        if (!r.ok) {
          inputFailure = `${input.variable_id}: ${r.diagnostic.message}`;
          break;
        }
      }
      if (inputFailure === null) {
        const solved = engine.solve();
        if (!solved.ok) inputFailure = solved.diagnostics.map((d) => d.message).join("; ");
      }

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
        if (inputFailure !== null) {
          item.note = `run setup failed: ${inputFailure}`;
          items.push(item);
          continue;
        }
        const unitId = resolveUnitNotation(expected.unit, data.units);
        const instances = engine.getResults(expected.variable_id);
        let best = null;
        for (const instance of instances) {
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
  }

  const passed = items.filter((i) => i.pass).length;
  const failed = items.length - passed;

  const width = Math.max(...items.map((i) => (i.label + "  " + i.variable_id + " [" + i.unit + "]").length));
  const lines = [];
  lines.push("=".repeat(width + 46));
  for (const i of items) {
    const head = (i.label + "  " + i.variable_id + " [" + i.unit + "]").padEnd(width);
    if (i.got === null) {
      lines.push(`${head}  ${("FAIL: " + i.note)}`);
    } else {
      const tag = i.pass ? "PASS" : "FAIL";
      lines.push(
        `${head}  got=${i.got.toFixed(5).padStart(12)}  exp=${i.expected.toFixed(4).padStart(10)}  dev=${(i.deviation * 100).toFixed(3).padStart(6)}%  ${tag}`
      );
    }
  }
  lines.push("=".repeat(width + 46));
  lines.push(`not judged by the numeric scan: ${notJudged.join(", ")}`);
  lines.push(`total ${items.length} numeric judgments, FAIL = ${failed}`);

  return { items, passed, failed, notJudged, lines };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { lines, failed } = await runAcceptance();
  for (const line of lines) console.log(line);
  process.exit(failed === 0 ? 0 : 1);
}
