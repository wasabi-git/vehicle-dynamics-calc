/**
 * One-shot engine test runner:  node engine/tests/run.js
 * Discovers nothing dynamically — each milestone registers its module here.
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

console.log("acceptance runner (cases.v0.1.json, forward numeric judgments)");
const acceptance = await runAcceptance();
for (const line of acceptance.lines) console.log(`  ${line}`);

// Python-side regression: the validator must fail structurally, not crash,
// on malformed catalogs. Interpreter fallback chain per review note:
// python -> python3 -> py -3; if none is available the suite FAILS rather
// than silently skipping the validator regression.
console.log("\nvalidate_catalog.py regression (python)");
let pythonRegressionFailed = false;
const script = join(REPO_ROOT, "tools", "test_validate_catalog.py");
const candidates = [
  ["python", [script]],
  ["python3", [script]],
  ["py", ["-3", script]],
];
let py = null;
for (const [command, args] of candidates) {
  const attempt = spawnSync(command, args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (!(attempt.error && attempt.error.code === "ENOENT")) {
    py = attempt;
    break;
  }
}
if (py === null) {
  console.log("  FAIL: no python interpreter found (tried python, python3, py -3)");
  pythonRegressionFailed = true;
} else {
  process.stdout.write((py.stdout || "").split("\n").map((l) => (l ? `  ${l}` : l)).join("\n"));
  if (py.stderr) process.stderr.write(py.stderr);
  if (py.status !== 0) pythonRegressionFailed = true;
}

const unitTestsGreen = summary("engine tests");
process.exit(unitTestsGreen && acceptance.failed === 0 && !pythonRegressionFailed ? 0 : 1);
