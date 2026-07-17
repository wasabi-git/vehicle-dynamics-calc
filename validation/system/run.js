/**
 * Part 8 system gate runner:  node validation/system/run.js
 *
 * Zero dependencies; reads only repository files. Discovers every
 * validation/system/sys_*.mjs module, requires the discovered set to equal
 * EXPECTED_MODULES exactly, runs the modules sequentially against the real
 * engine/adapter fixtures, and exits non-zero on any failure — including a
 * module that contributes zero assertions. Each module exports:
 *   export const name = "…";
 *   export async function run(t) { … }
 * with t = { ok, section, freshApp, cover }.
 */

import { readdir } from "node:fs/promises";
import { freshApp, createCoverage } from "./harness.mjs";
import { CHECKPOINTS } from "./checkpoints.mjs";

const SYSTEM_DIR = new URL("./", import.meta.url);
const EXPECTED_MODULES = ["sys_consistency", "sys_payload", "sys_scenarios"];

let passed = 0;
let failed = 0;
const coverage = createCoverage();

const t = {
  ok(label, condition) {
    if (condition) {
      passed += 1;
      console.log(`  ok    ${label}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${label}`);
    }
    return Boolean(condition);
  },
  section(title) {
    console.log(`\n${title}`);
  },
  freshApp,
  cover: coverage.cover,
};

const discovered = (await readdir(SYSTEM_DIR))
  .filter((f) => f.startsWith("sys_") && f.endsWith(".mjs"))
  .map((f) => f.slice(0, -".mjs".length))
  .sort();

if (discovered.length === 0) {
  console.log("FAIL: no system modules discovered");
  console.log("\nsystem tests: 0 passed, 1 failed");
  process.exit(1);
}
const expected = [...EXPECTED_MODULES].sort();
if (JSON.stringify(discovered) !== JSON.stringify(expected)) {
  console.log(
    `FAIL: discovered module set [${discovered.join(", ")}] ` +
    `does not equal the expected set [${expected.join(", ")}]`
  );
  console.log("\nsystem tests: 0 passed, 1 failed");
  process.exit(1);
}

for (const stem of EXPECTED_MODULES) {
  const before = passed + failed;
  const mod = await import(new URL(`${stem}.mjs`, SYSTEM_DIR));
  console.log(`\n=== ${mod.name ?? stem} ===`);
  try {
    await mod.run(t);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${stem} threw: ${error.message}`);
  }
  if (passed + failed === before) {
    failed += 1;
    console.log(`  FAIL  ${stem} contributed zero assertions`);
  }
}

// N-set closure (from T3): the covered checkpoint-id set must equal the
// 49-entry manifest exactly — missing, duplicate, and unknown ids all fail.
const manifestIds = CHECKPOINTS.map((c) => c.id);
const manifestSet = new Set(manifestIds);
if (manifestSet.size !== manifestIds.length) {
  failed += 1;
  console.log("\nFAIL: the manifest carries a duplicate checkpoint id");
}
const missing = manifestIds.filter((id) => !coverage.covered.has(id));
const unknown = [...coverage.covered].filter((id) => !manifestSet.has(id));
if (missing.length > 0) {
  failed += 1;
  console.log(`\nFAIL: uncovered checkpoint ids: ${missing.join(", ")}`);
}
if (unknown.length > 0) {
  failed += 1;
  console.log(`\nFAIL: covered ids missing from the manifest: ${unknown.join(", ")}`);
}
console.log(`\ncoverage closure: ${coverage.covered.size}/${manifestIds.length} checkpoint ids covered`);
console.log(`system tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
