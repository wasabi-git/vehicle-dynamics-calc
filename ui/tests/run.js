/**
 * One-shot UI test runner:  node ui/tests/run.js
 *
 * Zero dependencies; reads only files inside the repository. Discovers every
 * ui/tests/test_*.mjs module (sorted by name), runs them sequentially, and
 * exits non-zero on any failure. Each test module exports:
 *   export const name = "…";
 *   export async function run(t) { … }
 * with t = { ok, section, freshApp } — freshApp() builds a real engine plus
 * the frozen catalog adapter through a repository-root file reader.
 */

import { readdir, readFile } from "node:fs/promises";
import { createEngine } from "../../engine/index.mjs";
import { buildCatalogAdapter } from "../adapter/catalog_adapter.mjs";

const TESTS_DIR = new URL("./", import.meta.url);
const REPO_ROOT = new URL("../../", import.meta.url);

const readText = (relPath) => readFile(new URL(relPath, REPO_ROOT), "utf8");

let passed = 0;
let failed = 0;

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
  async freshApp() {
    const { ok, engine, diagnostics } = await createEngine(readText);
    if (!ok) {
      throw new Error(`catalog failed to load: ${diagnostics.map((d) => d.message).join("; ")}`);
    }
    const adapter = await buildCatalogAdapter(readText);
    return { engine, adapter };
  },
};

const entries = (await readdir(TESTS_DIR)).filter(
  (f) => f.startsWith("test_") && f.endsWith(".mjs")
);
entries.sort();

for (const entry of entries) {
  const mod = await import(new URL(entry, TESTS_DIR));
  console.log(`\n=== ${mod.name ?? entry} ===`);
  try {
    await mod.run(t);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${entry} threw: ${error.message}`);
  }
}

console.log(`\nui tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
