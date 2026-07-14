/**
 * One-shot engine test runner:  node engine/tests/run.js
 * Discovers nothing dynamically — each milestone registers its module here.
 */

import { summary } from "./harness.mjs";
import * as loaderTests from "./test_loader.mjs";
import * as unitTests from "./test_units.mjs";
import * as resultTests from "./test_result.mjs";
import * as deriveTests from "./test_derive.mjs";
import { runAcceptance } from "./acceptance.mjs";

const MODULES = [loaderTests, unitTests, resultTests, deriveTests];

for (const mod of MODULES) {
  await mod.run();
  console.log("");
}

console.log("acceptance runner (cases.v0.1.json, forward numeric judgments)");
const acceptance = await runAcceptance();
for (const line of acceptance.lines) console.log(`  ${line}`);

const unitTestsGreen = summary("engine tests");
process.exit(unitTestsGreen && acceptance.failed === 0 ? 0 : 1);
