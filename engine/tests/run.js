/**
 * One-shot engine test runner:  node engine/tests/run.js
 * Discovers nothing dynamically — each milestone registers its module here.
 */

import { summary } from "./harness.mjs";
import * as loaderTests from "./test_loader.mjs";

const MODULES = [loaderTests];

for (const mod of MODULES) {
  await mod.run();
  console.log("");
}

process.exit(summary("engine tests") ? 0 : 1);
