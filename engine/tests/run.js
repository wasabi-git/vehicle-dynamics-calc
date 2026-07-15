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
import * as gateTests from "./test_gate.mjs";
import * as riskWarningTests from "./test_risk_warnings.mjs";
import { runAcceptance } from "./acceptance.mjs";
import { parseCrossCheckOutput, reconcile } from "./reconcile.mjs";

const MODULES = [loaderTests, unitTests, resultTests, deriveTests, staleTests, reverseTests, gateTests, riskWarningTests];

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
// Strictly enforced by reconcile.mjs: exactly 23 parsed and matched, exactly
// one cases-only extra (A3 wheel_radius [in]), tags AND got values compared.
console.log("\nreconciliation with cross_check.py (item by item, strictly enforced)");
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
  const result = reconcile(acceptance.numeric.items, parseCrossCheckOutput(cc.stdout));
  for (const line of result.lines) console.log(`  ${line}`);
  if (result.failed) {
    reconciliationFailed = true;
    for (const failure of result.failures) console.log(`  ENFORCEMENT FAIL: ${failure}`);
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
