/**
 * One-shot engine test runner:  node engine/tests/run.js
 * Discovers nothing dynamically — each milestone registers its module here.
 *
 * Order: unit/mechanism tests (M0–M5) -> full acceptance scan (numeric +
 * A5 behavior + A7 stored-not-judged) -> item-by-item reconciliation of the
 * numeric scan against validation/tools/cross_check.py -> python-side
 * validator regression.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { summary } from "./harness.mjs";
import { REPO_ROOT } from "./node_reader.mjs";
import * as loaderTests from "./test_loader.mjs";
import * as unitTests from "./test_units.mjs";
import * as resultTests from "./test_result.mjs";
import * as deriveTests from "./test_derive.mjs";
import * as staleTests from "./test_stale.mjs";
import * as reverseTests from "./test_reverse.mjs";
import { runAcceptance } from "./acceptance.mjs";

const MODULES = [loaderTests, unitTests, resultTests, deriveTests, staleTests, reverseTests];

for (const mod of MODULES) {
  await mod.run();
  console.log("");
}

console.log("acceptance runner (cases.v0.1.json: numeric + behavior + stored-not-judged)");
const acceptance = await runAcceptance();
for (const line of acceptance.lines) console.log(`  ${line}`);

// ---- python helper: python -> python3 -> py -3; absence is a failure ------
function runPython(scriptArgs) {
  const candidates = [
    ["python", scriptArgs],
    ["python3", scriptArgs],
    ["py", ["-3", ...scriptArgs]],
  ];
  for (const [command, args] of candidates) {
    const attempt = spawnSync(command, args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    if (!(attempt.error && attempt.error.code === "ENOENT")) return attempt;
  }
  return null;
}

// ---- reconciliation: engine numeric scan <-> cross_check.py (24 <-> 23) ----
// cross_check prints short names / ASCII variants; map back to case tokens.
const CC_NAME_MAP = { long_accel: "longitudinal_acceleration" };
const CC_UNIT_MAP = { "ft/s2": "ft/s^2" };
const CC_LINE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+got=\s*(-?[\d.]+)\s+exp=\s*(-?[\d.]+)\s+dev=\s*([\d.]+)%\s+(PASS|FAIL)\s*$/;

console.log("\nreconciliation with cross_check.py (item by item)");
let reconciliationFailed = false;
const cc = runPython([join(REPO_ROOT, "validation", "tools", "cross_check.py")]);
if (cc === null) {
  console.log("  FAIL: no python interpreter found (tried python, python3, py -3)");
  reconciliationFailed = true;
} else {
  if (cc.status !== 0) {
    console.log(`  FAIL: cross_check.py exited ${cc.status}`);
    reconciliationFailed = true;
  }
  const ccItems = [];
  for (const line of (cc.stdout || "").split(/\r?\n/)) {
    const match = CC_LINE.exec(line.trim());
    if (match) {
      ccItems.push({
        label: match[1],
        variable_id: CC_NAME_MAP[match[2]] ?? match[2],
        unit: CC_UNIT_MAP[match[3]] ?? match[3],
        got: Number(match[4]),
        expected: Number(match[5]),
        tag: match[7],
      });
    }
  }
  const engineItems = [...acceptance.numeric.items];
  const matchedEngineItems = new Set();
  for (const ccItem of ccItems) {
    const engineItem = engineItems.find(
      (i) =>
        !matchedEngineItems.has(i) &&
        i.label === ccItem.label &&
        i.variable_id === ccItem.variable_id &&
        i.unit === ccItem.unit &&
        // cross_check prints exp with 4 decimals; match at print precision.
        Math.abs(i.expected - ccItem.expected) <= 1e-4 * Math.max(1, Math.abs(ccItem.expected))
    );
    if (!engineItem) {
      console.log(`  FAIL  ${ccItem.label} ${ccItem.variable_id} [${ccItem.unit}]: no engine counterpart`);
      reconciliationFailed = true;
      continue;
    }
    matchedEngineItems.add(engineItem);
    const engineTag = engineItem.pass ? "PASS" : "FAIL";
    const agree = engineTag === ccItem.tag;
    if (!agree) reconciliationFailed = true;
    const head = `${ccItem.label}  ${ccItem.variable_id} [${ccItem.unit}]`.padEnd(44);
    console.log(
      `  ${agree ? "ok  " : "FAIL"}  ${head} engine ${engineTag} (got ${engineItem.got.toFixed(5)})` +
      ` <-> cross_check ${ccItem.tag} (got ${ccItem.got.toFixed(5)})  exp ${ccItem.expected}`
    );
  }
  const casesOnly = engineItems.filter((i) => !matchedEngineItems.has(i));
  for (const item of casesOnly) {
    console.log(
      `  note  ${item.label}  ${item.variable_id} [${item.unit}]  cases-only duplicate judgment ` +
      `(engine ${item.pass ? "PASS" : "FAIL"}; not re-checked by cross_check.py)`
    );
    if (!item.pass) reconciliationFailed = true;
  }
  console.log(
    `  reconciled ${ccItems.length} cross_check items against ${engineItems.length} engine judgments; ` +
    `cases-only extras: ${casesOnly.length}`
  );
  if (ccItems.length === 0) {
    console.log("  FAIL: no parsable cross_check output");
    reconciliationFailed = true;
  }
}

// ---- python-side validator regression --------------------------------------
console.log("\nvalidate_catalog.py regression (python)");
let pythonRegressionFailed = false;
const py = runPython([join(REPO_ROOT, "tools", "test_validate_catalog.py")]);
if (py === null) {
  console.log("  FAIL: no python interpreter found (tried python, python3, py -3)");
  pythonRegressionFailed = true;
} else {
  process.stdout.write((py.stdout || "").split("\n").map((l) => (l ? `  ${l}` : l)).join("\n"));
  if (py.stderr) process.stderr.write(py.stderr);
  if (py.status !== 0) pythonRegressionFailed = true;
}

const unitTestsGreen = summary("engine tests");
const allGreen = unitTestsGreen && acceptance.failed === 0 && !reconciliationFailed && !pythonRegressionFailed;
console.log(`one-shot gate: ${allGreen ? "ALL GREEN" : "FAILED"}`);
process.exit(allGreen ? 0 : 1);
